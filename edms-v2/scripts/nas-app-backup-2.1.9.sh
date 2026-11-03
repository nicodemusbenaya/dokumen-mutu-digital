#!/bin/sh
# Consistent backup for update 2.1.9 (Form Zoho: migration 010 adds Zoho tables and drops the 2.1.8 form-builder tables). No document deletion.
# Run on the NAS after stopping laptop development processes that write edms_ups.
set -eu
umask 077

APP=edms-ups-app
SOURCE=/share/Container/edms-app
COMPOSE=/share/CACHEDEV1_DATA/.qpkg/container-station/data/application/edms-mutu-system
DEST=/share/Container/edms-backups
ADMIN_JSON=/share/Container/edms-backups/edms-pre-v2-20261023T030626Z-25519/old-container.inspect.json
MYSQL=/share/CACHEDEV1_DATA/.qpkg/MariaDB10/bin/mariadb
DUMP=/share/CACHEDEV1_DATA/.qpkg/MariaDB10/bin/mariadb-dump

fail() { printf '%s\n' "BACKUP_BLOCKED: $*" >&2; exit 1; }
[ "${1:-}" = "--maintenance" ] && [ "$#" -eq 1 ] || fail 'Use: sh nas-app-backup.sh --maintenance; app stays stopped on success pending restore verification.'
for tool in docker tar sha256sum find sort awk date mktemp stat chmod rmdir; do command -v "$tool" >/dev/null 2>&1 || fail "Missing tool: $tool"; done
[ -x "$MYSQL" ] || MYSQL=/share/CACHEDEV1_DATA/.qpkg/MariaDB10/bin/mysql
[ -x "$MYSQL" ] && [ -x "$DUMP" ] || fail 'Native MariaDB client/dump unavailable'
[ -f "$ADMIN_JSON" ] || fail 'Protected administrative DB credential checkpoint missing'
[ -d "$SOURCE" ] && [ ! -L "$SOURCE" ] || fail 'Source must be the existing application directory'
[ -f "$COMPOSE/docker-compose.yml" ] && [ -f "$COMPOSE/docker-compose.resource.yml" ] || fail 'Original Compose files missing'
[ "$(docker inspect --format '{{.State.Running}}' "$APP")" = true ] || fail 'Old application must initially be running'
CURRENT_IMAGE=$(docker inspect "$APP" --format '{{.Config.Image}}')
case "$CURRENT_IMAGE" in edms-ups:2.1.4|edms-ups:2.1.5|edms-ups:2.1.6|edms-ups:2.1.7|edms-ups:2.1.8) ;; *) fail 'Unexpected current image; re-inventory before backup' ;; esac
IMAGE=$(docker inspect "$APP" --format '{{.Image}}')
docker inspect "$APP" --format '{{range .Mounts}}{{println .Source .Destination}}{{end}}' | awk '
 $1=="/share/Container/edms-app" && $2=="/app" {app=1}
 $1=="/share/Container/edms-app/storage" && $2=="/app/storage" {storage=1}
 END {exit !(app && storage)}' || fail 'Existing mounts changed; re-inventory before backup'

mkdir -p "$DEST"
BACKUP=$DEST/edms-update-$(date -u +%Y%m%dT%H%M%SZ)-$$
mkdir "$BACKUP"
chmod 700 "$BACKUP"
docker inspect "$APP" > "$BACKUP/old-container.inspect.json"
chmod 600 "$BACKUP/old-container.inspect.json"
CLIENT_DIR=
CLIENT=
STOPPED=false
COMPLETE=false
finish() {
 code=$?
 trap - EXIT HUP INT TERM
 if [ -n "$CLIENT" ]; then rm -f "$CLIENT"; fi
 if [ -n "$CLIENT_DIR" ]; then rmdir "$CLIENT_DIR" || printf '%s\n' 'Private temporary directory needs inspection' >&2; fi
 if [ "$COMPLETE" != true ]; then
  printf '%s\n' BACKUP_INCOMPLETE > "$BACKUP/INCOMPLETE"
  if [ "$STOPPED" = true ]; then
   if docker start "$APP" >/dev/null; then
    printf '%s\n' 'Backup failed; old application restarted. No data deleted.' >&2
   else
    printf '%s\n' 'WARNING: failed to restart old application; run docker start edms-ups-app.' >&2
   fi
  fi
  [ "$code" -ne 0 ] || code=1
 fi
 exit "$code"
}
trap finish EXIT
trap 'exit 130' HUP INT TERM

