import { memo, useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Keyboard,
  Search,
  RotateCcw,
  X,
  Edit3,
  Sliders,
} from "lucide-react";
import {
  DEFAULT_SHORTCUTS,
  ShortcutDefinition,
  getCustomShortcuts,
  saveCustomShortcut,
  resetCustomShortcut,
  resetAllShortcuts,
  parseEventToShortcut,
} from "./shortcutsConfig";
import { toast } from "sonner";
import { cn } from "../../../lib/utils";

interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const KeyboardShortcutsModal = memo(function KeyboardShortcutsModal({
  isOpen,
  onClose,
}: KeyboardShortcutsModalProps) {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [customShortcuts, setCustomShortcuts] = useState<Record<string, string>>({});

  // Synchronize local state with localStorage
  const refreshCustomShortcuts = useCallback(() => {
    setCustomShortcuts(getCustomShortcuts());
  }, []);

  useEffect(() => {
    refreshCustomShortcuts();
    const handleUpdate = () => refreshCustomShortcuts();
    window.addEventListener("arunaki-shortcuts-updated", handleUpdate);
    return () => window.removeEventListener("arunaki-shortcuts-updated", handleUpdate);
  }, [refreshCustomShortcuts]);

  // Global keydown capture while recording a shortcut
  useEffect(() => {
    if (!editingId) return;
    const currentId = editingId;

    function handleKeyDown(e: KeyboardEvent) {
      e.preventDefault();
      e.stopPropagation();

      if (e.key === "Escape") {
        setEditingId(null);
        return;
      }

      const combo = parseEventToShortcut(e);
      if (!combo) {
        // Only modifier key was pressed (e.g. Ctrl alone), wait for actual key
        return;
      }

      // Valid combo pressed! Save it
      saveCustomShortcut(currentId, combo);
      const target = DEFAULT_SHORTCUTS.find((s) => s.id === currentId);
      toast.success(`Shortcut updated for "${target?.desc || currentId}": ${combo}`);
      setEditingId(null);
    }

    window.addEventListener("keydown", handleKeyDown, { capture: true });
    return () => window.removeEventListener("keydown", handleKeyDown, { capture: true });
  }, [editingId]);

  const handleResetSingle = (id: string, desc: string) => {
    resetCustomShortcut(id);
    toast.info(`Reset shortcut for "${desc}" to default`);
  };

  const handleResetAll = () => {
    resetAllShortcuts();
    toast.info("All keyboard shortcuts have been reset to default");
  };

  // Filtered shortcuts
  const filteredShortcuts = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return DEFAULT_SHORTCUTS;
    return DEFAULT_SHORTCUTS.filter((s) => {
      const activeKey = customShortcuts[s.id] || s.defaultKey;
      return (
        s.desc.toLowerCase().includes(q) ||
        s.category.toLowerCase().includes(q) ||
        activeKey.toLowerCase().includes(q)
      );
    });
  }, [searchQuery, customShortcuts]);

  // Group by category
  const grouped = useMemo(() => {
    const map = new Map<string, ShortcutDefinition[]>();
    filteredShortcuts.forEach((item) => {
      if (!map.has(item.category)) {
        map.set(item.category, []);
      }
      map.get(item.category)!.push(item);
    });
    return Array.from(map.entries());
  }, [filteredShortcuts]);

  const hasAnyCustom = Object.keys(customShortcuts).length > 0;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-150 select-none">
      <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl shadow-2xl max-w-xl w-full p-5 flex flex-col gap-4 text-xs">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--border-color)] pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-500">
              <Keyboard className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-sm text-[var(--text-primary)]">
                Keyboard Shortcuts
              </h3>
              <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
                Click any key combination to edit and rebind shortcuts.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-[var(--text-muted)] hover:text-[var(--text-primary)] p-1.5 rounded-md hover:bg-[var(--bg-hover)] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Search & Actions Bar */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search shortcuts or key combos..."
              className="w-full bg-[var(--bg-panel)] border border-[var(--border-color)] rounded-lg pl-8.5 pr-3 py-1.5 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-blue-500 transition-colors"
            />
          </div>
          {hasAnyCustom && (
            <button
              type="button"
              onClick={handleResetAll}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--bg-hover)] hover:bg-[var(--bg-panel)] text-[var(--text-muted)] hover:text-[var(--text-primary)] rounded-lg border border-[var(--border-color)] transition-colors text-[11px] font-medium cursor-pointer"
              title="Reset all modified shortcuts to default"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset All</span>
            </button>
          )}
        </div>

        {/* Shortcuts List */}
        <div className="flex flex-col gap-4 max-h-[440px] overflow-y-auto pr-1">
          {grouped.length === 0 ? (
            <div className="py-8 text-center text-[var(--text-muted)]">
              No shortcuts found matching &ldquo;{searchQuery}&rdquo;
            </div>
          ) : (
            grouped.map(([category, items]) => (
              <div key={category} className="flex flex-col gap-1.5">
                <div className="text-[11px] font-semibold text-[var(--text-muted)] tracking-wide">
                  {category}
                </div>
                <div className="bg-[var(--bg-hover)]/30 rounded-lg p-2 flex flex-col gap-1 border border-[var(--border-color)]/40">
                  {items.map((item) => {
                    const isCustom = Boolean(customShortcuts[item.id]);
                    const currentCombo = customShortcuts[item.id] || item.defaultKey;
                    const isRecording = editingId === item.id;

                    return (
                      <div
                        key={item.id}
                        className={cn(
                          "flex items-center justify-between py-1.5 px-2 rounded-md transition-colors border-b border-[var(--border-color)]/20 last:border-0",
                          isRecording
                            ? "bg-blue-500/10 border-blue-500/30"
                            : "hover:bg-[var(--bg-hover)]/60"
                        )}
                      >
                        {/* Description & Modified Badge */}
                        <div className="flex items-center gap-2">
                          <span className="text-[var(--text-primary)] text-xs font-normal">
                            {item.desc}
                          </span>
                          {isCustom && !isRecording && (
                            <span className="px-1.5 py-0.2 rounded text-[9px] bg-blue-500/15 text-blue-400 font-medium">
                              Modified
                            </span>
                          )}
                        </div>

                        {/* Interactive Shortcut Key Badge / Recording Pill */}
                        <div className="flex items-center gap-1.5">
                          {isRecording ? (
                            <div className="flex items-center gap-2 animate-pulse bg-blue-500/20 text-blue-400 border border-blue-500/40 px-2.5 py-1 rounded-md text-[11px] font-mono font-medium">
                              <span>Press keys... (Esc to cancel)</span>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setEditingId(item.id)}
                              className={cn(
                                "group/btn flex items-center gap-1 px-2 py-0.5 rounded bg-[var(--bg-card)] border border-[var(--border-color)] text-[11px] font-mono text-[var(--text-primary)] shadow-2xs hover:border-blue-500 hover:text-blue-400 transition-colors cursor-pointer",
                                isCustom && "border-blue-500/50 text-blue-300"
                              )}
                              title="Click to reassign shortcut"
                            >
                              <span>{currentCombo}</span>
                              <Edit3 className="w-2.5 h-2.5 opacity-0 group-hover/btn:opacity-100 transition-opacity ml-1" />
                            </button>
                          )}

                          {isCustom && !isRecording && (
                            <button
                              type="button"
                              onClick={() => handleResetSingle(item.id, item.desc)}
                              className="p-1 rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors cursor-pointer"
                              title="Reset this shortcut to default"
                            >
                              <RotateCcw className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-between items-center pt-2 border-t border-[var(--border-color)]">
          <button
            type="button"
            onClick={() => {
              onClose();
              navigate("/settings?tab=shortcuts");
            }}
            className="text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] flex items-center gap-1.5 cursor-pointer transition-colors"
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Open in Settings Page</span>
          </button>
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
