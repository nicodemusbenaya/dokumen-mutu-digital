import fs from 'fs';
import path from 'path';
import cp from 'child_process';

const dir = 'c:/Users/Nicodemus/Documents/Code/Dokumen Mutu Digital/Template dokumen/Formulir';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.docx'));

const ps = `
Add-Type -AssemblyName System.IO.Compression.FileSystem
$dir = "${dir}"
Get-ChildItem -Path $dir -Filter *.docx | ForEach-Object {
    Write-Host "=== FILE: $($_.Name) ==="
    $zip = [System.IO.Compression.ZipFile]::OpenRead($_.FullName)
    $zip.Entries | Where-Object { $_.FullName -like "word/media/*" } | ForEach-Object {
        Write-Host "  Media: $($_.FullName) ($($_.Length) bytes)"
    }
    $zip.Dispose()
}
`;

fs.writeFileSync('scripts/check_all_media.ps1', ps);
const out = cp.execSync('powershell -ExecutionPolicy Bypass -File scripts/check_all_media.ps1');
console.log(out.toString());
fs.unlinkSync('scripts/check_all_media.ps1');
