/**
 * Recursive-descent parser for a subset of mathematical notation.
 *
 * Supported syntax:
 *   Atoms:     numbers, variables (x,y,t,...), constants (pi, e)
 *   Binary:    +  -  *  /  ^ (right-assoc)
 *   Unary:     - (negation)
 *   Functions: sin cos tan csc sec cot arcsin arccos arctan
 *              sinh cosh tanh ln log sqrt abs exp
 *   Calculus:  d/dx[f], d/dy[f], d/dt[f]   → Derivative
 *              int(f, x)  or  ∫f dx          → Integral
 *              lim(x->a, f)  or  lim(x→a)[f] → Limit
 *   Equation:  f = g  →  Equation node
 */

import type { ASTNode } from "../../types/ast";
import {
  num, variable, constant, add, sub, mul, div, pow,
  fn, negate, integral, derivative, limit, root,
} from "../../types/ast";

// ─── Tokeniser ────────────────────────────────────────────────────────────────

type TKind =
  | "NUM" | "IDENT" | "PLUS" | "MINUS" | "STAR" | "SLASH" | "CARET"
  | "LPAREN" | "RPAREN" | "LBRACKET" | "RBRACKET"
  | "COMMA" | "EQ" | "ARROW" | "EOF"
  | "D_DX"   // d/dx, d/dy, d/dt  — pre-tokenised for convenience
  | "INT"    // ∫
  | "LIM";   // lim

interface Token { kind: TKind; text: string; pos: number }

function tokenize(src: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;

  // Normalise Unicode arrows
  src = src.replace(/→/g, "->").replace(/∫/g, " INT ").replace(/×/g, "*").replace(/÷/g, "/");

  while (i < src.length) {
    if (/\s/.test(src[i])) { i++; continue; }

    // d / d x  (derivative shorthand "d/dx", "d/dy", "d/dt")
    const dMatch = src.slice(i).match(/^d\s*\/\s*d([a-z])/);
    if (dMatch) {
      tokens.push({ kind: "D_DX", text: dMatch[1], pos: i });
      i += dMatch[0].length;
      continue;
    }

    // INT keyword
    const intMatch = src.slice(i).match(/^INT\b/i);
    if (intMatch) {
      tokens.push({ kind: "INT", text: "INT", pos: i });
      i += intMatch[0].length;
      continue;
    }

    // lim keyword
    if (src.slice(i).match(/^lim\b/i)) {
      tokens.push({ kind: "LIM", text: "lim", pos: i });
      i += 3;
      continue;
    }

    // Numbers
    const numMatch = src.slice(i).match(/^-?\d+(\.\d+)?/);
    if (numMatch && (tokens.length === 0 || ["PLUS","MINUS","STAR","SLASH","CARET","LPAREN","LBRACKET","COMMA","EQ","ARROW","D_DX","INT","LIM"].includes(tokens[tokens.length-1].kind))) {
      tokens.push({ kind: "NUM", text: numMatch[0], pos: i });
      i += numMatch[0].length;
      continue;
    }
    // Positive numbers (no sign)
    const posNumMatch = src.slice(i).match(/^\d+(\.\d+)?/);
    if (posNumMatch) {
      tokens.push({ kind: "NUM", text: posNumMatch[0], pos: i });
      i += posNumMatch[0].length;
      continue;
    }

    // Identifiers / keywords
    const identMatch = src.slice(i).match(/^[a-zA-Z_][a-zA-Z_0-9]*/);
    if (identMatch) {
      tokens.push({ kind: "IDENT", text: identMatch[0], pos: i });
      i += identMatch[0].length;
      continue;
    }

    // Two-char operators
    if (src.slice(i, i + 2) === "->") { tokens.push({ kind: "ARROW", text: "->", pos: i }); i += 2; continue; }

    // Single-char operators
    const ch = src[i];
    switch (ch) {
      case "+": tokens.push({ kind: "PLUS", text: ch, pos: i }); break;
      case "-": tokens.push({ kind: "MINUS", text: ch, pos: i }); break;
      case "*": tokens.push({ kind: "STAR", text: ch, pos: i }); break;
      case "/": tokens.push({ kind: "SLASH", text: ch, pos: i }); break;
      case "^": tokens.push({ kind: "CARET", text: ch, pos: i }); break;
      case "(": tokens.push({ kind: "LPAREN", text: ch, pos: i }); break;
      case ")": tokens.push({ kind: "RPAREN", text: ch, pos: i }); break;
      case "[": tokens.push({ kind: "LBRACKET", text: ch, pos: i }); break;
      case "]": tokens.push({ kind: "RBRACKET", text: ch, pos: i }); break;
      case ",": tokens.push({ kind: "COMMA", text: ch, pos: i }); break;
      case "=": tokens.push({ kind: "EQ", text: ch, pos: i }); break;
    }
    i++;
  }

  tokens.push({ kind: "EOF", text: "", pos: src.length });
  return tokens;
}

