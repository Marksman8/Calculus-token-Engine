import type { ASTNode } from "./ast";

export interface SolutionStep {
  id: string;
  stepNumber: number;
  ruleApplied: string;
  ruleDescription: string;
  beforeAST: ASTNode;
  afterAST: ASTNode;
  latexBefore: string;
  latexAfter: string;
}

export interface CompilationResult {
  inputAST: ASTNode;
  outputAST: ASTNode;
  steps: SolutionStep[];
  latexInput: string;
  latexOutput: string;
  success: boolean;
  error?: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export type OperationMode = "derivative" | "integral" | "limit" | "simplify" | "evaluate";

export interface CompilerInput {
  ast: ASTNode;
  mode: OperationMode;
}
