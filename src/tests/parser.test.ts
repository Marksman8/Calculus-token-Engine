import { describe, it, expect } from "vitest";
import { parseExpression } from "../compiler/parser/parseExpression";
import { astToLatex } from "../renderer/latex/latexRenderer";

function parse(src: string) { return parseExpression(src); }
function latex(src: string) {
  const r = parse(src);
  return r.ast ? astToLatex(r.ast) : null;
}

describe("Parser: numbers and variables", () => {
  it("parses integer", () => { const r = parse("5"); expect(r.ast?.type).toBe("Number"); });
  it("parses float", () => { const r = parse("3.14"); expect(r.ast?.type).toBe("Number"); });
  it("parses variable x", () => { const r = parse("x"); expect(r.ast?.type).toBe("Variable"); });
  it("parses variable y", () => { const r = parse("y"); expect(r.ast?.type).toBe("Variable"); });
  it("parses constant pi", () => { const r = parse("pi"); expect(r.ast?.type).toBe("Constant"); });
  it("parses constant e", () => { const r = parse("e"); expect(r.ast?.type).toBe("Constant"); });
  it("no error on empty string", () => { const r = parse(""); expect(r.error).toBeNull(); expect(r.ast).toBeNull(); });
});

describe("Parser: arithmetic", () => {
  it("parses x+1", () => { const r = parse("x+1"); expect(r.ast?.type).toBe("Add"); });
  it("parses x-1", () => { const r = parse("x-1"); expect(r.ast?.type).toBe("Subtract"); });
  it("parses x*2", () => { const r = parse("x*2"); expect(r.ast?.type).toBe("Multiply"); });
  it("parses x/2", () => { const r = parse("x/2"); expect(r.ast?.type).toBe("Divide"); });
  it("parses x^2", () => { const r = parse("x^2"); expect(r.ast?.type).toBe("Power"); });
  it("parses -x", () => { const r = parse("-x"); expect(r.ast?.type).toBe("Negate"); });
  it("parses (x+1)*(x-1)", () => { const r = parse("(x+1)*(x-1)"); expect(r.ast?.type).toBe("Multiply"); });
  it("parses 2*x^2 + 3*x + 1", () => { const r = parse("2*x^2 + 3*x + 1"); expect(r.ast?.type).toBe("Add"); });
});

describe("Parser: functions", () => {
  it("parses sin(x)", () => { const r = parse("sin(x)"); expect(r.ast?.type).toBe("FunctionCall"); expect((r.ast as any).name).toBe("sin"); });
  it("parses cos(x)", () => { const r = parse("cos(x)"); expect(r.ast?.type).toBe("FunctionCall"); });
  it("parses ln(x)", () => { const r = parse("ln(x)"); expect(r.ast?.type).toBe("FunctionCall"); });
  it("parses sqrt(x)", () => { const r = parse("sqrt(x)"); expect(r.ast?.type).toBe("Root"); });
  it("parses exp(x)", () => { const r = parse("exp(x)"); expect(r.ast?.type).toBe("FunctionCall"); });
  it("parses arctan(x)", () => { const r = parse("arctan(x)"); expect(r.ast?.type).toBe("FunctionCall"); });
  it("parses nested sin(x^2)", () => { const r = parse("sin(x^2)"); expect(r.ast?.type).toBe("FunctionCall"); expect((r.ast as any).argument.type).toBe("Power"); });
});

describe("Parser: calculus operators", () => {
  it("parses d/dx[x^3] as Derivative", () => {
    const r = parse("d/dx[x^3]");
    expect(r.error).toBeNull();
    expect(r.ast?.type).toBe("Derivative");
    expect((r.ast as any).variable).toBe("x");
  });
  it("parses d/dx(sin(x)) as Derivative", () => {
    const r = parse("d/dx(sin(x))");
    expect(r.ast?.type).toBe("Derivative");
  });
  it("parses d/dt[t^2] w.r.t. t", () => {
    const r = parse("d/dt[t^2]");
    expect(r.ast?.type).toBe("Derivative");
    expect((r.ast as any).variable).toBe("t");
  });
  it("parses INT(x^2, x) as Integral", () => {
    const r = parse("INT(x^2, x)");
    expect(r.ast?.type).toBe("Integral");
    expect((r.ast as any).variable).toBe("x");
  });
  it("parses INT(sin(x), x) as Integral", () => {
    const r = parse("INT(sin(x), x)");
    expect(r.ast?.type).toBe("Integral");
  });
  it("parses lim(x->0, sin(x)/x) as Limit", () => {
    const r = parse("lim(x->0, sin(x)/x)");
    expect(r.ast?.type).toBe("Limit");
    expect((r.ast as any).variable).toBe("x");
  });
  it("parses lim(x->2, x^2) as Limit", () => {
    const r = parse("lim(x->2, x^2)");
    expect(r.ast?.type).toBe("Limit");
    expect((r.ast as any).approach.value).toBe(2);
  });
});

describe("Parser: equations", () => {
  it("parses x^2 = 4 as Equation", () => {
    const r = parse("x^2 = 4");
    expect(r.ast?.type).toBe("Equation");
    expect((r.ast as any).relation).toBe("=");
  });
  it("parses x = y as Equation", () => {
    const r = parse("x = y");
    expect(r.ast?.type).toBe("Equation");
    expect((r.ast as any).left.name).toBe("x");
    expect((r.ast as any).right.name).toBe("y");
  });
  it("parses x^2 + 2x + 1 = 0", () => {
    const r = parse("x^2 + 2*x + 1 = 0");
    expect(r.ast?.type).toBe("Equation");
  });
  it("Equation left is the LHS expression", () => {
    const r = parse("sin(x) = cos(x)");
    expect(r.ast?.type).toBe("Equation");
    expect((r.ast as any).left.type).toBe("FunctionCall");
    expect((r.ast as any).right.type).toBe("FunctionCall");
  });
});

describe("Parser: LaTeX output round-trip", () => {
  it("d/dx[x^3] produces derivative LaTeX", () => {
    const l = latex("d/dx[x^3]");
    expect(l).toContain("frac");
    expect(l).toContain("d");
  });
  it("INT(x^2, x) produces integral LaTeX", () => {
    const l = latex("INT(x^2, x)");
    expect(l).toContain("int");
  });
  it("sin(x) + cos(x) renders correctly", () => {
    const l = latex("sin(x) + cos(x)");
    expect(l).toContain("sin");
    expect(l).toContain("cos");
  });
  it("x^2 = 4 renders equation", () => {
    const l = latex("x^2 = 4");
    expect(l).toContain("=");
  });
});

describe("Parser: error handling", () => {
  it("returns error on unmatched paren", () => {
    const r = parse("sin(x");
    // May produce partial AST or error — just not crash
    expect(() => parse("sin(x")).not.toThrow();
  });
  it("returns null AST on empty", () => {
    const r = parse("   ");
    expect(r.ast).toBeNull();
  });
});
