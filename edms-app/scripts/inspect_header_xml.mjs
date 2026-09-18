import fs from 'fs';
import path from 'path';
import cp from 'child_process';

const docxPath = 'c:/Users/Nicodemus/Documents/Code/Dokumen Mutu Digital/Template dokumen/Formulir/FR.UPS.SER3.BMK.01.04-00 Formulir - rev1.docx';

const psScript = `
Add-Type -AssemblyName System.IO.Compression.FileSystem
$zip = [System.IO.Compression.ZipFile]::OpenRead("${docxPath}")
Write-Host "=== MEDIA ENTRIES ==="
$zip.Entries | Where-Object { $_.FullName -like "word/media/*" } | ForEach-Object {
    Write-Host $_.FullName $_.Length
}
Write-Host "=== EXTRACTING MEDIA TO TEMP ==="
$outDir = "c:/Users/Nicodemus/Documents/Code/Dokumen Mutu Digital/edms-app/scripts/extracted_media"
New-Item -ItemType Directory -Force -Path $outDir | Out-Null
$zip.Entries | Where-Object { $_.FullName -like "word/media/*" } | ForEach-Object {
    $target = Join-Path $outDir (Split-Path $_.FullName -Leaf)
    [System.IO.Compression.ZipFileExtensions]::ExtractToFile($_, $target, $true)
    Write-Host "Extracted: $target"
}
$zip.Dispose()
`;

fs.writeFileSync('scripts/temp_extract.ps1', psScript);
const out = cp.execSync('powershell -ExecutionPolicy Bypass -File scripts/temp_extract.ps1');
console.log(out.toString());
fs.unlinkSync('scripts/temp_extract.ps1');
