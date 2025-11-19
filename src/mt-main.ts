import { Plugin } from "obsidian";

import { ToolBarExtension } from "./modules/toolbar";
import {
  ColorRange,
  ColorStorage,
  createColorExtension,
  FileColorData,
  Range,
} from "./modules/colorRanges";

export default class MiniToolbar extends Plugin {
  private colorData: Record<string, FileColorData> = {};

  async onload() {
    console.log("loading MiniToolbar");

    // Load persisted color data from data.json
    const loaded = (await this.loadData()) as Record<string, FileColorData> | null;
    if (loaded && typeof loaded === "object") {
      this.colorData = loaded;
    }

    const storage: ColorStorage = {
      load: (path) => this.colorData[path],
      save: (path, data) => {
        this.colorData[path] = data;
        // Best-effort persistence; can be optimized with debouncing if needed.
        void this.saveData(this.colorData);
      },
    };

    const colorExtension = createColorExtension(storage);

    this.registerEditorExtension([
      ...ToolBarExtension(this.app),
      colorExtension,
    ]);

    // Reading mode: apply the same colors using a markdown postprocessor.
    this.registerMarkdownPostProcessor((el, ctx) => {
      const data = this.colorData[ctx.sourcePath];
      if (!data) return;
      this.applyColorsToReadingView(el, data);
    });
  }

  private applyColorsToReadingView(containerEl: HTMLElement, data: FileColorData) {
    const textRanges = data.text ?? [];
    const bgRanges = data.bg ?? [];
    const underlineRanges: Range[] = data.underline ?? [];
    if (!textRanges.length && !bgRanges.length && !underlineRanges.length) return;

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
      return !!parent.closest("code, pre, .math, .cm-inline-code, .cm-codeblock");
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

      const relevantText = textRanges.filter((r) => r.to > start && r.from < end);
      const relevantBg = bgRanges.filter((r) => r.to > start && r.from < end);
      const relevantUl = underlineRanges.filter((r) => r.to > start && r.from < end);
      if (!relevantText.length && !relevantBg.length && !relevantUl.length) continue;

      const boundaries = new Set<number>();
      boundaries.add(start);
      boundaries.add(end);
      for (const r of relevantText) {
        boundaries.add(Math.max(start, r.from));
        boundaries.add(Math.min(end, r.to));
      }
      for (const r of relevantBg) {
        boundaries.add(Math.max(start, r.from));
        boundaries.add(Math.min(end, r.to));
      }
      for (const r of relevantUl) {
        boundaries.add(Math.max(start, r.from));
        boundaries.add(Math.min(end, r.to));
      }
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

        const textColor = findColorAt(relevantText, segFrom);
        const bgColor = findColorAt(relevantBg, segFrom);
        const underline = hasUnderlineAt(relevantUl, segFrom);

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
}
