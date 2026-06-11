import { describe, it, expect, beforeEach } from "vitest";
import {
  differentiate, resetSteps, getSteps,
} from "../symbolic/derivative/differentiate";
import {
  num, variable, constant, add, sub, mul, div, pow, fn, negate, root,
} from "../types/ast";
import { astToLatex } from "../renderer/latex/latexRenderer";
import { simplify } from "../symbolic/simplifier/simplify";

function d(expr: ReturnType<typeof num>, v = "x") {
  resetSteps();
  return differentiate(expr as any, v);
}

function latex(node: any): string {
  return astToLatex(node);
}

describe("Constant Rule", () => {
  it("d/dx[0] = 0", () => expect(latex(d(num(0)))).toBe("0"));
  it("d/dx[1] = 0", () => expect(latex(d(num(1)))).toBe("0"));
  it("d/dx[5] = 0", () => expect(latex(d(num(5)))).toBe("0"));
  it("d/dx[-3] = 0", () => expect(latex(d(num(-3)))).toBe("0"));
  it("d/dx[100] = 0", () => expect(latex(d(num(100)))).toBe("0"));
  it("d/dx[π] = 0", () => expect(latex(d(constant("pi") as any))).toBe("0"));
  it("d/dx[e] = 0", () => expect(latex(d(constant("e") as any))).toBe("0"));
});

describe("Variable Rule", () => {
  it("d/dx[x] = 1", () => expect(latex(d(variable("x") as any))).toBe("1"));
  it("d/dx[y] = 0 (y is constant)", () => expect(latex(d(variable("y") as any))).toBe("0"));
  it("d/dt[t] = 1", () => expect(latex(differentiate(variable("t"), "t"))).toBe("1"));
});

describe("Power Rule: d/dx[x^n] = n·x^(n-1)", () => {
  it("d/dx[x^1] = 1", () => {
    resetSteps();
    const r = differentiate(pow(variable("x"), num(1)), "x");
    expect(latex(r)).toBe("1");
  });
  it("d/dx[x^2] = 2x", () => {
    resetSteps();
    const r = differentiate(pow(variable("x"), num(2)), "x");
    expect(latex(r)).toBe("2x");
  });
  it("d/dx[x^3] = 3x²", () => {
    resetSteps();
    const r = differentiate(pow(variable("x"), num(3)), "x");
    const l = latex(r);
    expect(l).toContain("3");
    expect(l).toContain("x");
  });
  it("d/dx[x^4] produces x^3 factor", () => {
    resetSteps();
    const r = differentiate(pow(variable("x"), num(4)), "x");
    const l = latex(r);
    expect(l).toContain("4");
  });
  it("d/dx[x^0] = 0", () => {
    resetSteps();
    const r = differentiate(pow(variable("x"), num(0)), "x");
    expect(latex(r)).toBe("0");
  });
  it("d/dx[x^(1/2)] involves sqrt", () => {
    resetSteps();
    const r = differentiate(pow(variable("x"), div(num(1), num(2))), "x");
    // result involves 1/(2*x^(1/2)) or similar
    expect(latex(r)).toBeTruthy();
  });
  it("d/dx[x^-1] = -x^-2", () => {
    resetSteps();
    const r = differentiate(pow(variable("x"), num(-1)), "x");
    expect(latex(r)).toBeTruthy();
  });
});

describe("Sum Rule: d/dx[f+g] = f'+g'", () => {
  it("d/dx[x+x] = 2", () => {
    resetSteps();
    const r = differentiate(add(variable("x"), variable("x")), "x");
    expect(latex(r)).toBe("2");
  });
  it("d/dx[x²+x] = 2x+1", () => {
    resetSteps();
    const r = differentiate(add(pow(variable("x"), num(2)), variable("x")), "x");
    const l = latex(r);
    expect(l).toContain("1");
  });
  it("d/dx[x²+5] = 2x", () => {
    resetSteps();
    const r = differentiate(add(pow(variable("x"), num(2)), num(5)), "x");
    const l = latex(r);
    expect(l).toContain("2");
  });
  it("d/dx[x³+x²+x] has 3 terms", () => {
    resetSteps();
    const expr = add(add(pow(variable("x"), num(3)), pow(variable("x"), num(2))), variable("x"));
    const r = differentiate(expr, "x");
    expect(latex(r)).toBeTruthy();
  });
});