NETWORK=$(docker inspect "$APP" --format '{{range $name,$network := .NetworkSettings.Networks}}{{println $name}}{{end}}')
[ "$(printf '%s\n' "$NETWORK" | wc -l | tr -d ' ')" = 1 ] || fail 'Expected one existing application network'
printf '%s\n' 'BACKUP_STEP: validate native DB access without printing secrets'
# Shared-folder ACLs can override umask. Keep credentials off the NAS share.
CLIENT_DIR=$(mktemp -d /tmp/edms-db-client.XXXXXX)
chmod 700 "$CLIENT_DIR"
[ "$(stat -c '%a' "$CLIENT_DIR")" = 700 ] || fail 'Cannot protect temporary client directory'
CLIENT=$CLIENT_DIR/client.cnf
# Credentials go only to a private temporary client file, never into command arguments.
docker run --rm --read-only --user 0 --network none --mount "type=bind,source=$ADMIN_JSON,target=/admin-source.json,readonly" --entrypoint node "$CURRENT_IMAGE" -e '
 const source=JSON.parse(require("fs").readFileSync("/admin-source.json","utf8"))[0];
 const e=Object.fromEntries(source.Config.Env.map(v=>{const i=v.indexOf("=");return [v.slice(0,i),v.slice(i+1)]}));
 if(e.DB_NAME!=="edms_ups" || e.DB_USER!=="root" || !e.DB_PASSWORD || String(e.DB_PORT)!=="3307" || !["host.docker.internal","10.10.200.166"].includes(e.DB_HOST))process.exit(2);
 const quote=v=>"\""+String(v).replace(/\\/g,"\\\\").replace(/\"/g,"\\\"").replace(/\n/g,"\\n").replace(/\r/g,"\\r")+"\"";
 process.stdout.write("[client]\nprotocol=tcp\nhost=127.0.0.1\nport=3307\nuser="+quote(e.DB_USER)+"\npassword="+quote(e.DB_PASSWORD)+"\n");
' > "$CLIENT"
chmod 600 "$CLIENT"
[ "$(stat -c '%a' "$CLIENT")" = 600 ] || fail 'MariaDB client file permissions must be 600'
mysql_read() { "$MYSQL" --defaults-extra-file="$CLIENT" --protocol=TCP --host=127.0.0.1 --port=3307 --database=edms_ups --batch --raw --skip-column-names "$@"; }
DATABASE=$(mysql_read -e 'SELECT DATABASE()') || fail 'Native TCP database authentication failed; old app remains running'
[ "$DATABASE" = edms_ups ] || fail 'Wrong database'
[ "$(mysql_read -e "SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_TYPE='BASE TABLE' AND ENGINE<>'InnoDB'")" = 0 ] || fail 'Non-InnoDB tables need a separate consistent-backup strategy'
[ "$(mysql_read -e 'SELECT COUNT(*) FROM users')" -gt 0 ] || fail 'Production accounts unexpectedly missing'
# EVENT_PROBE_BEGIN
# Never enable the scheduler or omit existing event definitions to bypass an error.
docker run --rm --read-only --user 0 --network "$NETWORK" --add-host host.docker.internal:host-gateway --mount "type=bind,source=$ADMIN_JSON,target=/admin-source.json,readonly" --entrypoint node "$CURRENT_IMAGE" -e '
 const source=JSON.parse(require("fs").readFileSync("/admin-source.json","utf8"))[0];
 (async()=>{
  const e=Object.fromEntries(source.Config.Env.map(v=>{const i=v.indexOf("=");return [v.slice(0,i),v.slice(i+1)]}));
  const db=await require("mysql2/promise").createConnection({host:e.DB_HOST,port:Number(e.DB_PORT),user:e.DB_USER,password:e.DB_PASSWORD,database:e.DB_NAME,connectTimeout:10000});
  try{
   const [[setting]]=await db.query("SELECT @@GLOBAL.event_scheduler AS scheduler");
   const scheduler=String(setting.scheduler).toUpperCase();
   let inventory="information-schema",count;
   try{
    const [events]=await db.query("SELECT EVENT_NAME AS name, STATUS AS status FROM information_schema.EVENTS WHERE EVENT_SCHEMA=DATABASE()");
    count=events.length;
    if(scheduler==="ON"&&events.some(event=>event.status==="ENABLED"))throw new Error("Active DB events need a separate maintenance plan");
   }catch(error){
    if(error.errno!==1577||!["OFF","DISABLED"].includes(scheduler))throw error;
    const [[row]]=await db.query("SELECT CAST(COUNT(*) AS CHAR) AS total FROM mysql.event WHERE db=?",[e.DB_NAME]);
    if(BigInt(row.total)!==0n)throw new Error("Event definitions exist but cannot be exported; backup blocked");
    inventory="system-table-empty";count=0;
   }
   process.stdout.write("scheduler="+scheduler+"\ninventory="+inventory+"\nexpectedCount="+count+"\n");
  }finally{await db.end();}
 })().catch(error=>{console.error("EVENT_PROBE_BLOCKED",error.code||error.message);process.exitCode=1;});
' > "$BACKUP/event-policy.txt" || fail 'Cannot verify event definitions safely; old application remains running'
# EVENT_PROBE_END
EVENT_INVENTORY=$(awk -F= '$1=="inventory" {print $2}' "$BACKUP/event-policy.txt")
case "$EVENT_INVENTORY" in
 information-schema)
  EVENT_DUMP_FLAG=--events
  EVENT_SQL="UNION ALL SELECT CONCAT('EVENT',CHAR(9),EVENT_NAME,CHAR(9),'EVENT') FROM information_schema.EVENTS WHERE EVENT_SCHEMA=DATABASE()"
  ;;
 system-table-empty)
  EVENT_DUMP_FLAG=--skip-events
  EVENT_SQL=
  printf '%s\n' 'BACKUP_INFO: scheduler unavailable; mysql.event confirms zero events for edms_ups'
  ;;
 *) fail 'Invalid event inventory evidence' ;;
