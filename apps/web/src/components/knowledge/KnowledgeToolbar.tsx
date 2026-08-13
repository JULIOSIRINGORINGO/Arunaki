import { useState } from 'react';
import { Panel } from '@xyflow/react';
import { 
  Plus, 
  Search,
  UploadCloud,
  ShieldCheck,
  Database,
  Type
} from 'lucide-react';
import { cn } from '../../lib/utils';

interface KnowledgeToolbarProps {
  onAddNode: (type: string, x: number, y: number) => void;
  onUpload: () => void;
}

export function KnowledgeToolbar({ onAddNode, onUpload }: KnowledgeToolbarProps) {
  const [isAdding, setIsAdding] = useState(false);

  // Helper to place new nodes in the center of the viewport
  const handleAdd = (type: string) => {
    // We pass 0,0 here, but the parent should calculate the real viewport center
    onAddNode(type, 0, 0);
    setIsAdding(false);
  };

  return (
    <Panel position="top-center" className="mt-4 pointer-events-auto">
      <div className="flex items-center gap-2 p-1.5 bg-black/90 backdrop-blur-md border border-gray-800 rounded-2xl shadow-lg ring-1 ring-white/5">
        
        {/* Search */}
        <div className="relative w-48 hidden sm:block">
          <Search className="w-3.5 h-3.5 text-[#c4b5fd] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search knowledge..."
            className="w-full pl-8 pr-3 py-1.5 bg-gray-900 border border-gray-800 rounded-xl text-xs text-white placeholder:text-gray-500 focus:outline-none focus:border-gray-600 focus:bg-gray-800 transition-colors"
          />
        </div>

        <div className="w-px h-6 bg-gray-800 mx-1 hidden sm:block" />

        {/* Add Actions */}
        <div className="relative">
          <button
            onClick={() => setIsAdding(!isAdding)}
            className={cn(
              "flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all",
              isAdding 
                ? "bg-gray-800 text-white shadow-inner"
                : "bg-black text-[#c4b5fd] hover:bg-gray-900 border border-gray-800 shadow-sm"
            )}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add</span>
          </button>

          {isAdding && (
            <div className="absolute top-full mt-2 right-0 w-48 bg-black/95 backdrop-blur-xl border border-gray-800 rounded-2xl shadow-xl p-1.5 flex flex-col gap-1 z-50 animate-in fade-in zoom-in-95 duration-200">
              <button
                onClick={() => handleAdd('document')}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-gray-300 hover:text-white hover:bg-gray-800 rounded-xl transition-colors group"
              >
                <Type className="w-4 h-4 text-[#c4b5fd]" />
                Text Document
              </button>
              
              <button
                onClick={() => handleAdd('database')}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-gray-300 hover:text-white hover:bg-gray-800 rounded-xl transition-colors group"
              >
                <Database className="w-4 h-4 text-[#c4b5fd]" />
                Structured Data
              </button>

              <button
                onClick={() => handleAdd('rules')}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-gray-300 hover:text-white hover:bg-gray-800 rounded-xl transition-colors group"
              >
                <ShieldCheck className="w-4 h-4 text-[#c4b5fd]" />
                Rules SOP
              </button>
              
              <div className="h-px bg-gray-800 my-1" />
              
              <button
                onClick={onUpload}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-[#c4b5fd] hover:text-white hover:bg-gray-800 rounded-xl transition-colors group"
              >
                <UploadCloud className="w-4 h-4 text-[#c4b5fd]" />
                Upload File...
              </button>            </div>
          )}
        </div>
      </div>
    </Panel>
  );
}
