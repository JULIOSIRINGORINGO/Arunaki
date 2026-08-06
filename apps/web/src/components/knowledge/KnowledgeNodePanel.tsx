import { useState, useEffect } from 'react';
import { Panel } from '@xyflow/react';
import { X, Save, Trash2, CheckCircle2, XCircle } from 'lucide-react';
import { cn } from '../../lib/utils';
import { apiFetch, API_BASE } from '../../lib/api';

interface KnowledgeNodePanelProps {
  nodeId: string | null;
  onClose: () => void;
  onUpdate: (id: string, data: any) => void;
  onDelete: (id: string) => void;
}

export function KnowledgeNodePanel({ nodeId, onClose, onUpdate, onDelete }: KnowledgeNodePanelProps) {
  const [nodeData, setNodeData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  
  // Form state
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [type, setType] = useState('custom');

  useEffect(() => {
    if (!nodeId || nodeId === 'main-ai-node') {
      setNodeData(null);
      return;
    }

    const fetchNode = async () => {
      setLoading(true);
      try {
        const res = await apiFetch(`${API_BASE}/knowledge/${nodeId}`);
        if (res.ok) {
          const { data } = await res.json();
          setNodeData(data);
          setTitle(data.title);
          setContent(data.content);
          setType(data.type);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };

    fetchNode();
  }, [nodeId]);

  if (!nodeId || nodeId === 'main-ai-node') return null;

  const handleSave = async () => {
    if (!nodeData) return;
    setSaving(true);
    try {
      const res = await apiFetch(`${API_BASE}/knowledge/${nodeId}`, {
        method: 'PATCH',
        body: JSON.stringify({ title, content, type }),
      });
      if (res.ok) {
        const { data } = await res.json();
        onUpdate(nodeId, data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Hapus node ini?')) return;
    try {
      const res = await apiFetch(`${API_BASE}/knowledge/${nodeId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        onDelete(nodeId);
        onClose();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const toggleActive = async () => {
    try {
      const res = await apiFetch(`${API_BASE}/knowledge/${nodeId}/toggle`, {
        method: 'PATCH',
      });
      if (res.ok) {
        const { data } = await res.json();
        setNodeData(data);
        onUpdate(nodeId, data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <Panel position="top-right" className="h-[calc(100%-2rem)] w-80 mt-4 mr-4 bg-white rounded-2xl shadow-2xl border border-gray-200/80 flex flex-col overflow-hidden pointer-events-auto">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-100 bg-gray-50/50 shrink-0">
        <h3 className="font-bold text-gray-900 text-sm">Edit Node</h3>
        <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100">
          <X className="w-4 h-4" />
        </button>
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-gray-300 border-t-gray-900 rounded-full animate-spin" />
        </div>
      ) : nodeData ? (
        <>
          {/* Form */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            
            {/* Status Toggle */}
            <div className="flex items-center justify-between p-3 rounded-xl border border-gray-100 bg-gray-50/50">
              <div>
                <div className="text-xs font-semibold text-gray-900">Status Node</div>
                <div className="text-[10px] text-gray-500 mt-0.5">Berikan akses ke AI</div>
              </div>
              <button
                onClick={toggleActive}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5",
                  nodeData.active 
                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200" 
                    : "bg-gray-200 text-gray-600 border border-gray-300"
                )}
              >
                {nodeData.active ? (
                  <><CheckCircle2 className="w-3.5 h-3.5" /> Aktif</>
                ) : (
                  <><XCircle className="w-3.5 h-3.5" /> Non-Aktif</>
                )}
              </button>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-700">Judul Knowledge</label>
              <input
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-gray-900"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-700">Tipe Node</label>
              <select
                value={type}
                onChange={e => setType(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-gray-900"
              >
                <option value="catalog">Katalog Data</option>
                <option value="rules">Aturan & SOP</option>
                <option value="template">Template Laporan</option>
                <option value="custom">Custom</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-700">Isi Knowledge (Markdown)</label>
              <textarea
                value={content}
                onChange={e => setContent(e.target.value)}
                className="w-full h-64 px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm font-mono focus:outline-none focus:border-gray-900 focus:bg-white resize-none"
              />
            </div>
          </div>

          {/* Footer Actions */}
          <div className="p-4 border-t border-gray-100 flex items-center justify-between bg-white shrink-0">
            <button
              onClick={handleDelete}
              className="p-2 rounded-xl text-red-500 hover:bg-red-50 transition-colors"
              title="Hapus Node"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white text-xs font-semibold rounded-xl hover:bg-gray-800 disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Menyimpan...' : 'Simpan'}
            </button>
          </div>
        </>
      ) : null}
    </Panel>
  );
}
