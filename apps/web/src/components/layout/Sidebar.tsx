import { useState } from "react";
import { MessageSquare, FolderOpen, Clock, Settings, Menu, X, Bot } from "lucide-react";
import { SidebarItem } from "./SidebarItem";

const navItems = [
  { to: "/", icon: <MessageSquare size={20} />, label: "Chat" },
  { to: "/workspace", icon: <FolderOpen size={20} />, label: "Workspace" },
  { to: "/history", icon: <Clock size={20} />, label: "History" },
  { to: "/settings", icon: <Settings size={20} />, label: "Settings" },
];

export function Sidebar() {
  const [isOpen, setIsOpen] = useState(true);

  return (
    <>
      {/* Mobile toggle */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed top-4 left-4 z-50 p-2 rounded-lg bg-white dark:bg-gray-800 shadow-md lg:hidden"
      >
        {isOpen ? <X size={20} /> : <Menu size={20} />}
      </button>

      {/* Sidebar */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-40 w-64 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800
          transform transition-transform duration-200 ease-in-out
          lg:relative lg:translate-x-0
          ${isOpen ? "translate-x-0" : "-translate-x-full"}
        `}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center gap-2 px-4 py-5 border-b border-gray-200 dark:border-gray-800">
            <Bot className="text-purple-600" size={28} />
            <span className="text-xl font-bold text-gray-900 dark:text-white">
              Arunaki
            </span>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-3 py-4 space-y-1">
            {navItems.map((item) => (
              <SidebarItem key={item.to} {...item} />
            ))}
          </nav>

          {/* Footer */}
          <div className="px-4 py-4 border-t border-gray-200 dark:border-gray-800">
            <p className="text-xs text-gray-500 dark:text-gray-500">
              Arunaki AI Agent v0.1
            </p>
          </div>
        </div>
      </aside>

      {/* Overlay for mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}
    </>
  );
}
