import { checkMetaBackfillAccess } from "@/lib/checkMetaBackfillAccess";

/** Meta credentials + related lead tools — same module rules as ads-management / meta-backfill. */
export async function checkMetaCredentialsAccess() {
  return checkMetaBackfillAccess();
}
