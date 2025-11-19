import {
  ChangeDesc,
  EditorState,
  Extension,
  StateEffect,
  StateField,
} from "@codemirror/state";
import { Decoration, DecorationSet, EditorView } from "@codemirror/view";
import { editorInfoField, editorViewField } from "obsidian";

export interface ColorRange {
  from: number;
  to: number;
  color: string; // CSS color value (hex, var(), etc.)
}

export interface Range {
  from: number;
  to: number;
}

export interface FileColorData {
  text: ColorRange[];
  bg: ColorRange[];
  underline?: Range[];
}

export interface ColorStorage {
  load(path: string): FileColorData | null | undefined;
  save(path: string, data: FileColorData): void;
}

export const setTextColorEffect = StateEffect.define<{
  from: number;
  to: number;
  color: string | null;
}>();

export const setBgColorEffect = StateEffect.define<{
  from: number;
  to: number;
  color: string | null;
}>();

export const setUnderlineEffect = StateEffect.define<{
  from: number;
  to: number;
  // If provided, set underline to this boolean. If omitted, toggle.
  enable?: boolean;
}>();

interface ColorState {
  text: ColorRange[];
  bg: ColorRange[];
  underline: Range[];
  decorations: DecorationSet;
  filePath: string | null;
}

const EMPTY_FILE_DATA: FileColorData = { text: [], bg: [], underline: [] };

const cloneColorRanges = (ranges: ColorRange[]): ColorRange[] =>
  ranges.map((r) => ({ ...r }));
const cloneRanges = (ranges: Range[]): Range[] => ranges.map((r) => ({ ...r }));

const clampColorRangesToDoc = (ranges: ColorRange[], len: number): ColorRange[] => {
  if (!ranges.length) return ranges;
  const out: ColorRange[] = [];
  for (const r of ranges) {
    const from = Math.max(0, Math.min(len, r.from));
    const to = Math.max(0, Math.min(len, r.to));
    if (from < to) out.push({ from, to, color: r.color });
  }
  return out;
};
const clampRangesToDoc = (ranges: Range[], len: number): Range[] => {
  if (!ranges.length) return ranges;
  const out: Range[] = [];
  for (const r of ranges) {
    const from = Math.max(0, Math.min(len, r.from));
    const to = Math.max(0, Math.min(len, r.to));
    if (from < to) out.push({ from, to });
  }
  return out;
};

const isMainEditorView = (state: EditorState): boolean => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mdView = state.field(editorInfoField) as any;
    const main: EditorView | undefined = mdView?.editor?.cm ?? mdView?.editor?.cmEditor ?? mdView?.editor?.cm6;
    const current = state.field(editorViewField) as EditorView;
    return !!(main && current && main === current);
  } catch {
    return true;
  }
};

const mapColorRanges = (
  ranges: ColorRange[],
  changes: ChangeDesc,
): ColorRange[] => {
  if (!ranges.length) return ranges;
  const result: ColorRange[] = [];
  for (const r of ranges) {
    // Left-inclusive, right-exclusive mapping so typing at the end doesn't extend the style.
    const from = changes.mapPos(r.from, 1);
    const to = changes.mapPos(r.to, -1);
    if (from >= to) continue;
    result.push({ from, to, color: r.color });
  }
  return result;
};

const mapRanges = (ranges: Range[], changes: ChangeDesc): Range[] => {
  if (!ranges.length) return ranges;
  const result: Range[] = [];
  for (const r of ranges) {
    // Left-inclusive, right-exclusive mapping so typing at the end doesn't extend the style.
    const from = changes.mapPos(r.from, 1);
    const to = changes.mapPos(r.to, -1);
    if (from >= to) continue;
    result.push({ from, to });
  }
  return result;
};

const applyColorChange = (
  ranges: ColorRange[],
  change: { from: number; to: number; color: string | null },
): ColorRange[] => {
  const { from, to, color } = change;
  if (from >= to) return ranges;

  const next: ColorRange[] = [];
  for (const r of ranges) {
    if (r.to <= from || r.from >= to) {
      // No overlap
      next.push(r);
      continue;
    }
    // Left remainder
    if (r.from < from) {
      next.push({ from: r.from, to: from, color: r.color });
    }
    // Right remainder
    if (r.to > to) {
      next.push({ from: to, to: r.to, color: r.color });
    }
  }

  if (color != null) {
    next.push({ from, to, color });
  }

  // Sort and merge adjacent same-color ranges
  next.sort((a, b) => a.from - b.from || a.to - b.to);
  const merged: ColorRange[] = [];
  for (const r of next) {
    const last = merged[merged.length - 1];
    if (last && last.color === r.color && last.to >= r.from) {
      last.to = Math.max(last.to, r.to);
    } else {
      merged.push({ ...r });
    }
  }
  return merged;
};

const subtractRange = (ranges: Range[], from: number, to: number): Range[] => {
  const next: Range[] = [];
  for (const r of ranges) {
    if (r.to <= from || r.from >= to) {
      next.push(r);
      continue;
    }
    if (r.from < from) next.push({ from: r.from, to: from });
    if (r.to > to) next.push({ from: to, to: r.to });
  }
  return next;
};

const selectionMinusRanges = (
  ranges: Range[],
  from: number,
  to: number,
): Range[] => {
  const overlapped = ranges
    .filter((r) => r.to > from && r.from < to)
    .sort((a, b) => a.from - b.from);
  const result: Range[] = [];
  let cursor = from;
  for (const r of overlapped) {
    const s = Math.max(r.from, from);
    const e = Math.min(r.to, to);
    if (s > cursor) {
      result.push({ from: cursor, to: s });
    }
    cursor = Math.max(cursor, e);
  }
  if (cursor < to) result.push({ from: cursor, to });
  return result;
};

