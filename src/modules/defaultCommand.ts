import { EditorState } from "@codemirror/state";
import { App, editorInfoField } from "obsidian";

export const cutText = (state: EditorState) => {
  const editor = getEditorFromState(state);
  if (!editor) return;
  const originText = editor.getSelection();
  window.navigator.clipboard.writeText(editor.getSelection());
  editor.replaceSelection("", originText);
};

export const copyText = (state: EditorState) => {
  const editor = getEditorFromState(state);
  if (!editor) return;
  window.navigator.clipboard.writeText(editor?.getSelection());
};

export const boldText = (app: App) => {
  app.commands.executeCommandById("editor:toggle-bold", app);
};

export const strikethroughText = (app: App) => {
  app.commands.executeCommandById("editor:toggle-strikethrough", app);
};

export const markText = (app: App) => {
  app.commands.executeCommandById("editor:toggle-highlight", app);
};

export const italicText = (app: App) => {
  app.commands.executeCommandById("editor:toggle-italics", app);
};

export const getEditorFromState = (state: EditorState) => {
  const { editor } = state.field(editorInfoField);
  return editor;
};

// === Text color helpers ===
// Notion-like text color palette (approximate hex values)
export const NOTION_TEXT_COLOR_MAP: Record<string, string> = {
  Gray: "#9B9A97",
  Brown: "#64473A",
  Orange: "#D9730D",
  Yellow: "#DFAB01",
  Green: "#0F7B6C",
  Blue: "#0B6E99",
  Purple: "#6940A5",
  Pink: "#AD1A72",
  Red: "#E03E3E",
};
export const NOTION_TEXT_COLOR_NAMES: string[] = [
  "Default",
  ...Object.keys(NOTION_TEXT_COLOR_MAP),
];

// Apply or remove text color by wrapping selection in a span with inline style.
// If the current selection is already wrapped by <span style="color:...">, clicking the same color toggles it off.
export const setTextColor = (state: EditorState, colorHex: string | null) => {
  const editor = getEditorFromState(state);
  if (!editor) return;

  const sel = editor.getSelection();
  if (!sel) return;

  const spanRegex = /^<span\s+style=["']color:\s*([^"';]+)["']>([\s\S]*)<\/span>$/i;
  const match = sel.match(spanRegex);

  // Remove color (unwrap) if requested
  if (colorHex === null) {
    if (match) {
      editor.replaceSelection(match[2]);
    }
    return;
  }

  // If selection already has a color span, update or toggle off if same color
  if (match) {
    const currentColor = match[1].trim();
    const inner = match[2];
    if (currentColor.toLowerCase() === colorHex.toLowerCase()) {
      // Toggle off
      editor.replaceSelection(inner);
    } else {
      // Replace color
      editor.replaceSelection(`<span style="color:${colorHex}">${inner}</span>`);
    }
    return;
  }

  // Otherwise, wrap selection
  editor.replaceSelection(`<span style="color:${colorHex}">${sel}</span>`);
};

export const setTextColorByName = (state: EditorState, name: string) => {
  if (name === "Default") return setTextColor(state, null);
  const hex = NOTION_TEXT_COLOR_MAP[name];
  if (hex) setTextColor(state, hex);
};
