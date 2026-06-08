import { useCallback, useRef, type ReactNode } from "react";
import { useTerminalStore } from "../stores/terminalStore";
import type { TerminalPaneLeaf, TerminalPaneNode, TerminalPaneSplit } from "../stores/terminalPaneTree";

interface Props {
  node: TerminalPaneNode;
  renderLeaf: (leaf: TerminalPaneLeaf) => ReactNode;
}

const DIVIDER_SIZE = 4;

function SplitNodeView({ node, renderLeaf }: Props) {
  const setSplitRatio = useTerminalStore((s) => s.setSplitRatio);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleDragStart = useCallback(
    (split: TerminalPaneSplit, e: React.MouseEvent) => {
      e.preventDefault();
      const container = containerRef.current;
      if (!container) return;

      const rect = container.getBoundingClientRect();
      const isHorizontal = split.direction === "horizontal";
      let latestRatio = split.ratio;
      let rafId: number | null = null;

      const flush = () => {
        rafId = null;
        setSplitRatio(split.id, latestRatio);
      };

      const onMove = (ev: MouseEvent) => {
        latestRatio = isHorizontal
          ? (ev.clientX - rect.left) / rect.width
          : (ev.clientY - rect.top) / rect.height;
        if (rafId === null) rafId = requestAnimationFrame(flush);
      };

      const onUp = () => {
        if (rafId !== null) cancelAnimationFrame(rafId);
        setSplitRatio(split.id, latestRatio);
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      };

      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
      document.body.style.cursor = isHorizontal ? "col-resize" : "row-resize";
      document.body.style.userSelect = "none";
    },
    [setSplitRatio]
  );

  if (node.type === "leaf") return <>{renderLeaf(node)}</>;

  const isHorizontal = node.direction === "horizontal";
  const first = `calc(${node.ratio * 100}% - ${DIVIDER_SIZE / 2}px)`;
  const second = `calc(${(1 - node.ratio) * 100}% - ${DIVIDER_SIZE / 2}px)`;

  return (
    <div
      ref={containerRef}
      className="ui-terminal-split-node flex h-full min-h-0 w-full min-w-0"
      style={{ flexDirection: isHorizontal ? "row" : "column" }}
    >
      <div className="ui-terminal-split-child min-h-0 min-w-0 overflow-hidden" style={{ [isHorizontal ? "width" : "height"]: first }}>
        <SplitNodeView node={node.first} renderLeaf={renderLeaf} />
      </div>
      <div
        onMouseDown={(event) => handleDragStart(node, event)}
        className="ui-terminal-split-divider shrink-0 transition-colors"
        style={{
          [isHorizontal ? "width" : "height"]: `${DIVIDER_SIZE}px`,
          cursor: isHorizontal ? "col-resize" : "row-resize",
        }}
      />
      <div className="ui-terminal-split-child min-h-0 min-w-0 overflow-hidden" style={{ [isHorizontal ? "width" : "height"]: second }}>
        <SplitNodeView node={node.second} renderLeaf={renderLeaf} />
      </div>
    </div>
  );
}

export function SplitTerminalView(props: Props) {
  return <SplitNodeView {...props} />;
}
