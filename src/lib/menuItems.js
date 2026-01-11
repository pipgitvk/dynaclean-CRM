// lib/menuItems.js
import {
  Home,
  FileText,
  Upload,
  ClipboardList,
  ScrollText,
  BookOpen,
  DollarSign,
  FileSignature,
  ShieldCheck,
  PackageSearch,
  ListOrdered,
  FilePlus2,
} from "lucide-react";

export const menuItems = [
  { path: "/user-dashboard", name: "Dashboard", roles: ["ALL"], icon: Home },
  { path: "/neworderList", name: "Order Process", roles: ["ALL"], icon: ListOrdered },
  { path: "/new_upload", name: "Leads Upload", roles: ["DIGITAL MARKETER"], icon: Upload },
  { path: "/new", name: "New Followup", roles: ["ALL"], icon: FilePlus2 },
  { path: "/view_followups", name: "View Followups", roles: ["ALL"], icon: ScrollText },
  { path: "/demo_regi_reports", name: "Demo Status", roles: ["SALES"], icon: ClipboardList },
  { path: "/task_manager", name: "Task Manager", roles: ["ALL"], icon: ClipboardList },
  { path: "/qutation_manage", name: "Quotation", roles: ["SALES", "ADMIN", "BACK OFFICE", "DIGITAL MARKETER"], icon: FileSignature },
  { path: "/expense", name: "Expense", roles: ["ALL"], icon: DollarSign },
  { path: "/view_expenses", name: "View Expense", roles: ["ACCOUNTANT"], icon: DollarSign },
  { path: "/view_service_reports", name: "Service History", roles: ["SERVICE ENGINEER"], icon: BookOpen },
  { path: "/view_service_reports_admin", name: "Service History", roles: ["ADMIN"], icon: BookOpen },
  { path: "/view_warranty", name: "All Products", roles: ["ADMIN"], icon: ShieldCheck },
  { path: "/warranty_register", name: "Register Product", roles: ["ADMIN"], icon: ShieldCheck },
  { path: "/daily_emp_followups_reportsNew", name: "Report", roles: ["ADMIN", "BACK OFFICE"], icon: FileText },
];
