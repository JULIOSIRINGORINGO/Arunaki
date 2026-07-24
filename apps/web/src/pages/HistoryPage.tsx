/* Hallmark · macrostructure: Timeline List · theme: Studio · accent: green */
import { Clock, Search, MessageSquare } from "lucide-react";

const mockHistory = [
  {
    group: "Hari Ini",
    items: [
      { id: "1", title: "Bagaimana menulis CV?", time: "10:23", type: "chat" },
      { id: "2", title: "Translasi ke Inggris", time: "09:45", type: "chat" },
    ],
  },
  {
    group: "Kemarin",
    items: [
      { id: "3", title: "Brainstorming project", time: "16:30", type: "chat" },
      { id: "4", title: "Coding question", time: "14:15", type: "chat" },
    ],
  },
  {
    group: "Minggu Lalu",
    items: [
      { id: "5", title: "Marketing strategy", time: "3 hari lalu", type: "chat" },
      { id: "6", title: "Email templates", time: "5 hari lalu", type: "chat" },
    ],
  },
];

export function HistoryPage() {
  return (
    <div className="p-8 max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-lg font-semibold text-surface-900">
          Riwayat Chat
        </h1>
        <p className="text-[13px] text-surface-500 mt-0.5">
          Lihat percakapan sebelumnya
        </p>
      </div>

      <div className="relative mb-6">
        <Search
          size={14}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-500"
        />
        <input
          type="text"
          placeholder="Cari riwayat..."
          className="w-full pl-9 pr-3 py-2 bg-surface-100 border border-surface-200 rounded-lg text-[13px] text-surface-900 placeholder:text-surface-500 focus:outline-none focus:border-accent/40 focus:ring-1 focus:ring-accent/20 transition-all duration-150"
        />
      </div>

      <div className="space-y-6">
        {mockHistory.map((group) => (
          <div key={group.group} className="animate-fade-in">
            <div className="flex items-center gap-2.5 mb-2.5">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-surface-500 uppercase tracking-wider">
                <Clock size={11} />
                {group.group}
              </div>
              <div className="flex-1 h-px bg-surface-200" />
            </div>

            <div className="space-y-px ml-4">
              {group.items.map((item) => (
                <button
                  key={item.id}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-surface-100 transition-colors text-left group"
                >
                  <div className="w-7 h-7 rounded-md bg-surface-200 group-hover:bg-accent/10 flex items-center justify-center transition-colors">
                    <MessageSquare size={12} className="text-surface-500 group-hover:text-accent transition-colors" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium text-surface-700 group-hover:text-surface-900 truncate transition-colors">
                      {item.title}
                    </p>
                  </div>
                  <span className="text-[11px] text-surface-500 shrink-0">
                    {item.time}
                  </span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
