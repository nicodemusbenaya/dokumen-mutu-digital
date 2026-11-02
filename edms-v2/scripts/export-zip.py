"""Stream an original-only export; JSON manifest comes from the trusted worker."""
import json, os, sys, zipfile

root, manifest_file, output = sys.argv[1:]
root = os.path.realpath(root)
with open(manifest_file, encoding='utf-8') as stream:
    entries = json.load(stream)
with zipfile.ZipFile(output, 'w', compression=zipfile.ZIP_STORED, allowZip64=True) as archive:
    for entry in entries:
        source = os.path.realpath(os.path.join(root, entry['path']))
        if os.path.commonpath([root, source]) != root:
            raise ValueError('Path ekspor tidak aman')
        archive.write(source, entry['name'])
