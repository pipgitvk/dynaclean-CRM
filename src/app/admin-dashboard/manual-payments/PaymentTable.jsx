"use client";

import PaymentTable from "@/components/manual-payments/PaymentTable";

export default function AdminManualPaymentsTable(props) {
    return <PaymentTable {...props} editBasePath="/admin-dashboard/manual-payments" />;
}
