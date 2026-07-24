import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";

export function AppLayout() {
  return (
    <div className="flex h-screen w-screen bg-white overflow-hidden font-sans">
      <Sidebar />
      <main className="flex-1 overflow-hidden min-w-0 flex flex-col">
        <Outlet />
      </main>
    </div>
  );
}

