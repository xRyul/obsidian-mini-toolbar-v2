import {
  EditorView,
  PluginValue,
  ViewPlugin,
  ViewUpdate,
} from "@codemirror/view";
import { ClientRectObject } from "@floating-ui/core";
import { computePosition, flip, offset } from "@floating-ui/dom";
import equal from "fast-deep-equal";
import {
  editorInfoField,
  editorViewField,
  EventRef,
  Menu,
  Platform,
} from "obsidian";

import { ToolBar } from "../modules/toolbar";
import { tooltipConfig } from "./config";
import { MiniToolbarEvtName, Tooltip } from "./define";
import { showTooltip } from "./index";
import { shift } from "./shift";

const getRectFromXY = (x = 0, y = 0): ClientRectObject => ({
  width: 0,
  height: 0,
  top: y,
  left: x,
  bottom: y,
  right: x,
  x,
  y,
});
type VirtualElement = {
  getBoundingClientRect(): ClientRectObject;
  contextElement?: Element;
};

type Rect = { left: number; right: number; top: number; bottom: number };
const getRectFromPosCoords = (
  start: Rect | null,
  end?: Rect | null,
): ClientRectObject | null => {
  if (!start) return null;
  let rect = {
    left: start.left,
    right: start.right,
    top: start.top,
    bottom: start.bottom,
    width: 0,
    height: start.bottom - start.top,
    x: start.top,
    y: start.left,
  };
  if (end) rect.width = Math.abs(end.left - start.left);
  return rect;
};
const initialRect = getRectFromXY();

class ViewPluginClass implements PluginValue {
  containerEl = this.view.dom;
  virtualEl: VirtualElement & { rect: ClientRectObject };
  toolbar: ToolBar | null = null;

  get workspace() {
    return this.view.state.field(editorInfoField).app.workspace;
  }

  tooltipInfo: Tooltip | null;

  inView = true;

  defaultPlacement = this.view.state.facet(tooltipConfig).defaultPlacement;
  editorMenu: {
    evtRef: EventRef;
    currMenu: Menu | null;
  };

  constructor(readonly view: EditorView) {
    this.tooltipInfo = view.state.facet(showTooltip);
    this.virtualEl = {
      rect: initialRect,
      getBoundingClientRect() {
        return this.rect;
      },
      // contextElement: this.view.scrollDOM,
    };
    this.maybeMeasure();
    this.editorMenu = {
      currMenu: null,
      evtRef: view.state.field(editorInfoField),
    };
  }

  shouldRemoveToolbar(input?: Tooltip | null): boolean {
    const info = input ?? this.tooltipInfo;
    // if without selection and no menu present
    return !(info?.end || this.editorMenu.currMenu);
  }

  onEditorMenuOpen(menu: Menu) {
    if (!this.editorMenu.currMenu) {
      this.editorMenu.currMenu = menu;
      if (this.cachedRefRect) this.computePosition(this.cachedRefRect);
      else this.maybeMeasure();
      if (!Platform.isMacOS && this.tooltipInfo) {
        this.createToolbar();
        this.maybeMeasure();
      }
    }
  }

  onEditorMenuClose(menu: Menu) {
    if (this.editorMenu.currMenu === menu) {
      this.editorMenu.currMenu = null;
    }
    if (!Platform.isMacOS && this.toolbar && this.shouldRemoveToolbar()) {
      this.removeToolbar();
    }
  }

  createToolbar(input?: Tooltip): void {
    const info = input ?? this.tooltipInfo;
    if (!info) return;
    this.removeToolbar();
    let toolbar = info.create(this.containerEl);
    const view = this.view.state.field(editorInfoField);
    if (!view || !view?.editor) return;
    const from = view.editor.offsetToPos(info.start);
    const to = info.end ? view.editor.offsetToPos(info.end) : from;
    this.workspace.trigger(
      MiniToolbarEvtName,
      toolbar,
      { from, to },
      view.editor,
      view,
    );
    this.toolbar = toolbar;
  }

  removeToolbar(): void {
    if (!this.toolbar) return;
    this.toolbar.hide();
    this.toolbar = null;
  }

  update(update: ViewUpdate) {
    let input = update.state.facet(showTooltip);
    let updated = input !== this.tooltipInfo && !equal(input, this.tooltipInfo);
    if (updated) {
      this.tooltipInfo = input;
      if (this.shouldRemoveToolbar()) {
        this.removeToolbar();
      } else if (input && !this.toolbar) {
        this.createToolbar(input);
      }
    }
    let shouldMeasure = updated || update.geometryChanged;
    let newConfig = update.state.facet(tooltipConfig);
    if (newConfig.defaultPlacement != this.defaultPlacement) {
      newConfig.defaultPlacement = this.defaultPlacement;
    }
    if (shouldMeasure) this.maybeMeasure();
  }

  destroy(): void {
    this.editorMenu.currMenu = null;
    this.removeToolbar();
    this.toolbar = null;
    this.view.state
      .field(editorInfoField)
      .app.workspace.offref(this.editorMenu.evtRef);
  }

  cachedRefRect: ClientRectObject | null = null;
  readFromDOM = (): void => {
    if (this.tooltipInfo) {
      let { start, end } = this.tooltipInfo;
      if (end && start === end) {
        end = undefined;
      }
      const startRect = this.view.coordsAtPos(start);
      let endRect = end ? this.view.coordsAtPos(end) : null;
      // if start and end are not visually on the same line,
      // endRect will be set to right boundary of contentDOM
      // at the same visuall line
      if (startRect && endRect && startRect.top !== endRect.top) {
        const contentRect = this.view.contentDOM.getBoundingClientRect();
        endRect = {
          left: contentRect.right,
          right: contentRect.right,
          top: startRect.top,
          bottom: startRect.bottom,
        };
      }
      const refRect = getRectFromPosCoords(startRect, endRect);
      if (refRect) {
        this.cachedRefRect = refRect;
        this.computePosition(refRect);
      }
    }
  };

  async computePosition(refRect: ClientRectObject): Promise<void> {
    if (!this.toolbar) return;
    this.virtualEl.rect = refRect;
    const { padding } = this.view.state.facet(tooltipConfig);
    const { x, y } = await computePosition(this.virtualEl, this.toolbar.dom, {
      placement: this.defaultPlacement,
      middleware: [
        offset({ mainAxis: 5 }),
        flip({ padding, boundary: this.view.scrollDOM }),
        shift({
          padding,
          boundary: this.view.scrollDOM,
          editorMenu: this.editorMenu.currMenu,
        }),
      ],
    });
    Object.assign(this.toolbar.dom.style, {
      top: "0",
      left: "0",
      transform: `translate(${Math.round(x)}px,${Math.round(y)}px)`,
    });
  }

  maybeMeasure() {
    if (this.view.inView && this.toolbar)
      this.view.requestMeasure({ read: this.readFromDOM });
    if (this.inView != this.view.inView) {
      this.inView = this.view.inView;
      if (!this.inView) {
      }
    }
  }
}

const tooltipPlugin = ViewPlugin.fromClass(ViewPluginClass, {
  eventHandlers: {
    scroll() {
      this.maybeMeasure();
    },
  },
});
export default tooltipPlugin;
