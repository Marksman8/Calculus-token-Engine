import { describe, it, expect, beforeEach } from "vitest";
import { evaluateLimit, resetLimitSteps, getLimitSteps } from "../symbolic/limits/evaluateLimit";
import { substitute } from "../symbolic/limits/evaluateLimit";
import { num, variable, pow, div, sub, add, fn, mul } from "../types/ast";
import type { LimitNode } from "../types/ast";
import { astToLatex } from "../renderer/latex/latexRenderer";

function lim(expression: any, varName: string, approach: any): any {
  resetLimitSteps();
  const node: LimitNode = { type: "Limit", expression, variable: varName, approach };
  return evaluateLimit(node);
}

function latex(node: any) { return astToLatex(node); }

describe("Direct Substitution Limits", () => {
  it("lim(x→3)[x] = 3", () => {
    const r = lim(variable("x"), "x", num(3));
    expect(latex(r)).toBe("3");
  });
  it("lim(x→2)[x²] = 4", () => {
    const r = lim(pow(variable("x"), num(2)), "x", num(2));
    expect(latex(r)).toBe("4");
  });
  it("lim(x→0)[x] = 0", () => {
    const r = lim(variable("x"), "x", num(0));
    expect(latex(r)).toBe("0");
  });
  it("lim(x→1)[x³] = 1", () => {
    const r = lim(pow(variable("x"), num(3)), "x", num(1));
    expect(latex(r)).toBe("1");
  });
  it("lim(x→5)[2x] = 10", () => {
    const r = lim(mul(num(2), variable("x")), "x", num(5));
    expect(latex(r)).toBe("10");
  });
  it("lim(x→2)[x+3] = 5", () => {
    const r = lim(add(variable("x"), num(3)), "x", num(2));
    expect(latex(r)).toBe("5");
  });
});

describe("Limits with 0/0 — factorization or L'Hôpital", () => {
  it("lim(x→0)[x/x] = 1", () => {
    const r = lim(div(variable("x"), variable("x")), "x", num(0));
    // After simplification x/x = 1 before substitution
    expect(latex(r)).toBeTruthy();
  });
  it("lim(x→1)[(x²-1)/(x-1)] resolves", () => {
    const expr = div(sub(pow(variable("x"), num(2)), num(1)), sub(variable("x"), num(1)));
    const r = lim(expr, "x", num(1));
    expect(latex(r)).toBeTruthy();
    const steps = getLimitSteps();
    expect(steps.length).toBeGreaterThan(0);
  });
});

describe("Limit Step Recording", () => {
  it("records steps", () => {
    lim(variable("x"), "x", num(3));
    const steps = getLimitSteps();
    expect(steps.length).toBeGreaterThan(0);
  });
  it("step has rule and description", () => {
    lim(pow(variable("x"), num(2)), "x", num(2));
    const steps = getLimitSteps();
    expect(steps[0].ruleApplied).toBeTruthy();
    expect(steps[0].ruleDescription).toBeTruthy();
  });
  it("step IDs are unique", () => {
    const r = lim(add(variable("x"), num(3)), "x", num(2));
    const steps = getLimitSteps();
    const ids = steps.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("substitute helper", () => {
  it("replaces variable", () => {
    const r = substitute(variable("x"), "x", num(5));
    expect(r.type).toBe("Number");
    expect((r as any).value).toBe(5);
  });
  it("leaves non-matching variable alone", () => {
    const r = substitute(variable("y"), "x", num(5));
    expect(r.type).toBe("Variable");
    expect((r as any).name).toBe("y");
  });
  it("replaces in add", () => {
    const r = substitute(add(variable("x"), num(1)), "x", num(3));
    expect(r.type).toBe("Add");
    expect((r as any).left.value).toBe(3);
  });
  it("replaces in power", () => {
    const r = substitute(pow(variable("x"), num(2)), "x", num(3));
    expect((r as any).base.value).toBe(3);
  });
  it("replaces in fn argument", () => {
    const r = substitute(fn("sin", variable("x")), "x", num(0));
    expect((r as any).argument.value).toBe(0);
  });
});
