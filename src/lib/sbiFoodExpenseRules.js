/** SBI allowances per 24-hour period (per completion task date). */
export const SBI_FOOD_MAX_AMOUNT = 300;
export const SBI_HOTEL_MAX_AMOUNT = 750;

export function getSbiFoodAmountError(mealsCost) {
  const amount = Number(mealsCost);
  if (!Number.isFinite(amount) || amount <= 0) {
    return "Please enter a valid food cost.";
  }
  if (amount > SBI_FOOD_MAX_AMOUNT) {
    return `Food allowance is ₹${SBI_FOOD_MAX_AMOUNT} per 24 hours — amount cannot exceed ₹${SBI_FOOD_MAX_AMOUNT}.`;
  }
  return null;
}

/**
 * @param {number} mealsCost - New claim amount
 * @param {number} existingTotalForDay - Sum of food claims on same TravelDate for this user
 * @returns {string|null}
 */
export function getSbiFoodDailyCapError(mealsCost, existingTotalForDay = 0) {
  const base = getSbiFoodAmountError(mealsCost);
  if (base) return base;

  const amount = Number(mealsCost);
  const existing = Number(existingTotalForDay) || 0;
  if (existing + amount > SBI_FOOD_MAX_AMOUNT) {
    const remaining = Math.max(0, SBI_FOOD_MAX_AMOUNT - existing);
    if (remaining <= 0) {
      return `Food allowance for this date is already ₹${SBI_FOOD_MAX_AMOUNT} (24-hour limit reached).`;
    }
    return `Food allowance is ₹${SBI_FOOD_MAX_AMOUNT} per 24 hours. Already claimed ₹${existing} on this date — you can add up to ₹${remaining} more.`;
  }

  return null;
}

/** @deprecated Use getSbiFoodAmountError — kept for call sites passing travelDate */
export function getSbiFoodExpenseError({ mealsCost, existingTotalForDay }) {
  return getSbiFoodDailyCapError(mealsCost, existingTotalForDay);
}

export function getSbiHotelAmountError(hotelCost) {
  const amount = Number(hotelCost);
  if (!Number.isFinite(amount) || amount <= 0) {
    return "Please enter a valid hotel cost.";
  }
  if (amount > SBI_HOTEL_MAX_AMOUNT) {
    return `Hotel allowance is ₹${SBI_HOTEL_MAX_AMOUNT} per 24 hours — amount cannot exceed ₹${SBI_HOTEL_MAX_AMOUNT}.`;
  }
  return null;
}

export function getSbiHotelDailyCapError(hotelCost, existingTotalForDay = 0) {
  const base = getSbiHotelAmountError(hotelCost);
  if (base) return base;

  const amount = Number(hotelCost);
  const existing = Number(existingTotalForDay) || 0;
  if (existing + amount > SBI_HOTEL_MAX_AMOUNT) {
    const remaining = Math.max(0, SBI_HOTEL_MAX_AMOUNT - existing);
    if (remaining <= 0) {
      return `Hotel allowance for this date is already ₹${SBI_HOTEL_MAX_AMOUNT} (24-hour limit reached).`;
    }
    return `Hotel allowance is ₹${SBI_HOTEL_MAX_AMOUNT} per 24 hours. Already claimed ₹${existing} on this date — you can add up to ₹${remaining} more.`;
  }

  return null;
}

export function getSbiHotelExpenseError({ hotelCost, existingTotalForDay }) {
  return getSbiHotelDailyCapError(hotelCost, existingTotalForDay);
}