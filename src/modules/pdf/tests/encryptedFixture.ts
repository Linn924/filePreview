import {createHash} from 'node:crypto';
import {writeFileSync} from 'node:fs';
const padding=Buffer.from('28bf4e5e4e758a4164004e56fffa01082e2e00b6d0683e802f0ca9fe6453697a','hex');
const pad=(password:string)=>Buffer.concat([Buffer.from(password,'latin1'),padding]).subarray(0,32);
const md5=(buffer:Buffer)=>createHash('md5').update(buffer).digest();
function rc4(key:Buffer,input:Buffer) {
  const state=Array.from({length:256},(_,i)=>i);let j=0;
  for(let i=0;i<256;i++){j=(j+state[i]+key[i%key.length])%256;[state[i],state[j]]=[state[j],state[i]];}
  const result=Buffer.alloc(input.length);let i=0;j=0;
  for(let n=0;n<input.length;n++){i=(i+1)%256;j=(j+state[i])%256;[state[i],state[j]]=[state[j],state[i]];result[n]=input[n]^state[(state[i]+state[j])%256];}
  return result;
}
/** Test-only Standard security R2 sample with user password secret. */
export function encryptedFixture(file:string,printing=true) {
  const owner=rc4(md5(pad('test-owner')).subarray(0,5),pad('secret'));
  const id=md5(Buffer.from('local-pdf-test-fixture'));
  const p=Buffer.alloc(4);p.writeInt32LE(printing?-4:-8);
  const key=md5(Buffer.concat([pad('secret'),owner,p,id])).subarray(0,5);
  const user=rc4(key,padding);
  const objectKey=md5(Buffer.concat([key,Buffer.from([4,0,0,0,0])])).subarray(0,10);
  const stream=rc4(objectKey,Buffer.from('BT /F1 18 Tf 40 700 Td (Encrypted sample text) Tj ET'));
  const objects=[Buffer.from('<< /Type /Catalog /Pages 2 0 R >>'),Buffer.from('<< /Type /Pages /Kids [3 0 R] /Count 1 >>'),Buffer.from('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 6 0 R >> >> /Contents 4 0 R >>'),Buffer.concat([Buffer.from(`<< /Length ${stream.length} >>\nstream\n`),stream,Buffer.from('\nendstream')]),Buffer.from(`<< /Filter /Standard /V 1 /R 2 /O <${owner.toString('hex')}> /U <${user.toString('hex')}> /P ${printing?-4:-8} >>`),Buffer.from('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>')];
  const chunks=[Buffer.from('%PDF-1.4\n')];let size=chunks[0].length;
  const offsets=objects.map((obj,n)=>{const start=size;const value=Buffer.concat([Buffer.from(`${n+1} 0 obj\n`),obj,Buffer.from('\nendobj\n')]);chunks.push(value);size+=value.length;return start;});
  chunks.push(Buffer.from(`xref\n0 7\n0000000000 65535 f \n${offsets.map(n=>String(n).padStart(10,'0')+' 00000 n \n').join('')}trailer\n<< /Size 7 /Root 1 0 R /Encrypt 5 0 R /ID [<${id.toString('hex')}> <${id.toString('hex')}>] >>\nstartxref\n${size}\n%%EOF`));
  writeFileSync(file,Buffer.concat(chunks));
}
