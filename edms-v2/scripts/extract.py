import sys,zipfile,json,pathlib,uuid,shutil,os
source,directory=sys.argv[1:3]
limit=int(os.environ.get('MAX_EXTRACT_BYTES','1073741824')); total=0
try:
 z=zipfile.ZipFile(source); entries=z.infolist()
 if len(entries)>5000: raise ValueError('Jumlah entri ZIP melebihi 5000')
 for index,e in enumerate(entries):
  result={'path':e.filename,'index':index}
  if e.is_dir():result['directory']=True
  try:
   name=e.filename.replace('\\','/'); parts=pathlib.PurePosixPath(name)
   if name.startswith('/') or any(x=='..' for x in parts.parts) or ':' in parts.parts[0] or len(name)>1100 or any(ord(c)<32 for c in name):raise ValueError('Path ZIP tidak aman')
   if (e.external_attr>>16)&0o170000==0o120000:raise ValueError('Symlink ZIP tidak diizinkan')
   if e.flag_bits&1:raise ValueError('ZIP terenkripsi tidak didukung')
   if e.is_dir():
    print(json.dumps(result,ensure_ascii=True),flush=True)
    continue
   ext=parts.suffix.lower()
   if ext not in ['.pdf','.docx','.xlsx']:raise ValueError('Format tidak didukung: '+ext)
   if e.file_size>104857600 or e.file_size>max(1,e.compress_size)*200:raise ValueError('Ukuran/rasio ekstraksi melebihi batas')
   if total+e.file_size>limit:raise ValueError('Total ekstraksi melebihi kuota')
   dest=pathlib.Path(directory)/(str(uuid.uuid4())+ext);written=0
   try:
    with z.open(e) as incoming,open(dest,'xb') as out:
     while True:
      block=incoming.read(65536)
      if not block:break
      written+=len(block);total+=len(block)
      if written>104857600 or total>limit:raise ValueError('Batas ekstraksi terlampaui')
      out.write(block)
    result['file']=str(dest)
   except Exception:
    dest.unlink(missing_ok=True);raise
  except Exception as error:result['error']=str(error)[:500]
  print(json.dumps(result,ensure_ascii=True),flush=True)
except Exception as error:
 print(json.dumps({'path':'[arsip]','error':'ZIP tidak dapat dibaca: '+str(error)[:300]}),flush=True)
 sys.exit(2)
