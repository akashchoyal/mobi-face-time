import { describe, test } from "node:test";
import { strict as assert } from "node:assert";
import { runLiveScanCycle } from "./live-scan";

describe("live attendance", () => {
  test("saves all 60 recognized students together", async () => {
    const ids = Array.from({ length: 60 }, (_, i) => `student-${i}`);
    let saved: string[] = [];
    await runLiveScanCycle(async () => ids, () => true, (r) => r, async (_, r) => { saved = r; });
    assert.deepEqual(saved, ids);
    assert.equal(saved.length, 60);
  });
  test("does not save when stopped during recognition", async () => {
    let calls = 0;
    await runLiveScanCycle(async () => ["student-1"], () => false, (r) => r, async () => { calls++; });
    assert.equal(calls, 0);
  });
  test("unrecognized faces never create attendance", async () => {
    let calls = 0;
    await runLiveScanCycle(async () => [], () => true, (r) => r, async () => { calls++; });
    assert.equal(calls, 0);
  });
});