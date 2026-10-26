export const PARTY_PAYMENT_STATUSES = [
  "un-utilize",
  "partial-utilize",
  "utilize",
];

function toMoney(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return 0;
  return Number(v.toFixed(2));
}

/** From In vs Out: un-utilize | partial-utilize | utilize */
export function derivePartyPaymentStatus(amountIn, amountOut) {
  const inAmt = toMoney(amountIn);
  const out = toMoney(amountOut);
  if (inAmt <= 0) return "un-utilize";
  if (out <= 0) return "un-utilize";
  if (out >= inAmt - 0.009) return "utilize";
  return "partial-utilize";
}

export function normalizePartyPaymentAmounts(body) {
  const amount_in = toMoney(body.amount_in);
  const amount_out = toMoney(body.amount_out);
  const balance = toMoney(amount_in - amount_out);
  const status = derivePartyPaymentStatus(amount_in, amount_out);

  return {
    amount_in,
    amount_out,
    balance,
    status,
  };
}

export function partyPaymentStatusLabel(status) {
  const s = String(status || "").trim();
  if (s === "utilize") return "Utilize";
  if (s === "partial-utilize") return "Partial-utilize";
  return "Un-utilize";
}
