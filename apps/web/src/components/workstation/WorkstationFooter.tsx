import { Folder, BookOpen } from "lucide-react";

interface Workspace {
  id: string;
  name: string;
  rootPath: string | null;
}

interface WorkstationFooterProps {
  activeWorkspace: Workspace | null;
  fileCount: number;
}

export function WorkstationFooter({
  activeWorkspace,
  fileCount,
}: WorkstationFooterProps) {
  return (
    <footer className="h-7 bg-[#121212] text-[#A3A3A3] px-4 flex items-center justify-between text-[11px] shrink-0 border-t border-[#2D2D2D]">
      <div className="flex items-center gap-4">
        <span className="flex items-center gap-1.5 text-[#E5E5E5]">
          <Folder className="w-3.5 h-3.5 text-[#A3A3A3]" />
          {activeWorkspace ? activeWorkspace.rootPath || activeWorkspace.name : "Tanpa Workspace"}
        </span>
        {activeWorkspace && (
          <span className="text-[#737373]">• {fileCount} file terhubung</span>
        )}
      </div>

      <div className="flex items-center gap-4">
        <span className="flex items-center gap-1.5 text-[#E5E5E5]">
          <BookOpen className="w-3.5 h-3.5" />
          Knowledge Base Active
        </span>
        <span className="text-[#737373]">• Model: Nemotron-3</span>
      </div>
    </footer>
  );
}
