import type { ASTNode } from "../../types/ast";
import type { SolutionStep } from "../../types/pipeline";
import {
  add, sub, mul, div, pow, negate, fn, num,
  isOne, isVariable,
} from "../../types/ast";
import { simplify } from "../simplifier/simplify";
import { astToLatex } from "../../renderer/latex/latexRenderer";
import { v4 as uuid } from "uuid";

// ─── Step recorder ────────────────────────────────────────────────────────────

let _steps: SolutionStep[] = [];
let _stepCounter = 0;

export function getSteps(): SolutionStep[] { return _steps; }

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

export function resetSteps(): void {
  _steps = [];
  _stepCounter = 0;
}

// ─── Main differentiator ─────────────────────────────────────────────────────

export function differentiate(node: ASTNode, variable_: string): ASTNode {
  const before = node;

  switch (node.type) {
    // ── Constant Rule: d/dx[c] = 0 ──────────────────────────────────────────
    case "Number": {
      const result = num(0);
      return record("Constant Rule", `d/dx[${node.value}] = 0`, before, result);
    }

    case "Constant": {
      const result = num(0);
      return record("Constant Rule", `d/dx[${node.name}] = 0`, before, result);
    }

    // ── Variable Rule: d/dx[x] = 1, d/dx[y] = 0 ────────────────────────────
    case "Variable": {
      if (node.name === variable_) {
        const result = num(1);
        return record("Variable Rule", `d/dx[${node.name}] = 1`, before, result);
      } else {
        const result = num(0);
        return record("Constant Rule", `d/dx[${node.name}] = 0 (treated as constant)`, before, result);
      }
    }

    // ── Sum Rule: d/dx[f+g] = f' + g' ───────────────────────────────────────
    case "Add": {
      const df = differentiate(node.left, variable_);
      const dg = differentiate(node.right, variable_);
      const result = simplify(add(df, dg));
      return record("Sum Rule", "d/dx[f+g] = f' + g'", before, result);
    }

    // ── Difference Rule: d/dx[f-g] = f' - g' ────────────────────────────────
    case "Subtract": {
      const df = differentiate(node.left, variable_);
      const dg = differentiate(node.right, variable_);
      const result = simplify(sub(df, dg));
      return record("Difference Rule", "d/dx[f-g] = f' - g'", before, result);
    }

    // ── Multiply: Product Rule or Constant Multiple ──────────────────────────
    case "Multiply": {
      const leftIsConst = !containsVariable(node.left, variable_);
      const rightIsConst = !containsVariable(node.right, variable_);

      if (leftIsConst) {
        // Constant Multiple Rule: d/dx[c·f] = c·f'
        const df = differentiate(node.right, variable_);
        const result = simplify(mul(node.left, df));
        return record("Constant Multiple Rule", "d/dx[c·f] = c·f'", before, result);
      }
      if (rightIsConst) {
        const df = differentiate(node.left, variable_);
        const result = simplify(mul(df, node.right));
        return record("Constant Multiple Rule", "d/dx[f·c] = f'·c", before, result);
      }
      // General Product Rule: d/dx[fg] = f'g + fg'
      const df = differentiate(node.left, variable_);
      const dg = differentiate(node.right, variable_);
      const result = simplify(add(mul(df, node.right), mul(node.left, dg)));
      return record("Product Rule", "d/dx[fg] = f'g + fg'", before, result);
    }

    // ── Divide: Quotient Rule ────────────────────────────────────────────────
    case "Divide": {
      const f = node.numerator;
      const g = node.denominator;
      const df = differentiate(f, variable_);
      const dg = differentiate(g, variable_);
      // (f'g - fg') / g²
      const result = simplify(
        div(sub(mul(df, g), mul(f, dg)), pow(g, num(2)))
      );
      return record("Quotient Rule", "d/dx[f/g] = (f'g - fg') / g²", before, result);
    }

    // ── Negate: d/dx[-f] = -f' ───────────────────────────────────────────────
    case "Negate": {
      const df = differentiate(node.argument, variable_);
      const result = simplify(negate(df));
      return record("Negation Rule", "d/dx[-f] = -f'", before, result);
    }

    // ── Power Rule ───────────────────────────────────────────────────────────
    case "Power": {
      const base = node.base;
      const exp = node.exponent;
      const baseHasVar = containsVariable(base, variable_);
      const expHasVar = containsVariable(exp, variable_);

      if (!baseHasVar && !expHasVar) {
        // Both constant
        return record("Constant Rule", "d/dx[c] = 0", before, num(0));
      }

      if (baseHasVar && !expHasVar) {
        if (isVariable(base) && base.name === variable_) {
          // Simple power rule: d/dx[x^n] = n·x^(n-1)
          const result = simplify(
            mul(exp, pow(base, simplify(sub(exp, num(1)))))
          );
          return record("Power Rule", "d/dx[x^n] = n·x^(n-1)", before, result);
        }
        // General power rule via chain rule: d/dx[f^n] = n·f^(n-1)·f'
        const df = differentiate(base, variable_);
        const result = simplify(
          mul(mul(exp, pow(base, simplify(sub(exp, num(1))))), df)
        );
        return record("General Power Rule (Chain)", "d/dx[f^n] = n·f^(n-1)·f'", before, result);
      }

      if (!baseHasVar && expHasVar) {
        // Exponential rule: d/dx[a^f] = a^f · ln(a) · f'
        const df = differentiate(exp, variable_);
        const result = simplify(mul(mul(node, fn("ln", base)), df));
        return record("Exponential Rule", "d/dx[a^f] = a^f·ln(a)·f'", before, result);
      }

      // Both variable: d/dx[f^g] = f^g · (g'·ln(f) + g·f'/f)
      const df = differentiate(base, variable_);
      const dg = differentiate(exp, variable_);
      const result = simplify(
        mul(node, add(mul(dg, fn("ln", base)), div(mul(exp, df), base)))
      );
      return record("General Exponential Rule", "d/dx[f^g] = f^g·(g'·ln(f) + g·f'/f)", before, result);
    }

    // ── Root: d/dx[f^(1/n)] via power rule ──────────────────────────────────
    case "Root": {
      const aspower = pow(node.radicand, div(num(1), node.index));
      return differentiate(aspower, variable_);
    }

    // ── Function Calls ────────────────────────────────────────────────────────
    case "FunctionCall": {
      return differentiateFunction(node.name, node.argument, variable_, before);
    }

    // ── Absolute Value: d/dx[|f|] = f/|f| · f' ──────────────────────────────
    case "Abs": {
      const df = differentiate(node.argument, variable_);
      const result = simplify(mul(div(node.argument, node), df));
      return record("Abs Rule", "d/dx[|f|] = (f/|f|)·f'", before, result);
    }

    // ── Higher-order derivative unwrapping ──────────────────────────────────
    case "Derivative": {
      // d/dx[d/dx[f]] → differentiate the inner result
      const inner = differentiate(node.expression, node.variable);
      return differentiate(inner, variable_);
    }

    default:
      return record("Identity", "Unknown node — returned as-is", before, before);
  }
}

