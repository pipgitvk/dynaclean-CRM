import { redirectExpenseFileToOpenAttachment } from "@/lib/expenseAttachmentRedirect";

/** Legacy shape: /completion_files/api/expense_attachments/<file> */
export async function GET(req, { params }) {
  const { fileName = "" } = await params;
  return redirectExpenseFileToOpenAttachment(req, fileName);
}
