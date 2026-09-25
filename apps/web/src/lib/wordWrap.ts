import { useState, useEffect, useCallback } from "react";

const WORD_WRAP_STORAGE_KEY = "arunaki_word_wrap";
const WORD_WRAP_EVENT = "arunaki-word-wrap-change";

export function getStoredWordWrap(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const stored = localStorage.getItem(WORD_WRAP_STORAGE_KEY);
    if (stored !== null) {
      return stored === "true";
    }
    return false;
  } catch {
    return false;
  }
}

export function setStoredWordWrap(enabled: boolean): void {
  try {
    localStorage.setItem(WORD_WRAP_STORAGE_KEY, String(enabled));
    window.dispatchEvent(new CustomEvent(WORD_WRAP_EVENT, { detail: enabled }));
  } catch (err) {
    console.error("Failed to save word wrap setting:", err);
  }
}

export function useWordWrap() {
  const [wordWrap, setWordWrapState] = useState<boolean>(() => getStoredWordWrap());

  useEffect(() => {
    const handleEvent = (e: Event) => {
      const customEvent = e as CustomEvent<boolean>;
      if (typeof customEvent.detail === "boolean") {
        setWordWrapState(customEvent.detail);
      } else {
        setWordWrapState(getStoredWordWrap());
      }
    };

    const handleStorage = (e: StorageEvent) => {
      if (e.key === WORD_WRAP_STORAGE_KEY) {
        setWordWrapState(e.newValue === "true");
      }
    };

    window.addEventListener(WORD_WRAP_EVENT, handleEvent);
    window.addEventListener("storage", handleStorage);
    return () => {
      window.removeEventListener(WORD_WRAP_EVENT, handleEvent);
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  const setWordWrap = useCallback((val: boolean) => {
    setWordWrapState(val);
    setStoredWordWrap(val);
  }, []);

  const toggleWordWrap = useCallback(() => {
    setWordWrapState((prev) => {
      const next = !prev;
      setStoredWordWrap(next);
      return next;
    });
  }, []);

  return { wordWrap, setWordWrap, toggleWordWrap };
}
