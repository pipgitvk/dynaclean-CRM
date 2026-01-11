"use client"; // This is a client-side component

import { useEffect } from "react";

const ViewAllExpensesButton = () => {
  const handleViewAllExpenses = () => {
    // Set a cookie that indicates the user wants to view all expenses
    document.cookie = "viewAll=true; path=/; max-age=86400"; // cookie expires in 1 day
    // Reload the page to reflect the updated query
    window.location.reload();
  };

  return (
    <button
      onClick={handleViewAllExpenses}
      className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded shadow"
    >
      View All Expenses
    </button>
  );
};

export default ViewAllExpensesButton;
