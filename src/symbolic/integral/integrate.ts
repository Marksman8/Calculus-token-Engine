import type { ASTNode } from "../../types/ast";
import type { SolutionStep } from "../../types/pipeline";
import {
  add, sub, mul, div, pow, fn, num, variable, negate,
  isZero, isOne, isNumber, isVariable,
} from "../../types/ast";
import { simplify } from "../simplifier/simplify";
import { astToLatex } from "../../renderer/latex/latexRenderer";
import { containsVariable, differentiate, resetSteps as resetDiffSteps } from "../derivative/differentiate";
import { v4 as uuid } from "uuid";

let _steps: SolutionStep[] = [];
let _stepCounter = 0;

export function getIntegralSteps(): SolutionStep[] { return _steps; }

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

export function resetIntegralSteps(): void {
  _steps = [];
  _stepCounter = 0;
}

// ─── Main integrator ──────────────────────────────────────────────────────────
// Returns the antiderivative (without +C for clarity; caller may append).

export function integrate(node: ASTNode, varName: string): ASTNode {
  const before = node;

  switch (node.type) {
    // ── ∫c dx = cx ────────────────────────────────────────────────────────────
    case "Number": {
      if (isZero(node)) return record("Zero Rule", "∫0 dx = 0", before, num(0));
      const result = simplify(mul(node, variable(varName)));
      return record("Constant Rule", `∫${node.value} dx = ${node.value}x`, before, result);
    }

    case "Constant": {
      const result = mul(node, variable(varName));
      return record("Constant Rule", `∫${node.name} dx = ${node.name}·x`, before, result);
    }

    // ── ∫x dx = x²/2, ∫y dx = xy ────────────────────────────────────────────
    case "Variable": {
      if (node.name === varName) {
        const result = simplify(div(pow(node, num(2)), num(2)));
        return record("Power Rule", "∫x dx = x²/2", before, result);
      }
      // Treat as constant w.r.t. integration variable
      const result = mul(node, variable(varName));
      return record("Constant Rule", `∫${node.name} d${varName} = ${node.name}·${varName}`, before, result);
    }

    // ── Sum Rule: ∫(f+g)dx = ∫f dx + ∫g dx ──────────────────────────────────
    case "Add": {
      const il = integrate(node.left, varName);
      const ir = integrate(node.right, varName);
      const result = simplify(add(il, ir));
      return record("Sum Rule", "∫(f+g)dx = ∫f dx + ∫g dx", before, result);
    }

    // ── Difference Rule ───────────────────────────────────────────────────────
    case "Subtract": {
      const il = integrate(node.left, varName);
      const ir = integrate(node.right, varName);
      const result = simplify(sub(il, ir));
      return record("Difference Rule", "∫(f-g)dx = ∫f dx - ∫g dx", before, result);
    }

    case "Negate": {
      const ia = integrate(node.argument, varName);
      const result = simplify(negate(ia));
      return record("Negation Rule", "∫-f dx = -∫f dx", before, result);
    }

    // ── Constant Multiple: ∫c·f dx = c·∫f dx ────────────────────────────────
    case "Multiply": {
      const leftConst = !containsVariable(node.left, varName);
      const rightConst = !containsVariable(node.right, varName);

      if (leftConst) {
        const ir = integrate(node.right, varName);
        const result = simplify(mul(node.left, ir));
        return record("Constant Multiple Rule", "∫c·f dx = c·∫f dx", before, result);
      }
      if (rightConst) {
        const il = integrate(node.left, varName);
        const result = simplify(mul(il, node.right));
        return record("Constant Multiple Rule", "∫f·c dx = c·∫f dx", before, result);
      }
      // Integration by Parts heuristic: ∫u·dv
      return integrationByParts(node.left, node.right, varName, before);
    }

    // ── Power Rule: ∫x^n dx = x^(n+1)/(n+1) ─────────────────────────────────
    case "Power": {
      const base = node.base;
      const exp_ = node.exponent;

      if (!containsVariable(node, varName)) {
        const result = mul(node, variable(varName));
        return record("Constant Rule", "∫c dx = cx", before, result);
      }

      // ∫x^n dx (x is the variable)
      if (isVariable(base) && base.name === varName && !containsVariable(exp_, varName)) {
        // special: n = -1 → ln|x|
        if (isNumber(exp_) && exp_.value === -1) {
          const result = fn("ln", fn("abs", base));
          return record("Log Rule", "∫x⁻¹ dx = ln|x|", before, result);
        }
        const np1 = simplify(add(exp_, num(1)));
        const result = simplify(div(pow(base, np1), np1));
        return record("Power Rule", "∫x^n dx = x^(n+1)/(n+1)", before, result);
      }

      // ∫e^x dx = e^x
      if (base.type === "Constant" && base.name === "e" && isVariable(exp_) && exp_.name === varName) {
        return record("Exponential Rule", "∫e^x dx = e^x", before, pow(base, exp_));
      }

      // ∫a^x dx = a^x / ln(a)
      if (!containsVariable(base, varName) && isVariable(exp_) && exp_.name === varName) {
        const result = simplify(div(node, fn("ln", base)));
        return record("Exponential Rule", "∫a^x dx = a^x/ln(a)", before, result);
      }

      // General: try substitution or leave
      return record("Unresolved Power", "Integration not simplified further", before, { type: "Integral", integrand: node, variable: varName });
    }

    // ── Root: convert to power ────────────────────────────────────────────────
    case "Root": {
      const asPow = pow(node.radicand, div(num(1), node.index));
      return integrate(asPow, varName);
    }

    // ── Function integrals ────────────────────────────────────────────────────
    case "FunctionCall": {
      return integrateFunctionCall(node.name, node.argument, varName, before);
    }

    case "Divide": {
      // ∫1/x dx = ln|x|
      if (isOne(node.numerator) && isVariable(node.denominator) && node.denominator.name === varName) {
        const result = fn("ln", fn("abs", node.denominator));
        return record("Log Rule", "∫1/x dx = ln|x|", before, result);
      }
      // ∫c/f dx – try constant multiple
      if (!containsVariable(node.numerator, varName)) {
        const ia = integrate({ type: "Divide", numerator: num(1), denominator: node.denominator }, varName);
        const result = simplify(mul(node.numerator, ia));
        return record("Constant Multiple Rule", "∫c/f dx = c·∫1/f dx", before, result);
      }
      return record("Unresolved Quotient", "Division integral not simplified further", before, { type: "Integral", integrand: node, variable: varName });
    }

    default:
      return record("Identity", "Unknown expression — left unevaluated", before, { type: "Integral", integrand: node, variable: varName });
  }
}

