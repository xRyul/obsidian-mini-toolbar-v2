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
  NOTION_TEXT_COLOR_NAMES,
  setTextColorByName,
  NOTION_TEXT_COLOR_MAP,
  NOTION_BG_COLOR_NAMES,
  NOTION_BG_COLOR_MAP,
  setBgColorByName,
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
      )
      // Text color dropdown (Notion-like colors)
      .addSmallButton((btn) =>
        btn
          .setDropdownIcon("palette")
          .setTooltip("Text color")
          .setOptionsList(NOTION_TEXT_COLOR_NAMES)
          .setOnSelectOption((name) => setTextColorByName(state, name))
          .setOnSelectBgOption((name) => setBgColorByName(state, name))
          // onClick is required to attach the dropdown handler
          .onClick(() => {}),
      );

    // Highlighter button for multi-line selections removed per user request
    // Previously:
    // if (isMultiLineSelection) {
    //   toolbar.addSmallButton((btn) =>
    //     btn.setIcon("highlighter").onClick(() => markText(app)),
    //   );
    // }

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
  onSelectOption: ((title: string) => void) | null = null;
  onSelectBgOption: ((title: string) => void) | null = null;
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
    const textDiv = this.button.buttonEl.createDiv("mini-toolbar-v2-text");
    const iconDiv = this.button.buttonEl.createDiv(
      "mini-toolbar-v2-icon-with-text",
    );
    setIcon(iconDiv, "chevron-down");

    const linePos = state.doc.lineAt(state.selection.ranges[0].from)?.from;
    let syntaxNode = syntaxTree(state).resolveInner(linePos + 1);
    // @ts-ignore
    let nodeProps: string = syntaxNode.type.prop(tokenClassNodeProp);
    textDiv.setText(this.detectFormat(nodeProps, syntaxNode) || "Text");
    return this;
  }

  setDropdownIcon(iconId: string = "highlighter"): this {
    const highlightIconDiv = this.button.buttonEl.createDiv(
      "mini-toolbar-v2-highlight-icon",
    );
    const iconDiv = this.button.buttonEl.createDiv(
      "mini-toolbar-v2-icon-with-icon",
    );
    setIcon(highlightIconDiv, iconId);
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

  setOnSelectOption(handler: (title: string) => void): this {
    this.onSelectOption = handler;
    return this;
  }

  setOnSelectBgOption(handler: (title: string) => void): this {
    this.onSelectBgOption = handler;
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

    // Customize menu DOM to mimic Notion color picker
    const menuEl = (this.menu as any).dom as HTMLElement | undefined;
    if (menuEl) {
      (menuEl as any).addClass?.("mini-toolbar-v2-color-menu");
      // Defer grid/header decoration until after items are rendered
    }

    const sortButton = event.currentTarget;
    const currentTargetRect = (
      event.currentTarget as HTMLElement
    )?.getBoundingClientRect();
    const menuShowPoint = {
      x: currentTargetRect.left - 6,
      y: currentTargetRect.bottom + 6,
    };
    // Text color items
    for (let a = 0; a < this.dropdownOptions?.length; a++) {
      const name = this.dropdownOptions[a];
      const colorHex =
        name === "Default"
          ? "var(--text-normal)"
          : NOTION_TEXT_COLOR_MAP[name as keyof typeof NOTION_TEXT_COLOR_MAP];
      this.menu.addItem((item) => {
        item.setTitle("A").onClick(() => {
          this.onSelectOption?.(name);
        });
        const tooltip = name === "Default" ? "Default" : `${name} text`;
        const itemEl = (item as any).dom as HTMLElement | undefined;
        itemEl?.setAttr?.("title", tooltip);
        itemEl?.setAttr?.("data-color-kind", "text");
        itemEl?.addClass?.("mini-toolbar-v2-color-item");
        const titleEl = itemEl?.querySelector?.(
          ".menu-item-title",
        ) as HTMLElement | undefined;
        if (titleEl) {
          titleEl.style.color = `${colorHex}`;
        }
      });
    }

    // Visual separator between sections
    this.menu.addSeparator();

    // Background highlight items
    for (let b = 0; b < NOTION_BG_COLOR_NAMES.length; b++) {
      const name = NOTION_BG_COLOR_NAMES[b];
      const colorValue = name === "Default" ? "transparent" : `var(--mtv2-bg-${name.toLowerCase()})`;
      this.menu.addItem((item) => {
        item.setTitle("A").onClick(() => {
          this.onSelectBgOption?.(name);
        });
        const tooltip = name === "Default" ? "Default background" : `${name} background`;
        const itemEl = (item as any).dom as HTMLElement | undefined;
        itemEl?.setAttr?.("title", tooltip);
        itemEl?.setAttr?.("data-color-kind", "background");
        itemEl?.addClass?.("mini-toolbar-v2-color-item");
        const titleEl = itemEl?.querySelector?.(
          ".menu-item-title",
        ) as HTMLElement | undefined;
        if (titleEl) {
          if (colorValue === "transparent") {
            titleEl.style.removeProperty("background-color");
          } else {
            titleEl.style.backgroundColor = colorValue as any;
          }
          // Keep text legible against light/dark tints
          titleEl.style.color = `var(--text-normal)`;
        }
      });
    }

    this.menu.setParentElement(sortButton).showAtPosition(menuShowPoint);

    // Decorate once DOM is fully built
    requestAnimationFrame(() => {
      const menuEl = (this.menu as any)?.dom as HTMLElement | undefined;
      if (!menuEl) return;
      const scrollerEl =
        (menuEl.querySelector(".menu-scroller") as HTMLElement | null) ||
        (menuEl.querySelector(".menu-scroll") as HTMLElement | null) ||
        menuEl;

      // Try to split items into two groups (text/background)
      let groups = Array.from(scrollerEl.querySelectorAll<HTMLElement>(".menu-group"));

      if (groups.length === 1) {
        // Create a second group and move background items into it
        const bgGroup = scrollerEl.createDiv({ cls: "menu-group" });
        const allItems = Array.from(groups[0].querySelectorAll<HTMLElement>(".menu-item"));
        for (const it of allItems) {
          const kind = (it as any).getAttr?.("data-color-kind") ?? it.getAttribute("data-color-kind");
          if (kind === "background") {
            bgGroup.appendChild(it);
          }
        }
        // Insert bg group after original
        groups[0].insertAdjacentElement("afterend", bgGroup);
        groups = [groups[0], bgGroup];
      }

      const [textGroup, bgGroup] = groups.length >= 2 ? groups : [groups[0], undefined as any];

      if (textGroup) {
        const textHeader = scrollerEl.createDiv({
          cls: "mini-toolbar-v2-color-header",
          text: "Text colour",
        });
        scrollerEl.insertBefore(textHeader, textGroup);
        // @ts-ignore
        textGroup.addClass?.("mini-toolbar-v2-color-grid");
      }
      if (bgGroup) {
        const bgHeader = scrollerEl.createDiv({
          cls: "mini-toolbar-v2-color-header",
          text: "Background",
        });
        scrollerEl.insertBefore(bgHeader, bgGroup);
        // @ts-ignore
        bgGroup.addClass?.("mini-toolbar-v2-color-grid");
      }
    });
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
      { cls: "cm-mini-toolbar-v2" },
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
