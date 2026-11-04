#!/bin/sh
# Update 2.1.10 (Form Zoho: hapus entri/periode/form, impor CSV header dua baris). Image-only update:
# same service/container/mounts/port, no database migration. Existing documents/accounts/files/audit are not modified.
# Per user decision there is no DUMMY smoke on production; backup + laptop restore gate + health/preflight remain.
set -eu
umask 077
PATH=/share/CACHEDEV1_DATA/.qpkg/container-station/bin:/share/CACHEDEV1_DATA/.qpkg/container-station/usr/bin:$PATH; export PATH
OPS=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd -P)
case "$OPS" in /share/Container/edms-release/app-update-2.1.10|/share/CACHEDEV1_DATA/Container/edms-release/app-update-2.1.10) ;; *) exit 1 ;; esac
[ "$#" -eq 1 ] || { printf '%s\n' 'Usage: nas-app-update.sh <verified-backup-directory>'; exit 2; }
BACKUP=$(CDPATH= cd -- "$1" && pwd -P)
case "$BACKUP" in /share/Container/edms-backups/edms-update-*|/share/CACHEDEV1_DATA/Container/edms-backups/edms-update-*) ;; *) printf '%s\n' UNSAFE_BACKUP_PATH; exit 1 ;; esac
[ -s "$BACKUP/SHA256SUMS" ] && [ -s "$BACKUP/backup-state.txt" ]
grep -qx 'backupComplete=true' "$BACKUP/backup-state.txt"
[ ! -e "$BACKUP/INCOMPLETE" ] || { printf '%s\n' BACKUP_INCOMPLETE; exit 1; }
cd "$BACKUP"
sha256sum -c SHA256SUMS
cd "$OPS"
sha256sum -c SHA256SUMS
[ -s "$OPS/update-restore-gate.json" ] || {
 printf '%s\n' 'RESTORE_GATE_MISSING: restore the current backup on the laptop, run prepare-app-update-gate-2.1.10.ps1, then copy update-restore-gate.json into this NAS package.'
 exit 1
}
APP=edms-ups-app
ADMIN_JSON=/share/Container/edms-backups/edms-pre-v2-20261023T030626Z-25519/old-container.inspect.json
[ -f "$ADMIN_JSON" ] || { printf '%s\n' ADMIN_CHECKPOINT_MISSING; exit 1; }
# The migration changes the DB, so the backup maintenance must still be active (no writes after the snapshot).
[ "$(docker inspect "$APP" --format '{{.State.Running}}')" = false ] || { printf '%s\n' 'APP_RUNNING: run nas-app-backup.sh --maintenance first; the app must stay stopped after the backup.'; exit 1; }
case "$(docker inspect "$APP" --format '{{.Config.Image}}')" in edms-ups:2.1.9) ;; *) printf '%s\n' UNEXPECTED_CURRENT_IMAGE; exit 1 ;; esac
PROJECT=/share/CACHEDEV1_DATA/.qpkg/container-station/data/application/edms-mutu-system
NAME=$(docker inspect "$APP" --format '{{index .Config.Labels "com.docker.compose.project"}}')
[ -n "$NAME" ]
NETWORK=$(docker inspect "$APP" --format '{{range $name,$network := .NetworkSettings.Networks}}{{println $name}}{{end}}')
[ "$(printf '%s\n' "$NETWORK" | wc -l | tr -d ' ')" = 1 ] || { printf '%s\n' 'Expected one existing application network'; exit 1; }
docker load --input "$OPS/edms-ups-2.1.10.tar"
[ "$(docker image inspect edms-ups:2.1.10 --format '{{.Os}}/{{.Architecture}}')" = linux/amd64 ]
[ "$(docker image inspect edms-ups:2.1.10 --format '{{json .RootFS.Layers}}')" = "$(cat "$OPS/image-layers.txt")" ] || { printf '%s\n' APP_IMAGE_LAYER_MISMATCH; exit 1; }
docker run --rm --network none --read-only --user 0 \
 --mount "type=bind,source=$OPS,target=/ops,readonly" \
 --mount "type=bind,source=$BACKUP,target=/backup,readonly" \
 --entrypoint node edms-ups:2.1.10 -e 'const fs=require("fs"),c=require("crypto");const sha=p=>c.createHash("sha256").update(fs.readFileSync(p)).digest("hex");const g=JSON.parse(fs.readFileSync("/ops/update-restore-gate.json","utf8"));if(g.passed!==true||g.productionTouched!==false||g.restoreVerified!==true||g.image!=="edms-ups:2.1.10"||g.packageManifestSha256!==sha("/ops/SHA256SUMS")||g.backupManifestSha256!==sha("/backup/SHA256SUMS"))process.exit(1);console.log("BACKUP_RESTORE_GATE_PASS",g.testRun)'
WORK=$OPS/attempt-$(date -u +%Y%m%dT%H%M%SZ)-$$
mkdir "$WORK"
docker inspect "$APP" > "$WORK/runtime.inspect.json"
chmod 600 "$WORK/runtime.inspect.json"
docker compose --project-name "$NAME" --project-directory "$PROJECT" -f "$PROJECT/docker-compose.yml" -f "$PROJECT/docker-compose.resource.yml" config --format json > "$WORK/before.json"
chmod 600 "$WORK/before.json"
docker run --rm --network none --read-only --user 0 --mount "type=bind,source=$OPS,target=/ops,readonly" --mount "type=bind,source=$WORK,target=/evidence" --entrypoint node edms-ups:2.1.10 /ops/app-update-compose.mjs
compose(){ docker compose --project-name "$NAME" --project-directory "$PROJECT" -f "$1" up --detach --no-deps --force-recreate edms-app; }
CHANGED=false
COMPLETE=false
# On failure only the image is reverted (no schema change in 2.1.10).
finish(){ code=$?; trap - EXIT; if [ "$CHANGED" = true ] && [ "$COMPLETE" != true ]; then printf '%s\n' APP_UPDATE_REVERTING_IMAGE; compose "$WORK/before.json" || true; fi; exit "$code"; }
trap finish EXIT
trap 'exit 130' HUP INT TERM
CHANGED=true
compose "$WORK/next.json"
ready=false
for n in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16 17 18 19 20 21 22 23 24 25 26 27 28 29 30; do
 if docker exec "$APP" node -e 'fetch("http://127.0.0.1:3000/api/v2/health",{signal:AbortSignal.timeout(3000)}).then(async r=>{const j=await r.json();process.exit(r.ok&&j.ok&&j.database&&j.version==="2.1.10"?0:1)}).catch(()=>process.exit(1))'; then ready=true; break; fi
 sleep 2
done
[ "$ready" = true ]
docker exec "$APP" /opt/pdf2docx-venv/bin/python -c 'import pdf2docx,fitz;print("PDF2DOCX_RUNTIME_OK",fitz.VersionBind)'
docker exec "$APP" node scripts/preflight.mjs > "$WORK/preflight.json"
cp -p "$WORK/next.json" "$PROJECT/docker-compose.yml"
docker inspect "$APP" --format '{{json .State}}' > "$WORK/final-state.json"
printf '{"passed":true,"version":"2.1.10","databaseMigration":"none","productionDummySmoke":false,"backupRestoreVerified":true,"backupManifestSha256":"%s"}\n' "$(sha256sum "$BACKUP/SHA256SUMS" | awk '{print $1}')" > "$WORK/completed.json"
COMPLETE=true
printf 'NAS_APP_UPDATE_PASS %s\n' "$WORK"
