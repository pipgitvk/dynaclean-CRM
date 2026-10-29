import CreditNotesListPage from "@/components/credit-notes/CreditNotesListPage";

export default function AdminCreditNotesListPage() {
  return (
    <CreditNotesListPage
      viewHrefBase="/admin-dashboard/credit-notes"
      orderHrefBase="/admin-dashboard/order"
    />
  );
}
