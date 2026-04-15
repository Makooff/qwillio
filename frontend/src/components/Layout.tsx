import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

const TABS = [
  { path: '/admin', label: 'Accueil', svg: 'M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z' },
  { path: '/admin/prospects', label: 'Prospects', svg: 'M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z' },
  { path: '/admin/calls', label: 'Appels', svg: 'M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1-9.4 0-17-7.6-17-17 0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1L6.6 10.8z' },
  { path: '/admin/clients', label: 'Clients', svg: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z' },
  { path: '/admin/billing', label: 'Finance', svg: 'M11.8 10.9c-2.27-.59-3-1.2-3-2.15 0-1.09 1.01-1.85 2.7-1.85 1.78 0 2.44.85 2.5 2.1h2.21c-.07-1.72-1.12-3.3-3.21-3.81V3h-3v2.16c-1.94.42-3.5 1.68-3.5 3.61 0 2.31 1.91 3.46 4.7 4.13 2.5.6 3 1.48 3 2.41 0 .69-.49 1.79-2.7 1.79-2.06 0-2.87-.92-2.98-2.1h-2.2c.12 2.19 1.76 3.42 3.68 3.83V21h3v-2.15c1.95-.37 3.5-1.5 3.5-3.55 0-2.84-2.43-3.81-4.7-4.4z' },
];

interface LayoutProps { children: React.ReactNode; }

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const nav = useNavigate();
  const loc = useLocation();
  return (
    <div style={{ background: '#0a0a0a', minHeight: '100vh', fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif', position: 'relative' }}>
      <style>{`
        * { -webkit-tap-highlight-color: transparent; box-sizing: border-box; }
        ::-webkit-scrollbar { width: 0; }
      `}</style>
      <div style={{ position: 'fixed', top: 0, left: 0, right: 0, height: 80, background: 'linear-gradient(to bottom, #0a0a0a 0%, transparent 100%)', zIndex: 30, pointerEvents: 'none' }} />
      <div style={{ position: 'fixed', bottom: 68, left: 0, right: 0, height: 80, background: 'linear-gradient(to top, #0a0a0a 0%, transparent 100%)', zIndex: 30, pointerEvents: 'none' }} />
      <div style={{ paddingBottom: 88 }}>{children}</div>
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, height: 76, background: 'rgba(12,12,12,0.95)', backdropFilter: 'blur(20px)', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-around', padding: '0 8px 8px', zIndex: 40 }}>
        {TABS.map(tab => {
          const active = tab.path === '/admin' ? loc.pathname === '/admin' || loc.pathname === '/admin/' : loc.pathname.startsWith(tab.path);
          return (
            <button key={tab.path} onClick={() => nav(tab.path)} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, padding: '6px 12px', borderRadius: 14, border: 'none', cursor: 'pointer', background: active ? 'rgba(139,92,246,0.15)' : 'transparent', transition: 'all 0.2s ease', minWidth: 56 }}>
              <svg width='22' height='22' viewBox='0 0 24 24' fill={active ? '#8B5CF6' : 'rgba(255,255,255,0.3)'}><path d={tab.svg} /></svg>
              <span style={{ fontSize: 10, fontWeight: active ? 600 : 400, color: active ? '#8B5CF6' : 'rgba(255,255,255,0.3)' }}>{tab.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default Layout;