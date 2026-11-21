export const OPEN_INSTALLATION_MODEL_PILL_CLASSES = [
  "bg-violet-100 text-violet-800 border-violet-200/80",
  "bg-sky-100 text-sky-800 border-sky-200/80",
  "bg-emerald-100 text-emerald-800 border-emerald-200/80",
  "bg-amber-100 text-amber-900 border-amber-200/80",
  "bg-fuchsia-100 text-fuchsia-800 border-fuchsia-200/80",
  "bg-cyan-100 text-cyan-900 border-cyan-200/80",
];

export function openInstallationModelPillClass(model) {
  const s = String(model || "").trim();
  if (!s) return OPEN_INSTALLATION_MODEL_PILL_CLASSES[0];
  let h = 0;
  for (let i = 0; i < s.length; i += 1) {
    h = (h + s.charCodeAt(i) * (i + 1)) % OPEN_INSTALLATION_MODEL_PILL_CLASSES.length;
  }
  return OPEN_INSTALLATION_MODEL_PILL_CLASSES[h];
}