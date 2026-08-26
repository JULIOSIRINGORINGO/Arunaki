import { Config } from "effect"

export function truthy(key: string) {
  const value = process.env[key]?.toLowerCase()
  return value === "true" || value === "1"
}

const copy = process.env["Arunaki_EXPERIMENTAL_DISABLE_COPY_ON_SELECT"]
const fff = process.env["Arunaki_DISABLE_FFF"]

function enabledByExperimental(key: string) {
  return process.env[key] === undefined ? truthy("Arunaki_EXPERIMENTAL") : truthy(key)
}

export const Flag = {
  OTEL_EXPORTER_OTLP_ENDPOINT: process.env["OTEL_EXPORTER_OTLP_ENDPOINT"],
  OTEL_EXPORTER_OTLP_HEADERS: process.env["OTEL_EXPORTER_OTLP_HEADERS"],

  Arunaki_AUTO_HEAP_SNAPSHOT: truthy("Arunaki_AUTO_HEAP_SNAPSHOT"),
  Arunaki_GIT_BASH_PATH: process.env["Arunaki_GIT_BASH_PATH"],
  Arunaki_CONFIG: process.env["Arunaki_CONFIG"],
  Arunaki_CONFIG_CONTENT: process.env["Arunaki_CONFIG_CONTENT"],
  Arunaki_DISABLE_AUTOUPDATE: truthy("Arunaki_DISABLE_AUTOUPDATE"),
  Arunaki_ALWAYS_NOTIFY_UPDATE: truthy("Arunaki_ALWAYS_NOTIFY_UPDATE"),
  Arunaki_DISABLE_PRUNE: truthy("Arunaki_DISABLE_PRUNE"),
  Arunaki_DISABLE_TERMINAL_TITLE: truthy("Arunaki_DISABLE_TERMINAL_TITLE"),
  Arunaki_SHOW_TTFD: truthy("Arunaki_SHOW_TTFD"),
  Arunaki_DISABLE_AUTOCOMPACT: truthy("Arunaki_DISABLE_AUTOCOMPACT"),
  Arunaki_DISABLE_MODELS_FETCH: truthy("Arunaki_DISABLE_MODELS_FETCH"),
  Arunaki_DISABLE_MOUSE: truthy("Arunaki_DISABLE_MOUSE"),
  Arunaki_FAKE_VCS: process.env["Arunaki_FAKE_VCS"],
  Arunaki_SERVER_PASSWORD: process.env["Arunaki_SERVER_PASSWORD"],
  Arunaki_SERVER_USERNAME: process.env["Arunaki_SERVER_USERNAME"],
  Arunaki_DISABLE_FFF: fff === undefined ? process.platform === "win32" : truthy("Arunaki_DISABLE_FFF"),

  // Experimental
  Arunaki_EXPERIMENTAL_FILEWATCHER: Config.boolean("Arunaki_EXPERIMENTAL_FILEWATCHER").pipe(
    Config.withDefault(false),
  ),
  Arunaki_EXPERIMENTAL_DISABLE_FILEWATCHER: Config.boolean("Arunaki_EXPERIMENTAL_DISABLE_FILEWATCHER").pipe(
    Config.withDefault(false),
  ),
  Arunaki_EXPERIMENTAL_DISABLE_COPY_ON_SELECT:
    copy === undefined ? process.platform === "win32" : truthy("Arunaki_EXPERIMENTAL_DISABLE_COPY_ON_SELECT"),
  Arunaki_MODELS_URL: process.env["Arunaki_MODELS_URL"],
  Arunaki_MODELS_PATH: process.env["Arunaki_MODELS_PATH"],
  Arunaki_DB: process.env["Arunaki_DB"],

  Arunaki_WORKSPACE_ID: process.env["Arunaki_WORKSPACE_ID"],
  Arunaki_EXPERIMENTAL_WORKSPACES: enabledByExperimental("Arunaki_EXPERIMENTAL_WORKSPACES"),

  // Evaluated at access time (not module load) because tests, the CLI, and
  // external tooling set these env vars at runtime.
  get Arunaki_DISABLE_PROJECT_CONFIG() {
    return truthy("Arunaki_DISABLE_PROJECT_CONFIG")
  },
  get Arunaki_EXPERIMENTAL_REFERENCES() {
    return enabledByExperimental("Arunaki_EXPERIMENTAL_REFERENCES")
  },
  get Arunaki_TUI_CONFIG() {
    return process.env["Arunaki_TUI_CONFIG"]
  },
  get Arunaki_CONFIG_DIR() {
    return process.env["Arunaki_CONFIG_DIR"]
  },
  get Arunaki_PURE() {
    return truthy("Arunaki_PURE")
  },
  get Arunaki_PERMISSION() {
    return process.env["Arunaki_PERMISSION"]
  },
  get Arunaki_PLUGIN_META_FILE() {
    return process.env["Arunaki_PLUGIN_META_FILE"]
  },
  get Arunaki_CLIENT() {
    return process.env["Arunaki_CLIENT"] ?? "cli"
  },
}
