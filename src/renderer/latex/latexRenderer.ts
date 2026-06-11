import type { ASTNode, MathFunction } from "../../types/ast";

// ─── AST → LaTeX string ───────────────────────────────────────────────────────

export function astToLatex(node: ASTNode | null | undefined): string {
  if (!node) return "";

  switch (node.type) {
    case "Number": {
      if (!isFinite(node.value)) return node.value > 0 ? "\\infty" : "-\\infty";
      if (node.value < 0) return `(${node.value})`;
      return String(node.value);
    }

    case "Variable":
      return node.name;

    case "Constant":
      if (node.name === "pi") return "\\pi";
      return node.name;

    case "Add":
      return `${astToLatex(node.left)} + ${astToLatex(node.right)}`;

    case "Subtract": {
      const r = astToLatex(node.right);
      const rNeedsParen = needsParenRight(node.right, "Subtract");
      return `${astToLatex(node.left)} - ${rNeedsParen ? `\\left(${r}\\right)` : r}`;
    }

    case "Multiply": {
      const l = astToLatex(node.left);
      const r = astToLatex(node.right);
      const lNeedsParen = needsParenLeft(node.left, "Multiply");
      const rNeedsParen = needsParenRight(node.right, "Multiply");
      const lStr = lNeedsParen ? `\\left(${l}\\right)` : l;
      const rStr = rNeedsParen ? `\\left(${r}\\right)` : r;
      // Use \cdot only for Number × Number; juxtapose (no space) for num × var/power
      const useCdot = node.left.type === "Number" && node.right.type === "Number";
      const noSpace = !lNeedsParen && !rNeedsParen &&
        node.left.type === "Number" &&
        (node.right.type === "Variable" || node.right.type === "Power" || node.right.type === "FunctionCall");
      if (useCdot) return `${lStr} \\cdot ${rStr}`;
      if (noSpace) return `${lStr}${rStr}`;
      return `${lStr} ${rStr}`;
    }

    case "Divide":
      return `\\frac{${astToLatex(node.numerator)}}{${astToLatex(node.denominator)}}`;

    case "Power": {
      const base = astToLatex(node.base);
      const exp_ = astToLatex(node.exponent);
      const baseNeedsParen = needsPowerBase(node.base);
      const baseStr = baseNeedsParen ? `\\left(${base}\\right)` : base;
      return `{${baseStr}}^{${exp_}}`;
    }

    case "Root": {
      const radicand = astToLatex(node.radicand);
      if (node.index.type === "Number" && node.index.value === 2) {
        return `\\sqrt{${radicand}}`;
      }
      return `\\sqrt[${astToLatex(node.index)}]{${radicand}}`;
    }

    case "Negate": {
      const a = astToLatex(node.argument);
      const needsParen = ["Add", "Subtract"].includes(node.argument.type);
      return needsParen ? `-\\left(${a}\\right)` : `-${a}`;
    }

    case "FunctionCall":
      return functionToLatex(node.name, node.argument, node.base);

    case "Integral": {
      const integrand = astToLatex(node.integrand);
      const dvar = `\\, d${node.variable}`;
      if (node.lower && node.upper) {
        return `\\int_{${astToLatex(node.lower)}}^{${astToLatex(node.upper)}} ${integrand} ${dvar}`;
      }
      return `\\int ${integrand} ${dvar}`;
    }

    case "Derivative": {
      const order = node.order === 1 ? "" : `^{${node.order}}`;
      const expr = astToLatex(node.expression);
      return `\\frac{d${order}}{d${node.variable}${order}} \\left[ ${expr} \\right]`;
    }

    case "Limit": {
      const dir = node.direction === "left" ? "^-" : node.direction === "right" ? "^+" : "";
      return `\\lim_{${node.variable} \\to ${astToLatex(node.approach)}${dir}} ${astToLatex(node.expression)}`;
    }

    case "Summation":
      return `\\sum_{${node.variable}=${astToLatex(node.lower)}}^{${astToLatex(node.upper)}} ${astToLatex(node.expression)}`;

    case "Product":
      return `\\prod_{${node.variable}=${astToLatex(node.lower)}}^{${astToLatex(node.upper)}} ${astToLatex(node.expression)}`;

    case "Equation":
      return `${astToLatex(node.left)} ${node.relation} ${astToLatex(node.right)}`;

    case "Abs":
      return `\\left| ${astToLatex(node.argument)} \\right|`;

    default:
      return "?";
  }
}

// ─── Function → LaTeX ─────────────────────────────────────────────────────────

function functionToLatex(name: MathFunction, arg: ASTNode, _base?: ASTNode): string {
  const a = astToLatex(arg);
  switch (name) {
    case "sin": return `\\sin\\left(${a}\\right)`;
    case "cos": return `\\cos\\left(${a}\\right)`;
    case "tan": return `\\tan\\left(${a}\\right)`;
    case "csc": return `\\csc\\left(${a}\\right)`;
    case "sec": return `\\sec\\left(${a}\\right)`;
    case "cot": return `\\cot\\left(${a}\\right)`;
    case "arcsin": return `\\arcsin\\left(${a}\\right)`;
    case "arccos": return `\\arccos\\left(${a}\\right)`;
    case "arctan": return `\\arctan\\left(${a}\\right)`;
    case "arccsc": return `\\text{arccsc}\\left(${a}\\right)`;
    case "arcsec": return `\\text{arcsec}\\left(${a}\\right)`;
    case "arccot": return `\\text{arccot}\\left(${a}\\right)`;
    case "sinh": return `\\sinh\\left(${a}\\right)`;
    case "cosh": return `\\cosh\\left(${a}\\right)`;
    case "tanh": return `\\tanh\\left(${a}\\right)`;
    case "ln": return `\\ln\\left(${a}\\right)`;
    case "log":
    case "log10": return `\\log\\left(${a}\\right)`;
    case "log2": return `\\log_{2}\\left(${a}\\right)`;
    case "exp": return `e^{${a}}`;
    case "sqrt": return `\\sqrt{${a}}`;
    case "abs": return `\\left|${a}\\right|`;
    case "floor": return `\\lfloor ${a} \\rfloor`;
    case "ceil": return `\\lceil ${a} \\rceil`;
    default: return `\\text{${name}}\\left(${a}\\right)`;
  }
}

// ─── Precedence helpers ───────────────────────────────────────────────────────

function needsParenLeft(node: ASTNode, parentType: string): boolean {
  if (parentType === "Multiply") return node.type === "Add" || node.type === "Subtract";
  return false;
}

function needsParenRight(node: ASTNode, parentType: string): boolean {
  if (parentType === "Subtract") return node.type === "Add" || node.type === "Subtract";
  if (parentType === "Multiply") return node.type === "Add" || node.type === "Subtract";
  return false;
}

function needsPowerBase(node: ASTNode): boolean {
  return ["Add", "Subtract", "Multiply", "Divide", "Negate"].includes(node.type);
}
