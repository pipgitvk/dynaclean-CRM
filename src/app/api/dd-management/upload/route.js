import { NextResponse } from "next/server";
import { parseFormData } from "@/lib/parseFormData";
import fs from "fs";
import path from "path";

// Ensure the target folder exists
const ensureDir = (dirPath) => {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }
};

// Save file to public/uploads/dd-management/
async function saveFileLocally(file, subDir = "") {
    if (!file || !file.filepath) throw new Error("Missing file");

    const uploadDir = path.join(process.cwd(), "public", "uploads", "dd-management", subDir);
    ensureDir(uploadDir);

    const ext = path.extname(file.originalFilename || "") || ".bin";
    const uniqueName = `${Date.now()}_${Math.random().toString(36).substring(2, 8)}${ext}`;
    const destPath = path.join(uploadDir, uniqueName);

    await fs.promises.copyFile(file.filepath, destPath);

    // Return relative URL (for database usage)
    return `/uploads/dd-management/${subDir ? subDir + "/" : ""}${uniqueName}`;
}

export const config = {
    api: {
        bodyParser: false,
    },
};

// Normalize file input
const getFile = (f) => (Array.isArray(f) ? f[0] : f);

export async function POST(req) {
    try {
        const { files } = await parseFormData(req);

        const uploadedPaths = {};

        if (files.cheque_upload) {
            uploadedPaths.cheque_upload = await saveFileLocally(getFile(files.cheque_upload), "cheques");
        }
        if (files.signature_upload) {
            uploadedPaths.signature_upload = await saveFileLocally(getFile(files.signature_upload), "signatures");
        }
        if (files.dd_upload) {
            uploadedPaths.dd_upload = await saveFileLocally(getFile(files.dd_upload), "issued-dds");
        }
        if (files.bg_format_upload) {
            uploadedPaths.bg_format_upload = await saveFileLocally(getFile(files.bg_format_upload), "bg-formats");
        }
        if (files.original_bg_upload) {
            uploadedPaths.original_bg_upload = await saveFileLocally(getFile(files.original_bg_upload), "original-bgs");
        }
        if (files.docs_upload) {
            uploadedPaths.docs_upload = await saveFileLocally(getFile(files.docs_upload), "bg-docs");
        }

        return NextResponse.json({ success: true, paths: uploadedPaths });
    } catch (error) {
        console.error("❌ DD Upload Error:", error);
        return NextResponse.json({ error: error.message || "Upload failed" }, { status: 500 });
    }
}
