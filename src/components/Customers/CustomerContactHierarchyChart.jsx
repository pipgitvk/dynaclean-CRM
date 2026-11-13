"use client";

import Link from "next/link";
import CustomerWhatsAppLink from "@/components/Customers/CustomerWhatsAppLink";
import { buildCustomerContactReportTree } from "@/lib/customerContactReportTree";

function displayName(contact) {
  if (contact?.name) return String(contact.name).trim();
  return [contact?.first_name, contact?.last_name].filter(Boolean).join(" ").trim() || "—";
}

function contactPhone(contact) {
  return contact?.contact || contact?.phone || "";
}

function formatContactRow(row) {
  if (!row) return null;
  return {
    ...row,
    id: row.customer_id ?? row.id,
    customer_id: row.customer_id ?? row.id,
    name: displayName(row),
    contact: contactPhone(row),
  };
}

function ChartNodeCard({ contact, isCurrent, dashboardBase, variant = "default" }) {
  const cid = contact.customer_id ?? contact.id;
  const viewHref = `/${dashboardBase}/view-customer/${cid}`;
  const phone = contactPhone(contact);

  const shellClass =
    variant === "parent-apex"
      ? "border-blue-300 bg-blue-50"
      : isCurrent
        ? "border-green-500 bg-green-50 ring-2 ring-green-400"
        : "border-gray-300 bg-white";

  return (
    <div
      className={`relative z-[1] mx-auto w-full max-w-[11.5rem] rounded-lg border px-3 py-2.5 text-center shadow-sm ${shellClass}`}
    >
      {variant === "parent-apex" ? (
        <p className="mb-1 text-[10px] font-semibold uppercase text-blue-700">
          Parent account
        </p>
      ) : null}
      {isCurrent ? (
        <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-green-700">
          Open on this page
        </p>
      ) : null}
      <Link
        href={viewHref}
        className={`block text-sm font-semibold leading-snug break-words hover:underline ${
          isCurrent ? "text-green-900" : "text-gray-900"
        }`}
      >
        {displayName(contact)}
      </Link>
      <p className="mt-0.5 text-[11px] text-gray-500">ID: {cid}</p>
      {contact.report_to_name ? (
        <p className="mt-1 text-[10px] leading-snug text-gray-500">
          Added under:{" "}
          <span className="font-medium text-gray-700">
            {contact.report_to_name}
          </span>
        </p>
      ) : contact.report_to == null || contact.report_to === "" ? (
        <p className="mt-1 text-[10px] text-gray-400">Direct member</p>
      ) : null}
      <div className="mt-1.5 flex flex-wrap items-center justify-center gap-1 text-xs text-gray-600">
        <span className="break-all">{phone || "—"}</span>
        {phone ? <CustomerWhatsAppLink phone={phone} /> : null}
      </div>
    </div>
  );
}

function isCurrentContact(contact, currentId) {
  const cid = String(contact.customer_id ?? contact.id ?? "");
  return currentId && cid === String(currentId);
}

/** Leaf members: grid cards (no nested branch — avoids overlap). */
function MemberCardGrid({ nodes, currentId, dashboardBase }) {
  if (!nodes?.length) return null;
  return (
    <div className="grid w-full grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 lg:grid-cols-4">
      {nodes.map((child) => (
        <div
          key={child.contact.id ?? child.contact.customer_id}
          className="flex min-w-0 flex-col items-center"
        >
          <div className="mb-2 h-4 w-px shrink-0 bg-gray-300" aria-hidden />
          <ChartNodeCard
            contact={child.contact}
            isCurrent={isCurrentContact(child.contact, currentId)}
            dashboardBase={dashboardBase}
          />
        </div>
      ))}
    </div>
  );
}

