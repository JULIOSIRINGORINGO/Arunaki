import { memo } from "react";
import { Info, X } from "lucide-react";

interface AboutArunakiModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AboutArunakiModal = memo(function AboutArunakiModal({
  isOpen,
  onClose,
}: AboutArunakiModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-150">
      <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl shadow-2xl max-w-sm w-full p-5 flex flex-col gap-4 text-xs">
        <div className="flex items-center justify-between border-b border-[var(--border-color)] pb-3">
          <h3 className="font-semibold text-sm text-[var(--text-primary)] flex items-center gap-2">
            <Info className="w-4 h-4 text-[var(--text-primary)]" />
            About Arunaki
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="text-[var(--text-muted)] hover:text-[var(--text-primary)] p-1 rounded hover:bg-[var(--bg-hover)] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex flex-col gap-3 text-center items-center py-2">
          <div className="w-12 h-12 rounded-2xl bg-[var(--bg-hover)] border border-[var(--border-color)] flex items-center justify-center text-lg font-bold text-[var(--text-primary)]">
            A
          </div>
          <div>
            <h4 className="font-bold text-sm text-[var(--text-primary)]">Arunaki Desktop</h4>
            <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
              Sandboxed Computer Use Agent for Documents
            </p>
          </div>
          <div className="w-full bg-[var(--bg-hover)]/60 rounded-lg p-3 text-[11px] text-left text-[var(--text-muted)] flex flex-col gap-1.5 border border-[var(--border-color)]/50">
            <div className="flex justify-between">
              <span>Version:</span>
              <span className="font-mono text-[var(--text-primary)]">0.1.0 (Phase 68)</span>
            </div>
            <div className="flex justify-between">
              <span>Environment:</span>
              <span className="text-[var(--text-primary)]">Desktop (Electron)</span>
            </div>
            <div className="flex justify-between">
              <span>Isolation:</span>
              <span className="text-emerald-500 font-medium">Active Folder Sandbox</span>
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-1">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-[var(--bg-hover)] hover:bg-[var(--bg-panel)] text-[var(--text-primary)] font-medium rounded-lg text-xs transition-colors cursor-pointer border border-[var(--border-color)]"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
});
