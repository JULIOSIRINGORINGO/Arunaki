import { memo } from "react";
import { ArunakiLogo } from "../../common/ArunakiLogo";

export const CenterEmptyState = memo(function CenterEmptyState() {
  return (
    <div className="h-full w-full flex flex-col items-center justify-center select-none p-8 animate-in fade-in duration-300">
      <div className="flex flex-col items-center gap-6">
        <ArunakiLogo className="w-16 h-16 text-[var(--text-primary)] opacity-95" />
        <span className="font-sans text-2xl md:text-3xl font-light tracking-wide text-[var(--text-primary)] opacity-95 select-none">
          Arunaki Agent
        </span>
      </div>

      <div className="mt-20 text-sm md:text-base text-[var(--text-dim)] font-sans tracking-wide select-none opacity-90">
        Work with Agent
      </div>
    </div>
  );
});
