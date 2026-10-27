"use client";

import { useState, useEffect } from "react";
import { X } from "lucide-react";

function formatDate(dateStr) {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function formatAmount(n) {
  if (n == null || n === "") return "₹0.00";
  const absValue = Math.abs(Number(n));
  return "₹" + absValue.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function PurchaseLedgerModal({ companyName, onClose }) {
  const [ledgerRows, setLedgerRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function fetchPurchasesAndPayments() {
      try {
        setLoading(true);
        setError(null);
        
        // Fetch purchases
        const purchasesRes = await fetch("/api/stock-request", { credentials: "include" });
        if (!purchasesRes.ok) throw new Error("Failed to fetch purchases");
        const purchases = await purchasesRes.json();
        const filteredPurchases = purchases.filter(p => p.client_company_name === companyName);
        
        // Get all purchase IDs for this company
        const purchaseIds = filteredPurchases.map(p => `PP${p.id}`);
        
        // Fetch payments (statements)
        const statementsRes = await fetch("/api/statements", { credentials: "include" });
        if (!statementsRes.ok) throw new Error("Failed to fetch statements");
        const statementsData = await statementsRes.json();
        const statements = statementsData.statements || [];
        
        // Helper function to parse linked_purchase_ids
        const getLinkedKeys = (stmt) => {
          const raw = stmt?.linked_purchase_ids;
          if (raw == null || String(raw).trim() === "") return [];
          let arr = null;
          try {
            const parsed = JSON.parse(String(raw));
            if (Array.isArray(parsed)) arr = parsed;
          } catch {
            arr = String(raw).split(",").map(s => s.trim()).filter(Boolean);
          }
          const keys = [];
          for (const v of arr) {
            if (v == null) continue;
            const s = String(v).trim().toUpperCase();
            if (!s) continue;
            if (/^(PP|PS|SP)\d+$/.test(s)) {
              keys.push(s.startsWith("SP") ? `PS${s.slice(2)}` : s);
            } else if (/^\d+$/.test(s)) {
              keys.push(`PP${s}`);
            }
          }
          return keys;
        };
        
        // Build ledger rows: purchases (credit) + payments (debit) linked to these purchases
        const rows = [];
        
        filteredPurchases.forEach(purchase => {
          rows.push({
            type: 'purchase',
            date: purchase.created_at,
            company_name: purchase.client_company_name,
            invoice_number: purchase.invoice_number || `Req #${purchase.id}`,
            vch_type: 'Purchase',
            debit: 0,
            credit: Number(purchase.net_amount || 0),
            purchase_id: purchase.id,
          });
        });
        
        // Add only payments that are linked to purchases of this company
        statements.forEach(stmt => {
          const linkedKeys = getLinkedKeys(stmt);
          // Check if any of the linked purchase IDs belong to this company
          const isLinkedToThisCompany = linkedKeys.some(key => purchaseIds.includes(key));
          
          if (isLinkedToThisCompany) {
            rows.push({
              type: 'payment',
              date: stmt.date || stmt.created_at,
              company_name: companyName,
              invoice_number: stmt.trans_id,
              vch_type: 'Payment',
              debit: Number(stmt.amount || 0),
              credit: 0,
              statement_id: stmt.id,
            });
          }
        });
        
        // Sort by date ascending
        rows.sort((a, b) => new Date(a.date) - new Date(b.date));
        setLedgerRows(rows);
      } catch (e) {
        console.error("Error fetching purchase ledger:", e);
        setError(e.message);
      } finally {
        setLoading(false);
      }
    }
    fetchPurchasesAndPayments();
  }, [companyName]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/60 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-hidden">
        <div className="flex items-center justify-between p-5 border-b border-gray-200 sticky top-0 bg-white z-10">
          <div>
            <h2 className="text-xl font-bold text-gray-800">{companyName}</h2>
            <p className="text-sm text-gray-500 mt-1">Purchase Ledger</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X size={24} className="text-gray-600" />
          </button>
        </div>
        <div className="p-5 overflow-y-auto max-h-[calc(90vh-120px)]">
          {loading ? (
            <div className="py-10 text-center text-gray-500">Loading ledger...</div>
          ) : error ? (
            <div className="py-10 text-center text-red-500">Error: {error}</div>
          ) : ledgerRows.length === 0 ? (
            <div className="py-10 text-center text-gray-400">No purchases or payments found for this company</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead className="bg-gray-100 sticky top-0">
                  <tr>
                    <th className="border border-gray-200 p-3 text-left font-semibold text-gray-700">Date</th>
                    <th className="border border-gray-200 p-3 text-left font-semibold text-gray-700">Company Name</th>
                    <th className="border border-gray-200 p-3 text-left font-semibold text-gray-700">Ref #</th>
                    <th className="border border-gray-200 p-3 text-left font-semibold text-gray-700">Vch Type</th>
                    <th className="border border-gray-200 p-3 text-right font-semibold text-gray-700">Debit</th>
                    <th className="border border-gray-200 p-3 text-right font-semibold text-gray-700">Credit</th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    let runningBal = 0;
                    let totalDebit = 0;
                    let totalCredit = 0;
                    let finalBalance = 0;
                    
                    // First pass: calculate totals
                    ledgerRows.forEach((row) => {
                      totalDebit += row.debit;
                      totalCredit += row.credit;
                    });
                    
                    // Calculate final balance
                    finalBalance = totalCredit - totalDebit;
                    
                    return [
                      ...ledgerRows.map((row, index) => {
                        const isPayment = row.type === 'payment';
                        return (
                          <tr 
                            key={`${row.type}-${row.purchase_id || row.statement_id}-${index}`} 
                            className={`border-t border-gray-200 ${isPayment ? 'hover:bg-green-50' : 'hover:bg-blue-50'}`}
                          >
                            <td className="border border-gray-200 p-3">{formatDate(row.date)}</td>
                            <td className="border border-gray-200 p-3">{row.company_name}</td>
                            <td className="border border-gray-200 p-3">{row.invoice_number}</td>
                            <td className={`border border-gray-200 p-3 font-medium ${isPayment ? 'text-green-600' : 'text-purple-600'}`}>
                              {row.vch_type}
                            </td>
                            <td className={`border border-gray-200 p-3 text-right ${isPayment ? 'font-semibold text-green-700' : ''}`}>
                              {formatAmount(row.debit)}
                            </td>
                            <td className={`border border-gray-200 p-3 text-right ${!isPayment ? 'font-semibold text-green-700' : ''}`}>
                              {formatAmount(row.credit)}
                            </td>
                          </tr>
                        );
                      }),
                      // Totals row
                      <tr key="totals" className="border-t-2 border-gray-400 bg-gray-100">
                        <td colSpan="4" className="border border-gray-200 p-3 font-bold text-gray-800">TOTAL</td>
                        <td className="border border-gray-200 p-3 text-right font-bold text-gray-800">
                          {formatAmount(totalDebit)}
                        </td>
                        <td className="border border-gray-200 p-3 text-right font-bold text-gray-800">
                          {formatAmount(totalCredit)}
                        </td>
                      </tr>,
                      // Difference row
                      <tr key="difference" className="border-t-2 border-gray-400 bg-blue-50">
                        <td colSpan="4" className="border border-gray-200 p-3 font-bold text-blue-800">Balance c/d</td>
                        <td colSpan="2" className="border border-gray-200 p-3 text-right font-bold text-blue-800 text-lg">
                          {formatAmount(finalBalance)}
                        </td>
                      </tr>
                    ];
                  })()}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
