import { createHash,createHmac } from 'node:crypto';
import { canonicalCountry,canonicalNiche } from './learning-observations.service';
import { verifiedScope } from './learning-evidence';
/** Called ONLY after voiceCoreAuth and called-line database resolution.
 * Public tenant credentials are not voiceCoreAuth credentials. Never pass req.body/query here.
 * Shared fleet key is an internal service trust boundary, not tenant authentication.
 */
export function signRuntimeScope(client: {id:string;businessType:unknown;country:unknown;agentLanguage:unknown}, trunk:string, key:string, enabled=false, now=Math.floor(Date.now()/1000)):string|null {
 const rawScope={tenant_id:client.id,niche:canonicalNiche(client.businessType),country:canonicalCountry(client.country),language:client.agentLanguage};
 if (!key.trim() || !trunk || trunk.length>80 || !verifiedScope(rawScope)) return null;
 const scope={...rawScope,tenant_id:createHash('sha256').update(client.id).digest('hex')};
 const body=Buffer.from(JSON.stringify({v:1,clientId:client.id,trunk,scope,enabled:enabled===true,iat:now,exp:now+120})).toString('base64url');
 return body+'.'+createHmac('sha256',key.trim()).update('qwillio-runtime-v1.'+body).digest('hex');
}
