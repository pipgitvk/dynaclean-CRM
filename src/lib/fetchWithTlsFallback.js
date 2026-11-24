function isTlsHandshakeMismatchError(err) {
  const code = err?.cause?.code || err?.code || "";
  const msg = String(err?.cause?.message || err?.message || "");
  if (code === "ERR_SSL_PACKET_LENGTH_TOO_LONG") return true;
  if (code === "ERR_SSL_WRONG_VERSION_NUMBER") return true;
  if (msg.includes("packet length too long")) return true;
  if (msg.includes("wrong version number")) return true;
  return false;
}

/** Server-side fetch with https→http retry when TLS handshake fails (plain HTTP on 443). */
export async function fetchWithTlsFallback(url, init) {
  try {
    return await fetch(url, init);
  } catch (err) {
    const raw = String(url || "").trim();
    if (raw.startsWith("https://") && isTlsHandshakeMismatchError(err)) {
      const httpUrl = `http://${raw.slice("https://".length)}`;
      return fetch(httpUrl, init);
    }
    throw err;
  }
}