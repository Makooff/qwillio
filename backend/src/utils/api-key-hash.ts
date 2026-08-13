import crypto from 'crypto';

/**
 * Condensat des clés API clients.
 *
 * Les clés étaient stockées en clair: une fuite de la base était une fuite de
 * credentials directement rejouables. Le middleware documentait la réserve sans
 * la corriger, parce que « une bascule vers un condensat demande une migration
 * et une rotation des clés existantes ». La rotation n'est en fait pas
 * nécessaire, et c'est ce qui rend le correctif applicable tout de suite.
 *
 * **Pourquoi un SHA-256 nu suffit ici, alors qu'un mot de passe exigerait
 * bcrypt/argon2.** Le sel et le coût servent à protéger des secrets à faible
 * entropie, devinables par dictionnaire. Une clé Qwillio vaut
 * `qw_` + 24 octets aléatoires, soit **192 bits**: il n'y a pas de dictionnaire
 * à opposer, et un attaquant tenant la base n'a rien de mieux qu'une recherche
 * exhaustive sur 2^192. Le condensat déterministe est donc sûr, et il a la
 * propriété dont on a besoin: il **préserve la recherche par index unique**,
 * là où un bcrypt salé obligerait à charger toutes les lignes pour comparer.
 *
 * Corollaire à ne pas perdre de vue: le condensat étant à sens unique, une clé
 * perdue par le client ne se retrouve pas. Elle se révoque et se recrée.
 */
export function hashApiKey(key: string): string {
  return crypto.createHash('sha256').update(key, 'utf8').digest('hex');
}
