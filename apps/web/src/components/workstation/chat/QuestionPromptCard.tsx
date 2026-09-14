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
        "my-3 w-full max-w-xl rounded-xl border p-4 text-left transition-all duration-200 shadow-xs",
        isAnswered
          ? "border-border/60 bg-muted/10 dark:bg-zinc-900/40"
          : "border-border/80 dark:border-zinc-800 bg-card/60 dark:bg-zinc-900/60"
      )}
      data-testid="question-prompt-card"
    >
      {/* Header */}
      <div className="flex items-center gap-2 mb-2">
        <div
          className={cn(
            "flex h-6 w-6 items-center justify-center rounded-md border text-xs font-bold",
            isAnswered
              ? "border-border/50 bg-muted text-muted-foreground"
              : "border-border/60 bg-muted/70 text-foreground"
          )}
        >
          {isAnswered ? <Check className="h-3.5 w-3.5" /> : <HelpCircle className="h-3.5 w-3.5" />}
        </div>
        <span
          className={cn(
            "text-xs font-semibold uppercase tracking-wider",
            isAnswered ? "text-muted-foreground" : "text-foreground/80"
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
        <div className="flex items-center gap-2 rounded-lg border border-border/70 bg-background/80 dark:bg-zinc-800/40 px-3 py-2 text-xs font-medium text-foreground">
          <Check className="h-3.5 w-3.5 shrink-0 text-foreground/70" />
          <span>
            Selected Choice: <strong className="text-foreground font-semibold">{selected || questionData.selectedAnswer}</strong>
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
                    "hover:border-zinc-400 dark:hover:border-zinc-600 hover:bg-zinc-100/60 dark:hover:bg-zinc-800/60 hover:shadow-xs",
                    "border-border/70 bg-background/80 dark:bg-zinc-900/40",
                    isSubmitting && "opacity-50 cursor-not-allowed"
                  )}
                >
                  <div className="flex w-full items-center justify-between gap-2">
                    <span className="text-xs sm:text-sm font-medium text-foreground">
                      {opt.label}
                    </span>
                    {isRecommended && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-border/80 bg-muted/80 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
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
                  className="flex-1 rounded-lg border border-border/70 bg-background/80 dark:bg-zinc-900/50 px-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:border-zinc-400 dark:focus:border-zinc-500 focus:outline-hidden focus:ring-1 focus:ring-zinc-400"
                />
                <button
                  type="submit"
                  disabled={!customText.trim() || disabled || isSubmitting}
                  className="inline-flex items-center justify-center rounded-lg bg-foreground text-background px-3 py-1.5 text-xs font-semibold transition-opacity hover:opacity-90 disabled:opacity-40"
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
