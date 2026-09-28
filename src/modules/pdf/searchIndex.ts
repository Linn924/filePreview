/** Preserve original offsets when Unicode case conversion changes string length. */
export function foldPdfText(source:string) {
  const folded=source.toLowerCase();
  if(folded.length===source.length)return {folded,offsets:undefined as number[]|undefined};
  const offsets:number[]=[];let position=0;
  for(const char of source) { const lower=char.toLowerCase();for(let i=0;i<lower.length;i++)offsets.push(position);position+=char.length; }
  offsets.push(source.length);return {folded,offsets};
}
