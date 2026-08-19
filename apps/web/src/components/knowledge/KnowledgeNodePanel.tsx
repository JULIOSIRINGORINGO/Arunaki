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
  const [urls, setUrls] = useState<string[]>([]);
  const [city, setCity] = useState('');
  const [content, setContent] = useState('');
  const [composing, setComposing] = useState(false);
  const [composeError, setComposeError] = useState('');

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
          setContent(data.content || '');
          setCity(data.city || '');
          try {
            const parsed = JSON.parse(data.urls || '[]');
            setUrls(Array.isArray(parsed) ? parsed : []);
          } catch {
            setUrls([]);
          }
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

  const handleCompose = async () => {
    const target = urls[0]?.trim() || '';
    if (!/^https?:\/\/\S+$/i.test(target)) return;
    setComposing(true);
    setComposeError('');
    try {
      const res = await apiFetch(`${API_BASE}/knowledge/compose`, {
        method: 'POST',
        body: JSON.stringify({ url: target }),
      });
      const { data, error } = await res.json();
      if (error) {
        setComposeError(error.message);
      } else {
        setTitle(data.title);
        setContent(data.content);
        if (Array.isArray(data.urls) && data.urls.length > 0) {
          setUrls(data.urls);
        }
      }
    } catch (e: any) {
      setComposeError(e.message || 'Fetch failed');
    } finally {
      setComposing(false);
    }
  };

  const handleSave = async () => {
    if (!nodeData) return;
    setSaving(true);
    setComposeError('');
    try {
      let finalContent = content;
      if (!finalContent.trim()) {
        const target = urls.find((u) => /^https?:\/\/\S+$/i.test(u.trim()))?.trim();
        if (target) {
          const res = await apiFetch(`${API_BASE}/knowledge/compose`, {
            method: 'POST',
            body: JSON.stringify({ url: target }),
          });
          const { data, error } = await res.json();
          if (error) {
            setComposeError(error.message);
          } else {
            finalContent = data.content;
          }
        }
      }
      const res = await apiFetch(`${API_BASE}/knowledge/${nodeId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          title,
          content: finalContent,
          urls: urls.map((u) => u.trim()).filter(Boolean),
          city,
        }),
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
    if (!confirm('Delete this node?')) return;
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

  if (!nodeId || nodeId === 'main-ai-node') {
    return null;
  }

  return (
    <Panel position="top-right" className="max-h-[calc(100vh-8rem)] w-80 mt-4 mr-4 bg-[var(--bg-card)] text-[var(--text-primary)] rounded-2xl border border-[var(--border-strong)] flex flex-col overflow-hidden pointer-events-auto">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-[var(--border-color)] bg-[var(--bg-panel)] shrink-0">
        <h3 className="font-bold text-[var(--text-primary)] text-sm">Edit Node</h3>
        <button onClick={onClose} className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] cursor-pointer">
          <X className="w-4 h-4" />
        </button>
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-[var(--border-strong)] border-t-[var(--text-primary)] rounded-full animate-spin" />
        </div>
      ) : nodeData ? (
        <>
          {/* Form */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            
            {/* Status Toggle */}
            <div className="flex items-center justify-between p-3 rounded-xl border border-[var(--border-color)] bg-[var(--bg-panel)]">
              <div>
                <div className="text-xs font-semibold text-[var(--text-primary)]">Node Status</div>
                <div className="text-[10px] text-[var(--text-muted)] mt-0.5">Grant access to AI</div>
              </div>
              <button
                onClick={toggleActive}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer",
                  nodeData.active 
                    ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30" 
                    : "bg-[var(--bg-hover)] text-[var(--text-muted)] border border-[var(--border-color)]"
                )}
              >
                {nodeData.active ? (
                  <><CheckCircle2 className="w-3.5 h-3.5" /> Active</>
                ) : (
                  <><XCircle className="w-3.5 h-3.5" /> Inactive</>
                )}
              </button>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[var(--text-muted)]">Knowledge Title</label>
              <input
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                className="w-full px-3 py-2 bg-[var(--bg-input)] text-[var(--text-primary)] border border-[var(--border-color)] rounded-xl text-xs focus:outline-none focus:border-[var(--border-strong)]"
              />
            </div>

<div className="space-y-2">
              <label className="text-xs font-semibold text-[var(--text-muted)]">Base Website URL</label>
              <input
                type="url"
                value={urls[0] || ''}
                onChange={e => setUrls([e.target.value, ...urls.slice(1)])}
                placeholder="https://cititex.com"
                className="w-full px-3 py-2 bg-[var(--bg-input)] text-[var(--text-primary)] border border-[var(--border-color)] rounded-xl text-xs focus:outline-none focus:border-[var(--border-strong)]"
              />
              {urls.length > 1 && (
                <div className="text-[10px] text-[var(--text-muted)]">
                  {urls.length - 1} pages discovered from this site (categories, products...)
                </div>
              )}
              <div>
                <label className="text-xs font-semibold text-[var(--text-muted)]">Default City (stock checks)</label>
                <select
                  value={city}
                  onChange={e => setCity(e.target.value)}
                  className="w-full mt-1 px-3 py-2 bg-[var(--bg-input)] text-[var(--text-primary)] border border-[var(--border-color)] rounded-xl text-xs focus:outline-none focus:border-[var(--border-strong)]"
                >
                  <option value="">Not set (ask user / detect)</option>
                  <option value="Medan">Medan</option>
                  <option value="Jakarta">Jakarta</option>
                  <option value="Kedoya">Kedoya</option>
                  <option value="Tebet">Tebet</option>
                  <option value="Buaran">Buaran</option>
                  <option value="Kemang">Kemang</option>
                  <option value="Transyogi">Transyogi</option>
                  <option value="Cempaka Putih">Cempaka Putih</option>
                  <option value="Surabaya">Surabaya</option>
                  <option value="Bandung">Bandung</option>
                  <option value="Semarang">Semarang</option>
                  <option value="Yogyakarta">Yogyakarta</option>
                  <option value="Makassar">Makassar</option>
                  <option value="Palembang">Palembang</option>
                  <option value="Denpasar">Denpasar</option>
                  <option value="Balikpapan">Balikpapan</option>
                </select>
              </div>
              {urls[0] && /^https?:\/\/\S+$/i.test(urls[0].trim()) && (
                <button
                  onClick={handleCompose}
                  disabled={composing}
                  className="px-2.5 py-1.5 rounded-xl text-[10px] font-semibold bg-[var(--text-primary)] text-[var(--bg-app)] hover:opacity-90 disabled:opacity-50 cursor-pointer"
                >
                  {composing ? 'Fetching...' : 'Fetch URL → Draft'}
                </button>
              )}
              {composeError && <div className="text-[10px] text-red-500">{composeError}</div>}
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[var(--text-muted)]">Knowledge Content (Markdown)</label>
              <textarea
                value={content}
                onChange={e => setContent(e.target.value)}
                placeholder="Paste raw data or write notes in Markdown."
                className="w-full h-48 px-3 py-2 bg-[var(--bg-input)] text-[var(--text-primary)] border border-[var(--border-color)] rounded-xl text-xs font-mono focus:outline-none focus:border-[var(--border-strong)] resize-none"
              />
            </div>
          </div>

          {/* Footer Actions */}
          <div className="p-4 border-t border-[var(--border-color)] flex items-center justify-between bg-[var(--bg-panel)] shrink-0">
            <button
              onClick={handleDelete}
              className="p-2 rounded-xl text-red-500 hover:bg-red-500/10 transition-colors cursor-pointer"
              title="Delete Node"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 bg-[var(--text-primary)] text-[var(--bg-app)] text-xs font-semibold rounded-xl hover:opacity-90 disabled:opacity-50 cursor-pointer"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </>
      ) : null}
    </Panel>
  );
}
