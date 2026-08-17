import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";
import { EXCLUDE_PROFORMA_INVOICE_SQL_I } from "@/lib/ledgerInvoiceFilters";

export const dynamic = "force-dynamic";

function keyFor(name, customerId) {
  const n = String(name || "").trim().toLowerCase();
  const c =
    customerId != null && String(customerId).trim() !== ""
      ? "c_" + String(customerId).trim()
      : "n_" + n;
  return n + "|" + c;
}

export async function GET(req) {
  const payload = await getSessionPayload();
  if (!payload) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const conn = await getDbConnection();

    // Map key = name.toLowerCase() + '|' + customer_id (or 'n_' + name if no cid)
    const rows = new Map();

    const addRow = (rawName, customerId, extras = {}) => {
      const name = String(rawName || "").trim();
      if (!name) return;
      const k = keyFor(name, customerId);
      if (!rows.has(k)) {
        rows.set(k, { name, customer_id: customerId || undefined, ...extras });
      } else {
        const existing = rows.get(k);
        rows.set(k, {
          ...existing,
          ...Object.fromEntries(
            Object.entries(extras).filter(
              ([, v]) => v != null && v !== "" && v !== 0
            )
          ),
        });
      }
    };

    // ── Per-name aggregates (no customer_id granularity) ──────────────
    const manualDrByName = new Map();
    const manualCrByName = new Map();
    const invoicesByName = new Map();

    // ── 1a. INVOICES — name-level total (exact same filter as buildLedgerForParty)
    // buildLedgerForParty matches invoices by NAME ONLY, so use name-level sums
    // for the invoice/receivable side of every row with that name.
    try {
      const [invNameRows] = await conn.execute(
        `SELECT
           TRIM(i.customer_name) AS buyer_name,
           COUNT(*) AS invoice_count,
           SUM(i.grand_total) AS total_amount,
           SUM(COALESCE(i.amount_paid, 0)) AS total_paid,
           SUM(COALESCE(i.balance_amount, 0)) AS total_balance_amount,
           MAX(NULLIF(TRIM(i.customer_phone), '')) AS customer_phone,
           MAX(NULLIF(TRIM(i.billing_address), '')) AS billing_address,
           MAX(NULLIF(TRIM(i.gst_number), '')) AS gstin
         FROM invoices i
         WHERE i.customer_name IS NOT NULL
           AND TRIM(i.customer_name) != ''
           AND ${EXCLUDE_PROFORMA_INVOICE_SQL_I}
         GROUP BY TRIM(i.customer_name)`
      );
      for (const r of invNameRows) {
        invoicesByName.set(String(r.buyer_name).trim().toLowerCase(), {
          phone: r.customer_phone || undefined,
          billing_address: r.billing_address || undefined,
          gstin: r.gstin || undefined,
          _invTotal: Number(r.total_amount || 0),
          _invPaid: Number(r.total_paid || 0),
          _invBalance: Number(r.total_balance_amount || 0),
          _invCount: Number(r.invoice_count || 0),
        });
      }
    } catch (e) {
      console.warn("[parties list] invoices by name:", e?.message);
    }

    // ── 1b. INVOICE BUYERS — authoritative grouping per (name, customer_id)
    // Only used to seed the distinct (name, cid) rows, no amount aggregation here.
    try {
      const [invBuyerRows] = await conn.execute(
        `SELECT DISTINCT
           COALESCE(i.customer_id, c.customer_id) AS customer_id,
           TRIM(i.customer_name) AS buyer_name,
           MAX(NULLIF(TRIM(i.customer_phone), '')) AS customer_phone,
           MAX(NULLIF(TRIM(i.billing_address), '')) AS billing_address,
           MAX(NULLIF(TRIM(i.gst_number), '')) AS gstin
         FROM invoices i
         LEFT JOIN customers c
           ON LOWER(TRIM(CONCAT(c.first_name, ' ', COALESCE(c.last_name, '')))) = LOWER(TRIM(i.customer_name))
           OR LOWER(TRIM(c.company)) = LOWER(TRIM(i.customer_name))
           OR LOWER(TRIM(c.first_name)) = LOWER(TRIM(i.customer_name))
         WHERE i.customer_name IS NOT NULL
           AND TRIM(i.customer_name) != ''
           AND ${EXCLUDE_PROFORMA_INVOICE_SQL_I}
         GROUP BY TRIM(i.customer_name), COALESCE(i.customer_id, c.customer_id)`
      );
      for (const r of invBuyerRows) {
        addRow(r.buyer_name, r.customer_id, {
          phone: r.customer_phone || undefined,
          billing_address: r.billing_address || undefined,
          gstin: r.gstin || undefined,
        });
      }
    } catch (e) {
      console.warn("[parties list] invoice buyers:", e?.message);
    }

    // ── 2. Customers table — (name, customer_id) pair
    try {
      const [custRows] = await conn.execute(
        `SELECT
           customer_id,
           TRIM(company) AS company,
           TRIM(CONCAT_WS(' ', first_name, last_name)) AS full_name,
           phone,
           address AS billing_address,
           gstin
         FROM customers
         WHERE (company IS NOT NULL AND TRIM(company) <> '')
            OR (first_name IS NOT NULL AND TRIM(first_name) <> '')`
      );
      for (const r of custRows) {
        addRow(r.company || r.full_name, r.customer_id, {
          phone: r.phone,
          billing_address: r.billing_address,
          gstin: r.gstin,
        });
      }
    } catch (e) {
      console.warn("[parties list] customers:", e?.message);
    }

    // ── 3. product_stock_request — suppliers, group by (name, cid)
    try {
      const [psrRows] = await conn.execute(
        `SELECT
           TRIM(client_company_name) AS client_company_name,
           TRIM(client_name) AS client_name,
           TRIM(client_number) AS client_number,
           TRIM(client_gstin) AS client_gstin,
           TRIM(customer_address) AS customer_address,
           customer_id,
           SUM(COALESCE(net_amount, 0)) AS total_purchase,
           COUNT(*) AS purchase_count
         FROM product_stock_request
         WHERE (client_company_name IS NOT NULL AND TRIM(client_company_name) <> '')
            OR (client_name IS NOT NULL AND TRIM(client_name) <> '')
         GROUP BY
           TRIM(client_company_name),
           TRIM(client_name),
           TRIM(client_number),
           TRIM(client_gstin),
           TRIM(customer_address),
           customer_id`
      );
      for (const r of psrRows) {
        addRow(r.client_company_name || r.client_name, r.customer_id, {
          phone: r.client_number,
          gstin: r.client_gstin,
          billing_address: r.customer_address,
          _psrTotal: Number(r.total_purchase || 0),
          _psrCount: Number(r.purchase_count || 0),
        });
      }
    } catch (e) {
      console.warn("[parties list] psr:", e?.message);
    }

    // ── 4. spare_stock_request
    try {
      const [spareRows] = await conn.execute(
        `SELECT
           TRIM(client_company_name) AS client_company_name,
           TRIM(client_name) AS client_name,
           TRIM(client_number) AS client_number,
           TRIM(client_gstin) AS client_gstin,
           TRIM(customer_address) AS customer_address,
           customer_id,
           SUM(COALESCE(net_amount, 0)) AS total_purchase,
           COUNT(*) AS purchase_count
         FROM spare_stock_request
         WHERE (client_company_name IS NOT NULL AND TRIM(client_company_name) <> '')
            OR (client_name IS NOT NULL AND TRIM(client_name) <> '')
         GROUP BY
           TRIM(client_company_name),
           TRIM(client_name),
           TRIM(client_number),
           TRIM(client_gstin),
           TRIM(customer_address),
           customer_id`
      );
      for (const r of spareRows) {
        const nm = r.client_company_name || r.client_name;
        const k = keyFor(nm, r.customer_id);
        addRow(nm, r.customer_id, {
          phone: r.client_number,
          gstin: r.client_gstin,
          billing_address: r.customer_address,
        });
        const existing = rows.get(k);
        if (existing) {
          existing._spareTotal =
            Number(existing._spareTotal || 0) + Number(r.total_purchase || 0);
        }
      }
    } catch (_) {
      // table may not exist
    }

    // ── 5. ledger_entries — per buyer_name (no cid), also fill manual maps
    try {
      const [leRows] = await conn.execute(
        `SELECT
           TRIM(buyer_name) AS buyer_name,
           COALESCE(SUM(debit), 0) AS dr,
           COALESCE(SUM(credit), 0) AS cr
         FROM ledger_entries
         WHERE buyer_name IS NOT NULL AND TRIM(buyer_name) <> ''
         GROUP BY TRIM(buyer_name)`
      );
      for (const r of leRows) {
        const nm = String(r.buyer_name).trim();
        const nmLow = nm.toLowerCase();
        manualDrByName.set(nmLow, Number(r.dr) || 0);
        manualCrByName.set(nmLow, Number(r.cr) || 0);
        // Also ensure a row exists for this name (customer_id = null bucket)
        // only if no rows exist for this name at all
        const hasAny = Array.from(rows.keys()).some((k) =>
          k.startsWith(nmLow + "|")
        );
        if (!hasAny) addRow(nm, null, {});
      }
    } catch (e) {
      console.warn("[parties list] ledger_entries:", e?.message);
    }

    // ── 6. Return Completed credit notes (warehouse-in done)
    const returnCrByName = new Map();
    const returnCrByCid = new Map();
    try {
      const existingReturnVch = new Set();
      try {
        const [retRows] = await conn.execute(
          `SELECT LOWER(TRIM(buyer_name)) AS buyer, LOWER(TRIM(vch_no)) AS vch_no
           FROM ledger_entries
           WHERE vch_type IN ('Return', 'Return Completed')
             AND buyer_name IS NOT NULL`
        );
        for (const r of retRows) {
          existingReturnVch.add(`${r.buyer || ""}|${r.vch_no || ""}`);
        }
      } catch (_) {}

      const [cnRows] = await conn.execute(
        `SELECT
           cn.id,
           cn.grand_total,
           cn.invoice_no,
           cn.credit_note_number,
           TRIM(cn.company_name) AS cn_company,
           TRIM(qr.company_name) AS qr_company,
           TRIM(no.client_name) AS client_name,
           qr.customer_id
         FROM credit_notes cn
         LEFT JOIN neworder no
           ON CAST(cn.order_id AS CHAR) COLLATE utf8mb4_unicode_ci
            = CAST(no.order_id AS CHAR) COLLATE utf8mb4_unicode_ci
         LEFT JOIN quotations_records qr
           ON no.quote_number = qr.quote_number
         WHERE COALESCE(no.warehouse_in_done, 0) = 1`
      );

      for (const r of cnRows) {
        const names = [r.cn_company, r.qr_company, r.client_name]
          .filter(Boolean)
          .map((s) => String(s).trim().toLowerCase());
        const vchNos = [r.invoice_no, r.credit_note_number]
          .filter(Boolean)
          .map((s) => String(s).trim().toLowerCase());
        const alreadyInLedger = names.some((n) =>
          vchNos.some((v) => existingReturnVch.has(`${n}|${v}`))
        );
        if (alreadyInLedger) continue;

        const amt = Number(r.grand_total) || 0;
        if (amt <= 0) continue;

        const primaryName = (
          r.cn_company ||
          r.qr_company ||
          r.client_name ||
          ""
        )
          .trim()
          .toLowerCase();
        if (primaryName) {
          returnCrByName.set(primaryName, (returnCrByName.get(primaryName) || 0) + amt);
        }
        if (r.customer_id != null && String(r.customer_id).trim() !== "") {
          const ck = String(r.customer_id).trim();
          returnCrByCid.set(ck, (returnCrByCid.get(ck) || 0) + amt);
        }
      }
    } catch (e) {
      console.warn("[parties list] return completed:", e?.message);
    }

    const partiesArr = Array.from(rows.values());

    // ── Per-party balance
    // Invoice side uses NAME-ONLY totals (matches buildLedgerForParty logic
    // where invoice SQL is name-only match, not customer_id scoped).
    // Purchases (PSR/spare) are per (name, customer_id) — already correct.
    const out = [];
    for (const p of partiesArr) {
      const nmLow = p.name.toLowerCase();

      const invAgg = invoicesByName.get(nmLow) || null;
      const invTotal = invAgg ? invAgg._invTotal : 0;
      const invPaid = invAgg ? invAgg._invPaid : 0;
      const invBalance = invAgg ? invAgg._invBalance : 0;

      const receivableFromInvoices = invAgg
        ? invBalance
        : Math.max(0, invTotal - invPaid);

      const purchasesPayable =
        Number(p._psrTotal || 0) + Number(p._spareTotal || 0);

      // Manual dr/cr: apply name-level aggregate to all rows for that name
      const mDr = manualDrByName.get(nmLow) || 0;
      const mCr = manualCrByName.get(nmLow) || 0;

      let returnCr = returnCrByName.get(nmLow) || 0;
      if (
        returnCr === 0 &&
        p.customer_id != null &&
        String(p.customer_id).trim() !== ""
      ) {
        returnCr = returnCrByCid.get(String(p.customer_id).trim()) || 0;
      }

      const debitSide = receivableFromInvoices + mDr;
      const creditSide = purchasesPayable + mCr + returnCr;
      const net = debitSide - creditSide;

      let amountType = "flat";
      if (net > 0.01) amountType = "receivable";
      else if (net < -0.01) amountType = "payable";

      // Merge contact info from invoice name-level data (if not already on row)
      let phoneOut = p.phone;
      let billingOut = p.billing_address;
      let gstinOut = p.gstin;
      if (invAgg) {
        if (!phoneOut && invAgg.phone) phoneOut = invAgg.phone;
        if (!billingOut && invAgg.billing_address) billingOut = invAgg.billing_address;
        if (!gstinOut && invAgg.gstin) gstinOut = invAgg.gstin;
      }

      const {
        _invTotal: _1,
        _invPaid: _2,
        _invBalance: _3,
        _invCount: _4,
        _psrTotal: _5,
        _psrCount: _6,
        _spareTotal: _7,
        phone: _origPhone,
        billing_address: _origBill,
        gstin: _origGstin,
        ...rest
      } = p;

      out.push({
        ...rest,
        phone: phoneOut,
        billing_address: billingOut,
        gstin: gstinOut,
        balance: Number(net.toFixed(2)),
        amountType,
      });
    }

    const filtered = out.filter((p) => Math.abs(Number(p.balance || 0)) > 0.01);

    filtered.sort((a, b) => {
      const an = Math.abs(a.balance || 0);
      const bn = Math.abs(b.balance || 0);
      if (bn !== an) return bn - an;
      const nc = a.name.localeCompare(b.name);
      if (nc !== 0) return nc;
      const ac = a.customer_id ? String(a.customer_id) : "";
      const bc = b.customer_id ? String(b.customer_id) : "";
      return ac.localeCompare(bc);
    });

    return NextResponse.json({ success: true, parties: filtered });
  } catch (err) {
    console.error("[parties list GET]", err?.message);
    return NextResponse.json(
      { error: "DB error", message: err?.message },
      { status: 500 }
    );
  }
}
