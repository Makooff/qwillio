import {describe,it,expect} from 'vitest';
import {resolveReceptionistNiche,industryRulesForReview,scopedFingerprint,learningScopeFromFingerprint} from '../receptionist-industry-rules';

describe('industry rules and scoped learning',()=>{
 it.each([
  ['restaurant','restaurant'],['cabinet dentaire','dental'],['médecin généraliste','medical'],
  ['barber','salon'],['cabinet avocat','law'],['agence immobilier','real_estate'],
  ['garage automobile','auto'],['plombier','home_services'],['clinique vétérinaire','veterinary'],
  ['salle de fitness','fitness'],['comptable','financial'],['hôtel','hotel'],
  ['ecommerce','ecommerce'],['activité inconnue','default'],
 ])('resolves %s to %s',(raw,expected)=>{
  expect(resolveReceptionistNiche(raw)).toBe(expected);
  const rules=industryRulesForReview(raw);
  expect(rules.niche).toBe(expected);expect(rules.rules.length).toBeGreaterThan(0);
 });
 it('does not match a trade inside an unrelated word',()=>{
  expect(resolveReceptionistNiche('carpenter')).not.toBe('auto');
  expect(resolveReceptionistNiche('barber')).toBe('salon');
  expect(resolveReceptionistNiche('real_estate')).toBe('real_estate');
  expect(resolveReceptionistNiche('home_services')).toBe('home_services');
 });
 it('separates the same observation between niches without changing its slug',()=>{
  const p={kind:'conversation',slug:'repeated-question'};
  const a=scopedFingerprint(p,'restaurant'),b=scopedFingerprint(p,'dental');
  expect(a).not.toBe(b);
  expect(learningScopeFromFingerprint(a)).toEqual({niche:'restaurant',slug:p.slug,scoped:true});
  expect(learningScopeFromFingerprint(b)).toEqual({niche:'dental',slug:p.slug,scoped:true});
  const real=scopedFingerprint(p,'real_estate');
  expect(learningScopeFromFingerprint(real)).toEqual({niche:'real_estate',slug:p.slug,scoped:true});
 });
 it('does not guess a niche for legacy or malformed fingerprints',()=>{
  expect(learningScopeFromFingerprint('conversation:old-rule')).toEqual({niche:null,slug:'old-rule',scoped:false});
  expect(()=>scopedFingerprint({kind:'conversation',slug:'bad:slug'},'dental')).toThrow();
  expect(()=>scopedFingerprint({kind:'conversation',slug:'valid-slug'},'unregistered')).toThrow();
 });
});
