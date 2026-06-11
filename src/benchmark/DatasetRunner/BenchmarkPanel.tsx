import React, { useState, useCallback } from "react";
import { DatasetEvaluator, RuleCoverageAnalyzer, DATASET_CASES } from "./datasetEvaluator";
import type { BenchmarkReport } from "./datasetEvaluator";
import { KatexRenderer } from "../../components/shared/KatexRenderer";
import "./BenchmarkPanel.css";

const BenchmarkPanel: React.FC = () => {
  const [report, setReport] = useState<BenchmarkReport | null>(null);
  const [coverage, setCoverage] = useState<ReturnType<RuleCoverageAnalyzer["analyze"]> | null>(null);
  const [running, setRunning] = useState(false);

  const runBenchmark = useCallback(() => {
    setRunning(true);
    setTimeout(() => {
      const evaluator = new DatasetEvaluator();
      const results = evaluator.evaluate(DATASET_CASES);
      const rep = evaluator.generateReport(results);
      const cov = new RuleCoverageAnalyzer().analyze(results);
      setReport(rep);
      setCoverage(cov);
      setRunning(false);
    }, 50);
  }, []);

  return (
    <div className="benchmark-panel">
      <div className="bench-header">
        <h3>Dataset Benchmark</h3>
        <p>Validates symbolic engine against calculus problem dataset.</p>
        <button className="run-btn" onClick={runBenchmark} disabled={running}>
          {running ? "Running…" : "▶ Run Benchmark"}
        </button>
      </div>

      {report && (
        <>
          <div className="bench-summary">
            <div className="bench-stat">
              <span className="stat-num">{(report.accuracy * 100).toFixed(1)}%</span>
              <span className="stat-lbl">Accuracy</span>
            </div>
            <div className="bench-stat">
              <span className="stat-num ok">{report.passed}</span>
              <span className="stat-lbl">Passed</span>
            </div>
            <div className="bench-stat">
              <span className="stat-num fail">{report.failed}</span>
              <span className="stat-lbl">Failed</span>
            </div>
            <div className="bench-stat">
              <span className="stat-num">{report.total}</span>
              <span className="stat-lbl">Total</span>
            </div>
          </div>

          <div className="bench-breakdown">
            <h4>Category Breakdown</h4>
            {Object.entries(report.categoryBreakdown).map(([cat, { passed, total }]) => (
              <div key={cat} className="breakdown-row">
                <span className="cat-name">{cat}</span>
                <div className="progress-bar">
                  <div className="progress-fill" style={{ width: `${(passed / total) * 100}%` }} />
                </div>
                <span className="cat-score">{passed}/{total}</span>
              </div>
            ))}
          </div>

          {coverage && (
            <div className="rule-coverage">
              <h4>Rule Coverage ({coverage.totalRules} rules applied)</h4>
              <div className="rule-grid">
                {coverage.sortedByUsage.map(([rule, count]) => (
                  <div key={rule} className="rule-chip">
                    <span>{rule}</span>
                    <span className="rule-count">{count}×</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {report.failedCases.length > 0 && (
            <div className="failed-cases">
              <h4>Failed Cases ({report.failedCases.length})</h4>
              {report.failedCases.map((c) => (
                <div key={c.caseId} className="failed-card">
                  <div className="failed-id">{c.caseId}: {c.description}</div>
                  <div className="failed-row">
                    <label>Expected:</label>
                    <KatexRenderer latex={c.expectedLatex} />
                  </div>
                  <div className="failed-row">
                    <label>Got:</label>
                    <KatexRenderer latex={c.actualLatex || "—"} />
                  </div>
                  {c.error && <div className="failed-error">{c.error}</div>}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default BenchmarkPanel;
