"use client";

import PaymentTable from "@/components/manual-payments/PaymentTable";

export default function AccountsManualPaymentsTable(props) {
    return <PaymentTable {...props} editBasePath="/accounts-dashboard/manual-payments" />;
}
