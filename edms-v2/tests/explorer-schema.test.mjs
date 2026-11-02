import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {explorerSqlForDatabase} from '../scripts/explorer-schema.mjs';

test('Explorer relation uses existing document ID collation even after a partial migration', async () => {
  const source = await readFile(new URL('../sql/006_file_explorer.sql', import.meta.url), 'utf8');
  const connection = {query: async () => [[{CHARACTER_SET_NAME: 'utf8mb4', COLLATION_NAME: 'utf8mb4_general_ci'}]]};
  const sql = await explorerSqlForDatabase(connection, source);
  assert.match(sql, /document_id CHAR\(36\) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci PRIMARY KEY/);
  assert.match(sql, /folder_id CHAR\(36\) NOT NULL/);
  assert.doesNotMatch(sql, /__DOCUMENT_ID_COLLATION__/);
});

test('Explorer migration stops if the referenced ID collation cannot be verified', async () => {
  const source = await readFile(new URL('../sql/006_file_explorer.sql', import.meta.url), 'utf8');
  await assert.rejects(explorerSqlForDatabase({query: async () => [[]]}, source), /Kolasi ID dokumen/);
});
