

export function getGradientColor(hours) {
  // Softer, lighter shades instead of harsh primaries
  const minColor = [255, 102, 102];   // Soft Red (instead of #FF0000)
  const midColor = [255, 204, 102];   // Soft Orange (instead of #FFA500)
  const maxColor = [102, 204, 153];   // Soft Green (instead of #008000)

  if (hours === null) return `rgb(${midColor.join(", ")})`;
  if (hours < -3) return `rgb(${minColor.join(", ")})`;

  const normalize = (val, min, max) => (val - min) / (max - min);
  const interpolate = (a, b, t) => a + t * (b - a);

  let r, g, b;

  if (hours < 0) {
    // Interpolate between soft red and soft orange
    const t = normalize(hours, -3, 0);
    r = interpolate(minColor[0], midColor[0], t);
    g = interpolate(minColor[1], midColor[1], t);
    b = interpolate(minColor[2], midColor[2], t);
  } else {
    // Interpolate between soft orange and soft green
    const t = normalize(hours, 0, 6);
    r = interpolate(midColor[0], maxColor[0], t);
    g = interpolate(midColor[1], maxColor[1], t);
    b = interpolate(midColor[2], maxColor[2], t);
  }

  return `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`;
}
