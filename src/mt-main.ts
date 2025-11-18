import { Plugin } from "obsidian";

import { ToolBarExtension } from "./modules/toolbar";

export default class MiniToolbar extends Plugin {
  async onload() {
    console.log("loading MiniToolbar");

    this.registerEditorExtension(ToolBarExtension(this.app));
  }
}
