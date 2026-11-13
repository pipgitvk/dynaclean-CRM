"use client";

import Link from "next/link";
import ContactHierarchyContactActions from "@/components/Customers/ContactHierarchyContactActions";
import CustomerWhatsAppLink from "@/components/Customers/CustomerWhatsAppLink";

function contactName(row) {
  return [row?.first_name, row?.last_name].filter(Boolean).join(" ").trim() || "—";
}

function HierarchyRow({
  row,
  variant,
  isCurrent,
  dashboardBase,
  userRole,
  compact = false,
  sidebar = false,
}) {
  if (!row) return null;
  const cid = row.customer_id;
  const followHref = `/${dashboardBase}/view-customer/${cid}/follow-up`;
  const viewHref = `/${dashboardBase}/view-customer/${cid}`;

  const useMemberShell =
    sidebar && (variant === "member" || variant === "sibling") && !isCurrent;

  const boxClass = isCurrent
    ? compact
      ? "p-2 rounded border-2 border-green-500 bg-green-50 shadow-sm"
      : sidebar
        ? "p-3 rounded-lg border-2 border-green-500 bg-green-50 shadow-sm"
        : "p-3 rounded border-2 border-green-500 bg-green-50 shadow-sm"
    : variant === "parent"
      ? compact
        ? "p-2 bg-blue-50 rounded border border-blue-200"
        : "p-3 bg-blue-50 rounded-lg border border-blue-200"
      : useMemberShell || variant === "member"
        ? compact
          ? "p-2 rounded-lg border border-purple-200 bg-[#F8F4FF]"
          : sidebar
            ? "p-3 rounded-lg border border-purple-200 bg-[#F8F4FF] shadow-sm"
            : "p-3 rounded border border-purple-200 bg-purple-50"
        : compact
          ? "p-2 bg-gray-50 rounded border border-gray-200"
          : sidebar
            ? "p-3 rounded-lg border border-purple-200 bg-[#F8F4FF] shadow-sm"
            : "p-3 bg-gray-50 rounded border border-gray-200";

  const layoutClass = compact
    ? "flex h-full min-h-[7.5rem] flex-col gap-1.5"
    : "flex items-center justify-between gap-3";

  return (
    <div className={`${layoutClass} ${boxClass}`}>
      <div className="min-w-0 flex-1">
        {isCurrent && !sidebar ? (
          <p className="mb-0.5 text-[10px] font-semibold text-green-700">
            Open here
          </p>
        ) : null}
        <p className={sidebar ? "text-sm font-semibold text-gray-900" : `font-medium text-gray-800 ${compact ? "text-xs leading-snug" : "text-sm"}`}>
          <Link
            href={viewHref}
            className={`block break-words hover:underline ${
              isCurrent
                ? "text-green-900"
                : "text-gray-900 hover:text-blue-600"
            }`}
          >
            {contactName(row)}
          </Link>
        </p>
        {!sidebar && cid != null ? (
          <span
            className={`mt-0.5 block text-gray-500 ${compact ? "text-[10px]" : "text-xs"}`}
          >
            ID: {cid}
          </span>
        ) : null}
        <p
          className={`flex flex-wrap items-center gap-1 text-gray-600 ${
            sidebar ? "mt-0.5 text-sm" : `mt-1 ${compact ? "text-[10px]" : "text-sm"}`
          }`}
        >
          <span className="break-all">{row.phone || "—"}</span>
          {!sidebar && row.phone ? <CustomerWhatsAppLink phone={row.phone} /> : null}
        </p>
      </div>
      <ContactHierarchyContactActions
        customerId={cid}
        displayName={contactName(row)}
        followHref={followHref}
        userRole={userRole}
      />
    </div>
  );
}

function HierarchyGrid({ children }) {
  return <div className="grid grid-cols-4 gap-2">{children}</div>;
}

/**
 * Parent / siblings / members — same layout as view-customer sidebar.
 * The customer you are viewing is highlighted in green (including middle members).
 */
