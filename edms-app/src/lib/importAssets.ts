import fs from 'node:fs/promises';
import path from 'node:path';

/** Give a newly saved document its own immutable copies of preview assets. */
export async function adoptDraftImportAssets(
  sections: Record<string, string>, userId: number, documentId: number,
  mediaRoot = path.join(process.cwd(), 'storage', 'media'),
): Promise<Record<string, string>> {
  if (!Number.isSafeInteger(userId) || userId < 1 || !Number.isSafeInteger(documentId) || documentId < 1) {
    throw new Error('ID pemilik media tidak valid.');
  }
  const prefix = `/uploads/media/drafts/${userId}/`;
  const folders = new Set<string>();
  const pattern = new RegExp(`${prefix}(import-[a-f0-9-]{36})/`, 'g');
  for (const value of Object.values(sections)) {
    if (typeof value !== 'string') continue;
    for (const match of value.matchAll(pattern)) folders.add(match[1]);
  }
  const output = { ...sections };
  for (const folder of folders) {
    const target = path.join(mediaRoot, String(documentId), folder);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.cp(path.join(mediaRoot, 'drafts', String(userId), folder), target, { recursive: true, errorOnExist: true, force: false });
    for (const [key, value] of Object.entries(output)) {
      if (typeof value === 'string') output[key] = value.split(`${prefix}${folder}/`).join(`/uploads/media/${documentId}/${folder}/`);
    }
  }
  return output;
}
