import { Facet } from "@codemirror/state";

import { Tooltip } from "./define";
import tooltipPlugin from "./view-plugin";

/// Behavior by which an extension can provide a tooltip to be shown.
const showTooltip = Facet.define<Tooltip | null, Tooltip | null>({
  enables: [tooltipPlugin],
  combine: (vals) => vals.filter((v) => v != null).first() ?? null,
});
export { tooltips } from "./config";
export { showTooltip, Tooltip };
