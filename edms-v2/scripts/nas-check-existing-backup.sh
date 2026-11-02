#!/bin/sh
set -eu
OPS=/share/Container/edms-release/nas-update-9b220b7a
BACKUP=/share/Container/edms-backups/edms-update-20261029T235901Z-20829
APP=edms-ups-app
PATH=/share/CACHEDEV1_DATA/.qpkg/container-station/bin:/share/CACHEDEV1_DATA/.qpkg/container-station/usr/bin:$PATH; export PATH
[ ! -e "$BACKUP/INCOMPLETE" ] && [ ! -e "$BACKUP/update-completed.json" ]
grep -q '^backupComplete=true' "$BACKUP/backup-state.txt"
[ "$(docker inspect "$APP" --format '{{.Config.Image}}')" = edms-ups:2.1.1 ]
[ "$(docker inspect "$APP" --format '{{.State.Running}}')" = true ]
(cd "$OPS" && sha256sum -c SHA256SUMS)
NETWORK=$(docker inspect "$APP" --format '{{range $name,$network := .NetworkSettings.Networks}}{{println $name}}{{end}}')
[ "$(printf '%s\n' "$NETWORK" | wc -l | tr -d ' ')" = 1 ]
docker stop --time 30 "$APP" >/dev/null
SUCCESS=false
finish(){ if [ "$SUCCESS" != true ]; then docker start "$APP" >/dev/null; printf '%s\n' 'BACKUP_REUSE_NOT_VERIFIED: old service restarted; send the error output.'; fi; }
trap finish EXIT
trap 'exit 130' HUP INT TERM
docker run --rm --read-only --user 0 --network "$NETWORK" --add-host host.docker.internal:host-gateway \
 --mount "type=bind,source=$OPS/scripts,target=/opt/edms/scripts,readonly" \
 --mount "type=bind,source=$OPS/src/lib,target=/opt/edms/src/lib,readonly" \
 --mount "type=bind,source=$BACKUP,target=/evidence,readonly" \
 --mount "type=bind,source=/share/Container/edms-app/storage,target=/app/storage,readonly" \
 --mount "type=bind,source=/share/Container/edms-backups/edms-pre-v2-20261023T030626Z-25519/old-container.inspect.json,target=/admin-source.json,readonly" \
 --env EDMS_UPDATE=guarded --entrypoint node edms-ups:2.1.3 scripts/update-db.mjs baseline-check
SUCCESS=true
printf '%s\n' 'EXISTING_BACKUP_VERIFIED: EDMS stays stopped; send this result before applying.'
