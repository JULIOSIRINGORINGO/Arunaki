import { useState, useEffect, useCallback, memo } from "react";
import {
  MessageSquare,
  ShieldCheck,
  Folder,
  Key,
  Eye,
  EyeOff,
  CheckCircle2,
  XCircle,
  RefreshCw,
  HelpCircle,
  Send,
  Sparkles,
  Info,
} from "lucide-react";
import { toast } from "sonner";
import { API_BASE, apiFetch } from "../../lib/api";
import { cn } from "../../lib/utils";

interface TelegramStatus {
  connected: boolean;
  botUsername?: string | null;
  botFirstName?: string | null;
  lastActive?: number | null;
  lastError?: string | null;
}

export const SettingsMessagingTab = memo(function SettingsMessagingTab() {
  // All React Hooks at the very top
  const [enabled, setEnabled] = useState(false);
  const [botToken, setBotToken] = useState("");
  const [allowedUserId, setAllowedUserId] = useState("");
  const [targetFolder, setTargetFolder] = useState("");
  const [showToken, setShowToken] = useState(false);

  const [status, setStatus] = useState<TelegramStatus>({
    connected: false,
    botUsername: null,
    botFirstName: null,
    lastActive: null,
    lastError: null,
  });

  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    botUsername?: string;
    botFirstName?: string;
    error?: string;
  } | null>(null);

  const fetchConfigAndStatus = useCallback(async () => {
    try {
      setLoading(true);
      const [configRes, statusRes] = await Promise.all([
        apiFetch(`${API_BASE}/messaging/config`),
        apiFetch(`${API_BASE}/messaging/status`),
      ]);

      if (configRes.ok) {
        const configJson = await configRes.json();
        const tg = configJson?.data?.telegram || configJson?.telegram;
        if (tg) {
          setEnabled(Boolean(tg.enabled));
          setBotToken(tg.botToken || "");
          setAllowedUserId(tg.allowedUserId || "");
          setTargetFolder(
            tg.targetFolder || localStorage.getItem("arunaki_active_folder") || ""
          );
        }
      }

      if (statusRes.ok) {
        const statusJson = await statusRes.json();
        const st = statusJson?.data?.telegram || statusJson?.telegram;
        if (st) {
          setStatus({
            connected: Boolean(st.connected),
            botUsername: st.botUsername || null,
            botFirstName: st.botFirstName || null,
            lastActive: st.lastActive || null,
            lastError: st.lastError || null,
          });
        }
      }
    } catch (err) {
      console.error("Failed to load messaging settings:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConfigAndStatus();
    const interval = setInterval(fetchConfigAndStatus, 15000);
    return () => clearInterval(interval);
  }, [fetchConfigAndStatus]);

  const handleTestToken = async () => {
    if (!botToken.trim()) {
      toast.error("Please enter a Telegram Bot Token first.");
      return;
    }

    try {
      setTesting(true);
      setTestResult(null);
      const res = await apiFetch(`${API_BASE}/messaging/test`, {
        method: "POST",
        body: JSON.stringify({ botToken: botToken.trim() }),
      });

      const json = await res.json();
      const result = json?.data || json;

      if (res.ok && result?.success) {
        setTestResult(result);
        toast.success(
          `Token verified! Connected to @${result.botUsername || "Telegram Bot"}`
        );
      } else {
        setTestResult({
          success: false,
          error: result?.error || "Failed to verify bot token with Telegram.",
        });
        toast.error(result?.error || "Invalid bot token.");
      }
    } catch (err: any) {
      const errorMsg = err?.message || "Failed to connect to verification service.";
      setTestResult({ success: false, error: errorMsg });
      toast.error(errorMsg);
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    try {
      setSaving(true);
      const payload = {
        telegram: {
          enabled,
          botToken: botToken.trim(),
          allowedUserId: allowedUserId.trim(),
          targetFolder: targetFolder.trim(),
        },
      };

      const res = await apiFetch(`${API_BASE}/messaging/config`, {
        method: "POST",
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errorText = await res.text().catch(() => "");
        throw new Error(`Save failed: ${res.status} ${errorText}`);
      }

      toast.success(
        enabled
          ? "Messaging gateway saved and connected."
          : "Messaging gateway settings saved (disabled)."
      );

      // Refresh status after save
      setTimeout(fetchConfigAndStatus, 1000);
    } catch (err: any) {
      toast.error(err?.message || "Failed to save messaging configuration.");
    } finally {
      setSaving(false);
    }
  };

  const handleUseCurrentFolder = () => {
    const active = localStorage.getItem("arunaki_active_folder");
    if (active) {
      setTargetFolder(active);
      toast.info(`Target workspace set to ${active}`);
    } else {
      toast.error("No active folder currently loaded in workspace.");
    }
  };

  return (
    <div className="w-full space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-bold text-[var(--text-primary)] text-base flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-[var(--text-primary)]" />
            Messaging Apps & BYOB Gateways
          </h3>
          <p className="text-xs text-[var(--text-muted)] mt-0.5 leading-relaxed">
            Connect external chat apps (Telegram) to Arunaki. Forward WhatsApp messages, meeting notes, or document instructions from your mobile phone, and Arunaki will execute them directly on this computer.
          </p>
        </div>

        <button
          type="button"
          onClick={() => fetchConfigAndStatus()}
          disabled={loading}
          className="p-1.5 rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] hover:bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-all cursor-pointer"
          title="Refresh status"
        >
          <RefreshCw className={cn("w-3.5 h-3.5", loading && "animate-spin")} />
        </button>
      </div>

      {/* Main Telegram Gateway Card */}
      <div className="p-6 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)] space-y-6 shadow-xs">
        {/* Top bar with Channel Info & Status */}
        <div className="flex items-center justify-between pb-4 border-b border-[var(--border-color)]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[var(--bg-hover)] flex items-center justify-center border border-[var(--border-strong)] text-[var(--text-primary)]">
              <Send className="w-5 h-5 text-sky-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-bold text-[var(--text-primary)]">
                  Telegram BYOB Gateway
                </h4>
                {/* Live Status Badge */}
                {enabled ? (
                  status.connected ? (
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      Connected {status.botUsername ? `@${status.botUsername}` : ""}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                      {status.lastError ? "Connection Warning" : "Connecting..."}
                    </span>
                  )
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium bg-[var(--bg-panel)] text-[var(--text-muted)] border border-[var(--border-color)]">
                    <span className="w-1.5 h-1.5 rounded-full bg-[var(--text-muted)]" />
                    Inactive
                  </span>
                )}
              </div>
              <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
                Bring-Your-Own-Bot long polling outward gateway. Requires zero open ports, domain, or VPS.
              </p>
            </div>
          </div>

          {/* Master Enable/Disable Switch */}
          <button
            type="button"
            onClick={() => setEnabled(!enabled)}
            className={cn(
              "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border border-[var(--border-strong)] items-center p-0.5 transition-colors duration-200 ease-in-out focus:outline-none",
              enabled ? "bg-[var(--text-primary)]" : "bg-[var(--bg-panel)]"
            )}
            title={enabled ? "Disable Telegram Gateway" : "Enable Telegram Gateway"}
          >
            <span
              className={cn(
                "pointer-events-none inline-block h-4.5 w-4.5 transform rounded-full shadow-sm ring-0 transition-transform duration-200 ease-in-out",
                enabled ? "translate-x-5 bg-[var(--bg-app)]" : "translate-x-0 bg-[var(--text-muted)]"
              )}
            />
          </button>
        </div>

        {/* Error Alert if connection error occurred */}
        {enabled && status.lastError && (
          <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-start gap-2.5">
            <XCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Gateway Connection Notice</p>
              <p className="text-[11px] opacity-90 mt-0.5 font-mono">{status.lastError}</p>
            </div>
          </div>
        )}

        {/* Configuration Form */}
        <form onSubmit={handleSave} className="space-y-4">
          {/* 1. Bot Token */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-[var(--text-primary)] flex items-center gap-1.5">
                <Key className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                Telegram Bot Token
              </label>
              <span className="text-[10px] text-[var(--text-muted)]">
                From @BotFather
              </span>
            </div>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  type={showToken ? "text" : "password"}
                  value={botToken}
                  onChange={(e) => {
                    setBotToken(e.target.value);
                    setTestResult(null);
                  }}
                  placeholder="e.g. 1234567890:ABCdefGhIJKlmNoPQRsTUVwxyZ_example"
                  className="w-full px-3.5 py-2 pr-10 text-xs font-mono rounded-xl bg-[var(--bg-panel)] border border-[var(--border-color)] text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--text-primary)] transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowToken(!showToken)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
                >
                  {showToken ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>

              <button
                type="button"
                onClick={handleTestToken}
                disabled={testing || !botToken.trim()}
                className="px-3.5 py-2 text-xs font-medium rounded-xl border border-[var(--border-strong)] bg-[var(--bg-hover)] text-[var(--text-primary)] hover:bg-[var(--border-strong)] transition-colors disabled:opacity-50 cursor-pointer shrink-0 flex items-center gap-1.5"
              >
                {testing ? (
                  <>
                    <RefreshCw className="w-3 h-3 animate-spin" />
                    Testing...
                  </>
                ) : (
                  "Test Token"
                )}
              </button>
            </div>

            {/* Test result feedback banner */}
            {testResult && (
              <div
                className={cn(
                  "p-2.5 rounded-lg text-xs flex items-center gap-2 mt-1.5",
                  testResult.success
                    ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                    : "bg-red-500/10 text-red-400 border border-red-500/20"
                )}
              >
                {testResult.success ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                    <span>
                      Token is valid! Bot verified as <b>@{testResult.botUsername}</b> ({testResult.botFirstName}).
                    </span>
                  </>
                ) : (
                  <>
                    <XCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>{testResult.error || "Token verification failed."}</span>
                  </>
                )}
              </div>
            )}
          </div>

          {/* 2. Allowed User ID / Whitelist */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-[var(--text-primary)] flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                Allowed Sender Whitelist (Security)
              </label>
              <span className="text-[10px] text-[var(--text-muted)]">
                User IDs or @usernames
              </span>
            </div>
            <input
              type="text"
              value={allowedUserId}
              onChange={(e) => setAllowedUserId(e.target.value)}
              placeholder="e.g. 123456789, @juliosiringo (or * for all)"
              className="w-full px-3.5 py-2 text-xs font-mono rounded-xl bg-[var(--bg-panel)] border border-[var(--border-color)] text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--text-primary)] transition-colors"
            />
            <p className="text-[11px] text-[var(--text-muted)] flex items-center gap-1 leading-relaxed">
              <Info className="w-3 h-3 shrink-0 text-sky-400" />
              Only accounts listed here can interact with Arunaki. Message{" "}
              <code className="px-1 py-0.2 rounded bg-[var(--bg-panel)] font-mono text-[10px] text-[var(--text-primary)]">
                @userinfobot
              </code>{" "}
              on Telegram to check your numeric ID.
            </p>
          </div>

          {/* 3. Target Workspace Folder */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-[var(--text-primary)] flex items-center gap-1.5">
                <Folder className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                Target Project Folder
              </label>
              <button
                type="button"
                onClick={handleUseCurrentFolder}
                className="text-[10px] text-sky-400 hover:underline cursor-pointer font-medium"
              >
                Use Active Workspace Folder
              </button>
            </div>
            <input
              type="text"
              value={targetFolder}
              onChange={(e) => setTargetFolder(e.target.value)}
              placeholder="e.g. E:\JS\Arunika or /Users/name/Documents/Projects"
              className="w-full px-3.5 py-2 text-xs font-mono rounded-xl bg-[var(--bg-panel)] border border-[var(--border-color)] text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--text-primary)] transition-colors"
            />
            <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">
              Arunaki will execute document tasks and create outputs in this folder when receiving instructions from Telegram.
            </p>
          </div>

          {/* Submit Action */}
          <div className="pt-2 flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 rounded-xl text-xs font-semibold bg-[var(--text-primary)] text-[var(--bg-app)] hover:opacity-90 transition-opacity disabled:opacity-50 cursor-pointer flex items-center gap-2 shadow-xs"
            >
              {saving ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  Saving Configuration...
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  Save & Connect Gateway
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* 4-Step Setup Guide Card */}
      <div className="p-5 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)] space-y-3">
        <div className="flex items-center gap-2 text-xs font-bold text-[var(--text-primary)]">
          <HelpCircle className="w-4 h-4 text-sky-400" />
          Quick 4-Step BYOB Telegram Setup Guide
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
          <div className="p-3 rounded-xl bg-[var(--bg-panel)] border border-[var(--border-color)] space-y-1">
            <div className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-[var(--bg-hover)] border border-[var(--border-strong)] text-[10px] font-bold flex items-center justify-center text-[var(--text-primary)]">
                1
              </span>
              <span className="text-xs font-semibold text-[var(--text-primary)]">
                Create your Bot on Telegram
              </span>
            </div>
            <p className="text-[11px] text-[var(--text-muted)] pl-7 leading-relaxed">
              Open Telegram, search for{" "}
              <code className="px-1 py-0.2 rounded bg-[var(--bg-hover)] text-[10px] text-sky-400 font-mono">
                @BotFather
              </code>
              , and type{" "}
              <code className="px-1 py-0.2 rounded bg-[var(--bg-hover)] text-[10px] text-[var(--text-primary)] font-mono">
                /newbot
              </code>
              . Choose any name and username you like.
            </p>
          </div>

          <div className="p-3 rounded-xl bg-[var(--bg-panel)] border border-[var(--border-color)] space-y-1">
            <div className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-[var(--bg-hover)] border border-[var(--border-strong)] text-[10px] font-bold flex items-center justify-center text-[var(--text-primary)]">
                2
              </span>
              <span className="text-xs font-semibold text-[var(--text-primary)]">
                Paste Bot Token
              </span>
            </div>
            <p className="text-[11px] text-[var(--text-muted)] pl-7 leading-relaxed">
              BotFather will reply with an HTTP API token (e.g. <code className="text-[10px] font-mono text-[var(--text-muted)]">123456:ABC...</code>). Copy and paste it into the <b>Telegram Bot Token</b> field above.
            </p>
          </div>

          <div className="p-3 rounded-xl bg-[var(--bg-panel)] border border-[var(--border-color)] space-y-1">
            <div className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-[var(--bg-hover)] border border-[var(--border-strong)] text-[10px] font-bold flex items-center justify-center text-[var(--text-primary)]">
                3
              </span>
              <span className="text-xs font-semibold text-[var(--text-primary)]">
                Authorize Your Account
              </span>
            </div>
            <p className="text-[11px] text-[var(--text-muted)] pl-7 leading-relaxed">
              Open{" "}
              <code className="px-1 py-0.2 rounded bg-[var(--bg-hover)] text-[10px] text-sky-400 font-mono">
                @userinfobot
              </code>{" "}
              on Telegram to get your numeric ID. Enter it in the <b>Allowed Sender Whitelist</b> field to prevent strangers from accessing your PC.
            </p>
          </div>

          <div className="p-3 rounded-xl bg-[var(--bg-panel)] border border-[var(--border-color)] space-y-1">
            <div className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-[var(--bg-hover)] border border-[var(--border-strong)] text-[10px] font-bold flex items-center justify-center text-[var(--text-primary)]">
                4
              </span>
              <span className="text-xs font-semibold text-[var(--text-primary)]">
                Connect & Forward Tasks
              </span>
            </div>
            <p className="text-[11px] text-[var(--text-muted)] pl-7 leading-relaxed">
              Click <b>Save & Connect Gateway</b>. Now open your new bot on your phone, send <code className="text-[10px] font-mono text-[var(--text-primary)]">/start</code>, or forward any document prompt!
            </p>
          </div>
        </div>
      </div>
    </div>
  );
});
