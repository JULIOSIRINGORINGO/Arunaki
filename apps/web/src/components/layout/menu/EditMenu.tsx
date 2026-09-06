import { memo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Undo2,
  Redo2,
  Scissors,
  Copy,
  Clipboard,
  CheckSquare,
  Search,
  Settings,
  Keyboard,
} from "lucide-react";
import { cn } from "../../../lib/utils";
import { BaseMenuProps } from "./types";
import { getEffectiveShortcut } from "./shortcutsConfig";

interface EditMenuProps extends BaseMenuProps {
  onOpenShortcuts?: () => void;
}

export const EditMenu = memo(function EditMenu({
  isOpen,
  onToggle,
  onMouseEnter,
  onClose,
  onOpenShortcuts,
}: EditMenuProps) {
  const navigate = useNavigate();

  const handleUndo = () => {
    document.execCommand("undo");
    onClose();
  };

  const handleRedo = () => {
    document.execCommand("redo");
    onClose();
  };

  const handleCut = () => {
    document.execCommand("cut");
    onClose();
  };

  const handleCopy = () => {
    document.execCommand("copy");
    onClose();
  };

  const handlePaste = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.readText) {
        const text = await navigator.clipboard.readText();
        document.execCommand("insertText", false, text);
      } else {
        document.execCommand("paste");
      }
    } catch {
      document.execCommand("paste");
    }
    onClose();
  };

  const handleSelectAll = () => {
    document.execCommand("selectAll");
    onClose();
  };

  const handleFind = () => {
    window.dispatchEvent(new CustomEvent("arunaki-search-session"));
    onClose();
  };

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
        Edit
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1 min-w-[245px] bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl shadow-2xl py-1.5 z-50 animate-in fade-in zoom-in-95 duration-100">
          <button
            type="button"
            onClick={handleUndo}
            className="w-full px-3.5 py-2 text-[13px] flex items-center justify-between transition-colors cursor-pointer hover:bg-[var(--bg-hover)] text-[var(--text-primary)]"
          >
            <div className="flex items-center gap-2.5">
              <Undo2 className="w-4 h-4 text-[var(--text-muted)]" strokeWidth={1.75} />
              <span>Undo</span>
            </div>
            <span className="text-[11px] text-[var(--text-muted)] font-mono">
              {getEffectiveShortcut("undo") || "Ctrl+Z"}
            </span>
          </button>

          <button
            type="button"
            onClick={handleRedo}
            className="w-full px-3.5 py-2 text-[13px] flex items-center justify-between transition-colors cursor-pointer hover:bg-[var(--bg-hover)] text-[var(--text-primary)]"
          >
            <div className="flex items-center gap-2.5">
              <Redo2 className="w-4 h-4 text-[var(--text-muted)]" strokeWidth={1.75} />
              <span>Redo</span>
            </div>
            <span className="text-[11px] text-[var(--text-muted)] font-mono">
              {getEffectiveShortcut("redo") || "Ctrl+Y"}
            </span>
          </button>

          <div className="h-px my-1.5 bg-[var(--border-color)]" />

          <button
            type="button"
            onClick={handleCut}
            className="w-full px-3.5 py-2 text-[13px] flex items-center justify-between transition-colors cursor-pointer hover:bg-[var(--bg-hover)] text-[var(--text-primary)]"
          >
            <div className="flex items-center gap-2.5">
              <Scissors className="w-4 h-4 text-[var(--text-muted)]" strokeWidth={1.75} />
              <span>Cut</span>
            </div>
            <span className="text-[11px] text-[var(--text-muted)] font-mono">
              {getEffectiveShortcut("cut") || "Ctrl+X"}
            </span>
          </button>

          <button
            type="button"
            onClick={handleCopy}
            className="w-full px-3.5 py-2 text-[13px] flex items-center justify-between transition-colors cursor-pointer hover:bg-[var(--bg-hover)] text-[var(--text-primary)]"
          >
            <div className="flex items-center gap-2.5">
              <Copy className="w-4 h-4 text-[var(--text-muted)]" strokeWidth={1.75} />
              <span>Copy</span>
            </div>
            <span className="text-[11px] text-[var(--text-muted)] font-mono">
              {getEffectiveShortcut("copy") || "Ctrl+C"}
            </span>
          </button>

          <button
            type="button"
            onClick={handlePaste}
            className="w-full px-3.5 py-2 text-[13px] flex items-center justify-between transition-colors cursor-pointer hover:bg-[var(--bg-hover)] text-[var(--text-primary)]"
          >
            <div className="flex items-center gap-2.5">
              <Clipboard className="w-4 h-4 text-[var(--text-muted)]" strokeWidth={1.75} />
              <span>Paste</span>
            </div>
            <span className="text-[11px] text-[var(--text-muted)] font-mono">
              {getEffectiveShortcut("paste") || "Ctrl+V"}
            </span>
          </button>

          <button
            type="button"
            onClick={handleSelectAll}
            className="w-full px-3.5 py-2 text-[13px] flex items-center justify-between transition-colors cursor-pointer hover:bg-[var(--bg-hover)] text-[var(--text-primary)]"
          >
            <div className="flex items-center gap-2.5">
              <CheckSquare className="w-4 h-4 text-[var(--text-muted)]" strokeWidth={1.75} />
              <span>Select All</span>
            </div>
            <span className="text-[11px] text-[var(--text-muted)] font-mono">
              {getEffectiveShortcut("select-all") || "Ctrl+A"}
            </span>
          </button>

          <div className="h-px my-1.5 bg-[var(--border-color)]" />

          <button
            type="button"
            onClick={handleFind}
            className="w-full px-3.5 py-2 text-[13px] flex items-center justify-between transition-colors cursor-pointer hover:bg-[var(--bg-hover)] text-[var(--text-primary)]"
          >
            <div className="flex items-center gap-2.5">
              <Search className="w-4 h-4 text-[var(--text-muted)]" strokeWidth={1.75} />
              <span>Find in Session...</span>
            </div>
            <span className="text-[11px] text-[var(--text-muted)] font-mono">
              {getEffectiveShortcut("find-session") || "Ctrl+F"}
            </span>
          </button>

          <div className="h-px my-1.5 bg-[var(--border-color)]" />

          {onOpenShortcuts && (
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
          )}

          <button
            type="button"
            onClick={() => {
              onClose();
              navigate("/settings");
            }}
            className="w-full px-3.5 py-2 text-[13px] flex items-center justify-between transition-colors cursor-pointer hover:bg-[var(--bg-hover)] text-[var(--text-primary)]"
          >
            <div className="flex items-center gap-2.5">
              <Settings className="w-4 h-4 text-[var(--text-muted)]" strokeWidth={1.75} />
              <span>Preferences / Settings</span>
            </div>
            <span className="text-[11px] text-[var(--text-muted)] font-mono">
              {getEffectiveShortcut("settings") || "Ctrl+,"}
            </span>
          </button>
        </div>
      )}
    </div>
  );
});
