import CreditNotesListPage from "@/components/credit-notes/CreditNotesListPage";

export default function AccountsCreditNotesPage() {
  return (
    <CreditNotesListPage
      viewHrefBase="/accounts-dashboard/credit-notes"
      orderHrefBase="/accounts-dashboard/order"
    />
  );
}
