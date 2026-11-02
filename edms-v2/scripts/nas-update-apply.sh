#!/bin/sh
# Update the SAME v2 service. Existing documents, versions, accounts and storage stay.
set -eu
umask 077
fail(){ printf '%s\n' "NAS_UPDATE_BLOCKED: $*" >&2; exit 1; }
[ "$#" -eq 2 ] || fail 'Use: sh nas-update-apply.sh --deploy|--resume BACKUP_DIRECTORY'
case "$1" in --deploy|--resume) ;; *) fail 'Expected --deploy or --resume' ;; esac
MODE=$1
OPS=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd -P)
BACKUP=$2
case "$OPS" in /share/Container/edms-release/nas-update-*|/share/CACHEDEV1_DATA/Container/edms-release/nas-update-*) ;; *) fail 'Unexpected update package path' ;; esac
case "$BACKUP" in /share/Container/edms-backups/edms-update-*) ;; *) fail 'A fresh update backup is required' ;; esac
[ ! -e "$BACKUP/update-completed.json" ] && [ ! -e "$BACKUP/INCOMPLETE" ] || fail 'Update already used or backup incomplete'
APP=edms-ups-app
SOURCE=/share/Container/edms-app
ADMIN_JSON=/share/Container/edms-backups/edms-pre-v2-20261023T030626Z-25519/old-container.inspect.json
PROJECT=/share/CACHEDEV1_DATA/.qpkg/container-station/data/application/edms-mutu-system
MYSQL=/share/CACHEDEV1_DATA/.qpkg/MariaDB10/bin/mariadb
[ -x "$MYSQL" ] || MYSQL=/share/CACHEDEV1_DATA/.qpkg/MariaDB10/bin/mysql
[ -x "$MYSQL" ] || fail 'Native DB client missing'
[ "$(docker inspect "$APP" --format '{{.State.Running}}')" = false ] || fail 'Backup maintenance must remain active'
(cd "$OPS" && sha256sum -c SHA256SUMS) || fail 'Package checksum mismatch'
(cd "$BACKUP" && sha256sum -c SHA256SUMS) || fail 'Backup checksum mismatch'
NETWORK=$(docker inspect "$APP" --format '{{range $name,$network := .NetworkSettings.Networks}}{{println $name}}{{end}}')
[ "$(printf '%s\n' "$NETWORK" | wc -l | tr -d ' ')" = 1 ] || fail 'Expected one existing application network'
PROJECT_NAME=$(docker inspect "$APP" --format '{{index .Config.Labels "com.docker.compose.project"}}')
[ -n "$PROJECT_NAME" ] || fail 'Existing Compose project label missing'
WORK=$(mktemp -d /tmp/edms-update.XXXXXX)
chmod 700 "$WORK"
docker image inspect edms-ups:2.1.3 > "$BACKUP/update-image.json"
docker run --rm --network none --read-only --user 0 \
 --mount "type=bind,source=$OPS,target=/ops,readonly" \
 --mount "type=bind,source=$OPS/scripts,target=/opt/edms/scripts,readonly" \
 --mount "type=bind,source=$OPS/src/lib,target=/opt/edms/src/lib,readonly" \
 --mount "type=bind,source=$BACKUP,target=/backup,readonly" \
 --mount "type=bind,source=$BACKUP,target=/evidence,readonly" \
 --entrypoint node edms-ups:2.1.3 scripts/update-check.mjs rehearsal
