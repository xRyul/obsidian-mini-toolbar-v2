import { EditorState, StateField } from "@codemirror/state";
import { Decoration, DecorationSet, EditorView } from "@codemirror/view";
import { editorInfoField } from "obsidian";

interface InlineColorHtmlState {
  decorations: DecorationSet;
  isLivePreview: boolean;
}

const buildDecorations = (state: EditorState): DecorationSet => {
  const text = state.doc.toString();
  const ranges: any[] = [];

  // Text color: <span style="color: ...">inner</span>
  const spanRegex = /<span\s+style=["']color:\s*([^"';]+)["']>([\s\S]*?)<\/span>/gi;
  let match: RegExpExecArray | null;
  // eslint-disable-next-line no-cond-assign
  while ((match = spanRegex.exec(text)) !== null) {
    const full = match[0];
    const color = match[1].trim();
    const fullStart = match.index;
    const fullEnd = fullStart + full.length;

    const openTagEndRel = full.indexOf(">");
    const closeTagStartRel = full.lastIndexOf("</span>");
    if (openTagEndRel < 0 || closeTagStartRel < 0) continue;

    const innerStart = fullStart + openTagEndRel + 1;
    const innerEnd = fullStart + closeTagStartRel;

    if (!(fullStart < innerStart && innerStart <= innerEnd && innerEnd <= fullEnd)) {
      continue;
    }

    if (fullStart < innerStart) {
      ranges.push(Decoration.replace({}).range(fullStart, innerStart));
    }
    if (innerStart < innerEnd) {
      ranges.push(
        Decoration.mark({
          attributes: { style: `color: ${color};` },
        }).range(innerStart, innerEnd),
      );
    }
    if (innerEnd < fullEnd) {
      ranges.push(Decoration.replace({}).range(innerEnd, fullEnd));
    }
  }

  // Background highlight: <mark style="background-color: ...">inner</mark>
  // or <span style="background-color: ...">inner</span>
  const markRegex = /<(mark|span)\s+style=["']background-color:\s*([^"';]+)["']>([\s\S]*?)<\/(?:mark|span)>/gi;
  let m2: RegExpExecArray | null;
  // eslint-disable-next-line no-cond-assign
  while ((m2 = markRegex.exec(text)) !== null) {
    const full = m2[0];
    const color = m2[2].trim();
    const fullStart = m2.index;
    const fullEnd = fullStart + full.length;

    const openTagEndRel = full.indexOf(">");
    const closeTagStartRelMark = full.lastIndexOf("</mark>");
    const closeTagStartRelSpan = full.lastIndexOf("</span>");
    const closeTagStartRel = Math.max(closeTagStartRelMark, closeTagStartRelSpan);
    if (openTagEndRel < 0 || closeTagStartRel < 0) continue;

    const innerStart = fullStart + openTagEndRel + 1;
    const innerEnd = fullStart + closeTagStartRel;

    if (!(fullStart < innerStart && innerStart <= innerEnd && innerEnd <= fullEnd)) {
      continue;
    }

    if (fullStart < innerStart) {
      ranges.push(Decoration.replace({}).range(fullStart, innerStart));
    }
    if (innerStart < innerEnd) {
      ranges.push(
        Decoration.mark({
          attributes: {
            style: `background-color: ${color}; color: var(--text-normal);`,
          },
        }).range(innerStart, innerEnd),
      );
    }
    if (innerEnd < fullEnd) {
      ranges.push(Decoration.replace({}).range(innerEnd, fullEnd));
    }
  }

  if (!ranges.length) return Decoration.none;
  return Decoration.set(ranges, true);
};

const isLivePreview = (state: EditorState): boolean => {
  try {
    // editorInfoField is extended by Obsidian to carry the MarkdownView.
    // Use "any" to avoid depending on internal typings.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const info = state.field(editorInfoField) as any;
    const view = info?.view;
    if (!view) return true; // Fallback: treat as live preview so tags get hidden.

    const viewState =
      typeof view.getState === "function" ? view.getState() : undefined;
    if (!viewState) return true;

    // If we know we're not in a source editor, don't bother hiding.
    if (viewState.mode && viewState.mode !== "source") return false;

    // On modern Obsidian, "source" distinguishes strict vs live preview.
    // When viewState.source === "live", we are in Live Preview.
    if (Object.prototype.hasOwnProperty.call(viewState, "source")) {
      const source = (viewState as any).source;
      if (source === "live") return true;
      if (source === "source") return false; // strict source mode: show raw HTML
    }

    // Unknown structure or older Obsidian: default to hiding tags in source editors.
    return true;
  } catch {
    // On any error, err on the side of hiding HTML in the editor.
    return true;
  }
};

const inlineColorHtmlField = StateField.define<InlineColorHtmlState>({
  create(state) {
    const live = isLivePreview(state);
    return {
      isLivePreview: live,
      decorations: live ? buildDecorations(state) : Decoration.none,
    };
  },
  update(value, tr) {
    const live = isLivePreview(tr.state);
    if (!tr.docChanged && live === value.isLivePreview) return value;

    if (!live) {
      return { isLivePreview: false, decorations: Decoration.none };
    }

    return {
      isLivePreview: true,
      decorations: buildDecorations(tr.state),
    };
  },
  provide: (field) =>
    EditorView.decorations.from(field, (val: InlineColorHtmlState) => val.decorations),
});

export const hideInlineColorHtmlExtension = inlineColorHtmlField;
