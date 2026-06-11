import type { ASTNode } from "../../types/ast";
import type { CompilationResult } from "../../types/pipeline";
import { autoCompile } from "../../compiler/transformer/pipeline";
import { num, pow, fn, add, mul, div, sub } from "../../types/ast";

// ─── Built-in test suite (mimics calculus-dataset problems) ──────────────────

export interface DatasetCase {
  id: string;
  description: string;
  inputAST: ASTNode;
  expectedLatex: string;
  category: "derivative" | "integral" | "limit" | "simplify";
  tags: string[];
}

export interface EvalResult {
  caseId: string;
  description: string;
  passed: boolean;
  actualLatex: string;
  expectedLatex: string;
  steps: number;
  rulesApplied: string[];
  error?: string;
}

export interface BenchmarkReport {
  total: number;
  passed: number;
  failed: number;
  accuracy: number;
  ruleCoverage: string[];
  failedCases: EvalResult[];
  categoryBreakdown: Record<string, { passed: number; total: number }>;
  timestamp: string;
}

// ─── Dataset cases ────────────────────────────────────────────────────────────

export const DATASET_CASES: DatasetCase[] = [
  // Derivatives
  {
    id: "d001",
    description: "d/dx[x²]",
    inputAST: { type: "Derivative", expression: pow({ type: "Variable", name: "x" }, num(2)), variable: "x", order: 1 },
    expectedLatex: "2x",
    category: "derivative",
    tags: ["power-rule"],
  },
  {
    id: "d002",
    description: "d/dx[x³]",
    inputAST: { type: "Derivative", expression: pow({ type: "Variable", name: "x" }, num(3)), variable: "x", order: 1 },
    expectedLatex: "3{x}^{2}",
    category: "derivative",
    tags: ["power-rule"],
  },
  {
    id: "d003",
    description: "d/dx[5]",
    inputAST: { type: "Derivative", expression: num(5), variable: "x", order: 1 },
    expectedLatex: "0",
    category: "derivative",
    tags: ["constant-rule"],
  },
  {
    id: "d004",
    description: "d/dx[x]",
    inputAST: { type: "Derivative", expression: { type: "Variable", name: "x" }, variable: "x", order: 1 },
    expectedLatex: "1",
    category: "derivative",
    tags: ["variable-rule"],
  },
  {
    id: "d005",
    description: "d/dx[sin(x)]",
    inputAST: { type: "Derivative", expression: fn("sin", { type: "Variable", name: "x" }), variable: "x", order: 1 },
    expectedLatex: "\\cos\\left(x\\right)",
    category: "derivative",
    tags: ["sin-derivative", "trig"],
  },
  {
    id: "d006",
    description: "d/dx[cos(x)]",
    inputAST: { type: "Derivative", expression: fn("cos", { type: "Variable", name: "x" }), variable: "x", order: 1 },
    expectedLatex: "-\\sin\\left(x\\right)",
    category: "derivative",
    tags: ["cos-derivative", "trig"],
  },
  {
    id: "d007",
    description: "d/dx[e^x]",
    inputAST: { type: "Derivative", expression: fn("exp", { type: "Variable", name: "x" }), variable: "x", order: 1 },
    expectedLatex: "e^{x}",
    category: "derivative",
    tags: ["exponential"],
  },
  {
    id: "d008",
    description: "d/dx[ln(x)]",
    inputAST: { type: "Derivative", expression: fn("ln", { type: "Variable", name: "x" }), variable: "x", order: 1 },
    expectedLatex: "\\frac{1}{x}",
    category: "derivative",
    tags: ["logarithm"],
  },
  {
    id: "d009",
    description: "d/dx[x² + x]",
    inputAST: {
      type: "Derivative",
      expression: add(pow({ type: "Variable", name: "x" }, num(2)), { type: "Variable", name: "x" }),
      variable: "x", order: 1,
    },
    expectedLatex: "2x + 1",
    category: "derivative",
    tags: ["sum-rule", "power-rule"],
  },
  {
    id: "d010",
    description: "d/dx[3x²]",
    inputAST: {
      type: "Derivative",
      expression: mul(num(3), pow({ type: "Variable", name: "x" }, num(2))),
      variable: "x", order: 1,
    },
    expectedLatex: "6x",
    category: "derivative",
    tags: ["constant-multiple"],
  },
  // Integrals
  {
    id: "i001",
    description: "∫x dx",
    inputAST: { type: "Integral", integrand: { type: "Variable", name: "x" }, variable: "x" },
    expectedLatex: "\\frac{{x}^{2}}{2}",
    category: "integral",
    tags: ["power-rule"],
  },
  {
    id: "i002",
    description: "∫x² dx",
    inputAST: { type: "Integral", integrand: pow({ type: "Variable", name: "x" }, num(2)), variable: "x" },
    expectedLatex: "\\frac{{x}^{3}}{3}",
    category: "integral",
    tags: ["power-rule"],
  },
  {
    id: "i003",
    description: "∫5 dx",
    inputAST: { type: "Integral", integrand: num(5), variable: "x" },
    expectedLatex: "5 \\cdot x",
    category: "integral",
    tags: ["constant-rule"],
  },
  {
    id: "i004",
    description: "∫sin(x) dx",
    inputAST: { type: "Integral", integrand: fn("sin", { type: "Variable", name: "x" }), variable: "x" },
    expectedLatex: "-\\cos\\left(x\\right)",
    category: "integral",
    tags: ["sin-integral", "trig"],
  },
  {
    id: "i005",
    description: "∫cos(x) dx",
    inputAST: { type: "Integral", integrand: fn("cos", { type: "Variable", name: "x" }), variable: "x" },
    expectedLatex: "\\sin\\left(x\\right)",
    category: "integral",
    tags: ["cos-integral", "trig"],
  },
  // Limits
  {
    id: "l001",
    description: "lim(x→2) x",
    inputAST: {
      type: "Limit",
      expression: { type: "Variable", name: "x" },
      variable: "x",
      approach: num(2),
    },
    expectedLatex: "2",
    category: "limit",
    tags: ["direct-substitution"],
  },
  {
    id: "l002",
    description: "lim(x→0) x²",
    inputAST: {
      type: "Limit",
      expression: pow({ type: "Variable", name: "x" }, num(2)),
      variable: "x",
      approach: num(0),
    },
    expectedLatex: "0",
    category: "limit",
    tags: ["direct-substitution"],
  },
  {
    id: "l003",
    description: "lim(x→1) (x²-1)/(x-1)",
    inputAST: {
      type: "Limit",
      expression: div(
        sub(pow({ type: "Variable", name: "x" }, num(2)), num(1)),
        sub({ type: "Variable", name: "x" }, num(1))
      ),
      variable: "x",
      approach: num(1),
    },
    expectedLatex: "2",
    category: "limit",
    tags: ["factorization", "0/0"],
  },
];

