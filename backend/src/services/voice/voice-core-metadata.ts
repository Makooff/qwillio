import type {PrismaClient} from '@prisma/client';
type Database=Pick<PrismaClient,'$executeRaw'>;

/** Merge on the current stored value: final metrics must never erase learning. */
export async function persistCompletedVoiceMetadata(
 db:Database,room:string,clientId:string,startedAt:Date|null,
 facts:{brain:unknown;trunkNumber:unknown;latency:unknown}
):Promise<void>{
 const payload=JSON.stringify({source:'voice-core',room,live:false,...facts});
 const changed=await db.$executeRaw`
  UPDATE client_calls
  SET started_at = COALESCE(${startedAt}::timestamp, started_at),
      metadata = (CASE WHEN jsonb_typeof(metadata) = 'object'
        THEN metadata ELSE '{}'::jsonb END) || ${payload}::jsonb
  WHERE vapi_call_id = ${room} AND client_id = ${clientId}::uuid
 `;
 if(changed!==1)throw new Error('Completed call metadata: room ownership or row mismatch');
}
