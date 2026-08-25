import PaymentDeductionsReport from "@/components/reports/PaymentDeductionsReport";

export default function DeductionsReportPage() {
  return (
    <PaymentDeductionsReport paymentPendingPath="/admin-dashboard/reports/payment-pending" />
  );
}
