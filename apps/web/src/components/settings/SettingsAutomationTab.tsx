import { useState, memo } from "react";
import { Monitor, FileSpreadsheet, ShieldCheck, Bell } from "lucide-react";
import { toast } from "sonner";
import { cn } from "../../lib/utils";

export const SettingsAutomationTab = memo(function SettingsAutomationTab() {
  const [autoOpenExcel, setAutoOpenExcel] = useState(
    () => localStorage.getItem("arunaki_pref_auto_open_excel") === "true"
  );
  const [autoBackup, setAutoBackup] = useState(
    () => localStorage.getItem("arunaki_pref_auto_backup") !== "false"
  );
  const [desktopNotification, setDesktopNotification] = useState(
    () => localStorage.getItem("arunaki_pref_desktop_notification") !== "false"
  );

  return (
    <div className="w-full space-y-6">
      <div>
        <h3 className="font-bold text-[var(--text-primary)] text-base">
          Desktop Automation & OS Behavior
        </h3>
        <p className="text-xs text-[var(--text-muted)] mt-0.5">
          Configure desktop office automation, Excel application interaction, and operating system notifications.
        </p>
      </div>

      {/* Interactive Setting Cards (Monochrome) */}
      <div className="w-full space-y-4">
        {/* 1. Auto Open Excel */}
        <div className="p-5 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)] flex items-start justify-between gap-4">
          <div className="flex gap-3.5">
            <div className="w-9 h-9 rounded-xl bg-[var(--bg-hover)] text-[var(--text-primary)] flex items-center justify-center shrink-0 border border-[var(--border-strong)]">
              <FileSpreadsheet className="w-4 h-4 text-[var(--text-muted)]" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-[var(--text-primary)]">
                Launch Microsoft Excel on Edit
              </h4>
              <p className="text-[11px] text-[var(--text-muted)] leading-relaxed mt-0.5">
                Opens Microsoft Excel visibly on screen when executing spreadsheet tasks. If disabled, spreadsheet modifications are performed silently in headless background mode.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              const next = !autoOpenExcel;
              setAutoOpenExcel(next);
              localStorage.setItem("arunaki_pref_auto_open_excel", String(next));
              toast.success(
                next
                  ? "Excel foreground launch enabled."
                  : "Excel foreground launch disabled (headless mode)."
              );
            }}
            className={cn(
              "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border border-[var(--border-strong)] items-center p-0.5 transition-colors duration-200 ease-in-out focus:outline-none",
              autoOpenExcel ? "bg-[var(--text-primary)]" : "bg-[var(--bg-panel)]"
            )}
          >
            <span
              className={cn(
                "pointer-events-none inline-block h-4.5 w-4.5 transform rounded-full shadow-sm ring-0 transition-transform duration-200 ease-in-out",
                autoOpenExcel ? "translate-x-5 bg-[var(--bg-app)]" : "translate-x-0 bg-[var(--text-muted)]"
              )}
            />
          </button>
        </div>

        {/* 2. Auto-Backup Dokumen Sebelum Dimodifikasi */}
        <div className="p-5 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)] flex items-start justify-between gap-4">
          <div className="flex gap-3.5">
            <div className="w-9 h-9 rounded-xl bg-[var(--bg-hover)] text-[var(--text-primary)] flex items-center justify-center shrink-0 border border-[var(--border-strong)]">
              <ShieldCheck className="w-4 h-4 text-[var(--text-muted)]" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-[var(--text-primary)]">
                Automatic Snapshot Backup Before Modifications
              </h4>
              <p className="text-[11px] text-[var(--text-muted)] leading-relaxed mt-0.5">
                Creates an immutable local backup (
                <code className="px-1.5 py-0.5 rounded bg-[var(--bg-panel)] font-mono text-[10px] text-[var(--text-primary)]">
                  .bak
                </code>
                ) in{" "}
                <code className="px-1.5 py-0.5 rounded bg-[var(--bg-panel)] font-mono text-[10px] text-[var(--text-primary)]">
                  .arunaki/backups/
                </code>{" "}
                before mutating files for 100% data recovery.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              const next = !autoBackup;
              setAutoBackup(next);
              localStorage.setItem("arunaki_pref_auto_backup", String(next));
              toast.success(next ? "Automatic backup enabled." : "Automatic backup disabled.");
            }}
            className={cn(
              "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border border-[var(--border-strong)] items-center p-0.5 transition-colors duration-200 ease-in-out focus:outline-none",
              autoBackup ? "bg-[var(--text-primary)]" : "bg-[var(--bg-panel)]"
            )}
          >
            <span
              className={cn(
                "pointer-events-none inline-block h-4.5 w-4.5 transform rounded-full shadow-sm ring-0 transition-transform duration-200 ease-in-out",
                autoBackup ? "translate-x-5 bg-[var(--bg-app)]" : "translate-x-0 bg-[var(--text-muted)]"
              )}
            />
          </button>
        </div>

        {/* 3. Notifikasi Panel Windows */}
        <div className="p-5 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)] flex items-start justify-between gap-4">
          <div className="flex gap-3.5">
            <div className="w-9 h-9 rounded-xl bg-[var(--bg-hover)] text-[var(--text-primary)] flex items-center justify-center shrink-0 border border-[var(--border-strong)]">
              <Bell className="w-4 h-4 text-[var(--text-muted)]" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-[var(--text-primary)]">
                Desktop OS Notifications
              </h4>
              <p className="text-[11px] text-[var(--text-muted)] leading-relaxed mt-0.5">
                Displays native desktop notifications when document and ledger tasks complete.
              </p>
              {desktopNotification && (
                <div className="mt-3">
                  <button
                    type="button"
                    onClick={() => {
                      const desktop = typeof window !== "undefined" && (window as any).arunakiDesktop;
                      if (desktop?.notify) {
                        desktop.notify({
                          title: "Arunaki Workstation",
                          body: "Document automation task completed successfully.",
                        });
                        toast.success("Desktop test notification dispatched.");
                      } else {
                        toast.info("Native notifications are active inside Electron desktop shell.");
                      }
                    }}
                    className="px-3 py-1.5 rounded-lg bg-[var(--bg-hover)] text-[var(--text-primary)] text-[11px] font-medium border border-[var(--border-color)] transition-colors cursor-pointer flex items-center gap-1.5"
                  >
                    <Bell className="w-3 h-3 text-[var(--text-muted)]" />
                    <span>Test Desktop Notification</span>
                  </button>
                </div>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              const next = !desktopNotification;
              setDesktopNotification(next);
              localStorage.setItem("arunaki_pref_desktop_notification", String(next));
              toast.success(
                next ? "Desktop notifications enabled." : "Desktop notifications disabled."
              );
            }}
            className={cn(
              "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border border-[var(--border-strong)] items-center p-0.5 transition-colors duration-200 ease-in-out focus:outline-none",
              desktopNotification ? "bg-[var(--text-primary)]" : "bg-[var(--bg-panel)]"
            )}
          >
            <span
              className={cn(
                "pointer-events-none inline-block h-4.5 w-4.5 transform rounded-full shadow-sm ring-0 transition-transform duration-200 ease-in-out",
                desktopNotification
                  ? "translate-x-5 bg-[var(--bg-app)]"
                  : "translate-x-0 bg-[var(--text-muted)]"
              )}
            />
          </button>
        </div>
      </div>

      {/* Electron Diagnostic Bridge Status (Monochrome) */}
      <div className="p-5 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)] flex items-center justify-between">
        <div className="flex items-center gap-3.5">
          <div className="w-9 h-9 rounded-xl bg-[var(--bg-hover)] text-[var(--text-primary)] flex items-center justify-center shrink-0 border border-[var(--border-strong)]">
            <Monitor className="w-4 h-4 text-[var(--text-muted)]" />
          </div>
          <div>
            <h4 className="text-xs font-semibold text-[var(--text-primary)]">
              Electron Native Desktop Shell
            </h4>
            <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
              Native OS filesystem, window overlay, and IPC bridge
            </p>
          </div>
        </div>
        <span className="px-3 py-1 rounded-full bg-[var(--bg-hover)] text-[var(--text-primary)] text-[10px] font-semibold border border-[var(--border-strong)]">
          Connected
        </span>
      </div>
    </div>
  );
});
