const TPE_LIST_SCROLL_KEY = "tpe-list-scroll-y";
const TPE_LIST_PAGE_KEY = "tpe-list-page";

export function saveThirdPartyEngineersListReturnState(page) {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(TPE_LIST_SCROLL_KEY, String(window.scrollY));
  sessionStorage.setItem(TPE_LIST_PAGE_KEY, String(page));
}

export function consumeThirdPartyEngineersListReturnPage() {
  if (typeof window === "undefined") return null;
  const savedPage = sessionStorage.getItem(TPE_LIST_PAGE_KEY);
  if (!savedPage) return null;
  sessionStorage.removeItem(TPE_LIST_PAGE_KEY);
  const pageNum = parseInt(savedPage, 10);
  return pageNum > 0 ? pageNum : null;
}

export function consumeThirdPartyEngineersListScrollY() {
  if (typeof window === "undefined") return null;
  const savedScroll = sessionStorage.getItem(TPE_LIST_SCROLL_KEY);
  if (!savedScroll) return null;
  sessionStorage.removeItem(TPE_LIST_SCROLL_KEY);
  const y = parseInt(savedScroll, 10);
  return Number.isFinite(y) ? y : null;
}

export const THIRD_PARTY_ENGINEERS_TABLE_HASH = "engineers-table";
