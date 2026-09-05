import { memo } from "react";
import { GitBranch, AlertTriangle } from "lucide-react";

interface CenterStatusBarProps {
  cursorPos: { line: number; col: number };
  langMode: string;
}

export const CenterStatusBar = memo(function CenterStatusBar({
  cursorPos,
  langMode,
}: CenterStatusBarProps) {
  return (
    <footer className="h-[22px] bg-white text-black border-t border-neutral-300 px-3 flex items-center justify-between text-[11px] font-sans select-none shrink-0 font-medium">
      <div className="flex items-center gap-3">
        <span className="flex items-center gap-1 hover:bg-black/10 px-1.5 py-0.5 rounded cursor-pointer text-black">
          <GitBranch className="w-3 h-3 text-black" />
          <span>main*</span>
        </span>
        <span className="flex items-center gap-1 hover:bg-black/10 px-1.5 py-0.5 rounded cursor-pointer text-black">
          <AlertTriangle className="w-3 h-3 text-black" />
          <span>0</span>
        </span>
      </div>

      <div className="flex items-center gap-3 text-black">
        <span className="hover:bg-black/10 px-1.5 py-0.5 rounded cursor-pointer">
          Ln {cursorPos.line}, Col {cursorPos.col}
        </span>
        <span className="hover:bg-black/10 px-1.5 py-0.5 rounded cursor-pointer">Spaces: 4</span>
        <span className="hover:bg-black/10 px-1.5 py-0.5 rounded cursor-pointer">UTF-8</span>
        <span className="hover:bg-black/10 px-1.5 py-0.5 rounded cursor-pointer">CRLF</span>
        <span className="hover:bg-black/10 px-1.5 py-0.5 rounded cursor-pointer font-bold">
          {langMode}
        </span>
      </div>
    </footer>
  );
});
