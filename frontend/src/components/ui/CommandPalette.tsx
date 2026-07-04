import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, X, LayoutDashboard, Users, Phone, TrendingUp, Settings, BarChart3, Bot, Zap, FileText } from 'lucide-react';

const COMMANDS = [
  { label: 'Dashboard', path: '/admin', icon: LayoutDashboard, shortcut: 'G O' },
  { label: 'Clients', path: '/admin/clients', icon: Users, shortcut: 'G C' },
  { label: 'Prospects', path: '/admin/prospects', icon: TrendingUp, shortcut: 'G P' },
  { label: 'Calls', path: '/admin/calls', icon: Phone, shortcut: 'G A' },
  { label: 'Leads', path: '/admin/leads', icon: Zap, shortcut: 'G L' },
  { label: 'Billing', path: '/admin/billing', icon: FileText, shortcut: 'G B' },
  { label: 'AI Learning', path: '/admin/ai-learning', icon: Bot },
  { label: 'AI Decisions', path: '/admin/ai-decisions', icon: Bot },
  { label: 'Prospecting', path: '/admin/prospecting', icon: BarChart3 },
  { label: 'Settings', path: '/admin/settings', icon: Settings },
  { label: 'System', path: '/admin/system', icon: Settings },
  { label: 'Monitor', path: '/admin/monitor', icon: BarChart3 },
  { label: 'Logs', path: '/admin/logs', icon: FileText },
];

export default function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [query, setQuery] = useState('');
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const filtered = COMMANDS.filter(c => c.label.toLowerCase().includes(query.toLowerCase()));

  useEffect(() => {
    if (open) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  useEffect(() => { setSelectedIndex(0); }, [query]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIndex(i => Math.min(i + 1, filtered.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedIndex(i => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter' && filtered[selectedIndex]) { navigate(filtered[selectedIndex].path); onClose(); }
    else if (e.key === 'Escape') onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[20vh]" onClick={onClose}>
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" />
      <div className="relative w-full max-w-lg bg-[#1A1A2E] border border-white/10 rounded-2xl shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3 px-4 py-3 border-b border-white/10">
          <Search className="w-5 h-5 text-[#8B8BA7]" />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search pages..."
            className="flex-1 bg-transparent text-[#F8F8FF] text-sm outline-none placeholder:text-[#8B8BA7]"
          />
          <button onClick={onClose} className="text-[#8B8BA7] hover:text-white"><X className="w-4 h-4" /></button>
        </div>
        <div className="max-h-72 overflow-y-auto py-2">
          {filtered.length === 0 && <div className="px-4 py-6 text-center text-sm text-[#8B8BA7]">No results</div>}
          {filtered.map((cmd, i) => {
            const Icon = cmd.icon;
            return (
              <button
                key={cmd.path}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${i === selectedIndex ? 'bg-[#7B5CF0]/20 text-white' : 'text-[#C0C0D0] hover:bg-white/5'}`}
                onClick={() => { navigate(cmd.path); onClose(); }}
                onMouseEnter={() => setSelectedIndex(i)}
              >
                <Icon className="w-4 h-4 text-[#8B8BA7]" />
                <span className="flex-1 text-left">{cmd.label}</span>
                {cmd.shortcut && <span className="text-xs text-[#8B8BA7] font-mono">{cmd.shortcut}</span>}
              </button>
            );
          })}
        </div>
        <div className="px-4 py-2 border-t border-white/10 flex items-center gap-4 text-xs text-[#8B8BA7]">
          <span>↑↓ navigate</span><span>↵ select</span><span>esc close</span>
        </div>
      </div>
    </div>
  );
}
