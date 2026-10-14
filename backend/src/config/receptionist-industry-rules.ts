import rulebook from './receptionist-industry-rules.json';

export type ReceptionistNiche = 'restaurant'|'dental'|'medical'|'salon'|'law'|'real_estate'|'auto'|'home_services'|'veterinary'|'fitness'|'financial'|'hotel'|'ecommerce'|'default';
type Language='fr'|'en'|'nl';
interface NicheRules {aliases:string[];rules:Record<Language,string[]>;requiredBusinessFacts:string[];sources:string[]}
const registry=rulebook as {version:number;common:Record<Language,string[]>;niches:Record<ReceptionistNiche,NicheRules>};
// More specific healthcare identities precede the broad medical vocabulary.
const priority:ReceptionistNiche[]=['dental','veterinary','medical','hotel','salon','law','real_estate','auto','home_services','fitness','financial','ecommerce','restaurant','default'];
const normalize=(value:string)=>value.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[_-]+/g,' ').replace(/\s+/g,' ').trim();
const tokens=(value:string)=>normalize(value).split(/[^a-z0-9]+/).filter(Boolean).join(' ');
const known=(niche:string):niche is ReceptionistNiche=>Object.hasOwn(registry.niches,niche);

export function resolveReceptionistNiche(businessType?:string|null):ReceptionistNiche {
 const raw=(businessType||'').trim().toLowerCase();
 if(known(raw))return raw;
 const text=` ${tokens(raw)} `;
 for(const niche of priority){
  if(niche==='default')continue;
  for(const alias of registry.niches[niche].aliases){
   const needle=tokens(alias);
   if(needle&&text.includes(` ${needle} `))return niche;
  }
 }
 return 'default';
}

export function industryRulesForReview(businessType?:string|null){
 const niche=resolveReceptionistNiche(businessType),data=registry.niches[niche];
 return {niche,rules:[...registry.common.fr,...data.rules.fr],requiredBusinessFacts:[...data.requiredBusinessFacts],sources:[...data.sources]};
}

export function scopedFingerprint(pattern:{kind:string;slug:string},niche:string):string {
 if(!known(niche))throw new Error('Unregistered learning niche');
 if(!['conversation','threshold','knowledge'].includes(pattern.kind)||!/^[a-z0-9][a-z0-9-]{2,59}$/.test(pattern.slug))throw new Error('Invalid learning pattern');
 return `${pattern.kind}:${niche.replaceAll('_','-')}--${pattern.slug}`;
}

export function learningScopeFromFingerprint(fingerprint:string):{niche:ReceptionistNiche|null;slug:string;scoped:boolean}{
 const colon=fingerprint.indexOf(':');
 const slug=colon<0?fingerprint:fingerprint.slice(colon+1);
 for(const niche of priority){
  const prefix=`${niche.replaceAll('_','-')}--`;
  if(slug.startsWith(prefix)){
   const original=slug.slice(prefix.length);
   if(/^[a-z0-9][a-z0-9-]{2,59}$/.test(original))return {niche,slug:original,scoped:true};
  }
 }
 return {niche:null,slug,scoped:false};
}

export function withLearningScopes<T extends {fingerprint:string;clientIds:string[]}>(
 patterns:T[],clients:{id:string;businessType:string|null}[]
){
 const byId=new Map(clients.map(client=>[client.id,resolveReceptionistNiche(client.businessType)]));
 return patterns.map(pattern=>{
  const scope=learningScopeFromFingerprint(pattern.fingerprint);
  if(scope.scoped)return {...pattern,...scope};
  const ids=pattern.clientIds;
  if(!ids.length||ids.some(id=>!byId.has(id)))return {...pattern,...scope};
  const niches=new Set(ids.map(id=>byId.get(id)!));
  return {...pattern,...scope,niche:niches.size===1?[...niches][0]:null};
 });
}
