import { useState, useEffect } from "react";
import { cn } from "../../lib/utils";
import { ArunakiLogo } from "../common/ArunakiLogo";
import {
  Monitor,
  Camera,
  Globe,
  FileSpreadsheet,
  FileText,
  Keyboard,
  Cpu,
  ChevronDown,
  ChevronUp,
  Check,
  Database,
  FileSearch,
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

  // Antigravity style: When no tools are being executed (simple text response / thinking),
  // MessageThoughtBadge inside the message bubble exclusively handles thinking telemetry.
  // Returning null here completely eliminates duplicate "Processing request & analyzing" indicators.
  if (!hasToolExecution) {
    return null;
  }

  const animatedDots = ".".repeat(dotIndex);
  const summaryHeader = status.preview && status.preview.startsWith("Preparing")
    ? status.preview
    : `Executing ${toolSteps.length || 1} document task${(toolSteps.length || 1) > 1 ? 's' : ''}`;

  const renderStepIcon = (step: StepItem) => {
    if (step.iconType === 'thinking') {
      return <ArunakiLogo size={12} className="animate-pulse text-white shrink-0 mt-0.5" />;
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
          <ArunakiLogo size={12} className="animate-pulse text-white shrink-0" />
          <span className="font-semibold text-white truncate">{summaryHeader}</span>
          <span className="inline-block w-3 text-left font-mono font-bold text-white">{animatedDots}</span>
          <span className="text-[10px] text-[var(--text-dim)] shrink-0">
            ({completedCount > 0 ? `${completedCount} done · ` : ''}{waitingSec}s)
          </span>
        </div>
        <div className="flex items-center gap-1 text-[var(--text-muted)] hover:text-white shrink-0">
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
                  <Check size={12} className="text-white mt-0.5 shrink-0" />
                ) : (
                  renderStepIcon(step)
                )}
                <span
                  className={`truncate max-w-[260px] ${
                    isCompleted ? "text-[var(--text-dim)]" : "text-white font-medium"
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
  const hasThoughtSec = Boolean(thoughtSec && thoughtSec > 0);
  const isThinkingActive = isStreaming && !steps.some((s) => s.iconType === 'text');

  if (!hasToolExecution && (!showThinking || (!hasReasoning && !isThinkingActive && !hasThoughtSec))) {
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
              <Check size={12} className="text-white shrink-0" />
              <span className="font-semibold text-white truncate">
                Executed {toolSteps.length} document task{toolSteps.length > 1 ? 's' : ''}
              </span>
              <span className="text-[10px] text-[var(--text-dim)] shrink-0">
                ({toolSteps.length} step{toolSteps.length > 1 ? 's' : ''}{thoughtSec ? ` · ${thoughtSec}s` : ''})
              </span>
            </div>
            <div className="flex items-center gap-1 text-[var(--text-muted)] hover:text-white shrink-0">
              {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            </div>
          </button>

          {isExpanded && (
            <div className="px-2.5 py-2 space-y-1.5 bg-[var(--bg-panel)] max-w-full overflow-hidden">
              {toolSteps.map((step, idx) => (
                <div key={step.id || idx} className="flex items-start gap-1.5 text-[var(--text-secondary)] min-w-0">
                  <Check size={11} className="text-white mt-0.5 shrink-0" />
                  <span className="truncate max-w-full text-[var(--text-muted)]">
                    {step.label}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 2. Real-time Model Thoughts: Monochrome white styling with Arunaki logo */}
      {showThinking && (hasReasoning || isThinkingActive || hasThoughtSec) && (
        <div className="w-full min-w-0 text-[11px] text-[var(--text-muted)] font-mono leading-relaxed select-text py-0.5 mb-1 whitespace-pre-wrap">
          <button
            type="button"
            onClick={() => hasReasoning && setIsExpanded(!isExpanded)}
            className={cn(
              "flex items-center gap-1.5 mb-1 not-italic font-sans text-[11px] select-none transition-colors",
              hasReasoning ? "cursor-pointer hover:text-white" : "cursor-default text-[var(--text-dim)]"
            )}
          >
            <ArunakiLogo
              size={12}
              className={cn(
                "shrink-0 transition-transform duration-150",
                isThinkingActive ? "animate-pulse text-white" : "text-white/80"
              )}
            />
            <span className={cn("font-medium", isThinkingActive ? "text-white" : "text-[var(--text-secondary)]")}>
              {isThinkingActive ? "Thinking..." : "Thought"}
            </span>
            {thoughtSec ? (
              <span className="opacity-60 font-mono text-[10px] text-[var(--text-muted)]">({thoughtSec}s)</span>
            ) : null}
            {hasReasoning && !isThinkingActive && (
              <span className="text-[10px] text-[var(--text-dim)] flex items-center ml-0.5">
                {isExpanded ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
              </span>
            )}
          </button>

          {hasReasoning ? (
            (isStreaming || isExpanded) && (
              <div className="pl-3 border-l-2 border-white/20 text-[var(--text-muted)] opacity-90 select-text break-words not-italic">
                {isStreaming ? reasoning : reasoning?.trim()}
                {isStreaming && isThinkingActive && (
                  <span className="inline-block w-1.5 h-3 bg-white/80 ml-0.5 animate-pulse align-middle" />
                )}
              </div>
            )
          ) : null}
        </div>
      )}
    </div>
  );
}
