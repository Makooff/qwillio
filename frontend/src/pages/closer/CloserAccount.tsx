import { useAuthStore } from '../../stores/authStore';
import { Mail, User, Shield, LogOut } from 'lucide-react';
import { pro } from '../../styles/pro-theme';
import { PageHeader, Card, Row } from '../../components/pro/ProBlocks';

export default function CloserAccount() {
  const { user, logout } = useAuthStore();
  const initials =
    user?.name?.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2) ?? 'CL';

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
        <Row icon={LogOut} label="Déconnexion" hint="Se déconnecter de ce compte" onClick={logout} danger />
      </Card>
    </div>
  );
}
