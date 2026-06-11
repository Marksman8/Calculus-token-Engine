import React, { useEffect, useRef } from "react";
import katex from "katex";
import "katex/dist/katex.min.css";

interface Props {
  latex: string;
  block?: boolean;
  className?: string;
}

export const KatexRenderer: React.FC<Props> = ({ latex, block = false, className }) => {
  const ref = useRef<HTMLSpanElement | HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current || !latex) return;
    try {
      katex.render(latex, ref.current, {
        displayMode: block,
        throwOnError: false,
        strict: false,
        trust: false,
        macros: {
          "\\infty": "\\infty",
        },
      });
    } catch {
      if (ref.current) ref.current.textContent = latex;
    }
  }, [latex, block]);

  if (block) {
    return <div ref={ref as React.RefObject<HTMLDivElement>} className={`katex-block ${className ?? ""}`} />;
  }
  return <span ref={ref as React.RefObject<HTMLSpanElement>} className={`katex-inline ${className ?? ""}`} />;
};
