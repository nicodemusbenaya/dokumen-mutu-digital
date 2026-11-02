#!/bin/sh
# First-release cutover only. Failures before publication restore the verified DB
# and original Compose. After publication, stop and preserve new writes for review.
set -eu
umask 077
fail() { printf '%s\n' "NAS_CUTOVER_BLOCKED: $*" >&2; exit 1; }
[ "$#" -eq 1 ] && [ "$1" = --deploy ] || fail 'Use: sh nas-cutover.sh --deploy'
OPS=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd -P)
case "$OPS" in /share/Container/edms-release/*|/share/CACHEDEV1_DATA/Container/edms-release/*) ;; *) fail 'Place package inside edms-release' ;; esac
TRANSITION=/share/Container/edms-release/nas-transition-453aaecb
[ ! -e "$OPS/REHEARSAL_IN_PROGRESS" ] && [ ! -e "$OPS/INCOMPLETE" ] || fail 'Package preparation or rehearsal is incomplete'
BACKUP=/share/Container/edms-backups/edms-pre-v2-20261023T030626Z-25519
PROJECT=/share/CACHEDEV1_DATA/.qpkg/container-station/data/application/edms-mutu-system
MYSQL=/share/CACHEDEV1_DATA/.qpkg/MariaDB10/bin/mariadb
[ -x "$MYSQL" ] || MYSQL=/share/CACHEDEV1_DATA/.qpkg/MariaDB10/bin/mysql
[ -x "$MYSQL" ] || fail 'Native MariaDB client missing'
[ "$(docker inspect --format '{{.State.Running}}' edms-ups-app)" = false ] || fail 'Old application must remain stopped'
(cd "$OPS" && sha256sum -c SHA256SUMS) || fail 'Cutover package changed'
docker run --rm --network none --read-only --user 0 --mount "type=bind,source=$OPS,target=/ops,readonly" --entrypoint node edms-ups:2.1.0 -e '
const fs=require("fs"),c=require("crypto"),a=require("assert/strict");
const r=JSON.parse(fs.readFileSync("/ops/rehearsal-pass.json","utf8").replace(/^\uFEFF/,""));
a(r.passed&&r.runtime&&r.smoke&&r.restart&&r.rollback&&!r.productionTouched,"Cutover rehearsal not passed");
a.equal(c.createHash("sha256").update(fs.readFileSync("/ops/SHA256SUMS")).digest("hex"),r.cutoverPackageSha256,"Cutover code differs from rehearsal");
a.equal(r.transitionManifestSha256,"87ea2acb5037933c3a54615d70c76374223abca8cd8e5833731daffee68fee65");
console.log("CUTOVER_REHEARSAL_RECEIPT_PASS");' || fail 'Laptop cutover rehearsal missing or stale'
# Re-run the already passed checks immediately before mutation.
sh "$TRANSITION/nas-transition-check.sh"
EVIDENCE=/share/Container/edms-backups/cutover-$(date -u +%Y%m%dT%H%M%SZ)-$$
mkdir "$EVIDENCE"
chmod 700 "$EVIDENCE"
cp -p "$PROJECT/docker-compose.yml" "$EVIDENCE/compose-before.yml"
cp -p "$PROJECT/docker-compose.resource.yml" "$EVIDENCE/resource-before.yml"
# Supplementary recovery originals are retained with the cutover checkpoint,
# separately from live storage and without changing the sealed original backup.
cp -R "$TRANSITION" "$EVIDENCE/transition-package"
TRANSITION=$EVIDENCE/transition-package
WORK=$(mktemp -d /tmp/edms-cutover.XXXXXX)
chmod 700 "$WORK"
ROLLBACK_IMAGE=edms-ups-rollback:cutover-$(date -u +%Y%m%d%H%M%S)-$$
COMPLETE=false
TOUCHED=false
PUBLISHED=false
COMPOSE_CHANGED=false
TUNNEL_WAS_RUNNING=$(docker inspect --format '{{.State.Running}}' edms-cloudflare-tunnel)
MONITOR=
ops() {
 operation=$1
 net=$2
 docker run --rm --user 0 --read-only --network "$net" --add-host host.docker.internal:host-gateway \
  --mount "type=bind,source=$OPS/scripts,target=/opt/edms/scripts,readonly" \
  --mount "type=bind,source=$OPS/tests,target=/opt/edms/tests,readonly" \
  --mount "type=bind,source=$TRANSITION,target=/transition,readonly" \
  --mount "type=bind,source=$BACKUP,target=/backup,readonly" \
  --mount "type=bind,source=$EVIDENCE,target=/evidence" \
  --mount "type=bind,source=$WORK,target=/secrets" \
  --mount "type=bind,source=$WORK/merged.json,target=/merged-compose.json,readonly" \
  --mount "type=bind,source=$WORK/original.json,target=/original-compose.json,readonly" \
  --mount "type=bind,source=/share/Container/edms-app/storage,target=/app/storage" \
  --env EDMS_CUTOVER=guarded --env "ROLLBACK_IMAGE=$ROLLBACK_IMAGE" --env CUTOVER_BASE_URL=http://edms-ups-app:3000 --env "COMPOSE_EXPECTED=${COMPOSE_EXPECTED:-staging-normalized.json}" \
  --env "EDMS_PUBLIC_ORIGIN=${EDMS_PUBLIC_ORIGIN:-}" \
  --entrypoint node edms-ups:2.1.0 scripts/nas-cutover.mjs "$operation"
}
compose() { docker compose -p edms-mutu-system -f "$PROJECT/docker-compose.yml" -f "$PROJECT/docker-compose.resource.yml" "$@"; }
capture() {
 docker logs --tail 200 edms-ups-app > "$EVIDENCE/app-stdout.log" 2> "$EVIDENCE/app-stderr.log" || true
 docker inspect --format '{{json .State}}' edms-ups-app > "$EVIDENCE/app-state.json" || true
 docker stats --no-stream --format '{{json .}}' edms-ups-app > "$EVIDENCE/final-resource.json" || true
}
finish() {
 code=$?
 trap - EXIT HUP INT TERM
 if [ -n "$MONITOR" ]; then kill "$MONITOR" 2>/dev/null || true; fi
 capture
 if [ "$COMPLETE" != true ]; then
  printf '%s\n' "NAS_CUTOVER_FAILED: checkpoint $EVIDENCE" >&2
  if [ "$TOUCHED" = true ] && [ "$PUBLISHED" = false ]; then
   printf '%s\n' 'ROLLBACK_STEP: keep public tunnel stopped; stop only EDMS before restoring DB'
   # A failed recreation can leave no app container at all. In either case,
   # require zero remaining database clients before replaying the backup.
   stopped=false
   inventory=$(docker ps -a --filter 'name=^/edms-ups-app$' --format '{{.Names}}') || inventory=unknown
   if [ -z "$inventory" ]; then stopped=true
   elif [ "$inventory" = edms-ups-app ] && docker stop edms-ups-app >/dev/null; then stopped=true; fi
   clients=$("$MYSQL" --defaults-file="$WORK/client.cnf" --database=edms_ups --batch --skip-column-names --execute "SELECT COUNT(*) FROM information_schema.PROCESSLIST WHERE DB='edms_ups' AND ID<>CONNECTION_ID()") || clients=unknown
   if [ "$stopped" = true ] && [ "$clients" = 0 ]; then
    if "$MYSQL" --defaults-file="$WORK/client.cnf" --database=edms_ups < "$BACKUP/database.sql" && ops rollback-verify edms-mutu-system_default; then
     cp -p "$EVIDENCE/rollback-compose.json" "$PROJECT/docker-compose.yml"
     if compose up -d --no-deps --pull never --force-recreate edms-app; then
      printf '%s\n' 'NAS_ROLLBACK_COMPLETE: original DB and old runtime restored; tunnel stays stopped for inspection' >&2
     else printf '%s\n' 'ROLLBACK_BLOCKED: DB restored; inspect old runtime startup before reopening' >&2; fi
    else printf '%s\n' 'ROLLBACK_BLOCKED: keep application/tunnel stopped; verified backup and checkpoint are preserved' >&2; fi
   else printf '%s\n' 'ROLLBACK_BLOCKED: could not stop EDMS; database was not restored while a writer may be running' >&2; fi
  elif [ "$PUBLISHED" = true ]; then
   docker stop edms-ups-app >/dev/null || true
   printf '%s\n' 'POST_PUBLISH_HOLD: app stopped; DB retained to preserve any new writes. No automatic DB restore.' >&2
  elif [ "$COMPOSE_CHANGED" = true ]; then
   cp -p "$EVIDENCE/compose-before.yml" "$PROJECT/docker-compose.yml"
  fi
  [ "$code" -ne 0 ] || code=1
 fi
 rm -f "$WORK/client.cnf" "$WORK/merged.json" "$WORK/original.json" "$WORK/tunnel.log"
 rmdir "$WORK" || true
 exit "$code"
}
trap finish EXIT
trap 'exit 130' HUP INT TERM
docker compose -p edms-mutu-system -f "$PROJECT/docker-compose.yml" -f "$PROJECT/docker-compose.resource.yml" -f "$TRANSITION/compose.override.yml" config --format json > "$WORK/merged.json"
compose config --format json > "$WORK/original.json"
docker logs --tail 500 edms-cloudflare-tunnel > "$WORK/tunnel.log" 2>&1
printf '%s\n' 'CUTOVER_STEP: preserve the stopped old container filesystem, including installed Chromium'
docker commit edms-ups-app "$ROLLBACK_IMAGE" > "$EVIDENCE/rollback-image-id.txt"
docker image save --output "$EVIDENCE/rollback-runtime.tar" "$ROLLBACK_IMAGE"
(cd "$EVIDENCE" && sha256sum rollback-runtime.tar > rollback-runtime.sha256)
docker run --rm --network none --entrypoint sh "$ROLLBACK_IMAGE" -c 'command -v chromium-browser >/dev/null && node --version' || fail 'Old runtime checkpoint is not usable'
printf '%s\n' 'CUTOVER_STEP: prepare restricted DB account and persistent service configuration'
ops prepare edms-mutu-system_default
[ "$(stat -c '%a' "$WORK/client.cnf")" = 600 ] || fail 'Cannot protect native DB credentials'
printf '%s\n' 'CUTOVER_STEP: validate final Compose interpolation before deleting any document'
for kind in staging runtime; do
 docker compose -p edms-mutu-system -f "$EVIDENCE/$kind-compose.json" -f "$PROJECT/docker-compose.resource.yml" config --format json > "$WORK/merged.json"
 COMPOSE_EXPECTED=$kind-normalized.json ops compose-check edms-mutu-system_default
done
if [ "$TUNNEL_WAS_RUNNING" = true ]; then docker stop edms-cloudflare-tunnel >/dev/null; fi
printf '%s\n' 'CUTOVER_STEP: apply the successfully rehearsed empty-register manifest'
TOUCHED=true
ops apply edms-mutu-system_default
COMPOSE_CHANGED=true
cp -p "$EVIDENCE/staging-compose.json" "$PROJECT/docker-compose.yml"
printf '%s\n' 'CUTOVER_STEP: recreate ONLY edms-app with loopback-only port during smoke'
compose up -d --no-deps --pull never --force-recreate edms-app
ops health edms-mutu-system_default
docker exec edms-ups-app node scripts/preflight.mjs > "$EVIDENCE/runtime-preflight.json"
cat "$EVIDENCE/runtime-preflight.json"
printf '%s\n' 'CUTOVER_STEP: synthetic DUMMY upload/download/management and both conversion directions'
(
 while :; do docker stats --no-stream --format '{{json .}}' edms-ups-app >> "$EVIDENCE/resource-during-smoke.jsonl"; sleep 5; done
) &
MONITOR=$!
ops smoke edms-mutu-system_default
kill "$MONITOR" 2>/dev/null || true
MONITOR=
ops verify edms-mutu-system_default
[ "$(docker inspect --format '{{.State.OOMKilled}}' edms-ups-app)" = false ] || fail 'Runtime was OOM killed'
printf '%s\n' 'CUTOVER_STEP: restart the same app service and verify health again'
compose stop edms-app
compose start edms-app
ops health edms-mutu-system_default
docker exec edms-ups-app node scripts/preflight.mjs > "$EVIDENCE/runtime-after-restart.json"
printf '%s\n' 'CUTOVER_STEP: publish the verified service on its original port'
cp -p "$EVIDENCE/runtime-compose.json" "$PROJECT/docker-compose.yml"
# A public/LAN writer may connect from this point. Never automatically restore an older DB after this flag.
PUBLISHED=true
compose up -d --no-deps --pull never --force-recreate edms-app
ops health edms-mutu-system_default
if [ "$TUNNEL_WAS_RUNNING" = true ]; then docker start edms-cloudflare-tunnel >/dev/null; fi
printf '%s\n' 'passed=true' 'registerEmpty=true' 'runtimeAccountRestricted=true' 'dummySmokePassed=true' 'restartPassed=true' > "$EVIDENCE/deployment-result.txt"
COMPLETE=true
printf '%s\n' "NAS_DEPLOY_PASS $EVIDENCE" 'Service edms-ups-app updated. Original mount, network, port and tunnel retained. Other services were not recreated.'
