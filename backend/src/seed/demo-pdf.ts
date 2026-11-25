// Builds a small, valid one-page PDF, so the demo tenders have real Terms of
// Reference files that pass the upload content check and open in a viewer.
export function demoPdf(title: string, details: string[] = []): Buffer {
  const safe = (value: string) =>
    value.replace(/[^\\x20-\\x7e]/g, '-').replace(/[\\\\()]/g, '\\\\$&');
  const text = ['BT /F1 16 Tf 58 730 Td', '(' + safe(title) + ') Tj', '/F1 10 Tf'];
  for (const detail of ['Fictional procurement demonstration', ...details]) {
    const lines = detail.match(/.{1,86}(?:\\s|$)|\\S{86}/g) ?? [];
    for (const line of lines) text.push('0 -17 Td (' + safe(line.trim()) + ') Tj');
  }
  const content = [...text, 'ET'].join('\\n');

  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];

  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [];
  objects.forEach((body, i) => {
    offsets.push(Buffer.byteLength(pdf));
    pdf += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xrefStart = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  pdf += offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('');
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`;
  return Buffer.from(pdf);
}
