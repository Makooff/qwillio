import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import StatusBadge from './StatusBadge';
import { t } from '../../styles/admin-theme';

afterEach(cleanup);

describe('StatusBadge (design system)', () => {
  it('maps semantic statuses to their token color', () => {
    render(<StatusBadge status="converted" />);
    expect(screen.getByText('converted')).toHaveStyle({ color: t.success });
  });

  it('maps danger statuses to the danger token', () => {
    render(<StatusBadge status="cancelled" />);
    expect(screen.getByText('cancelled')).toHaveStyle({ color: t.danger });
  });

  it('falls back to a neutral wash for unknown statuses', () => {
    render(<StatusBadge status="weird-state" />);
    const badge = screen.getByText('weird-state');
    expect(badge).toHaveStyle({ color: t.textSec, background: 'rgba(255, 255, 255, 0.06)' });
  });

  it('md size increases padding', () => {
    render(<StatusBadge status="active" size="md" />);
    expect(screen.getByText('active')).toHaveStyle({ padding: '4px 12px' });
  });
});
