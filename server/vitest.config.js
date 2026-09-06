import { defineConfig } from "vitest/config";

// These integration tests all run against the same shared MongoDB Atlas
// cluster (transactions need a real replica set). Running test files in
// parallel puts enough concurrent load on the free-tier cluster that reads
// occasionally miss a just-committed write and transactions time out —
// which showed up as flaky failures in offer-lifecycle / deals. Run files
// one at a time: slower, but deterministic.
export default defineConfig({
  test: {
    fileParallelism: false,
    testTimeout: 30000,
    hookTimeout: 30000,
  },
});
