import React, { useState, useEffect } from "react";
import { toast } from "react-hot-toast"; // Import toast
import dayjs from "dayjs";
import { useRouter } from "next/navigation";

const Modal = ({ isOpen, closeModal, row, role, onPaymentSuccess }) => {
  const [notes, setNotes] = useState("");
  const [expenseDetails, setExpenseDetails] = useState(null);
  const router = useRouter();

  useEffect(() => {
    if (row && isOpen) {
      // Fetch expense details based on row ID
      const fetchExpenseDetails = async () => {
        const response = await fetch(`/api/get-expense-details/${row.ID}`);
        const data = await response.json();
        setExpenseDetails(data[0]);
      };

      fetchExpenseDetails();
    }
  }, [isOpen, row]);

  const handleSubmit = async () => {
    if (!notes) {
      toast.error("Please add notes"); // Replacing alert with toast error
      return;
    }

    // Update the expense record in the database with payment details
    const response = await fetch("/api/update-expense-payment", {
      method: "POST",
      body: JSON.stringify({
        expenseId: row.ID,
        paymentDate: dayjs().format("YYYY-MM-DD"),
        paymentRef: "Payment done",
        notes,
      }),
    });

    if (response.ok) {
      toast.success("Payment updated successfully!"); // Success toast
      onPaymentSuccess();
      router.refresh();
      closeModal();
    } else {
      toast.error("Failed to update payment details"); // Error toast
    }
  };

  useEffect(() => {
    if (expenseDetails) {
      setNotes(expenseDetails.Notes || "");
    }
  }, [expenseDetails]);

  // Check if payment_date is already set
  const rawPaymentDate = expenseDetails?.payment_date;

  // console.log("Raw payment_date:", rawPaymentDate);

  // Convert to string if it's a Date object
  const paymentDateStr = rawPaymentDate ? String(rawPaymentDate).trim() : "";

  const invalidValues = [
    "",
    "0000-00-00",
    "0000-00-00 00:00:00",
    "1899-11-29T18:38:50.000Z", // add any other placeholder if needed
  ];

  const isPaymentDone =
    paymentDateStr &&
    !invalidValues.includes(paymentDateStr) &&
    dayjs(paymentDateStr).isValid();

  // console.log("Final isPaymentDone:", isPaymentDone);

  if (!isOpen || !expenseDetails) return null;

  return (
    <div className="fixed inset-0 bg-opacity-50 flex justify-center items-center z-50">
      <div className="bg-white p-6 rounded-lg w-96">
        <h2 className="text-xl font-semibold">Payment Details</h2>
        <div className="space-y-4 mt-4">
          <div>
            <strong>Username:</strong> {expenseDetails.username}
          </div>
          <div>
            <strong>Person Name:</strong> {expenseDetails.person_name}
          </div>
          <div>
            <strong>Approved Amount:</strong> ₹{expenseDetails.approved_amount}
          </div>
          <div>
            <strong>Approval Status:</strong> {expenseDetails.approval_status}
          </div>
          <div>
            <strong>Attachments:</strong>{" "}
            <a
              href={expenseDetails.attachments}
              target="_blank"
              className="text-blue-600"
            >
              View Attachment
            </a>
          </div>

          <div>
            <label htmlFor="notes" className="block text-sm font-medium">
              Notes
            </label>
            <textarea
              id="notes"
              className="mt-1 p-2 w-full border rounded-md"
              rows="3"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={isPaymentDone} // Disable the textarea if payment is done
            />
          </div>

          <div className="flex gap-4 pt-4">
            <button
              className="px-4 py-2 bg-gray-300 rounded-lg"
              onClick={closeModal}
            >
              Cancel
            </button>
            <button
              className={`px-4 py-2 ${
                isPaymentDone ? "bg-gray-400" : "bg-green-600"
              } text-white rounded-lg`}
              onClick={isPaymentDone ? null : handleSubmit} // Disable click if payment is done
              disabled={isPaymentDone} // Disable button if payment is done
            >
              {isPaymentDone ? "Payment Already Done" : "Pay Now"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Modal;
