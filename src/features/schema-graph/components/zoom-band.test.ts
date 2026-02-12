import { describe, expect, it } from "vitest";
import {
  getZoomBand,
  isCompactForZoomBand,
  isFocusModerateCompactForZoomBand,
} from "./zoom-band";

describe("zoom bands", () => {
  it("assigns expected zoom bands around thresholds", () => {
    expect(getZoomBand(0.29)).toBe("forceCompact");
    expect(getZoomBand(0.3)).toBe("focusCompact");
    expect(getZoomBand(0.39)).toBe("focusCompact");
    expect(getZoomBand(0.4)).toBe("normalCompact");
    expect(getZoomBand(0.59)).toBe("normalCompact");
    expect(getZoomBand(0.6)).toBe("expanded");
    expect(getZoomBand(1)).toBe("expanded");
  });

  it("keeps non-focus compact behavior by zoom band", () => {
    expect(isCompactForZoomBand("forceCompact")).toBe(true);
    expect(isCompactForZoomBand("focusCompact")).toBe(true);
    expect(isCompactForZoomBand("normalCompact")).toBe(true);
    expect(isCompactForZoomBand("expanded")).toBe(false);
  });

  it("keeps moderate-focus compact behavior by zoom band", () => {
    expect(isFocusModerateCompactForZoomBand("forceCompact")).toBe(true);
    expect(isFocusModerateCompactForZoomBand("focusCompact")).toBe(true);
    expect(isFocusModerateCompactForZoomBand("normalCompact")).toBe(false);
    expect(isFocusModerateCompactForZoomBand("expanded")).toBe(false);
  });
});
