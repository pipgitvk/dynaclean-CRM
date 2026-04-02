import { redirectExpenseFileToOpenAttachment } from "@/lib/expenseAttachmentRedirect";

/** Alias: /api/expense_attachments/<file> → same resolver as hyphenated API path */
export async function GET(req, { params }) {
  const { fileName = "" } = await params;
  return redirectExpenseFileToOpenAttachment(req, fileName);
}
