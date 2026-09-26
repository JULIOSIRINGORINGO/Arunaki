import { memo, useState, useEffect, useCallback, useMemo } from "react";
import { X, Check } from "lucide-react";

interface AboutArunakiModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AboutArunakiModal = memo(function AboutArunakiModal({
  isOpen,
  onClose,
}: AboutArunakiModalProps) {
  const [copied, setCopied] = useState(false);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Dynamically detect runtime versions with accurate fallbacks
  const specs = useMemo(() => {
    const desktop = typeof window !== "undefined" && (window as any).arunakiDesktop;
    const sys = desktop?.getSystemInfo ? desktop.getSystemInfo() : null;
    const chromeMatch = typeof navigator !== "undefined" ? navigator.userAgent.match(/Chrome\/([0-9.]+)/) : null;
    const detectedChrome = chromeMatch ? chromeMatch[1] : "142.0.7444.175";

    return [
      { label: "Arunaki Version", value: "0.1.0 (Phase 109)" },
      { label: "Commit", value: "87e1d5c3bd8c6c46f8425e8527ce4dad460bb787" },
      { label: "Date", value: "2026-09-26T10:23:28.000Z" },
      { label: "Electron", value: sys?.electron || "43.2.0" },
      { label: "Chromium", value: sys?.chrome || detectedChrome },
      { label: "Node.js", value: sys?.node || "24.15.0" },
      { label: "V8", value: sys?.v8 || "13.6.233.17-electron.0" },
      { label: "OS", value: sys?.os || "Windows_NT x64 10.0.26200" },
      { label: "Isolation", value: "Active Folder Sandbox" },
    ];
  }, [isOpen]);

  const fullSpecsText = useMemo(() => {
    return specs.map((item) => `${item.label}: ${item.value}`).join("\n");
  }, [specs]);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(fullSpecsText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for browsers that restrict clipboard API
      const textarea = document.createElement("textarea");
      textarea.value = fullSpecsText;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [fullSpecsText]);

  // Strict React Hook ordering: early return after all hooks
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-[2px] p-4 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-[540px] bg-[#0c2026] border border-[#16363f] rounded-lg shadow-[0_24px_60px_rgba(0,0,0,0.7)] p-7 select-text"
        onClick={(e) => e.stopPropagation()}
        style={{ fontFamily: "Segoe UI, -apple-system, BlinkMacSystemFont, Roboto, sans-serif" }}
      >
        {/* Close Button top-right */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 text-[#75959c] hover:text-[#f1f5f9] transition-colors p-1 cursor-pointer"
          aria-label="Close"
        >
          <X className="w-4 h-4" strokeWidth={2} />
        </button>

        {/* Content layout: Left circle icon + Right content column */}
        <div className="flex items-start gap-5">
          {/* Cyan circular info badge */}
          <div className="shrink-0 pt-0.5 select-none">
            <svg
              className="w-11 h-11 text-[#38c2e6]"
              viewBox="0 0 44 44"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <circle
                cx="22"
                cy="22"
                r="19.5"
                stroke="currentColor"
                strokeWidth="2.5"
              />
              <circle cx="22" cy="14" r="2.2" fill="currentColor" />
              <rect
                x="20.25"
                y="18.5"
                width="3.5"
                height="13.5"
                rx="1.2"
                fill="currentColor"
              />
            </svg>
          </div>

          {/* Right column: Title, Specs, Buttons */}
          <div className="flex-1 min-w-0">
            {/* Title */}
            <h2 className="text-[19px] font-normal text-[#f1f5f9] leading-tight mb-4 select-text">
              Arunaki
            </h2>

            {/* Spec lines */}
            <div className="space-y-[2px] text-[13px] leading-[22px] text-[#c2d7dd] select-text">
              {specs.map((item) => (
                <div key={item.label} className="break-all">
                  <span className="text-[#c2d7dd]">{item.label}: </span>
                  <span className="text-[#c2d7dd]">{item.value}</span>
                </div>
              ))}
            </div>

            {/* Action buttons bottom-right */}
            <div className="flex items-center justify-end gap-2.5 mt-6 select-none">
              <button
                type="button"
                onClick={handleCopy}
                className="flex items-center justify-center gap-1.5 min-w-[72px] px-4 py-1.5 bg-[#103d46] hover:bg-[#164e59] active:bg-[#0c3138] text-[#4edcd8] border border-[#1b5f6a] rounded text-[13px] font-medium transition-colors cursor-pointer"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Copied</span>
                  </>
                ) : (
                  <span>Copy</span>
                )}
              </button>

              <button
                type="button"
                onClick={onClose}
                className="min-w-[58px] px-4 py-1.5 bg-[#242f36] hover:bg-[#2d3a43] active:bg-[#1c252b] text-[#e2e8f0] border border-[#37454f] rounded text-[13px] font-medium transition-colors cursor-pointer"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});
