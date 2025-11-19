import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { App, editorInfoField } from "obsidian";

import { setBgColorEffect, setTextColorEffect, setUnderlineEffect } from "./colorRanges";

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

const getViewFromState = (state: EditorState): EditorView | null => {
  try {
    // editorInfoField gives us the MarkdownView; from there we can grab the
    // underlying CM6 EditorView via the internal `cm`/`cmEditor` property.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mdView = state.field(editorInfoField) as any;
    const editor = mdView?.editor as any;
    const cm: EditorView | undefined =
      editor?.cm ?? editor?.cmEditor ?? editor?.cm6;
    if (cm && typeof (cm as any).dispatch === "function") return cm;
    return null;
  } catch {
    return null;
  }
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

// Notion-like highlight background palette (approximate)
export const NOTION_BG_COLOR_MAP: Record<string, string> = {
  Gray: "#EAEAEA",
  Brown: "#EEE0DA",
  Orange: "#FAEBDD",
  Yellow: "#FBF3DB",
  Green: "#DDEDEA",
  Blue: "#DDEBF1",
  Purple: "#EAE4F2",
  Pink: "#F4DFEB",
  Red: "#FBE4E4",
};
export const NOTION_BG_COLOR_NAMES: string[] = [
  "Default",
  ...Object.keys(NOTION_BG_COLOR_MAP),
];

// Apply or remove text color via CM6 decorations and colorRanges state.
// This no longer mutates the underlying markdown with HTML; it only updates
// persistent ranges stored in data.json.
export const setTextColor = (state: EditorState, colorCss: string | null) => {
  const view = getViewFromState(state);
  if (!view) return;

  // Always read the *current* selection from the live EditorView to avoid
  // mismatches with the captured CM6 state used to create the toolbar.
  const sel = view.state.selection.main;
  if (sel.empty) return;

  const from = sel.from;
  const to = sel.to;

  view.dispatch({
    effects: setTextColorEffect.of({ from, to, color: colorCss }),
  });
};

export const setTextColorByName = (state: EditorState, name: string) => {
  if (name === "Default") return setTextColor(state, null);
  const hex = NOTION_TEXT_COLOR_MAP[name];
  if (hex) setTextColor(state, hex);
};

// Apply or remove background highlight via CM6 decorations and colorRanges.
export const setBgColor = (state: EditorState, colorCss: string | null) => {
  const view = getViewFromState(state);
  if (!view) return;

  const sel = view.state.selection.main;
  if (sel.empty) return;

  const from = sel.from;
  const to = sel.to;

  view.dispatch({
    effects: setBgColorEffect.of({ from, to, color: colorCss }),
  });
};

export const setBgColorByName = (state: EditorState, name: string) => {
  if (name === "Default") return setBgColor(state, null);
  const varName = `var(--mtv2-bg-${name.toLowerCase()})`;
  setBgColor(state, varName);
};

// Toggle underline decoration over the current selection.
export const toggleUnderline = (state: EditorState, enable?: boolean) => {
  const view = getViewFromState(state);
  if (!view) return;

  const sel = view.state.selection.main;
  if (sel.empty) return;

  const from = sel.from;
  const to = sel.to;

  view.dispatch({
    effects: setUnderlineEffect.of({ from, to, enable }),
  });
};
