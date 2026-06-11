// ─── AST Node Types ───────────────────────────────────────────────────────────

export type ASTNodeType =
  | "Number"
  | "Variable"
  | "Constant"
  | "Add"
  | "Subtract"
  | "Multiply"
  | "Divide"
  | "Power"
  | "Root"
  | "Negate"
  | "FunctionCall"
  | "Integral"
  | "Derivative"
  | "Limit"
  | "Summation"
  | "Product"
  | "Equation"
  | "Abs";

export interface NumberNode {
  type: "Number";
  value: number;
}

export interface VariableNode {
  type: "Variable";
  name: string;
}

export interface ConstantNode {
  type: "Constant";
  name: "e" | "pi" | "i";
}

export interface AddNode {
  type: "Add";
  left: ASTNode;
  right: ASTNode;
}

export interface SubtractNode {
  type: "Subtract";
  left: ASTNode;
  right: ASTNode;
}

export interface MultiplyNode {
  type: "Multiply";
  left: ASTNode;
  right: ASTNode;
}

export interface DivideNode {
  type: "Divide";
  numerator: ASTNode;
  denominator: ASTNode;
}

export interface PowerNode {
  type: "Power";
  base: ASTNode;
  exponent: ASTNode;
}

export interface RootNode {
  type: "Root";
  radicand: ASTNode;
  index: ASTNode; // 2 = square root, 3 = cube root, etc.
}

export interface NegateNode {
  type: "Negate";
  argument: ASTNode;
}

export type TrigFunction =
  | "sin" | "cos" | "tan" | "csc" | "sec" | "cot"
  | "arcsin" | "arccos" | "arctan" | "arccsc" | "arcsec" | "arccot"
  | "sinh" | "cosh" | "tanh";

export type MathFunction =
  | TrigFunction
  | "ln" | "log" | "exp" | "sqrt" | "abs" | "floor" | "ceil"
  | "log2" | "log10";

export interface FunctionCallNode {
  type: "FunctionCall";
  name: MathFunction;
  argument: ASTNode;
  base?: ASTNode; // for log base
}

export interface IntegralNode {
  type: "Integral";
  integrand: ASTNode;
  variable: string;
  lower?: ASTNode; // definite integral bounds
  upper?: ASTNode;
}

export interface DerivativeNode {
  type: "Derivative";
  expression: ASTNode;
  variable: string;
  order: number; // 1 = first derivative, 2 = second, etc.
}

export interface LimitNode {
  type: "Limit";
  expression: ASTNode;
  variable: string;
  approach: ASTNode;
  direction?: "left" | "right" | "both";
}

export interface SummationNode {
  type: "Summation";
  expression: ASTNode;
  variable: string;
  lower: ASTNode;
  upper: ASTNode;
}

export interface ProductNode {
  type: "Product";
  expression: ASTNode;
  variable: string;
  lower: ASTNode;
  upper: ASTNode;
}

export interface EquationNode {
  type: "Equation";
  left: ASTNode;
  right: ASTNode;
  relation: "=" | "<" | ">" | "<=" | ">=" | "!=";
}

export interface AbsNode {
  type: "Abs";
  argument: ASTNode;
}

export type ASTNode =
  | NumberNode
  | VariableNode
  | ConstantNode
  | AddNode
  | SubtractNode
  | MultiplyNode
  | DivideNode
  | PowerNode
  | RootNode
  | NegateNode
  | FunctionCallNode
  | IntegralNode
  | DerivativeNode
  | LimitNode
  | SummationNode
  | ProductNode
  | EquationNode
  | AbsNode;

// ─── AST Builder helpers ──────────────────────────────────────────────────────

export const num = (value: number): NumberNode => ({ type: "Number", value });
export const variable = (name: string): VariableNode => ({ type: "Variable", name });
export const constant = (name: "e" | "pi" | "i"): ConstantNode => ({ type: "Constant", name });
export const add = (left: ASTNode, right: ASTNode): AddNode => ({ type: "Add", left, right });
export const sub = (left: ASTNode, right: ASTNode): SubtractNode => ({ type: "Subtract", left, right });
export const mul = (left: ASTNode, right: ASTNode): MultiplyNode => ({ type: "Multiply", left, right });
export const div = (numerator: ASTNode, denominator: ASTNode): DivideNode => ({ type: "Divide", numerator, denominator });
export const pow = (base: ASTNode, exponent: ASTNode): PowerNode => ({ type: "Power", base, exponent });
export const root = (radicand: ASTNode, index: ASTNode = num(2)): RootNode => ({ type: "Root", radicand, index });
export const negate = (argument: ASTNode): NegateNode => ({ type: "Negate", argument });
export const fn = (name: MathFunction, argument: ASTNode, base?: ASTNode): FunctionCallNode => ({
  type: "FunctionCall", name, argument, ...(base ? { base } : {}),
});
export const integral = (integrand: ASTNode, variable: string, lower?: ASTNode, upper?: ASTNode): IntegralNode => ({
  type: "Integral", integrand, variable, lower, upper,
});
export const derivative = (expression: ASTNode, variable: string, order = 1): DerivativeNode => ({
  type: "Derivative", expression, variable, order,
});
export const limit = (expression: ASTNode, variable: string, approach: ASTNode, direction?: "left" | "right" | "both"): LimitNode => ({
  type: "Limit", expression, variable, approach, direction,
});
export const summation = (expression: ASTNode, variable: string, lower: ASTNode, upper: ASTNode): SummationNode => ({
  type: "Summation", expression, variable, lower, upper,
});

// ─── Type guards ──────────────────────────────────────────────────────────────

export const isNumber = (n: ASTNode): n is NumberNode => n.type === "Number";
export const isVariable = (n: ASTNode): n is VariableNode => n.type === "Variable";
export const isConstant = (n: ASTNode): n is ConstantNode => n.type === "Constant";
export const isZero = (n: ASTNode): boolean => n.type === "Number" && n.value === 0;
export const isOne = (n: ASTNode): boolean => n.type === "Number" && n.value === 1;
export const isNegOne = (n: ASTNode): boolean => n.type === "Number" && n.value === -1;
export const isAdd = (n: ASTNode): n is AddNode => n.type === "Add";
export const isMul = (n: ASTNode): n is MultiplyNode => n.type === "Multiply";
export const isDiv = (n: ASTNode): n is DivideNode => n.type === "Divide";
export const isPow = (n: ASTNode): n is PowerNode => n.type === "Power";
export const isFn = (n: ASTNode): n is FunctionCallNode => n.type === "FunctionCall";
