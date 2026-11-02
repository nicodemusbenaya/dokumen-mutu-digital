#!/bin/sh
# Resume only the identified, unpublished cutover after its runtime was stopped.
# The original backup and rollback checkpoint remain immutable recovery inputs.
set -eu
umask 077
[ "$#" -eq 1 ] && [ "$1" = --deploy ] || exit 1
OPS=/share/Container/edms-release/nas-cutover-825e7356
ATTEMPT=resume-backup-directory
EVIDENCE=/share/Container/edms-backups/cutover-20261023T070635Z-12981
TRANSITION=$EVIDENCE/transition-package
BACKUP=/share/Container/edms-backups/edms-pre-v2-20261023T030626Z-25519
PROJECT=/share/CACHEDEV1_DATA/.qpkg/container-station/data/application/edms-mutu-system
compose() { docker compose -p edms-mutu-system -f "$PROJECT/docker-compose.yml" -f "$PROJECT/docker-compose.resource.yml" "$@"; }
[ "$(docker inspect --format '{{.State.Running}}' edms-ups-app)" = false ]
[ "$(docker inspect --format '{{.Config.Image}}' edms-ups-app)" = edms-ups:2.1.0 ]
[ "$(docker inspect --format '{{index .Config.Labels "com.docker.compose.project"}}' edms-ups-app)" = edms-mutu-system ]
[ ! -e "$EVIDENCE/deployment-result.txt" ]
[ ! -e "$EVIDENCE/$ATTEMPT-started" ]
cmp "$EVIDENCE/staging-compose.json" "$PROJECT/docker-compose.yml"
cmp "$EVIDENCE/resource-before.yml" "$PROJECT/docker-compose.resource.yml"
(cd "$OPS" && sha256sum -c SHA256SUMS)
(cd "$EVIDENCE" && sha256sum -c rollback-runtime.sha256)
docker run --rm --user 0 --read-only --network none --mount "type=bind,source=$OPS,target=/ops,readonly" --mount "type=bind,source=$EVIDENCE,target=/evidence,readonly" --entrypoint node edms-ups:2.1.0 -e '
const fs=require("fs"),c=require("crypto"),a=require("assert/strict");
const j=p=>JSON.parse(fs.readFileSync(p,"utf8").replace(/^\uFEFF/,""));
const r=j("/ops/rehearsal-pass.json"),applied=j("/evidence/apply-result.json");
a(r.passed&&r.runtime&&r.smoke&&r.restart&&r.rollback&&!r.productionTouched);
a.equal(c.createHash("sha256").update(fs.readFileSync("/ops/SHA256SUMS")).digest("hex"),r.cutoverPackageSha256);
a(applied.passed);a.equal(applied.manifestSha256,r.transitionManifestSha256);
a.equal(j("/evidence/runtime-normalized.json").services["edms-app"].environment.APP_ORIGIN,"http://10.10.200.166:3000");
console.log("RESUME_CHECKPOINT_RECEIPT_PASS");'
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
# Checks protected accounts/masters/audits and an empty register before starting.
ops verify
mv "$EVIDENCE/smoke-verified.json" "$EVIDENCE/$ATTEMPT-before-smoke.json"
printf '%s\n' 'Verified unpublished checkpoint; resuming remaining gates' > "$EVIDENCE/$ATTEMPT-started"
COMPLETE=false
MONITOR=
finish() {
 code=$?
 trap - EXIT HUP INT TERM
 if [ -n "$MONITOR" ]; then kill "$MONITOR" 2>/dev/null || true; fi
 docker inspect --format '{{json .State}}' edms-ups-app > "$EVIDENCE/$ATTEMPT-app-state.json" || true
 docker stats --no-stream --format '{{json .}}' edms-ups-app > "$EVIDENCE/$ATTEMPT-final-resource.json" || true
 if [ "$COMPLETE" != true ]; then
  docker stop edms-ups-app >/dev/null || true
  printf '%s\n' 'RESUME_HELD: application stopped; database preserved; inspect checkpoint before further action' >&2
  [ "$code" -ne 0 ] || code=1
 fi
 exit "$code"
}
trap finish EXIT
trap 'exit 130' HUP INT TERM
preflight() {
 for attempt in 1 2 3; do
  if docker exec edms-ups-app node scripts/preflight.mjs > "$EVIDENCE/$1-preflight-$attempt.json"; then
   cat "$EVIDENCE/$1-preflight-$attempt.json"
   return 0
  fi
  printf '%s\n' "PREFLIGHT_RETRY: $attempt"
  sleep 5
 done
 return 1
}
printf '%s\n' 'RESUME_STEP: start existing staged runtime and verify readiness'
compose start edms-app
ops health
preflight "$ATTEMPT"
printf '%s\n' 'RESUME_STEP: full synthetic DUMMY smoke and selective cleanup'
(
 while :; do docker stats --no-stream --format '{{json .}}' edms-ups-app >> "$EVIDENCE/$ATTEMPT-resource-during-smoke.jsonl"; sleep 5; done
) &
MONITOR=$!
ops smoke
kill "$MONITOR" 2>/dev/null || true
MONITOR=
ops verify
[ "$(docker inspect --format '{{.State.OOMKilled}}' edms-ups-app)" = false ]
printf '%s\n' 'RESUME_STEP: restart and repeat readiness gates'
compose stop edms-app
compose start edms-app
ops health
preflight "$ATTEMPT-restart"
printf '%s\n' 'RESUME_STEP: publish on the original LAN port'
cp -p "$EVIDENCE/runtime-compose.json" "$PROJECT/docker-compose.yml"
compose up -d --no-deps --pull never --force-recreate edms-app
ops health
preflight "$ATTEMPT-published"
printf '%s\n' 'passed=true' 'registerEmpty=true' 'runtimeAccountRestricted=true' 'dummySmokePassed=true' 'restartPassed=true' 'origin=http://10.10.200.166:3000' > "$EVIDENCE/deployment-result.txt"
COMPLETE=true
printf '%s\n' "NAS_DEPLOY_PASS $EVIDENCE"
