#!/bin/sh
set -eu
umask 077
PATH=/share/CACHEDEV1_DATA/.qpkg/container-station/bin:/share/CACHEDEV1_DATA/.qpkg/container-station/usr/bin:$PATH; export PATH
OPS=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd -P)
case "$OPS" in /share/Container/edms-release/app-update-2.1.5|/share/CACHEDEV1_DATA/Container/edms-release/app-update-2.1.5) ;; *) exit 1 ;; esac
cd "$OPS"
sha256sum -c SHA256SUMS
APP=edms-ups-app
[ "$(docker inspect "$APP" --format '{{.Config.Image}}')" = edms-ups:2.1.4 ]
[ "$(docker inspect "$APP" --format '{{.State.Running}}')" = true ]
PROJECT=/share/CACHEDEV1_DATA/.qpkg/container-station/data/application/edms-mutu-system
NAME=$(docker inspect "$APP" --format '{{index .Config.Labels "com.docker.compose.project"}}')
[ -n "$NAME" ]
docker load --input "$OPS/edms-ups-2.1.5.tar"
[ "$(docker image inspect edms-ups:2.1.5 --format '{{.Os}}/{{.Architecture}}')" = linux/amd64 ]
[ "$(docker image inspect edms-ups:2.1.5 --format '{{json .RootFS.Layers}}')" = "$(cat "$OPS/image-layers.txt")" ] || { printf '%s\n' APP_IMAGE_LAYER_MISMATCH; exit 1; }
printf '%s\n' APP_IMAGE_LAYERS_VERIFIED
WORK=$OPS/attempt-$(date -u +%Y%m%dT%H%M%SZ)-$$
mkdir "$WORK"
docker compose --project-name "$NAME" --project-directory "$PROJECT" -f "$PROJECT/docker-compose.yml" -f "$PROJECT/docker-compose.resource.yml" config --format json > "$WORK/before.json"
chmod 600 "$WORK/before.json"
docker run --rm --network none --read-only --user 0 --mount "type=bind,source=$OPS,target=/ops,readonly" --mount "type=bind,source=$WORK,target=/evidence" --entrypoint node edms-ups:2.1.5 /ops/app-update-compose.mjs
compose(){ docker compose --project-name "$NAME" --project-directory "$PROJECT" -f "$1" up --detach --no-deps --force-recreate edms-app; }
CHANGED=false
COMPLETE=false
finish(){ code=$?; trap - EXIT; if [ "$CHANGED" = true ] && [ "$COMPLETE" != true ]; then printf '%s\n' APP_UPDATE_REVERTING_IMAGE; compose "$WORK/before.json" || true; fi; exit "$code"; }
trap finish EXIT
trap 'exit 130' HUP INT TERM
CHANGED=true
compose "$WORK/next.json"
ready=false
for n in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16 17 18 19 20 21 22 23 24 25 26 27 28 29 30; do
 if docker exec "$APP" node -e 'fetch("http://127.0.0.1:3000/api/v2/health",{signal:AbortSignal.timeout(3000)}).then(async r=>{const j=await r.json();process.exit(r.ok&&j.ok&&j.database&&j.version==="2.1.5"?0:1)}).catch(()=>process.exit(1))'; then ready=true; break; fi
 sleep 2
done
[ "$ready" = true ]
docker exec "$APP" node scripts/preflight.mjs > "$WORK/preflight.json"
cp -p "$WORK/next.json" "$PROJECT/docker-compose.yml"
docker inspect "$APP" --format '{{json .State}}' > "$WORK/final-state.json"
printf '%s\n' '{"passed":true,"version":"2.1.5","imageOnly":true,"databaseMigration":false,"newDataBackup":false}' > "$WORK/completed.json"
COMPLETE=true
printf 'NAS_APP_UPDATE_PASS %s\n' "$WORK"
