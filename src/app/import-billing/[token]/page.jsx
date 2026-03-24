export const dynamic = "force-dynamic";

import PublicBillingFormClient from "./PublicBillingFormClient";

export default async function ImportBillingPage({ params }) {
  const { token } = await params;
  return <PublicBillingFormClient token={token} />;
}
