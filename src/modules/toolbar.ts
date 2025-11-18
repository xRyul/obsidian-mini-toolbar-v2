import "./style.less";

import { getApi } from "@aidenlx/obsidian-icon-shortcodes";
import {
  lineClassNodeProp,
  syntaxTree,
  tokenClassNodeProp,
} from "@codemirror/language";
import { EditorState, StateField } from "@codemirror/state";
import { SyntaxNode } from "@lezer/common/dist/tree";
import {
  App,
  BaseComponent,
  ButtonComponent,
  Component,
  Menu,
  setIcon,
} from "obsidian";

import { showTooltip, Tooltip } from "../popper";
import {
  SmallButton as SBtnDef,
  ToolBar as ToolBarDef,
} from "../typings/index";
import {
  boldText,
  copyText,
  cutText,
  italicText,
  markText,
  strikethroughText,
} from "./defaultCommand";

const getCursorTooltips = (state: EditorState, app: App): Tooltip | null => {
  const sel = state.selection.ranges[0];
  if (!sel) return null;

  const { anchor, head, empty } = sel;
  let [start, end] = [anchor, head].sort();

  const isMultiLineSelection =
    state.doc.lineAt(sel.from).number !== state.doc.lineAt(sel.to).number;

  const createToolbar = (container: any) => {
    const toolbar = new ToolBar(container)
      .addSmallButton((btn) =>
        btn.setIcon("scissors").onClick(() => cutText(state)),
      )
      .addSmallButton((btn) =>
        btn.setIcon("copy").onClick(() => copyText(state)),
      )
      .addSmallButton((btn) => btn.setIcon("bold").onClick(() => boldText(app)))
      .addSmallButton((btn) =>
        btn.setIcon("italic").onClick(() => italicText(app)),
      )
      .addSmallButton((btn) =>
        btn.setIcon("strikethrough").onClick(() => strikethroughText(app)),
      );

    if (isMultiLineSelection) {
      toolbar.addSmallButton((btn) =>
        btn.setIcon("highlighter").onClick(() => markText(app)),
      );
    }

    return toolbar;
  };

  return {
    start: start,
    end: empty ? undefined : end,
    create: createToolbar,
  };
};

export const cursorTooltipField = (app: App) => {
  return StateField.define<Tooltip | null>({
    create: (state: EditorState) => getCursorTooltips(state, app),

    update: (tooltips, tr) => {
      if (!tr.docChanged && !tr.selection) return tooltips;
      return getCursorTooltips(tr.state, app);
    },

    // enable showtooltips extension with tooltips info provided from statefield
    provide: (f) => showTooltip.from(f),
  });
};

export const ToolBarExtension = (app: App) => {
  return [cursorTooltipField(app)];
};

class SmallButton extends BaseComponent implements SBtnDef {
  button: ButtonComponent;
  disabled = false;
  dropdownOptions: string[] = [];
  menu: Menu | undefined;
  menuOpened = false;

  constructor(containerEl: HTMLElement) {
    super();
    this.button = new ButtonComponent(containerEl);
  }

  setDisabled(disabled: boolean): this {
    this.button.setDisabled(disabled);
    this.disabled = disabled;
    return this;
  }

  /**
   * @param iconId icon name in obsidian or icon shortcode
   */
  setIcon(iconId: string): this {
    const iconSize = 14;
    this.button.setIcon(iconId);
    let iconSC, icon;
    if (
      !this.button.buttonEl.querySelector("svg") &&
      (iconSC = getApi()) &&
      (icon = iconSC.getIcon(iconId, false))
    ) {
      const sizeAttr = {
        width: iconSize,
        height: iconSize,
      };
      if (typeof icon === "string") {
        this.button.buttonEl.createDiv({ text: icon, attr: sizeAttr });
      } else {
        Object.assign(icon, sizeAttr);
        this.button.buttonEl.appendChild(icon);
      }
    }
    return this;
  }

  setClass(cls: string): this {
    this.button.setClass(cls);
    return this;
  }

