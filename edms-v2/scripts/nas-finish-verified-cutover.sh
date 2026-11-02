#!/bin/sh
# Finish only the named staged runtime whose complete NAS smoke already passed.
set -eu
umask 077
[ "$#" -eq 1 ] && [ "$1" = --deploy ] || exit 1
OPS=/share/Container/edms-release/nas-cutover-825e7356
EVIDENCE=/share/Container/edms-backups/cutover-20261023T070635Z-12981
TRANSITION=$EVIDENCE/transition-package
BACKUP=/share/Container/edms-backups/edms-pre-v2-20261023T030626Z-25519
PROJECT=/share/CACHEDEV1_DATA/.qpkg/container-station/data/application/edms-mutu-system
[ ! -e "$EVIDENCE/deployment-result.txt" ]
[ ! -e "$EVIDENCE/FINALIZE_STABLE_STARTED" ]
[ "$(docker inspect --format '{{.State.Running}}' edms-ups-app)" = true ]
[ "$(docker inspect --format '{{.Config.Image}}' edms-ups-app)" = edms-ups:2.1.0 ]
cmp "$EVIDENCE/staging-compose.json" "$PROJECT/docker-compose.yml"
cmp "$EVIDENCE/resource-before.yml" "$PROJECT/docker-compose.resource.yml"
(cd "$OPS" && sha256sum -c SHA256SUMS)
docker run --rm --user 0 --read-only --network none --mount "type=bind,source=$OPS,target=/ops,readonly" --mount "type=bind,source=$EVIDENCE,target=/evidence,readonly" --entrypoint node edms-ups:2.1.0 -e '
const fs=require("fs"),c=require("crypto"),a=require("assert/strict");
const j=p=>JSON.parse(fs.readFileSync(p,"utf8").replace(/^\uFEFF/,""));
const r=j("/ops/rehearsal-pass.json"),s=j("/evidence/smoke-verified.json");
a(r.passed&&r.runtime&&r.smoke&&r.restart&&r.rollback&&!r.productionTouched);
a.equal(c.createHash("sha256").update(fs.readFileSync("/ops/SHA256SUMS")).digest("hex"),r.cutoverPackageSha256);
a(s.passed&&s.protectedDataVerified&&s.registerEmpty&&!s.rehearsal);
a.equal(j("/evidence/apply-result.json").manifestSha256,r.transitionManifestSha256);
a.equal(j("/evidence/runtime-normalized.json").services["edms-app"].environment.APP_ORIGIN,"http://10.10.200.166:3000");
console.log("FINALIZE_NAS_SMOKE_RECEIPT_PASS");'
ops() {
 docker run --rm --user 0 --read-only --network edms-mutu-system_default --add-host host.docker.internal:host-gateway \
  --mount "type=bind,source=$OPS/scripts,target=/opt/edms/scripts,readonly" \
  --mount "type=bind,source=$OPS/tests,target=/opt/edms/tests,readonly" \
  --mount "type=bind,source=$TRANSITION,target=/transition,readonly" \
  --mount "type=bind,source=$BACKUP,target=/backup,readonly" \
  --mount "type=bind,source=$EVIDENCE,target=/evidence" \
  --mount "type=bind,source=/share/Container/edms-app/storage,target=/app/storage" \
  --env EDMS_CUTOVER=guarded --env CUTOVER_BASE_URL=http://edms-ups-app:3000 \
  --entrypoint node edms-ups:2.1.0 scripts/nas-cutover.mjs "$1"
}
COMPLETE=false
finish() {
 code=$?
 trap - EXIT HUP INT TERM
 if [ "$COMPLETE" != true ]; then
  docker stop edms-ups-app >/dev/null || true
  printf '%s\n' 'FINALIZE_HELD: application stopped; database retained; no automatic restore after possible publication' >&2
  [ "$code" -ne 0 ] || code=1
 fi
 exit "$code"
}
trap finish EXIT
trap 'exit 130' HUP INT TERM
printf '%s\n' 'Finalizing passed NAS smoke with in-container readiness and three consecutive preflights' > "$EVIDENCE/FINALIZE_STABLE_STARTED"
health() {
 attempt=0
 while [ "$attempt" -lt 60 ]; do
  if docker exec edms-ups-app node -e 'fetch("http://127.0.0.1:3000/api/v2/health").then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))'; then
   printf '%s\n' 'IN_CONTAINER_HEALTH_PASS'
   return 0
  fi
  attempt=$((attempt+1))
  sleep 1
 done
 return 1
}
preflight() {
 attempt=1
 stable=0
 while [ "$attempt" -le 12 ]; do
  if docker exec edms-ups-app node scripts/preflight.mjs > "$EVIDENCE/$1-preflight-$attempt.json"; then
   cat "$EVIDENCE/$1-preflight-$attempt.json"
   stable=$((stable+1))
   if [ "$stable" -eq 3 ]; then return 0; fi
  else
   stable=0
   printf '%s\n' "PREFLIGHT_NOT_READY: $attempt"
  fi
  attempt=$((attempt+1))
  sleep 5
 done
 return 1
}
# Retain the actual post-smoke evidence, then verify protection before restarting.
[ ! -e "$EVIDENCE/post-smoke-before-stable-check.json" ]
mv "$EVIDENCE/smoke-verified.json" "$EVIDENCE/post-smoke-before-stable-check.json"
ops verify
printf '%s\n' 'FINALIZE_STEP: restart the same EDMS container directly'
docker restart edms-ups-app
health
preflight stable-final-restart
[ "$(docker inspect --format '{{.State.OOMKilled}}' edms-ups-app)" = false ]
printf '%s\n' 'FINALIZE_STEP: publish the verified service on its original LAN port'
cp -p "$EVIDENCE/runtime-compose.json" "$PROJECT/docker-compose.yml"
docker compose -p edms-mutu-system -f "$PROJECT/docker-compose.yml" -f "$PROJECT/docker-compose.resource.yml" up -d --no-deps --pull never --force-recreate edms-app
health
preflight stable-final-published
docker inspect --format '{{json .State}}' edms-ups-app > "$EVIDENCE/final-app-state.json"
docker stats --no-stream --format '{{json .}}' edms-ups-app > "$EVIDENCE/final-resource-published.json"
printf '%s\n' 'passed=true' 'registerEmpty=true' 'runtimeAccountRestricted=true' 'dummySmokePassed=true' 'restartPassed=true' 'origin=http://10.10.200.166:3000' > "$EVIDENCE/deployment-result.txt"
COMPLETE=true
printf '%s\n' "NAS_DEPLOY_PASS $EVIDENCE"
