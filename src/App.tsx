import React, { useState, useCallback, useReducer } from "react";
import type { ASTNode } from "./types/ast";
import type { CompilationResult, OperationMode } from "./types/pipeline";
import MathKeyboard from "./components/MathKeyboard/MathKeyboard";
import type { KeyboardAction } from "./components/MathKeyboard/MathKeyboard";
import ASTPanel from "./components/ASTPanel/ASTPanel";
import SolutionSteps from "./components/SolutionSteps/SolutionSteps";
import CompilerTrace from "./components/CompilerTrace/CompilerTrace";
import BenchmarkPanel from "./benchmark/DatasetRunner/BenchmarkPanel";
import PasteInput from "./components/PasteInput/PasteInput";
import { KatexRenderer } from "./components/shared/KatexRenderer";
import { compile } from "./compiler/transformer/pipeline";
import { astToLatex } from "./renderer/latex/latexRenderer";
import "./App.css";

interface EditorState {
  ast: ASTNode | null;
  history: ASTNode[];
}

type EditorAction =
  | { type: "push"; node: ASTNode }
  | { type: "wrapUnary"; wrap: (inner: ASTNode) => ASTNode }
  | { type: "wrapBinary"; wrap: (left: ASTNode, right: ASTNode) => ASTNode }
  | { type: "undo" }
  | { type: "clear" }
  | { type: "set"; node: ASTNode };

function editorReducer(state: EditorState, action: EditorAction): EditorState {
  switch (action.type) {
    case "push":
      return {
        ast: action.node,
        history: state.ast ? [...state.history, state.ast] : state.history,
      };
    case "wrapUnary":
      if (!state.ast) return state;
      return { ast: action.wrap(state.ast), history: [...state.history, state.ast] };
    case "wrapBinary":
      if (!state.ast) return state;
      return {
        ast: action.wrap(state.ast, { type: "Number", value: 1 }),
        history: [...state.history, state.ast],
      };
    case "undo":
      if (state.history.length === 0) return { ast: null, history: [] };
      return { ast: state.history[state.history.length - 1], history: state.history.slice(0, -1) };
    case "clear":
      return { ast: null, history: [] };
    case "set":
      return {
        ast: action.node,
        history: state.ast ? [...state.history, state.ast] : state.history,
      };
    default:
      return state;
  }
}

type Tab = "editor" | "trace" | "benchmark";
type InputMode = "keyboard" | "paste";
type MobilePanel = "input" | "explorer" | "results";

