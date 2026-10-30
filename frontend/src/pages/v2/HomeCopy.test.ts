import { describe, expect, it } from 'vitest';
import source from './Home.tsx?raw';
import shell from '../../components/v2/PublicShell.tsx?raw';
import footer from '../../components/v2/FooterV2.tsx?raw';

describe('Homepage — original identity with explanatory illustrations', () => {
  it('replaces landscape and screenshots while keeping navigation and demo flows', () => {
    expect(source).toContain('<HeroBackdrop dark />');
    expect(source).toContain('<ProductIllustration kind="overview"');
    expect(source).toContain('<BenefitsGrid isFr={isFr} />');
    expect(source).toContain('<LaunchSteps isFr={isFr} />');
    expect(source).toContain('<EcosystemMosaic isFr={isFr} />');
    expect(source).toContain('<CircularReceptionists isFr={isFr} />');
    expect(source).not.toContain('HeroDashboardShot');

    expect(source).not.toContain('<HeroPhone3D');
    expect(source).toContain('<SqueezeCarousel');
    expect(source).toContain('<TryVoiceButton variant="outline">');
    expect(source).not.toContain('home-marketing.css');
    expect(shell).not.toContain('qm-public-light');
  });
  it('keeps both feature lists text-only and puts imagery in independent sections', () => {
    const during = source.split('aria-labelledby="during-heading"')[1].split('aria-labelledby="team-heading"')[0];
    const setup = source.split('aria-labelledby="setup-heading"')[1].split('<LaunchSteps')[0];
    expect(during).not.toContain('<ProductIllustration');
    expect(setup).not.toContain('<ProductIllustration');
    expect(during).not.toContain('<img');
    expect(setup).not.toContain('<img');
    expect(source).toContain('<BenefitsGrid isFr={isFr} />');
    expect(source).toContain('<LaunchSteps isFr={isFr} />');
    expect(source).toContain('<EcosystemMosaic isFr={isFr} />');
  });
  it('preserves all three original setup features while keeping their list text-only', () => {
    const setupItems = source.split('const setup = [')[1].split('];')[0];
    expect(setupItems.match(/icon:/g)).toHaveLength(3);
    expect(setupItems).toContain('Appelez-la pour l’essayer');
    expect(setupItems).toContain('Call her to try her out');
  });
  it('omits the trial/card tagline beneath the hero CTA as requested', () => {
    expect(source).not.toContain('7 jours d’essai · Carte bancaire requise');
    expect(source).not.toContain('7-day trial · Card required');
  });
  it('uses concrete guidance instead of defensive infancy copy', () => {
    expect(source).not.toContain('Qwillio est jeune');
    expect(source).not.toContain('faux avis');
    expect(source).not.toContain('Qwillio is young');
    expect(source).toContain('Testez la voix');
  });
  it('names both verified connected calendar providers', () => {
    expect(source).toContain('Google ou Outlook');
    expect(source).toContain('Google or Outlook');
    expect(source).toContain('agenda Google ou Outlook connecté');
  });
  it('localizes footer labels without changing its original tagline', () => {
    expect(footer).toContain("isFr ? 'Informations légales' : 'Legal'");
    expect(footer).toContain("isFr ? 'RGPD' : 'GDPR'");
    expect(footer).toContain("L'IA qui ne dort jamais.");
  });
});
