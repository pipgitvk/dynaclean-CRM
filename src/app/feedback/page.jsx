"use client";
import React, { useState } from "react";
import toast from "react-hot-toast";

const Page = () => {
  const [rating, setRating] = useState(0);
  const [name, setName] = useState("");
  const [state, setState] = useState("");
  const [description, setDescription] = useState("");
  const [submitted, setSubmitted] = useState(false); // To prevent resubmission

  const [error, setError] = useState(""); // To handle form errors

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Input validation
    if (!name || !state || !description || rating === 0) {
      setError("Please fill all the fields and provide a rating.");
      return;
    }

    // Sanitize inputs before submitting
    const sanitizedName = sanitizeInput(name);
    const sanitizedState = sanitizeInput(state);
    const sanitizedDescription = sanitizeInput(description);

    try {
      const response = await fetch("/api/submitForm", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: sanitizedName,
          state: sanitizedState,
          description: sanitizedDescription,
          rating,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        toast.success("Form submitted successfully!");
        setSubmitted(true);

        // Redirect after successful submission
        setTimeout(() => {
          window.location.href = "https://dynacleanindustries.com/thank-you"; // Redirect to the thank-you page
        }, 1500); // Delay the redirection by 1.5 seconds to give time for the toast to show
      } else {
        toast.error(data.error || "Error submitting the form.");
      }
    } catch (error) {
      console.error("Error:", error);
      toast.error("Internal Server Error.");
    }

    // Clear the form fields after submission
    setName("");
    setState("");
    setDescription("");
    setRating(0);
  };

  const sanitizeInput = (input) => {
    return input.replace(/[^a-zA-Z0-9\s.,!?'":;()&-]/g, ""); // Allow alphanumeric and some punctuation
  };

  return (
    <div className="h-screen bg-gradient-to-r from-blue-100 via-purple-200 to-indigo-300 flex items-center justify-center">
      <div className="bg-white bg-opacity-60 backdrop-blur-md rounded-xl p-8 max-w-lg w-full shadow-xl">
        <h2 className="text-3xl font-semibold text-center text-gray-900 mb-8">
          Rate Us
        </h2>

        {error && <div className="text-red-600 text-center mb-4">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Name Input */}
          <div className="flex flex-col">
            <label
              htmlFor="name"
              className="text-sm font-medium text-gray-600 mb-2"
            >
              Your Name
            </label>
            <input
              type="text"
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter your name"
              required
              className="p-4 border border-gray-300 rounded-lg text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition duration-300"
            />
          </div>

          {/* State Input */}
          <div className="flex flex-col">
            <label
              htmlFor="state"
              className="text-sm font-medium text-gray-600 mb-2"
            >
              State
            </label>
            <input
              type="text"
              id="state"
              value={state}
              onChange={(e) => setState(e.target.value)}
              placeholder="Enter your state"
              required
              className="p-4 border border-gray-300 rounded-lg text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition duration-300"
            />
          </div>

          {/* Description Textarea */}
          <div className="flex flex-col">
            <label
              htmlFor="description"
              className="text-sm font-medium text-gray-600 mb-2"
            >
              Description
            </label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Enter your description"
              required
              className="p-4 border border-gray-300 rounded-lg text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition duration-300"
            />
          </div>

          {/* Rating System */}
          <div className="flex flex-col">
            <label className="text-sm font-medium text-gray-600 mb-2">
              Rating
            </label>
            <div className="flex gap-2 text-2xl cursor-pointer">
              {[1, 2, 3, 4, 5].map((star) => (
                <span
                  key={star}
                  className={`transition-colors duration-300 ${
                    rating >= star ? "text-yellow-500" : "text-gray-300"
                  }`}
                  onClick={() => setRating(star)}
                >
                  ★
                </span>
              ))}
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={submitted} // Disable the button after submission
            className={`w-full p-4 rounded-lg text-white transition duration-300 ${
              submitted
                ? "bg-gray-400 cursor-not-allowed"
                : "bg-indigo-600 hover:bg-indigo-500"
            }`}
          >
            {submitted ? "Submitted" : "Submit"}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Page;
