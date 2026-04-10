/**
 * Card background color from hours until next follow-up (positive = future).
 * Nearer date → darker red (urgent). Medium range → yellow. Far → green.
 * @param {number|null} hours (eventTime - now) / 3600000
 */
export function getGradientColor(hours) {
  if (hours === null || Number.isNaN(hours)) {
    return "rgb(186, 189, 194)";
  }

  const clamp01 = (t) => Math.max(0, Math.min(1, t));
  const lerp = (a, b, t) => a + t * (b - a);
  const rgb = (r, g, b) =>
    `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`;

  // Overdue: stay in dark red (more overdue → slightly deeper)
  if (hours < 0) {
    const t = clamp01(-hours / 96);
    const darkest = [92, 16, 24];
    const dark = [130, 28, 36];
    return rgb(
      lerp(darkest[0], dark[0], t),
      lerp(darkest[1], dark[1], t),
      lerp(darkest[2], dark[2], t)
    );
  }

  // 0–48h: dark red → lighter red (closest upcoming = darkest)
  if (hours <= 48) {
    const t = hours / 48;
    const darkRed = [118, 22, 32];
    const lightRed = [198, 78, 82];
    return rgb(
      lerp(darkRed[0], lightRed[0], t),
      lerp(darkRed[1], lightRed[1], t),
      lerp(darkRed[2], lightRed[2], t)
    );
  }

  // 48h–7d: red family → yellow
  if (hours <= 168) {
    const t = (hours - 48) / 120;
    const lightRed = [198, 78, 82];
    const yellow = [232, 188, 58];
    return rgb(
      lerp(lightRed[0], yellow[0], t),
      lerp(lightRed[1], yellow[1], t),
      lerp(lightRed[2], yellow[2], t)
    );
  }

  // 7d+: yellow → green (distance increases → greener)
  const t = clamp01((hours - 168) / (24 * 14));
  const yellow = [232, 188, 58];
  const green = [58, 142, 96];
  return rgb(
    lerp(yellow[0], green[0], t),
    lerp(yellow[1], green[1], t),
    lerp(yellow[2], green[2], t)
  );
}
