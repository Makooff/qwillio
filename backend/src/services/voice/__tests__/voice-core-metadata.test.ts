import {describe,it,expect,vi} from 'vitest';
import {persistCompletedVoiceMetadata} from '../voice-core-metadata';

describe('completed voice metadata',()=>{
 it('merges on the stored row and guards room ownership',async()=>{
  const execute=vi.fn().mockResolvedValue(1);
  await persistCompletedVoiceMetadata({$executeRaw:execute} as any,'room-a','00000000-0000-0000-0000-000000000001',null,{brain:'cascade',trunkNumber:null,latency:{test:true}});
  const [parts,...values]=execute.mock.calls[0];
  const sql=parts.join('?');
  expect(sql).toContain("jsonb_typeof(metadata) = 'object'");
  expect(sql).toContain('||');
  expect(sql).toContain('client_id =');
  expect(values).toContain('room-a');
  expect(values).toContain('00000000-0000-0000-0000-000000000001');
  const payload=JSON.parse(values.find((v:unknown)=>typeof v==='string'&&v.startsWith('{')));
  expect(payload.live).toBe(false);
  expect(payload.source).toBe('voice-core');
  expect(payload).not.toHaveProperty('patterns');
  expect(payload).not.toHaveProperty('mortem');
 });
 it('keeps the original start when no valid start is supplied',async()=>{
  const execute=vi.fn().mockResolvedValue(1);
  await persistCompletedVoiceMetadata({$executeRaw:execute} as any,'room-a','00000000-0000-0000-0000-000000000001',null,{brain:null,trunkNumber:null,latency:null});
  expect(execute.mock.calls[0][0].join('?')).toContain('COALESCE(');
  expect(execute.mock.calls[0].slice(1)).toContain(null);
 });
 it('refuses a missing row or another client room',async()=>{
  await expect(persistCompletedVoiceMetadata({$executeRaw:vi.fn().mockResolvedValue(0)} as any,'room-a','00000000-0000-0000-0000-000000000001',null,{brain:null,trunkNumber:null,latency:null})).rejects.toThrow();
 });
});
