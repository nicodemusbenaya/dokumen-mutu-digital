import fs from 'fs';
import path from 'path';
import mammoth from 'mammoth';

const templateDir = path.resolve('../Template dokumen/Formulir');
const files = fs.readdirSync(templateDir).filter(f => f.endsWith('.docx'));

console.log('=== TEMPLATE FILES IN FOLDER ===');
for (const file of files) {
  const fullPath = path.join(templateDir, file);
  console.log(`\n\n========================================`);
  console.log(`FILE: ${file}`);
  console.log(`========================================`);
  
  try {
    const rawResult = await mammoth.extractRawText({ path: fullPath });
    const text = rawResult.value;
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    console.log(`Lines count: ${lines.length}`);
    console.log('First 25 lines:');
    lines.slice(0, 25).forEach((line, idx) => console.log(`  [${idx+1}] ${line}`));
    
    // Check if there are tables or headings
    const htmlResult = await mammoth.convertToHtml({ path: fullPath });
    const html = htmlResult.value;
    const hasTable = html.includes('<table');
    const hCount = (html.match(/<h[1-6]/g) || []).length;
    console.log(`HTML info: hasTable=${hasTable}, headingCount=${hCount}`);
  } catch (err) {
    console.error(`Error reading ${file}:`, err);
  }
}

console.log('\n\n========================================');
console.log('MASTER PROCEDURE DOC: PR.UPS.SER3.BMK.01-02');
console.log('========================================');
try {
  const masterPath = path.resolve('../PR.UPS.SER3.BMK.01-02 PROSEDUR INFORMASI TERDOKUMENTASI-REV2.docx');
  const raw = await mammoth.extractRawText({ path: masterPath });
  const lines = raw.value.split('\n').map(l => l.trim()).filter(Boolean);
  console.log(`Total lines: ${lines.length}`);
  console.log('Sample headings / lines:');
  lines.slice(0, 40).forEach((line, idx) => console.log(`  [${idx+1}] ${line}`));
} catch (e) {
  console.error('Error reading master procedure:', e);
}