// ─── Function integrals ───────────────────────────────────────────────────────

function integrateFunctionCall(name: string, u: ASTNode, varName: string, before: ASTNode): ASTNode {
  // Only handle direct ∫f(x)dx; chain substitution for f(ax+b) handled separately
  switch (name) {
    case "sin": {
      const result = negate(fn("cos", u));
      return record("sin Integral", "∫sin(u)du = -cos(u)", before, result);
    }
    case "cos": {
      const result = fn("sin", u);
      return record("cos Integral", "∫cos(u)du = sin(u)", before, result);
    }
    case "tan": {
      const result = negate(fn("ln", fn("abs", fn("cos", u))));
      return record("tan Integral", "∫tan(u)du = -ln|cos(u)|", before, result);
    }
    case "cot": {
      const result = fn("ln", fn("abs", fn("sin", u)));
      return record("cot Integral", "∫cot(u)du = ln|sin(u)|", before, result);
    }
    case "sec": {
      const result = fn("ln", fn("abs", add(fn("sec", u), fn("tan", u))));
      return record("sec Integral", "∫sec(u)du = ln|sec(u)+tan(u)|", before, result);
    }
    case "csc": {
      const result = negate(fn("ln", fn("abs", add(fn("csc", u), fn("cot", u)))));
      return record("csc Integral", "∫csc(u)du = -ln|csc(u)+cot(u)|", before, result);
    }
    case "exp": {
      const result = fn("exp", u);
      return record("e^x Integral", "∫e^u du = e^u", before, result);
    }
    case "ln": {
      // ∫ln(x)dx = x·ln(x) - x
      const result = sub(mul(u, fn("ln", u)), u);
      return record("ln Integral", "∫ln(x)dx = x·ln(x) - x", before, simplify(result));
    }
    case "sqrt": {
      // ∫√x dx = (2/3)x^(3/2)
      const asPow = pow(u, div(num(1), num(2)));
      return integrate(asPow, varName);
    }
    default:
      return record("Unresolved Function", `∫${name}(u) not simplified`, before,
        { type: "Integral", integrand: { type: "FunctionCall", name: name as any, argument: u }, variable: varName });
  }
}

// ─── Integration by Parts ─────────────────────────────────────────────────────
// Heuristic LIATE ordering: Log > Inverse trig > Algebraic > Trig > Exponential

function integrationByParts(left: ASTNode, right: ASTNode, varName: string, before: ASTNode): ASTNode {
  // Identify u (first in LIATE) and dv (other)
  const score = (n: ASTNode): number => {
    if (n.type === "FunctionCall") {
      if (["ln", "log", "log2", "log10"].includes(n.name)) return 5;
      if (["arcsin", "arccos", "arctan", "arccsc", "arcsec", "arccot"].includes(n.name)) return 4;
      if (["sin", "cos", "tan", "csc", "sec", "cot"].includes(n.name)) return 2;
      if (["exp"].includes(n.name)) return 1;
    }
    if (n.type === "Variable" || n.type === "Power") return 3; // algebraic
    return 0;
  };

  const [u, dv] = score(left) >= score(right) ? [left, right] : [right, left];

  // v = ∫dv
  const v = integrate(dv, varName);
  // du = derivative of u
  resetDiffSteps();
  const du = differentiate(u, varName);

  // ∫u·dv = u·v - ∫v·du
  const vdu = simplify(mul(v, du));
  const vdu_integral = integrate(vdu, varName);

  const result = simplify(sub(mul(u, v), vdu_integral));
  return record("Integration by Parts", "∫u dv = uv - ∫v du", before, result);
}
