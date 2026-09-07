import { memo } from "react";
import {
  PanelLeft,
  PanelRight,
  Sun,
  Moon,
  Laptop,
  Maximize,
  RotateCcw,
  Check,
} from "lucide-react";
import { cn } from "../../../lib/utils";
import { useTheme } from "../../../lib/theme";
import { BaseMenuProps } from "./types";
import { getEffectiveShortcut } from "./shortcutsConfig";

export const ViewMenu = memo(function ViewMenu({
  isOpen,
  onToggle,
  onMouseEnter,
  onClose,
}: BaseMenuProps) {
  const { theme, setTheme } = useTheme();

  const handleToggleExplorer = () => {
    window.dispatchEvent(new CustomEvent("arunaki-toggle-explorer"));
    onClose();
  };

  const handleToggleChat = () => {
    window.dispatchEvent(new CustomEvent("arunaki-toggle-chat"));
    onClose();
  };

  const handleToggleFullscreen = () => {
    onClose();
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  const handleResetZoom = () => {
    onClose();
    if (typeof document !== "undefined") {
      (document.body.style as any).zoom = "1";
    }
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
        View
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1 min-w-[245px] bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl shadow-2xl py-1.5 z-50 animate-in fade-in zoom-in-95 duration-100">
          <button
            type="button"
            onClick={handleToggleExplorer}
            className="w-full px-3.5 py-2 text-[13px] flex items-center justify-between transition-colors cursor-pointer hover:bg-[var(--bg-hover)] text-[var(--text-primary)]"
          >
            <div className="flex items-center gap-2.5">
              <PanelLeft className="w-4 h-4 text-[var(--text-muted)]" strokeWidth={1.75} />
              <span>Explorer Panel</span>
            </div>
            <span className="text-[11px] text-[var(--text-muted)] font-mono">
              {getEffectiveShortcut("toggle-explorer") || "Ctrl+B"}
            </span>
          </button>

          <button
            type="button"
            onClick={handleToggleChat}
            className="w-full px-3.5 py-2 text-[13px] flex items-center justify-between transition-colors cursor-pointer hover:bg-[var(--bg-hover)] text-[var(--text-primary)]"
          >
            <div className="flex items-center gap-2.5">
              <PanelRight className="w-4 h-4 text-[var(--text-muted)]" strokeWidth={1.75} />
              <span>Chat Panel</span>
            </div>
            <span className="text-[11px] text-[var(--text-muted)] font-mono">
              {getEffectiveShortcut("toggle-chat") || "Ctrl+J"}
            </span>
          </button>

          <div className="h-px my-1.5 bg-[var(--border-color)]" />

          <div className="px-3.5 py-1 text-xs font-medium text-[var(--text-muted)]">
            Theme
          </div>

          <button
            type="button"
            onClick={() => {
              setTheme("light");
              onClose();
            }}
            className="w-full px-3.5 py-2 text-[13px] flex items-center justify-between transition-colors cursor-pointer hover:bg-[var(--bg-hover)] text-[var(--text-primary)]"
          >
            <div className="flex items-center gap-2.5">
              <Sun className="w-4 h-4 text-[var(--text-muted)]" strokeWidth={1.75} />
              <span>Light</span>
            </div>
            {theme === "light" && <Check className="w-4 h-4 text-[var(--text-primary)]" strokeWidth={2.25} />}
          </button>

          <button
            type="button"
            onClick={() => {
              setTheme("dark");
              onClose();
            }}
            className="w-full px-3.5 py-2 text-[13px] flex items-center justify-between transition-colors cursor-pointer hover:bg-[var(--bg-hover)] text-[var(--text-primary)]"
          >
            <div className="flex items-center gap-2.5">
              <Moon className="w-4 h-4 text-[var(--text-muted)]" strokeWidth={1.75} />
              <span>Dark</span>
            </div>
            {theme === "dark" && <Check className="w-4 h-4 text-[var(--text-primary)]" strokeWidth={2.25} />}
          </button>

          <button
            type="button"
            onClick={() => {
              setTheme("system");
              onClose();
            }}
            className="w-full px-3.5 py-2 text-[13px] flex items-center justify-between transition-colors cursor-pointer hover:bg-[var(--bg-hover)] text-[var(--text-primary)]"
          >
            <div className="flex items-center gap-2.5">
              <Laptop className="w-4 h-4 text-[var(--text-muted)]" strokeWidth={1.75} />
              <span>System Theme</span>
            </div>
            {theme === "system" && <Check className="w-4 h-4 text-[var(--text-primary)]" strokeWidth={2.25} />}
          </button>

          <div className="h-px my-1.5 bg-[var(--border-color)]" />

          <button
            type="button"
            onClick={handleToggleFullscreen}
            className="w-full px-3.5 py-2 text-[13px] flex items-center justify-between transition-colors cursor-pointer hover:bg-[var(--bg-hover)] text-[var(--text-primary)]"
          >
            <div className="flex items-center gap-2.5">
              <Maximize className="w-4 h-4 text-[var(--text-muted)]" strokeWidth={1.75} />
              <span>Toggle Fullscreen</span>
            </div>
            <span className="text-[11px] text-[var(--text-muted)] font-mono">
              {getEffectiveShortcut("fullscreen") || "F11"}
            </span>
          </button>

          <button
            type="button"
            onClick={handleResetZoom}
            className="w-full px-3.5 py-2 text-[13px] flex items-center justify-between transition-colors cursor-pointer hover:bg-[var(--bg-hover)] text-[var(--text-primary)]"
          >
            <div className="flex items-center gap-2.5">
              <RotateCcw className="w-4 h-4 text-[var(--text-muted)]" strokeWidth={1.75} />
              <span>Reset Zoom</span>
            </div>
            <span className="text-[11px] text-[var(--text-muted)] font-mono">
              {getEffectiveShortcut("reset-zoom") || "Ctrl+0"}
            </span>
          </button>
        </div>
      )}
    </div>
  );
});
