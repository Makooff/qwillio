import { describe, it, expect } from 'vitest';
import { parseBehaviour, evidenceForAnalysis, exportEvidence } from '../learning-evidence';
const scope = { tenant_id:'11111111-1111-4111-8111-111111111111', niche:'restaurant', country:'BE', language:'fr' };
const signals = { schema_version:1, observations:[{category:'repeated_question',count:2}] };
describe('closed behavioural producer and exporter', () => {
 it('accepts only explicit versioned categories, never legacy prose', () => {
   expect(parseBehaviour(signals)).toEqual(signals);
   for (const v of [null, {summary:'repeated_question'}, {...signals,raw:'PII'}, {schema_version:2,observations:[]}, {schema_version:1,observations:[{category:'invented',count:1}]}, {schema_version:1,observations:[{category:'repeated_question',count:true}]}]) expect(parseBehaviour(v)).toBeNull();
 });
 it('binds producer scope and rejects directory mismatch with no raw data', () => {
   const saved=evidenceForAnalysis(signals,scope);
   expect(exportEvidence(saved,scope)).toEqual(signals);
   for (const key of Object.keys(scope)) expect(exportEvidence(saved,{...scope,[key]:'other'})).toBeNull();
   expect(evidenceForAnalysis(signals,{...scope,niche:'Pierre restaurant'})).toBeNull();
   expect(evidenceForAnalysis(signals,{...scope,country:null})).toBeNull();
 });
 it('bounds counts, duplicates and category list', () => {
   for (const observations of [[{category:'feature_gap',count:101}], [{category:'feature_gap',count:1},{category:'feature_gap',count:1}], Array(13).fill({category:'feature_gap',count:1})]) expect(parseBehaviour({schema_version:1,observations})).toBeNull();
 });
});
