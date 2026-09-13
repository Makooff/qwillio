/**
 * TOUTES les adresses d'enregistrement qu'un appel Vapi peut porter.
 *
 * Le portail lisait la première trouvée (`artifact.recordingUrl`), et celle
 * du 13/09 est une adresse Cloudflare R2 NON signée
 * (`<compte>.r2.cloudflarestorage.com/…`, sans `X-Amz-*`): une adresse privée,
 * qui répond « InvalidArgument / Authorization » à quiconque n'a pas les clés
 * du compte. Ce n'est pas une expiration, c'est un stockage rattaché au compte
 * Vapi (identifiant Cloudflare posé dans son tableau de bord). Le même appel
 * porte souvent d'autres adresses (mono, stéréo, par canal), et l'une d'elles
 * peut être servie: on les essaie toutes, dans l'ordre, au lieu de s'arrêter
 * à la première.
 */
export interface RecordingCandidate {
  field: string;
  url: string;
}

const FIELDS: Array<[string, (c: Record<string, any>) => unknown]> = [
  ['artifact.recordingUrl', c => c?.artifact?.recordingUrl],
  ['recordingUrl', c => c?.recordingUrl],
  ['artifact.recording.mono.combinedUrl', c => c?.artifact?.recording?.mono?.combinedUrl],
  ['artifact.stereoRecordingUrl', c => c?.artifact?.stereoRecordingUrl],
  ['stereoRecordingUrl', c => c?.stereoRecordingUrl],
  ['artifact.recording.stereoUrl', c => c?.artifact?.recording?.stereoUrl],
  ['artifact.recording.mono.assistantUrl', c => c?.artifact?.recording?.mono?.assistantUrl],
  ['artifact.recording.mono.customerUrl', c => c?.artifact?.recording?.mono?.customerUrl],
];

export function recordingCandidates(call: Record<string, any> | null | undefined): RecordingCandidate[] {
  const seen = new Set<string>();
  const out: RecordingCandidate[] = [];
  for (const [field, read] of FIELDS) {
    const url = read(call ?? {});
    if (typeof url !== 'string' || !/^https?:\/\//.test(url) || seen.has(url)) continue;
    seen.add(url);
    out.push({ field, url });
  }
  return out;
}

/** Une adresse S3/R2 signée porte `X-Amz-Signature`; sans lui, elle est privée ou publique, jamais temporaire. */
export function isSignedUrl(url: string): boolean {
  try {
    return new URL(url).searchParams.has('X-Amz-Signature');
  } catch {
    return false;
  }
}