const mergeAdjacent = (ranges: Range[]): Range[] => {
  if (!ranges.length) return ranges;
  const sorted = [...ranges].sort((a, b) => a.from - b.from || a.to - b.to);
  const out: Range[] = [];
  for (const r of sorted) {
    const last = out[out.length - 1];
    if (last && last.to >= r.from) {
      last.to = Math.max(last.to, r.to);
    } else {
      out.push({ ...r });
    }
  }
  return out;
};

const applyUnderlineChange = (
  ranges: Range[],
  change: { from: number; to: number; enable?: boolean },
): Range[] => {
  const { from, to, enable } = change;
  if (from >= to) return ranges;

  if (enable === true) {
    // Set underline ON for [from, to]
    const next = subtractRange(ranges, from, to);
    return mergeAdjacent([...next, { from, to }]);
  }
  if (enable === false) {
    // Set underline OFF for [from, to]
    return subtractRange(ranges, from, to);
  }
  // Toggle underline within [from, to]
  const removed = subtractRange(ranges, from, to);
  const addSegments = selectionMinusRanges(ranges, from, to);
  return mergeAdjacent([...removed, ...addSegments]);
};

const buildDecorations = (
  state: EditorState,
  text: ColorRange[],
  bg: ColorRange[],
  underline: Range[],
): DecorationSet => {
  const ranges: any[] = [];

  for (const r of text) {
    ranges.push(
      Decoration.mark({
        attributes: { style: `color: ${r.color};` },
      }).range(r.from, r.to),
    );
  }

  for (const r of bg) {
    ranges.push(
      Decoration.mark({
        attributes: {
          // Only set background-color here. We intentionally do NOT override the
          // text color so that text-color decorations can always win, no matter
          // which decoration ends up being the inner/outer span.
          style: `background-color: ${r.color};`,
        },
      }).range(r.from, r.to),
    );
  }

  for (const r of underline) {
    ranges.push(
      Decoration.mark({
        attributes: {
          style:
            "text-decoration: underline; text-decoration-skip-ink: auto; text-underline-offset: 2px;",
        },
      }).range(r.from, r.to),
    );
  }

  if (!ranges.length) return Decoration.none;
  return Decoration.set(ranges, true);
};

export const createColorExtension = (storage: ColorStorage): Extension => {
  const colorField = StateField.define<ColorState>({
    create(state) {
      let path: string | null = null;
      try {
        // editorInfoField stores a MarkdownView-like object for this editor.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const mdView = state.field(editorInfoField) as any;
        const file = mdView?.file;
        if (file && typeof file.path === "string") path = file.path;
      } catch {
        path = null;
      }

      // In embedded editors (e.g., Live Preview table cells), don't mirror full-file
      // ranges into the fragment doc; it doesn't share coordinates. Keep decorations off.
      if (!isMainEditorView(state)) {
        return {
          text: [],
          bg: [],
          underline: [],
          decorations: Decoration.none,
          filePath: path,
        };
      }

      const stored = (path && storage.load(path)) || EMPTY_FILE_DATA;
      // Clamp any persisted ranges to this doc's length. This protects
      // embedded editors (e.g., table cell editors) whose doc is only a fragment
      // of the full file.
      const docLen = state.doc.length;
      const text = clampColorRangesToDoc(cloneColorRanges(stored.text ?? []), docLen);
      const bg = clampColorRangesToDoc(cloneColorRanges(stored.bg ?? []), docLen);
      const underline = clampRangesToDoc(cloneRanges(stored.underline ?? []), docLen);
      const decorations = buildDecorations(state, text, bg, underline);
      return { text, bg, underline, decorations, filePath: path };
    },
    update(value, tr) {
      let { text, bg, underline, filePath } = value;

      if (tr.docChanged) {
        text = mapColorRanges(text, tr.changes);
        bg = mapColorRanges(bg, tr.changes);
        underline = mapRanges(underline, tr.changes);
      }

      for (const e of tr.effects) {
        if (e.is(setTextColorEffect)) {
          text = applyColorChange(text, e.value);
        } else if (e.is(setBgColorEffect)) {
          bg = applyColorChange(bg, e.value);
        } else if (e.is(setUnderlineEffect)) {
          underline = applyUnderlineChange(underline, e.value);
        }
      }

      // Ensure ranges stay within current doc length before building decorations
      const docLen = tr.state.doc.length;
      text = clampColorRangesToDoc(text, docLen);
      bg = clampColorRangesToDoc(bg, docLen);
      underline = clampRangesToDoc(underline, docLen);

      const decorations = buildDecorations(tr.state, text, bg, underline);

      let path: string | null = filePath;
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const mdView = tr.state.field(editorInfoField) as any;
        const file = mdView?.file;
        if (file && typeof file.path === "string") path = file.path;
      } catch {
        // ignore
      }

      // Only persist when operating on the main file editor view to avoid
      // clobbering the full-file ranges from embedded editors (e.g., table cells).
      if (path && isMainEditorView(tr.state)) {
        storage.save(path, { text, bg, underline });
      }

      return { text, bg, underline, decorations, filePath: path };
    },
    provide: (field) =>
      EditorView.decorations.from(field, (val: ColorState) => val.decorations),
  });

  return colorField;
};
