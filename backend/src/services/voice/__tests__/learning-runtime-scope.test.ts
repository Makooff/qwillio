import { describe,it,expect } from 'vitest';
import { signRuntimeScope } from '../learning-runtime-scope';
import { createHmac } from 'node:crypto';
const client={id:'11111111-1111-4111-8111-111111111111',businessType:'restaurant',country:'BE',agentLanguage:'fr'};
describe('internal authenticated runtime assertions',()=>{
 it('signs database-only exact scope and binds called line',()=>{
  const token=signRuntimeScope(client,'+32000000000','fixture-key',true,1000)!;
  const [body,mac]=token.split('.');
  expect(mac).toBe(createHmac('sha256','fixture-key').update('qwillio-runtime-v1.'+body).digest('hex'));
  expect(JSON.parse(Buffer.from(body,'base64url').toString())).toMatchObject({v:1,clientId:client.id,trunk:'+32000000000',enabled:true,iat:1000,exp:1120,scope:{niche:'restaurant',country:'BE',language:'fr'}});
 });
 it('defaults disabled and refuses unknown profile data',()=>{
  expect(JSON.parse(Buffer.from(signRuntimeScope(client,'line','fixture-key')!.split('.')[0],'base64url').toString()).enabled).toBe(false);
  for (const c of [{...client,country:null},{...client,businessType:'Pierre restaurant'},{...client,agentLanguage:'und'}]) expect(signRuntimeScope(c,'line','fixture-key')).toBeNull();
  expect(signRuntimeScope(client,'line','')).toBeNull();
 });
});
