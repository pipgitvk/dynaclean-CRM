/** Match order creator to login username (ignores trailing spaces in DB). */
export function sqlOrderCreatedByEquals(columnAlias = "no.created_by") {
  return `TRIM(${columnAlias}) = TRIM(?)`;
}