esac
"$DUMP" --version > "$BACKUP/dump-version.txt"
mysql_read -e 'SELECT VERSION()' > "$BACKUP/db-version.txt"

printf '%s\n' 'BACKUP_STEP: preserve old runtime and Compose configuration'
docker inspect "$APP" > "$BACKUP/old-container.inspect.json"
OLD_IMAGE=$(docker inspect "$APP" --format '{{.Image}}')
docker image save --output "$BACKUP/old-runtime-image.tar" "$OLD_IMAGE"
tar -C "$COMPOSE" -cpf "$BACKUP/compose-project.tar" .
tar -tf "$BACKUP/compose-project.tar" >/dev/null

printf '%s\n' 'BACKUP_STEP: maintenance - stopping ONLY edms-ups-app'
# Set before stop so the error trap also handles a partially completed stop.
STOPPED=true
docker stop --time 30 "$APP" >/dev/null
[ "$(docker inspect "$APP" --format '{{.State.Running}}')" = false ] || fail 'Application did not stop'
[ "$(mysql_read -e 'SELECT COUNT(*) FROM information_schema.PROCESSLIST WHERE DB=DATABASE() AND ID<>CONNECTION_ID()')" = 0 ] || fail 'Other DB sessions remain; stop laptop/dev writers before retrying'

printf '%s\n' 'BACKUP_STEP: snapshot database and table counts'
"$DUMP" --defaults-extra-file="$CLIENT" --protocol=TCP --host=127.0.0.1 --port=3307 --single-transaction --quick --hex-blob \
 --routines "$EVENT_DUMP_FLAG" --triggers --skip-lock-tables --no-tablespaces \
 --default-character-set=utf8mb4 edms_ups > "$BACKUP/database.sql"
[ -s "$BACKUP/database.sql" ] || fail 'Empty database dump'
mysql_read -e "SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_TYPE='BASE TABLE' ORDER BY TABLE_NAME" > "$BACKUP/table-names.txt"
: > "$BACKUP/table-counts.tsv"
while IFS= read -r table; do
 case "$table" in ''|*[!A-Za-z0-9_]*) fail 'Unsafe SQL table identifier' ;; esac
 count=$(mysql_read -e "SELECT COUNT(*) FROM \`$table\`")
 printf '%s\t%s\n' "$table" "$count" >> "$BACKUP/table-counts.tsv"
done < "$BACKUP/table-names.txt"
mysql_read -e "SELECT CONCAT('TABLE',CHAR(9),TABLE_NAME,CHAR(9),TABLE_TYPE) AS object_name FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() UNION ALL SELECT CONCAT('TRIGGER',CHAR(9),TRIGGER_NAME,CHAR(9),'TRIGGER') FROM information_schema.TRIGGERS WHERE TRIGGER_SCHEMA=DATABASE() UNION ALL SELECT CONCAT('ROUTINE',CHAR(9),ROUTINE_NAME,CHAR(9),ROUTINE_TYPE) FROM information_schema.ROUTINES WHERE ROUTINE_SCHEMA=DATABASE() $EVENT_SQL ORDER BY object_name" > "$BACKUP/db-objects.tsv"

printf '%s\n' 'BACKUP_STEP: archive full old app including storage, originals and secrets'
tar -C /share/Container -czpf "$BACKUP/app.tar.gz" edms-app
tar -tzf "$BACKUP/app.tar.gz" >/dev/null
(
 cd /share/Container
 find edms-app -type f -exec sha256sum '{}' \;
) > "$BACKUP/app-files.sha256"
[ -s "$BACKUP/app-files.sha256" ] || fail 'Empty app/storage file inventory'

printf '%s\n' 'BACKUP_STEP: seal backup evidence'
(
 cd "$BACKUP"
  sha256sum database.sql app.tar.gz app-files.sha256 table-names.txt table-counts.tsv db-objects.tsv \
   old-runtime-image.tar old-container.inspect.json compose-project.tar db-version.txt dump-version.txt event-policy.txt > SHA256SUMS
 sha256sum -c SHA256SUMS
)
printf '%s\n' 'backupComplete=true' 'restoreVerified=false' 'maintenance=true' \
 'database=edms_ups' "image=$IMAGE" > "$BACKUP/backup-state.txt"
COMPLETE=true
printf 'BACKUP_READY_FOR_RESTORE %s\n' "$BACKUP"
printf '%s\n' 'edms-ups-app remains STOPPED for update restore/rehearsal. Existing documents are preserved; other services unchanged.'
printf '%s\n' 'To cancel maintenance without any transition, run: docker start edms-ups-app'
