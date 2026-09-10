import { describe, it, expect } from 'vitest';
import { summariseTool } from '../assistant-chat.service';

/**
 * Ce que le gérant lit sous la réponse de l'assistant.
 *
 * Le chat racontait ses actions dans sa propre phrase, ou pas du tout: « c'est
 * noté » ne dit pas ce qui a été noté, et un enregistrement silencieux ne se
 * distingue pas d'un enregistrement raté. Le gérant rouvrait donc ses réglages
 * pour vérifier, ce qui annule l'intérêt d'avoir parlé à un assistant.
 *
 * La règle que ces tests tiennent: une confirmation ne s'affiche que si
 * quelque chose a réellement été écrit. Une ligne « enregistré » après un
 * refus est pire que le silence, parce qu'elle se croit.
 */
describe('summariseTool', () => {
  it('nomme les champs réellement écrits', () => {
    const a = summariseTool('update_config', { ok: true, applied: ['hours', 'items'] });
    expect(a).toEqual({ tool: 'update_config', fields: ['hours', 'items'], ok: true });
  });

  it("rend une liste vide quand l'outil n'a rien appliqué", () => {
    /* L'écran n'affiche RIEN sur une liste vide: sans champ nommé, la ligne
       « enregistré » affirmerait une écriture qui n'a pas eu lieu. */
    expect(summariseTool('update_config', { ok: true, applied: [] }).fields).toEqual([]);
  });

  it("marque un refus comme tel", () => {
    const a = summariseTool('answer_knowledge_gap', { ok: false, reason: 'not_found' });
    expect(a.ok).toBe(false);
  });

  it('compte les éléments des outils qui lisent une liste', () => {
    const a = summariseTool('list_knowledge_gaps', [{ id: 'g1' }, { id: 'g2' }]);
    expect(a).toEqual({ tool: 'list_knowledge_gaps', count: 2, ok: true });
  });

  it("ne casse pas sur une sortie d'une forme inattendue", () => {
    /* Une confirmation est un supplément: elle ne doit jamais faire échouer la
       réponse qu'elle accompagne. */
    expect(() => summariseTool(undefined, null)).not.toThrow();
    expect(summariseTool(undefined, null).tool).toBe('unknown');
    expect(summariseTool('update_config', 'pas un objet').fields).toEqual([]);
  });
});
