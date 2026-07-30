import { Monitor, Camera, Globe, Loader2, FileSpreadsheet, FileText, Keyboard } from "lucide-react";

export interface LiveStatusData {
  toolName: string;
  preview?: string;
  screenshot?: string;
  timestamp?: string;
}

interface LiveExecutionBadgeProps {
  status: LiveStatusData | null;
  active?: boolean;
}

export function LiveExecutionBadge({ status, active = true }: LiveExecutionBadgeProps) {
  if (!status || !active) return null;

  const { toolName, preview } = status;

  // Determine icon & category based on toolName
  let icon = <Monitor size={14} className="text-emerald-500 animate-pulse" />;
  let categoryLabel = "Desktop App";
  let badgeColor = "bg-emerald-50 text-emerald-700 border-emerald-200";

  if (toolName.includes("excel")) {
    icon = <FileSpreadsheet size={14} className="text-emerald-600 animate-pulse" />;
    categoryLabel = "Excel Desktop";
    badgeColor = "bg-emerald-50 text-emerald-800 border-emerald-300";
  } else if (toolName.includes("word")) {
    icon = <FileText size={14} className="text-blue-600 animate-pulse" />;
    categoryLabel = "Word Desktop";
    badgeColor = "bg-blue-50 text-blue-800 border-blue-300";
  } else if (toolName.includes("browser")) {
    icon = <Globe size={14} className="text-indigo-600 animate-pulse" />;
    categoryLabel = "Browser Web";
    badgeColor = "bg-indigo-50 text-indigo-800 border-indigo-300";
  } else if (toolName.includes("screenshot")) {
    icon = <Camera size={14} className="text-purple-600 animate-bounce" />;
    categoryLabel = "Screenshot Captured";
    badgeColor = "bg-purple-50 text-purple-800 border-purple-300";
  } else if (toolName.includes("send_keys") || toolName.includes("key")) {
    icon = <Keyboard size={14} className="text-amber-600 animate-pulse" />;
    categoryLabel = "Keyboard Shortcut";
    badgeColor = "bg-amber-50 text-amber-800 border-amber-300";
  }

  return (
    <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border shadow-xs transition-all animate-fade-in ${badgeColor}`}>
      <span className="flex items-center gap-1.5 font-semibold">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
        </span>
        {icon}
        <span>{categoryLabel}</span>
      </span>
      <span className="text-gray-300">|</span>
      <span className="truncate max-w-xs">{preview || `Mengeksekusi ${toolName}...`}</span>
      <Loader2 size={12} className="animate-spin text-gray-400 ml-1" />
    </div>
  );
}
