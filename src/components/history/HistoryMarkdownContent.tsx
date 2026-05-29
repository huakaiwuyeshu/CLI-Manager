import type { ReactNode } from "react";
import Markdown, { type Components } from "react-markdown";
import { PrismAsyncLight as SyntaxHighlighter } from "react-syntax-highlighter";
import bash from "react-syntax-highlighter/dist/esm/languages/prism/bash";
import css from "react-syntax-highlighter/dist/esm/languages/prism/css";
import diff from "react-syntax-highlighter/dist/esm/languages/prism/diff";
import javascript from "react-syntax-highlighter/dist/esm/languages/prism/javascript";
import json from "react-syntax-highlighter/dist/esm/languages/prism/json";
import jsx from "react-syntax-highlighter/dist/esm/languages/prism/jsx";
import markdown from "react-syntax-highlighter/dist/esm/languages/prism/markdown";
import rust from "react-syntax-highlighter/dist/esm/languages/prism/rust";
import tsx from "react-syntax-highlighter/dist/esm/languages/prism/tsx";
import typescript from "react-syntax-highlighter/dist/esm/languages/prism/typescript";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import { cn } from "@/lib/utils";
import { highlightText } from "./historyViewUtils";

SyntaxHighlighter.registerLanguage("bash", bash);
SyntaxHighlighter.registerLanguage("sh", bash);
SyntaxHighlighter.registerLanguage("shell", bash);
SyntaxHighlighter.registerLanguage("css", css);
SyntaxHighlighter.registerLanguage("diff", diff);
SyntaxHighlighter.registerLanguage("patch", diff);
SyntaxHighlighter.registerLanguage("javascript", javascript);
SyntaxHighlighter.registerLanguage("js", javascript);
SyntaxHighlighter.registerLanguage("json", json);
SyntaxHighlighter.registerLanguage("jsx", jsx);
SyntaxHighlighter.registerLanguage("markdown", markdown);
SyntaxHighlighter.registerLanguage("md", markdown);
SyntaxHighlighter.registerLanguage("rust", rust);
SyntaxHighlighter.registerLanguage("rs", rust);
SyntaxHighlighter.registerLanguage("tsx", tsx);
SyntaxHighlighter.registerLanguage("typescript", typescript);
SyntaxHighlighter.registerLanguage("ts", typescript);

interface HistoryMarkdownContentProps {
  content: string;
  query?: string;
  compact?: boolean;
}

function renderText(children: ReactNode, query: string): ReactNode {
  if (!query.trim()) return children;
  if (typeof children === "string") return highlightText(children, query);
  if (Array.isArray(children)) {
    return children.map((child, index) => (
      <span key={index}>{renderText(child, query)}</span>
    ));
  }
  return children;
}

const makeComponents = (query: string): Components => ({
  p({ children }) {
    return <p className="history-markdown-p">{renderText(children, query)}</p>;
  },
  li({ children }) {
    return <li>{renderText(children, query)}</li>;
  },
  strong({ children }) {
    return <strong className="font-semibold text-text-primary">{renderText(children, query)}</strong>;
  },
  em({ children }) {
    return <em>{renderText(children, query)}</em>;
  },
  a({ href, children }) {
    return (
      <span className="history-markdown-link" title={href ?? undefined}>
        {renderText(children, query)}
      </span>
    );
  },
  code({ children, className }) {
    const code = String(children).replace(/\n$/, "");
    const match = /language-([\w-]+)/.exec(className ?? "");
    const language = match?.[1]?.toLowerCase();

    if (!language) {
      return <code className="history-inline-code">{renderText(code, query)}</code>;
    }

    return (
      <div className="history-code-block">
        <div className="history-code-header">
          <span>{language}</span>
        </div>
        <SyntaxHighlighter
          language={language}
          style={oneDark}
          customStyle={{
            margin: 0,
            padding: "0.75rem",
            background: "transparent",
            fontSize: "0.75rem",
            lineHeight: 1.55,
          }}
          codeTagProps={{ className: "history-code-tag" }}
          wrapLongLines
        >
          {code}
        </SyntaxHighlighter>
      </div>
    );
  },
  pre({ children }) {
    return <>{children}</>;
  },
});

export function HistoryMarkdownContent({ content, query = "", compact = false }: HistoryMarkdownContentProps) {
  return (
    <div className={cn("history-markdown text-xs text-text-primary", compact && "history-markdown-compact")}>
      <Markdown components={makeComponents(query)} skipHtml>
        {content}
      </Markdown>
    </div>
  );
}
