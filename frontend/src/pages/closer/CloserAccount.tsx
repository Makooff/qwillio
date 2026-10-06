import { useAuthStore } from '../../stores/authStore';
import { Mail, User, Shield, LogOut } from '../../components/icons';
import { pro } from '../../styles/pro-theme';
import { PageHeader, Card, Row } from '../../components/pro/ProBlocks';

export default function CloserAccount() {
  const { user, logout } = useAuthStore();
  const initials =
    user?.name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) ?? 'CL';

  return (
    <div className="space-y-5 max-w-[720px]">
      <PageHeader title="Compte" subtitle="Vos informations" />

      <Card>
        <div className="p-5 flex items-center gap-4">
          <div className="w-14 h-14 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: `${pro.accent}30` }}>
            <span className="text-[16px] font-bold" style={{ color: pro.accent }}>{initials}</span>
          </div>
          <div className="min-w-0">
            <p className="text-[15px] font-semibold" style={{ color: pro.text }}>{user?.name ?? 'Closeuse'}</p>
            <p className="text-[12px] truncate" style={{ color: pro.textSec }}>{user?.email}</p>
            <p className="text-[10.5px] mt-1 font-semibold uppercase tracking-wider" style={{ color: pro.accent }}>
              Closeuse
            </p>
          </div>
        </div>
      </Card>

      <Card>
        <Row icon={User}   label="Nom"   hint={user?.name || '—'} />
        <div style={{ borderTop: `1px solid ${pro.border}` }}>
          <Row icon={Mail}   label="Email" hint={user?.email || '—'} />
        </div>
        <div style={{ borderTop: `1px solid ${pro.border}` }}>
          <Row icon={Shield} label="Rôle"  hint="Accès restreint aux prospects" />
        </div>
      </Card>

      <Card>
        <button
          type="button"
          onClick={logout}
          className="w-full flex items-center gap-3.5 px-4 h-[58px] rounded-full text-left transition-colors hover:bg-red-500/[0.05]"
        >
          <span className="w-8 h-8 flex items-center justify-center flex-shrink-0 rounded-full" style={{ background: 'rgba(239,68,68,0.08)' }}>
            <LogOut size={14} style={{ color: pro.bad }} />
          </span>
          <span className="flex-1 min-w-0">
            <span className="block text-[13px] font-medium" style={{ color: pro.bad }}>Déconnexion</span>
            <span className="block text-[11.5px] truncate" style={{ color: pro.textTer }}>Se déconnecter de ce compte</span>
          </span>
        </button>
      </Card>
    </div>
  );
}
