export function HistoryPage() {
  return (
    <div className="p-6">
      <h1 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
        Chat History
      </h1>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
        View your previous conversations
      </p>

      <div className="p-6 border border-gray-200 dark:border-gray-800 rounded-lg bg-white dark:bg-gray-900 text-center">
        <p className="text-gray-500 dark:text-gray-400">
          No chat history yet
        </p>
      </div>
    </div>
  );
}
