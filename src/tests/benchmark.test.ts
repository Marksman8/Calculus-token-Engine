import { describe, it, expect } from "vitest";
import { DatasetEvaluator, RuleCoverageAnalyzer, DATASET_CASES } from "../benchmark/DatasetRunner/datasetEvaluator";

describe("DatasetEvaluator", () => {
  const evaluator = new DatasetEvaluator();

  it("evaluates all dataset cases", () => {
    const results = evaluator.evaluate();
    expect(results.length).toBe(DATASET_CASES.length);
  });

  it("each result has caseId", () => {
    const results = evaluator.evaluate();
    results.forEach((r) => expect(r.caseId).toBeTruthy());
  });

  it("results have rulesApplied array", () => {
    const results = evaluator.evaluate();
    results.forEach((r) => expect(Array.isArray(r.rulesApplied)).toBe(true));
  });

  it("simple d/dx[x] = 1 passes", () => {
    const testCase = DATASET_CASES.find((c) => c.id === "d004");
    expect(testCase).toBeDefined();
    const result = evaluator.evaluateOne(testCase!);
    expect(result.passed).toBe(true);
  });

  it("constant rule d/dx[5]=0 passes", () => {
    const testCase = DATASET_CASES.find((c) => c.id === "d003");
    expect(testCase).toBeDefined();
    const result = evaluator.evaluateOne(testCase!);
    expect(result.passed).toBe(true);
  });

  it("generates report", () => {
    const results = evaluator.evaluate();
    const report = evaluator.generateReport(results);
    expect(report.total).toBe(DATASET_CASES.length);
    expect(report.accuracy).toBeGreaterThanOrEqual(0);
    expect(report.accuracy).toBeLessThanOrEqual(1);
    expect(report.timestamp).toBeTruthy();
  });

  it("report has category breakdown", () => {
    const results = evaluator.evaluate();
    const report = evaluator.generateReport(results);
    expect(report.categoryBreakdown).toBeTruthy();
    expect(Object.keys(report.categoryBreakdown).length).toBeGreaterThan(0);
  });
});

describe("RuleCoverageAnalyzer", () => {
  it("analyzes rule usage", () => {
    const evaluator = new DatasetEvaluator();
    const results = evaluator.evaluate();
    const analyzer = new RuleCoverageAnalyzer();
    const coverage = analyzer.analyze(results);
    expect(coverage.totalRules).toBeGreaterThan(0);
    expect(Object.keys(coverage.ruleUsage).length).toBeGreaterThan(0);
  });

  it("sortedByUsage descending", () => {
    const evaluator = new DatasetEvaluator();
    const results = evaluator.evaluate();
    const analyzer = new RuleCoverageAnalyzer();
    const coverage = analyzer.analyze(results);
    const sorted = coverage.sortedByUsage;
    for (let i = 0; i < sorted.length - 1; i++) {
      expect(sorted[i][1]).toBeGreaterThanOrEqual(sorted[i + 1][1]);
    }
  });
});

describe("DATASET_CASES structure", () => {
  it("has derivative cases", () => {
    expect(DATASET_CASES.some((c) => c.category === "derivative")).toBe(true);
  });
  it("has integral cases", () => {
    expect(DATASET_CASES.some((c) => c.category === "integral")).toBe(true);
  });
  it("has limit cases", () => {
    expect(DATASET_CASES.some((c) => c.category === "limit")).toBe(true);
  });
  it("all cases have inputAST", () => {
    DATASET_CASES.forEach((c) => expect(c.inputAST).toBeTruthy());
  });
  it("all cases have expectedLatex", () => {
    DATASET_CASES.forEach((c) => expect(c.expectedLatex).toBeTruthy());
  });
  it("all cases have tags", () => {
    DATASET_CASES.forEach((c) => expect(c.tags.length).toBeGreaterThan(0));
  });
});
