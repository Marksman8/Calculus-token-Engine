import React from "react";
import type { CompilationResult } from "../../types/pipeline";
import { KatexRenderer } from "../shared/KatexRenderer";
import "./CompilerTrace.css";

interface Props {
  result: CompilationResult | null;
}

const STAGES = [
  { id: "input", label: "Visual Input", icon: "⌨" },
  { id: "ast", label: "AST Builder", icon: "🌲" },
  { id: "validate", label: "AST Validator", icon: "✓" },
  { id: "engine", label: "Symbolic Engine", icon: "⚙" },
  { id: "steps", label: "Step Generator", icon: "📋" },
  { id: "render", label: "LaTeX Renderer", icon: "∫" },
];

const CompilerTrace: React.FC<Props> = ({ result }) => {
  if (!result) {
    return (
      <div className="trace-empty">
        <div className="pipeline-visual">
          {STAGES.map((stage, i) => (
            <React.Fragment key={stage.id}>
              <div className="pipeline-stage idle">
                <span className="stage-icon">{stage.icon}</span>
                <span className="stage-label">{stage.label}</span>
              </div>
              {i < STAGES.length - 1 && <div className="pipeline-arrow idle">↓</div>}
            </React.Fragment>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="trace-container">
      <div className="pipeline-visual">
        {STAGES.map((stage, i) => {
          const error = !result.success && stage.id === "engine";
          return (
            <React.Fragment key={stage.id}>
              <div className={`pipeline-stage ${error ? "error" : "done"}`}>
                <span className="stage-icon">{stage.icon}</span>
                <span className="stage-label">{stage.label}</span>
                {error && <span className="stage-error">✗</span>}
                {!error && <span className="stage-done">✓</span>}
              </div>
              {i < STAGES.length - 1 && <div className="pipeline-arrow done">↓</div>}
            </React.Fragment>
          );
        })}
      </div>

      <div className="trace-io">
        <div className="trace-block">
          <label>Input</label>
          <KatexRenderer latex={result.latexInput} block />
        </div>

        {result.success && (
          <div className="trace-block">
            <label>Output</label>
            <KatexRenderer latex={result.latexOutput} block />
          </div>
        )}

        {!result.success && result.error && (
          <div className="trace-error-msg">
            <label>Error</label>
            <code>{result.error}</code>
          </div>
        )}
      </div>

      <div className="trace-stats">
        <div className="stat">
          <span className="stat-label">Steps</span>
          <span className="stat-value">{result.steps.length}</span>
        </div>
        <div className="stat">
          <span className="stat-label">Status</span>
          <span className={`stat-value ${result.success ? "ok" : "fail"}`}>
            {result.success ? "OK" : "FAILED"}
          </span>
        </div>
        <div className="stat">
          <span className="stat-label">Rules applied</span>
          <span className="stat-value">
            {[...new Set(result.steps.map((s) => s.ruleApplied))].length}
          </span>
        </div>
      </div>

      {result.steps.length > 0 && (
        <div className="rule-debugger">
          <h4>Rule Debugger</h4>
          <div className="rule-list">
            {result.steps.map((step) => (
              <div key={step.id} className="rule-row">
                <span className="rule-step">#{step.stepNumber}</span>
                <span className="rule-name">{step.ruleApplied}</span>
                <span className="rule-desc">{step.ruleDescription}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default CompilerTrace;
