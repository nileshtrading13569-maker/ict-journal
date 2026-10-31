import assert from "node:assert/strict";
import test from "node:test";
import { paginateJournalRows } from "./journal-pagination.ts";

test("paginateJournalRows clamps an out-of-range page to the last available journal page", () => {
  const result = paginateJournalRows(["a", "b", "c"], 4, 2);

  assert.equal(result.page, 2);
  assert.equal(result.totalPages, 2);
  assert.deepEqual(result.rows, ["c"]);
});
