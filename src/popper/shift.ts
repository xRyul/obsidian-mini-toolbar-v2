import type { Options as DetectOverflowOptions } from "@floating-ui/core/src/detectOverflow";
import type {
  Coords,
  Middleware,
  MiddlewareArguments,
  Padding,
  Placement,
  Rect,
  Side,
} from "@floating-ui/core/src/types";
import { detectOverflow } from "@floating-ui/dom";
import { Menu } from "obsidian";

import { getBasePlacement } from "./utils/getBasePlacement";
import { getCrossAxis } from "./utils/getCrossAxis";
import { getMainAxisFromPlacement } from "./utils/getMainAxisFromPlacement";
import { within } from "./utils/within";

export type Options = {
  mainAxis: boolean;
  crossAxis: boolean;
  editorMenu: Menu | null;
  limiter: (middlewareArguments: MiddlewareArguments) => Coords;
};

const objectMap = <O extends Object, V>(
  obj: O,
  fn: <K extends keyof O>(val: O[K], key: K, index: number) => V,
): { [K in keyof O]: V } => {
  return Object.fromEntries(
    Object.entries(obj).map(([k, v], i) => [k, fn(v as any, k as any, i)]),
  ) as { [K in keyof O]: V };
};

const revertPadding = (padding: Padding | undefined): Padding | undefined => {
  if (padding === undefined) return padding;
  if (typeof padding === "number") return -padding;
  else {
    return objectMap(padding, (val) => (val !== undefined ? -val : val));
  }
};

export const shift = (
  options: Partial<Options & DetectOverflowOptions> = {},
): Middleware => ({
  name: "shift",
  fn: async (middlewareArguments: MiddlewareArguments) => {
    const { x, y, placement } = middlewareArguments;
    const {
      mainAxis: checkMainAxis = true,
      crossAxis: checkCrossAxis = false,
      limiter = ({ x, y }) => ({ x, y }),
      editorMenu,
      ...detectOverflowOptions
    } = options;

    const coords = { x, y };
    const overflow = await detectOverflow(
      middlewareArguments,
      detectOverflowOptions,
    );
    const mainAxis = getMainAxisFromPlacement(getBasePlacement(placement));
    const crossAxis = getCrossAxis(mainAxis);

    let mainAxisCoord = coords[mainAxis];
    let crossAxisCoord = coords[crossAxis];

    if (checkMainAxis) {
      const minSide = mainAxis === "y" ? "top" : "left";
      const maxSide = mainAxis === "y" ? "bottom" : "right";
      const min = mainAxisCoord + overflow[minSide];
      const max = mainAxisCoord - overflow[maxSide];
      if (editorMenu) {
        const overflowMenu = await detectOverflow(middlewareArguments, {
          ...detectOverflowOptions,
          boundary: editorMenu.dom,
          padding: revertPadding(detectOverflowOptions.padding),
        });

        const crossAxisProps: Side[] =
          crossAxis === "y" ? ["top", "bottom"] : ["left", "right"];
        // if overlap at corssAxis
        if (crossAxisProps.every((prop) => overflowMenu[prop] <= 0)) {
          const popperWidth = middlewareArguments.rects.floating.width;
          const minForMenu =
            mainAxisCoord + overflowMenu[minSide] - popperWidth;
          const maxForMenu =
            mainAxisCoord - overflowMenu[maxSide] + popperWidth;

          const minSideGap = Math.abs(
            overflow[minSide] - overflowMenu[minSide],
          );
          const maxSideGap = Math.abs(
            overflow[maxSide] - overflowMenu[maxSide],
          );

          // prefer placing menu left, if there is enough gap
          if (minSideGap >= popperWidth || maxSideGap < minSideGap) {
            mainAxisCoord = within(min, mainAxisCoord, minForMenu);
          } else {
            mainAxisCoord = within(maxForMenu, mainAxisCoord, max);
          }
        } else {
          mainAxisCoord = within(min, mainAxisCoord, max);
        }
      } else {
        mainAxisCoord = within(min, mainAxisCoord, max);
      }
    }

    if (checkCrossAxis) {
      const minSide = crossAxis === "y" ? "top" : "left";
      const maxSide = crossAxis === "y" ? "bottom" : "right";
      const min = crossAxisCoord + overflow[minSide];
      const max = crossAxisCoord - overflow[maxSide];

      crossAxisCoord = within(min, crossAxisCoord, max);
    }

    return limiter({
      ...middlewareArguments,
      [mainAxis]: mainAxisCoord,
      [crossAxis]: crossAxisCoord,
    });
  },
});

type LimitShiftOffset =
  | ((args: {
      placement: Placement;
      floating: Rect;
      reference: Rect;
    }) => number | { mainAxis?: number; crossAxis?: number })
  | number
  | { mainAxis?: number; crossAxis?: number };

export type LimitShiftOptions = {
  offset: LimitShiftOffset;
  mainAxis: boolean;
  crossAxis: boolean;
};

export const limitShift =
  (
    options: Partial<LimitShiftOptions> = {},
  ): ((middlewareArguments: MiddlewareArguments) => Coords) =>
  (middlewareArguments: MiddlewareArguments) => {
    const { x, y, placement, rects, middlewareData } = middlewareArguments;
    const {
      offset = 0,
      mainAxis: checkMainAxis = true,
      crossAxis: checkCrossAxis = true,
    } = options;

    const coords = { x, y };
    const mainAxis = getMainAxisFromPlacement(getBasePlacement(placement));
    const crossAxis = getCrossAxis(mainAxis);

    let mainAxisCoord = coords[mainAxis];
    let crossAxisCoord = coords[crossAxis];

    const rawOffset =
      typeof offset === "function" ? offset({ ...rects, placement }) : offset;
    const computedOffset =
      typeof rawOffset === "number"
        ? { mainAxis: rawOffset, crossAxis: 0 }
        : { mainAxis: 0, crossAxis: 0, ...rawOffset };

    if (checkMainAxis) {
      const len = mainAxis === "y" ? "height" : "width";
      const limitMin =
        rects.reference[mainAxis] -
        rects.floating[len] +
        computedOffset.mainAxis;
      const limitMax =
        rects.reference[mainAxis] +
        rects.reference[len] -
        computedOffset.mainAxis;

      if (mainAxisCoord < limitMin) {
        mainAxisCoord = limitMin;
      } else if (mainAxisCoord > limitMax) {
        mainAxisCoord = limitMax;
      }
    }

    if (checkCrossAxis) {
      const len = mainAxis === "y" ? "width" : "height";
      const limitMin =
        rects.reference[crossAxis] -
        rects.floating[len] -
        (middlewareData.offset?.[mainAxis] ?? 0) +
        computedOffset.crossAxis;
      const limitMax =
        rects.reference[crossAxis] +
        rects.reference[len] +
        (middlewareData.offset?.[mainAxis] ?? 0) +
        computedOffset.crossAxis;

      if (crossAxisCoord < limitMin) {
        crossAxisCoord = limitMin;
      } else if (crossAxisCoord > limitMax) {
        crossAxisCoord = limitMax;
      }
    }

    return {
      [mainAxis]: mainAxisCoord,
      [crossAxis]: crossAxisCoord,
    } as Coords;
  };
