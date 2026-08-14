/**
 * Finds the first non-empty file/URL value among the given column names on a row.
 * Used to conditionally show a Download action only when a stage actually has an
 * uploaded file (Drive link) recorded against it.
 */
export const findFileLink = (headers, rowData, fieldNames) => {
  for (const name of fieldNames) {
    const idx = headers.findIndex(h => h && h.toString().trim().toLowerCase() === name.toLowerCase());
    if (idx === -1) continue;
    const val = rowData[idx];
    if (val && val.toString().trim().startsWith('http')) return val.toString().trim();
  }
  return null;
};
