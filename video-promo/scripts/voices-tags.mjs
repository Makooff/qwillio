// Les balises d'émotion d'eleven_v3 ([warmly]…) sont lues comme des consignes,
// pas comme du texte : on les retire de l'alignement, pour que le minutage
// mot à mot corresponde au texte affiché.
export function stripTags(a) {
  const keep = [];
  let depth = 0;
  a.characters.forEach((c, i) => {
    if (c === '[') depth++;
    const inTag = depth > 0;
    if (c === ']') { depth--; return; }
    if (!inTag) keep.push(i);
  });
  while (keep.length && /\s/.test(a.characters[keep[0]])) keep.shift();
  return {
    characters: keep.map((i) => a.characters[i]),
    character_start_times_seconds: keep.map((i) => a.character_start_times_seconds[i]),
    character_end_times_seconds: keep.map((i) => a.character_end_times_seconds[i]),
  };
}
