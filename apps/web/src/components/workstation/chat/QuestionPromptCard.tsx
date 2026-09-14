import React, { useState, memo } from "react";
import { HelpCircle, Check, ArrowRight, Sparkles } from "lucide-react";
import { cn } from "../../../lib/utils";
import { QuestionData, QuestionInfo, QuestionOption } from "./types";

interface QuestionPromptCardProps {
  questionData: QuestionData;
  onAnswer: (requestId: string, selectedAnswer: string) => void;
  disabled?: boolean;
}

export const QuestionPromptCard = memo(function QuestionPromptCard({
  questionData,
  onAnswer,
  disabled = false,
}: QuestionPromptCardProps) {
  const [selected, setSelected] = useState<string | null>(
    typeof questionData.selectedAnswer === "string" ? questionData.selectedAnswer : null
  );
  const [customText, setCustomText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isAnswered = Boolean(questionData.answered || selected);

  const handleSelect = (label: string) => {
    if (disabled || isAnswered || isSubmitting) return;
    setIsSubmitting(true);
    setSelected(label);
    try {
      onAnswer(questionData.id, label);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = customText.trim();
    if (!trimmed || disabled || isAnswered || isSubmitting) return;
    handleSelect(trimmed);
  };

  const firstQuestion: QuestionInfo | undefined = questionData.questions?.[0];
  if (!firstQuestion) return null;

  return (
    <div
      className={cn(
        "my-3 w-full max-w-xl rounded-xl border p-4 text-left transition-all duration-200 shadow-sm",
        isAnswered
          ? "border-emerald-500/30 bg-emerald-950/10 dark:bg-emerald-950/20"
          : "border-amber-500/35 bg-gradient-to-b from-amber-500/5 to-amber-500/10 dark:from-amber-500/[0.03] dark:to-amber-500/[0.08]"
      )}
      data-testid="question-prompt-card"
    >
      {/* Header */}
      <div className="flex items-center gap-2 mb-2">
        <div
          className={cn(
            "flex h-6 w-6 items-center justify-center rounded-md text-xs font-bold",
            isAnswered
              ? "bg-emerald-500/20 text-emerald-400"
              : "bg-amber-500/20 text-amber-400"
          )}
        >
          {isAnswered ? <Check className="h-3.5 w-3.5" /> : <HelpCircle className="h-3.5 w-3.5" />}
        </div>
        <span
          className={cn(
            "text-xs font-semibold uppercase tracking-wider",
            isAnswered ? "text-emerald-400" : "text-amber-400"
          )}
        >
          {firstQuestion.header || (isAnswered ? "Clarification Resolved" : "Clarification Needed")}
        </span>
      </div>

      {/* Question text */}
      <p className="text-sm font-medium text-foreground leading-relaxed mb-3">
        {firstQuestion.question}
      </p>

      {/* Answered View */}
      {isAnswered ? (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs font-medium text-emerald-400">
          <Check className="h-4 w-4 shrink-0" />
          <span>
            Selected Choice: <strong className="text-foreground">{selected || questionData.selectedAnswer}</strong>
          </span>
        </div>
      ) : (
        /* Unanswered View: Interactive Options */
        <div className="space-y-2">
          <div className="flex flex-col gap-2">
            {firstQuestion.options?.map((opt: QuestionOption, idx: number) => {
              const isRecommended =
                idx === 0 ||
                opt.label.toLowerCase().includes("recommended") ||
                opt.label.toLowerCase().includes("rekomendasi");

              return (
                <button
                  key={idx}
                  type="button"
                  disabled={disabled || isSubmitting}
                  onClick={() => handleSelect(opt.label)}
                  className={cn(
                    "group flex flex-col items-start rounded-lg border px-3.5 py-2.5 text-left transition-all duration-150 active:scale-[0.99]",
                    "hover:border-amber-400/80 hover:bg-amber-500/10 hover:shadow-xs",
                    "border-border/60 bg-background/80 dark:bg-card/70",
                    isSubmitting && "opacity-50 cursor-not-allowed"
                  )}
                >
                  <div className="flex w-full items-center justify-between gap-2">
                    <span className="text-xs sm:text-sm font-medium text-foreground group-hover:text-amber-400">
                      {opt.label}
                    </span>
                    {isRecommended && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-400">
                        <Sparkles className="h-2.5 w-2.5" />
                        Recommended
                      </span>
                    )}
                  </div>
                  {opt.description && (
                    <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
                      {opt.description}
                    </p>
                  )}
                </button>
              );
            })}
          </div>

          {/* Custom Input (if allowed) */}
          {firstQuestion.custom !== false && (
            <form onSubmit={handleCustomSubmit} className="mt-3 pt-2 border-t border-border/40">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={customText}
                  onChange={(e) => setCustomText(e.target.value)}
                  placeholder="Or type a custom response..."
                  disabled={disabled || isSubmitting}
                  className="flex-1 rounded-lg border border-border/60 bg-background/80 px-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:border-amber-400 focus:outline-hidden focus:ring-1 focus:ring-amber-400"
                />
                <button
                  type="submit"
                  disabled={!customText.trim() || disabled || isSubmitting}
                  className="inline-flex items-center justify-center rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-semibold text-black transition-opacity hover:opacity-90 disabled:opacity-40"
                >
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  );
});
