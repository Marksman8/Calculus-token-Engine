import type { ASTNode, DerivativeNode, IntegralNode, LimitNode } from "../../types/ast";
import type { CompilationResult, CompilerInput, SolutionStep } from "../../types/pipeline";
import { validateAST } from "../validator/validateAST";
import { differentiate, resetSteps, getSteps } from "../../symbolic/derivative/differentiate";
import { integrate, resetIntegralSteps, getIntegralSteps } from "../../symbolic/integral/integrate";
import { evaluateLimit, resetLimitSteps, getLimitSteps } from "../../symbolic/limits/evaluateLimit";
import { simplify } from "../../symbolic/simplifier/simplify";
import { astToLatex } from "../../renderer/latex/latexRenderer";

// ─── Compiler Pipeline ────────────────────────────────────────────────────────

export function compile(input: CompilerInput): CompilationResult {
  const { ast, mode } = input;

  // Stage 1: Validate
  const validation = validateAST(ast);
  if (!validation.valid) {
    return {
      inputAST: ast,
      outputAST: ast,
      steps: [],
      latexInput: astToLatex(ast),
      latexOutput: "",
      success: false,
      error: validation.errors.join("; "),
    };
  }

  // Stage 2: Route to symbolic engine
  let outputAST: ASTNode;
  let steps: SolutionStep[];

  try {
    switch (mode) {
      case "derivative": {
        if (ast.type !== "Derivative") {
          throw new Error("Expected a Derivative node for mode=derivative");
        }
        const dNode = ast as DerivativeNode;
        resetSteps();
        outputAST = differentiate(dNode.expression, dNode.variable);
        steps = getSteps();
        break;
      }

      case "integral": {
        if (ast.type !== "Integral") {
          throw new Error("Expected an Integral node for mode=integral");
        }
        const iNode = ast as IntegralNode;
        resetIntegralSteps();
        outputAST = integrate(iNode.integrand, iNode.variable);
        steps = getIntegralSteps();
        break;
      }

      case "limit": {
        if (ast.type !== "Limit") {
          throw new Error("Expected a Limit node for mode=limit");
        }
        resetLimitSteps();
        outputAST = evaluateLimit(ast as LimitNode);
        steps = getLimitSteps();
        break;
      }

      case "simplify": {
        resetSteps();
        outputAST = simplify(ast);
        steps = [{
          id: "simplify-1",
          stepNumber: 1,
          ruleApplied: "Simplification",
          ruleDescription: "Apply algebraic simplification rules",
          beforeAST: ast,
          afterAST: outputAST,
          latexBefore: astToLatex(ast),
          latexAfter: astToLatex(outputAST),
        }];
        break;
      }

      default:
        throw new Error(`Unknown mode: ${mode}`);
    }
  } catch (err) {
    return {
      inputAST: ast,
      outputAST: ast,
      steps: [],
      latexInput: astToLatex(ast),
      latexOutput: "",
      success: false,
      error: String(err),
    };
  }

  return {
    inputAST: ast,
    outputAST,
    steps,
    latexInput: astToLatex(ast),
    latexOutput: astToLatex(outputAST),
    success: true,
  };
}

// ─── Auto-detect mode from AST ───────────────────────────────────────────────

export function autoCompile(ast: ASTNode): CompilationResult {
  let mode: CompilerInput["mode"];
  switch (ast.type) {
    case "Derivative": mode = "derivative"; break;
    case "Integral": mode = "integral"; break;
    case "Limit": mode = "limit"; break;
    default: mode = "simplify";
  }
  return compile({ ast, mode });
}
