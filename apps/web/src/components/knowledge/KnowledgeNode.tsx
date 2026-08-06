import { Handle, Position } from '@xyflow/react';
import { BookOpen, FileText, Activity, ShieldCheck, Database, Type } from 'lucide-react';
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
  const color = data.nodeColor || '#3B82F6'; // Default blue
  
  return (
    <div
      onClick={() => data.onSelect?.(data.id)}
      className={cn(
        "relative rounded-2xl border bg-white shadow-sm transition-all min-w-[200px] max-w-[280px]",
        selected ? "border-gray-900 shadow-md ring-1 ring-gray-900/10" : "border-gray-200/80 hover:border-gray-300 hover:shadow",
        !isActive && !isMain && "opacity-60 bg-gray-50/50",
        isMain && "border-accent bg-accent/5 ring-1 ring-accent/20"
      )}
    >
      {/* Target handle (Top) - Input */}
      {!isMain && (
        <Handle
          type="target"
          position={Position.Top}
          className="w-3 h-3 border-2 border-white bg-gray-300"
        />
      )}

      {/* Header */}
      <div className="flex items-center gap-3 p-3 border-b border-gray-100">
        <div 
          className="p-1.5 rounded-lg text-white flex-shrink-0"
          style={{ backgroundColor: color }}
        >
          {getIcon(data.icon)}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className={cn("text-xs font-bold truncate", isMain ? "text-accent" : "text-gray-900")}>
            {data.title}
          </h3>
          <p className="text-[10px] text-gray-400 font-mono uppercase tracking-wider truncate mt-0.5">
            {isMain ? 'CORE AI' : data.type}
          </p>
        </div>
      </div>

      {/* Body preview */}
      {!isMain && data.content && (
        <div className="p-3 bg-gray-50/50 rounded-b-2xl">
          <p className="text-[10px] text-gray-500 line-clamp-2 leading-relaxed">
            {data.content}
          </p>
        </div>
      )}
      
      {isMain && (
        <div className="p-3 bg-accent/5 rounded-b-2xl">
          <p className="text-[10px] text-accent/80 font-medium text-center">
            Central Hub
          </p>
        </div>
      )}

      {/* Source handle (Bottom) - Output */}
      <Handle
        type="source"
        position={Position.Bottom}
        className={cn(
          "w-3 h-3 border-2 border-white",
          isMain ? "bg-accent" : "bg-gray-400"
        )}
      />
    </div>
  );
}
