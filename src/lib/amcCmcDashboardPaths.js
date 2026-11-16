const AMC_CMC_SEGMENT = "/amc-cmc";

/** e.g. `/sales-dashboard/amc-cmc` or `/user-dashboard/amc-cmc` */
export function amcCmcRootFromPathname(pathname) {
  const p = String(pathname || "");
  const i = p.indexOf(AMC_CMC_SEGMENT);
  if (i >= 0) return `${p.slice(0, i)}${AMC_CMC_SEGMENT}`;
  return "/user-dashboard/amc-cmc";
}

export function amcCmcPath(pathname, ...parts) {
  const root = amcCmcRootFromPathname(pathname);
  const tail = parts.map((x) => String(x ?? "").trim()).filter(Boolean);
  return tail.length ? `${root}/${tail.join("/")}` : root;
}