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
