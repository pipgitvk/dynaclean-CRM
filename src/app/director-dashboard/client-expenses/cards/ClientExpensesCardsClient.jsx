import ClientExpensesCardsClient from "@/components/client-expenses/ClientExpensesCardsClient";

export default function DirectorClientExpensesCardsClient(props) {
  return <ClientExpensesCardsClient {...props} dashboardBase="director-dashboard" />;
}
