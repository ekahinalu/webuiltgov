const PAGE_LINES = 46;
const LINE_WIDTH = 90;

function pdfSafe(value: string): string {
  const mapped = value
    .replace(/\u2018|\u2019/g, "'")
    .replace(/\u201c|\u201d/g, '"')
    .replace(/\u2013|\u2014/g, "-")
    .replace(/\u00a0/g, " ");
  let out = "";
  for (const char of mapped) {
    const code = char.codePointAt(0) ?? 0;
    if (code === 10) out += "\n";
    else if (code >= 32 && code <= 126) out += char;
    else out += "?";
  }
  return out;
}

function pdfEscape(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function wrap(value: string): string[] {
  const lines: string[] = [];
  for (const paragraph of value.split("\n")) {
    if (paragraph.length === 0) {
      lines.push("");
      continue;
    }
    let rest = paragraph;
    while (rest.length > LINE_WIDTH) {
      const cut = rest.lastIndexOf(" ", LINE_WIDTH);
      const at = cut > 20 ? cut : LINE_WIDTH;
      lines.push(rest.slice(0, at).trimEnd());
      rest = rest.slice(at).trimStart();
    }
    lines.push(rest);
  }
  return lines;
}

function pageStream(lines: string[]): string {
  const commands = ["BT", "/F1 11 Tf", "54 738 Td", "14 TL"];
  for (const line of lines) {
    commands.push(`(${pdfEscape(line)}) Tj`);
    commands.push("T*");
  }
  commands.push("ET");
  return commands.join("\n");
}

export function renderProposalPdf(lines: string[]): Buffer {
  const wrapped = wrap(pdfSafe(lines.length > 0 ? lines.join("\n") : "No saved proposal text."));
  const chunks: string[][] = [];
  for (let index = 0; index < wrapped.length; index += PAGE_LINES) chunks.push(wrapped.slice(index, index + PAGE_LINES));
  if (chunks.length === 0) chunks.push(["No saved proposal text."]);
  const bodies: string[] = [];
  const pageIds: number[] = [];
  const contentIds: number[] = [];
  let next = 4;
  for (let index = 0; index < chunks.length; index += 1) {
    contentIds.push(next);
    next += 1;
    pageIds.push(next);
    next += 1;
  }
  const kids = pageIds.map((id) => `${id} 0 R`).join(" ");
  bodies.push("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n");
  bodies.push(`2 0 obj\n<< /Type /Pages /Kids [${kids}] /Count ${pageIds.length} >>\nendobj\n`);
  bodies.push("3 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>\nendobj\n");
  chunks.forEach((chunk, index) => {
    const stream = pageStream(chunk);
    const contentId = contentIds[index] ?? 0;
    const pageId = pageIds[index] ?? 0;
    bodies.push(`${contentId} 0 obj\n<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream\nendobj\n`);
    bodies.push(
      `${pageId} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents ${contentId} 0 R /Resources << /Font << /F1 3 0 R >> >> >>\nendobj\n`,
    );
  });
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  for (const body of bodies) {
    offsets.push(Buffer.byteLength(pdf));
    pdf += body;
  }
  const xrefAt = Buffer.byteLength(pdf);
  let xref = `xref\n0 ${bodies.length + 1}\n0000000000 65535 f \n`;
  for (let index = 1; index < offsets.length; index += 1) {
    xref += `${String(offsets[index]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `${xref}trailer\n<< /Size ${bodies.length + 1} /Root 1 0 R >>\nstartxref\n${xrefAt}\n%%EOF\n`;
  return Buffer.from(pdf, "latin1");
}
