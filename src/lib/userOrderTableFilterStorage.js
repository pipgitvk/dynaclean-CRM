import {
  getOrderTableDefaultDateFrom,
  getOrderTableDefaultDateTo,
} from "@/lib/orderTableDateDefaults";

const PREFIX = "userOrderTable_";

function stored(key) {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(PREFIX + key);
}

/** Admin / all-orders roles: restore list filters until explicit Reset. */
export function readUserOrderTableFilters(useEmptyDateDefaults = false) {
  const defaultFrom = useEmptyDateDefaults
    ? ""
    : getOrderTableDefaultDateFrom();
  const defaultTo = useEmptyDateDefaults ? "" : getOrderTableDefaultDateTo();
  if (typeof window === "undefined") {
    return {
      searchQuery: "",
      statusFilter: "",
      paymentTermsFilter: "",
      dateFrom: defaultFrom,
      dateTo: defaultTo,
      createdByFilter: "",
    };
  }
  const dateFromRaw = stored("dateFrom");
  const dateToRaw = stored("dateTo");
  return {
    searchQuery: stored("searchQuery") ?? "",
    statusFilter: stored("statusFilter") ?? "",
    paymentTermsFilter: stored("paymentTermsFilter") ?? "",
    dateFrom: dateFromRaw !== null ? dateFromRaw : defaultFrom,
    dateTo: dateToRaw !== null ? dateToRaw : defaultTo,
    createdByFilter: stored("createdByFilter") ?? "",
  };
}

export function writeUserOrderTableFilters(state) {
  if (typeof window === "undefined") return;
  localStorage.setItem(PREFIX + "searchQuery", state.searchQuery ?? "");
  localStorage.setItem(PREFIX + "statusFilter", state.statusFilter ?? "");
  localStorage.setItem(
    PREFIX + "paymentTermsFilter",
    state.paymentTermsFilter ?? "",
  );
  localStorage.setItem(PREFIX + "dateFrom", state.dateFrom ?? "");
  localStorage.setItem(PREFIX + "dateTo", state.dateTo ?? "");
  localStorage.setItem(PREFIX + "createdByFilter", state.createdByFilter ?? "");
}

export function clearUserOrderTableFilters() {
  if (typeof window === "undefined") return;
  for (const key of [
    "searchQuery",
    "statusFilter",
    "paymentTermsFilter",
    "dateFrom",
    "dateTo",
    "createdByFilter",
  ]) {
    localStorage.removeItem(PREFIX + key);
  }
}

export function defaultUserOrderTableFilters(useEmptyDateDefaults = false) {
  return {
    searchQuery: "",
    statusFilter: "",
    paymentTermsFilter: "",
    dateFrom: useEmptyDateDefaults ? "" : getOrderTableDefaultDateFrom(),
    dateTo: useEmptyDateDefaults ? "" : getOrderTableDefaultDateTo(),
    createdByFilter: "",
  };
}
