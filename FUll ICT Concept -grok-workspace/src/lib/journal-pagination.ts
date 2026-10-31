export function paginateJournalRows<T>(rows: T[], requestedPage: number, pageSize: number) {
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const page = Math.min(Math.max(1, requestedPage), totalPages);
  const startIndex = (page - 1) * pageSize;

  return {
    page,
    totalPages,
    startIndex,
    rows: rows.slice(startIndex, startIndex + pageSize),
  };
}