/** Apex → focus → member grid below (no horizontal overlap). */
function TreeBranch({
  node,
  currentId,
  dashboardBase,
  apexVariant = "default",
  depth = 0,
}) {
  const contact = node.contact;
  const isCurrent = isCurrentContact(contact, currentId);
  const children = node.children || [];
  const hasChildren = children.length > 0;
  const leafChildren = children.filter((c) => !(c.children?.length > 0));
  const nestedChildren = children.filter((c) => (c.children?.length > 0));

  return (
    <div
      className={`flex w-full flex-col items-center ${
        depth === 0 ? "max-w-none" : ""
      }`}
    >
      <ChartNodeCard
        contact={contact}
        isCurrent={isCurrent}
        dashboardBase={dashboardBase}
        variant={depth === 0 ? apexVariant : "default"}
      />
      {hasChildren ? (
        <div className="mt-0 flex w-full flex-col items-center">
          <div className="h-6 w-px shrink-0 bg-gray-400" aria-hidden />
          <div className="relative w-full pt-2">
            <MemberCardGrid
              nodes={leafChildren}
              currentId={currentId}
              dashboardBase={dashboardBase}
            />
            {nestedChildren.map((child) => (
              <div
                key={child.contact.id ?? child.contact.customer_id}
                className="mt-8 flex w-full flex-col items-center border-t border-gray-200 pt-6"
              >
                <TreeBranch
                  node={child}
                  currentId={currentId}
                  dashboardBase={dashboardBase}
                  depth={depth + 1}
                />
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

/** Same people as Contact Hierarchy list (parent, siblings, members, current). */
function mergeAllHierarchyContacts({
  contacts = [],
  hierarchyParent,
  hierarchyFamilyRoot,
  siblingContacts = [],
  hierarchyMembers = [],
  currentCustomer,
}) {
  const byId = new Map();
  for (const c of contacts || []) {
    const id = String(c.customer_id ?? c.id);
    if (id) byId.set(id, formatContactRow(c));
  }

  const addRow = (row) => {
    if (!row?.customer_id) return;
    const id = String(row.customer_id);
    if (byId.has(id)) return;
    byId.set(
      id,
      formatContactRow({
        ...row,
        id: row.customer_id,
        customer_id: row.customer_id,
        contact: row.phone ?? row.contact,
        name: displayName(row),
      }),
    );
  };

  addRow(hierarchyFamilyRoot);
  addRow(hierarchyParent);
  addRow(currentCustomer);
  for (const s of siblingContacts || []) addRow(s);
  for (const m of hierarchyMembers || []) addRow(m);

  return Array.from(byId.values());
}

function collectHierarchyListIds({
  hierarchyParent,
  siblingContacts,
  hierarchyMembers,
  currentCustomer,
}) {
  const ids = new Set();
  const add = (r) => {
    if (r?.customer_id != null) ids.add(String(r.customer_id));
  };
  add(hierarchyParent);
  add(currentCustomer);
  for (const s of siblingContacts || []) add(s);
  for (const m of hierarchyMembers || []) add(m);
  return ids;
}

function collectUplinkIds(node, focusId, acc = new Set()) {
  if (!node || !focusId) return acc;
  const fid = String(focusId);
  const nid = String(node.contact?.customer_id ?? node.contact?.id ?? "");
  acc.add(nid);
  if (nid === fid) return acc;
  for (const ch of node.children || []) {
    if (treeContainsId(ch, fid)) {
      collectUplinkIds(ch, focusId, acc);
      break;
    }
  }
  return acc;
}

function normalizeReportToAccount(contacts, accountId) {
  if (!accountId || !contacts?.length) return contacts || [];
  const acc = String(accountId);
  return contacts.map((c) => {
    const rt =
      c.report_to != null && c.report_to !== "" ? String(c.report_to) : "";
    if (rt === acc) {
      return { ...c, report_to: null };
    }
    return c;
  });
}

function treeContainsId(node, id) {
  if (!node || !id) return false;
  const cid = String(node.contact?.customer_id ?? node.contact?.id ?? "");
  if (cid === String(id)) return true;
  return (node.children || []).some((ch) => treeContainsId(ch, id));
}

/** Keep upline path to focus + full subtree below focus (hide focus siblings). */
function pruneToFocusPathAndDescendants(node, focusId) {
  if (!node || !focusId) return node;
  const fid = String(focusId);
  const nid = String(node.contact?.customer_id ?? node.contact?.id ?? "");

  if (nid === fid) {
    return node;
  }

  for (const child of node.children || []) {
    if (treeContainsId(child, fid)) {
      const prunedChild = pruneToFocusPathAndDescendants(child, focusId);
      if (!prunedChild) return null;
      return { ...node, children: [prunedChild] };
    }
  }

  return null;
}

function collectSubtreeIds(node, ids = new Set()) {
  if (!node) return ids;
  ids.add(String(node.contact?.customer_id ?? node.contact?.id ?? ""));
  for (const ch of node.children || []) {
    collectSubtreeIds(ch, ids);
  }
  return ids;
}

function contactReportsTo(c, focusId) {
  const fid = String(focusId);
  const rt =
    c.report_to != null && c.report_to !== "" ? String(c.report_to) : "";
  if (rt === fid) return true;
  const pc =
    c.parent_customer_id != null && c.parent_customer_id !== ""
      ? String(c.parent_customer_id)
      : "";
  return pc === fid;
}

/**
 * Same row as parent-account chart: direct family members below focus.
 * Parent view (focus = family root): parent_customer_id or report_to = focus.
 * Member view: open member green; same-family row below (siblings + report_to children).
 */
function attachRowBelowFocus(focusNode, allContacts, focusId, familyRootId) {
  if (!focusNode || !focusId) return focusNode;
  const inTree = collectSubtreeIds(focusNode);
  const fid = String(focusId);
  const familyId = familyRootId ? String(familyRootId) : fid;
  const isFamilyRoot = fid === familyId;

  const existingChildIds = new Set(
    (focusNode.children || []).map((ch) =>
      String(ch.contact?.customer_id ?? ch.contact?.id ?? ""),
    ),
  );

  const rowContacts = (allContacts || []).filter((c) => {
    const cid = String(c.customer_id ?? c.id);
    if (!cid || cid === fid) return false;
    if (inTree.has(cid) || existingChildIds.has(cid)) return false;

    if (contactReportsTo(c, fid)) return true;

    if (isFamilyRoot) return false;

    const pc =
      c.parent_customer_id != null && c.parent_customer_id !== ""
        ? String(c.parent_customer_id)
        : "";
    return pc === familyId;
  });

  if (!rowContacts.length) return focusNode;

  const rowNodes = rowContacts.map((c) => ({
    contact: formatContactRow(c),
    children: [],
  }));

  return {
    ...focusNode,
    children: [...(focusNode.children || []), ...rowNodes],
  };
}

/** Any Contact Hierarchy list row not yet on chart → flat row under focus. */
function attachMissingListContacts(
  focusNode,
  allContacts,
  listIds,
  skipIds = new Set(),
) {
  if (!focusNode || !listIds?.size) return focusNode;
  const inTree = collectSubtreeIds(focusNode);
  const existingChildIds = new Set(
    (focusNode.children || []).map((ch) =>
      String(ch.contact?.customer_id ?? ch.contact?.id ?? ""),
    ),
  );

  const missing = [...listIds].filter(
    (id) =>
      !inTree.has(id) &&
      !skipIds.has(id) &&
      !existingChildIds.has(id) &&
      id !== String(focusNode.contact?.customer_id ?? focusNode.contact?.id),
  );

  if (!missing.length) return focusNode;

  const byId = new Map(
    (allContacts || []).map((c) => [
      String(c.customer_id ?? c.id),
      formatContactRow(c),
    ]),
  );

  const rowNodes = missing
    .map((id) => byId.get(id))
    .filter(Boolean)
    .map((contact) => ({ contact, children: [] }));

  return {
    ...focusNode,
    children: [...(focusNode.children || []), ...rowNodes],
  };
}

function mapTree(node, fn) {
  if (!node) return null;
  const next = fn(node);
  const children = (next.children || []).map((ch) => mapTree(ch, fn)).filter(Boolean);
  return { ...next, children };
}

function buildSingleChartRoot({
  forest,
  currentId,
  currentInTree,
  showApexParent,
  hierarchyParent,
  hierarchyFamilyRoot,
  currentCustomer,
}) {
  const familyRootId = hierarchyFamilyRoot?.customer_id
    ? String(hierarchyFamilyRoot.customer_id)
    : "";

  for (const n of forest) {
    if (treeContainsId(n, currentId)) {
      const topId = String(n.contact.customer_id ?? n.contact.id);
      const apexVariant =
        familyRootId && topId === familyRootId && topId !== String(currentId)
          ? "parent-apex"
          : showApexParent &&
              hierarchyParent &&
              topId === String(hierarchyParent.customer_id)
            ? "parent-apex"
            : "default";
      return { node: n, apexVariant };
    }
  }

  if (showApexParent && hierarchyParent) {
    return {
      node: {
        contact: formatContactRow(hierarchyParent),
        children: forest,
      },
      apexVariant: "parent-apex",
    };
  }

  if (currentCustomer?.customer_id && !currentInTree) {
    return {
      node: {
        contact: formatContactRow(currentCustomer),
        children: forest,
      },
      apexVariant: "default",
    };
  }

  if (forest.length >= 1) {
    return { node: forest[0], apexVariant: "default" };
  }

  if (currentCustomer?.customer_id) {
    return {
      node: {
        contact: formatContactRow(currentCustomer),
        children: [],
      },
      apexVariant: "default",
    };
  }

  return null;
}

/**
 * Org chart from report_to. Parent / account always on top; members only below.
 */
export default function CustomerContactHierarchyChart({
  contacts = [],
  hierarchyParent = null,
  hierarchyFamilyRoot = null,
  siblingContacts = [],
  hierarchyMembers = [],
  currentCustomer = null,
  dashboardBase = "user-dashboard",
}) {
  const currentId =
    currentCustomer?.customer_id != null
      ? String(currentCustomer.customer_id)
      : "";

  const merged = mergeAllHierarchyContacts({
    contacts,
    hierarchyParent,
    hierarchyFamilyRoot,
    siblingContacts,
    hierarchyMembers,
    currentCustomer,
  });

  const hierarchyListIds = collectHierarchyListIds({
    hierarchyParent,
    siblingContacts,
    hierarchyMembers,
    currentCustomer,
  });

  const hasApexParent = Boolean(hierarchyParent?.customer_id);
  const parentId = hasApexParent ? String(hierarchyParent.customer_id) : "";
  const parentInTree = parentId
    ? merged.some((c) => String(c.customer_id ?? c.id) === parentId)
    : false;
  const showApexParent = hasApexParent && !parentInTree;

  const familyRootId =
    hierarchyFamilyRoot?.customer_id ?? hierarchyParent?.customer_id ?? null;

  const viewingFamilyRoot =
    familyRootId && currentId === String(familyRootId);

  const prepared = viewingFamilyRoot
    ? normalizeReportToAccount(merged, familyRootId)
    : merged;

  const forest = buildCustomerContactReportTree(prepared);

  const currentInTree = merged.some(
    (c) => String(c.customer_id ?? c.id) === currentId,
  );

  let chartRoot = buildSingleChartRoot({
    forest,
    currentId,
    currentInTree,
    showApexParent,
    hierarchyParent,
    hierarchyFamilyRoot,
    currentCustomer,
  });

  const familyRootIdStr = familyRootId != null ? String(familyRootId) : "";

  if (chartRoot?.node && currentId) {
    const beforePrune = chartRoot.node;
    let working =
      familyRootIdStr && currentId !== familyRootIdStr
        ? pruneToFocusPathAndDescendants(chartRoot.node, currentId) ??
          chartRoot.node
        : chartRoot.node;

    const uplineIds =
      familyRootIdStr && currentId !== familyRootIdStr
        ? collectUplinkIds(beforePrune, currentId)
        : new Set();

    working = mapTree(working, (n) => {
      const nid = String(n.contact?.customer_id ?? n.contact?.id ?? "");
      if (nid === currentId) {
        let next = attachRowBelowFocus(n, merged, currentId, familyRootId);
        next = attachMissingListContacts(
          next,
          merged,
          hierarchyListIds,
          uplineIds,
        );
        return next;
      }
      return n;
    });

    if (currentId === familyRootIdStr) {
      working = attachMissingListContacts(
        working,
        merged,
        hierarchyListIds,
        new Set(),
      );
    } else if (hierarchyParent && !treeContainsId(working, hierarchyParent.customer_id)) {
      const parentRow = merged.find(
        (c) =>
          String(c.customer_id ?? c.id) ===
          String(hierarchyParent.customer_id),
      );
      if (parentRow) {
        working = {
          contact: formatContactRow(parentRow),
          children: [working],
        };
        chartRoot = { ...chartRoot, apexVariant: "parent-apex" };
      }
    }

    chartRoot = { ...chartRoot, node: working };
  }

  if (!chartRoot?.node) {
    return (
      <p className="py-6 text-center text-sm text-gray-500">
        No contact links to show in chart.
      </p>
    );
  }

  return (
    <div className="overflow-x-hidden py-2">
      <div className="mx-auto w-full max-w-6xl px-2 sm:px-4">
        <TreeBranch
          node={chartRoot.node}
          currentId={currentId}
          dashboardBase={dashboardBase}
          apexVariant={chartRoot.apexVariant}
          depth={0}
        />
      </div>

      <p className="mt-4 text-center text-[11px] text-gray-500">
        Parent account at the top; members below are ordered by{" "}
        <span className="font-medium">report_to</span> (who was added under whom).
      </p>
    </div>
  );
}
