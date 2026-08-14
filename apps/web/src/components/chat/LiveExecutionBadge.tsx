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

  // Determine icon & category based on toolName (Sleek Dark Monochrome)
  let icon = <Monitor size={12} className="text-zinc-400 animate-pulse" />;
  let categoryLabel = "Desktop";

  if (toolName.includes("excel")) {
    icon = <FileSpreadsheet size={12} className="text-zinc-300 animate-pulse" />;
    categoryLabel = "Excel";
  } else if (toolName.includes("word")) {
    icon = <FileText size={12} className="text-zinc-300 animate-pulse" />;
    categoryLabel = "Word";
  } else if (toolName.includes("browser")) {
    icon = <Globe size={12} className="text-zinc-300 animate-pulse" />;
    categoryLabel = "Web";
  } else if (toolName.includes("screenshot")) {
    icon = <Camera size={12} className="text-zinc-300 animate-pulse" />;
    categoryLabel = "Shot";
  } else if (toolName.includes("send_keys") || toolName.includes("key")) {
    icon = <Keyboard size={12} className="text-zinc-300 animate-pulse" />;
    categoryLabel = "Keys";
  }

  // Format short preview string
  const rawPreview = preview || `Executing ${toolName}...`;
  const shortPreview = rawPreview.length > 28 ? rawPreview.slice(0, 28) + "..." : rawPreview;

  return (
    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-mono bg-[#1c1c1e] text-[#d4d4d8] border border-[#2c2c2e] shadow-sm transition-all animate-fade-in my-1">
      <span className="relative flex h-1.5 w-1.5">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-zinc-400 opacity-75"></span>
        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-zinc-300"></span>
      </span>
      {icon}
      <span className="font-medium text-zinc-300">{categoryLabel}</span>
      <span className="text-zinc-600">•</span>
      <span className="truncate max-w-[180px] text-zinc-400">{shortPreview}</span>
      <Loader2 size={11} className="animate-spin text-zinc-500 ml-0.5" />
    </div>
  );
}
