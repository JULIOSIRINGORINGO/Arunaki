import React, { useState, memo } from "react";
import { HelpCircle, Check, ArrowRight, Sparkles, ChevronRight } from "lucide-react";
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
        "my-2.5 w-full max-w-xl rounded-xl border p-3.5 text-left transition-all duration-200",
        isAnswered
          ? "border-border/30 bg-muted/10"
          : "border-border/40 bg-card/40 dark:bg-zinc-950/40"
      )}
      data-testid="question-prompt-card"
    >
      {/* Header */}
      <div className="flex items-center gap-2 mb-2">
        <div
          className={cn(
            "flex h-5 w-5 items-center justify-center rounded-md border text-[11px]",
            isAnswered
              ? "border-border/40 bg-muted/60 text-muted-foreground"
              : "border-border/50 bg-muted/50 text-foreground/80"
          )}
        >
          {isAnswered ? <Check className="h-3 w-3" /> : <HelpCircle className="h-3 w-3" />}
        </div>
        <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/90">
          {firstQuestion.header || (isAnswered ? "Clarification Resolved" : "Clarification Needed")}
        </span>
      </div>

      {/* Question text */}
      <p className="text-xs sm:text-[13px] font-medium text-foreground/90 leading-relaxed mb-2.5">
        {firstQuestion.question}
      </p>

      {/* Answered View */}
      {isAnswered ? (
        <div className="flex items-center gap-2 rounded-lg border border-border/30 bg-muted/20 px-3 py-2 text-xs text-foreground/90">
          <Check className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <span>
            Selected: <strong className="font-semibold text-foreground">{selected || questionData.selectedAnswer}</strong>
          </span>
        </div>
      ) : (
        /* Unanswered View: Sleek, Subtle Choice Rows */
        <div className="space-y-1.5">
          <div className="flex flex-col gap-1.5">
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
                    "group flex flex-col items-start rounded-lg border px-3 py-2 text-left transition-all duration-150 active:scale-[0.995]",
                    "border-border/25 dark:border-white/[0.06] bg-muted/15 dark:bg-white/[0.02]",
                    "hover:border-border/70 dark:hover:border-white/20 hover:bg-muted/40 dark:hover:bg-white/[0.05]",
                    isSubmitting && "opacity-50 cursor-not-allowed"
                  )}
                >
                  <div className="flex w-full items-center justify-between gap-2">
                    <span className="text-xs sm:text-[13px] font-medium text-foreground/90 group-hover:text-foreground">
                      {opt.label}
                    </span>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {isRecommended && (
                        <span className="inline-flex items-center gap-1 rounded-md border border-border/40 bg-muted/50 px-1.5 py-0.5 text-[9.5px] font-medium text-muted-foreground tracking-tight">
                          <Sparkles className="h-2 w-2" />
                          Recommended
                        </span>
                      )}
                      <ChevronRight className="h-3 w-3 text-muted-foreground/40 transition-transform group-hover:translate-x-0.5 group-hover:text-foreground/70" />
                    </div>
                  </div>
                  {opt.description && (
                    <p className="mt-0.5 text-[11px] text-muted-foreground/80 leading-normal line-clamp-2">
                      {opt.description}
                    </p>
                  )}
                </button>
              );
            })}
          </div>

          {/* Custom Input */}
          {firstQuestion.custom !== false && (
            <form onSubmit={handleCustomSubmit} className="pt-2 border-t border-border/20">
              <div className="flex items-center gap-1.5">
                <input
                  type="text"
                  value={customText}
                  onChange={(e) => setCustomText(e.target.value)}
                  placeholder="Or type a custom response..."
                  disabled={disabled || isSubmitting}
                  className="flex-1 rounded-lg border border-border/30 bg-muted/20 dark:bg-white/[0.02] px-2.5 py-1.5 text-xs text-foreground placeholder:text-muted-foreground/70 focus:border-border/70 focus:bg-background/80 focus:outline-hidden"
                />
                <button
                  type="submit"
                  disabled={!customText.trim() || disabled || isSubmitting}
                  className="inline-flex items-center justify-center rounded-lg border border-border/40 bg-muted/40 hover:bg-muted/80 text-foreground px-2.5 py-1.5 text-xs font-medium transition-colors disabled:opacity-30"
                >
                  <ArrowRight className="h-3 w-3" />
                </button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  );
});