  setDropdownText(state: EditorState): this {
    const textDiv = this.button.buttonEl.createDiv("mini-toolbar-text");
    const iconDiv = this.button.buttonEl.createDiv(
      "mini-toolbar-icon-with-text",
    );
    setIcon(iconDiv, "chevron-down");

    const linePos = state.doc.lineAt(state.selection.ranges[0].from)?.from;
    let syntaxNode = syntaxTree(state).resolveInner(linePos + 1);
    // @ts-ignore
    let nodeProps: string = syntaxNode.type.prop(tokenClassNodeProp);
    textDiv.setText(this.detectFormat(nodeProps, syntaxNode) || "Text");
    return this;
  }

  setDropdownIcon(): this {
    const highlightIconDiv = this.button.buttonEl.createDiv(
      "mini-toolbar-highlight-icon",
    );
    const iconDiv = this.button.buttonEl.createDiv(
      "mini-toolbar-icon-with-icon",
    );
    setIcon(highlightIconDiv, "highlighter");
    setIcon(iconDiv, "chevron-down");

    return this;
  }

  detectFormat(nodeProps: string, syntaxNode: SyntaxNode): string | undefined {
    if (!nodeProps) return "Text";
    if (nodeProps.includes("strong")) return "Bold";
    if (nodeProps.includes("em")) return "Italic";
    if (nodeProps.includes("strikethrough")) return "Strike";
    if (nodeProps.contains("hmd-codeblock")) {
      return "CodeBlock";
    }
    if (nodeProps.contains("hmd-inline-code")) {
      return "Code";
    }
    if (nodeProps.contains("formatting-header")) {
      const headingLevel = nodeProps.match(/header-\d{1,}/);
      if (headingLevel) {
        return "Heading " + headingLevel[0].slice(-1);
      }
    }
    if (
      nodeProps.contains("formatting-list") ||
      nodeProps.contains("hmd-list-indent")
    ) {
      if (syntaxNode?.parent) {
        // @ts-ignore
        const nodeProps = syntaxNode.parent?.type.prop(lineClassNodeProp);
        if (nodeProps?.contains("HyperMD-task-line")) return "To-do list";
      }
      if (nodeProps.contains("formatting-list-ol")) return "Numbered list";
      if (nodeProps.contains("formatting-list-ul")) return "Bulleted list";
    }
  }

  setTooltip(tooltip: string): this {
    this.button.setTooltip(tooltip);
    return this;
  }

  setOptionsList(optionsList: string[]): this {
    this.dropdownOptions = optionsList;
    return this;
  }

  onClick(cb: (evt: MouseEvent) => void): this {
    if (this.dropdownOptions.length > 0) {
      this.button.onClick((evt) => this.showEditMenu(evt));
      return this;
    }
    this.button.onClick(cb);
    return this;
  }

  // analyzeMarkdownFormat(text: string): string {}

  showEditMenu(event: MouseEvent): void {
    console.log(this.menuOpened);
    this.menuOpened = !this.menuOpened;
    if (!this.menuOpened) {
      return;
    }
    this.menu = new Menu();
    this.menu.onHide(() => {
      this.menuOpened = false;
    });

    const sortButton = event.currentTarget;
    const currentTargetRect = (
      event.currentTarget as HTMLElement
    )?.getBoundingClientRect();
    const menuShowPoint = {
      x: currentTargetRect.left - 6,
      y: currentTargetRect.bottom + 6,
    };
    for (let a = 0; a < this.dropdownOptions?.length; a++) {
      this.menu.addItem((item) => {
        item
          .setIcon("zap")
          .setTitle(this.dropdownOptions[a])
          .onClick(() => {
            console.log("Hellow");
          });
      });
    }
    this.menu.setParentElement(sortButton).showAtPosition(menuShowPoint);
  }

  then(cb: (component: this) => any): this {
    cb(this);
    return this;
  }
}

export class ToolBar extends Component implements ToolBarDef {
  dom: HTMLElement;
  smallBtnContainer: HTMLElement;

  constructor(container: HTMLElement) {
    super();
    this.dom = container.createDiv(
      { cls: "cm-mini-toolbar" },
      (el) => (el.style.position = "absolute"),
    );
    this.smallBtnContainer = this.dom;
  }

  addSmallButton(cb: (button: SmallButton) => any): this {
    cb(new SmallButton(this.smallBtnContainer));
    return this;
  }

  unloading: boolean = false;

  hide() {
    this.unload();
    if (this.unloading) return this;
    this.unloading = true;
    this.dom.detach();
    this.unloading = false;
    return this;
  }
}
