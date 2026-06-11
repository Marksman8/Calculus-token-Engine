import React, { useState } from "react";
import type { ASTNode } from "../../types/ast";
import "./ASTPanel.css";

interface Props {
  ast: ASTNode | null;
}

// ─── Recursive tree node ──────────────────────────────────────────────────────

const TreeNode: React.FC<{ node: ASTNode; depth: number }> = ({ node, depth }) => {
  const [collapsed, setCollapsed] = useState(false);
  const children = getChildren(node);
  const hasChildren = children.length > 0;
  const label = getNodeLabel(node);
  const color = getNodeColor(node.type);

  return (
    <div className="tree-node" style={{ marginLeft: depth * 18 }}>
      <div
        className={`tree-label ${hasChildren ? "has-children" : ""}`}
        style={{ color }}
        onClick={() => hasChildren && setCollapsed(!collapsed)}
      >
        {hasChildren && (
          <span className="tree-toggle">{collapsed ? "▶" : "▼"}</span>
        )}
        <span className="node-type">{node.type}</span>
        {label && <span className="node-value">{label}</span>}
      </div>
      {!collapsed && children.map(({ key, child }, i) => (
        <div key={i} className="tree-child">
          <span className="child-key">{key}:</span>
          <TreeNode node={child} depth={depth + 1} />
        </div>
      ))}
    </div>
  );
};

// ─── JSON view ────────────────────────────────────────────────────────────────

const JsonView: React.FC<{ ast: ASTNode }> = ({ ast }) => (
  <pre className="json-view">
    {JSON.stringify(ast, null, 2)}
  </pre>
);

// ─── Graph view (simple SVG node graph) ──────────────────────────────────────

interface NodePos { id: string; x: number; y: number; label: string; type: string }
interface Edge { from: string; to: string }

function layoutGraph(node: ASTNode, x = 400, y = 30, id = "root"):
  { nodes: NodePos[]; edges: Edge[] } {
  const nodes: NodePos[] = [];
  const edges: Edge[] = [];

  function traverse(n: ASTNode, px: number, py: number, nodeId: string, _sibIdx: number, _sibCount: number) {
    nodes.push({
      id: nodeId,
      x: px,
      y: py,
      label: getNodeLabel(n) || "",
      type: n.type,
    });

    const children = getChildren(n);
    const spacing = Math.max(80, 400 / Math.max(children.length, 1));
    const startX = px - (children.length - 1) * spacing / 2;

    children.forEach(({ child }, i) => {
      const childId = `${nodeId}-${i}`;
      edges.push({ from: nodeId, to: childId });
      traverse(child, startX + i * spacing, py + 70, childId, i, children.length);
    });
  }

  traverse(node, x, y, id, 0, 1);
  return { nodes, edges };
}

const GraphView: React.FC<{ ast: ASTNode }> = ({ ast }) => {
  const { nodes, edges } = layoutGraph(ast, 400, 40);
  const height = Math.max(...nodes.map((n) => n.y)) + 60;

  return (
    <svg className="graph-svg" viewBox={`0 0 800 ${height}`}>
      {edges.map((e, i) => {
        const from = nodes.find((n) => n.id === e.from)!;
        const to = nodes.find((n) => n.id === e.to)!;
        return (
          <line
            key={i}
            x1={from.x} y1={from.y + 18}
            x2={to.x} y2={to.y - 18}
            stroke="#2d4085" strokeWidth="1.5"
          />
        );
      })}
      {nodes.map((node) => (
        <g key={node.id} transform={`translate(${node.x},${node.y})`}>
          <rect x="-38" y="-16" width="76" height="32" rx="6"
            fill={getNodeBg(node.type)} stroke={getNodeColor(node.type)} strokeWidth="1" />
          <text textAnchor="middle" y="2" fontSize="10" fill={getNodeColor(node.type)}>
            {node.type.length > 10 ? node.type.slice(0, 9) + "…" : node.type}
          </text>
          {node.label && (
            <text textAnchor="middle" y="14" fontSize="9" fill="#8892b0">{node.label}</text>
          )}
        </g>
      ))}
    </svg>
  );
};

