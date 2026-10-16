#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
# A supplied MySQL URL takes precedence over the local Docker database.
if [[ -n "${DATABASE_URL:-}" ]]; then exit 0; fi
if docker container inspect lifejam-mysql >/dev/null 2>&1; then
  docker start lifejam-mysql >/dev/null
else
  docker run -d --name lifejam-mysql \
    -e MYSQL_RANDOM_ROOT_PASSWORD=yes \
    -e MYSQL_DATABASE=lifejam -e MYSQL_USER=lifejam \
    -e MYSQL_PASSWORD=lifejam_local_dev \
    -p 127.0.0.1:3306:3306 mysql:8.4 >/dev/null
fi
for attempt in $(seq 1 45); do
  if docker exec -e MYSQL_PWD=lifejam_local_dev lifejam-mysql mysql -h127.0.0.1 -ulifejam -e 'SELECT 1' lifejam >/dev/null 2>&1; then exit 0; fi
  sleep 1
done
printf '%s\n' 'Local MySQL did not become ready. Inspect docker logs lifejam-mysql.' >&2
exit 1
