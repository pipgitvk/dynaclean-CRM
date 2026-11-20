export function repOptions(reps, emptyLabel) {
  return [
    { value: "", label: emptyLabel },
    ...reps.map((r) => ({ value: r, label: r })),
  ];
}

export function repOptionsWithCounts(countRows, emptyLabel) {
  return [
    { value: "", label: emptyLabel },
    ...countRows.map(({ rep, count }) => ({
      value: rep,
      label: `${rep} (${Number(count || 0).toLocaleString()})`,
    })),
  ];
}

/** Full rep list with counts; missing reps show (0). Sorted by count desc, then name. */
export function repOptionsWithCountsMerged(repList, countRows, emptyLabel) {
  const countByRep = new Map(
    (countRows || []).map(({ rep, count }) => [String(rep).trim(), Number(count) || 0]),
  );
  const reps = new Set();
  for (const r of repList || []) {
    const name = String(r || "").trim();
    if (name) reps.add(name);
  }
  for (const { rep } of countRows || []) {
    const name = String(rep || "").trim();
    if (name) reps.add(name);
  }
  const sorted = [...reps].sort((a, b) => {
    const ca = countByRep.get(a) ?? 0;
    const cb = countByRep.get(b) ?? 0;
    if (cb !== ca) return cb - ca;
    return a.localeCompare(b, undefined, { sensitivity: "base" });
  });
  return [
    { value: "", label: emptyLabel },
    ...sorted.map((rep) => ({
      value: rep,
      label: `${rep} (${(countByRep.get(rep) ?? 0).toLocaleString()})`,
    })),
  ];
}