import { useState } from 'react';
import { Link, useLocation, Outlet } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import {
  LayoutDashboard, Users, Building2, Mail, FileText, Settings, LogOut,
  Menu, X, Bot, Activity, DollarSign, UserCheck, MessageSquare, PhoneCall
} from 'lucide-react';

const navItems = [
  { path: '/admin', icon: LayoutDashboard, label: 'Dashboard' },
  { path: '/admin/prospects', icon: Users, label: 'Prospects' },
  { path: '/admin/clients', icon: Building2, label: 'Clients' },
  { path: '/admin/quotes', icon: FileText, label: 'Devis' },
  { path: '/admin/campaigns', icon: Mail, label: 'Campagnes' },
];

const analyticsItems = [
  { path: '/admin/costs', icon: DollarSign, label: 'Costs' },
  { path: '/admin/retention', icon: UserCheck, label: 'Retention' },
  { path: '/admin/followups', icon: MessageSquare, label: 'Follow-ups' },
  { path: '/admin/phone-validation', icon: PhoneCall, label: 'Validation' },
];

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const location = useLocation();
  const { user, logout } = useAuthStore();

  const isActive = (path: string) => {
    if (path === '/admin') return location.pathname === '/admin';
    return location.pathname.startsWith(path);
  };

  const NavLink = ({ item }: { item: { path: string; icon: any; label: string } }) => {
    const active = isActive(item.path);
    return (
      <Link
        to={item.path}
        className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all ${
          active
            ? 'bg-primary-500/20 text-primary-300'
            : 'text-slate-400 hover:text-white hover:bg-white/5'
        }`}
      >
        <item.icon className="w-5 h-5 flex-shrink-0" />
        {sidebarOpen && <span className="text-sm font-medium">{item.label}</span>}
      </Link>
    );
  };

  return (
    <div className="min-h-screen flex bg-slate-50">
      {/* Sidebar */}
      <aside className={`${sidebarOpen ? 'w-64' : 'w-20'} bg-gradient-to-b from-slate-900 to-slate-800 text-white transition-all duration-300 flex flex-col`}>
        {/* Logo */}
        <div className="p-6 flex items-center gap-3">
          <Bot className="w-8 h-8 text-primary-400 flex-shrink-0" />
          {sidebarOpen && <span className="text-xl font-bold bg-gradient-to-r from-primary-400 to-purple-400 bg-clip-text text-transparent">Qwillio</span>}
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 space-y-1">
          {navItems.map((item) => (
            <NavLink key={item.path} item={item} />
          ))}

          {/* Analytics section */}
          {sidebarOpen && (
            <div className="pt-4 mt-4 border-t border-slate-700">
              <p className="px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Analytics</p>
            </div>
          )}
          {!sidebarOpen && <div className="border-t border-slate-700 my-2" />}
          {analyticsItems.map((item) => (
            <NavLink key={item.path} item={item} />
          ))}
        </nav>

        {/* Settings */}
        <div className="px-3 mb-2">
          <NavLink item={{ path: '/admin/settings', icon: Settings, label: 'Settings' }} />
        </div>

        {/* User */}
        <div className="p-4 border-t border-slate-700">
          {sidebarOpen && (
            <div className="mb-3 text-sm">
              <p className="font-medium text-slate-300">{user?.name}</p>
              <p className="text-slate-500 text-xs">{user?.email}</p>
            </div>
          )}
          <button
            onClick={logout}
            className="flex items-center gap-2 text-slate-400 hover:text-red-400 text-sm transition-colors"
          >
            <LogOut className="w-4 h-4" />
            {sidebarOpen && 'Déconnexion'}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-h-screen">
        {/* Header */}
        <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="text-gray-500 hover:text-gray-700">
            {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
          <div className="flex items-center gap-4">
            <Activity className="w-5 h-5 text-gray-400" />
            <span className="text-sm text-gray-500">Qwillio v2.0</span>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-6 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
