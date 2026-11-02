<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## EDMS rebuild context
Read ../AGENTS.md and ../plan.md for final decisions 2.1. Keep legacy source changes. Reuse the existing container/service, edms_ups database and storage mounts; target NAS is Celeron J3455, 4 GB RAM, Linux amd64 build on laptop. At cutover, after verified backup, remove legacy document data/history and exclusively owned files; preserve users/roles/departments, independent masters, configuration and backups. Do not purge or deploy during documentation work. Start real content only from Dokumen Final after readiness. No staged approvals: valid authorized uploads/updates publish immediately, preserving new version history. PDF-to-DOCX with a mandatory pre-download warning is in scope. Use only synthetic dummy files for every upload/import/update/conversion test; never upload real documents for development/UAT/smoke. UI uses PLN light blue/yellow, local Danantara/PLN logos and an applicable installed UI skill checked during implementation. Keep the generated Next.js rules above.
