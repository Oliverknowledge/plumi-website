import assert from "node:assert/strict";
import { test } from "node:test";
import { partImage as bankPartImage, stemImage as bankStemImage, reportKey as bankReportKey, bankDataUrl } from "@/content/questionBank";
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
});

test("the bank's data files are named by their hash, as the public bank names them", () => {
  const data = { parts: "ec5b24991a", text: "64e44ff5d4", reports: "5fa70ece03", practicals: "4a3f82074d" };
  for (const f of ["parts", "text", "reports"] as const) {
    assert.equal(bankFile("aqa-gcse-physics", data, f), bankDataUrl({ slug: "aqa-gcse-physics", data }, f));
    assert.match(bankFile("aqa-gcse-physics", data, f)!, new RegExp(`/bank-data/aqa-gcse-physics/${f}\\.${data[f]}\\.json$`));
  }
});
test("a file the subject has no hash for is null, never a made-up address", () => {
  assert.equal(bankFile("x", { parts: "abc123" }, "reports"), null);
  assert.equal(bankFile("x", undefined, "parts"), null);
  assert.equal(bankFile("x", { parts: "../evil" }, "parts"), null);
  assert.equal(bankDataUrl({ slug: "x", data: { parts: "abc123" } }, "reports"), null);
});