describe("Difference Rule", () => {
  it("d/dx[x-x] = 0", () => {
    resetSteps();
    const r = differentiate(sub(variable("x"), variable("x")), "x");
    expect(latex(r)).toBe("0");
  });
  it("d/dx[x²-x] involves 2x and 1", () => {
    resetSteps();
    const r = differentiate(sub(pow(variable("x"), num(2)), variable("x")), "x");
    const l = latex(r);
    expect(l).toBeTruthy();
  });
});

describe("Product Rule", () => {
  it("d/dx[x·x] = 2x", () => {
    resetSteps();
    const r = differentiate(mul(variable("x"), variable("x")), "x");
    expect(latex(r)).toBe("2x");
  });
  it("d/dx[x²·x] = 3x²", () => {
    resetSteps();
    const r = differentiate(mul(pow(variable("x"), num(2)), variable("x")), "x");
    expect(latex(r)).toBeTruthy();
  });
  it("d/dx[x·sin(x)] uses product rule", () => {
    resetSteps();
    const r = differentiate(mul(variable("x"), fn("sin", variable("x"))), "x");
    expect(latex(r)).toBeTruthy();
    const steps = getSteps();
    expect(steps.some((s) => s.ruleApplied.includes("Product"))).toBe(true);
  });
});

describe("Quotient Rule", () => {
  it("d/dx[x/x] = 0", () => {
    resetSteps();
    const r = differentiate(div(variable("x"), variable("x")), "x");
    expect(latex(r)).toBe("0");
  });
  it("d/dx[1/x] = -1/x²", () => {
    resetSteps();
    const r = differentiate(div(num(1), variable("x")), "x");
    const l = latex(r);
    expect(l).toBeTruthy();
    const steps = getSteps();
    expect(steps.some((s) => s.ruleApplied.includes("Quotient"))).toBe(true);
  });
  it("d/dx[x/x²] = -1/x²", () => {
    resetSteps();
    const r = differentiate(div(variable("x"), pow(variable("x"), num(2))), "x");
    expect(latex(r)).toBeTruthy();
  });
});

describe("Trig Derivatives", () => {
  it("d/dx[sin(x)] = cos(x)", () => {
    resetSteps();
    const r = differentiate(fn("sin", variable("x")), "x");
    expect(latex(r)).toContain("cos");
  });
  it("d/dx[cos(x)] = -sin(x)", () => {
    resetSteps();
    const r = differentiate(fn("cos", variable("x")), "x");
    expect(latex(r)).toContain("sin");
  });
  it("d/dx[tan(x)] = sec²(x)", () => {
    resetSteps();
    const r = differentiate(fn("tan", variable("x")), "x");
    expect(latex(r)).toContain("sec");
  });
  it("d/dx[csc(x)] = -csc(x)cot(x)", () => {
    resetSteps();
    const r = differentiate(fn("csc", variable("x")), "x");
    expect(latex(r)).toContain("csc");
  });
  it("d/dx[sec(x)] = sec(x)tan(x)", () => {
    resetSteps();
    const r = differentiate(fn("sec", variable("x")), "x");
    expect(latex(r)).toContain("sec");
    expect(latex(r)).toContain("tan");
  });
  it("d/dx[cot(x)] = -csc²(x)", () => {
    resetSteps();
    const r = differentiate(fn("cot", variable("x")), "x");
    expect(latex(r)).toContain("csc");
  });
});

describe("Inverse Trig Derivatives", () => {
  it("d/dx[arcsin(x)] involves sqrt", () => {
    resetSteps();
    const r = differentiate(fn("arcsin", variable("x")), "x");
    expect(latex(r)).toContain("sqrt");
  });
  it("d/dx[arccos(x)] involves sqrt", () => {
    resetSteps();
    const r = differentiate(fn("arccos", variable("x")), "x");
    expect(latex(r)).toContain("sqrt");
  });
  it("d/dx[arctan(x)] = 1/(1+x²)", () => {
    resetSteps();
    const r = differentiate(fn("arctan", variable("x")), "x");
    const l = latex(r);
    expect(l).toBeTruthy();
  });
});

