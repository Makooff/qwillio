import { describe, it, expect } from 'vitest';
import {
  OUTREACH_SENDERS, OUTREACH_TEMPLATES, OutreachError, addressKind, fromHeader, renderOutreach, resolveSenderAddress,
  safeLink, smsSegments, toGsm,
} from '../outreach-templates';

const sender = { prenom: 'Matthieu', nom: 'Dupont', telephone: '+32 470 12 34 56', lienVideo: 'https://youtu.be/abc' };

/** Des valeurs plausibles pour chaque champ, afin de rendre TOUS les modèles. */
function sampleVars(id: string): Record<string, string> {
  const t = OUTREACH_TEMPLATES.find(x => x.id === id)!;
  return Object.fromEntries(t.fields.map(f => [f.key, f.placeholder || 'Bonjour, ceci est un essai.']));
}

describe('le catalogue', () => {
  it('rend chaque modèle sans lever', () => {
    for (const t of OUTREACH_TEMPLATES) {
      const out = renderOutreach({ templateId: t.id, vars: sampleVars(t.id), sender });
      expect(out.channel).toBe(t.channel);
    }
  });

  it('ne porte aucune des phrases interdites par les playbooks', () => {
    const banned = [/hébergé en europe/i, /bilingue/i, /aussi bien qu'un humain/i, /\b\d+ ?% des appels/i, /—/];
    for (const t of OUTREACH_TEMPLATES) {
      const out = renderOutreach({ templateId: t.id, vars: sampleVars(t.id), sender });
      const text = out.channel === 'email' ? `${out.subject}\n${out.text}` : out.body;
      for (const re of banned) expect(text, `${t.id} contre ${re}`).not.toMatch(re);
    }
  });

  it('donne à chaque mail une sortie explicite', () => {
    for (const t of OUTREACH_TEMPLATES.filter(x => x.channel === 'email')) {
      const out = renderOutreach({ templateId: t.id, vars: sampleVars(t.id), sender });
      if (out.channel !== 'email') throw new Error('unreachable');
      expect(out.html).toContain('répondez « stop »');
      expect(out.text).toContain('répondez « stop »');
    }
  });
});

describe('les refus', () => {
  it('nomme le champ manquant', () => {
    try {
      renderOutreach({ templateId: 'appel_manque', vars: {}, sender });
      throw new Error('aurait dû lever');
    } catch (e) {
      expect(e).toBeInstanceOf(OutreachError);
      expect((e as OutreachError).code).toBe('missing_field');
      expect((e as OutreachError).field).toBe('heure');
    }
  });

  it('refuse un modèle vidéo sans lien, et un lien qui n\'est pas en https', () => {
    for (const lienVideo of ['', 'javascript:alert(1)', 'http://exemple.be/v']) {
      expect(() => renderOutreach({ templateId: 'appel_manque', vars: { heure: '14 h' }, sender: { ...sender, lienVideo } }))
        .toThrowError('missing_video');
    }
    expect(safeLink('https://youtu.be/abc')).toBe('https://youtu.be/abc');
  });

  it('refuse un expéditeur sans prénom', () => {
    expect(() => renderOutreach({ templateId: 'dernier', vars: {}, sender: { prenom: ' ' } })).toThrowError('missing_sender');
  });
});

describe('le HTML', () => {
  it('échappe ce qui vient d\'un champ de saisie', () => {
    const out = renderOutreach({
      templateId: 'libre',
      vars: { objet: 'Test <b>', message: '<script>alert(1)</script>\n\n<img src=x onerror=1>' },
      sender: { prenom: '<i>Matt</i>' },
    });
    if (out.channel !== 'email') throw new Error('unreachable');
    expect(out.html).not.toContain('<script>');
    expect(out.html).not.toContain('<img src=x');
    expect(out.html).not.toContain('<i>Matt</i>');
    expect(out.html).toContain('&lt;script&gt;');
  });
});

describe('les SMS', () => {
  it('restent en alphabet GSM, donc sur un seul segment pour un texte court', () => {
    for (const t of OUTREACH_TEMPLATES.filter(x => x.channel === 'sms')) {
      const out = renderOutreach({ templateId: t.id, vars: sampleVars(t.id), sender });
      if (out.channel !== 'sms') throw new Error('unreachable');
      expect(out.body, t.id).toMatch(/^[\x20-\x7E]+$/);
      expect(out.segments, t.id).toBe(1);
    }
  });

  it('convertit le texte libre accentué', () => {
    expect(toGsm('À bientôt, « ça » coûte 99 €…')).toBe('A bientot, "ca" coute 99 EUR...');
  });

  it('compte les segments comme l\'opérateur', () => {
    expect(smsSegments('a'.repeat(160))).toBe(1);
    expect(smsSegments('a'.repeat(161))).toBe(2);
    expect(smsSegments('a'.repeat(307))).toBe(3);
  });
});

describe('le type d\'adresse', () => {
  it('distingue une adresse générale d\'une adresse nominative', () => {
    expect(addressKind('info@plomberie-dupont.be')).toBe('generic');
    expect(addressKind('Contact@garage.be')).toBe('generic');
    expect(addressKind('jean.dupont@gmail.com')).toBe('personal');
    expect(addressKind('plomberiedupont@gmail.com')).toBe('personal');
  });
});

describe('l\'adresse d\'envoi', () => {
  it('ne propose que des adresses du domaine où l\'on peut répondre', () => {
    for (const o of OUTREACH_SENDERS) expect(o.address).toMatch(/^[a-z]+@qwillio\.com$/);
    expect(OUTREACH_SENDERS.map(o => o.key)).not.toContain('noreply');
  });

  it('retombe sur l\'adresse du modèle pour une clé inconnue', () => {
    expect(resolveSenderAddress('apporteur', 'nimporte')).toEqual({ key: 'partenaires', address: 'partenaires@qwillio.com' });
    expect(resolveSenderAddress('dernier', null)).toEqual({ key: 'hello', address: 'hello@qwillio.com' });
    expect(resolveSenderAddress('dernier', 'support').address).toBe('support@qwillio.com');
  });

  it('ne laisse pas un prénom saisi ouvrir une seconde adresse dans l\'en-tête', () => {
    const header = fromHeader('Mathieu" <pirate@exemple.com>\r\nBcc: x', 'hello@qwillio.com');
    expect(header.endsWith(' de Qwillio <hello@qwillio.com>')).toBe(true);
    expect(header.slice(0, -'<hello@qwillio.com>'.length)).not.toMatch(/[<>"\r\n]/);
    expect(fromHeader('', 'hello@qwillio.com')).toBe('Qwillio <hello@qwillio.com>');
  });
});
