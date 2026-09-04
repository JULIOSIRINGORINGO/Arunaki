import yargs from "yargs"
import { hideBin } from "yargs/helpers"
import { ServeCommand } from "./cli/cmd/serve"
import { UI } from "./cli/ui"
import { InstallationVersion } from "@arunaki/core/installation/version"
import { FormatError } from "./cli/error"
import { EOL } from "os"
import { errorMessage } from "./util/error"
import { Heap } from "./cli/heap"

const args = hideBin(process.argv)

function show(out: string) {
  const text = out.trimStart()
  if (!text.startsWith("Arunaki ")) {
    process.stderr.write(UI.logo() + EOL + EOL)
    process.stderr.write(text + EOL)
    return
  }
  process.stderr.write(out)
}

const cli = yargs(args)
  .parserConfiguration({ "populate--": true })
  .scriptName("arunaki")
  .wrap(100)
  .help("help", "show help")
  .alias("help", "h")
  .version("version", "show version number", InstallationVersion)
  .alias("version", "v")
  .option("print-logs", {
    describe: "print logs to stderr",
    type: "boolean",
  })
  .option("log-level", {
    describe: "log level",
    type: "string",
    choices: ["DEBUG", "INFO", "WARN", "ERROR"],
  })
  .middleware(async (opts) => {
    if (opts.printLogs) process.env.Arunaki_PRINT_LOGS = "1"
    if (opts.logLevel) process.env.Arunaki_LOG_LEVEL = opts.logLevel

    Heap.start()

    process.env.AGENT = "1"
    process.env.Arunaki = "1"
    process.env.Arunaki_PID = String(process.pid)
  })
  .usage("")
  .command(ServeCommand)
  .fail((msg, err) => {
    if (
      msg?.startsWith("Unknown argument") ||
      msg?.startsWith("Not enough non-option arguments") ||
      msg?.startsWith("Invalid values:")
    ) {
      if (err) throw err
      cli.showHelp(show)
    }
    if (err) throw err
    process.exit(1)
  })
  .strict()

try {
  if (args.includes("-h") || args.includes("--help")) {
    await cli.parse(args, (err: Error | undefined, _argv: unknown, out: string) => {
      if (err) throw err
      if (!out) return
      show(out)
    })
  } else {
    await cli.parse()
  }
} catch (e) {
  const formatted = FormatError(e)
  if (formatted) UI.error(formatted)
  if (formatted === undefined) {
    UI.error("Unexpected error: " + (e instanceof Error ? e.stack : String(e)) + EOL)
    process.stderr.write(errorMessage(e) + EOL)
  }
  process.exitCode = 1
} finally {
  process.exit()
}