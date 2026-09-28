import { writeFileSync } from 'node:fs';

/** Deterministic PDF objects; test-only data, never private invoice contents. */
export function performanceFixture(file: string, kind: 'invoice'|'dense'|'scan', image?: Buffer) {
  const count = kind === 'invoice' ? 1 : kind === 'dense' ? 20 : 12;
  const imageId = 3 + count * 2;
  const fontId = imageId + 1;
  const objects: Buffer[] = [Buffer.from('<< /Type /Catalog /Pages 2 0 R >>'),
    Buffer.from(`<< /Type /Pages /Kids [${Array.from({length:count},(_,i)=>`${3+i*2} 0 R`).join(' ')}] /Count ${count} >>`)];
  for(let i=0;i<count;i++) {
    const text = kind === 'dense'
      ? Array.from({length:1000},(_,n)=>`BT /F1 7 Tf ${25+(n%8)*68} ${810-Math.floor(n/8)*6} Td (invoice ${i}-${n}) Tj ET`).join('\n')
      : 'BT /F1 18 Tf 40 700 Td (Synthetic invoice - local test only) Tj ET\n0.2 0.4 0.8 rg 40 40 200 200 re f';
    const content = Buffer.from(kind === 'scan' ? 'q 550 0 0 780 20 20 cm /Im1 Do Q' : text);
    objects.push(Buffer.from(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 ${fontId} 0 R >> /XObject << /Im1 ${imageId} 0 R >> >> /Contents ${4+i*2} 0 R >>`));
    objects.push(Buffer.concat([Buffer.from(`<< /Length ${content.length} >>\nstream\n`),content,Buffer.from('\nendstream')]));
  }
  const jpg = image || Buffer.alloc(0);
  objects.push(kind === 'scan' ? Buffer.concat([Buffer.from(`<< /Type /XObject /Subtype /Image /Width 1400 /Height 2000 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpg.length} >>\nstream\n`),jpg,Buffer.from('\nendstream')]) : Buffer.from('<< >>'));
  objects.push(Buffer.from('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'));
  const chunks = [Buffer.from('%PDF-1.4\n')];
  let size=chunks[0].length;
  const offsets=objects.map((obj,i)=>{const off=size;const b=Buffer.concat([Buffer.from(`${i+1} 0 obj\n`),obj,Buffer.from('\nendobj\n')]);chunks.push(b);size+=b.length;return off;});
  chunks.push(Buffer.from(`xref\n0 ${objects.length+1}\n0000000000 65535 f \n${offsets.map(n=>String(n).padStart(10,'0')+' 00000 n \n').join('')}trailer\n<< /Size ${objects.length+1} /Root 1 0 R >>\nstartxref\n${size}\n%%EOF`));
  writeFileSync(file,Buffer.concat(chunks));
}
