"use client";

import PaymentTable from "@/components/manual-payments/PaymentTable";

export default function SalesManualPaymentsTable(props) {
    return <PaymentTable {...props} editBasePath="/sales-dashboard/manual-payments" />;
}
