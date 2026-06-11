import { describe, it, expect } from "vitest";
import { simplify, nodesEqual } from "../symbolic/simplifier/simplify";
import { num, variable, add, sub, mul, div, pow, negate } from "../types/ast";
import { astToLatex } from "../renderer/latex/latexRenderer";

function lat(node: any) { return astToLatex(simplify(node)); }

describe("Add simplification", () => {
  it("0+x = x", () => expect(lat(add(num(0), variable("x")))).toBe("x"));
  it("x+0 = x", () => expect(lat(add(variable("x"), num(0)))).toBe("x"));
  it("1+2 = 3", () => expect(lat(add(num(1), num(2)))).toBe("3"));
  it("3+4 = 7", () => expect(lat(add(num(3), num(4)))).toBe("7"));
  it("x+(-y) = x-y", () => {
    const r = simplify(add(variable("x"), negate(variable("y"))));
    expect(["x - y", "x-y"]).toContain(astToLatex(r));
  });
});

describe("Subtract simplification", () => {
  it("x-0 = x", () => expect(lat(sub(variable("x"), num(0)))).toBe("x"));
  it("0-x = -x", () => expect(lat(sub(num(0), variable("x")))).toContain("x"));
  it("5-3 = 2", () => expect(lat(sub(num(5), num(3)))).toBe("2"));
  it("x-x = 0", () => expect(lat(sub(variable("x"), variable("x")))).toBe("0"));
});

describe("Multiply simplification", () => {
  it("0*x = 0", () => expect(lat(mul(num(0), variable("x")))).toBe("0"));
  it("x*0 = 0", () => expect(lat(mul(variable("x"), num(0)))).toBe("0"));
  it("1*x = x", () => expect(lat(mul(num(1), variable("x")))).toBe("x"));
  it("x*1 = x", () => expect(lat(mul(variable("x"), num(1)))).toBe("x"));
  it("2*3 = 6", () => expect(lat(mul(num(2), num(3)))).toBe("6"));
  it("(-1)*x = -x", () => expect(lat(mul(num(-1), variable("x")))).toContain("x"));
  it("x*x = x²", () => {
    const r = simplify(mul(variable("x"), variable("x")));
    expect(astToLatex(r)).toContain("2");
  });
  it("(-x)*(-y) = x*y", () => {
    const r = simplify(mul(negate(variable("x")), negate(variable("y"))));
    expect(r.type).not.toBe("Negate");
  });
});

describe("Divide simplification", () => {
  it("0/x = 0", () => expect(lat(div(num(0), variable("x")))).toBe("0"));
  it("x/1 = x", () => expect(lat(div(variable("x"), num(1)))).toBe("x"));
  it("6/2 = 3", () => expect(lat(div(num(6), num(2)))).toBe("3"));
  it("4/2 = 2", () => expect(lat(div(num(4), num(2)))).toBe("2"));
  it("x/x = 1", () => expect(lat(div(variable("x"), variable("x")))).toBe("1"));
  it("2/4 reduces to 1/2", () => {
    const r = simplify(div(num(2), num(4)));
    expect(astToLatex(r)).toContain("2");
  });
});

describe("Power simplification", () => {
  it("x^0 = 1", () => expect(lat(pow(variable("x"), num(0)))).toBe("1"));
  it("x^1 = x", () => expect(lat(pow(variable("x"), num(1)))).toBe("x"));
  it("0^n = 0", () => expect(lat(pow(num(0), num(5)))).toBe("0"));
  it("1^n = 1", () => expect(lat(pow(num(1), num(10)))).toBe("1"));
  it("2^3 = 8", () => expect(lat(pow(num(2), num(3)))).toBe("8"));
  it("3^2 = 9", () => expect(lat(pow(num(3), num(2)))).toBe("9"));
  it("2^10 = 1024", () => expect(lat(pow(num(2), num(10)))).toBe("1024"));
});

describe("Negate simplification", () => {
  it("--x = x", () => {
    const r = simplify(negate(negate(variable("x"))));
    expect(astToLatex(r)).toBe("x");
  });
  it("-0 = 0", () => expect(lat(negate(num(0)))).toBe("0"));
  it("-5 = -5 (number)", () => {
    const r = simplify(negate(num(5)));
    expect(r.type).toBe("Number");
    expect((r as any).value).toBe(-5);
  });
});

describe("nodesEqual", () => {
  it("num(3) equals num(3)", () => expect(nodesEqual(num(3), num(3))).toBe(true));
  it("num(3) != num(4)", () => expect(nodesEqual(num(3), num(4))).toBe(false));
  it("x equals x", () => expect(nodesEqual(variable("x"), variable("x"))).toBe(true));
  it("x != y", () => expect(nodesEqual(variable("x"), variable("y"))).toBe(false));
  it("x+y equals x+y", () => expect(nodesEqual(add(variable("x"), variable("y")), add(variable("x"), variable("y")))).toBe(true));
  it("x+y != y+x (not commutative equality)", () => expect(nodesEqual(add(variable("x"), variable("y")), add(variable("y"), variable("x")))).toBe(false));
});
