import React, { useState } from "react";
import type {
  ASTNode, MathFunction,
} from "../../types/ast";
import {
  num, variable, constant, add, sub, mul, div, pow,
  fn, integral, derivative, limit, negate, root,
} from "../../types/ast";
import "./MathKeyboard.css";

// ─── Types ────────────────────────────────────────────────────────────────────

export type KeyboardAction =
  | { kind: "push"; node: ASTNode }
  | { kind: "wrapUnary"; wrap: (inner: ASTNode) => ASTNode }
  | { kind: "wrapBinary"; wrap: (left: ASTNode, right: ASTNode) => ASTNode }
  | { kind: "clear" }
  | { kind: "undo" };

interface Props {
  onAction: (action: KeyboardAction) => void;
  currentAST: ASTNode | null;
}

interface KeyDef {
  label: string;
  latex?: string;
  category: "function" | "operator" | "variable" | "constant" | "calculus" | "control";
  action: KeyboardAction;
  tooltip?: string;
}

// ─── Keyboard layout definition ──────────────────────────────────────────────

function buildKeys(): KeyDef[] {
  const digits: KeyDef[] = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => ({
    label: String(n),
    category: "constant" as const,
    action: { kind: "push", node: num(n) } as KeyboardAction,
  }));

  const vars: KeyDef[] = ["x", "y", "z", "t", "n", "k"].map((v) => ({
    label: v,
    category: "variable" as const,
    action: { kind: "push", node: variable(v) } as KeyboardAction,
    tooltip: `Insert variable ${v}`,
  }));

  const constants: KeyDef[] = [
    { label: "e", latex: "e", category: "constant", action: { kind: "push", node: constant("e") }, tooltip: "Euler's number" },
    { label: "π", latex: "\\pi", category: "constant", action: { kind: "push", node: constant("pi") }, tooltip: "Pi" },
  ];

  const operators: KeyDef[] = [
    { label: "+", category: "operator", action: { kind: "wrapBinary", wrap: (l, r) => add(l, r) }, tooltip: "Addition" },
    { label: "−", category: "operator", action: { kind: "wrapBinary", wrap: (l, r) => sub(l, r) }, tooltip: "Subtraction" },
    { label: "×", category: "operator", action: { kind: "wrapBinary", wrap: (l, r) => mul(l, r) }, tooltip: "Multiplication" },
    { label: "÷", latex: "\\frac{}{}", category: "operator", action: { kind: "wrapBinary", wrap: (l, r) => div(l, r) }, tooltip: "Division" },
    { label: "xⁿ", latex: "x^n", category: "operator", action: { kind: "wrapBinary", wrap: (b, e) => pow(b, e) }, tooltip: "Power" },
    { label: "−x", category: "operator", action: { kind: "wrapUnary", wrap: (a) => negate(a) }, tooltip: "Negate" },
    { label: "√x", latex: "\\sqrt{x}", category: "operator", action: { kind: "wrapUnary", wrap: (a) => root(a) }, tooltip: "Square root" },
    { label: "ⁿ√x", latex: "\\sqrt[n]{x}", category: "operator", action: { kind: "wrapBinary", wrap: (r, i) => root(r, i) }, tooltip: "nth root" },
  ];

  const trig: KeyDef[] = (
    ["sin", "cos", "tan", "csc", "sec", "cot",
      "arcsin", "arccos", "arctan"] as MathFunction[]
  ).map((name) => ({
    label: name,
    category: "function" as const,
    action: { kind: "wrapUnary", wrap: (a: ASTNode) => fn(name, a) } as KeyboardAction,
    tooltip: `${name}(x)`,
  }));

  const logExp: KeyDef[] = [
    { label: "ln", category: "function", action: { kind: "wrapUnary", wrap: (a) => fn("ln", a) }, tooltip: "Natural log" },
    { label: "log", category: "function", action: { kind: "wrapUnary", wrap: (a) => fn("log10", a) }, tooltip: "Log base 10" },
    { label: "log₂", category: "function", action: { kind: "wrapUnary", wrap: (a) => fn("log2", a) }, tooltip: "Log base 2" },
    { label: "eˣ", latex: "e^x", category: "function", action: { kind: "wrapUnary", wrap: (a) => fn("exp", a) }, tooltip: "e^x" },
    { label: "|x|", latex: "|x|", category: "function", action: { kind: "wrapUnary", wrap: (a) => ({ type: "Abs", argument: a }) }, tooltip: "Absolute value" },
  ];

  const calculus: KeyDef[] = [
    {
      label: "d/dx",
      latex: "\\frac{d}{dx}",
      category: "calculus",
      action: { kind: "wrapUnary", wrap: (a) => derivative(a, "x") },
      tooltip: "Derivative with respect to x",
    },
    {
      label: "d²/dx²",
      latex: "\\frac{d^2}{dx^2}",
      category: "calculus",
      action: { kind: "wrapUnary", wrap: (a) => derivative(a, "x", 2) },
      tooltip: "Second derivative",
    },
    {
      label: "d/dt",
      latex: "\\frac{d}{dt}",
      category: "calculus",
      action: { kind: "wrapUnary", wrap: (a) => derivative(a, "t") },
      tooltip: "Derivative with respect to t",
    },
    {
      label: "∫ dx",
      latex: "\\int \\cdot\\, dx",
      category: "calculus",
      action: { kind: "wrapUnary", wrap: (a) => integral(a, "x") },
      tooltip: "Indefinite integral w.r.t. x",
    },
    {
      label: "∫ dt",
      category: "calculus",
      action: { kind: "wrapUnary", wrap: (a) => integral(a, "t") },
      tooltip: "Indefinite integral w.r.t. t",
    },
    {
      label: "lim",
      latex: "\\lim_{x\\to a}",
      category: "calculus",
      action: { kind: "wrapBinary", wrap: (expr, approach) => limit(expr, "x", approach) },
      tooltip: "Limit as x → a",
    },
    {
      label: "Σ",
      latex: "\\sum",
      category: "calculus",
      action: { kind: "push", node: { type: "Summation", expression: variable("k"), variable: "k", lower: num(1), upper: variable("n") } as ASTNode },
      tooltip: "Summation",
    },
  ];

  const control: KeyDef[] = [
    { label: "⌫ Undo", category: "control", action: { kind: "undo" }, tooltip: "Undo last action" },
    { label: "✕ Clear", category: "control", action: { kind: "clear" }, tooltip: "Clear all" },
  ];

  return [...digits, ...vars, ...constants, ...operators, ...trig, ...logExp, ...calculus, ...control];
}

