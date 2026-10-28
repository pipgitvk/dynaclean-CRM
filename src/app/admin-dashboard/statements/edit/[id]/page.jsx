"use client";

import { useParams } from "next/navigation";
import EditStatementForm from "../../EditStatementForm";

export default function EditStatementPage() {
  const { id } = useParams();
  return <EditStatementForm statementId={id} />;
}
