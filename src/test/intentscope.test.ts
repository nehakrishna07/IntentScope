import { describe, it, expect } from "vitest";
import {
  intentLabel,
  isCompliant,
  CLASS_COUNT,
  MAX_TOKENS,
  submissionCsv,
} from "@/lib/intentscope";
import metrics from "@/data/metrics.json";
describe("Competition rules", () => {
  it("enforces 300 million total parameters including boundary", () => {
    expect(isCompliant(300_000_000)).toBe(true);
    expect(isCompliant(300_000_001)).toBe(false);
  });
  it("has 56 classes", () => {
    expect(CLASS_COUNT).toBe(56);
  });
  it("limits token length to 64", () => {
    expect(MAX_TOKENS).toBe(64);
  });
  it("labels Class 55 as OOS, without invented names", () => {
    expect(intentLabel(55)).toBe("Out-of-Scope Query");
    expect(intentLabel(0)).toBe("Intent 0");
    expect(intentLabel(54)).toBe("Intent 54");
  });
  it("exports exactly two columns preserving IDs and order", () => {
    expect(
      submissionCsv([
        { example_id: "001", target: 55 },
        { example_id: "a,b", target: 0 },
      ]),
    ).toBe('example_id,target\n001,55\n"a,b",0');
  });
  it("keeps validation and leaderboard scores distinct", () => {
    expect(metrics.validation_f1).toBe(0.85716);
    expect(metrics.leaderboard_f1).toBe(0.8196);
  });
  it("retains original eight-epoch results and best epoch", () => {
    expect(metrics.epochs).toHaveLength(8);
    expect(metrics.best_epoch).toBe(8);
    expect(metrics.epochs.at(-1)?.accuracy).toBeCloseTo(87.367, 8);
  });
});