// ─── Evaluator ────────────────────────────────────────────────────────────────

export class DatasetEvaluator {
  evaluate(cases: DatasetCase[] = DATASET_CASES): EvalResult[] {
    return cases.map((c) => this.evaluateOne(c));
  }

  evaluateOne(c: DatasetCase): EvalResult {
    try {
      const result: CompilationResult = autoCompile(c.inputAST);
      const actualLatex = result.latexOutput;
      const passed = this.latexMatch(actualLatex, c.expectedLatex);

      return {
        caseId: c.id,
        description: c.description,
        passed,
        actualLatex,
        expectedLatex: c.expectedLatex,
        steps: result.steps.length,
        rulesApplied: result.steps.map((s) => s.ruleApplied),
        error: result.success ? undefined : result.error,
      };
    } catch (err) {
      return {
        caseId: c.id,
        description: c.description,
        passed: false,
        actualLatex: "",
        expectedLatex: c.expectedLatex,
        steps: 0,
        rulesApplied: [],
        error: String(err),
      };
    }
  }

  generateReport(results: EvalResult[]): BenchmarkReport {
    const total = results.length;
    const passed = results.filter((r) => r.passed).length;
    const failed = total - passed;
    const accuracy = total > 0 ? passed / total : 0;

    const ruleCoverage = [...new Set(results.flatMap((r) => r.rulesApplied))];

    const failedCases = results.filter((r) => !r.passed);

    const categoryBreakdown: Record<string, { passed: number; total: number }> = {};
    DATASET_CASES.forEach((c) => {
      if (!categoryBreakdown[c.category]) {
        categoryBreakdown[c.category] = { passed: 0, total: 0 };
      }
      categoryBreakdown[c.category].total++;
    });
    results.forEach((r) => {
      const c = DATASET_CASES.find((d) => d.id === r.caseId);
      if (c && r.passed) categoryBreakdown[c.category].passed++;
    });

    return {
      total,
      passed,
      failed,
      accuracy,
      ruleCoverage,
      failedCases,
      categoryBreakdown,
      timestamp: new Date().toISOString(),
    };
  }

  // Flexible LaTeX comparison (normalized whitespace)
  private latexMatch(a: string, b: string): boolean {
    const norm = (s: string) => s.replace(/\s+/g, " ").trim();
    return norm(a) === norm(b);
  }
}

export class RuleCoverageAnalyzer {
  analyze(results: EvalResult[]) {
    const ruleUsage: Record<string, number> = {};
    results.forEach((r) => {
      r.rulesApplied.forEach((rule) => {
        ruleUsage[rule] = (ruleUsage[rule] ?? 0) + 1;
      });
    });
    return {
      totalRules: Object.keys(ruleUsage).length,
      ruleUsage,
      sortedByUsage: Object.entries(ruleUsage).sort((a, b) => b[1] - a[1]),
    };
  }
}
