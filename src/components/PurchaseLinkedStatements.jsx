"use client";

import { useState, useEffect } from 'react';
import { Eye, ExternalLink } from 'lucide-react';

const formatDisplayDate = (value) => {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value);
  return parsed.toLocaleDateString("en-IN");
};

export default function PurchaseLinkedStatements({ purchaseId, onClose }) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!purchaseId) return;

    const fetchData = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/purchase-statements/${purchaseId}`);
        const result = await response.json();
        
        if (!response.ok) {
          throw new Error(result.error || 'Failed to fetch data');
        }
        
        setData(result);
      } catch (err) {
        setError(err.message);
        console.error('Error fetching purchase statements:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [purchaseId]);

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/60">
        <div className="bg-white rounded-lg shadow-xl p-6">
          <div className="text-center">Loading...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/60" onClick={onClose}>
        <div className="bg-white rounded-lg shadow-xl p-6" onClick={(e) => e.stopPropagation()}>
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-red-600">Error</h3>
            <button onClick={onClose} className="text-gray-500 hover:text-gray-700">✕</button>
          </div>
          <p className="text-red-600">{error}</p>
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/60" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[85vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b">
          <div>
            <h3 className="text-lg font-semibold">Linked Payment Statements</h3>
            <p className="text-sm text-gray-600">
              Purchase #{data.purchase.id} - {data.purchase.product_name}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 text-xl">✕</button>
        </div>

        {/* Summary */}
        <div className="p-4 bg-gray-50 border-b">
          <div className="grid grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-gray-600">Net Amount:</span>
              <div className="font-semibold text-blue-700">
                ₹{Number(data.purchase.net_amount || 0).toLocaleString()}
              </div>
            </div>
            <div>
              <span className="text-gray-600">Total Linked:</span>
              <div className="font-semibold text-green-700">
                ₹{data.summary.totalLinkedAmount.toLocaleString()}
              </div>
            </div>
            <div>
              <span className="text-gray-600">Remaining:</span>
              <div className={`font-semibold ${data.summary.remainingAmount > 0 ? 'text-orange-600' : 'text-green-600'}`}>
                ₹{data.summary.remainingAmount.toLocaleString()}
              </div>
            </div>
            <div>
              <span className="text-gray-600">Statements:</span>
              <div className="font-semibold">{data.summary.statementCount}</div>
            </div>
          </div>
        </div>

        {/* Statements List */}
        <div className="p-4 overflow-y-auto max-h-96">
          {data.statements.length === 0 ? (
            <div className="text-center text-gray-500 py-8">
              No payment statements linked to this purchase yet.
            </div>
          ) : (
            <div className="space-y-3">
              {data.statements.map((statement) => (
                <div key={statement.id} className="border rounded-lg p-4 hover:bg-gray-50">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="font-semibold">Statement #{statement.id}</span>
                        <span className="text-sm text-gray-600">Trans ID: {statement.trans_id}</span>
                        <span className={`px-2 py-1 rounded text-xs ${
                          statement.type === 'Debit' 
                            ? 'bg-red-100 text-red-800' 
                            : 'bg-green-100 text-green-800'
                        }`}>
                          {statement.type}
                        </span>
                        <span className={`px-2 py-1 rounded text-xs ${
                          statement.invoice_status === 'Settled' 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {statement.invoice_status || 'Unsettled'}
                        </span>
                      </div>
                      
                      <div className="text-sm text-gray-600 mb-2">
                        {statement.description || '—'}
                      </div>
                      
                      <div className="flex items-center gap-4 text-sm">
                        <span className="text-gray-600">
                          Date: {formatDisplayDate(statement.date)}
                        </span>
                        <span className="font-semibold text-lg">
                          ₹{Number(statement.amount || 0).toLocaleString()}
                        </span>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <a
                        href={`/admin-dashboard/statements?search=${statement.trans_id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded"
                        title="View in Statements"
                      >
                        <ExternalLink size={16} />
                      </a>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="p-4 border-t bg-gray-50">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
          >
            Close
          </button>
        </div>
      </div>
    </div>
    
);
}
