import sys
import fitz
from pdf2docx import Converter

source, target = sys.argv[1:3]
with fitz.open(source) as pdf:
    if not pdf.page_count or pdf.page_count > 200:
        raise ValueError('Konversi dibatasi 200 halaman')
    text_pages = sum(bool(page.get_text().strip()) for page in pdf)
    scan_pages = pdf.page_count - text_pages

converter = Converter(source)
try:
    converter.convert(target, multi_processing=False)
finally:
    converter.close()

print(f'{text_pages} halaman dengan teks PDF dikonversi menjadi konten Word yang dapat diedit; {scan_pages} halaman tanpa teks tetap berupa gambar tanpa OCR. Periksa tata letak, tabel, dan gambar sebelum digunakan.')
