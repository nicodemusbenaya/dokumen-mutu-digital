import fs from 'fs';
import path from 'path';
import cp from 'child_process';

const ps = `
Add-Type -AssemblyName System.IO.Compression.FileSystem
$zip = [System.IO.Compression.ZipFile]::OpenRead('c:/Users/Nicodemus/Documents/Code/Dokumen Mutu Digital/Template dokumen/Formulir/FR.UPS.SER3.BMK.01.01-00 Dokumen Mutu - rev1.docx')
$e2 = $zip.GetEntry('word/media/image2.png')
[System.IO.Compression.ZipFileExtensions]::ExtractToFile($e2, 'C:/Users/Nicodemus/.gemini/antigravity-ide/brain/68f9ce9f-b892-404a-8c69-900ec3a0b1f9/extracted_image2.png', $true)
$zip.Dispose()
`;

fs.writeFileSync('scripts/temp.ps1', ps);
cp.execSync('powershell -ExecutionPolicy Bypass -File scripts/temp.ps1');
fs.unlinkSync('scripts/temp.ps1');
console.log('Extracted image2.png successfully!');
