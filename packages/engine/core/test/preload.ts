import path from "path"

process.env.Arunaki_DB = ":memory:"
process.env.Arunaki_MODELS_PATH = path.join(import.meta.dir, "plugin", "fixtures", "models-dev.json")
process.env.Arunaki_DISABLE_MODELS_FETCH = "true"
