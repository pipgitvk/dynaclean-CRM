import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";
import { writeFile, mkdir, unlink } from "fs/promises";
import path from "path";
import fs from "fs";

// GET: Fetch documents for an employee
export async function GET(request) {
  try {
    const session = await getSessionPayload();
    if (!session?.username) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    let username = searchParams.get("username");
    
    const conn = await getDbConnection();
    
    // Check if user is admin/HR
    const isAdmin = ["SUPERADMIN", "HR HEAD", "HR"].includes(session.role);
    
    // If not admin, only allow viewing own documents
    if (!isAdmin && username && username !== session.username) {
      return NextResponse.json(
        { success: false, error: "Access denied" },
        { status: 403 }
      );
    }
    
    // Default to session username if not provided
    if (!username) {
      username = session.username;
    }
    
    // Fetch profile with documents
    const [profiles] = await conn.execute(
      `SELECT 
        username, 
        empId, 
        full_name,
        profile_photo, 
        signature, 
        joining_form_documents, 
        documents_submitted 
       FROM employee_profiles 
       WHERE username = ?`,
      [username]
    );

    if (profiles.length === 0) {
      return NextResponse.json(
        { success: false, error: "Employee profile not found" },
        { status: 404 }
      );
    }

    const profile = profiles[0];
    
    // Parse JSON fields
    const joiningDocs = profile.joining_form_documents 
      ? JSON.parse(profile.joining_form_documents) 
      : [];
    const documentsSubmitted = profile.documents_submitted 
      ? JSON.parse(profile.documents_submitted) 
      : {};

    return NextResponse.json({
      success: true,
      username: profile.username,
      empId: profile.empId,
      full_name: profile.full_name,
      profile_photo: profile.profile_photo,
      signature: profile.signature,
      documents: joiningDocs,
      documents_checklist: documentsSubmitted,
      isAdmin
    });
  } catch (error) {
    console.error("Error fetching documents:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

// POST: Upload new documents (Admin only)
export async function POST(request) {
  try {
    const session = await getSessionPayload();
    if (!session?.username) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Check if user is admin/HR
    const isAdmin = ["SUPERADMIN", "HR HEAD", "HR"].includes(session.role);
    if (!isAdmin) {
      return NextResponse.json(
        { success: false, error: "Access denied. Only HR/Admin can upload documents." },
        { status: 403 }
      );
    }

    const formData = await request.formData();
    const username = formData.get("username");
    const documentTypesJson = formData.get("documentTypes");
    
    if (!username) {
      return NextResponse.json(
        { success: false, error: "Username is required" },
        { status: 400 }
      );
    }

    // Parse document types
    let documentTypes = {};
    try {
      documentTypes = documentTypesJson ? JSON.parse(documentTypesJson) : {};
    } catch {
      documentTypes = {};
    }

    const conn = await getDbConnection();
    
    // Check if profile exists and get existing documents and checklist
    const [profiles] = await conn.execute(
      `SELECT joining_form_documents, documents_submitted FROM employee_profiles WHERE username = ?`,
      [username]
    );

    if (profiles.length === 0) {
      return NextResponse.json(
        { success: false, error: "Employee profile not found" },
        { status: 404 }
      );
    }

    // Get existing documents
    let existingDocs = [];
    try {
      existingDocs = profiles[0].joining_form_documents 
        ? JSON.parse(profiles[0].joining_form_documents) 
        : [];
    } catch {
      existingDocs = [];
    }

    // Get existing checklist
    let existingChecklist = {};
    try {
      existingChecklist = profiles[0].documents_submitted 
        ? JSON.parse(profiles[0].documents_submitted) 
        : {};
    } catch {
      existingChecklist = {};
    }

    // Upload directory
    const uploadDir = path.join(process.cwd(), "public", "employee_profiles", username);
    await mkdir(uploadDir, { recursive: true });

    const uploadedFiles = [];
    const fileExt = (name) => {
      try { return path.extname(name || '').slice(0, 16); } catch { return ''; }
    };

    // Handle individual file uploads per document type
    for (const [key, value] of formData.entries()) {
      // Skip non-file fields
      if (key === 'username' || key === 'documentTypes') continue;
      
      // Check if it's a file and matches document type pattern
      if (value && typeof value === 'object' && 'arrayBuffer' in value && value.size > 0) {
        const timestamp = Date.now();
        const sanitizedKey = key.replace('document_', '');
        const fileName = `${sanitizedKey}_${timestamp}${fileExt(value.name)}`;
        const filePath = path.join(uploadDir, fileName);
        const buffer = Buffer.from(await value.arrayBuffer());
        await writeFile(filePath, buffer);
        
        const publicPath = `/employee_profiles/${username}/${fileName}`;
        uploadedFiles.push({
          url: publicPath,
          name: value.name,
          originalName: value.name,
          documentType: key, // Store which document type this file is for
          uploadedAt: new Date().toISOString(),
          uploadedBy: session.username,
          documentTypes: [key] // Store as array for consistency
        });
      }
    }

    // Merge with existing documents (only if files were uploaded)
    const mergedDocs = uploadedFiles.length > 0 
      ? [...existingDocs, ...uploadedFiles]
      : existingDocs;

    // Update checklist: Set to exactly what was sent (supports both adding and removing)
    // Only include keys that are explicitly set to true
    const updatedChecklist = {};
    for (const [key, value] of Object.entries(documentTypes)) {
      if (value === true) {
        updatedChecklist[key] = true;
      }
      // If value is false or not present, it won't be in updatedChecklist (effectively removed)
    }

    // Update profile with documents and checklist
    await conn.execute(
      `UPDATE employee_profiles 
       SET joining_form_documents = ?, 
           documents_submitted = ?,
           updated_at = NOW() 
       WHERE username = ?`,
      [JSON.stringify(mergedDocs), JSON.stringify(updatedChecklist), username]
    );

    const message = uploadedFiles.length > 0
      ? `${uploadedFiles.length} document(s) uploaded successfully and checklist updated`
      : "Document checklist updated successfully";

    return NextResponse.json({
      success: true,
      message,
      uploadedCount: uploadedFiles.length,
      documents: mergedDocs,
      checklist: updatedChecklist
    });
  } catch (error) {
    console.error("Error uploading documents:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

// DELETE: Delete a document (Admin only)
export async function DELETE(request) {
  try {
    const session = await getSessionPayload();
    if (!session?.username) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Check if user is admin/HR
    const isAdmin = ["SUPERADMIN", "HR HEAD", "HR"].includes(session.role);
    if (!isAdmin) {
      return NextResponse.json(
        { success: false, error: "Access denied. Only HR/Admin can delete documents." },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const username = searchParams.get("username");
    const documentUrl = searchParams.get("documentUrl");

    if (!username || !documentUrl) {
      return NextResponse.json(
        { success: false, error: "Username and documentUrl are required" },
        { status: 400 }
      );
    }

    const conn = await getDbConnection();
    
    // Get current documents
    const [profiles] = await conn.execute(
      `SELECT joining_form_documents FROM employee_profiles WHERE username = ?`,
      [username]
    );

    if (profiles.length === 0) {
      return NextResponse.json(
        { success: false, error: "Employee profile not found" },
        { status: 404 }
      );
    }

    let documents = [];
    try {
      documents = profiles[0].joining_form_documents 
        ? JSON.parse(profiles[0].joining_form_documents) 
        : [];
    } catch {
      documents = [];
    }

    // Find and remove the document
    const initialLength = documents.length;
    let removedDoc = null;
    
    documents = documents.filter(doc => {
      const docUrl = typeof doc === 'string' ? doc : doc.url;
      if (docUrl === documentUrl) {
        removedDoc = doc;
        return false;
      }
      return true;
    });

    if (documents.length === initialLength) {
      return NextResponse.json(
        { success: false, error: "Document not found" },
        { status: 404 }
      );
    }

    // Try to delete the physical file
    try {
      const filePath = path.join(process.cwd(), "public", documentUrl);
      if (fs.existsSync(filePath)) {
        await unlink(filePath);
      }
    } catch (fileError) {
      console.error("Error deleting physical file:", fileError);
      // Continue even if file deletion fails
    }

    // Update profile
    await conn.execute(
      `UPDATE employee_profiles SET joining_form_documents = ?, updated_at = NOW() WHERE username = ?`,
      [JSON.stringify(documents), username]
    );

    return NextResponse.json({
      success: true,
      message: "Document deleted successfully",
      documents
    });
  } catch (error) {
    console.error("Error deleting document:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
