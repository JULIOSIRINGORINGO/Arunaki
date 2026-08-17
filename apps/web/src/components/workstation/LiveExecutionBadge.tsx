import { useState, useEffect } from "react";
import {
  Monitor,
  Camera,
  Globe,
  Loader2,
  FileSpreadsheet,
  FileText,
  Keyboard,
  Sparkles,
  Cpu,
  ChevronDown,
  ChevronUp,
  Check,
  Database,
  FileSearch,
} from "lucide-react";

export interface LiveStatusData {
  type?: 'thinking' | 'tool_start' | 'tool_live_status' | 'tool_done' | 'text_delta';
  toolName?: string;
  preview?: string;
  screenshot?: string;
  timestamp?: string;
}

interface StepItem {
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
  const [steps, setSteps] = useState<StepItem[]>([]);
  const [waitingSec, setWaitingSec] = useState(0);

  useEffect(() => {
    if (!status || !active) return;
    if (status.type !== 'thinking') {
      setWaitingSec(0);
      return;
    }
    setWaitingSec(0);
    const start = Date.now();
    const t = setInterval(() => setWaitingSec(Math.floor((Date.now() - start) / 1000)), 1000);
    return () => clearInterval(t);
  }, [status?.type, status?.toolName, active]);

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
        label = "Analyzing";
        iconType = 'thinking';
      } else if (type === 'tool_start' || type === 'tool_live_status') {
        iconType = 'tool';
        const displayTool = toolName ? toolName : 'desktop_action';
        const detail = preview ? ` → ${preview}` : '';
        label = `Executing: ${displayTool}${detail}`;
      } else if (type === 'text_delta') {
        label = "Synthesizing";
        iconType = 'text';
      }

      // Avoid duplicate consecutive identical step labels
      const last = prev[prev.length - 1];
      if (last && last.label === label) {
        return prev;
      }

      // Mark all previous steps as completed
      const updatedPrev = prev.map((s) => ({ ...s, status: 'completed' as const }));
      return [
        ...updatedPrev,
        {
          id: `${Date.now()}-${Math.random()}`,
          label,
          status: 'running',
          iconType,
          toolName,
        },
      ];
    });
  }, [status?.type, status?.toolName, status?.preview]);

  if (!status || !active || steps.length === 0) return null;

  const completedCount = steps.filter((s) => s.status === 'completed').length;
  const summaryHeader = `Executing ${steps.length} task${steps.length > 1 ? 's' : ''}`;

  const renderStepIcon = (step: StepItem) => {
    if (step.iconType === 'thinking') {
      return <Sparkles size={12} className="text-zinc-400 shrink-0 mt-0.5" />;
    }
    if (step.iconType === 'text') {
      return <Cpu size={12} className="text-emerald-400 shrink-0 mt-0.5" />;
    }
    const t = (step.toolName || '').toLowerCase();
    if (t.includes("excel")) return <FileSpreadsheet size={12} className="text-emerald-400 shrink-0 mt-0.5" />;
    if (t.includes("word")) return <FileText size={12} className="text-blue-400 shrink-0 mt-0.5" />;
    if (t.includes("knowledge") || t.includes("memory")) return <Database size={12} className="text-amber-400 shrink-0 mt-0.5" />;
    if (t.includes("read") || t.includes("file")) return <FileSearch size={12} className="text-zinc-300 shrink-0 mt-0.5" />;
    if (t.includes("browser")) return <Globe size={12} className="text-indigo-400 shrink-0 mt-0.5" />;
    if (t.includes("screenshot")) return <Camera size={12} className="text-purple-400 shrink-0 mt-0.5" />;
    if (t.includes("key")) return <Keyboard size={12} className="text-zinc-300 shrink-0 mt-0.5" />;
    return <Monitor size={12} className="text-zinc-300 shrink-0 mt-0.5" />;
  };

  return (
    <div className="my-2 rounded-lg bg-[#141416] border border-[#27272a] text-zinc-200 font-mono text-[11px] shadow-xl overflow-hidden animate-fade-in max-w-sm">
      {/* Collapsible Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-3 py-1.5 bg-[#1a1a1c] hover:bg-[#222225] transition-colors border-b border-[#27272a] cursor-pointer text-left"
      >
        <div className="flex items-center gap-2">
          <Loader2 size={12} className="animate-spin text-zinc-400" />
          <span className="font-semibold text-zinc-200">{summaryHeader}</span>
          {completedCount > 0 && (
            <span className="text-[10px] text-zinc-500">({completedCount} done)</span>
          )}
        </div>
        <div className="flex items-center gap-1 text-zinc-400 hover:text-zinc-200">
          {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
        </div>
      </button>

      {/* Expanded Trace List */}
      {isExpanded && (
        <div className="px-3 py-2 space-y-1.5 bg-[#121214]">
          {steps.map((step) => {
            const isCompleted = step.status === 'completed';
            return (
              <div key={step.id} className="flex items-start gap-2 text-zinc-300">
                {isCompleted ? (
                  <Check size={12} className="text-emerald-400 mt-0.5 shrink-0" />
                ) : (
                  renderStepIcon(step)
                )}
                <span
                  className={`truncate max-w-[260px] ${
                    isCompleted ? "text-zinc-500" : "text-zinc-200 font-medium"
                  }`}
                >
                  {step.label}
                </span>
              </div>
            );
          })}
          <div className="pt-1 flex items-center gap-1.5 text-zinc-500 text-[10px]">
            <span className="animate-pulse">
              {status.type === 'thinking' ? `Working... ${waitingSec}s` : 'Working...'}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
