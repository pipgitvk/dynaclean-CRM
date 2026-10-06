import { backfillPartyLedgerBalancesFromLines } from "@/lib/partyLedgerSync";

/**
 * Sidebar / list balances from party_ledger_balances (net Dr / Cr / flat).
 */
export async function loadPartyLedgerNetMaps(conn) {
  await backfillPartyLedgerBalancesFromLines(conn);
  const netByCustomerId = new Map();
  const netByPartyName = new Map();
  const netByExactKey = new Map();
  const ledgerCustomerIdByPartyName = new Map();
  const hasSnapshotByCustomerId = new Set();

  try {
    const [rows] = await conn.execute(
      `SELECT customer_id, party_name, net_balance, balance_side
       FROM party_ledger_balances`,
    );
    for (const r of rows) {
      const net = Number(r.net_balance || 0);
      const balance_side = String(r.balance_side || "flat");
      const cid = String(r.customer_id || "").trim();
      const partyName = String(r.party_name || "").trim().toLowerCase();
      if (partyName && cid && cid !== "0" && !ledgerCustomerIdByPartyName.has(partyName)) {
        ledgerCustomerIdByPartyName.set(partyName, cid);
      }
      if (partyName) {
        netByExactKey.set(`${cid}|${partyName}`, {
          net,
          balance_side,
        });
      }
      if (cid) {
        hasSnapshotByCustomerId.add(cid);
        netByCustomerId.set(cid, (netByCustomerId.get(cid) || 0) + net);
      } else if (partyName) {
        netByPartyName.set(partyName, net);
      }
    }
  } catch (_) {
    try {
      const [rows] = await conn.execute(
        `SELECT
           customer_id,
           party_name,
           COALESCE(SUM(debit), 0) AS total_debit,
           COALESCE(SUM(credit), 0) AS total_credit
         FROM party_ledger_lines
         GROUP BY customer_id, party_name`,
      );
      for (const r of rows) {
        const net = Number(r.total_debit || 0) - Number(r.total_credit || 0);
        const cid = String(r.customer_id || "").trim();
        const partyName = String(r.party_name || "").trim().toLowerCase();
        if (partyName && cid && cid !== "0" && !ledgerCustomerIdByPartyName.has(partyName)) {
          ledgerCustomerIdByPartyName.set(partyName, cid);
        }
        if (cid) {
          hasSnapshotByCustomerId.add(cid);
          netByCustomerId.set(cid, (netByCustomerId.get(cid) || 0) + net);
        } else if (partyName) {
          netByPartyName.set(partyName, net);
        }
      }
    } catch (__) {
      /* tables may not exist yet */
    }
  }

  return {
    netByCustomerId,
    netByPartyName,
    netByExactKey,
    ledgerCustomerIdByPartyName,
    hasSnapshotByCustomerId,
  };
}

export function resolveCustomerIdForParty(
  party,
  aliasNames,
  { ledgerCustomerIdByPartyName, customerIdByPartyName },
) {
  const existing =
    party.customer_id != null ? String(party.customer_id).trim() : "";
  if (existing && existing !== "0") return existing;

  const names = Array.isArray(aliasNames) ? aliasNames : [party.name];
  for (const alias of names) {
    const k = String(alias || "").trim().toLowerCase();
    if (!k) continue;
    const fromLedger = ledgerCustomerIdByPartyName?.get(k);
    if (fromLedger) return fromLedger;
  }
  for (const alias of names) {
    const k = String(alias || "").trim().toLowerCase();
    if (!k) continue;
    const fromMaster = customerIdByPartyName?.get(k);
    if (fromMaster) return fromMaster;
  }
  return "";
}

export function resolveLedgerNetForParty(party, maps) {
  const customerIdKey =
    party.customer_id != null ? String(party.customer_id).trim() : "";
  const nameKey = String(party.name || "").trim().toLowerCase();
  const exactKey = `${customerIdKey}|${nameKey}`;

  if (nameKey && maps.netByExactKey?.has(exactKey)) {
    const row = maps.netByExactKey.get(exactKey);
    return {
      net: row.net,
      balance_side: row.balance_side,
      fromLedger: true,
    };
  }

  if (customerIdKey && maps.netByCustomerId.has(customerIdKey)) {
    const net = maps.netByCustomerId.get(customerIdKey);
    let balance_side = "flat";
    if (Math.abs(net) > 0.01) balance_side = net > 0 ? "Dr" : "Cr";
    return {
      net,
      balance_side,
      fromLedger: true,
    };
  }
  if (!customerIdKey && nameKey && maps.netByPartyName.has(nameKey)) {
    const net = maps.netByPartyName.get(nameKey);
    let balance_side = "flat";
    if (Math.abs(net) > 0.01) balance_side = net > 0 ? "Dr" : "Cr";
    return {
      net,
      balance_side,
      fromLedger: true,
    };
  }
  return { net: null, balance_side: null, fromLedger: false };
}
