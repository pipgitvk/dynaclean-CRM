"use client";

import Link from "next/link";
import {
  BookOpen,
  Calendar,
  ChevronDown,
  CirclePlus,
  FileText,
  Package,
  Pencil,
  Phone,
  Receipt,
  Tag,
  Target,
  UserPlus,
  Users,
  Zap,
} from "lucide-react";
import CustomerContactsModal from "@/components/Customers/CustomerContactsModal";
import CustomerPerformaInvoiceButton from "@/components/invoice/CustomerPerformaInvoiceButton";
import ScheduleVisitModal from "@/components/scheduleVisit/ScheduleVisitModal";
import { customerPartyLedgerHref } from "@/lib/customerPartyLedger";

const actionBtnBase =
  "inline-flex items-center gap-2 rounded-xl border px-3 py-2.5 text-xs font-semibold shadow-sm transition hover:brightness-95 sm:text-sm";

function QuickActionLink({ href, className, icon: Icon, label, suffixIcon: SuffixIcon }) {
  return (
    <Link href={href} className={`${actionBtnBase} ${className}`}>
      {Icon ? <Icon className="h-4 w-4 shrink-0" strokeWidth={2.25} /> : null}
      <span>{label}</span>
      {SuffixIcon ? <SuffixIcon className="h-3.5 w-3.5 shrink-0 opacity-90" /> : null}
    </Link>
  );
}

const quickActions = [
  {
    label: "Follow-up Now",
    icon: Phone,
    suffixIcon: ChevronDown,
    href: (id) => `/admin-dashboard/view-customer/${id}/follow-up`,
    className: "border-emerald-600 bg-emerald-500 text-white hover:bg-emerald-600",
  },
  {
    label: "Edit Customer",
    icon: Pencil,
    href: (id) => `/admin-dashboard/view-customer/${id}/edit`,
    className: "border-violet-600 bg-violet-500 text-white hover:bg-violet-600",
  },
  {
    label: "Demo Registration",
    icon: UserPlus,
    href: (id) => `/admin-dashboard/view-customer/${id}/demo`,
    className: "border-blue-600 bg-blue-500 text-white hover:bg-blue-600",
  },
  {
    label: "View All Quotations",
    icon: FileText,
    href: (id) => `/admin-dashboard/view-customer/${id}/quotations`,
    className: "border-slate-800 bg-slate-700 text-white hover:bg-slate-800",
  },
  {
    label: "Add Quotation",
    icon: CirclePlus,
    href: (id) => `/admin-dashboard/quotations/new?customerId=${id}`,
    className: "border-orange-600 bg-orange-500 text-white hover:bg-orange-600",
  },
  {
    label: "Perform Invoice",
    icon: Receipt,
    special: "performa",
    className: "border-fuchsia-600 bg-fuchsia-500 text-white hover:bg-fuchsia-600",
  },
  {
    label: "Special Price",
    icon: Tag,
    href: (id) => `/admin-dashboard/special-pricing/${id}`,
    className: "border-red-600 bg-red-500 text-white hover:bg-red-600",
  },
  {
    label: "View Ledger",
    icon: BookOpen,
    href: (id, role) => customerPartyLedgerHref(id, role),
    className: "border-sky-500 bg-sky-400 text-white hover:bg-sky-500",
  },
  {
    label: "Schedule Visit",
    icon: Calendar,
    special: "schedule",
    className: "border-lime-500 bg-lime-400 text-white hover:bg-lime-500",
  },
  {
    label: "Machine Follow-up",
    icon: Target,
    href: (id) => `/admin-dashboard/view-customer/${id}/machine-followup`,
    machineFollowupOnly: true,
    className: "border-violet-700 bg-violet-600 text-white hover:bg-violet-700",
  },
  {
    label: "View Contacts",
    icon: Users,
    special: "contacts",
    className: "border-indigo-300 bg-indigo-200 text-indigo-950 hover:bg-indigo-300",
  },
];

export default function CustomerCrmQuickActions({
  customerId,
  customerDisplayName,
  customerPhone,
  customerAddress,
  userRole,
  orderCount,
  latestQuoteNumber,
  canCreatePerformaInvoice,
  showScheduleVisitBtn,
  canSeeMachineFollowup,
}) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 shadow sm:p-6">
      <h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-gray-900">
        <Zap className="h-5 w-5 text-amber-500" />
        Quick Actions
      </h2>
      <div className="flex flex-wrap gap-2">
        {quickActions.map((action) => {
          if (action.machineFollowupOnly && !canSeeMachineFollowup) {
            return null;
          }
          if (action.special === "contacts") {
            return (
              <CustomerContactsModal
                key={action.label}
                customerId={customerId}
                userRole={userRole}
                triggerClassName={`${actionBtnBase} ${action.className}`}
                triggerLabel={action.label}
                TriggerIcon={action.icon}
              />
            );
          }
          if (action.special === "schedule") {
            if (!showScheduleVisitBtn) return null;
            return (
              <ScheduleVisitModal
                key={action.label}
                customerId={customerId}
                customerName={customerDisplayName}
                contact={customerPhone}
                address={customerAddress}
                buttonLabel={action.label}
                prefillVisitAddress={false}
                triggerClassName={`${actionBtnBase} ${action.className}`}
                TriggerIcon={action.icon}
              />
            );
          }
          if (action.special === "performa") {
            if (!canCreatePerformaInvoice) return null;
            return (
              <CustomerPerformaInvoiceButton
                key={action.label}
                quotationNumber={latestQuoteNumber}
                href={`/admin-dashboard/invoices/performa?quotation_number=${encodeURIComponent(latestQuoteNumber)}`}
                label={action.label}
                icon={action.icon}
                className={`${actionBtnBase} ${action.className}`}
              />
            );
          }
          const href =
            action.label === "View Ledger"
              ? action.href(customerId, userRole)
              : action.href(customerId);
          return (
            <QuickActionLink
              key={action.label}
              href={href}
              className={action.className}
              icon={action.icon}
              label={action.label}
              suffixIcon={action.suffixIcon}
            />
          );
        })}
        {orderCount > 0 ? (
          <QuickActionLink
            href={`/admin-dashboard/view-customer/${customerId}/orders`}
            className="border-teal-600 bg-teal-500 text-white hover:bg-teal-600"
            icon={Package}
            label={`Orders (${orderCount})`}
          />
        ) : null}
      </div>
    </div>
  );
}