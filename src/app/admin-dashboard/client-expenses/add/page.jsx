import AddClientExpenseForm from "./AddClientExpenseForm";

export const metadata = {
  title: "Add Client Expense",
};

export default function AddClientExpensePage() {
  return (
    <div className="mx-auto p-6">
      <AddClientExpenseForm />
    </div>
  );
}
