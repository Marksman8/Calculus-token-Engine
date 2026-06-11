import { describe, it, expect } from "vitest";
import { compile, autoCompile } from "../compiler/transformer/pipeline";
import { derivative, integral, limit, pow, variable, num, fn, add } from "../types/ast";
import { validateAST } from "../compiler/validator/validateAST";

describe("Compiler Pipeline: Derivative", () => {
  it("compiles d/dx[x²] successfully", () => {
    const ast = derivative(pow(variable("x"), num(2)), "x");
    const result = compile({ ast, mode: "derivative" });
    expect(result.success).toBe(true);
    expect(result.steps.length).toBeGreaterThan(0);
    expect(result.latexOutput).toBeTruthy();
  });

  it("compiles d/dx[sin(x)] successfully", () => {
    const ast = derivative(fn("sin", variable("x")), "x");
    const result = compile({ ast, mode: "derivative" });
    expect(result.success).toBe(true);
    expect(result.latexOutput).toContain("cos");
  });

  it("latexInput equals input expression", () => {
    const ast = derivative(variable("x"), "x");
    const result = compile({ ast, mode: "derivative" });
    expect(result.latexInput).toBeTruthy();
  });

  it("stores inputAST", () => {
    const ast = derivative(pow(variable("x"), num(3)), "x");
    const result = compile({ ast, mode: "derivative" });
    expect(result.inputAST.type).toBe("Derivative");
  });
});

describe("Compiler Pipeline: Integral", () => {
  it("compiles ∫x² dx successfully", () => {
    const ast = integral(pow(variable("x"), num(2)), "x");
    const result = compile({ ast, mode: "integral" });
    expect(result.success).toBe(true);
    expect(result.steps.length).toBeGreaterThan(0);
  });

  it("compiles ∫sin(x) dx", () => {
    const ast = integral(fn("sin", variable("x")), "x");
    const result = compile({ ast, mode: "integral" });
    expect(result.success).toBe(true);
    expect(result.latexOutput).toContain("cos");
  });
});

describe("Compiler Pipeline: Limit", () => {
  it("compiles lim(x→2)[x] successfully", () => {
    const ast = limit(variable("x"), "x", num(2));
    const result = compile({ ast, mode: "limit" });
    expect(result.success).toBe(true);
  });
});

describe("Compiler Pipeline: Simplify", () => {
  it("simplifies x+0 = x", () => {
    const ast = add(variable("x"), num(0));
    const result = compile({ ast, mode: "simplify" });
    expect(result.success).toBe(true);
    expect(result.latexOutput).toBe("x");
  });
});

describe("Auto-compile", () => {
  it("auto-detects derivative node", () => {
    const ast = derivative(variable("x"), "x");
    const result = autoCompile(ast);
    expect(result.success).toBe(true);
  });
  it("auto-detects integral node", () => {
    const ast = integral(variable("x"), "x");
    const result = autoCompile(ast);
    expect(result.success).toBe(true);
  });
  it("auto-detects limit node", () => {
    const ast = limit(variable("x"), "x", num(0));
    const result = autoCompile(ast);
    expect(result.success).toBe(true);
  });
  it("defaults to simplify for plain expression", () => {
    const ast = pow(variable("x"), num(2));
    const result = autoCompile(ast);
    expect(result.success).toBe(true);
  });
});

describe("AST Validator", () => {
  it("valid Number node", () => {
    expect(validateAST(num(5)).valid).toBe(true);
  });
  it("valid Variable node", () => {
    expect(validateAST(variable("x")).valid).toBe(true);
  });
  it("valid Derivative node", () => {
    expect(validateAST(derivative(variable("x"), "x")).valid).toBe(true);
  });
  it("invalid: null node", () => {
    expect(validateAST(null as any).valid).toBe(false);
  });
  it("invalid: division by zero", () => {
    const result = validateAST({ type: "Divide", numerator: num(1), denominator: num(0) } as any);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("zero"))).toBe(true);
  });
  it("invalid: Root with index 0", () => {
    const result = validateAST({ type: "Root", radicand: variable("x"), index: num(0) } as any);
    expect(result.valid).toBe(false);
  });
  it("missing child in Add node", () => {
    const result = validateAST({ type: "Add", left: num(1) } as any);
    expect(result.valid).toBe(false);
  });
  it("Derivative needs variable", () => {
    const result = validateAST({ type: "Derivative", expression: variable("x"), variable: "", order: 1 } as any);
    expect(result.valid).toBe(false);
  });
  it("errors contain path info", () => {
    const result = validateAST({ type: "Add", left: num(1) } as any);
    expect(result.errors.some((e) => e.includes("right"))).toBe(true);
  });
});
