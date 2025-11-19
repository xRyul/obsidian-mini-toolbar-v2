import { Plugin } from "obsidian";

import {
  ColorRange,
  ColorStorage,
  createColorExtension,
  FileColorData,
  Range,
} from "./modules/colorRanges";
import { ToolBarExtension } from "./modules/toolbar";

export default class MiniToolbar extends Plugin {
  private colorData: Record<string, FileColorData> = {};
  private persistHandle: number | null = null;

  async onload() {
    console.log("loading MiniToolbar");

    // Load persisted color data from data.json
    const loaded = (await this.loadData()) as Record<
      string,
      FileColorData
    > | null;
    if (loaded && typeof loaded === "object") {
      this.colorData = loaded;
    }

    const storage: ColorStorage = {
      load: (path) => this.colorData[path],
      save: (path, data) => {
        this.colorData[path] = data;
        this.queuePersistence();
      },
    };

    const colorExtension = createColorExtension(storage);

    this.registerEditorExtension([
      ...ToolBarExtension(this.app),
      colorExtension,
    ]);

    // Reading mode: apply the same colors using a markdown postprocessor.
    this.registerMarkdownPostProcessor((el, ctx) => {
      // IMPORTANT: Do not touch Live Preview (editor) islands like tables.
      // They live under .markdown-source-view and mutating them breaks editing.
      if (el.closest(".markdown-source-view")) return;

      const data = this.colorData[ctx.sourcePath];
      if (!data) return;
      this.applyColorsToReadingView(el, data);
    });
  }

  private applyColorsToReadingView(
    containerEl: HTMLElement,
    data: FileColorData,
  ) {
    const textRanges = data.text ?? [];
    const bgRanges = data.bg ?? [];
    const underlineRanges: Range[] = data.underline ?? [];
    if (!textRanges.length && !bgRanges.length && !underlineRanges.length)
      return;

    const sortedText = sortRanges(textRanges);
    const sortedBg = sortRanges(bgRanges);
    const sortedUnderline = sortRanges(underlineRanges);
    const textCursor = new RangeCursor(sortedText);
    const bgCursor = new RangeCursor(sortedBg);
    const underlineCursor = new RangeCursor(sortedUnderline);

    const doc = containerEl.ownerDocument || document;
    const walker = doc.createTreeWalker(
      containerEl,
      NodeFilter.SHOW_TEXT,
      null,
    );

    let offset = 0;
    const isSkippable = (node: Node): boolean => {
      const parent = (node as HTMLElement).parentElement;
      if (!parent) return false;
      // Skip code blocks, inline code, and math blocks.
      return !!parent.closest(
        "code, pre, .math, .cm-inline-code, .cm-codeblock",
      );
    };

    const findColorAt = (ranges: ColorRange[], pos: number): string | null => {
      for (const r of ranges) {
        if (r.from <= pos && pos < r.to) return r.color;
      }
      return null;
    };
    const hasUnderlineAt = (ranges: Range[], pos: number): boolean => {
      for (const r of ranges) {
        if (r.from <= pos && pos < r.to) return true;
      }
      return false;
    };

    let current: Node | null;
    while ((current = walker.nextNode())) {
      const textNode = current as Text;
      const text = textNode.nodeValue ?? "";
      const start = offset;
      const end = start + text.length;
      offset = end;

      if (!text.length) continue;
      if (isSkippable(textNode)) continue;

      textCursor.advanceTo(start);
      bgCursor.advanceTo(start);
      underlineCursor.advanceTo(start);

      const boundaries = new Set<number>();
      boundaries.add(start);
      boundaries.add(end);
      textCursor.addBoundaries(boundaries, start, end);
      bgCursor.addBoundaries(boundaries, start, end);
      underlineCursor.addBoundaries(boundaries, start, end);

      if (boundaries.size === 2) continue;

      const sorted = Array.from(boundaries).sort((a, b) => a - b);

      const fragments: Node[] = [];
      for (let i = 0; i < sorted.length - 1; i++) {
        const segFrom = sorted[i];
        const segTo = sorted[i + 1];
        if (segFrom >= segTo) continue;

        const localFrom = segFrom - start;
        const localTo = segTo - start;
        const slice = text.slice(localFrom, localTo);
        if (!slice) continue;

        const textColor = textCursor.rangeAt(segFrom)?.color ?? null;
        const bgColor = bgCursor.rangeAt(segFrom)?.color ?? null;
        const underline = !!underlineCursor.rangeAt(segFrom);

        if (!textColor && !bgColor && !underline) {
          fragments.push(doc.createTextNode(slice));
        } else {
          const span = doc.createElement("span");
          if (textColor) span.style.color = textColor;
          if (bgColor) span.style.backgroundColor = bgColor;
          if (underline) span.style.textDecoration = "underline";
          span.textContent = slice;
          fragments.push(span);
        }
      }

      const parent = textNode.parentNode;
      if (!parent || !fragments.length) continue;
      for (const frag of fragments) {
        parent.insertBefore(frag, textNode);
      }
      parent.removeChild(textNode);
    }
  }

  private queuePersistence() {
    if (this.persistHandle) return;
    this.persistHandle = window.setTimeout(async () => {
      this.persistHandle = null;
      await this.saveData(this.colorData);
    }, 300);
  }

  async onunload() {
    if (this.persistHandle) {
      window.clearTimeout(this.persistHandle);
      this.persistHandle = null;
    }
    if (Object.keys(this.colorData).length) {
      await this.saveData(this.colorData);
    }
  }
}

type RangeLike = Range & { color?: string };

const sortRanges = <T extends RangeLike>(ranges: T[]): T[] =>
  ranges.length > 1 ? [...ranges].sort((a, b) => a.from - b.from) : ranges;

class RangeCursor<T extends RangeLike> {
  private index = 0;

  constructor(private readonly ranges: T[]) {}

  advanceTo(position: number) {
    while (
      this.index < this.ranges.length &&
      this.ranges[this.index].to <= position
    ) {
      this.index++;
    }
  }

  addBoundaries(target: Set<number>, start: number, end: number) {
    if (!this.ranges.length) return;
    let idx = this.index;
    if (idx > 0 && this.ranges[idx - 1].to > start) idx--;
    for (let i = idx; i < this.ranges.length; i++) {
      const range = this.ranges[i];
      if (range.from >= end) break;
      if (range.to > start) {
        target.add(Math.max(start, range.from));
        target.add(Math.min(end, range.to));
      }
    }
  }

  rangeAt(position: number): T | null {
    if (!this.ranges.length) return null;
    let idx = this.index;
    if (idx >= this.ranges.length) idx = this.ranges.length - 1;
    if (idx > 0 && this.ranges[idx - 1].to > position) idx--;
    for (let i = idx; i < this.ranges.length; i++) {
      const range = this.ranges[i];
      if (range.from > position) break;
      if (range.to > position) {
        this.index = i;
        return range;
      }
    }
    return null;
  }
}
