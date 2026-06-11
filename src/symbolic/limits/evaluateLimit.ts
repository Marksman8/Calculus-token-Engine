import type { ASTNode, LimitNode } from "../../types/ast";
import type { SolutionStep } from "../../types/pipeline";
import {
  num, div, add, sub, mul, pow, negate,
  isNumber, isZero,
} from "../../types/ast";
import { simplify } from "../simplifier/simplify";
import { astToLatex } from "../../renderer/latex/latexRenderer";
import { differentiate, resetSteps as resetDiffSteps } from "../derivative/differentiate";
import { v4 as uuid } from "uuid";

let _steps: SolutionStep[] = [];
let _stepCounter = 0;

export function getLimitSteps(): SolutionStep[] { return _steps; }

function record(rule: string, description: string, before: ASTNode, after: ASTNode): ASTNode {
  _stepCounter++;
  _steps.push({
    id: uuid(),
    stepNumber: _stepCounter,
    ruleApplied: rule,
    ruleDescription: description,
    beforeAST: before,
    afterAST: after,
    latexBefore: astToLatex(before),
    latexAfter: astToLatex(after),
  });
  return after;
}

export function resetLimitSteps(): void {
  _steps = [];
  _stepCounter = 0;
}

// ─── Main limit evaluator ────────────────────────────────────────────────────

export function evaluateLimit(node: LimitNode): ASTNode {
  const { expression, variable, approach } = node;
  const before: ASTNode = node;

  // 1. Direct substitution
  const substituted = substitute(expression, variable, approach);
  const simplified = simplify(substituted);

  if (isFiniteNumber(simplified)) {
    return record("Direct Substitution", `Substitute ${variable}→${astToLatex(approach)}`, before, simplified);
  }

  // 2. Check for 0/0 or ∞/∞ — try L'Hôpital
  if (simplified.type === "Divide") {
    const topVal = simplify(substitute(simplified.numerator, variable, approach));
    const botVal = simplify(substitute(simplified.denominator, variable, approach));
    const topZero = isZero(topVal);
    const botZero = isZero(botVal);
    const topInf = isInfinity(topVal);
    const botInf = isInfinity(botVal);

    if ((topZero && botZero) || (topInf && botInf)) {
      return lhopital(expression, variable, approach, before, 0);
    }
    // n/0 → ∞ or undefined
    if (botZero && !topZero) {
      return record("Division by Zero", "Limit diverges to ∞", before, makeInfinity());
    }
  }

  // 3. Polynomial / rational limit at infinity
  if (isInfinity(approach) || (isNumber(approach) && Math.abs(approach.value) > 1e14)) {
    return polynomialLimitAtInfinity(expression, variable, before);
  }

  // 4. Factor and cancel for x → a with 0/0
  if (simplified.type === "Divide") {
    const factored = factorAndCancel(expression, variable, approach);
    if (factored !== null) {
      const result = simplify(substitute(factored, variable, approach));
      return record("Factorization", "Factor and cancel common terms", before, result);
    }
  }

  // 5. If still indeterminate, return the simplified form
  return record("Limit Result", "Limit evaluated", before, simplified);
}

// ─── L'Hôpital's Rule (recursive up to 5 times) ──────────────────────────────

function lhopital(expr: ASTNode, variable: string, approach: ASTNode, before: ASTNode, depth: number): ASTNode {
  if (depth > 5) return record("L'Hôpital Limit", "Max iterations reached", before, expr);
  if (expr.type !== "Divide") return before;

  resetDiffSteps();
  const dNum = differentiate(expr.numerator, variable);
  resetDiffSteps();
  const dDen = differentiate(expr.denominator, variable);

  const newExpr = div(dNum, dDen);
  const afterSub = simplify(substitute(newExpr, variable, approach));

  const rule = `L'Hôpital Rule (depth ${depth + 1})`;
  const desc = "d(numerator)/d(denominator)";

  if (isFiniteNumber(afterSub)) {
    return record(rule, desc, before, afterSub);
  }

  const isStillIndeterminate =
    (isZero(simplify(substitute(dNum, variable, approach))) &&
      isZero(simplify(substitute(dDen, variable, approach)))) ||
    (isInfinity(simplify(substitute(dNum, variable, approach))) &&
      isInfinity(simplify(substitute(dDen, variable, approach))));

  if (isStillIndeterminate) {
    return lhopital(newExpr, variable, approach, before, depth + 1);
  }

  return record(rule, desc, before, afterSub);
}

// ─── Polynomial limit at infinity ────────────────────────────────────────────
// Finds dominant term ratio.

function polynomialLimitAtInfinity(expr: ASTNode, variable: string, before: ASTNode): ASTNode {
  if (expr.type === "Divide") {
    const topDeg = polynomialDegree(expr.numerator, variable);
    const botDeg = polynomialDegree(expr.denominator, variable);

    if (topDeg === null || botDeg === null) {
      return record("Polynomial Limit", "Degrees not determined", before, expr);
    }

    if (topDeg < botDeg) {
      return record("Rational Limit", "Degree(top) < Degree(bottom) → 0", before, num(0));
    }
    if (topDeg > botDeg) {
      return record("Rational Limit", "Degree(top) > Degree(bottom) → ∞", before, makeInfinity());
    }
    // Same degree: ratio of leading coefficients
    const topLead = leadingCoeff(expr.numerator, variable, topDeg);
    const botLead = leadingCoeff(expr.denominator, variable, botDeg);
    const ratio = botLead !== 0 ? simplify(div(num(topLead), num(botLead))) : makeInfinity();
    return record("Leading Coefficient Rule", "Same degree: ratio of leading coefficients", before, ratio);
  }
  return record("Limit", "Could not determine polynomial limit", before, expr);
}

