import { Effect, Schema } from "effect"
import * as Tool from "./tool"
import TurndownService from "turndown"
import DESCRIPTION from "./browse-website.txt"

const DEFAULT_TIMEOUT = 45000 // 45 seconds

export const Parameters = Schema.Struct({
  url: Schema.String.annotate({ description: "The URL to browse. Can be a homepage, search page, or product page." }),
  click_text: Schema.optional(Schema.String).annotate({
    description:
      'Optional text of a button/link to click after page loads (e.g., "Pesanan Grosir", "Load More", "Show Stock"). Case-insensitive partial match.',
  }),
  wait_after_click: Schema.optional(Schema.Number).annotate({
    description: "Optional milliseconds to wait after clicking (default: 2000). Increase for slow-loading modals.",
  }),
  search_query: Schema.optional(Schema.String).annotate({
    description:
      'Optional search query to type into the site search bar. The tool will look for input[type="search"], input[name="q"], or similar search fields.',
  }),
})

async function browseWithPuppeteer(params: {
  url: string
  click_text?: string
  wait_after_click?: number
  search_query?: string
}) {
  const puppeteer = await import("puppeteer")

  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-gpu"],
  })

  try {
    const page = await browser.newPage()

    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36",
    )

    // Navigate to the URL
    await page.goto(params.url, {
      waitUntil: "networkidle2",
      timeout: DEFAULT_TIMEOUT,
    })

    // If search_query is provided, find the search input and type
    if (params.search_query) {
      const searchSelectors = [
        'input[type="search"]',
        'input[name="q"]',
        'input[name="query"]',
        'input[name="search"]',
        'input[placeholder*="search" i]',
        'input[placeholder*="cari" i]',
        'input[placeholder*="Search" i]',
      ]

      let searchInput = null
      for (const selector of searchSelectors) {
        searchInput = await page.$(selector)
        if (searchInput) break
      }

      if (searchInput) {
        await searchInput.click()
        await searchInput.type(params.search_query, { delay: 30 })
        await page.keyboard.press("Enter")
        await page.waitForNavigation({ waitUntil: "networkidle2", timeout: 15000 }).catch(() => {})
        // Wait a bit more for dynamic results
        await new Promise((r) => setTimeout(r, 2000))
      }
    }

    // If click_text is provided, find and click the matching button/link
    if (params.click_text) {
      const clickTarget = params.click_text.toLowerCase()
      const clickableSelectors = 'button, a, div[role="button"], span[role="button"], [onclick]'
      const elements = await page.$$(clickableSelectors)

      for (const el of elements) {
        const text = await page.evaluate((e: Element) => e.textContent || "", el)
        if (text && text.trim().toLowerCase().includes(clickTarget)) {
          await el.click().catch(() => {})
          const waitTime = params.wait_after_click ?? 2000
          await new Promise((r) => setTimeout(r, waitTime))
          break
        }
      }
    }

    // AUTO-DETECT: Automatically click common e-commerce buttons that reveal
    // hidden stock/wholesale/pricing data, even if LLM didn't specify click_text.
    const autoClickKeywords = [
      "pesanan grosir",
      "wholesale",
      "grosir",
      "lihat stok",
      "cek stok",
      "show stock",
      "view stock",
      "detail harga",
      "price detail",
      "selengkapnya",
      "load more",
      "show more",
      "lihat semua",
      "view all",
    ]
    const clickableAll = await page.$$('button, a, div[role="button"], span[role="button"], [onclick]')
    const clickedTexts: string[] = []
    for (const el of clickableAll) {
      const text = await page.evaluate((e: Element) => (e.textContent || "").trim(), el)
      if (!text) continue
      const lower = text.toLowerCase()
      for (const keyword of autoClickKeywords) {
        if (lower.includes(keyword) && !clickedTexts.includes(lower)) {
          await el.click().catch(() => {})
          clickedTexts.push(lower)
          await new Promise((r) => setTimeout(r, 2500))
          break
        }
      }
    }

    // Wait a moment for any final rendering
    await new Promise((r) => setTimeout(r, 500))

    // Extract the fully rendered HTML
    const html = await page.content()
    const pageTitle = await page.title()
    const pageUrl = page.url()

    return { html, pageTitle, pageUrl }
  } finally {
    await browser.close()
  }
}

export const BrowseWebsiteTool = Tool.define(
  "browse_website",
  Effect.gen(function* () {
    return {
      description: DESCRIPTION,
      parameters: Parameters,
      execute: (params: Schema.Schema.Type<typeof Parameters>, ctx: Tool.Context) =>
        Effect.gen(function* () {
          if (!params.url.startsWith("http://") && !params.url.startsWith("https://")) {
            throw new Error("URL must start with http:// or https://")
          }

          yield* ctx.ask({
            permission: "browse_website",
            patterns: [params.url],
            always: ["*"],
            metadata: {
              url: params.url,
              click_text: params.click_text,
              search_query: params.search_query,
            },
          })

          const result = yield* Effect.tryPromise({
            try: () =>
              browseWithPuppeteer({
                url: params.url,
                click_text: params.click_text,
                wait_after_click: params.wait_after_click,
                search_query: params.search_query,
              }),
            catch: (e) => new Error(`Failed to browse website: ${String(e)}`),
          })

          // Convert to Markdown
          const turndown = new TurndownService({
            headingStyle: "atx",
            hr: "---",
            bulletListMarker: "-",
            codeBlockStyle: "fenced",
            emDelimiter: "*",
          })
          turndown.remove(["script", "style", "meta", "link", "noscript"])

          // Preserve table structure
          turndown.addRule("tableCell", {
            filter: ["th", "td"],
            replacement: (content) => ` ${content.trim()} |`,
          })
          turndown.addRule("tableRow", {
            filter: "tr",
            replacement: (content) => `|${content}\n`,
          })

          const markdown = turndown.turndown(result.html)

          return {
            title: `Browsed: ${result.pageTitle || result.pageUrl}`,
            output: `# ${result.pageTitle}\n**URL:** ${result.pageUrl}\n\n${markdown}`,
            metadata: {
              url: result.pageUrl,
              originalUrl: params.url,
              clickedButton: params.click_text || null,
              searchQuery: params.search_query || null,
            },
          }
        }).pipe(Effect.orDie),
    }
  }),
)
