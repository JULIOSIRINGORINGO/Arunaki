import { Clock, Search, MessageSquare } from "lucide-react";

const mockHistory = [
  {
    group: "Today",
    items: [
      { id: "1", title: "How to write a CV?", time: "10:23", type: "chat" },
      { id: "2", title: "Translate to English", time: "09:45", type: "chat" },
    ],
  },
  {
    group: "Yesterday",
    items: [
      { id: "3", title: "Brainstorming project", time: "16:30", type: "chat" },
      { id: "4", title: "Coding question", time: "14:15", type: "chat" },
    ],
  },
  {
    group: "Last Week",
    items: [
      { id: "5", title: "Marketing strategy", time: "3 days ago", type: "chat" },
      { id: "6", title: "Email templates", time: "5 days ago", type: "chat" },
    ],
  },
];

export function HistoryPage() {
  return (
    <div className="flex-1 flex flex-col h-full bg-[#0A0A0A] text-[#FFFFFF] p-8 max-w-2xl mx-auto overflow-y-auto">
      <div className="mb-6">
        <h1 className="text-lg font-bold text-white tracking-tight">
          AI Conversation History
        </h1>
        <p className="text-xs text-[#A3A3A3] mt-0.5">
          View previous conversations and workspace sessions
        </p>
      </div>

      <div className="relative mb-6">
        <Search
          size={14}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-[#737373]"
        />
        <input
          type="text"
          placeholder="Search conversation history..."
          className="w-full pl-9 pr-3 py-2 bg-[#171717] border border-[#2D2D2D] rounded-xl text-xs text-white placeholder-[#737373] focus:outline-none focus:border-[#525252]"
        />
      </div>

      <div className="space-y-6">
        {mockHistory.map((group) => (
          <div key={group.group} className="space-y-2">
            <div className="flex items-center gap-2.5 mb-2.5">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[#A3A3A3] tracking-wide">
                <Clock size={11} />
                {group.group}
              </div>
              <div className="flex-1 h-px bg-[#2D2D2D]" />
            </div>

            <div className="space-y-2">
              {group.items.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-3 rounded-xl bg-[#171717] border border-[#2D2D2D] hover:border-[#525252] transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <MessageSquare size={14} className="text-[#A3A3A3]" />
                    <span className="text-xs text-white font-medium">{item.title}</span>
                  </div>
                  <span className="text-[10px] text-[#737373] font-mono">{item.time}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