// ─── Main ASTPanel ────────────────────────────────────────────────────────────

const ASTPanel: React.FC<Props> = ({ ast }) => {
  const [view, setView] = useState<"tree" | "json" | "graph">("tree");

  if (!ast) {
    return (
      <div className="ast-panel ast-empty">
        <p>No expression built yet.</p>
        <p className="hint">Use the keyboard to construct an expression.</p>
      </div>
    );
  }

  return (
    <div className="ast-panel">
      <div className="panel-tabs">
        {(["tree", "json", "graph"] as const).map((v) => (
          <button key={v} className={`tab-btn ${view === v ? "active" : ""}`} onClick={() => setView(v)}>
            {v.toUpperCase()}
          </button>
        ))}
      </div>
      <div className="panel-content">
        {view === "tree" && <TreeNode node={ast} depth={0} />}
        {view === "json" && <JsonView ast={ast} />}
        {view === "graph" && <GraphView ast={ast} />}
      </div>
    </div>
  );
};

export default ASTPanel;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getChildren(node: ASTNode): { key: string; child: ASTNode }[] {
  switch (node.type) {
    case "Add":
    case "Subtract":
    case "Multiply":
      return [{ key: "left", child: node.left }, { key: "right", child: node.right }];
    case "Divide":
      return [{ key: "num", child: node.numerator }, { key: "den", child: node.denominator }];
    case "Power":
      return [{ key: "base", child: node.base }, { key: "exp", child: node.exponent }];
    case "Root":
      return [{ key: "radicand", child: node.radicand }, { key: "index", child: node.index }];
    case "Negate":
    case "Abs":
      return [{ key: "arg", child: node.argument }];
    case "FunctionCall":
      return [{ key: "arg", child: node.argument }, ...(node.base ? [{ key: "base", child: node.base }] : [])];
    case "Derivative":
      return [{ key: "expr", child: node.expression }];
    case "Integral":
      return [
        { key: "integrand", child: node.integrand },
        ...(node.lower ? [{ key: "lower", child: node.lower }] : []),
        ...(node.upper ? [{ key: "upper", child: node.upper }] : []),
      ];
    case "Limit":
      return [{ key: "expr", child: node.expression }, { key: "approach", child: node.approach }];
    case "Summation":
    case "Product":
      return [{ key: "expr", child: node.expression }, { key: "lower", child: node.lower }, { key: "upper", child: node.upper }];
    case "Equation":
      return [{ key: "left", child: node.left }, { key: "right", child: node.right }];
    default:
      return [];
  }
}

function getNodeLabel(node: ASTNode): string {
  switch (node.type) {
    case "Number": return String(node.value);
    case "Variable": return node.name;
    case "Constant": return node.name;
    case "FunctionCall": return node.name;
    case "Derivative": return `d/d${node.variable}`;
    case "Integral": return `∫ d${node.variable}`;
    case "Limit": return `lim ${node.variable}→`;
    case "Summation": return `Σ ${node.variable}`;
    case "Product": return `Π ${node.variable}`;
    default: return "";
  }
}

function getNodeColor(type: string): string {
  const map: Record<string, string> = {
    Number: "#ffcb6b",
    Variable: "#82aaff",
    Constant: "#c3e6fb",
    Add: "#80cbc4",
    Subtract: "#80cbc4",
    Multiply: "#c792ea",
    Divide: "#c792ea",
    Power: "#f07178",
    Root: "#f07178",
    Negate: "#ff9cac",
    FunctionCall: "#89ddff",
    Abs: "#89ddff",
    Derivative: "#64ffda",
    Integral: "#64ffda",
    Limit: "#64ffda",
    Summation: "#ffcb6b",
    Product: "#ffcb6b",
    Equation: "#e0e0e0",
  };
  return map[type] ?? "#8892b0";
}

function getNodeBg(type: string): string {
  const map: Record<string, string> = {
    Number: "#1a1a0e",
    Variable: "#0e1a2e",
    Derivative: "#001a16",
    Integral: "#001a16",
    FunctionCall: "#001626",
  };
  return map[type] ?? "#12121e";
}
