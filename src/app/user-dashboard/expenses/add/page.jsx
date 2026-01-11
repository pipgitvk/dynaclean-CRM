import AddExpenseForm from "./AddExpenseForm";

export const metadata = {
  title: "Add Expense",
};

export default function AddExpensePage() {
  return (
    <div className=" mx-auto p-6">
      {/* <h1 className="text-2xl font-bold mb-6 text-center">Add Expense</h1> */}
      <AddExpenseForm />
    </div>
  );
}
