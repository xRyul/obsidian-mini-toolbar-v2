import { Extension, Facet } from "@codemirror/state";
import { Padding, Placement } from "@floating-ui/core";

type TooltipConfig = {
  defaultPlacement: Placement;
  padding: Padding | undefined;
};
export const tooltipConfig = Facet.define<
  Partial<TooltipConfig>,
  TooltipConfig
>({
  combine: (values) => ({
    defaultPlacement:
      values.find((conf) => conf.defaultPlacement)?.defaultPlacement || "top",
    padding: values.find((conf) => conf.padding)?.padding || 8,
  }),
});
/// Return an extension that configures tooltip behavior.

export const tooltips = (
  config: {
    /**
     * The default placement of the tooltip
     */
    defaultPlacement?: Placement;
  } = {},
): Extension => tooltipConfig.of(config);
