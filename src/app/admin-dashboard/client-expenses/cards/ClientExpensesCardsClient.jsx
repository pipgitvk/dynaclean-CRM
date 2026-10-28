import ClientExpensesCardsClient from "@/components/client-expenses/ClientExpensesCardsClient";

export default function AdminClientExpensesCardsClient(props) {
  return <ClientExpensesCardsClient {...props} dashboardBase="admin-dashboard" />;
}
