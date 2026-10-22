import { describe,it,expect,vi,afterEach } from 'vitest';
const db=vi.hoisted(()=>({client:{findUnique:vi.fn()},clientCall:{create:vi.fn(),upsert:vi.fn(),findUnique:vi.fn()},$transaction:vi.fn(),$queryRaw:vi.fn()}));
vi.mock('../../config/database',()=>({prisma:db}));
vi.mock('../../config/env',()=>({env:{}}));
vi.mock('../../config/logger',()=>({logger:{info:vi.fn(),warn:vi.fn(),error:vi.fn(),debug:vi.fn()}}));
vi.mock('../spam-detection.service',()=>({spamDetectionService:{classifyInboundCall:async()=>({isSpam:false,score:0,reasons:[]})}}));
import { ClientCallService } from '../client-call.service';
import { exportEvidence } from '../voice/learning-evidence';
const id='11111111-1111-4111-8111-111111111111';
afterEach(()=>vi.unstubAllGlobals());
describe('actual post-call producer consumption',()=>{
 it.each(['absent','ended'])('requests the explicit schema and binds parsed observations to authenticated %s call persistence',async status=>{
  vi.clearAllMocks();
  const behaviour={schema_version:1,observations:[{category:'confirmation_missing',count:1}]};
  const f=vi.fn(async()=>({ok:true,status:200,json:async()=>({choices:[{message:{content:JSON.stringify({callerName:null,bookingRequested:false,summary:'secret-summary',sentiment:'neutral',outcome:'other',isLead:false,leadScore:3,learningBehaviour:behaviour})}}]})}));vi.stubGlobal('fetch',f);
  db.client.findUnique.mockResolvedValue({id,businessName:'secret-name',businessType:'restaurant',country:'BE',agentLanguage:'fr'});
  db.clientCall.findUnique.mockResolvedValue(status==='absent'?null:{id:'stable-call',status:'ended',metadata:{recordingSid:'RE-existing'}});
  db.$queryRaw.mockResolvedValue([]);
  db.$transaction.mockImplementation(async cb=>cb(db));
  // Stop at the real persistence boundary; no downstream booking/SMS side effects.
  db.clientCall.create.mockRejectedValue(new Error('offline-stop-at-persistence'));
  db.clientCall.upsert.mockRejectedValue(new Error('offline-stop-at-persistence'));
  await expect(new ClientCallService().handleClientCallCompleted(id,'fixture-call','secret-transcript',10)).rejects.toThrow('offline-stop-at-persistence');
  const body=JSON.parse((f.mock.calls[0] as unknown as [string,{body:string}])[1].body);
  expect(body.messages[0].content).toContain('learningBehaviour');
  let saved: unknown;
  if(status==='ended'){
    const persistence=db.clientCall.upsert.mock.calls[0][0];
    expect(persistence.where).toEqual({vapiCallId:'fixture-call',clientId:id});
    expect(persistence.create.clientId).toBe(id);
    saved=persistence.create.metadata.learningEvidence;
    expect(persistence.update.metadata.learningEvidence).toEqual(saved);
    expect(persistence.update.metadata.recordingSid).toBe('RE-existing');
    expect(db.clientCall.create).not.toHaveBeenCalled();
  }else{
    const persistence=db.clientCall.create.mock.calls[0][0].data;
    expect(persistence.clientId).toBe(id);
    expect(persistence.vapiCallId).toBe('fixture-call');
    saved=persistence.metadata.learningEvidence;
    expect(db.clientCall.upsert).not.toHaveBeenCalled();
  }
  expect(db.clientCall.findUnique).toHaveBeenCalledWith(expect.objectContaining({where:{vapiCallId:'fixture-call',clientId:id}}));
  expect(exportEvidence(saved,{tenant_id:id,niche:'restaurant',country:'BE',language:'fr'})).toEqual(behaviour);
  expect(JSON.stringify(saved)).not.toContain('secret-');
 });
});
