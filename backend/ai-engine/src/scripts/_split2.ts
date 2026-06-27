import { PDFDocument } from "pdf-lib";
import fs from "fs";
import path from "path";

async function main() {
  const inputPath = process.argv[2];
  const bytes = fs.readFileSync(inputPath);
  const src = await PDFDocument.load(bytes);
  const count = src.getPageCount();
  const outDir = "/tmp/pdf_compare2";
  fs.mkdirSync(outDir, { recursive: true });
  for (let i = 0; i < count; i++) {
    const doc = await PDFDocument.create();
    const [page] = await doc.copyPages(src, [i]);
    doc.addPage(page);
    const outBytes = await doc.save();
    fs.writeFileSync(path.join(outDir, `p${String(i + 1).padStart(2, "0")}.pdf`), outBytes);
  }
  console.log(`split ${count} pages → ${outDir}`);
}

main().catch(e => { console.error(e); process.exit(1); });
