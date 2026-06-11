import { describe, it, expect } from "vitest";
import { astToLatex } from "../renderer/latex/latexRenderer";
import {
  num, variable, constant, add, sub, mul, div, pow, fn, negate, integral, derivative, limit, root,
} from "../types/ast";

describe("LaTeX: Numbers", () => {
  it("0", () => expect(astToLatex(num(0))).toBe("0"));
  it("1", () => expect(astToLatex(num(1))).toBe("1"));
  it("42", () => expect(astToLatex(num(42))).toBe("42"));
  it("negative wrapped in parens", () => expect(astToLatex(num(-3))).toBe("(-3)"));
  it("Infinity", () => expect(astToLatex(num(Infinity))).toBe("\\infty"));
  it("-Infinity", () => expect(astToLatex(num(-Infinity))).toBe("-\\infty"));
});

describe("LaTeX: Variables and Constants", () => {
  it("x", () => expect(astToLatex(variable("x"))).toBe("x"));
  it("y", () => expect(astToLatex(variable("y"))).toBe("y"));
  it("pi", () => expect(astToLatex(constant("pi"))).toBe("\\pi"));
  it("e", () => expect(astToLatex(constant("e"))).toBe("e"));
});

describe("LaTeX: Arithmetic", () => {
  it("x+y", () => expect(astToLatex(add(variable("x"), variable("y")))).toBe("x + y"));
  it("x-y", () => expect(astToLatex(sub(variable("x"), variable("y")))).toBe("x - y"));
  it("1/x", () => expect(astToLatex(div(num(1), variable("x")))).toBe("\\frac{1}{x}"));
  it("x^2", () => expect(astToLatex(pow(variable("x"), num(2)))).toContain("^"));
  it("-x", () => expect(astToLatex(negate(variable("x")))).toBe("-x"));
  it("-(x+y) wrapped", () => expect(astToLatex(negate(add(variable("x"), variable("y"))))).toContain("\\left("));
  it("sqrt(x)", () => expect(astToLatex(root(variable("x")))).toBe("\\sqrt{x}"));
  it("cbrt(x)", () => expect(astToLatex(root(variable("x"), num(3)))).toContain("\\sqrt[3]"));
});

describe("LaTeX: Functions", () => {
  it("sin(x)", () => expect(astToLatex(fn("sin", variable("x")))).toBe("\\sin\\left(x\\right)"));
  it("cos(x)", () => expect(astToLatex(fn("cos", variable("x")))).toBe("\\cos\\left(x\\right)"));
  it("tan(x)", () => expect(astToLatex(fn("tan", variable("x")))).toBe("\\tan\\left(x\\right)"));
  it("ln(x)", () => expect(astToLatex(fn("ln", variable("x")))).toBe("\\ln\\left(x\\right)"));
  it("exp(x)", () => expect(astToLatex(fn("exp", variable("x")))).toBe("e^{x}"));
  it("sqrt(x)", () => expect(astToLatex(fn("sqrt", variable("x")))).toBe("\\sqrt{x}"));
  it("arcsin", () => expect(astToLatex(fn("arcsin", variable("x")))).toContain("arcsin"));
  it("arctan", () => expect(astToLatex(fn("arctan", variable("x")))).toContain("arctan"));
});

describe("LaTeX: Calculus operators", () => {
  it("d/dx[x²]", () => {
    const node = derivative(pow(variable("x"), num(2)), "x");
    const l = astToLatex(node);
    expect(l).toContain("frac");
    expect(l).toContain("d");
  });
  it("∫x dx", () => {
    const node = integral(variable("x"), "x");
    const l = astToLatex(node);
    expect(l).toContain("int");
    expect(l).toContain("dx");
  });
  it("lim x→0 of x", () => {
    const node = limit(variable("x"), "x", num(0));
    const l = astToLatex(node);
    expect(l).toContain("lim");
    expect(l).toContain("to");
  });
  it("definite integral has bounds", () => {
    const node = integral(variable("x"), "x", num(0), num(1));
    const l = astToLatex(node);
    expect(l).toContain("_{0}");
    expect(l).toContain("^{1}");
  });
  it("summation", () => {
    const node: any = { type: "Summation", expression: variable("k"), variable: "k", lower: num(1), upper: variable("n") };
    const l = astToLatex(node);
    expect(l).toContain("sum");
  });
});

describe("LaTeX: Nesting", () => {
  it("(x+y)/z uses frac", () => {
    const l = astToLatex(div(add(variable("x"), variable("y")), variable("z")));
    expect(l).toContain("frac");
  });
  it("sin²(x)", () => {
    const l = astToLatex(pow(fn("sin", variable("x")), num(2)));
    expect(l).toContain("sin");
    expect(l).toContain("^");
  });
  it("|x|", () => {
    const l = astToLatex({ type: "Abs", argument: variable("x") } as any);
    expect(l).toContain("left|");
  });
});
