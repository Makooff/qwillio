import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import TabSysteme from './TabSysteme';
import TabLogs from './TabLogs';

// Rendered inactive so the data-fetch effects short-circuit (no API needed).
// Verifies the extracted tab components mount and render their static shell.
afterEach(cleanup);

describe('TabSysteme', () => {
  it('renders the services grid and cron list when inactive', () => {
    const { container } = render(<TabSysteme active={false} />);
    expect(container.textContent).toContain('Services');
    expect(container.textContent).toContain('Cron Jobs');
    expect(container.textContent).toContain('VAPI');
  });
});

describe('TabLogs', () => {
  it('renders the empty state when inactive', () => {
    const { container } = render(<TabLogs active={false} />);
    expect(container.textContent).toContain('Logs');
    expect(container.textContent).toContain('Aucun log');
  });
});
