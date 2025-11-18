import { Placement, Side } from "@floating-ui/core/src/types";

export const getBasePlacement = (placement: Placement): Side => {
  return placement.split("-")[0] as Side;
};