// ─── Parser ───────────────────────────────────────────────────────────────────

class Parser {
  private tokens: Token[];
  private pos = 0;

  constructor(src: string) {
    this.tokens = tokenize(src);
  }

  private peek(): Token { return this.tokens[this.pos]; }
  private eat(kind?: TKind): Token {
    const t = this.tokens[this.pos];
    if (kind && t.kind !== kind) throw new Error(`Expected ${kind} but got ${t.kind} ('${t.text}') at pos ${t.pos}`);
    this.pos++;
    return t;
  }
  private match(...kinds: TKind[]): boolean { return kinds.includes(this.peek().kind); }

  parse(): ASTNode {
    const node = this.parseEquation();
    if (this.peek().kind !== "EOF") {
      // Remaining tokens — still return what we parsed
    }
    return node;
  }

  // ── equation: expr (= expr)? ─────────────────────────────────────────────
  private parseEquation(): ASTNode {
    const left = this.parseAddSub();
    if (this.match("EQ")) {
      this.eat("EQ");
      const right = this.parseAddSub();
      return { type: "Equation", left, right, relation: "=" };
    }
    return left;
  }

  // ── additive: term ((+|-) term)* ─────────────────────────────────────────
  private parseAddSub(): ASTNode {
    let left = this.parseMulDiv();
    while (this.match("PLUS", "MINUS")) {
      const op = this.eat().kind;
      const right = this.parseMulDiv();
      left = op === "PLUS" ? add(left, right) : sub(left, right);
    }
    return left;
  }

  // ── multiplicative: power ((*|/) power)* ─────────────────────────────────
  private parseMulDiv(): ASTNode {
    let left = this.parsePower();
    while (this.match("STAR", "SLASH")) {
      const op = this.eat().kind;
      const right = this.parsePower();
      left = op === "STAR" ? mul(left, right) : div(left, right);
    }
    return left;
  }

  // ── power: unary (^ unary)* (right-associative) ──────────────────────────
  private parsePower(): ASTNode {
    const base = this.parseUnary();
    if (this.match("CARET")) {
      this.eat("CARET");
      const exp_ = this.parsePower(); // right-assoc
      return pow(base, exp_);
    }
    return base;
  }

  // ── unary: - atom | atom ─────────────────────────────────────────────────
  private parseUnary(): ASTNode {
    if (this.match("MINUS")) {
      this.eat("MINUS");
      return negate(this.parseUnary());
    }
    return this.parseAtom();
  }