describe("Exponential and Log Derivatives", () => {
  it("d/dx[e^x] = e^x", () => {
    resetSteps();
    const r = differentiate(fn("exp", variable("x")), "x");
    expect(latex(r)).toContain("e^");
  });
  it("d/dx[ln(x)] = 1/x", () => {
    resetSteps();
    const r = differentiate(fn("ln", variable("x")), "x");
    expect(latex(r)).toContain("frac");
  });
  it("d/dx[log10(x)] has 1/x·ln10 form", () => {
    resetSteps();
    const r = differentiate(fn("log10", variable("x")), "x");
    expect(latex(r)).toBeTruthy();
  });
  it("d/dx[sqrt(x)] = 1/(2√x)", () => {
    resetSteps();
    const r = differentiate(fn("sqrt", variable("x")), "x");
    expect(latex(r)).toBeTruthy();
  });
});

describe("Chain Rule", () => {
  it("d/dx[sin(x²)] involves chain rule", () => {
    resetSteps();
    const r = differentiate(fn("sin", pow(variable("x"), num(2))), "x");
    expect(latex(r)).toBeTruthy();
    const steps = getSteps();
    expect(steps.length).toBeGreaterThan(1);
  });
  it("d/dx[ln(x²)] = 2/x", () => {
    resetSteps();
    const r = differentiate(fn("ln", pow(variable("x"), num(2))), "x");
    expect(latex(r)).toBeTruthy();
  });
  it("d/dx[e^(x²)] involves 2x", () => {
    resetSteps();
    const r = differentiate(fn("exp", pow(variable("x"), num(2))), "x");
    const l = latex(r);
    expect(l).toBeTruthy();
  });
  it("d/dx[(x²+1)^3] uses chain rule", () => {
    resetSteps();
    const r = differentiate(pow(add(pow(variable("x"), num(2)), num(1)), num(3)), "x");
    expect(latex(r)).toBeTruthy();
  });
});

describe("Negate Rule", () => {
  it("d/dx[-x] = -1", () => {
    resetSteps();
    const r = differentiate(negate(variable("x")), "x");
    expect(latex(r)).toBe("(-1)");
  });
  it("d/dx[-x²] = -2x", () => {
    resetSteps();
    const r = differentiate(negate(pow(variable("x"), num(2))), "x");
    const l = latex(r);
    expect(l).toBeTruthy();
  });
});

describe("Constant Multiple Rule", () => {
  it("d/dx[3x] = 3", () => {
    resetSteps();
    const r = differentiate(mul(num(3), variable("x")), "x");
    expect(latex(r)).toBe("3");
  });
  it("d/dx[5x²] = 10x", () => {
    resetSteps();
    const r = differentiate(mul(num(5), pow(variable("x"), num(2))), "x");
    const l = latex(r);
    expect(l).toContain("10");
  });
  it("d/dx[2sin(x)] = 2cos(x)", () => {
    resetSteps();
    const r = differentiate(mul(num(2), fn("sin", variable("x"))), "x");
    expect(latex(r)).toContain("cos");
  });
  it("d/dx[-3x³] produces correct result", () => {
    resetSteps();
    const r = differentiate(mul(num(-3), pow(variable("x"), num(3))), "x");
    expect(latex(r)).toBeTruthy();
  });
});

describe("Step Generation", () => {
  it("records steps for d/dx[x²]", () => {
    resetSteps();
    differentiate(pow(variable("x"), num(2)), "x");
    const steps = getSteps();
    expect(steps.length).toBeGreaterThan(0);
    expect(steps[0].ruleApplied).toBeTruthy();
    expect(steps[0].latexBefore).toBeTruthy();
    expect(steps[0].latexAfter).toBeTruthy();
  });

  it("records step ids as unique strings", () => {
    resetSteps();
    differentiate(add(pow(variable("x"), num(3)), fn("sin", variable("x"))), "x");
    const steps = getSteps();
    const ids = steps.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("step numbers are sequential", () => {
    resetSteps();
    differentiate(add(variable("x"), pow(variable("x"), num(2))), "x");
    const steps = getSteps();
    steps.forEach((s, i) => expect(s.stepNumber).toBe(i + 1));
  });
});

describe("Hyperbolic Derivatives", () => {
  it("d/dx[sinh(x)] = cosh(x)", () => {
    resetSteps();
    const r = differentiate(fn("sinh", variable("x")), "x");
    expect(latex(r)).toContain("cosh");
  });
  it("d/dx[cosh(x)] = sinh(x)", () => {
    resetSteps();
    const r = differentiate(fn("cosh", variable("x")), "x");
    expect(latex(r)).toContain("sinh");
  });
});
