import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import '@testing-library/jest-dom/vitest';
import ClientAccount from './ClientAccount';

const { get, put, fetchLive, invalidateLive } = vi.hoisted(() => ({
  get: vi.fn(), put: vi.fn(), fetchLive: vi.fn(), invalidateLive: vi.fn(),
}));
vi.mock('../../services/api', () => ({ default: { get, put } }));
vi.mock('../../services/liveData', () => ({ fetchLive, invalidateLive }));
vi.mock('../../stores/authStore', () => ({
  useAuthStore: () => ({ user: { name: 'Compte test', email: 'test@example.test' }, checkAuth: vi.fn(), logout: vi.fn() }),
}));

const notifications = { notifEmail: false, notifSms: true, notifWeekly: true, notifLeads: true, notifQuota: true };
const settings = { recordCalls: false, vapiConfig: { notifications } };
const recording = () => screen.getByRole('switch', { name: 'Enregistrement des appels' });
const mount = () => render(<MemoryRouter><ClientAccount /></MemoryRouter>);
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubGlobal('scrollTo', vi.fn());
  fetchLive.mockResolvedValue(settings);
  put.mockResolvedValue({ data: { success: true } });
  get.mockImplementation((path: string) => Promise.resolve({ data: path === '/my-dashboard/retention'
    ? { retentionDays: 90, defaultDays: 90, recordCalls: true } : settings }));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('ClientAccount boolean settings', () => {
  it('should show an unavailable neutral switch while the settings are loading, not a default enabled value', async () => {
    const pending = deferred<typeof settings>();
    fetchLive.mockReturnValueOnce(pending.promise);
    mount();
    expect(recording()).toBeDisabled();
    expect(recording()).not.toBeChecked();
    expect(screen.getByText('Chargement…')).toBeInTheDocument();
    expect(screen.queryByText(/Activé, vos appels/)).not.toBeInTheDocument();
    await act(async () => pending.resolve(settings));
    expect(recording()).toBeEnabled();
    expect(recording()).not.toBeChecked();
    expect(screen.getByText('Désactivé')).toBeInTheDocument();
  });

  it.each([true, false])('should read persisted recording=%s directly from settings before opening any drawer', async (value) => {
    fetchLive.mockResolvedValue({ ...settings, recordCalls: value });
    mount();
    await waitFor(() => expect(recording()).toBeEnabled());
    expect(recording()).toHaveAttribute('aria-checked', String(value));
    expect(screen.getByText(value ? 'Activé' : 'Désactivé')).toBeInTheDocument();
  });

  it('should not mutate recording when clicking its text or surrounding row', async () => {
    mount();
    await waitFor(() => expect(recording()).toBeEnabled());
    const label = screen.getByText('Enregistrement des appels');
    fireEvent.click(label);
    fireEvent.click(label.parentElement!);
    expect(put).not.toHaveBeenCalled();
    expect(recording()).not.toBeChecked();
    expect(label.closest('button')).toBeNull();
  });

  it('should save only via the switch, block repeated clicks while pending, and read back the persisted value', async () => {
    const pending = deferred<{ data: { success: boolean } }>();
    put.mockReturnValueOnce(pending.promise);
    mount();
    await waitFor(() => expect(recording()).toBeEnabled());
    get.mockResolvedValue({ data: { ...settings, recordCalls: true } });
    fireEvent.click(recording());
    expect(recording()).toBeDisabled();
    expect(recording()).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByText('Enregistrement…')).toBeInTheDocument();
    fireEvent.click(recording());
    expect(put).toHaveBeenCalledTimes(1);
    expect(put).toHaveBeenCalledWith('/my-dashboard/settings', { recordCalls: true });
    await act(async () => pending.resolve({ data: { success: true } }));
    await waitFor(() => expect(recording()).toBeEnabled());
    expect(get).toHaveBeenLastCalledWith('/my-dashboard/settings');
    expect(invalidateLive).toHaveBeenCalledWith('/my-dashboard/');
    expect(recording()).toBeChecked();
    expect(screen.getByText('Activé')).toBeInTheDocument();
  });

  it('should display the server value rather than the requested value after saving', async () => {
    mount();
    await waitFor(() => expect(recording()).toBeEnabled());
    fireEvent.click(recording());
    await waitFor(() => expect(put).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(recording()).toBeEnabled());
    expect(recording()).not.toBeChecked();
  });

  it('should roll back and retain a visible error if saving fails', async () => {
    put.mockRejectedValueOnce({ response: { status: 422, data: { error: 'Enregistrement refusé par le serveur' } } });
    mount();
    await waitFor(() => expect(recording()).toBeEnabled());
    fireEvent.click(recording());
    expect(await screen.findByRole('alert')).toHaveTextContent('Enregistrement refusé par le serveur');
    expect(recording()).not.toBeChecked();
    expect(recording()).toBeEnabled();
    fireEvent.click(screen.getByText('Enregistrement des appels'));
    expect(screen.getByRole('alert')).toHaveTextContent('Enregistrement refusé par le serveur');
  });

  it('should show an error and disable recording if the initial settings request fails', async () => {
    fetchLive.mockRejectedValueOnce(new Error('offline'));
    mount();
    expect(await screen.findByRole('alert')).toHaveTextContent(/chargés/);
    expect(recording()).toBeDisabled();
    expect(screen.getByText('Indisponible')).toBeInTheDocument();
    expect(put).not.toHaveBeenCalled();
  });

  it('should not infer enabled recording when the server omits the boolean', async () => {
    fetchLive.mockResolvedValue({ vapiConfig: {} });
    mount();
    expect(await screen.findByRole('alert')).toHaveTextContent(/enregistrement/i);
    expect(recording()).toBeDisabled();
  });

  it('should not let opening retention overwrite the settings recording value', async () => {
    mount();
    await waitFor(() => expect(recording()).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: /Conservation des données/ }));
    await waitFor(() => expect(get).toHaveBeenCalledWith('/my-dashboard/retention'));
    expect(recording()).not.toBeChecked();
  });

  it('should support keyboard activation with a stable accessible name', async () => {
    const user = userEvent.setup();
    mount();
    await waitFor(() => expect(recording()).toBeEnabled());
    recording().focus();
    await user.keyboard(' ');
    await waitFor(() => expect(put).toHaveBeenCalledWith('/my-dashboard/settings', { recordCalls: true }));
    expect(recording()).toHaveAccessibleName('Enregistrement des appels');
  });

  it('should stay disabled until read-back finishes, then mark the recording state unknown if confirmation fails', async () => {
    const confirmation = deferred<typeof settings>();
    mount();
    await waitFor(() => expect(recording()).toBeEnabled());
    get.mockReturnValueOnce(confirmation.promise.then(data => ({ data })));
    fireEvent.click(recording());
    await waitFor(() => expect(get).toHaveBeenLastCalledWith('/my-dashboard/settings'));
    expect(recording()).toBeDisabled();
    fireEvent.click(recording());
    expect(put).toHaveBeenCalledTimes(1);
    await act(async () => confirmation.reject(new Error('offline')));
    expect(screen.getByRole('alert')).toHaveTextContent(/confirmé/);
    expect(recording()).not.toBeChecked();
    expect(recording()).toBeDisabled();
    expect(screen.getByText('Indisponible')).toBeInTheDocument();
  });

  it('should mark recording unknown after an ambiguous transport failure rather than falsely claiming it is disabled', async () => {
    put.mockRejectedValueOnce(new Error('Network Error'));
    mount();
    await waitFor(() => expect(recording()).toBeEnabled());
    fireEvent.click(recording());
    expect(await screen.findByRole('alert')).toHaveTextContent(/Rechargez/);
    expect(recording()).toBeDisabled();
    expect(screen.getByText('Indisponible')).toBeInTheDocument();
    expect(put).toHaveBeenCalledTimes(1);
  });

  it('should disable all notification switches and hide unconfirmed defaults while settings load', async () => {
    const pending = deferred<typeof settings>();
    fetchLive.mockReturnValueOnce(pending.promise);
    mount();
    fireEvent.click(screen.getByRole('button', { name: /Notifications Emails/ }));
    const switches = screen.getAllByRole('switch');
    expect(switches).toHaveLength(6);
    switches.forEach(control => { expect(control).toBeDisabled(); expect(control).not.toBeChecked(); });
    await act(async () => pending.resolve(settings));
    expect(screen.getByRole('switch', { name: 'Notifications SMS' })).toBeChecked();
  });

  it('should restore notification state and show the server error if saving fails', async () => {
    put.mockRejectedValueOnce({ response: { data: { error: 'Notifications refusées' } } });
    mount();
    await waitFor(() => expect(recording()).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: /Notifications Emails/ }));
    const email = screen.getByRole('switch', { name: 'Notifications email' });
    fireEvent.click(email);
    expect(await screen.findByRole('alert')).toHaveTextContent('Notifications refusées');
    expect(email).not.toBeChecked();
    expect(email).toBeEnabled();
    expect(screen.getByRole('switch', { name: 'Notifications SMS' })).toBeChecked();
  });

  it('should give notification switches accessible names, explicit states and pending protection', async () => {
    const pending = deferred<{ data: { success: boolean } }>();
    put.mockReturnValueOnce(pending.promise);
    mount();
    await waitFor(() => expect(recording()).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: /Notifications Emails/ }));
    const email = screen.getByRole('switch', { name: 'Notifications email' });
    expect(email).not.toBeChecked();
    expect(screen.getAllByRole('switch')).toHaveLength(6);
    expect(within(email.parentElement!).getByText('Désactivé')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Notifications email'));
    expect(put).not.toHaveBeenCalled();
    get.mockResolvedValue({ data: { ...settings, vapiConfig: { notifications: { ...notifications, notifEmail: true } } } });
    fireEvent.click(email);
    expect(email).toBeDisabled();
    fireEvent.click(email);
    expect(put).toHaveBeenCalledTimes(1);
    await act(async () => pending.resolve({ data: { success: true } }));
    await waitFor(() => expect(email).toBeEnabled());
    expect(email).toBeChecked();
  });
});
