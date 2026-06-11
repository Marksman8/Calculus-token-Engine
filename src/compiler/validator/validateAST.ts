import type { ASTNode } from "../../types/ast";
import type { ValidationResult } from "../../types/pipeline";

export function validateAST(node: ASTNode | null | undefined): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!node) {
    errors.push("AST is null or undefined");
    return { valid: false, errors, warnings };
  }

  validateNode(node, errors, warnings, "root");
  return { valid: errors.length === 0, errors, warnings };
}

function validateNode(node: ASTNode, errors: string[], warnings: string[], path: string): void {
  switch (node.type) {
    case "Number":
      if (typeof node.value !== "number") errors.push(`${path}: Number.value must be numeric`);
      break;

    case "Variable":
      if (!node.name || typeof node.name !== "string") errors.push(`${path}: Variable.name must be a string`);
      break;

    case "Constant":
      if (!["e", "pi", "i"].includes(node.name)) errors.push(`${path}: Unknown constant '${node.name}'`);
      break;

    case "Add":
    case "Subtract":
    case "Multiply":
      requireChild(node.left, `${path}.left`, errors);
      requireChild(node.right, `${path}.right`, errors);
      if (node.left) validateNode(node.left, errors, warnings, `${path}.left`);
      if (node.right) validateNode(node.right, errors, warnings, `${path}.right`);
      break;

    case "Divide":
      requireChild(node.numerator, `${path}.numerator`, errors);
      requireChild(node.denominator, `${path}.denominator`, errors);
      if (node.numerator) validateNode(node.numerator, errors, warnings, `${path}.numerator`);
      if (node.denominator) {
        validateNode(node.denominator, errors, warnings, `${path}.denominator`);
        if (node.denominator.type === "Number" && node.denominator.value === 0) {
          errors.push(`${path}: Division by zero`);
        }
      }
      break;

    case "Power":
      requireChild(node.base, `${path}.base`, errors);
      requireChild(node.exponent, `${path}.exponent`, errors);
      if (node.base) validateNode(node.base, errors, warnings, `${path}.base`);
      if (node.exponent) validateNode(node.exponent, errors, warnings, `${path}.exponent`);
      break;

    case "Root":
      requireChild(node.radicand, `${path}.radicand`, errors);
      requireChild(node.index, `${path}.index`, errors);
      if (node.radicand) validateNode(node.radicand, errors, warnings, `${path}.radicand`);
      if (node.index) {
        validateNode(node.index, errors, warnings, `${path}.index`);
        if (node.index.type === "Number" && node.index.value === 0) {
          errors.push(`${path}: Root index cannot be 0`);
        }
      }
      break;

    case "Negate":
    case "Abs":
      requireChild(node.argument, `${path}.argument`, errors);
      if (node.argument) validateNode(node.argument, errors, warnings, `${path}.argument`);
      break;

    case "FunctionCall":
      if (!node.name) errors.push(`${path}: FunctionCall.name is required`);
      requireChild(node.argument, `${path}.argument`, errors);
      if (node.argument) validateNode(node.argument, errors, warnings, `${path}.argument`);
      break;

    case "Derivative":
      requireChild(node.expression, `${path}.expression`, errors);
      if (!node.variable) errors.push(`${path}: Derivative.variable is required`);
      if (node.order <= 0) errors.push(`${path}: Derivative.order must be positive`);
      if (node.expression) validateNode(node.expression, errors, warnings, `${path}.expression`);
      break;

    case "Integral":
      requireChild(node.integrand, `${path}.integrand`, errors);
      if (!node.variable) errors.push(`${path}: Integral.variable is required`);
      if (node.integrand) validateNode(node.integrand, errors, warnings, `${path}.integrand`);
      if ((node.lower && !node.upper) || (!node.lower && node.upper)) {
        errors.push(`${path}: Definite integral requires both lower and upper bounds`);
      }
      break;

    case "Limit":
      requireChild(node.expression, `${path}.expression`, errors);
      requireChild(node.approach, `${path}.approach`, errors);
      if (!node.variable) errors.push(`${path}: Limit.variable is required`);
      if (node.expression) validateNode(node.expression, errors, warnings, `${path}.expression`);
      if (node.approach) validateNode(node.approach, errors, warnings, `${path}.approach`);
      break;

    case "Summation":
    case "Product":
      requireChild(node.expression, `${path}.expression`, errors);
      requireChild(node.lower, `${path}.lower`, errors);
      requireChild(node.upper, `${path}.upper`, errors);
      if (!node.variable) errors.push(`${path}: ${node.type}.variable is required`);
      if (node.expression) validateNode(node.expression, errors, warnings, `${path}.expression`);
      break;

    case "Equation":
      requireChild(node.left, `${path}.left`, errors);
      requireChild(node.right, `${path}.right`, errors);
      if (node.left) validateNode(node.left, errors, warnings, `${path}.left`);
      if (node.right) validateNode(node.right, errors, warnings, `${path}.right`);
      break;

    default:
      warnings.push(`${path}: Unknown node type '${(node as any).type}'`);
  }
}

function requireChild(child: unknown, path: string, errors: string[]): void {
  if (!child) errors.push(`${path}: required child node is missing`);
}
