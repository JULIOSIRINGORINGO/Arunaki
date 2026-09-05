import { memo } from "react";
import { ChevronRight } from "lucide-react";

interface CenterBreadcrumbsProps {
  folderName: string;
  tabTitle: string;
}

export const CenterBreadcrumbs = memo(function CenterBreadcrumbs({
  folderName,
  tabTitle,
}: CenterBreadcrumbsProps) {
  return (
    <div className="h-[22px] bg-[#1e1e1e] border-b border-[#252526] px-4 flex items-center gap-1.5 text-[11px] text-[#969696] select-none shrink-0 font-sans">
      <span>{folderName}</span>
      <ChevronRight className="w-3 h-3 text-[#6e7681]" />
      <span className="text-[#cccccc] font-medium">{tabTitle}</span>
    </div>
  );
});
