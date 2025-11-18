import {
  ChangeDesc,
  EditorState,
  Extension,
  StateEffect,
  StateField,
} from "@codemirror/state";
import { Decoration, DecorationSet, EditorView } from "@codemirror/view";
import { editorInfoField } from "obsidian";

export interface ColorRange {
  from: number;
  to: number;
  color: string; // CSS color value (hex, var(), etc.)
}

export interface FileColorData {
  text: ColorRange[];
  bg: ColorRange[];
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

interface ColorState {
  text: ColorRange[];
  bg: ColorRange[];
  decorations: DecorationSet;
  filePath: string | null;
}

const EMPTY_FILE_DATA: FileColorData = { text: [], bg: [] };

const cloneRanges = (ranges: ColorRange[]): ColorRange[] =>
  ranges.map((r) => ({ ...r }));

const mapRanges = (ranges: ColorRange[], changes: ChangeDesc): ColorRange[] => {
  if (!ranges.length) return ranges;
  const result: ColorRange[] = [];
  for (const r of ranges) {
    const from = changes.mapPos(r.from);
    const to = changes.mapPos(r.to);
    if (from >= to) continue;
    result.push({ from, to, color: r.color });
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
  next.sort((a, b) => (a.from - b.from) || (a.to - b.to));
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

const buildDecorations = (
  state: EditorState,
  text: ColorRange[],
  bg: ColorRange[],
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

      const stored = (path && storage.load(path)) || EMPTY_FILE_DATA;
      const text = cloneRanges(stored.text ?? []);
      const bg = cloneRanges(stored.bg ?? []);
      const decorations = buildDecorations(state, text, bg);
      return { text, bg, decorations, filePath: path };
    },
    update(value, tr) {
      let { text, bg, filePath } = value;

      if (tr.docChanged) {
        text = mapRanges(text, tr.changes);
        bg = mapRanges(bg, tr.changes);
      }

      for (const e of tr.effects) {
        if (e.is(setTextColorEffect)) {
          text = applyColorChange(text, e.value);
        } else if (e.is(setBgColorEffect)) {
          bg = applyColorChange(bg, e.value);
        }
      }

      const decorations = buildDecorations(tr.state, text, bg);

      let path: string | null = filePath;
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const mdView = tr.state.field(editorInfoField) as any;
        const file = mdView?.file;
        if (file && typeof file.path === "string") path = file.path;
      } catch {
        // ignore
      }

      if (path) {
        storage.save(path, { text, bg });
      }

      return { text, bg, decorations, filePath: path };
    },
    provide: (field) =>
      EditorView.decorations.from(field, (val: ColorState) => val.decorations),
  });

  return colorField;
};
