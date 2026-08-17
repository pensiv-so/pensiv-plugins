/**
 * Reading beats back out of documents.
 *
 * The marks are the storage (see `mark.ts`), so "list every foreshadowing beat in
 * the manuscript" is a walk over ProseMirror JSON — the active document via
 * `app.editor.getDoc()`, every other file via `app.project.content(id).doc`. Both
 * hand back the same shape, so one walker covers both.
 *
 * Positions matter: they are what `app.ui.openFile(id, { range })` needs to take
 * the user back to the sentence. So this accumulates real ProseMirror positions
 * rather than string offsets — see {@link nodeSize}.
 */
import type { ForeshadowAttrs, ForeshadowKind } from './mark';

/** The ProseMirror JSON shape we walk. Structural only — no schema knowledge. */
export interface PmNode {
  type?: string;
  text?: string;
  marks?: Array<{ type?: string; attrs?: Record<string, unknown> }>;
  content?: PmNode[];
}

/** One mark occurrence, resolved to where it sits and what it says. */
export interface Anchor extends ForeshadowAttrs {
  /** The file the beat lives in. */
  fileId: string;
  /** ProseMirror absolute positions of the (first contiguous run of the) span. */
  from: number;
  to: number;
  /** The marked text, for the list row. */
  quote: string;
}

/**
 * A setup and the payoffs that resolve it, grouped by `gid`. `resolved` folds in
 * the manual tick from plugin storage, so a beat paid off "off-page" can still be
 * closed by the writer.
 */
export interface Thread {
  gid: string;
  setup: Anchor;
  payoffs: Anchor[];
  resolved: boolean;
  /** True when nothing in the text resolves it — it was ticked off by hand. */
  resolvedByHand: boolean;
}

/**
 * ProseMirror node size: a text node costs its length, every other node costs its
 * content plus one token for its own open and close. This is the whole reason the
 * walk can't use plain string offsets — every block boundary spends positions the
 * text does not.
 */
function nodeSize(node: PmNode): number {
  if (typeof node.text === 'string') return node.text.length;
  const inner = (node.content ?? []).reduce((sum, child) => sum + nodeSize(child), 0);
  return inner + 2;
}

function isForeshadowMark(mark: { type?: string }): boolean {
  return mark.type === 'foreshadow';
}

function toAttrs(attrs: Record<string, unknown> | undefined): ForeshadowAttrs | null {
  const fid = typeof attrs?.fid === 'string' ? attrs.fid : '';
  if (!fid) return null;
  const kind = attrs?.kind === 'payoff' ? 'payoff' : 'setup';
  return {
    fid,
    gid: typeof attrs?.gid === 'string' && attrs.gid ? attrs.gid : fid,
    kind: kind as ForeshadowKind,
    label: typeof attrs?.label === 'string' ? attrs.label : ''
  };
}

/**
 * Every beat in one document, in reading order.
 *
 * A span that crosses a bold run or a paragraph break is several marks sharing
 * one `fid`; they are merged back into one anchor, extending the quote only while
 * the run stays contiguous so a beat split across paragraphs reports the first
 * fragment rather than a sentence glued to a later one.
 */
export function collectAnchors(doc: unknown, fileId: string): Anchor[] {
  const byId = new Map<string, Anchor>();

  const walk = (node: PmNode, pos: number): void => {
    if (typeof node.text === 'string') {
      for (const mark of node.marks ?? []) {
        if (!isForeshadowMark(mark)) continue;
        const attrs = toAttrs(mark.attrs);
        if (!attrs) continue;
        const existing = byId.get(attrs.fid);
        if (!existing) {
          byId.set(attrs.fid, {
            ...attrs,
            fileId,
            from: pos,
            to: pos + node.text.length,
            quote: node.text
          });
          continue;
        }
        if (pos === existing.to) {
          existing.to += node.text.length;
          existing.quote += node.text;
        }
      }
      return;
    }

    let childPos = pos + 1;
    for (const child of node.content ?? []) {
      walk(child, childPos);
      childPos += nodeSize(child);
    }
  };

  const root = doc as PmNode | null | undefined;
  if (!root || typeof root !== 'object') return [];
  // The doc node itself starts at 0 and its children at 0 + 1 - 1 = 0: the top
  // node's open token is not counted in absolute positions.
  let childPos = 0;
  for (const child of root.content ?? []) {
    walk(child, childPos);
    childPos += nodeSize(child);
  }

  return [...byId.values()].sort((a, b) => a.from - b.from);
}

/**
 * Group anchors into threads. Payoffs with no setup are dropped rather than shown
 * as orphan rows: the setup was deleted with its sentence, and a payoff pointing
 * at nothing is noise, not a to-do.
 *
 * The two override sets are the writer's judgement layered over the text:
 * `doneGids` closes a beat that has no payoff mark ("paid off off-page"), and
 * `reopenedGids` reopens one that does ("the payoff isn't good enough yet") —
 * so the checkbox is a two-way toggle in both cases, without touching the prose.
 */
export function buildThreads(
  anchors: Anchor[],
  doneGids: ReadonlySet<string>,
  reopenedGids: ReadonlySet<string> = new Set()
): Thread[] {
  const setups = new Map<string, Anchor>();
  const payoffs = new Map<string, Anchor[]>();

  for (const anchor of anchors) {
    if (anchor.kind === 'setup') {
      // A duplicated gid (copy/paste of a marked sentence) keeps the earlier one,
      // so the list doesn't gain a second row for the same beat.
      if (!setups.has(anchor.gid)) setups.set(anchor.gid, anchor);
      continue;
    }
    const list = payoffs.get(anchor.gid) ?? [];
    list.push(anchor);
    payoffs.set(anchor.gid, list);
  }

  return [...setups.entries()].map(([gid, setup]) => {
    const paidInText = (payoffs.get(gid) ?? []).length > 0;
    const resolved = paidInText ? !reopenedGids.has(gid) : doneGids.has(gid);
    return {
      gid,
      setup,
      payoffs: payoffs.get(gid) ?? [],
      resolved,
      resolvedByHand: !paidInText && resolved
    };
  });
}

/** Headline numbers for the pane header and the analytics card. */
export function summarize(threads: readonly Thread[]): {
  total: number;
  resolved: number;
  open: number;
  /** 0..1. A manuscript with no beats reports 0 rather than NaN. */
  rate: number;
} {
  const total = threads.length;
  const resolved = threads.filter((thread) => thread.resolved).length;
  return {
    total,
    resolved,
    open: total - resolved,
    rate: total === 0 ? 0 : resolved / total
  };
}

/** The row label: the writer's own name for the beat, else the text they marked. */
export function threadLabel(thread: Thread): string {
  const label = thread.setup.label.trim();
  return label || thread.setup.quote.trim() || '…';
}
