export async function explorerSqlForDatabase(connection, source) {
  const [columns] = await connection.query(`SELECT CHARACTER_SET_NAME, COLLATION_NAME
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='v2_documents' AND COLUMN_NAME='id'`);
  const column = columns[0];
  if (!column || !/^utf8mb4$/.test(column.CHARACTER_SET_NAME || '') ||
      !/^utf8mb4_[a-z0-9_]+$/.test(column.COLLATION_NAME || '')) {
    throw new Error('Kolasi ID dokumen tidak tersedia atau bukan utf8mb4; migrasi Explorer dihentikan.');
  }
  return source.replaceAll('__DOCUMENT_ID_CHARSET__', column.CHARACTER_SET_NAME)
    .replaceAll('__DOCUMENT_ID_COLLATION__', column.COLLATION_NAME);
}
