import React, { useState, useCallback, useRef } from "react";
import type { ASTNode } from "../../types/ast";
import { parseExpression } from "../../compiler/parser/parseExpression";
import { KatexRenderer } from "../shared/KatexRenderer";
import { astToLatex } from "../../renderer/latex/latexRenderer";
import "./PasteInput.css";

interface Props {
  onAST: (ast: ASTNode) => void;
}

const EXAMPLES = [
  { label: "x² + 2x + 1", value: "x^2 + 2*x + 1" },
  { label: "sin(x) + cos(x)", value: "sin(x) + cos(x)" },
  { label: "d/dx[x³]", value: "d/dx[x^3]" },
  { label: "d/dx[sin(x)]", value: "d/dx[sin(x)]" },
  { label: "∫x² dx", value: "INT(x^2, x)" },
  { label: "∫sin(x) dx", value: "INT(sin(x), x)" },
  { label: "lim(x→0)[sin(x)/x]", value: "lim(x->0, sin(x)/x)" },
  { label: "x² = y + 1", value: "x^2 = y + 1" },
  { label: "(x+1)/(x-1)", value: "(x+1)/(x-1)" },
  { label: "e^x + ln(x)", value: "e^x + ln(x)" },
  { label: "sqrt(x² + 1)", value: "sqrt(x^2 + 1)" },
  { label: "d/dx[ln(x²)]", value: "d/dx[ln(x^2)]" },
];

const PasteInput: React.FC<Props> = ({ onAST }) => {
  const [raw, setRaw] = useState("");
  const [previewLatex, setPreviewLatex] = useState("");
  const [parseError, setParseError] = useState<string | null>(null);
  const [parsedAST, setParsedAST] = useState<ASTNode | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleChange = useCallback((value: string) => {
    setRaw(value);
    if (!value.trim()) {
      setPreviewLatex("");
      setParseError(null);
      setParsedAST(null);
      return;
    }
    const result = parseExpression(value);
    if (result.ast) {
      const latex = astToLatex(result.ast);
      setPreviewLatex(latex);
      setParseError(null);
      setParsedAST(result.ast);
    } else {
      // Even on parse failure, try to render raw input as LaTeX for display
      setPreviewLatex(value);
      setParseError(result.error);
      setParsedAST(null);
    }
  }, []);

  const handleUse = useCallback(() => {
    if (parsedAST) onAST(parsedAST);
  }, [parsedAST, onAST]);

  const handleExample = useCallback((val: string) => {
    setRaw(val);
    handleChange(val);
    textareaRef.current?.focus();
  }, [handleChange]);

  return (
    <div className="paste-input">
      <div className="paste-header">
        <span className="paste-title">Paste / Type Expression</span>
        <span className="paste-hint">Supports: x^2, sin(x), d/dx[f], INT(f,x), lim(x-&gt;a, f), =</span>
      </div>

      <textarea
        ref={textareaRef}
        className={`paste-textarea ${parseError ? "has-error" : parsedAST ? "has-success" : ""}`}
        value={raw}
        onChange={(e) => handleChange(e.target.value)}
        onPaste={(e) => {
          // Allow default paste, then trigger change
          setTimeout(() => handleChange(e.currentTarget.value), 0);
        }}
        placeholder="e.g.  d/dx[x^3]   or   x^2 + sin(x)   or   x^2 = 4"
        rows={3}
        spellCheck={false}
      />

      {previewLatex && (
        <div className={`paste-preview ${parseError ? "preview-raw" : "preview-ast"}`}>
          <span className="preview-label">
            {parseError ? "Raw LaTeX preview" : "Parsed expression"}
          </span>
          <div className="preview-render">
            <KatexRenderer latex={previewLatex} block />
          </div>
          {parseError && (
            <div className="parse-error">
              <span>⚠ Parse error: </span>{parseError.replace("Error: ", "")}
            </div>
          )}
        </div>
      )}

      <div className="paste-actions">
        <button
          className="use-btn"
          onClick={handleUse}
          disabled={!parsedAST}
          title={parsedAST ? "Load this expression into the compiler" : "Fix the expression first"}
        >
          ↗ Use Expression
        </button>
        <button className="clear-btn" onClick={() => handleChange("")} disabled={!raw}>
          ✕ Clear
        </button>
      </div>

      <div className="examples-section">
        <span className="examples-label">Examples</span>
        <div className="examples-grid">
          {EXAMPLES.map((ex) => (
            <button key={ex.value} className="example-chip" onClick={() => handleExample(ex.value)}>
              {ex.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default PasteInput;
