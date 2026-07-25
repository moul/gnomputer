import type { CSSProperties } from "react";
import type { BlockSummary } from "@gnomputer/app-sdk";
import { formatNumber } from "../format-number";

// A literal "squares for blocks" visualization — chronological left-to-right
// (useLiveActivity returns newest-first, so this reverses for display),
// square size/glow scaled by how busy that block was relative to the
// busiest one currently on screen. Deliberately independent of the list
// pane's "Only with txs" filter below it — an empty block is itself
// information (a gap), not noise to hide.
export function BlockStrip({
  blocks,
  selectedHeight,
  onSelect,
}: {
  blocks: BlockSummary[];
  selectedHeight: number | null;
  onSelect: (height: number) => void;
}) {
  if (blocks.length === 0) return null;
  const maxTxs = Math.max(1, ...blocks.map((b) => b.numTxs));
  const chronological = [...blocks].reverse();

  return (
    <div className="block-strip" role="list" aria-label="Recent blocks, chronological">
      {chronological.map((b) => {
        const intensity = b.numTxs === 0 ? 0 : Math.max(0.25, b.numTxs / maxTxs);
        const style: CSSProperties & Record<"--intensity", number> = { "--intensity": intensity };
        return (
          <button
            key={b.height}
            type="button"
            role="listitem"
            className="block-strip__square"
            data-active={b.height === selectedHeight}
            data-empty={b.numTxs === 0}
            style={style}
            title={`#${formatNumber(b.height)} — ${b.numTxs} ${b.numTxs === 1 ? "transaction" : "transactions"}`}
            onClick={() => onSelect(b.height)}
          />
        );
      })}
    </div>
  );
}
