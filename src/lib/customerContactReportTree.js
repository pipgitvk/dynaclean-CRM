function contactKey(contact) {
  if (contact == null) return "";
  return String(contact.id ?? contact.customer_id ?? "");
}

/** Build report_to tree from customer member rows (View Contacts API). */
export function buildCustomerContactReportTree(contacts) {
  if (!contacts?.length) return [];
  const contactMap = new Map(
    contacts.map((c) => [contactKey(c), { contact: c, children: [] }]),
  );
  const roots = [];
  const linkedAsChild = new Set();

  for (const contact of contacts) {
    const key = contactKey(contact);
    const node = contactMap.get(key);
    if (!node) continue;
    const parentKey =
      contact.report_to != null && contact.report_to !== ""
        ? String(contact.report_to)
        : "";
    if (parentKey) {
      const parent = contactMap.get(parentKey);
      if (parent) {
        parent.children.push(node);
        linkedAsChild.add(key);
      } else {
        roots.push(node);
      }
    } else {
      roots.push(node);
    }
  }

  return roots.filter((n) => !linkedAsChild.has(contactKey(n.contact)));
}
