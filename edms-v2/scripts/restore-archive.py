"""Verify every archived regular file; restore only storage into an empty test volume."""
import sys, pathlib, tarfile, hashlib, os, re

def manifest(source):
    result = {}
    for line in pathlib.Path(source).read_text(encoding='utf-8', errors='surrogateescape').splitlines():
        escaped = line.startswith('\\')
        if escaped: line = line[1:]
        match = re.fullmatch(r'([a-fA-F0-9]{64}) [ *](.*)', line)
        if not match: raise ValueError('Invalid backup file manifest')
        name = match[2]
        if escaped:
            name = re.sub(r'\\([\\nr])', lambda m: {'\\':'\\','n':'\n','r':'\r'}[m[1]], name)
        if name in result: raise ValueError('Duplicate manifest path')
        result[name] = match[1].lower()
    if not result: raise ValueError('Empty backup file manifest')
    return result

def restore(stream, source, destination):
    expected, seen = manifest(source), {}
    base = pathlib.Path(destination).resolve()
    storage = base / 'edms-app' / 'storage'
    restored = 0
    with tarfile.open(fileobj=stream, mode='r|gz') as archive:
        for item in archive:
            name = item.name.removeprefix('./').rstrip('/')
            parts = pathlib.PurePosixPath(name)
            if parts.is_absolute() or '..' in parts.parts or not parts.parts or parts.parts[0] != 'edms-app':
                raise ValueError('Unsafe backup archive path')
            selected = name == 'edms-app/storage' or name.startswith('edms-app/storage/')
            target = base.joinpath(*parts.parts)
            if selected:
                if not target.resolve().is_relative_to(storage): raise ValueError('Storage path escaped')
                if target.is_symlink(): raise ValueError('Storage symlink rejected')
                if item.isdir():
                    target.mkdir(parents=True, exist_ok=True)
                    continue
                if not item.isfile(): raise ValueError('Non-regular storage member rejected')
            if item.isfile():
                if name not in expected or name in seen: raise ValueError('Unexpected or repeated backup file')
                output = None
                if selected:
                    target.parent.mkdir(parents=True, exist_ok=True)
                    output = target.open('xb')
                try:
                    digest = hashlib.sha256()
                    incoming = archive.extractfile(item)
                    for block in iter(lambda: incoming.read(1024*1024), b''):
                        digest.update(block)
                        if output: output.write(block)
                    seen[name] = digest.hexdigest()
                    if seen[name] != expected[name]: raise ValueError('Backup member checksum mismatch')
                finally:
                    if output: output.close()
                if selected:
                    os.chmod(target, item.mode & 0o777)
                    if hasattr(os, 'chown'): os.chown(target, item.uid, item.gid)
                    restored += 1
            elif item.islnk():
                linked = item.linkname.removeprefix('./')
                if linked not in seen or name not in expected or expected[name] != seen[linked]: raise ValueError('Invalid backup hardlink')
                seen[name] = seen[linked]
    if set(seen) != set(expected): raise ValueError('Missing backup file members')
    if not restored: raise ValueError('No storage files restored')
    return {'allArchiveFilesHashVerified': len(seen), 'storageFilesRestored': restored}

if __name__ == '__main__':
    import json
    print(json.dumps(restore(sys.stdin.buffer, sys.argv[1], sys.argv[2])), flush=True)
