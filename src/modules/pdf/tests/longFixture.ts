import { writeFileSync } from 'node:fs';
// Small deterministic document: 80 pages alternating portrait and landscape.
export function longFixture(path: string) {
  const count = 80;
  const objects = ['<< /Type /Catalog /Pages 2 0 R >>',
    `<< /Type /Pages /Kids [${Array.from({length: count}, (_, i) => `${3+i} 0 R`).join(' ')}] /Count ${count} >>`];
  for (let i=0;i<count;i++) objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${i%2 ? '842 595' : '595 842'}] /Resources << >> /Contents ${3+count} 0 R >>`);
  const content='0.1 0.4 0.8 rg 40 40 200 200 re f';
  objects.push(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
  let pdf='%PDF-1.4\n';
  const offsets=objects.map((object,i)=>{const offset=Buffer.byteLength(pdf);pdf+=`${i+1} 0 obj\n${object}\nendobj\n`;return offset;});
  const xref=Buffer.byteLength(pdf);
  pdf+=`xref\n0 ${objects.length+1}\n0000000000 65535 f \n${offsets.map(n=>String(n).padStart(10,'0')+' 00000 n \n').join('')}trailer\n<< /Size ${objects.length+1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  writeFileSync(path,pdf);
}
