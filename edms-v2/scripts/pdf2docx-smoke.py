import base64, os, subprocess, sys, tempfile, time, zipfile
from pathlib import Path
import fitz

with tempfile.TemporaryDirectory(prefix='DUMMY-pdf2docx-') as directory:
    source=Path(directory)/'DUMMY-source-visual.pdf'
    output=Path(directory)/'DUMMY-converted-visual.docx'
    pdf=fitz.open(); page=pdf.new_page(width=595,height=842)
    page.insert_text((60,80),'DUMMY Editable Heading',fontsize=20)
    page.insert_text((60,125),'DUMMY table left',fontsize=12)
    page.insert_text((310,125),'DUMMY table right',fontsize=12)
    page.draw_rect(fitz.Rect(50,100,540,145),color=(0,0.3,0.8),width=1.5)
    png=base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p7sAAAAASUVORK5CYII=')
    page.insert_image(fitz.Rect(50,180,250,260),stream=png)
    pdf.save(source);pdf.close()
    started=time.monotonic()
    subprocess.run([sys.executable,str(Path(__file__).with_name('pdf-to-docx.py')),str(source),str(output)],check=True)
    elapsed=time.monotonic()-started
    with zipfile.ZipFile(output) as archive:
        document=archive.read('word/document.xml').decode('utf-8')
        media=[name for name in archive.namelist() if name.startswith('word/media/')]
    assert 'DUMMY Editable Heading' in document and 'DUMMY table left' in document and 'DUMMY table right' in document, 'editable PDF text missing from DOCX XML'
    assert media, 'embedded PDF image missing from DOCX'
    subprocess.run(['libreoffice','--headless','--convert-to','pdf','--outdir',directory,str(output)],check=True,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
    assert (Path(directory)/'DUMMY-converted-visual.pdf').is_file(), 'LibreOffice could not open generated DOCX'
    memory=Path('/sys/fs/cgroup/memory.peak')
    peak=memory.read_text().strip() if memory.exists() else 'unavailable'
    print(f'DUMMY_PDF2DOCX_PASS elapsed_seconds={elapsed:.2f} memory_peak_bytes={peak} media_images={len(media)} docx_bytes={output.stat().st_size} libreoffice_opened=true')