// ─── Factorization attempt ────────────────────────────────────────────────────
// Simple: if numerator and denominator share (x - a) factor at approach point.

function factorAndCancel(expr: ASTNode, variable: string, approach: ASTNode): ASTNode | null {
  if (expr.type !== "Divide") return null;
  // Check if (x - approach) is a factor of both by synthetic substitution
  const numAtA = simplify(substitute(expr.numerator, variable, approach));
  const denAtA = simplify(substitute(expr.denominator, variable, approach));
  if (!isZero(numAtA) || !isZero(denAtA)) return null;

  // Perform polynomial division by (x - a) for simple linear numerator/denominator
  const topDiv = divideByLinearFactor(expr.numerator, variable, approach);
  const botDiv = divideByLinearFactor(expr.denominator, variable, approach);

  if (topDiv && botDiv) {
    return div(topDiv, botDiv);
  }
  return null;
}

// ─── Polynomial synthetic-style division by (x - a) ─────────────────────────
// Works for simple polynomials only.

function divideByLinearFactor(poly: ASTNode, variable: string, a: ASTNode): ASTNode | null {
  // Only handle simple cases: x^n - a^n style
  if (!isNumber(a)) return null;
  const aVal = a.value;

  // Collect polynomial coefficients
  const coeffs = extractPolynomialCoeffs(poly, variable);
  if (!coeffs) return null;

  const degree = Object.keys(coeffs).map(Number).sort((x, y) => y - x)[0];
  const arr: number[] = [];
  for (let i = degree; i >= 0; i--) arr.push(coeffs[i] ?? 0);

  // Synthetic division
  const result: number[] = [arr[0]];
  for (let i = 1; i < arr.length - 1; i++) {
    result.push(arr[i] + result[i - 1] * aVal);
  }

  // Build result polynomial
  let node: ASTNode = num(result[result.length - 1]);
  for (let i = result.length - 2; i >= 0; i--) {
    const exp_ = result.length - 1 - i;
    const term = result[i] === 1
      ? pow({ type: "Variable", name: variable }, num(exp_))
      : mul(num(result[i]), pow({ type: "Variable", name: variable }, num(exp_)));
    node = add(node, term);
  }
  return simplify(node);
}

// ─── Extract polynomial coefficients {degree: coeff} ─────────────────────────

function extractPolynomialCoeffs(node: ASTNode, variable: string): Record<number, number> | null {
  if (isNumber(node)) return { 0: node.value };
  if (node.type === "Variable" && node.name === variable) return { 1: 1 };
  if (node.type === "Power") {
    const { base, exponent } = node;
    if (base.type === "Variable" && base.name === variable && isNumber(exponent) && exponent.value >= 0) {
      return { [exponent.value]: 1 };
    }
  }
  if (node.type === "Multiply") {
    if (isNumber(node.left)) {
      const right = extractPolynomialCoeffs(node.right, variable);
      if (right) {
        const result: Record<number, number> = {};
        for (const [k, v] of Object.entries(right)) result[Number(k)] = v * node.left.value;
        return result;
      }
    }
  }
  if (node.type === "Add" || node.type === "Subtract") {
    const l = extractPolynomialCoeffs(node.left, variable);
    const r = extractPolynomialCoeffs(node.right, variable);
    if (l && r) {
      const result: Record<number, number> = { ...l };
      for (const [k, v] of Object.entries(r)) {
        result[Number(k)] = (result[Number(k)] ?? 0) + (node.type === "Subtract" ? -v : v);
      }
      return result;
    }
  }
  return null;
}

// ─── Polynomial degree and leading coefficient ───────────────────────────────

function polynomialDegree(node: ASTNode, variable: string): number | null {
  const coeffs = extractPolynomialCoeffs(node, variable);
  if (!coeffs) return null;
  return Math.max(...Object.keys(coeffs).map(Number));
}

function leadingCoeff(node: ASTNode, variable: string, degree: number): number {
  const coeffs = extractPolynomialCoeffs(node, variable);
  return coeffs?.[degree] ?? 0;
}

// ─── Substitution ─────────────────────────────────────────────────────────────
// Replaces all occurrences of `variable` with `value` in the AST.

export function substitute(node: ASTNode, variable: string, value: ASTNode): ASTNode {
  switch (node.type) {
    case "Variable": return node.name === variable ? value : node;
    case "Number":
    case "Constant": return node;
    case "Add": return add(substitute(node.left, variable, value), substitute(node.right, variable, value));
    case "Subtract": return sub(substitute(node.left, variable, value), substitute(node.right, variable, value));
    case "Multiply": return mul(substitute(node.left, variable, value), substitute(node.right, variable, value));
    case "Divide": return div(substitute(node.numerator, variable, value), substitute(node.denominator, variable, value));
    case "Power": return pow(substitute(node.base, variable, value), substitute(node.exponent, variable, value));
    case "Negate": return negate(substitute(node.argument, variable, value));
    case "FunctionCall": return { ...node, argument: substitute(node.argument, variable, value) };
    case "Abs": return { ...node, argument: substitute(node.argument, variable, value) };
    case "Root": return { type: "Root", radicand: substitute(node.radicand, variable, value), index: substitute(node.index, variable, value) };
    default: return node;
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function isFiniteNumber(node: ASTNode): boolean {
  return isNumber(node) && isFinite(node.value);
}

function isInfinity(node: ASTNode): boolean {
  return (isNumber(node) && !isFinite(node.value)) || (node as any)._infinity === true;
}

function makeInfinity(): ASTNode {
  return { type: "Number", value: Infinity } as ASTNode;
}