ops(){
 docker run --rm --read-only --user 0 --network "$NETWORK" --add-host host.docker.internal:host-gateway \
  --mount "type=bind,source=$OPS,target=/ops,readonly" \
  --mount "type=bind,source=$OPS/scripts,target=/opt/edms/scripts,readonly" \
  --mount "type=bind,source=$OPS/src/lib,target=/opt/edms/src/lib,readonly" \
  --mount "type=bind,source=$OPS/tests,target=/opt/edms/tests,readonly" \
  --mount "type=bind,source=$ADMIN_JSON,target=/admin-source.json,readonly" \
  --mount "type=bind,source=$SOURCE/storage,target=/app/storage" \
  --mount "type=bind,source=$BACKUP,target=/evidence" \
  --mount "type=bind,source=$WORK,target=/secrets" \
  --env EDMS_UPDATE=guarded --entrypoint node edms-ups:2.1.3 scripts/update-db.mjs "$1"
}
compose(){ docker compose --project-name "$PROJECT_NAME" --project-directory "$PROJECT" -f "$1" up --detach --no-deps --force-recreate edms-app; }
health(){
 attempt=0
 while [ "$attempt" -lt 60 ]; do
  if docker exec "$APP" node -e 'fetch("http://127.0.0.1:3000/api/v2/health",{signal:AbortSignal.timeout(3000)}).then(async r=>{const j=await r.json();process.exit(r.ok&&j.ok?0:1)}).catch(()=>process.exit(1))'; then return 0; fi
  attempt=$((attempt+1)); sleep 2
 done
 return 1
}
TOUCHED=false
PUBLISHED=false
COMPLETE=false
MONITOR=
finish(){
 code=$?
 trap - EXIT HUP INT TERM
 if [ -n "$MONITOR" ]; then kill "$MONITOR" 2>/dev/null || true; wait "$MONITOR" 2>/dev/null || true; fi
 if [ "$COMPLETE" != true ] && [ "$TOUCHED" = true ]; then
  docker stop --time 30 "$APP" >/dev/null || true
  if [ "$PUBLISHED" = true ]; then
   printf '%s\n' 'Update failed after LAN publication. App stopped; preserve current DB/files, do not restore an old snapshot over new writes.' >&2
  else
   printf '%s\n' 'UPDATE_ROLLBACK_STEP: verify baseline files, restore pre-update DB and original Compose' >&2
   if ops rollback-cleanup && ops client && \
      "$MYSQL" --defaults-extra-file="$WORK/client.cnf" --protocol=TCP --host=127.0.0.1 --port=3307 --database=edms_ups < "$BACKUP/database.sql"; then
    tar -xOf "$BACKUP/compose-project.tar" ./docker-compose.yml > "$PROJECT/docker-compose.yml"
    docker compose --project-name "$PROJECT_NAME" --project-directory "$PROJECT" -f "$PROJECT/docker-compose.yml" -f "$PROJECT/docker-compose.resource.yml" up --detach --no-deps --force-recreate edms-app
    if health; then printf '%s\n' 'UPDATE_ROLLBACK_RUNTIME_READY' >&2; else printf '%s\n' 'Rollback runtime needs inspection' >&2; fi
   else printf '%s\n' 'Rollback did not complete. Keep EDMS stopped; inspect fresh backup and current files.' >&2; fi
  fi
 fi
 rm -f "$WORK/client.cnf"
 rmdir "$WORK" || true
 if [ "$COMPLETE" != true ] && [ "$code" -eq 0 ]; then code=1; fi
 exit "$code"
}
trap finish EXIT
trap 'exit 130' HUP INT TERM
if [ "$MODE" = --resume ]; then
 ops resume-check
 [ -f "$BACKUP/update-staging-compose.json" ] && [ -f "$BACKUP/update-runtime-compose.json" ] || fail 'Existing staging configuration missing'
else
docker compose --project-name "$PROJECT_NAME" --project-directory "$PROJECT" -f "$PROJECT/docker-compose.yml" -f "$PROJECT/docker-compose.resource.yml" config --format json > "$BACKUP/update-compose-before.json"
docker run --rm --network none --read-only --user 0 \
 --mount "type=bind,source=$OPS/scripts,target=/opt/edms/scripts,readonly" \
 --mount "type=bind,source=$OPS/src/lib,target=/opt/edms/src/lib,readonly" \
 --mount "type=bind,source=$BACKUP,target=/evidence" \
 --env EDMS_UPDATE=guarded --entrypoint node edms-ups:2.1.3 scripts/update-compose.mjs
TOUCHED=true
ops migrate
fi
TOUCHED=true
compose "$BACKUP/update-staging-compose.json"
health || fail 'Staging health failed'
(
 while :; do
  sample=$(docker stats --no-stream --format '{{json .}}' "$APP" 2>/dev/null) || sample=
  if [ -n "$sample" ]; then printf '{"at":"%s","stats":%s}\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$sample" >> "$BACKUP/update-resource-during-smoke.jsonl"; fi
  sleep 3
 done
) &
MONITOR=$!
ops smoke
ops verify
docker restart "$APP" >/dev/null
health || fail 'Restart health failed'
for n in 1 2 3; do docker exec "$APP" node scripts/preflight.mjs > "$BACKUP/update-restart-preflight-$n.json"; done
ops verify
# From this point, never restore a pre-update DB automatically: users may write again.
PUBLISHED=true
cp -p "$BACKUP/update-runtime-compose.json" "$PROJECT/docker-compose.yml"
docker compose --project-name "$PROJECT_NAME" --project-directory "$PROJECT" -f "$PROJECT/docker-compose.yml" -f "$PROJECT/docker-compose.resource.yml" up --detach --no-deps --force-recreate edms-app
health || fail 'Published health failed'
for n in 1 2 3; do docker exec "$APP" node scripts/preflight.mjs > "$BACKUP/update-published-preflight-$n.json"; done
docker inspect "$APP" > "$BACKUP/update-final-container.json"
docker stats --no-stream --format '{{json .}}' "$APP" > "$BACKUP/update-final-resource.json"
printf '%s\n' '{"passed":true,"version":"2.1.3","documentsPreserved":true,"smoke":true,"restart":true,"published":true}' > "$BACKUP/update-completed.json"
COMPLETE=true
printf 'NAS_UPDATE_PASS %s\n' "$BACKUP"
