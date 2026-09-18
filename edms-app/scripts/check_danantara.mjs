import fs from 'fs';
import path from 'path';
import cp from 'child_process';

const dir = 'c:/Users/Nicodemus/Documents/Code/Dokumen Mutu Digital/Template dokumen/Formulir';
const ps = `
Add-Type -AssemblyName System.IO.Compression.FileSystem
$files = Get-ChildItem '${dir}/*.docx'
foreach ($f in $files) {
    $zip = [System.IO.Compression.ZipFile]::OpenRead($f.FullName)
    foreach ($e in $zip.Entries) {
        if ($e.FullName -like "*.xml") {
            $s = $e.Open()
            $r = New-Object System.IO.StreamReader($s)
            $t = $r.ReadToEnd()
            $r.Close()
            $s.Close()
            if ($t -match "Danantara|danantara|DANANTARA") {
                Write-Host "Found in: $($f.Name) -> $($e.FullName)"
            }
        }
    }
    $zip.Dispose()
}
`;

fs.writeFileSync('scripts/temp_dana.ps1', ps);
const res = cp.execSync('powershell -ExecutionPolicy Bypass -File scripts/temp_dana.ps1').toString();
console.log('Result:', res || '(No match found)');
fs.unlinkSync('scripts/temp_dana.ps1');
