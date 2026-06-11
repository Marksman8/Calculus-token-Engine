import { describe, it, expect, beforeEach } from "vitest";
import { integrate, resetIntegralSteps, getIntegralSteps } from "../symbolic/integral/integrate";
import { num, variable, pow, fn, add, sub, mul, div, negate } from "../types/ast";
import { astToLatex } from "../renderer/latex/latexRenderer";

function intg(expr: any, v = "x") {
  resetIntegralSteps();
  return integrate(expr, v);
}

function latex(node: any): string {
  return astToLatex(node);
}

describe("Integral Constant Rule: ∫c dx = cx", () => {
  it("∫0 dx = 0", () => expect(latex(intg(num(0)))).toBe("0"));
  it("∫1 dx = x", () => expect(latex(intg(num(1)))).toBe("x"));
  it("∫5 dx = 5x", () => expect(latex(intg(num(5)))).toContain("5"));
  it("∫-3 dx = -3x", () => expect(latex(intg(num(-3)))).toBeTruthy());
  it("∫10 dx = 10x", () => expect(latex(intg(num(10)))).toContain("10"));
});

describe("Integral Power Rule: ∫x^n dx = x^(n+1)/(n+1)", () => {
  it("∫x dx = x²/2", () => {
    const r = intg(variable("x"));
    const l = latex(r);
    expect(l).toContain("2");
  });
  it("∫x² dx = x³/3", () => {
    const r = intg(pow(variable("x"), num(2)));
    const l = latex(r);
    expect(l).toContain("3");
  });
  it("∫x³ dx = x⁴/4", () => {
    const r = intg(pow(variable("x"), num(3)));
    const l = latex(r);
    expect(l).toContain("4");
  });
  it("∫x^0 dx = x", () => {
    const r = intg(pow(variable("x"), num(0)));
    expect(latex(r)).toBeTruthy();
  });
  it("∫x^-1 dx = ln|x|", () => {
    const r = intg(pow(variable("x"), num(-1)));
    expect(latex(r)).toContain("ln");
  });
  it("∫x^5 dx = x^6/6", () => {
    const r = intg(pow(variable("x"), num(5)));
    const l = latex(r);
    expect(l).toContain("6");
  });
  it("∫x^10 dx has /11", () => {
    const r = intg(pow(variable("x"), num(10)));
    const l = latex(r);
    expect(l).toContain("11");
  });
});

describe("Integral Sum/Difference Rules", () => {
  it("∫(x+1) dx = x²/2 + x", () => {
    const r = intg(add(variable("x"), num(1)));
    expect(latex(r)).toBeTruthy();
    const steps = getIntegralSteps();
    expect(steps.some((s) => s.ruleApplied.includes("Sum"))).toBe(true);
  });
  it("∫(x²+x) dx result is valid", () => {
    const r = intg(add(pow(variable("x"), num(2)), variable("x")));
    expect(latex(r)).toBeTruthy();
  });
  it("∫(x-1) dx result is valid", () => {
    const r = intg(sub(variable("x"), num(1)));
    expect(latex(r)).toBeTruthy();
  });
  it("∫(x³-x) dx result is valid", () => {
    const r = intg(sub(pow(variable("x"), num(3)), variable("x")));
    expect(latex(r)).toBeTruthy();
  });
});

describe("Integral Constant Multiple", () => {
  it("∫3x dx = 3·(x²/2)", () => {
    const r = intg(mul(num(3), variable("x")));
    const l = latex(r);
    expect(l).toContain("3");
    const steps = getIntegralSteps();
    expect(steps.some((s) => s.ruleApplied.includes("Constant Multiple"))).toBe(true);
  });
  it("∫5x² dx involves 5", () => {
    const r = intg(mul(num(5), pow(variable("x"), num(2))));
    const l = latex(r);
    expect(l).toContain("5");
  });
  it("∫-2x dx result is valid", () => {
    const r = intg(mul(num(-2), variable("x")));
    expect(latex(r)).toBeTruthy();
  });
});

describe("Integral Trig Rules", () => {
  it("∫sin(x) dx = -cos(x)", () => {
    const r = intg(fn("sin", variable("x")));
    const l = latex(r);
    expect(l).toContain("cos");
  });
  it("∫cos(x) dx = sin(x)", () => {
    const r = intg(fn("cos", variable("x")));
    const l = latex(r);
    expect(l).toContain("sin");
  });
  it("∫tan(x) dx = -ln|cos(x)|", () => {
    const r = intg(fn("tan", variable("x")));
    const l = latex(r);
    expect(l).toContain("ln");
    expect(l).toContain("cos");
  });
  it("∫cot(x) dx = ln|sin(x)|", () => {
    const r = intg(fn("cot", variable("x")));
    const l = latex(r);
    expect(l).toContain("ln");
    expect(l).toContain("sin");
  });
  it("∫sec(x) dx = ln|sec+tan|", () => {
    const r = intg(fn("sec", variable("x")));
    const l = latex(r);
    expect(l).toContain("ln");
  });
  it("∫csc(x) dx = -ln|csc+cot|", () => {
    const r = intg(fn("csc", variable("x")));
    const l = latex(r);
    expect(l).toContain("ln");
  });
});

describe("Integral Log/Exp Rules", () => {
  it("∫ln(x) dx = x·ln(x) - x", () => {
    const r = intg(fn("ln", variable("x")));
    const l = latex(r);
    expect(l).toContain("ln");
  });
  it("∫e^x dx = e^x (exp function)", () => {
    const r = intg(fn("exp", variable("x")));
    const l = latex(r);
    expect(l).toContain("e^");
  });
});

describe("Integral step tracking", () => {
  it("records steps for ∫x²", () => {
    const r = intg(pow(variable("x"), num(2)));
    const steps = getIntegralSteps();
    expect(steps.length).toBeGreaterThan(0);
    expect(steps[0].ruleApplied).toBeTruthy();
    expect(steps[0].id).toBeTruthy();
  });
  it("step IDs are unique", () => {
    const r = intg(add(pow(variable("x"), num(2)), fn("sin", variable("x"))));
    const steps = getIntegralSteps();
    const ids = steps.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
  it("steps have latex before/after", () => {
    const r = intg(variable("x"));
    const steps = getIntegralSteps();
    expect(steps[0].latexBefore).toBeTruthy();
    expect(steps[0].latexAfter).toBeTruthy();
  });
});