export default function CustomerContactHierarchyList({
  parentContact,
  siblingContacts = [],
  childContacts = [],
  currentCustomer,
  dashboardBase = "user-dashboard",
  userRole = "",
  className = "",
  layout = "list",
}) {
  const isGrid = layout === "grid";
  const isSidebar = layout === "sidebar";
  const compact = isGrid;
  const currentId =
    currentCustomer?.customer_id != null
      ? String(currentCustomer.customer_id)
      : "";
  const members = childContacts || [];

  const hasParent = Boolean(parentContact);
  const siblingsForDisplay = [...(siblingContacts || [])];
  if (
    hasParent &&
    currentCustomer?.customer_id &&
    !siblingsForDisplay.some((s) => String(s.customer_id) === currentId)
  ) {
    siblingsForDisplay.push(currentCustomer);
  }

  const hasSiblings = siblingsForDisplay.length > 0;
  const hasMembers = members.length > 0;

  return (
    <div className={`${isSidebar ? "space-y-2.5" : "space-y-2"} ${className}`}>
      {!hasParent && currentCustomer?.customer_id ? (
        isGrid ? (
          <HierarchyGrid>
            <HierarchyRow
              row={currentCustomer}
              variant="sibling"
              isCurrent
              dashboardBase={dashboardBase}
              userRole={userRole}
              compact={compact}
              sidebar={isSidebar}
            />
          </HierarchyGrid>
        ) : (
          <HierarchyRow
            row={currentCustomer}
            variant="sibling"
            isCurrent
            dashboardBase={dashboardBase}
            userRole={userRole}
            sidebar={isSidebar}
          />
        )
      ) : null}

      {parentContact ? (
        <div>
          <p className="text-xs font-medium text-blue-600 mb-2">Parent:</p>
          {isGrid ? (
            <HierarchyGrid>
              <HierarchyRow
                row={parentContact}
                variant="parent"
                isCurrent={false}
                dashboardBase={dashboardBase}
                userRole={userRole}
                compact={compact}
                sidebar={isSidebar}
              />
            </HierarchyGrid>
          ) : (
            <HierarchyRow
              row={parentContact}
              variant="parent"
              isCurrent={false}
              dashboardBase={dashboardBase}
              userRole={userRole}
              sidebar={isSidebar}
            />
          )}
        </div>
      ) : null}

      {hasSiblings ? (
        <>
          <p className="text-xs font-medium text-gray-600">
            Siblings ({siblingsForDisplay.length}):
          </p>
          {isGrid ? (
            <HierarchyGrid>
              {siblingsForDisplay.map((contact) => (
                <HierarchyRow
                  key={contact.customer_id}
                  row={contact}
                  variant="sibling"
                  isCurrent={String(contact.customer_id) === currentId}
                  dashboardBase={dashboardBase}
                  userRole={userRole}
                  compact={compact}
                  sidebar={isSidebar}
                />
              ))}
            </HierarchyGrid>
          ) : (
            siblingsForDisplay.map((contact) => (
              <HierarchyRow
                key={contact.customer_id}
                row={contact}
                variant="sibling"
                isCurrent={String(contact.customer_id) === currentId}
                dashboardBase={dashboardBase}
                userRole={userRole}
                sidebar={isSidebar}
              />
            ))
          )}
        </>
      ) : null}

      {hasMembers ? (
        <>
          <p className="text-xs font-medium text-gray-600">
            Members ({members.length}):
          </p>
          {isGrid ? (
            <HierarchyGrid>
              {members.map((contact) => (
                <HierarchyRow
                  key={contact.customer_id}
                  row={contact}
                  variant="member"
                  isCurrent={String(contact.customer_id) === currentId}
                  dashboardBase={dashboardBase}
                  userRole={userRole}
                  compact={compact}
                  sidebar={isSidebar}
                />
              ))}
            </HierarchyGrid>
          ) : (
            members.map((contact) => (
              <HierarchyRow
                key={contact.customer_id}
                row={contact}
                variant="member"
                isCurrent={String(contact.customer_id) === currentId}
                dashboardBase={dashboardBase}
                userRole={userRole}
                sidebar={isSidebar}
              />
            ))
          )}
        </>
      ) : null}

      {!currentCustomer?.customer_id &&
      !hasParent &&
      !hasSiblings &&
      !hasMembers ? (
        <p className="text-sm text-gray-600">No contact hierarchy available.</p>
      ) : null}
    </div>
  );
}
