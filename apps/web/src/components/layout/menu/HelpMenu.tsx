import { memo } from "react";
import {
  BookOpen,
  Keyboard,
  ExternalLink,
  Bug,
  Info,
} from "lucide-react";
import { cn } from "../../../lib/utils";
import { BaseMenuProps } from "./types";
import { getEffectiveShortcut } from "./shortcutsConfig";

interface HelpMenuProps extends BaseMenuProps {
  onOpenShortcuts: () => void;
  onOpenAbout: () => void;
}

export const HelpMenu = memo(function HelpMenu({
  isOpen,
  onToggle,
  onMouseEnter,
  onClose,
  onOpenShortcuts,
  onOpenAbout,
}: HelpMenuProps) {
  return (
    <div className="relative">
      <button
        type="button"
        onClick={onToggle}
        onMouseEnter={onMouseEnter}
        className={cn(
          "text-[var(--text-muted)] hover:text-[var(--text-primary)] text-[13px] font-medium px-3 py-1.5 rounded-md transition-colors cursor-pointer",
          isOpen && "bg-[var(--bg-hover)] text-[var(--text-primary)]"
        )}
      >
        Help
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1 min-w-[245px] bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl shadow-2xl py-1.5 z-50 animate-in fade-in zoom-in-95 duration-100">
          <button
            type="button"
            onClick={() => {
              onClose();
              window.location.hash = "/knowledge";
            }}
            className="w-full px-3.5 py-2 text-[13px] flex items-center justify-between transition-colors cursor-pointer hover:bg-[var(--bg-hover)] text-[var(--text-primary)]"
          >
            <div className="flex items-center gap-2.5">
              <BookOpen className="w-4 h-4 text-[var(--text-muted)]" strokeWidth={1.75} />
              <span>Knowledge & Rules</span>
            </div>
          </button>

          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenShortcuts();
            }}
            className="w-full px-3.5 py-2 text-[13px] flex items-center justify-between transition-colors cursor-pointer hover:bg-[var(--bg-hover)] text-[var(--text-primary)]"
          >
            <div className="flex items-center gap-2.5">
              <Keyboard className="w-4 h-4 text-[var(--text-muted)]" strokeWidth={1.75} />
              <span>Keyboard Shortcuts</span>
            </div>
            <span className="text-[11px] text-[var(--text-muted)] font-mono">
              {getEffectiveShortcut("shortcuts") || "Ctrl+/"}
            </span>
          </button>

          <div className="h-px my-1.5 bg-[var(--border-color)]" />

          <button
            type="button"
            onClick={() => {
              onClose();
              window.open("https://github.com/JULIOSIRINGORINGO/Arunaki", "_blank");
            }}
            className="w-full px-3.5 py-2 text-[13px] flex items-center justify-between transition-colors cursor-pointer hover:bg-[var(--bg-hover)] text-[var(--text-primary)]"
          >
            <div className="flex items-center gap-2.5">
              <ExternalLink className="w-4 h-4 text-[var(--text-muted)]" strokeWidth={1.75} />
              <span>GitHub Repository</span>
            </div>
          </button>

          <button
            type="button"
            onClick={() => {
              onClose();
              window.open("https://github.com/JULIOSIRINGORINGO/Arunaki/issues", "_blank");
            }}
            className="w-full px-3.5 py-2 text-[13px] flex items-center justify-between transition-colors cursor-pointer hover:bg-[var(--bg-hover)] text-[var(--text-primary)]"
          >
            <div className="flex items-center gap-2.5">
              <Bug className="w-4 h-4 text-[var(--text-muted)]" strokeWidth={1.75} />
              <span>Report an Issue</span>
            </div>
          </button>

          <div className="h-px my-1.5 bg-[var(--border-color)]" />

          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenAbout();
            }}
            className="w-full px-3.5 py-2 text-[13px] flex items-center justify-between transition-colors cursor-pointer hover:bg-[var(--bg-hover)] text-[var(--text-primary)]"
          >
            <div className="flex items-center gap-2.5">
              <Info className="w-4 h-4 text-[var(--text-muted)]" strokeWidth={1.75} />
              <span>About Arunaki</span>
            </div>
          </button>
        </div>
      )}
    </div>
  );
});
