import { useState, useEffect, useRef } from 'react';
import { Panel } from '@xyflow/react';
import { X, Save, Trash2, CheckCircle2, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '../../lib/utils';
import { apiFetch, API_BASE } from '../../lib/api';
import { ALL_CITIES } from '../../lib/cities';

export interface KnowledgeDoc {
  id: string;
  title: string;
  content: string;
  type: string;
  active: boolean;
  positionX: number;
  positionY: number;
  nodeColor: string;
  icon: string;
}

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
  
  const [isCityDropdownOpen, setIsCityDropdownOpen] = useState(false);
  const cityDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (cityDropdownRef.current && !cityDropdownRef.current.contains(event.target as Node)) {
        setIsCityDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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
        toast.success("Knowledge node saved successfully!");
        onClose();
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error?.message || "Failed to save node");
      }
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || "Failed to save node");
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
        toast.success("Knowledge node deleted");
      } else {
        toast.error("Failed to delete node");
      }
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || "Failed to delete node");
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
        toast.success(data.active ? "Node activated for AI" : "Node deactivated");
      }
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || "Failed to toggle status");
    }
  };

  if (!nodeId || nodeId === 'main-ai-node') {
    return null;
  }

  return (
    <Panel 
      position="top-right" 
      onMouseDown={(e) => e.stopPropagation()} 
      onClick={(e) => e.stopPropagation()} 
      className="max-h-[calc(100vh-8rem)] w-80 mt-4 mr-4 bg-[var(--bg-card)] dark:bg-[#141416] text-[var(--text-primary)] rounded-2xl border border-[var(--border-strong)] dark:border-[#2e2e35] flex flex-col overflow-hidden pointer-events-auto shadow-2xl z-50"
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-[var(--border-color)] dark:border-[#222226] bg-[var(--bg-panel)] dark:bg-[#18181b] shrink-0">
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
                    ? "bg-[var(--text-primary)] text-[var(--bg-card)] border border-[var(--text-primary)]" 
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
                placeholder="https://example.com"
                className="w-full px-3 py-2 bg-[var(--bg-input)] text-[var(--text-primary)] border border-[var(--border-color)] rounded-xl text-xs focus:outline-none focus:border-[var(--border-strong)]"
              />
              {urls.length > 1 && (
                <div className="text-[10px] text-[var(--text-muted)]">
                  {urls.length - 1} pages discovered from this site (categories, products...)
                </div>
              )}
              <div className="relative" ref={cityDropdownRef}>
                <label className="text-xs font-semibold text-[var(--text-muted)] block mb-1">
                  Location / Branch (Optional)
                </label>
                <input
                  type="text"
                  value={city}
                  onChange={(e) => {
                    setCity(e.target.value);
                    setIsCityDropdownOpen(true);
                  }}
                  onFocus={() => setIsCityDropdownOpen(true)}
                  placeholder="e.g. Jakarta, New York, Warehouse B..."
                  className="w-full px-3 py-2 bg-[var(--bg-input)] text-[var(--text-primary)] border border-[var(--border-color)] rounded-xl text-xs focus:outline-none focus:border-[var(--border-strong)]"
                />
                
                {isCityDropdownOpen && city && ALL_CITIES.filter(c => c.toLowerCase().includes(city.toLowerCase())).length > 0 && (
                  <div className="absolute left-0 top-full mt-1.5 w-full max-h-40 overflow-y-auto rounded-xl bg-[var(--bg-card)] border border-[var(--border-strong)] shadow-2xl p-1.5 space-y-0.5 z-50 animate-in fade-in duration-100">
                    {ALL_CITIES.filter(c => c.toLowerCase().includes(city.toLowerCase()))
                      .slice(0, 7) // Only show top 7 to keep it small
                      .map((opt) => (
                        <button
                          key={opt}
                          type="button"
                          onClick={() => {
                            setCity(opt);
                            setIsCityDropdownOpen(false);
                          }}
                          className="w-full text-left px-3 py-1.5 rounded-lg text-xs flex items-center justify-between cursor-pointer transition-colors text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]"
                        >
                          <span className="truncate">{opt}</span>
                        </button>
                      ))}
                  </div>
                )}
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
              className="flex items-center gap-2 px-4 py-2 bg-[var(--text-primary)] text-[var(--bg-app)] text-xs font-semibold rounded-xl hover:opacity-90 disabled:opacity-50 cursor-pointer transition-opacity"
            >
              <Save className="w-4 h-4" />
              <span>{saving ? 'Saving...' : 'Save'}</span>
            </button>
          </div>
        </>
      ) : null}
    </Panel>
  );
}