const App: React.FC = () => {
  const [editorState, dispatch] = useReducer(editorReducer, { ast: null, history: [] });
  const [mode, setMode] = useState<OperationMode>("derivative");
  const [result, setResult] = useState<CompilationResult | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("editor");
  const [inputMode, setInputMode] = useState<InputMode>("keyboard");
  const [mobilePanel, setMobilePanel] = useState<MobilePanel>("input");

  const handleKeyboard = useCallback((action: KeyboardAction) => {
    switch (action.kind) {
      case "push": dispatch({ type: "push", node: action.node }); break;
      case "wrapUnary": dispatch({ type: "wrapUnary", wrap: action.wrap }); break;
      case "wrapBinary": dispatch({ type: "wrapBinary", wrap: action.wrap }); break;
      case "undo": dispatch({ type: "undo" }); break;
      case "clear": dispatch({ type: "clear" }); break;
    }
  }, []);

  const handlePastedAST = useCallback((ast: ASTNode) => {
    dispatch({ type: "set", node: ast });
    setActiveTab("editor");
  }, []);

  const handleCompile = useCallback(() => {
    if (!editorState.ast) return;
    const res = compile({ ast: editorState.ast, mode });
    setResult(res);
    setActiveTab("trace");
    setMobilePanel("explorer");
  }, [editorState.ast, mode]);

  const { ast } = editorState;

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-title">
          <h1>Visual-to-AST Calculus Compiler</h1>
          <span className="header-sub">Deterministic Symbolic Engine · No AI · Pure TypeScript</span>
        </div>
        <div className="header-badges">
          <span className="badge">AST</span>
          <span className="badge">KaTeX</span>
          <span className="badge badge-green">Deterministic</span>
        </div>
      </header>

      <main className="app-main">
        {/* ── Left panel ── */}
        <section className={`left-panel${mobilePanel === "input" ? " mobile-active" : ""}`}>

          {/* Input mode toggle */}
          <div className="input-mode-toggle">
            <button
              className={`mode-toggle-btn ${inputMode === "keyboard" ? "active" : ""}`}
              onClick={() => setInputMode("keyboard")}
            >
              ⌨ Keyboard
            </button>
            <button
              className={`mode-toggle-btn ${inputMode === "paste" ? "active" : ""}`}
              onClick={() => setInputMode("paste")}
            >
              ⌦ Paste / Type
            </button>
          </div>

          {inputMode === "keyboard" ? (
            <>
              <div className="section-label">Math Keyboard</div>
              <MathKeyboard onAction={handleKeyboard} currentAST={ast} />
            </>
          ) : (
            <PasteInput onAST={handlePastedAST} />
          )}

          {/* Expression preview */}
          <div className="expression-preview">
            <div className="section-label">Current Expression</div>
            {ast ? (
              <div className="expr-display">
                <KatexRenderer latex={astToLatex(ast)} block />
              </div>
            ) : (
              <div className="expr-empty">
                {inputMode === "keyboard"
                  ? "Use keyboard to build an expression"
                  : "Type or paste an expression above, then click ↗ Use Expression"}
              </div>
            )}
          </div>

          {/* Compile controls */}
          <div className="compile-controls">
            <div className="mode-select">
              <label>Mode</label>
              <select value={mode} onChange={(e) => setMode(e.target.value as OperationMode)}>
                <option value="derivative">Differentiate (d/dx)</option>
                <option value="integral">Integrate (∫)</option>
                <option value="limit">Limit (lim)</option>
                <option value="simplify">Simplify</option>
              </select>
            </div>
            <button className="compile-btn" onClick={handleCompile} disabled={!ast}>
              ▶ Compile
            </button>
          </div>
        </section>

        {/* ── Center panel ── */}
        <section className={`center-panel${mobilePanel === "explorer" ? " mobile-active" : ""}`}>
          <div className="tabs">
            {(["editor", "trace", "benchmark"] as Tab[]).map((t) => (
              <button
                key={t}
                className={`tab ${activeTab === t ? "active" : ""}`}
                onClick={() => setActiveTab(t)}
              >
                {t === "editor" ? "AST Explorer" : t === "trace" ? "Compiler Trace" : "Benchmark"}
              </button>
            ))}
          </div>
          <div className="tab-content">
            {activeTab === "editor" && <ASTPanel ast={ast} />}
            {activeTab === "trace" && <CompilerTrace result={result} />}
            {activeTab === "benchmark" && <BenchmarkPanel />}
          </div>
        </section>

        {/* ── Right panel ── */}
        <section className={`right-panel${mobilePanel === "results" ? " mobile-active" : ""}`}>
          <div className="section-label">Solution Steps</div>
          <SolutionSteps
            steps={result?.steps ?? []}
            finalLatex={result?.latexOutput ?? ""}
          />
        </section>
      </main>

      {/* ── Mobile bottom nav ── */}
      <nav className="mobile-nav">
        <button
          className={`mobile-nav-btn${mobilePanel === "input" ? " active" : ""}`}
          onClick={() => setMobilePanel("input")}
        >
          <span className="nav-icon">⌨</span>
          Input
        </button>
        <button
          className={`mobile-nav-btn${mobilePanel === "explorer" ? " active" : ""}`}
          onClick={() => setMobilePanel("explorer")}
        >
          <span className="nav-icon">⊞</span>
          Explorer
        </button>
        <button
          className={`mobile-nav-btn${mobilePanel === "results" ? " active" : ""}`}
          onClick={() => setMobilePanel("results")}
        >
          <span className="nav-icon">≡</span>
          Results
        </button>
      </nav>
    </div>
  );
};

export default App;