// ─── Function differentiation ────────────────────────────────────────────────

function differentiateFunction(name: string, u: ASTNode, variable_: string, before: ASTNode): ASTNode {
  const du = differentiate(u, variable_);

  let innerResult: ASTNode;
  let rule: string;
  let description: string;

  switch (name) {
    // ── Trig ──────────────────────────────────────────────────────────────────
    case "sin":
      innerResult = fn("cos", u);
      rule = "sin Derivative"; description = "d/dx[sin(u)] = cos(u)·u'";
      break;
    case "cos":
      innerResult = negate(fn("sin", u));
      rule = "cos Derivative"; description = "d/dx[cos(u)] = -sin(u)·u'";
      break;
    case "tan":
      innerResult = pow(fn("sec", u), num(2));
      rule = "tan Derivative"; description = "d/dx[tan(u)] = sec²(u)·u'";
      break;
    case "csc":
      innerResult = negate(mul(fn("csc", u), fn("cot", u)));
      rule = "csc Derivative"; description = "d/dx[csc(u)] = -csc(u)cot(u)·u'";
      break;
    case "sec":
      innerResult = mul(fn("sec", u), fn("tan", u));
      rule = "sec Derivative"; description = "d/dx[sec(u)] = sec(u)tan(u)·u'";
      break;
    case "cot":
      innerResult = negate(pow(fn("csc", u), num(2)));
      rule = "cot Derivative"; description = "d/dx[cot(u)] = -csc²(u)·u'";
      break;

    // ── Inverse Trig ─────────────────────────────────────────────────────────
    case "arcsin":
      // 1 / sqrt(1 - u²)
      innerResult = div(num(1), fn("sqrt", sub(num(1), pow(u, num(2)))));
      rule = "arcsin Derivative"; description = "d/dx[arcsin(u)] = 1/√(1-u²)·u'";
      break;
    case "arccos":
      innerResult = negate(div(num(1), fn("sqrt", sub(num(1), pow(u, num(2))))));
      rule = "arccos Derivative"; description = "d/dx[arccos(u)] = -1/√(1-u²)·u'";
      break;
    case "arctan":
      innerResult = div(num(1), add(num(1), pow(u, num(2))));
      rule = "arctan Derivative"; description = "d/dx[arctan(u)] = 1/(1+u²)·u'";
      break;
    case "arccsc":
      innerResult = negate(div(num(1), mul(fn("abs", u), fn("sqrt", sub(pow(u, num(2)), num(1))))));
      rule = "arccsc Derivative"; description = "d/dx[arccsc(u)] = -1/(|u|·√(u²-1))·u'";
      break;
    case "arcsec":
      innerResult = div(num(1), mul(fn("abs", u), fn("sqrt", sub(pow(u, num(2)), num(1)))));
      rule = "arcsec Derivative"; description = "d/dx[arcsec(u)] = 1/(|u|·√(u²-1))·u'";
      break;
    case "arccot":
      innerResult = negate(div(num(1), add(num(1), pow(u, num(2)))));
      rule = "arccot Derivative"; description = "d/dx[arccot(u)] = -1/(1+u²)·u'";
      break;

    // ── Hyperbolic ────────────────────────────────────────────────────────────
    case "sinh":
      innerResult = fn("cosh", u);
      rule = "sinh Derivative"; description = "d/dx[sinh(u)] = cosh(u)·u'";
      break;
    case "cosh":
      innerResult = fn("sinh", u);
      rule = "cosh Derivative"; description = "d/dx[cosh(u)] = sinh(u)·u'";
      break;
    case "tanh":
      innerResult = sub(num(1), pow(fn("tanh", u), num(2)));
      rule = "tanh Derivative"; description = "d/dx[tanh(u)] = sech²(u)·u'";
      break;

    // ── Exponential / Log ─────────────────────────────────────────────────────
    case "exp":
      innerResult = fn("exp", u);
      rule = "e^x Derivative"; description = "d/dx[e^u] = e^u·u'";
      break;
    case "ln":
      innerResult = div(num(1), u);
      rule = "ln Derivative"; description = "d/dx[ln(u)] = (1/u)·u'";
      break;
    case "log":
    case "log10":
      // d/dx[log10(u)] = 1 / (u·ln(10))
      innerResult = div(num(1), mul(u, fn("ln", num(10))));
      rule = "log10 Derivative"; description = "d/dx[log(u)] = 1/(u·ln10)·u'";
      break;
    case "log2":
      innerResult = div(num(1), mul(u, fn("ln", num(2))));
      rule = "log2 Derivative"; description = "d/dx[log₂(u)] = 1/(u·ln2)·u'";
      break;
    case "sqrt":
      // d/dx[√u] = 1/(2√u)
      innerResult = div(num(1), mul(num(2), fn("sqrt", u)));
      rule = "sqrt Derivative"; description = "d/dx[√u] = 1/(2√u)·u'";
      break;
    case "abs":
      innerResult = div(u, fn("abs", u));
      rule = "abs Derivative"; description = "d/dx[|u|] = u/|u|·u'";
      break;

    default:
      return record("Unknown Function", `d/dx[${name}(u)] left unevaluated`, before, before);
  }

  // Apply chain rule factor
  const withChain = isOne(du) ? innerResult : simplify(mul(innerResult, du));
  return record(rule, description, before, simplify(withChain));
}

// ─── Helper: does AST contain a given variable ──────────────────────────────

export function containsVariable(node: ASTNode, varName: string): boolean {
  switch (node.type) {
    case "Variable": return node.name === varName;
    case "Number":
    case "Constant": return false;
    case "Add":
    case "Subtract":
    case "Multiply": return containsVariable(node.left, varName) || containsVariable(node.right, varName);
    case "Divide": return containsVariable(node.numerator, varName) || containsVariable(node.denominator, varName);
    case "Power": return containsVariable(node.base, varName) || containsVariable(node.exponent, varName);
    case "Root": return containsVariable(node.radicand, varName) || containsVariable(node.index, varName);
    case "Negate": return containsVariable(node.argument, varName);
    case "FunctionCall": return containsVariable(node.argument, varName);
    case "Abs": return containsVariable(node.argument, varName);
    case "Integral": return node.variable !== varName && containsVariable(node.integrand, varName);
    case "Derivative": return containsVariable(node.expression, varName);
    case "Limit": return containsVariable(node.expression, varName);
    case "Summation":
    case "Product": return containsVariable(node.expression, varName);
    case "Equation": return containsVariable(node.left, varName) || containsVariable(node.right, varName);
    default: return false;
  }
}
