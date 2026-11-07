#!/bin/sh
set -eu
umask 077
cd /srv/cozy
stamp=$(date -u +%Y%m%dT%H%M%SZ)
target="/srv/cozy/backups/$stamp"
mkdir -p "$target"
docker compose exec -T db pg_dump -U cozy -d cozy_pajamas -Fc > "$target/database.dump"
docker compose exec -T app tar -C /app/uploads -czf - . > "$target/uploads.tgz"
test -s "$target/database.dump"
test -s "$target/uploads.tgz"
printf 'Backup completed: %s\n' "$target"
