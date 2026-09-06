import { memo, useState, useEffect, useMemo, useCallback } from "react";
import {
  Keyboard,
  Search,
  RotateCcw,
  Edit3,
} from "lucide-react";
import {
  DEFAULT_SHORTCUTS,
  ShortcutDefinition,
  getCustomShortcuts,
  saveCustomShortcut,
  resetCustomShortcut,
  resetAllShortcuts,
  parseEventToShortcut,
} from "../layout/menu/shortcutsConfig";
import { toast } from "sonner";
import { cn } from "../../lib/utils";

export const SettingsShortcutsTab = memo(function SettingsShortcutsTab() {
  const [searchQuery, setSearchQuery] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [customShortcuts, setCustomShortcuts] = useState<Record<string, string>>({});

  const refreshCustomShortcuts = useCallback(() => {
    setCustomShortcuts(getCustomShortcuts());
  }, []);

  useEffect(() => {
    refreshCustomShortcuts();
    const handleUpdate = () => refreshCustomShortcuts();
    window.addEventListener("arunaki-shortcuts-updated", handleUpdate);
    return () => window.removeEventListener("arunaki-shortcuts-updated", handleUpdate);
  }, [refreshCustomShortcuts]);

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
      if (!combo) return;

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

  return (
    <div className="w-full space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="font-bold text-[var(--text-primary)] text-base flex items-center gap-2">
            <Keyboard className="w-4 h-4 text-[var(--text-primary)]" />
            <span>Customizable Keyboard Shortcuts</span>
          </h3>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">
            Click any shortcut badge to reassign key combinations. Changes are applied immediately across the entire workstation.
          </p>
        </div>
        {hasAnyCustom && (
          <button
            type="button"
            onClick={handleResetAll}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--bg-hover)] hover:bg-[var(--bg-card)] text-[var(--text-muted)] hover:text-[var(--text-primary)] rounded-lg border border-[var(--border-color)] transition-colors text-xs font-medium cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset All to Defaults</span>
          </button>
        )}
      </div>

      {/* Search Input */}
      <div className="relative w-full">
        <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search shortcut name, action, or key combination..."
          className="w-full bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl pl-10 pr-4 py-2 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-blue-500 transition-colors"
        />
      </div>

      {/* Recording Prompt Banner */}
      {editingId && (
        <div className="p-3.5 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-between text-xs text-blue-400 animate-pulse">
          <div className="flex items-center gap-2">
            <Keyboard className="w-4 h-4" />
            <span className="font-medium">
              Recording shortcut for &ldquo;{DEFAULT_SHORTCUTS.find((s) => s.id === editingId)?.desc}&rdquo;
            </span>
          </div>
          <span className="text-[11px] text-blue-300">
            Press your desired key combination, or press Escape to cancel
          </span>
        </div>
      )}

      {/* Shortcuts List */}
      <div className="space-y-4">
        {grouped.length === 0 ? (
          <div className="py-12 text-center text-xs text-[var(--text-muted)]">
            No keyboard shortcuts found matching &ldquo;{searchQuery}&rdquo;
          </div>
        ) : (
          grouped.map(([category, items]) => (
            <div key={category} className="space-y-2">
              <h4 className="text-xs font-semibold text-[var(--text-muted)] tracking-wide">
                {category}
              </h4>
              <div className="p-2 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)] divide-y divide-[var(--border-color)]/40">
                {items.map((item) => {
                  const isCustom = Boolean(customShortcuts[item.id]);
                  const currentCombo = customShortcuts[item.id] || item.defaultKey;
                  const isRecording = editingId === item.id;

                  return (
                    <div
                      key={item.id}
                      className={cn(
                        "flex items-center justify-between py-2.5 px-3 rounded-xl transition-colors",
                        isRecording
                          ? "bg-blue-500/15"
                          : "hover:bg-[var(--bg-hover)]/60"
                      )}
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="text-xs text-[var(--text-primary)] font-medium">
                          {item.desc}
                        </span>
                        {isCustom && !isRecording && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] bg-blue-500/15 text-blue-400 font-medium">
                            Modified
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        {isRecording ? (
                          <div className="px-3 py-1 rounded-lg bg-blue-500/20 text-blue-400 border border-blue-500/50 text-xs font-mono font-medium">
                            Press keys now...
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setEditingId(item.id)}
                            className={cn(
                              "group/btn flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[var(--bg-panel)] border border-[var(--border-strong)] text-xs font-mono text-[var(--text-primary)] shadow-2xs hover:border-blue-500 hover:text-blue-400 transition-colors cursor-pointer",
                              isCustom && "border-blue-500/60 text-blue-300 font-semibold"
                            )}
                            title="Click to reassign this shortcut"
                          >
                            <span>{currentCombo}</span>
                            <Edit3 className="w-3 h-3 opacity-40 group-hover/btn:opacity-100 transition-opacity" />
                          </button>
                        )}

                        {isCustom && !isRecording && (
                          <button
                            type="button"
                            onClick={() => handleResetSingle(item.id, item.desc)}
                            className="p-1 rounded-md text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors cursor-pointer"
                            title="Reset to default shortcut"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
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
    </div>
  );
});
