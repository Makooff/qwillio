import { Link } from 'react-router-dom';
import { t } from '../../styles/admin-theme';

export default function AdminNotFound() {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '60vh',
        gap: '1rem',
      }}
    >
      <span style={{ fontSize: '3rem', color: t.textSec, fontWeight: 700 }}>404</span>
      <p style={{ color: t.textSec, fontSize: '1.125rem' }}>Page introuvable</p>
      <Link
        to="/admin"
        style={{
          color: t.brand,
          textDecoration: 'none',
          fontSize: '0.875rem',
          padding: '0.5rem 1rem',
          border: `1px solid ${t.border}`,
          borderRadius: '0.5rem',
          transition: 'background 0.15s',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = t.panelHover)}
        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
      >
        Retour au tableau de bord
      </Link>
    </div>
  );
}
