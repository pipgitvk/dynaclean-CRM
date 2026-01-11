import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { getSessionPayload } from "@/lib/auth";

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

// POST: Parse uploaded document using Gemini Vision API
export async function POST(request) {
  try {
    const session = await getSessionPayload();
    if (!session?.username) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const formData = await request.formData();
    const file = formData.get("document");

    if (!file) {
      return NextResponse.json(
        { success: false, error: "No document provided" },
        { status: 400 }
      );
    }

    // Convert file to base64
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const base64 = buffer.toString("base64");

    // Determine mime type
    let mimeType = file.type;
    if (!mimeType) {
      const ext = file.name.split(".").pop().toLowerCase();
      const mimeMap = {
        jpg: "image/jpeg",
        jpeg: "image/jpeg",
        png: "image/png",
        pdf: "application/pdf",
        webp: "image/webp",
      };
      mimeType = mimeMap[ext] || "image/jpeg";
    }

    // Create prompt for document parsing
    const prompt = `You are an AI assistant that extracts employee information from joining forms. 
Analyze this employee joining form document and extract all available information in the following JSON format.
Return ONLY valid JSON without any markdown formatting or additional text.

{
  "employee_code": "",
  "source_reference": "",
  "designation": "",
  "date_of_joining": "YYYY-MM-DD",
  "work_location": "",
  "name_as_per_bank": "",
  "bank_name": "",
  "ifsc_code": "",
  "bank_account_number": "",
  "pan_number": "",
  "aadhar_number": "",
  "name_prefix": "",
  "full_name": "",
  "contact_mobile": "",
  "contact_landline": "",
  "date_of_birth": "YYYY-MM-DD",
  "marital_status": "",
  "blood_group": "",
  "email": "",
  "father_name": "",
  "father_occupation": "",
  "father_phone": "",
  "spouse_name": "",
  "spouse_occupation": "",
  "spouse_phone": "",
  "correspondence_address": "",
  "correspondence_telephone": "",
  "permanent_address": "",
  "permanent_telephone": "",
  "emergency_contact_name": "",
  "emergency_contact_number": "",
  "landlord_or_neighbour_name": "",
  "landlord_or_neighbour_contact": "",
  "relative_or_neighbour_name": "",
  "relative_or_neighbour_contact": "",
  "previous_reporting_manager": "",
  "previous_manager_contact": "",
  "previous_hr_manager": "",
  "previous_hr_contact": "",
  "criminal_offence": "",
  "joining_designation": "",
  "joining_location": "",
  "joining_effective_date": "YYYY-MM-DD",
  "joining_shift": "",
  "references": [
    {
      "reference_name": "",
      "reference_mobile": "",
      "reference_type": "Reference1"
    }
  ],
  "education": [
    {
      "exam_name": "",
      "board_university": "",
      "year_of_passing": "",
      "grade_percentage": ""
    }
  ],
  "experience": [
    {
      "company_name": "",
      "designation": "",
      "gross_salary_ctc": "",
      "period_from": "YYYY-MM-DD",
      "period_to": "YYYY-MM-DD",
      "reason_for_leaving": ""
    }
  ],
  "documents_submitted": {
    "document_10th_certificate": false,
    "document_12th_certificate": false,
    "document_graduation_certificate": false,
    "document_professional_certificates": false,
    "document_dob_proof": false,
    "document_id_proof": false,
    "document_address_proof": false,
    "document_relieve_experience_letters": false,
    "document_salary_slips": false,
    "document_bank_statement": false,
    "document_passport_photos": false,
    "document_pan_copy": false,
    "document_cv": false,
    "document_appointment_ack": false
  }
}

Extract all visible information. If a field is not visible or empty, use empty string or appropriate empty value. For dates, use YYYY-MM-DD format. For boolean fields in documents_submitted, mark as true if the document is mentioned/checked, false otherwise.`;

    // Call Gemini Vision API with fallback models (prefer env override)
    const preferredModel = process.env.GEMINI_MODEL && process.env.GEMINI_MODEL.trim() !== ""
      ? process.env.GEMINI_MODEL.trim()
      : null;

    const modelsToTry = [
      // env override first
      ...(preferredModel ? [preferredModel] : []),
      // current recommended
      "gemini-1.5-pro-001",
      "gemini-1.5-flash-001",
      "gemini-1.5-pro",
      "gemini-1.5-flash",
      // latest aliases (if available in project)
      "gemini-1.5-pro-latest",
      "gemini-1.5-flash-latest",
      // older vision-capable models
      "gemini-1.0-pro-vision",
      "gemini-pro-vision",
    ];

    const imagePart = {
      inlineData: {
        data: base64,
        mimeType: mimeType,
      },
    };

    let parsedData = null;
    let lastGenerateError = null;

    for (const modelName of modelsToTry) {
      try {
        const model = genAI.getGenerativeModel({ model: modelName });
        const result = await model.generateContent([prompt, imagePart]);
        const response = await result.response;
        let extractedText = response.text();

        // Clean up response (remove markdown code blocks if present)
        extractedText = extractedText.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
        parsedData = JSON.parse(extractedText);
        // success, break the loop
        break;
      } catch (err) {
        lastGenerateError = err;
        const msg = (err?.message || "").toString();
        // If 404 model not found, try next model, otherwise rethrow
        if (msg.includes("404 Not Found") || msg.includes("is not found for API version")) {
          console.log(`Model ${modelName} not available for generateContent, trying next...`);
          continue;
        }
        // other errors (e.g., auth/quota) should stop early
        throw err;
      }
    }

    if (!parsedData) {
      const tried = modelsToTry.join(", ");
      throw new Error(`All Gemini models failed. Tried: ${tried}. Last error: ${lastGenerateError?.message || "unknown"}`);
    }

    return NextResponse.json({
      success: true,
      data: parsedData,
      message: "Document parsed successfully",
    });
  } catch (error) {
    console.error("Error parsing document:", error);
    
    // Handle specific Gemini API errors
    if (error.message.includes("404 Not Found") || error.message.includes("No available Gemini models")) {
      return NextResponse.json(
        { 
          success: false, 
          error: "Gemini model not available",
          details: "None of the Gemini models (gemini-1.5-pro, gemini-1.0-pro, gemini-pro) are available. Please check your API key and model availability."
        },
        { status: 500 }
      );
    }
    
    if (error.message.includes("API key")) {
      return NextResponse.json(
        { 
          success: false, 
          error: "Invalid or missing API key",
          details: "Please check your GEMINI_API_KEY in environment variables"
        },
        { status: 500 }
      );
    }
    
    return NextResponse.json(
      { 
        success: false, 
        error: error.message,
        details: "Make sure GEMINI_API_KEY is set in environment variables and the model is available"
      },
      { status: 500 }
    );
  }
}
