import { describe, it, expect } from 'vitest';
import { crmSyncService } from '../crm-sync.service';

/**
 * Le garde d'URL des intégrations « collez votre lien ».
 *
 * Ce n'est pas une validation de confort. L'URL enregistrée ici est appelée
 * toutes les quinze minutes par le cron, DEPUIS notre serveur: une adresse
 * pointant sur le réseau interne transformerait l'intégration en sonde SSRF
 * offerte à n'importe quel client. La vérification a lieu au moment où on
 * l'enregistre, pas au moment où on l'appelle, parce qu'à l'enregistrement on
 * peut encore le dire à l'utilisateur.
 */
describe('validateWebhookUrl', () => {
  it('accepte une URL publique en HTTPS', () => {
    expect(() => crmSyncService.validateWebhookUrl('https://hooks.slack.com/services/T/B/xxx')).not.toThrow();
    expect(() => crmSyncService.validateWebhookUrl('https://hooks.zapier.com/hooks/catch/123/abc/')).not.toThrow();
  });

  it('refuse le HTTP en clair', () => {
    // Le corps porte les coordonnées des appelants: il ne voyage pas en clair.
    expect(() => crmSyncService.validateWebhookUrl('http://hooks.slack.com/x')).toThrow(/HTTPS/);
  });

  it('refuse les cibles internes, sous toutes leurs formes', () => {
    for (const url of [
      'https://localhost/hook',
      'https://127.0.0.1/hook',
      'https://10.0.0.5/hook',
      'https://192.168.1.10/hook',
      'https://172.16.0.1/hook',
      // Le service de métadonnées des hébergeurs: la cible classique, celle
      // qui rend des identifiants d'infrastructure.
      'https://169.254.169.254/latest/meta-data/',
    ]) {
      expect(() => crmSyncService.validateWebhookUrl(url), url).toThrow(/private|internal/i);
    }
  });

  it('refuse ce qui n’est pas une URL', () => {
    expect(() => crmSyncService.validateWebhookUrl('pas une url')).toThrow(/Invalid/);
  });
});
