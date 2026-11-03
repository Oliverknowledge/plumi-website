import assert from "node:assert/strict";
import { test } from "node:test";
import { partImage as bankPartImage, stemImage as bankStemImage, reportKey as bankReportKey, bankDataPath } from "@/content/questionBank";
import { bankFile, partImage, reportKey, stemImage } from "./cropUrls";

test("the study app's picture addresses are the bank's own", () => {
  for (const id of ["84631h-jun25-01-1", "9ch001-jun23-02-3-b"]) {
    for (const v of [undefined, 3]) {
      for (const kind of ["qp", "ms", "stem"] as const) assert.equal(partImage(id, kind, v), bankPartImage(id, kind, v), `${id} ${kind} ${v}`);
      assert.equal(stemImage({ id }, v), bankStemImage({ id }, v));
      assert.equal(stemImage({ id, sk: "x-01" }, v), bankStemImage({ id, sk: "x-01" }, v));
    }
  }
  assert.equal(reportKey(false, "74051-jun23-01-4"), bankReportKey({ reportsBy: undefined }, "74051-jun23-01-4"));
  assert.equal(reportKey(true, "wma11-jun23-01"), bankReportKey({ reportsBy: "question" }, "wma11-jun23-01"));
  for (const f of ["parts", "text", "reports"] as const) assert.equal(bankFile("aqa-gcse-physics", f), bankDataPath("aqa-gcse-physics", f));
});
