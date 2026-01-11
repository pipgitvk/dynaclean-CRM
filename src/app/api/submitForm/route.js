// src/app/api/submitForm/route.js

import { getDbConnection } from "@/lib/db"; // Assuming this connects to your database
import toast from "react-hot-toast";

// Function to sanitize inputs
const sanitizeInput = (input) => {
  return input.replace(/[^a-zA-Z0-9\s.,!?'":;()&-]/g, ""); // Allow alphanumeric and some punctuation
};

// Handle POST request
export async function POST(req) {
  const { name, state, description, rating } = await req.json(); // Use .json() to parse the body

  // Input Validation
  if (!name || !state || !description || rating === 0) {
    return new Response(
      JSON.stringify({ error: "Please fill all the fields and provide a rating." }),
      { status: 400 }
    );
  }

  // Sanitize inputs
  const sanitizedName = sanitizeInput(name);
  const sanitizedState = sanitizeInput(state);
  const sanitizedDescription = sanitizeInput(description);

  try {
    // Get the database connection
    const conn = await getDbConnection();

    // Insert form data into the database
    const query = `INSERT INTO form_submissions (name, state, description, rating) VALUES (?, ?, ?, ?)`;
    const values = [sanitizedName, sanitizedState, sanitizedDescription, rating];

    const [result] = await conn.execute(query, values);

    // Close connection
    // conn.end();

    // Send success response
    return new Response(
      JSON.stringify({ message: "Form Submitted Successfully!" }),
      { status: 200 }
    );
  } catch (error) {
    // Error handling
    console.error(error);
    return new Response(
      JSON.stringify({ error: "Internal Server Error" }),
      { status: 500 }
    );
  }
}
