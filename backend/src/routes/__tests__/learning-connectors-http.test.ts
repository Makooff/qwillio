import { it,expect,vi } from 'vitest';
import express from 'express';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { resolve } from 'node:path';
import { mkdtemp, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
// Cross-repository integration is opt-in; never assume an operator's home paths.
const controlRoot = process.env.QWILLIO_LEARNING_CONTROL_ROOT;
const controlPython = process.env.QWILLIO_LEARNING_PYTHON;
import { once } from 'node:events';
const db=vi.hoisted(()=>({client:{findFirst:vi.fn(),findMany:vi.fn()},clientCall:{findMany:vi.fn(),findFirst:vi.fn()},learningPattern:{findMany:vi.fn()}}));
vi.mock('../../config/database',()=>({prisma:db}));
vi.mock('../../config/env',()=>({env:{}}));
vi.mock('../../config/logger',()=>({logger:{info:vi.fn(),warn:vi.fn(),error:vi.fn()}}));
vi.mock('../../services/discord.service',()=>({discordService:{}}));
import router from '../learning.routes';
import { evidenceForAnalysis } from '../../services/voice/learning-evidence';
it.skipIf(!controlRoot || !controlPython)('exercises actual TS export through authenticated HTTP, Python collector, SQLite and author/reviewer validation',async()=>{
 vi.stubEnv('LEARNING_READ_TOKEN','read-test-key');
 const id='11111111-1111-4111-8111-111111111111';
 const client={id,businessType:'restaurant',country:'BE',agentLanguage:'fr'};
 const scope={tenant_id:id,niche:'restaurant',country:'BE',language:'fr'};
 const rows=['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'].map((call,i)=>({id:call,clientId:id,client,status:'completed',isSpam:false,endedAt:new Date('2026-01-01'),createdAt:new Date('2026-01-01'),transcript:'secret-transcript',summary:'secret-name',metadata:{raw:'secret-log',learningEvidence:evidenceForAnalysis({schema_version:1,observations:i===0?[{category:'repeated_question',count:2}]:[]},scope)}}));
 db.client.findMany.mockResolvedValue([client]);db.client.findFirst.mockResolvedValue({id});db.learningPattern.findMany.mockResolvedValue([]);
 let scans=0;
 db.clientCall.findMany.mockImplementation(async({where,take})=>{
  if (!where.OR) scans++;
  return rows.filter(r=>r.clientId===where.clientId && (!where.OR || r.id>where.OR[1].id.gt)).slice(0,take)
    .map(r=>scans===1?{...r,metadata:{raw:'secret-log'}}:r);
 });
 const app=express();app.use('/api/learning',router);
 const server=app.listen(0,'127.0.0.1');await once(server,'listening');
 try {
  const address=server.address();if (!address || typeof address==='string') throw Error('not listening');
  const root=resolve(controlRoot!);
  const artifactRoot=resolve(process.env.QWILLIO_LEARNING_TEST_ARTIFACTS || tmpdir());
  await mkdir(artifactRoot,{recursive:true});const artifact=await mkdtemp(resolve(artifactRoot,'http-fixture-'));
  const env:NodeJS.ProcessEnv={};for (const k of ['PATH','SYSTEMROOT','WINDIR','COMSPEC']) if (process.env[k]) env[k]=process.env[k];
  env.PYTHONPATH=root;env.PYTHONUTF8='1';env.PYTHONDONTWRITEBYTECODE='1';
  env.TMPDIR=tmpdir();env.TMP=tmpdir();env.TEMP=tmpdir();
  const result=await promisify(execFile)(controlPython!,[resolve(root,'tests/connector_http_probe.py'),`http://127.0.0.1:${address.port}`,artifact],{cwd:root,env,timeout:60000});
  expect(result.stdout).toContain('PASS');console.log(result.stdout.trim());
 } finally {await new Promise<void>(res=>server.close(()=>res()));vi.unstubAllEnvs();}
},90000);
