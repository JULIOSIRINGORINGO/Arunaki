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
      <div className="flex items-center gap-2 p-1.5 bg-white/90 backdrop-blur-md border border-gray-200/80 rounded-2xl shadow-lg ring-1 ring-black/5">
        
        {/* Search */}
        <div className="relative w-48 hidden sm:block">
          <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Cari knowledge..."
            className="w-full pl-8 pr-3 py-1.5 bg-gray-50 border border-gray-100 rounded-xl text-xs focus:outline-none focus:border-gray-300 focus:bg-white transition-colors"
          />
        </div>

        <div className="w-px h-6 bg-gray-200 mx-1 hidden sm:block" />

        {/* Add Actions */}
        <div className="relative">
          <button
            onClick={() => setIsAdding(!isAdding)}
            className={cn(
              "flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all",
              isAdding 
                ? "bg-gray-100 text-gray-900" 
                : "hover:bg-gray-50 text-gray-700"
            )}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Tambah</span>
          </button>

          {isAdding && (
            <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 w-48 bg-white border border-gray-200 rounded-2xl shadow-xl overflow-hidden py-1 z-50 animate-in fade-in slide-in-from-top-2">
              <button
                onClick={() => handleAdd('catalog')}
                className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-50 text-left text-xs transition-colors"
              >
                <Database className="w-4 h-4 text-blue-500" />
                <div>
                  <div className="font-semibold text-gray-900">Katalog Data</div>
                  <div className="text-[10px] text-gray-500">Harga, inventori, produk</div>
                </div>
              </button>
              
              <button
                onClick={() => handleAdd('rules')}
                className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-50 text-left text-xs transition-colors"
              >
                <ShieldCheck className="w-4 h-4 text-emerald-500" />
                <div>
                  <div className="font-semibold text-gray-900">Aturan SOP</div>
                  <div className="text-[10px] text-gray-500">Kebijakan, cara kerja</div>
                </div>
              </button>

              <button
                onClick={() => handleAdd('template')}
                className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-50 text-left text-xs transition-colors"
              >
                <Type className="w-4 h-4 text-purple-500" />
                <div>
                  <div className="font-semibold text-gray-900">Template</div>
                  <div className="text-[10px] text-gray-500">Format laporan, balasan</div>
                </div>
              </button>
              
              <div className="h-px bg-gray-100 my-1" />
              
              <button
                onClick={onUpload}
                className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-50 text-left text-xs transition-colors"
              >
                <UploadCloud className="w-4 h-4 text-gray-600" />
                <div className="font-semibold text-gray-900">Upload File...</div>
              </button>
            </div>
          )}
        </div>
      </div>
    </Panel>
  );
}
