import { Handle, Position } from '@xyflow/react';
import { BookOpen, FileText, Activity, ShieldCheck, Database, Type } from 'lucide-react';
import { ArunakiLogo } from '../common/ArunakiLogo';
import { cn } from '../../lib/utils';

interface KnowledgeNodeProps {
  data: {
    id: string;
    title: string;
    content: string;
    type: string;
    active: boolean;
    nodeColor?: string;
    icon?: string;
    isMain?: boolean;
    onSelect?: (id: string) => void;
  };
  selected?: boolean;
}

const getIcon = (iconName?: string) => {
  switch (iconName) {
    case 'book-open': return <BookOpen className="w-4 h-4" />;
    case 'activity': return <Activity className="w-4 h-4" />;
    case 'shield-check': return <ShieldCheck className="w-4 h-4" />;
    case 'database': return <Database className="w-4 h-4" />;
    case 'type': return <Type className="w-4 h-4" />;
    case 'file-text':
    default: return <FileText className="w-4 h-4" />;
  }
};

export function KnowledgeNode({ data, selected }: KnowledgeNodeProps) {
  const isMain = data.isMain;
  const isActive = data.active;
  
  if (isMain) {
    return (
      <div className="relative group">
        <svg width="0" height="0" className="absolute">
          <defs>
            <linearGradient id="arunaki-grad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#f97316" />
              <stop offset="100%" stopColor="#c4b5fd" />
            </linearGradient>
          </defs>
        </svg>
        <div 
          className={cn(
            "flex items-center justify-center w-16 h-16 rounded-full bg-black shadow-xl border border-gray-800 cursor-pointer transition-all",
            selected ? "ring-4 ring-gray-900/40 scale-105" : "ring-4 ring-gray-900/10 hover:scale-105"
          )}
          onClick={() => data.onSelect?.(data.id)}
        >
          <ArunakiLogo className="w-8 h-8 -translate-y-[2px]" fill="url(#arunaki-grad)" />
        </div>
        <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity">
           <span className="text-xs font-bold text-gray-700 bg-white px-2 py-1 rounded-md shadow-sm border border-gray-100">Arunaki AI</span>
        </div>
        
        <Handle
          type="target"
          position={Position.Top}
          className="w-3 h-3 border-2 border-white bg-gray-900"
        />
      </div>
    );
  }

  return (
    <div
      onClick={() => data.onSelect?.(data.id)}
      className={cn(
        "relative rounded-xl shadow-sm transition-all min-w-[160px] max-w-[200px] cursor-pointer bg-orange-500 border border-orange-600",
        selected ? "shadow-md ring-2 ring-orange-500/50 scale-[1.02]" : "hover:shadow-md hover:bg-orange-600",
        !isActive && "opacity-60 grayscale"
      )}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="w-3 h-3 border-2 border-white bg-gray-300"
      />

      <div className="flex items-center gap-2.5 p-2.5">
        <div className="p-1.5 rounded-lg text-white flex-shrink-0 bg-white/20">
          {getIcon(data.icon)}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-xs font-bold text-white truncate">
            {data.title}
          </h3>
          <p className="text-[9px] text-orange-100 font-mono uppercase tracking-wider truncate mt-0.5">
            {data.type}
          </p>
        </div>
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        className="w-3 h-3 border-2 border-white bg-gray-400"
      />
    </div>
  );
}
