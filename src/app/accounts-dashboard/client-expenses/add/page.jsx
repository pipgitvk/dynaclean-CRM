import AddClientExpenseForm from "./AddClientExpenseForm";

export const metadata = {
  title: "Add Client Expense",
};

export default async function AddClientExpensePage({ searchParams }) {
  const sp = await searchParams;
  const client = sp?.client || "";
  const group = sp?.group || "";

  return (
    <div className="mx-auto p-6">
      <AddClientExpenseForm initialClient={client} initialGroup={group} />
    </div>
  );
}
