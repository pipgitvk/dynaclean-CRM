import PaymentDeductionsReport from "@/components/reports/PaymentDeductionsReport";

export default function DeductionsReportPage() {
  return (
    <PaymentDeductionsReport paymentPendingPath="/accounts-dashboard/reports/payment-pending" />
  );
}
