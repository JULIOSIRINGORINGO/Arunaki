import { NavLink } from "react-router-dom";
import { cn } from "../../lib/utils";

interface SidebarItemProps {
  to: string;
  icon: React.ReactNode;
  label: string;
}

export function SidebarItem({ to, icon, label }: SidebarItemProps) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        cn(
          "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
          isActive
            ? "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400"
            : "text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
        )
      }
    >
      {icon}
      <span>{label}</span>
    </NavLink>
  );
}
