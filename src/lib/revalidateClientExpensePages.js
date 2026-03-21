import { revalidatePath } from "next/cache";

/** Call after statements (or anything) mutates client_expenses.amount so RSC pages show fresh totals. */
export function revalidateClientExpensePages(expenseIds = []) {
  try {
    revalidatePath("/admin-dashboard/client-expenses");
    revalidatePath("/admin-dashboard/client-expenses/cards");
    revalidatePath("/admin-dashboard/client-expenses/sub-head-cards");
    const seen = new Set();
    for (const raw of expenseIds) {
      const id = Number(raw);
      if (!Number.isFinite(id) || id < 1 || seen.has(id)) continue;
      seen.add(id);
      revalidatePath(`/admin-dashboard/client-expenses/${id}`);
    }
  } catch (e) {
    console.warn("[revalidateClientExpensePages]", e?.message || e);
  }
}
