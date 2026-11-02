import fs from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {pdfToDocx,officeToPdf} from '../src/lib/conversion.mjs';
const [input,output,ext,work]=process.argv.slice(2);
try{const note=ext==='docx'?await pdfToDocx(input,output):await officeToPdf(input,output,work);console.log(JSON.stringify({note}));}catch(e){console.error(e.message);process.exitCode=1;}
