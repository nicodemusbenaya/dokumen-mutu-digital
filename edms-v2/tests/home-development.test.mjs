import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';

test('home account fixture refuses any non-home database before connecting', () => {
  for (const env of [
    {DB_NAME: 'edms_ups', DB_HOST: '127.0.0.1', DB_PORT: '33307'},
    {DB_NAME: 'edms_home', DB_HOST: '10.10.200.166', DB_PORT: '33307'},
    {DB_NAME: 'edms_home', DB_HOST: '127.0.0.1', DB_PORT: '3307'}
  ]) {
    const result = spawnSync(process.execPath, ['scripts/seed-home-db.mjs'], {
      cwd: new URL('../', import.meta.url), encoding: 'utf8',
      env: {...process.env, ...env, EDMS_HOME: 'true', HOME_ADMIN_PASSWORD: 'a'.repeat(32)}
    });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Fixture rumah hanya boleh/);
  }
});

test('home Compose binds database to loopback and uses its own volume', () => {
  const compose = readFileSync(new URL('../compose.home.yml', import.meta.url), 'utf8');
  assert.match(compose, /127\.0\.0\.1:33307:3306/);
  assert.match(compose, /MARIADB_DATABASE: edms_home/);
  assert.match(compose, /home_db:\/var\/lib\/mysql/);
  assert.doesNotMatch(compose, /10\.10\.200\.166|edms_ups|\/share\/Container/);
});
