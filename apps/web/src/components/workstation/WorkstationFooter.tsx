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
    <footer className="h-8 bg-[#1A191B] text-stone-400 px-4 flex items-center justify-between text-[11px] shrink-0 border-t border-stone-800">
      <div className="flex items-center gap-4">
        <span className="flex items-center gap-1.5 text-stone-300">
          <Folder className="w-3.5 h-3.5 text-[#FF5E38]" />
          {activeWorkspace ? activeWorkspace.rootPath || activeWorkspace.name : "Tanpa Workspace"}
        </span>
        {activeWorkspace && (
          <span className="text-stone-500">• {fileCount} file terhubung</span>
        )}
      </div>

      <div className="flex items-center gap-4">
        <span className="flex items-center gap-1.5 text-[#C4B5FD]">
          <BookOpen className="w-3.5 h-3.5" />
          Knowledge Base: Active (Garment)
        </span>
        <span className="text-stone-500">• Model: Nemotron-3</span>
      </div>
    </footer>
  );
}
