import { env } from '../../config/env';

/**
 * Le secret que Vapi doit nous renvoyer, posé sur la charge de l'assistant.
 *
 * ## Le trou que ça bouche
 *
 * Nos endpoints exigent l'en-tête `x-vapi-secret` et le comparent à
 * `VAPI_WEBHOOK_SECRET`. Rien, dans ce dépôt, ne disait à Vapi quel secret
 * envoyer: on posait `serverUrl` et on espérait que le réglage jumeau existe
 * dans le tableau de bord Vapi. Deux endroits à accorder à la main, dont un
 * hors du dépôt, et aucun moyen de voir qu'ils avaient divergé.
 *
 * Quand ils divergent, l'appel se déroule PARFAITEMENT pour l'appelant — Vapi
 * tient la conversation avec l'assistant qu'il détient déjà — et tout ce qui
 * devait en rester tombe en 401: aucun appel au tableau de bord, aucune alerte
 * de lead, aucune facturation, aucun outil donc aucun transfert.
 *
 * ## Pourquoi un en-tête et pas `serverUrlSecret`
 *
 * Le réglage d'organisation de Vapi ne propose plus de champ « secret »: il
 * propose des EN-TÊTES HTTP, vérifié dans son écran le 10/09/2026. La forme
 * `server.headers` est donc celle que l'API vivante sert aujourd'hui, et c'est
 * la même que celle déjà acceptée sur le bloc `server` des outils.
 *
 * ## Le garde-fou qui vaut pour tout ce fichier
 *
 * Un champ inconnu ne dégrade pas un appel: il fait refuser l'assistant ENTIER
 * (voir 6octies dans CLAUDE.md). Rien ici ne part sans que
 * `npm run voice:validate` ait dit oui sur les six variantes.
 *
 * Secret absent: on ne pose RIEN. Un en-tête vide vaudrait un en-tête faux, et
 * `isVapiWebhookAuthorized` laisse déjà passer hors production quand le secret
 * n'est pas configuré.
 */
export function webhookServer(url: string): Record<string, unknown> {
  const secret = env.VAPI_WEBHOOK_SECRET;
  return secret
    ? { url, headers: { 'x-vapi-secret': secret } }
    : { url };
}
