"""Host-side stream into the uniquely labelled laptop restore volume; no NAS writes."""
import sys, os, pathlib, re, subprocess, json, tempfile, shutil
source, copied_manifest, run = sys.argv[1:4]
if not re.fullmatch(r'DUMMY-RESTORE-[a-f0-9]{12}', run): raise ValueError('Invalid restore identity')
if os.environ.get('RESTORE_TEST_RUN') != run: raise ValueError('Restore environment differs')
volume = 'edms-restore-files-' + run.lower()
labels = json.loads(subprocess.check_output(['docker','volume','inspect','--format','{{json .Labels}}',volume], text=True))
if labels.get('edms.restoreRun') != run: raise ValueError('Volume is not owned by this restore run')
source = pathlib.Path(source).resolve()
if source.name != 'app.tar.gz': raise ValueError('Unexpected archive')
validator = pathlib.Path(__file__).resolve().with_name('restore-archive.py')
manifest = pathlib.Path(copied_manifest).resolve()
if validator.name != 'restore-archive.py' or manifest.name != 'app-files.sha256':
    raise ValueError('Unexpected restore helper or manifest')
with tempfile.TemporaryDirectory(prefix='edms-restore-helper-') as helper_dir:
    helper_root = pathlib.Path(helper_dir)
    shutil.copyfile(validator, helper_root / 'restore-archive.py')
    shutil.copyfile(manifest, helper_root / 'app-files.sha256')
    args = ['docker','run','--rm','--interactive','--network','none','--user','0','--read-only',
            '--label','edms.restoreRun='+run,
            '--mount',f'type=volume,source={volume},target=/restore',
            '--mount',f'type=bind,source={helper_root},target=/restore-helper,readonly',
            '--entrypoint','python3','edms-ups:2.1.0',
            '/restore-helper/restore-archive.py','/restore-helper/app-files.sha256','/restore']
    with source.open('rb') as incoming:
        subprocess.run(args, stdin=incoming, check=True)
