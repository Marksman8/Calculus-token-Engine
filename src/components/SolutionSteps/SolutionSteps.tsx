import React, { useState } from "react";
import type { SolutionStep } from "../../types/pipeline";
import { KatexRenderer } from "../shared/KatexRenderer";
import "./SolutionSteps.css";

interface Props {
  steps: SolutionStep[];
  finalLatex: string;
}

const SolutionSteps: React.FC<Props> = ({ steps, finalLatex }) => {
  const [expanded, setExpanded] = useState<string | null>(null);

  if (steps.length === 0) {
    return (
      <div className="steps-empty">
        <p>No solution steps yet. Build an expression and compile it.</p>
      </div>
    );
  }

  return (
    <div className="steps-container">
      <div className="steps-header">
        <span className="steps-count">{steps.length} step{steps.length !== 1 ? "s" : ""}</span>
        <span className="steps-subtitle">Deterministic symbolic derivation</span>
      </div>

      <div className="steps-list">
        {steps.map((step) => (
          <div
            key={step.id}
            className={`step-card ${expanded === step.id ? "expanded" : ""}`}
            onClick={() => setExpanded(expanded === step.id ? null : step.id)}
          >
            <div className="step-header">
              <span className="step-number">Step {step.stepNumber}</span>
              <span className="rule-badge">{step.ruleApplied}</span>
              <span className="step-toggle">{expanded === step.id ? "▲" : "▼"}</span>
            </div>

            <div className="step-preview">
              <KatexRenderer latex={step.latexBefore} />
              <span className="arrow">→</span>
              <KatexRenderer latex={step.latexAfter} />
            </div>

            {expanded === step.id && (
              <div className="step-detail">
                <p className="rule-description">{step.ruleDescription}</p>
                <div className="step-comparison">
                  <div className="step-before">
                    <label>Before</label>
                    <KatexRenderer latex={step.latexBefore} block />
                  </div>
                  <div className="step-after">
                    <label>After</label>
                    <KatexRenderer latex={step.latexAfter} block />
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="final-answer">
        <label>Final Answer</label>
        <KatexRenderer latex={finalLatex} block />
      </div>
    </div>
  );
};

export default SolutionSteps;
