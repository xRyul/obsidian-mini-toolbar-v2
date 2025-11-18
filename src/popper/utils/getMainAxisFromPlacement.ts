import { Axis, Placement } from "@floating-ui/core/src/types";

import { getBasePlacement } from "./getBasePlacement";

export const getMainAxisFromPlacement = (placement: Placement): Axis => {
  return ["top", "bottom"].includes(getBasePlacement(placement)) ? "x" : "y";
};
