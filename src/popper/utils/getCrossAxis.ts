import { Axis } from "@floating-ui/core/src/types";

export const getCrossAxis = (axis: Axis): Axis => {
  return axis === "x" ? "y" : "x";
};
