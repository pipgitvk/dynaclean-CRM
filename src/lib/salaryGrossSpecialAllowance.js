/** Whole rupees only — decimals drop (e.g. 1166.666 → 1166). */
export function floorInr(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return 0;
  return Math.floor(x);
}

/** Parse "18676", "18,676", 18676.5 from DB/forms — avoids NaN from commas. */
export function parseRupeeAmount(v) {
  if (v == null || v === "") return null;
  const s = String(v).replace(/,/g, "").trim();
  if (s === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/**
 * Gross used for Basic/HRA/special split.
 * Component sum (Basic+HRA+transport+medical+special+bonus) wins when > 0 so
 * payroll matches the actual structure lines — avoids stale manual gross_salary
 * (e.g. 18666) while components total 18676.
 * If sum is 0, falls back to manual gross_salary (gross-only structures).
 */
export function getEffectiveGrossSalary(structure) {
  if (!structure) return null;
  const sum =
    floorInr(structure.basic_salary) +
    floorInr(structure.hra) +
    floorInr(structure.transport_allowance) +
    floorInr(structure.medical_allowance) +
    floorInr(structure.special_allowance) +
    floorInr(structure.bonus);
  if (sum > 0) return sum;

  const manual = parseRupeeAmount(structure.gross_salary);
  if (manual != null && manual > 0) return floorInr(manual);
  return null;
}

/**
 * When gross_salary (monthly salary total) is set:
 * - Gross is taken as whole rupees (no paise).
 * - Full-month Basic = floor(gross / 2) — e.g. 18676 → 9338 (not 9333 from round(0.5*G)).
 * - Full-month HRA = floor(gross / 4) — 25% of gross in whole rupees.
 * Then pro-rate Basic & HRA by present_days / working_days.
 *
 * Returns null if gross is not a positive number.
 */
export function computeBasicHraFromGrossSalary({
  grossSalary,
  workingDays,
  presentDays,
}) {
  const G = Number(grossSalary);
  if (
    grossSalary === null ||
    grossSalary === undefined ||
    grossSalary === "" ||
    !Number.isFinite(G) ||
    G <= 0
  ) {
    return null;
  }

  const g = floorInr(G);
  const wd = Math.max(1, Number(workingDays) || 0);
  const pd = Math.max(0, Number(presentDays) || 0);
  const perDayGross = Math.floor(g / wd);
  // Full attendance should always pay full gross (avoid 20 rupee loss on 35000/30).
  const payableGross = pd >= wd ? g : perDayGross * pd;
  const basicSalary = Math.floor(payableGross / 2);
  const hra = Math.floor(payableGross / 4);
  const fullBasic = Math.floor(g / 2);
  const fullHra = Math.floor(g / 4);
  return { basicSalary, hra, fullBasic, fullHra, payableGross, perDayGross };
}

/**
 * When salary structure has gross_salary, special allowance is the remainder of gross
 * after pro‑rated basic+HRA and fixed transport+medical, minus LOP at per‑day gross rate.
 *
 * special = gross - (basic + hra + transport + medical) - absentDays * (gross / workingDays)
 *
 * If gross is not set, returns fallbackStructureSpecial (structure’s stored special).
 */
export function computeSpecialAllowanceFromGross({
  grossSalary,
  workingDays,
  presentDays,
  basicSalary,
  hra,
  transportAllowance,
  medicalAllowance,
  fallbackStructureSpecial,
}) {
  const gross = Number(grossSalary);
  if (
    grossSalary === null ||
    grossSalary === undefined ||
    grossSalary === "" ||
    !Number.isFinite(gross) ||
    gross <= 0
  ) {
    return Math.max(0, floorInr(fallbackStructureSpecial));
  }

  const g = floorInr(gross);
  const wd = Math.max(1, Number(workingDays) || 0);
  const pd = Math.max(0, Number(presentDays) || 0);

  const totalAddition =
    floorInr(basicSalary) +
    floorInr(hra) +
    floorInr(transportAllowance) +
    floorInr(medicalAllowance);

  const perDayGross = Math.floor(g / wd);
  // Lock payable gross to per-day method:
  // payableGross = floor(gross / workingDays) * presentDays
  // so 35000/30 => 1166 and 1166*16 => 18656.
  // For full attendance, pay exact monthly gross.
  const payableGross = pd >= wd ? g : perDayGross * pd;
  const raw = payableGross - totalAddition;
  return Math.max(0, floorInr(raw));
}
