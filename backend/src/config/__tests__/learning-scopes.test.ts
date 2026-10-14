import {describe,it,expect} from 'vitest';
import {withLearningScopes} from '../receptionist-industry-rules';

describe('legacy learning scopes',()=>{
 const pattern={fingerprint:'conversation:old-rule',clientIds:['a','b']};
 it('infers only when every real client has the same industry',()=>{
  expect(withLearningScopes([pattern],[{id:'a',businessType:'restaurant'},{id:'b',businessType:'resto'}])[0].niche).toBe('restaurant');
 });
 it('does not choose the majority when industries disagree',()=>{
  expect(withLearningScopes([pattern],[{id:'a',businessType:'restaurant'},{id:'b',businessType:'dental'}])[0].niche).toBeNull();
 });
 it('does not infer when a referenced client is absent',()=>{
  expect(withLearningScopes([pattern],[{id:'a',businessType:'restaurant'}])[0].niche).toBeNull();
 });
 it('retains the explicit namespace rather than another business configuration',()=>{
  const p={...pattern,fingerprint:'conversation:dental--old-rule'};
  expect(withLearningScopes([p],[{id:'a',businessType:'restaurant'},{id:'b',businessType:'restaurant'}])[0].niche).toBe('dental');
 });
});
