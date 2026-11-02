#!/bin/sh
# Check only: DB/Compose unchanged; a uniquely named DUMMY storage probe is removed.
set -eu
umask 077
fail() { printf '%s\n' "NAS_TRANSITION_CHECK_BLOCKED: $*" >&2; exit 1; }
[ "$#" -eq 0 ] || fail 'No arguments expected'
PACKAGE=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd -P)
case "$PACKAGE" in /share/Container/edms-release/*|/share/CACHEDEV1_DATA/Container/edms-release/*) ;; *) fail 'Place the complete package below /share/Container/edms-release' ;; esac
BACKUP=/share/Container/edms-backups/edms-pre-v2-20261023T030626Z-25519
PROJECT=/share/CACHEDEV1_DATA/.qpkg/container-station/data/application/edms-mutu-system
[ ! -e "$PACKAGE/INCOMPLETE" ] && [ -f "$PACKAGE/package.json" ] || fail 'Incomplete package'
[ ! -e "$BACKUP/INCOMPLETE" ] || fail 'Incomplete backup'
[ "$(docker inspect --format '{{.State.Running}}' edms-ups-app)" = false ] || fail 'Keep old app stopped for maintenance'
[ "$(docker inspect --format '{{index .Config.Labels "com.docker.compose.project"}}' edms-ups-app)" = edms-mutu-system ] || fail 'Unexpected Compose project'
[ "$(docker inspect --format '{{index .Config.Labels "com.docker.compose.service"}}' edms-ups-app)" = edms-app ] || fail 'Unexpected Compose service'
[ "$(docker image inspect edms-ups:2.1.0 --format '{{.Os}}/{{.Architecture}}')" = linux/amd64 ] || fail 'Wrong release platform'
case "$(docker image inspect edms-ups:2.1.0 --format '{{.Id}}')" in
 sha256:e7b383b2f9faa5fe7b1b12324c354adf968d602f9fb8a0cf02c1d070d125823a|sha256:3c028487b4bc794fd7a4502391ede6af0e5be8f3bc4e86cecaafa5138085c4ba) ;; *) fail 'Unverified image' ;; esac
docker inspect edms-ups-app --format '{{range .Mounts}}{{println .Source .Destination}}{{end}}' | awk '
 $1=="/share/Container/edms-app" && $2=="/app" {app=1}
 $1=="/share/Container/edms-app/storage" && $2=="/app/storage" {storage=1}
 END {exit !(app && storage)}' || fail 'Existing mounts differ'
docker compose version >/dev/null || fail 'Docker Compose unavailable'
WORK=$(mktemp -d /tmp/edms-transition-check.XXXXXX)
chmod 700 "$WORK"
trap 'rm -f "$WORK/compose.json"; rmdir "$WORK"' EXIT
trap 'exit 130' HUP INT TERM
docker compose -p edms-mutu-system -f "$PROJECT/docker-compose.yml" -f "$PROJECT/docker-compose.resource.yml" -f "$PACKAGE/compose.override.yml" config --format json > "$WORK/compose.json" || fail 'Merged Compose invalid'
(cd "$BACKUP" && sha256sum -c SHA256SUMS) || fail 'NAS backup checksum mismatch'
EVIDENCE=/share/Container/edms-backups/transition-check-$(date -u +%Y%m%dT%H%M%SZ)-$$
mkdir "$EVIDENCE"
chmod 700 "$EVIDENCE"
printf '%s\n' 'NAS_CHECK_STEP: validate backup, recovery originals and unchanged database (read-only)'
docker run --rm --read-only --user 0 --network edms-mutu-system_default --add-host host.docker.internal:host-gateway \
 --mount "type=bind,source=$PACKAGE,target=/transition,readonly" \
 --mount "type=bind,source=$PACKAGE/empty-register-core.mjs,target=/opt/edms/scripts/empty-register-core.mjs,readonly" \
 --mount "type=bind,source=$PACKAGE/nas-transition-check.mjs,target=/opt/edms/scripts/nas-transition-check.mjs,readonly" \
 --mount "type=bind,source=$BACKUP,target=/backup,readonly" \
 --mount "type=bind,source=$EVIDENCE,target=/evidence" \
 --mount "type=bind,source=$WORK/compose.json,target=/merged-compose.json,readonly" \
 --env NAS_TRANSITION_CHECK=read-only --entrypoint node edms-ups:2.1.0 scripts/nas-transition-check.mjs || fail 'Read-only DB/manifest check failed'
printf '%s\n' 'NAS_CHECK_STEP: runtime UID 1000 writes and removes a unique DUMMY probe in each v2 storage directory'
docker run --rm --read-only --user 1000:1000 --volumes-from edms-ups-app --network none --entrypoint node edms-ups:2.1.0 -e '
const fs=require("node:fs"),crypto=require("node:crypto");
for(const name of ["originals","derived","staging","work"]){
 const dir="/app/storage/"+name;let probe,created=false;
 try{fs.mkdirSync(dir,{recursive:true});if(fs.lstatSync(dir).isSymbolicLink())throw Error("Storage symlink rejected");probe=dir+"/DUMMY-DEPLOY-PROBE-"+crypto.randomUUID();fs.writeFileSync(probe,"DUMMY runtime access",{flag:"wx",mode:384});created=true;fs.unlinkSync(probe);created=false;console.log("STORAGE_WRITE_PASS: "+dir);}
 catch(e){console.error("STORAGE_WRITE_BLOCKED: "+dir+" "+(e.code||e.message));process.exitCode=1;}
 finally{if(created)fs.unlinkSync(probe);}
}' || fail 'UID 1000 cannot access storage; do not apply the transition'
printf '%s\n' "NAS_CHECK_READY $EVIDENCE" 'Old app remains stopped. No DB deletion, runtime replacement or Compose change was performed.'
