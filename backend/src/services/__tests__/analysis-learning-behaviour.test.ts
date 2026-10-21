import { describe,it,expect,vi,afterEach } from 'vitest';
const db=vi.hoisted(()=>({client:{findUnique:vi.fn()},clientCall:{create:vi.fn(),findUnique:vi.fn(async()=>null)}}));
vi.mock('../../config/database',()=>({prisma:db}));
vi.mock('../../config/env',()=>({env:{}}));
vi.mock('../../config/logger',()=>({logger:{info:vi.fn(),warn:vi.fn(),error:vi.fn(),debug:vi.fn()}}));
vi.mock('../spam-detection.service',()=>({spamDetectionService:{classifyInboundCall:async()=>({isSpam:false,score:0,reasons:[]})}}));
import { ClientCallService } from '../client-call.service';
import { exportEvidence } from '../voice/learning-evidence';
const id='11111111-1111-4111-8111-111111111111';
afterEach(()=>vi.unstubAllGlobals());
describe('actual post-call producer consumption',()=>{
 it('requests the explicit schema and binds parsed observations to authenticated client creation',async()=>{
  const behaviour={schema_version:1,observations:[{category:'confirmation_missing',count:1}]};
  const f=vi.fn(async()=>({ok:true,status:200,json:async()=>({choices:[{message:{content:JSON.stringify({callerName:null,bookingRequested:false,summary:'secret-summary',sentiment:'neutral',outcome:'other',isLead:false,leadScore:3,learningBehaviour:behaviour})}}]})}));vi.stubGlobal('fetch',f);
  db.client.findUnique.mockResolvedValue({id,businessName:'secret-name',businessType:'restaurant',country:'BE',agentLanguage:'fr'});
  // Stop at the real persistence boundary; no downstream booking/SMS side effects.
  db.clientCall.create.mockRejectedValue(new Error('offline-stop-at-persistence'));
  await expect(new ClientCallService().handleClientCallCompleted(id,'fixture-call','secret-transcript',10)).rejects.toThrow('offline-stop-at-persistence');
  const body=JSON.parse((f.mock.calls[0] as unknown as [string,{body:string}])[1].body);
  expect(body.messages[0].content).toContain('learningBehaviour');
  const saved=db.clientCall.create.mock.calls[0][0].data.metadata.learningEvidence;
  expect(exportEvidence(saved,{tenant_id:id,niche:'restaurant',country:'BE',language:'fr'})).toEqual(behaviour);
  expect(JSON.stringify(saved)).not.toContain('secret-');
 });
});
