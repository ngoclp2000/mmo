#!/usr/bin/env bash
set -euo pipefail
# Only the disposable local test database is created here. No existing database is dropped.
docker --host=unix:///var/run/docker.sock compose exec -T mysql sh -c 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql -uroot' <<'SQL'
CREATE DATABASE IF NOT EXISTS commerceos_test;
GRANT ALL PRIVILEGES ON commerceos_test.* TO 'commerce'@'%';
SQL
DATABASE_URL="mysql://commerce:${MYSQL_PASSWORD:-commerce_local}@127.0.0.1:3306/commerceos_test" npm run migrate