const ALL_KEYS = buildKeys();

// ─── Component ────────────────────────────────────────────────────────────────

const MathKeyboard: React.FC<Props> = ({ onAction, currentAST }) => {
  const [activeCategory, setActiveCategory] = useState<string>("all");

  const categories = [
    { id: "all", label: "All" },
    { id: "calculus", label: "Calculus" },
    { id: "function", label: "Functions" },
    { id: "operator", label: "Operators" },
    { id: "variable", label: "Variables" },
    { id: "constant", label: "Constants" },
  ];

  const visibleKeys = activeCategory === "all"
    ? ALL_KEYS
    : ALL_KEYS.filter((k) => k.category === activeCategory || k.category === "control");

  return (
    <div className="math-keyboard">
      <div className="keyboard-tabs">
        {categories.map((cat) => (
          <button
            key={cat.id}
            className={`tab-btn ${activeCategory === cat.id ? "active" : ""}`}
            onClick={() => setActiveCategory(cat.id)}
          >
            {cat.label}
          </button>
        ))}
      </div>

      <div className="keyboard-grid">
        {visibleKeys.map((key, idx) => (
          <button
            key={idx}
            className={`key-btn key-${key.category}`}
            title={key.tooltip ?? key.label}
            onClick={() => onAction(key.action)}
            disabled={
              (key.action.kind === "wrapUnary" || key.action.kind === "wrapBinary") && !currentAST
            }
          >
            {key.label}
          </button>
        ))}
      </div>

      <div className="keyboard-hint">
        {currentAST
          ? "Click an operator to wrap the current expression, or push a new node."
          : "Click a number, variable, or function to start building an expression."}
      </div>
    </div>
  );
};

export default MathKeyboard;
