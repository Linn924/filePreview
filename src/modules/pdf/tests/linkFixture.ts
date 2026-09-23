import {writeFileSync} from 'node:fs';

/** Small local-only PDF with a visible text link to its second page. */
export function linkFixture(path:string){
 const streams=['BT /F1 20 Tf 40 210 Td (Open page 2) Tj ET','BT /F1 20 Tf 40 210 Td (Second page) Tj ET'];
 const objects=[
  '<< /Type /Catalog /Pages 2 0 R >>',
  '<< /Type /Pages /Kids [3 0 R 4 0 R] /Count 2 >>',
  '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 500 300] /Resources << /Font << /F1 8 0 R >> >> /Contents 5 0 R /Annots [7 0 R] >>',
  '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 500 300] /Resources << /Font << /F1 8 0 R >> >> /Contents 6 0 R >>',
  ...streams.map(s=>`<< /Length ${s.length} >>\nstream\n${s}\nendstream`),
  '<< /Type /Annot /Subtype /Link /Rect [40 204 175 233] /Border [0 0 0] /Dest [4 0 R /Fit] >>',
  '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
 ];
 let pdf='%PDF-1.4\n';const offsets=objects.map((object,i)=>{const offset=Buffer.byteLength(pdf);pdf+=`${i+1} 0 obj\n${object}\nendobj\n`;return offset;});
 const xref=Buffer.byteLength(pdf);
 pdf+=`xref\n0 ${objects.length+1}\n0000000000 65535 f \n${offsets.map(n=>String(n).padStart(10,'0')+' 00000 n \n').join('')}trailer\n<< /Size ${objects.length+1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
 writeFileSync(path,pdf);
}
