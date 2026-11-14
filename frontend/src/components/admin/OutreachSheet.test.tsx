import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

const apiMock = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock('../../services/api', () => ({ default: apiMock }));

import OutreachSheet from './OutreachSheet';

const templates = [
  { id: 'dernier', channel: 'email', label: 'Dernier message', when: 'Huit jours après.', fields: [] },
  { id: 'sms_rdv', channel: 'sms', label: 'Rendez-vous confirmé', when: 'Pendant l’appel.', fields: [{ key: 'jour', label: 'Jour et heure', required: true }] },
];
const lead = { id: 'p1', businessName: 'Plomberie Dubois', email: 'info@plomberie.be', phone: '+32470998877' };

function preview(channel: string) {
  return channel === 'sms'
    ? { ok: true, rendered: { channel: 'sms', body: 'Bonjour, je confirme.', segments: 1 }, recipient: { to: '+32470998877', problem: null, consentRequired: true } }
    : { ok: true, rendered: { channel: 'email', subject: 'Je vous laisse tranquille', html: '<p>Bonjour</p>' }, recipient: { to: 'info@plomberie.be', problem: null, consentRequired: false, kind: 'generic' } };
}

beforeEach(() => {
  vi.clearAllMocks();
  window.localStorage.setItem('qwillio.outreach.sender', JSON.stringify({ prenom: 'Matthieu', nom: '', telephone: '', lienVideo: '' }));
  apiMock.get.mockResolvedValue({ data: { templates, sms: { ok: true, missing: [] } } });
  apiMock.post.mockImplementation((url: string, body: any) =>
    Promise.resolve({ data: url.endsWith('/send') ? { ok: true, to: body.to } : preview(body.channel) }));
});

afterEach(cleanup);

describe('OutreachSheet', () => {
  it('envoie le mail de la fiche en un clic, vers l’adresse de la fiche', async () => {
    const onSent = vi.fn();
    render(<OutreachSheet open onClose={() => {}} target={lead} channel="email" onSent={onSent} onError={() => {}} />);
    const send = await screen.findByRole('button', { name: /Envoyer le mail/ });
    await waitFor(() => expect(send).not.toBeDisabled());
    fireEvent.click(send);
    await waitFor(() => expect(onSent).toHaveBeenCalled());
    const [, body] = apiMock.post.mock.calls.find(([url]) => String(url).endsWith('/send'))!;
    expect(body).toMatchObject({ channel: 'email', templateId: 'dernier', prospectId: 'p1', to: 'info@plomberie.be' });
  });

  it('ne laisse pas partir un SMS tant que l’accord n’est pas coché', async () => {
    render(<OutreachSheet open onClose={() => {}} target={lead} channel="sms" onSent={() => {}} onError={() => {}} />);
    const send = await screen.findByRole('button', { name: /Envoyer le SMS/ });
    const accord = await screen.findByRole('checkbox');
    expect(send).toBeDisabled();
    fireEvent.click(accord);
    await waitFor(() => expect(send).not.toBeDisabled());
    fireEvent.click(send);
    await waitFor(() => expect(apiMock.post.mock.calls.some(([url, b]) => String(url).endsWith('/send') && b.accord === true)).toBe(true));
  });

  it('accepte un destinataire saisi à la main et retire l’accord déjà coché', async () => {
    render(<OutreachSheet open onClose={() => {}} target={null} channel="sms" onSent={() => {}} onError={() => {}} />);
    const to = await screen.findByLabelText('Numéro du destinataire');
    fireEvent.change(to, { target: { value: '0470 11 22 33' } });
    const accord = await screen.findByRole('checkbox');
    fireEvent.click(accord);
    expect(accord).toBeChecked();
    fireEvent.change(to, { target: { value: '0470 11 22 34' } });
    await waitFor(() => expect(screen.getByRole('checkbox')).not.toBeChecked());
  });
});
