import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
test('backup stream verifies legacy source hashes without extracting it and restores storage bytes',async()=>{
 const output=path.resolve('tests/output');await fs.mkdir(output,{recursive:true});const folder=await fs.mkdtemp(path.join(output,'DUMMY-stream-restore-'));
 const program=`import sys,io,tarfile,hashlib,pathlib,importlib.util
p=pathlib.Path(sys.argv[1]);spec=importlib.util.spec_from_file_location('validator','scripts/restore-archive.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
data={'edms-app/node_modules/DUMMY.txt':b'DUMMY legacy source','edms-app/storage/originals/DUMMY.pdf':b'DUMMY original bytes'};buf=io.BytesIO()
with tarfile.open(fileobj=buf,mode='w:gz') as archive:
 for name,body in data.items():
  entry=tarfile.TarInfo(name);entry.size=len(body);archive.addfile(entry,io.BytesIO(body))
manifest=p/'files.sha256';manifest.write_text(''.join(hashlib.sha256(body).hexdigest()+'  '+name+'\\n' for name,body in data.items()))
r=m.restore(io.BytesIO(buf.getvalue()),manifest,p/'restored');assert r['allArchiveFilesHashVerified']==2;assert r['storageFilesRestored']==1
assert not (p/'restored/edms-app/node_modules').exists();assert (p/'restored/edms-app/storage/originals/DUMMY.pdf').read_bytes()==b'DUMMY original bytes'
manifest.write_text(manifest.read_text().replace(hashlib.sha256(b'DUMMY legacy source').hexdigest(),'0'*64))
try:m.restore(io.BytesIO(buf.getvalue()),manifest,p/'corrupt')
except ValueError:pass
else:raise AssertionError('Source checksum mismatch was ignored')
print('DUMMY_STREAM_RESTORE_PASS')`;
 const python=process.platform==='win32'?'python':'python3';const r=spawnSync(python,['-c',program,folder],{encoding:'utf8'});
 assert.equal(r.status,0,r.stderr);assert.match(r.stdout,/DUMMY_STREAM_RESTORE_PASS/);
});
