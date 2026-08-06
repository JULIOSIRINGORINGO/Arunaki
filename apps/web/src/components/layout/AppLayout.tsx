import { Outlet, useNavigate } from "react-router-dom";
import { Sidebar } from "./Sidebar";

export function AppLayout() {
  const navigate = useNavigate();

  const handleOpenFolder = async () => {
    // Check if running in Electron environment
    if (typeof window !== "undefined" && (window as any).arunakiDesktop?.selectFolder) {
      try {
        const folderPath = await (window as any).arunakiDesktop.selectFolder();
        if (folderPath) {
          navigate(`/?path=${encodeURIComponent(folderPath)}`);
          return;
        }
      } catch (err) {
        console.error("Select folder failed:", err);
      }
    }
    // Fallback: navigate to workspace assistant home view
    navigate("/");
  };

  return (
    <div className="flex h-screen w-screen bg-[#F4EFE6] overflow-hidden font-sans p-4 gap-4 select-none">
      {/* 1. Left Vertical Double-Pill Sidebar */}
      <Sidebar />

      {/* 2. Main Area: Header Capsule + Outlet Content View */}
      <main className="flex-1 flex flex-col h-full min-w-0 overflow-hidden gap-4">
        {/* Top Header Capsule Bar */}
        <header className="bg-[#1A191B] rounded-full h-14 px-6 flex items-center justify-between shadow-md shrink-0 border border-stone-800/40">
          {/* Left Title Label & Desktop App Menu Bar */}
          <div className="flex items-center gap-6">
            <span className="text-[#FF5E38] font-black text-sm tracking-wider uppercase pr-2 border-r border-stone-800">
              WORKSPACE
            </span>

            {/* Relevant App Menus: File, Edit, Tampilan, Bantuan */}
            <nav className="flex items-center gap-1">
              <button
                onClick={handleOpenFolder}
                className="text-stone-300 hover:text-white text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-stone-800/80 transition-colors cursor-pointer"
                title="Buka Folder / Dokumen"
              >
                File
              </button>
              <button
                onClick={() => navigate("/workspace")}
                className="text-stone-300 hover:text-white text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-stone-800/80 transition-colors cursor-pointer"
                title="Kelola & Edit Dokumen Workspace"
              >
                Edit
              </button>
              <button
                onClick={() => navigate("/")}
                className="text-stone-300 hover:text-white text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-stone-800/80 transition-colors cursor-pointer"
                title="Tampilan Chat & Canvas"
              >
                Tampilan
              </button>
              <button
                onClick={() => navigate("/knowledge")}
                className="text-stone-300 hover:text-white text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-stone-800/80 transition-colors cursor-pointer"
                title="Bantuan & Knowledge Base"
              >
                Bantuan
              </button>
            </nav>
          </div>

        </header>



        {/* Dynamic Page Content View */}
        <div className="flex-1 min-h-0 w-full overflow-hidden">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

