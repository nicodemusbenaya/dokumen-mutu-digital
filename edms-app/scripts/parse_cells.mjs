import fs from 'fs';
import cp from 'child_process';

const ps = `
Add-Type -AssemblyName System.IO.Compression.FileSystem
$zip = [System.IO.Compression.ZipFile]::OpenRead('c:/Users/Nicodemus/Documents/Code/Dokumen Mutu Digital/Template dokumen/Formulir/FR.UPS.SER3.BMK.01.04-00 Formulir - rev1.docx')
$e = $zip.GetEntry('word/header1.xml')
$s = $e.Open()
$r = New-Object System.IO.StreamReader($s)
$xml = $r.ReadToEnd()
$r.Close(); $s.Close(); $zip.Dispose()

# Find w:tc elements (table cells)
$matches = [regex]::Matches($xml, '<w:tc[ >].*?<\/w:tc>')
Write-Host "Total Cells:" $matches.Count
for ($i=0; $i -lt $matches.Count; $i++) {
    $c = $matches[$i].Value
    $text = ($c -replace '<[^>]+>', ' ') -replace '\\s+', ' '
    Write-Host "--- CELL $i ---"
    Write-Host $text
}
`;

fs.writeFileSync('scripts/parse_cell.ps1', ps);
console.log(cp.execSync('powershell -ExecutionPolicy Bypass -File scripts/parse_cell.ps1').toString());
fs.unlinkSync('scripts/parse_cell.ps1');
