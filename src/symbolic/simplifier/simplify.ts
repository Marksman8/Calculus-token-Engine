import type { ASTNode } from "../../types/ast";
import {
  add, sub, mul, div, pow, negate, num, fn,
  isZero, isOne, isNumber, isNegOne,
} from "../../types/ast";

// ─── Simplification pass ─────────────────────────────────────────────────────
// Applies algebraic identities bottom-up (single pass).

export function simplify(node: ASTNode): ASTNode {
  switch (node.type) {
    // ── Recurse into children first ──────────────────────────────────────────
    case "Add": {
      const l = simplify(node.left);
      const r = simplify(node.right);
      if (isZero(l)) return r;
      if (isZero(r)) return l;
      if (isNumber(l) && isNumber(r)) return num(l.value + r.value);
      // x + (-y)  →  x - y   (cosmetic)
      if (r.type === "Negate") return simplify(sub(l, r.argument));
      // a + a  →  2a
      if (nodesEqual(l, r)) return simplify(mul(num(2), l));
      return add(l, r);
    }

    case "Subtract": {
      const l = simplify(node.left);
      const r = simplify(node.right);
      if (isZero(r)) return l;
      if (isZero(l)) return simplify(negate(r));
      if (isNumber(l) && isNumber(r)) return num(l.value - r.value);
      if (l.type === "Variable" && r.type === "Variable" && l.name === r.name) return num(0);
      return sub(l, r);
    }

    case "Multiply": {
      const l = simplify(node.left);
      const r = simplify(node.right);
      if (isZero(l) || isZero(r)) return num(0);
      if (isOne(l)) return r;
      if (isOne(r)) return l;
      if (isNegOne(l)) return simplify(negate(r));
      if (isNegOne(r)) return simplify(negate(l));
      if (isNumber(l) && isNumber(r)) return num(l.value * r.value);
      // num(a) * (num(b) * expr)  →  num(a*b) * expr
      if (isNumber(l) && r.type === "Multiply" && isNumber((r as any).left)) {
        return simplify(mul(num(l.value * (r as any).left.value), (r as any).right));
      }
      // (num(a) * expr) * num(b)  →  num(a*b) * expr
      if (l.type === "Multiply" && isNumber((l as any).left) && isNumber(r)) {
        return simplify(mul(num((l as any).left.value * r.value), (l as any).right));
      }
      // x * x  →  x²
      if (nodesEqual(l, r)) return simplify(pow(l, num(2)));
      // -1 * -1 handled above; (-a)(-b) → ab
      if (l.type === "Negate" && r.type === "Negate") {
        return simplify(mul(l.argument, r.argument));
      }
      return mul(l, r);
    }

    case "Divide": {
      const n = simplify(node.numerator);
      const d = simplify(node.denominator);
      if (isZero(n)) return num(0);
      if (isOne(d)) return n;
      if (isNumber(n) && isNumber(d) && d.value !== 0) {
        const gcd = gcdOf(Math.abs(n.value), Math.abs(d.value));
        if (gcd > 1) {
          const nr = num(n.value / gcd);
          const dr = num(d.value / gcd);
          if (isOne(dr)) return nr;
          return div(nr, dr);
        }
      }
      if (nodesEqual(n, d)) return num(1);
      return div(n, d);
    }

    case "Power": {
      const base = simplify(node.base);
      const exp_ = simplify(node.exponent);
      if (isZero(exp_)) return num(1);
      if (isOne(exp_)) return base;
      if (isZero(base)) return num(0);
      if (isOne(base)) return num(1);
      if (isNumber(base) && isNumber(exp_) && exp_.value >= 0 && exp_.value <= 10) {
        return num(Math.pow(base.value, exp_.value));
      }
      return pow(base, exp_);
    }

    case "Negate": {
      const a = simplify(node.argument);
      if (isZero(a)) return num(0);
      if (isNumber(a)) return num(-a.value);
      if (a.type === "Negate") return a.argument; // --x = x
      return negate(a);
    }

    case "Root": {
      const radicand = simplify(node.radicand);
      const index = simplify(node.index);
      if (isNumber(radicand) && isNumber(index) && radicand.value >= 0) {
        return num(Math.pow(radicand.value, 1 / index.value));
      }
      return { type: "Root", radicand, index };
    }

    case "FunctionCall": {
      const arg = simplify(node.argument);
      // Evaluate numeric constants
      if (isNumber(arg)) {
        const v = arg.value;
        switch (node.name) {
          case "sin": return num(roundIfClose(Math.sin(v)));
          case "cos": return num(roundIfClose(Math.cos(v)));
          case "tan": return num(roundIfClose(Math.tan(v)));
          case "ln": return v > 0 ? num(roundIfClose(Math.log(v))) : fn(node.name, arg);
          case "exp": return num(roundIfClose(Math.exp(v)));
          case "sqrt": return v >= 0 ? num(roundIfClose(Math.sqrt(v))) : fn(node.name, arg);
          case "abs": return num(Math.abs(v));
        }
      }
      return { ...node, argument: arg };
    }

    case "Add":
    case "Abs": {
      const a = simplify((node as any).argument);
      if (isNumber(a)) return num(Math.abs(a.value));
      return { ...node, argument: a } as ASTNode;
    }

    // Recurse into structured nodes
    case "Derivative": return { ...node, expression: simplify(node.expression) };
    case "Integral": return { ...node, integrand: simplify(node.integrand) };
    case "Limit": return { ...node, expression: simplify(node.expression) };
    case "Summation": return { ...node, expression: simplify(node.expression) };
    case "Product": return { ...node, expression: simplify(node.expression) };

    default:
      return node;
  }
}

// ─── Deep structural equality check ─────────────────────────────────────────

export function nodesEqual(a: ASTNode, b: ASTNode): boolean {
  if (a.type !== b.type) return false;
  switch (a.type) {
    case "Number": return a.value === (b as any).value;
    case "Variable": return a.name === (b as any).name;
    case "Constant": return a.name === (b as any).name;
    case "Add":
    case "Subtract":
    case "Multiply":
      return nodesEqual(a.left, (b as any).left) && nodesEqual(a.right, (b as any).right);
    case "Divide":
      return nodesEqual(a.numerator, (b as any).numerator) && nodesEqual(a.denominator, (b as any).denominator);
    case "Power":
      return nodesEqual(a.base, (b as any).base) && nodesEqual(a.exponent, (b as any).exponent);
    case "Negate":
    case "Abs":
      return nodesEqual(a.argument, (b as any).argument);
    case "FunctionCall":
      return a.name === (b as any).name && nodesEqual(a.argument, (b as any).argument);
    default:
      return JSON.stringify(a) === JSON.stringify(b);
  }
}

// ─── Numeric helpers ─────────────────────────────────────────────────────────

function gcdOf(a: number, b: number): number {
  while (b) { [a, b] = [b, a % b]; }
  return a;
}

function roundIfClose(x: number): number {
  const rounded = Math.round(x);
  return Math.abs(x - rounded) < 1e-10 ? rounded : x;
}
