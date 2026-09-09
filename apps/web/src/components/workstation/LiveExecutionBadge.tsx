import { useState, useEffect } from "react";
import { cn } from "../../lib/utils";
import {
  Monitor,
  Camera,
  Globe,
  Loader2,
  FileSpreadsheet,
  FileText,
  Keyboard,
  Cpu,
  ChevronDown,
  ChevronUp,
  Check,
  Database,
  FileSearch,
  Brain,
} from "lucide-react";

export interface LiveStatusData {
  type?: 'thinking' | 'tool_preparing' | 'tool_start' | 'tool_progress' | 'tool_live_status' | 'tool_done' | 'text_delta';
  toolName?: string;
  preview?: string;
  screenshot?: string;
  timestamp?: string;
}

export interface StepItem {
  id: string;
  label: string;
  status: 'completed' | 'running';
  iconType: 'thinking' | 'tool' | 'text';
  toolName?: string;
}

interface LiveExecutionBadgeProps {
  status: LiveStatusData | null;
  active?: boolean;
}

export function LiveExecutionBadge({ status, active = true }: LiveExecutionBadgeProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [steps, setSteps] = useState<StepItem[]>(() => {
    if (!status) return [];
    return [{
      id: `step-init-${Date.now()}`,
      label: status.preview || "Analyzing request...",
      status: "completed",
      iconType: status.type === "tool_start" || status.type === "tool_preparing" ? "tool" : "thinking",
    }];
  });
  const [waitingSec, setWaitingSec] = useState(0);
  const [dotIndex, setDotIndex] = useState(1);

  useEffect(() => {
    if (!active) return;
    setWaitingSec(0);
    const start = Date.now();
    const t = setInterval(() => setWaitingSec(Math.max(1, Math.floor((Date.now() - start) / 1000))), 1000);
    const d = setInterval(() => setDotIndex((prev) => (prev % 3) + 1), 400);
    return () => {
      clearInterval(t);
      clearInterval(d);
    };
  }, [active]);

  useEffect(() => {
    if (!status) {
      setSteps([]);
      return;
    }

    const type = status.type || (status.toolName ? 'tool_start' : 'thinking');
    const toolName = status.toolName || '';
    const preview = status.preview || '';

    setSteps((prev) => {
      let label = "Analyzing";
      let iconType: 'thinking' | 'tool' | 'text' = 'thinking';

      if (type === 'thinking') {
        label = preview ? preview : "Analyzing request...";
        iconType = 'thinking';
      } else if (type === 'tool_preparing') {
        iconType = 'tool';
        const displayTool = toolName ? toolName : 'action';
        label = preview || `Preparing ${displayTool}...`;
      } else if (type === 'tool_start' || type === 'tool_live_status' || type === 'tool_progress') {
        iconType = 'tool';
        const displayTool = toolName ? toolName : 'desktop_action';
        const detail = preview && !preview.startsWith("Executing") && !preview.startsWith("Completed") ? ` → ${preview}` : '';
        label = preview || `Executing: ${displayTool}${detail}`;
      } else if (type === 'text_delta') {
        label = preview ? preview : "Generating response...";
        iconType = 'text';
      }

      // Avoid duplicate consecutive identical step labels
      const last = prev[prev.length - 1];
      if (last && last.label === label) {
        return prev;
      }

      // If replacing an existing "Preparing [tool]" with the actual "Executing [tool]"
      const prepIdx = prev.findIndex((s) => s.iconType === 'tool' && s.label.startsWith(`Preparing ${toolName}`));
      if (prepIdx >= 0 && (type === 'tool_start' || type === 'tool_progress' || type === 'tool_live_status')) {
        const copy = [...prev];
        copy[prepIdx] = {
          ...copy[prepIdx],
          label,
          status: type === 'tool_live_status' ? 'completed' : 'running',
          toolName,
        };
        return copy;
      }

      // Mark all previous steps as completed
      const updatedPrev = prev.map((s) => ({ ...s, status: 'completed' as const }));
      return [
        ...updatedPrev,
        {
          id: `${Date.now()}-${Math.random()}`,
          label,
          status: type === 'tool_live_status' ? 'completed' : 'running',
          iconType,
          toolName,
        },
      ];
    });
  }, [status?.type, status?.toolName, status?.preview]);

  if (!status || !active) return null;

  const completedCount = steps.filter((s) => s.status === 'completed').length;
  const toolSteps = steps.filter((s) => s.iconType === 'tool');
  const hasToolExecution =
    toolSteps.length > 0 ||
    status.type === 'tool_preparing' ||
    status.type === 'tool_start' ||
    status.type === 'tool_live_status' ||
    status.type === 'tool_progress';

  // Antigravity style: If no tools are being executed (simple text response / thinking),
  // show only a subtle minimal indicator while waiting for tokens, not a big task card!
  const animatedDots = ".".repeat(dotIndex);
  if (!hasToolExecution) {
    if (status.type === 'text_delta') {
      return null;
    }
    const rawPreview = (status.preview || "Thinking").trim().replace(/\.+$/, "");
    return (
      <div className="flex items-center gap-2 py-1.5 px-3 rounded-lg bg-[var(--bg-panel)] border border-[var(--border-strong)] text-xs text-[var(--text-primary)] font-sans max-w-fit select-none my-1 shadow-xs animate-in fade-in duration-150">
        <Loader2 size={13} className="animate-spin text-amber-400 shrink-0" />
        <span className="text-[11px] text-[var(--text-secondary)] font-medium flex items-center">
          <span>{rawPreview}</span>
          <span className="inline-block w-4 text-left font-mono font-bold text-amber-400 ml-0.5">{animatedDots}</span>
          <span className="text-[10px] text-[var(--text-muted)] font-mono ml-1">({waitingSec}s)</span>
        </span>
      </div>
    );
  }

  const summaryHeader = status.preview && status.preview.startsWith("Preparing")
    ? status.preview
    : `Executing ${toolSteps.length || 1} document task${(toolSteps.length || 1) > 1 ? 's' : ''}`;

  const renderStepIcon = (step: StepItem) => {
    if (step.iconType === 'thinking') {
      return <Loader2 size={12} className="animate-spin text-amber-400 shrink-0 mt-0.5" />;
    }
    if (step.iconType === 'text') {
      return <Cpu size={12} className="text-[var(--text-muted)] shrink-0 mt-0.5" />;
    }
    const t = (step.toolName || '').toLowerCase();
    if (t.includes("excel")) return <FileSpreadsheet size={12} className="text-[var(--text-muted)] shrink-0 mt-0.5" />;
    if (t.includes("word")) return <FileText size={12} className="text-[var(--text-muted)] shrink-0 mt-0.5" />;
    if (t.includes("knowledge") || t.includes("memory")) return <Database size={12} className="text-[var(--text-muted)] shrink-0 mt-0.5" />;
    if (t.includes("read") || t.includes("file") || t.includes("search")) return <FileSearch size={12} className="text-[var(--text-muted)] shrink-0 mt-0.5" />;
    if (t.includes("browser")) return <Globe size={12} className="text-[var(--text-muted)] shrink-0 mt-0.5" />;
    if (t.includes("screenshot")) return <Camera size={12} className="text-[var(--text-muted)] shrink-0 mt-0.5" />;
    if (t.includes("key")) return <Keyboard size={12} className="text-[var(--text-muted)] shrink-0 mt-0.5" />;
    return <Monitor size={12} className="text-[var(--text-muted)] shrink-0 mt-0.5" />;
  };

  return (
    <div className="my-2 rounded-lg bg-[var(--bg-panel)] border border-[var(--border-color)] text-[var(--text-primary)] font-mono text-[11px] overflow-hidden animate-fade-in max-w-sm select-none">
      {/* Collapsible Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-3 py-1.5 bg-[var(--bg-panel-sub)] hover:bg-[var(--bg-hover)] transition-colors border-b border-[var(--border-color)] cursor-pointer text-left"
      >
        <div className="flex items-center gap-2 min-w-0">
          <Loader2 size={12} className="animate-spin text-amber-400 shrink-0" />
          <span className="font-semibold text-[var(--text-primary)] truncate">{summaryHeader}</span>
          <span className="inline-block w-3 text-left font-mono font-bold text-amber-400">{animatedDots}</span>
          <span className="text-[10px] text-[var(--text-dim)] shrink-0">
            ({completedCount > 0 ? `${completedCount} done · ` : ''}{waitingSec}s)
          </span>
        </div>
        <div className="flex items-center gap-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] shrink-0">
          {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
        </div>
      </button>

      {/* Expanded Trace List */}
      {isExpanded && (
        <div className="px-3 py-2 space-y-1.5 bg-[var(--bg-panel)]">
          {steps.map((step) => {
            const isCompleted = step.status === 'completed';
            return (
              <div key={step.id} className="flex items-start gap-2 text-[var(--text-secondary)]">
                {isCompleted ? (
                  <Check size={12} className="text-[var(--text-primary)] mt-0.5 shrink-0" />
                ) : (
                  renderStepIcon(step)
                )}
                <span
                  className={`truncate max-w-[260px] ${
                    isCompleted ? "text-[var(--text-dim)]" : "text-[var(--text-primary)] font-medium"
                  }`}
                >
                  {step.label}
                </span>
              </div>
            );
          })}
          <div className="pt-1 flex items-center gap-1.5 text-[var(--text-dim)] text-[10px]">
            <span className="animate-pulse">
              Working... ({waitingSec}s)
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Persisted Antigravity / Cursor IDE style collapsible thought/execution badge.
 * Rendered directly above assistant chat messages in the history.
 */
export function MessageThoughtBadge({
  steps = [],
  thoughtSec,
  reasoning,
  showThinking = true,
  isStreaming = false,
}: {
  steps?: StepItem[];
  thoughtSec?: number;
  reasoning?: string;
  showThinking?: boolean;
  isStreaming?: boolean;
}) {
  const [isExpanded, setIsExpanded] = useState(false);

  const toolSteps = steps.filter((s) => s.iconType === 'tool' || s.toolName);
  const hasToolExecution = toolSteps.length > 0;
  const hasReasoning = Boolean(reasoning && reasoning.length > 0);
  const isThinkingActive = isStreaming && !steps.some((s) => s.iconType === 'text');

  if (!hasToolExecution && (!showThinking || (!hasReasoning && !isThinkingActive))) {
    return null;
  }

  return (
    <div className="w-full min-w-0 mb-2 font-sans select-none">
      {/* 1. Buka-Tutup Accordion: strictly for tool & function execution calls */}
      {hasToolExecution && (
        <div className="mb-2 max-w-full w-full min-w-0 font-mono text-[11px] rounded-lg bg-[var(--bg-panel)] border border-[var(--border-color)] overflow-hidden select-none">
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="w-full flex items-center justify-between px-2.5 py-1 bg-[var(--bg-panel-sub)] hover:bg-[var(--bg-hover)] transition-colors border-b border-[var(--border-color)] cursor-pointer text-left"
          >
            <div className="flex items-center gap-1.5 min-w-0">
              <Check size={12} className="text-[var(--text-primary)] shrink-0" />
              <span className="font-semibold text-[var(--text-primary)] truncate">
                Executed {toolSteps.length} document task{toolSteps.length > 1 ? 's' : ''}
              </span>
              <span className="text-[10px] text-[var(--text-dim)] shrink-0">
                ({toolSteps.length} step{toolSteps.length > 1 ? 's' : ''}{thoughtSec ? ` · ${thoughtSec}s` : ''})
              </span>
            </div>
            <div className="flex items-center gap-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] shrink-0">
              {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            </div>
          </button>

          {isExpanded && (
            <div className="px-2.5 py-2 space-y-1.5 bg-[var(--bg-panel)] max-w-full overflow-hidden">
              {toolSteps.map((step, idx) => (
                <div key={step.id || idx} className="flex items-start gap-1.5 text-[var(--text-secondary)] min-w-0">
                  <Check size={11} className="text-[var(--text-primary)] mt-0.5 shrink-0" />
                  <span className="truncate max-w-full text-[var(--text-muted)]">
                    {step.label}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 2. Real-time Model Thoughts: Shown directly (kata per kata), preserving word boundaries during stream */}
      {showThinking && (hasReasoning || isThinkingActive) && (
        <div className="w-full min-w-0 text-[11px] text-[var(--text-muted)] font-mono italic leading-relaxed select-text py-0.5 mb-1 whitespace-pre-wrap">
          <div className="flex items-center gap-1.5 mb-1 not-italic font-sans text-[10px] text-[var(--text-dim)] select-none">
            <Brain size={11} className={cn("shrink-0", isThinkingActive ? "text-amber-400 animate-pulse" : "text-[var(--text-muted)]")} />
            <span className={cn("font-medium text-[11px]", isThinkingActive ? "text-amber-400" : "text-[var(--text-dim)]")}>
              {isThinkingActive ? "Thinking..." : "Thought"}
            </span>
            {thoughtSec ? <span className="opacity-60 font-mono text-[10px]">({thoughtSec}s)</span> : null}
          </div>
          {hasReasoning ? (
            <div className="pl-3 border-l-2 border-amber-500/40 text-[var(--text-muted)] opacity-90 select-text break-words">
              {isStreaming ? reasoning : reasoning?.trim()}
              {isStreaming && isThinkingActive && (
                <span className="inline-block w-1.5 h-3 bg-amber-400/80 ml-0.5 animate-pulse align-middle" />
              )}
            </div>
          ) : isThinkingActive ? (
            <div className="pl-3 border-l-2 border-amber-500/30 text-[var(--text-muted)] opacity-70 italic text-[10px]">
              <span className="inline-block w-1.5 h-2.5 bg-amber-400/70 animate-pulse mr-1.5" />
              Processing request & workspace context...
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
