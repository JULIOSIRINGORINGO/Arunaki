import { useState } from "react";

export function SettingsPage() {
  const [theme, setTheme] = useState<"light" | "dark">("light");

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
        Settings
      </h1>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
        Configure your Arunaki agent
      </p>

      <div className="space-y-6">
        {/* AI Model */}
        <div className="p-4 border border-gray-200 dark:border-gray-800 rounded-lg bg-white dark:bg-gray-900">
          <h3 className="font-medium text-gray-900 dark:text-white mb-2">
            AI Model
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Using NVIDIA Nemotron 3 Ultra via OpenRouter
          </p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
            Model: nvidia/nemotron-3-ultra-550b-a55b:free
          </p>
        </div>

        {/* Theme */}
        <div className="p-4 border border-gray-200 dark:border-gray-800 rounded-lg bg-white dark:bg-gray-900">
          <h3 className="font-medium text-gray-900 dark:text-white mb-3">
            Appearance
          </h3>
          <div className="flex gap-3">
            <button
              onClick={() => setTheme("light")}
              className={`px-4 py-2 rounded-lg border ${
                theme === "light"
                  ? "border-purple-500 bg-purple-50 text-purple-700"
                  : "border-gray-200 hover:bg-gray-50"
              }`}
            >
              Light
            </button>
            <button
              onClick={() => setTheme("dark")}
              className={`px-4 py-2 rounded-lg border ${
                theme === "dark"
                  ? "border-purple-500 bg-purple-900/30 text-purple-400"
                  : "border-gray-200 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
              }`}
            >
              Dark
            </button>
          </div>
        </div>

        {/* Storage */}
        <div className="p-4 border border-gray-200 dark:border-gray-800 rounded-lg bg-white dark:bg-gray-900">
          <h3 className="font-medium text-gray-900 dark:text-white mb-2">
            Storage
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Local filesystem storage
          </p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
            Documents are stored locally on the server
          </p>
        </div>

        {/* About */}
        <div className="p-4 border border-gray-200 dark:border-gray-800 rounded-lg bg-white dark:bg-gray-900">
          <h3 className="font-medium text-gray-900 dark:text-white mb-2">
            About
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Arunaki AI Agent v0.1
          </p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
            Autonomous Workspace Agent for document analysis and report generation
          </p>
        </div>
      </div>
    </div>
  );
}
