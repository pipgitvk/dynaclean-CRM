/**
 * Premium card backgrounds: multi-stop linear gradients by hours until follow-up.
 * Warmer / deeper = sooner; cooler / fresher = later.
 * @param {number|null} hours (eventTime - now) / 3600000
 * @returns {string} CSS `linear-gradient(...)` or solid fallback
 */
export function getGradientColor(hours) {
  const clamp01 = (t) => Math.max(0, Math.min(1, t));
  const lerp = (a, b, t) => a + t * (b - a);
  const rgb = (r, g, b) => `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`;

  /** 145deg matches dashboard cards — three stops for depth */
  const grad = (c0, c1, c2) =>
    `linear-gradient(145deg, ${rgb(...c0)} 0%, ${rgb(...c1)} 48%, ${rgb(...c2)} 100%)`;

  if (hours === null || Number.isNaN(hours)) {
    return grad(
      [71, 85, 105],
      [100, 116, 139],
      [148, 163, 184]
    );
  }

  // Overdue — deep wine → rose (high contrast with white text)
  if (hours < 0) {
    return grad(
      [52, 14, 36],
      [135, 38, 72],
      [198, 88, 108]
    );
  }

  // 0–48h — ruby → rose (closest = deeper)
  if (hours <= 48) {
    const t = hours / 48;
    const urgent = [
      [118, 24, 52],
      [196, 58, 88],
      [232, 120, 132],
    ];
    const softer = [
      [168, 52, 78],
      [220, 110, 118],
      [245, 175, 168],
    ];
    return grad(
      [
        lerp(urgent[0][0], softer[0][0], t),
        lerp(urgent[0][1], softer[0][1], t),
        lerp(urgent[0][2], softer[0][2], t),
      ],
      [
        lerp(urgent[1][0], softer[1][0], t),
        lerp(urgent[1][1], softer[1][1], t),
        lerp(urgent[1][2], softer[1][2], t),
      ],
      [
        lerp(urgent[2][0], softer[2][0], t),
        lerp(urgent[2][1], softer[2][1], t),
        lerp(urgent[2][2], softer[2][2], t),
      ]
    );
  }

  // 48h–7d — coral → amber / honey
  if (hours <= 168) {
    const t = (hours - 48) / 120;
    const warm = [
      [196, 85, 52],
      [235, 150, 58],
      [252, 205, 118],
    ];
    const gold = [
      [210, 130, 45],
      [245, 190, 85],
      [255, 228, 160],
    ];
    return grad(
      [
        lerp(warm[0][0], gold[0][0], t),
        lerp(warm[0][1], gold[0][1], t),
        lerp(warm[0][2], gold[0][2], t),
      ],
      [
        lerp(warm[1][0], gold[1][0], t),
        lerp(warm[1][1], gold[1][1], t),
        lerp(warm[1][2], gold[1][2], t),
      ],
      [
        lerp(warm[2][0], gold[2][0], t),
        lerp(warm[2][1], gold[2][1], t),
        lerp(warm[2][2], gold[2][2], t),
      ]
    );
  }

  // 7d+ — forest → mint → sea glass
  const t = clamp01((hours - 168) / (24 * 14));
  const fresh = [
    [22, 110, 95],
    [52, 160, 125],
    [130, 215, 185],
  ];
  const calm = [
    [35, 125, 115],
    [85, 185, 155],
    [175, 230, 210],
  ];
  return grad(
    [
      lerp(fresh[0][0], calm[0][0], t),
      lerp(fresh[0][1], calm[0][1], t),
      lerp(fresh[0][2], calm[0][2], t),
    ],
    [
      lerp(fresh[1][0], calm[1][0], t),
      lerp(fresh[1][1], calm[1][1], t),
      lerp(fresh[1][2], calm[1][2], t),
    ],
    [
      lerp(fresh[2][0], calm[2][0], t),
      lerp(fresh[2][1], calm[2][1], t),
      lerp(fresh[2][2], calm[2][2], t),
    ]
  );
}
