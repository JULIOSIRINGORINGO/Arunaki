import { memo, type RefObject, type KeyboardEvent } from "react";
import { cn } from "../../../lib/utils";

interface CenterEditorViewProps {
  currentContent: string;
  lines: string[];
  addedLineNums: Set<number>;
  cursorPos: { line: number; col: number };
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  gutterRef: RefObject<HTMLDivElement | null>;
  onTextChange: (val: string) => void;
  updateCursorPos: () => void;
  onScroll: () => void;
  onKeyDown: (e: KeyboardEvent<HTMLTextAreaElement>) => void;
}

export const CenterEditorView = memo(function CenterEditorView({
  currentContent,
  lines,
  addedLineNums,
  cursorPos,
  textareaRef,
  gutterRef,
  onTextChange,
  updateCursorPos,
  onScroll,
  onKeyDown,
}: CenterEditorViewProps) {
  return (
    <div className="h-full w-full flex flex-col bg-[#1e1e1e] overflow-hidden">
      <div className="flex-1 flex overflow-hidden bg-[#1e1e1e] relative font-mono text-[13px]">
        {/* Gutter with VSCode-style line numbers & change indicator bars */}
        <div
          ref={gutterRef}
          className="w-[50px] shrink-0 select-none bg-[#1e1e1e] border-r border-[#252526]/50 overflow-hidden text-right py-2 pr-3.5 font-mono text-[12px] text-[#858585]"
        >
          {lines.map((_, i) => {
            const lineNum = i + 1;
            const isAdded = addedLineNums.has(lineNum);
            const isCurrentLine = cursorPos.line === lineNum;
            return (
              <div
                key={i}
                className={cn(
                  "h-[20px] leading-[20px] relative transition-colors",
                  isCurrentLine && "text-[#c6c6c6] font-medium"
                )}
              >
                {isAdded && (
                  <span
                    className="absolute left-0 top-0 bottom-0 w-[3px] bg-[#2ea043]"
                    title="Line added / updated by AI"
                  />
                )}
                <span>{lineNum}</span>
              </div>
            );
          })}
        </div>

        {/* Editable live document area (VSCode Typography & Caret) */}
        <textarea
          ref={textareaRef}
          value={currentContent}
          onChange={(e) => {
            onTextChange(e.target.value);
            updateCursorPos();
          }}
          onClick={updateCursorPos}
          onKeyUp={updateCursorPos}
          onSelect={updateCursorPos}
          onScroll={onScroll}
          onKeyDown={onKeyDown}
          spellCheck={false}
          placeholder="Empty document..."
          className="flex-1 h-full py-2 px-3 bg-transparent font-mono text-[13px] text-[#d4d4d4] leading-[20px] resize-none focus:outline-none select-text cursor-text whitespace-pre border-none tab-4 overflow-auto selection:bg-[#264f78] selection:text-[#ffffff] caret-[#0078d4]"
          style={{
            fontFamily: "Consolas, 'Cascadia Code', 'Courier New', monospace",
          }}
        />
      </div>
    </div>
  );
});
