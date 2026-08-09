import { describe, it, expect } from 'vitest';
import { readSseEvents } from '../services/assistant-chat.service';

/**
 * Le lecteur d'événements du flux OpenAI.
 *
 * Le format SSE n'a rien de difficile; le DÉCOUPAGE, si. Un chunk réseau ne
 * s'aligne sur rien: il coupe volontiers un événement en deux et en apporte
 * trois d'un coup. Un lecteur qui traite chaque chunk isolément produit du
 * JSON tronqué, donc des mots qui manquent au hasard dans la réponse — un
 * défaut invisible en local, où tout arrive en un seul morceau.
 */
function bodyOf(chunks: string[]): AsyncIterable<Uint8Array> {
  const enc = new TextEncoder();
  return {
    async *[Symbol.asyncIterator]() {
      for (const c of chunks) yield enc.encode(c);
    },
  };
}

async function collect(chunks: string[]): Promise<string[]> {
  const out: string[] = [];
  for await (const e of readSseEvents(bodyOf(chunks))) out.push(e);
  return out;
}

describe('readSseEvents', () => {
  it('lit plusieurs événements arrivés dans un seul chunk', async () => {
    expect(await collect(['data: {"a":1}\n\ndata: {"a":2}\n\n']))
      .toEqual(['{"a":1}', '{"a":2}']);
  });

  it('recolle un événement coupé entre deux chunks', async () => {
    // La coupure tombe au milieu du JSON: c'est le cas qui casse un lecteur naïf.
    expect(await collect(['data: {"hel', 'lo":"world"}\n\n']))
      .toEqual(['{"hello":"world"}']);
  });

  it('recolle une coupure tombée dans le préfixe lui-même', async () => {
    expect(await collect(['da', 'ta: {"x":1}\n\n'])).toEqual(['{"x":1}']);
  });

  it('rend le dernier événement même sans saut de ligne final', async () => {
    // Un flux tronqué par la fin de la connexion garde quand même son contenu.
    expect(await collect(['data: {"z":9}'])).toEqual(['{"z":9}']);
  });

  it('ignore les lignes qui ne portent pas de données', async () => {
    // Les commentaires de maintien en vie (`: ping`) ne sont pas du JSON.
    expect(await collect([': ping\n\ndata: [DONE]\n\n'])).toEqual(['[DONE]']);
  });
});
