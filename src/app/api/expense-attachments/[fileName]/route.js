import { redirectExpenseFileToOpenAttachment } from "@/lib/expenseAttachmentRedirect";

/**
 * Backward-compatible: /api/expense-attachments/:fileName
 * Redirects to shared open-attachment resolver (app + service).
 */
export async function GET(req, { params }) {
  const { fileName = "" } = await params;
  return redirectExpenseFileToOpenAttachment(req, fileName);
}
