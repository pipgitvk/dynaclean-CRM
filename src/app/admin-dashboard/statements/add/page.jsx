import AddStatementForm from "./AddStatementForm";

export const metadata = {
  title: "Add Statement",
};

export default async function AddStatementPage({ searchParams }) {
  const params = await searchParams;
  const expenseId = params?.expense_id ?? "";
  const defaultAmount = params?.amount ?? "";
  return (
    <div className="mx-auto p-6">
      <AddStatementForm expenseId={expenseId} defaultAmount={defaultAmount} />
    </div>
  );
}