  // ── atom: number | paren | function | calculus | variable ────────────────
  private parseAtom(): ASTNode {
    const t = this.peek();

    // Parenthesised group
    if (t.kind === "LPAREN") {
      this.eat("LPAREN");
      const inner = this.parseEquation();
      if (this.match("RPAREN")) this.eat("RPAREN");
      return inner;
    }

    // Number
    if (t.kind === "NUM") {
      this.eat("NUM");
      return num(parseFloat(t.text));
    }

    // Derivative: d/dx[...] or d/dx(...)
    if (t.kind === "D_DX") {
      this.eat("D_DX");
      const varName = t.text; // e.g. "x"
      let expr: ASTNode;
      if (this.match("LBRACKET")) {
        this.eat("LBRACKET");
        expr = this.parseEquation();
        if (this.match("RBRACKET")) this.eat("RBRACKET");
      } else if (this.match("LPAREN")) {
        this.eat("LPAREN");
        expr = this.parseEquation();
        if (this.match("RPAREN")) this.eat("RPAREN");
      } else {
        expr = this.parseAtom();
      }
      return derivative(expr, varName);
    }

    // Integral: INT(f, x) or INT f dx
    if (t.kind === "INT") {
      this.eat("INT");
      if (this.match("LPAREN")) {
        this.eat("LPAREN");
        const integrand = this.parseEquation();
        if (this.match("COMMA")) {
          this.eat("COMMA");
          const varTok = this.eat("IDENT");
          if (this.match("RPAREN")) this.eat("RPAREN");
          return integral(integrand, varTok.text);
        }
        if (this.match("RPAREN")) this.eat("RPAREN");
        return integral(integrand, "x");
      }
      // INT f dx  (scan for 'd' followed by variable name)
      const integrand = this.parseAddSub();
      // Look for dx / dt / dy etc.
      let varName = "x";
      if (this.match("IDENT") && this.peek().text.startsWith("d")) {
        const dv = this.eat("IDENT").text;
        varName = dv.length > 1 ? dv.slice(1) : "x";
      }
      return integral(integrand, varName);
    }

    // Limit: lim(x->a, f) or lim(x→a)[f]
    if (t.kind === "LIM") {
      this.eat("LIM");
      if (this.match("LPAREN")) {
        this.eat("LPAREN");
        const varTok = this.eat("IDENT");
        if (this.match("ARROW")) this.eat("ARROW");
        const approach = this.parseAddSub();
        let expr: ASTNode;
        if (this.match("COMMA")) {
          this.eat("COMMA");
          expr = this.parseEquation();
        } else {
          if (this.match("RPAREN")) this.eat("RPAREN");
          if (this.match("LBRACKET")) {
            this.eat("LBRACKET");
            expr = this.parseEquation();
            if (this.match("RBRACKET")) this.eat("RBRACKET");
          } else {
            expr = this.parseAddSub();
          }
          return limit(expr, varTok.text, approach);
        }
        if (this.match("RPAREN")) this.eat("RPAREN");
        return limit(expr, varTok.text, approach);
      }
      // lim_{x->a}[f]  — fallback
      return limit(variable("x"), "x", num(0));
    }

    // Identifier: function call or variable or constant
    if (t.kind === "IDENT") {
      this.eat("IDENT");
      const name = t.text.toLowerCase();

      // Known constants
      if (name === "pi" || name === "π") return constant("pi");
      if (name === "e" && !this.match("LPAREN")) return constant("e");
      if (name === "i" && !this.match("LPAREN")) return constant("i");

      // Known functions
      const FUNCS = ["sin","cos","tan","csc","sec","cot","arcsin","arccos","arctan",
                     "arccsc","arcsec","arccot","sinh","cosh","tanh","ln","log","exp",
                     "sqrt","abs","floor","ceil","log2","log10"];
      if (FUNCS.includes(name) && this.match("LPAREN")) {
        this.eat("LPAREN");
        const arg = this.parseEquation();
        if (this.match("RPAREN")) this.eat("RPAREN");
        if (name === "sqrt") return root(arg);
        return fn(name as any, arg);
      }

      // Implicit multiplication: identifier immediately followed by (  → function call
      if (this.match("LPAREN")) {
        this.eat("LPAREN");
        const arg = this.parseEquation();
        if (this.match("RPAREN")) this.eat("RPAREN");
        return fn(name as any, arg);
      }

      // Plain variable
      return variable(t.text);
    }

    // Bracket group: [expr]
    if (t.kind === "LBRACKET") {
      this.eat("LBRACKET");
      const inner = this.parseEquation();
      if (this.match("RBRACKET")) this.eat("RBRACKET");
      return inner;
    }

    throw new Error(`Unexpected token '${t.text}' (${t.kind}) at pos ${t.pos}`);
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

export interface ParseResult {
  ast: ASTNode | null;
  error: string | null;
}

export function parseExpression(src: string): ParseResult {
  const trimmed = src.trim();
  if (!trimmed) return { ast: null, error: null };
  try {
    const parser = new Parser(trimmed);
    const ast = parser.parse();
    return { ast, error: null };
  } catch (err) {
    return { ast: null, error: String(err) };
  }
}
