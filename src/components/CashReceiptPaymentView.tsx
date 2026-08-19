import React, { useMemo, useState } from 'react';
import { formatDDMMYYYY } from '../lib/dateUtils';

interface CashReceiptPaymentViewProps {
  transactions: any[];
  workingDay?: string;
}

export const CashReceiptPaymentView: React.FC<CashReceiptPaymentViewProps> = ({ transactions, workingDay }) => {
  console.log("CashReceiptPaymentView rendering. transactions:", transactions, "workingDay:", workingDay);
  const [selectedDate, setSelectedDate] = useState(workingDay || new Date().toISOString().split('T')[0]);

  const processedTransactions = useMemo(() => {
    if (!transactions) return [];
    return [...transactions]
      .filter(t => (t.type === 'income' || t.type === 'expense' || t.type === 'collection' || t.type === 'disbursement' || t.type === 'manual_journal') && (t.addDate || '') === selectedDate)
      .sort((a, b) => (a.addDate || '').localeCompare(b.addDate || ''));
  }, [transactions, selectedDate]);

  const groupedTransactions = useMemo(() => {
    const receipts: Record<string, any[]> = {};
    const payments: Record<string, any[]> = {};

    processedTransactions.forEach(t => {
      const head = t.category || t.debitAcc || t.creditAcc || 'অন্যান্য';
      if (['income', 'collection'].includes(t.type)) {
        if (!receipts[head]) receipts[head] = [];
        receipts[head].push(t);
      } else if (['expense', 'disbursement'].includes(t.type)) {
        if (!payments[head]) payments[head] = [];
        payments[head].push(t);
      } else if (t.type === 'manual_journal') {
        if (Number(t.amount) > 0) {
            if (!receipts[head]) receipts[head] = [];
            receipts[head].push(t);
        } else {
            if (!payments[head]) payments[head] = [];
            payments[head].push(t);
        }
      }
    });
    return { receipts, payments };
  }, [processedTransactions]);

  try {
    return (
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
        <div className="flex justify-between items-center border-b pb-4">
          <h3 className="font-extrabold text-slate-800 text-sm">নগদ প্রাপ্তি ও পরিশোধ (Receipt and Payment)</h3>
          <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="p-2 border rounded-lg text-xs" />
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Receipts Section */}
          <div className="space-y-4">
            <h4 className="font-bold text-slate-700 text-sm">প্রাপ্তি (Receipts)</h4>
            {Object.keys(groupedTransactions.receipts).length === 0 ? (
              <p className="text-xs text-slate-400">কোনো প্রাপ্তি তথ্য পাওয়া যায়নি</p>
            ) : (
              Object.keys(groupedTransactions.receipts).map(head => (
                <div key={head} className="border border-slate-100 rounded-xl overflow-hidden">
                  <div className="bg-emerald-50 p-2 font-bold text-emerald-800 text-xs border-b">{head}</div>
                  <table className="w-full text-xs">
                    <tbody>
                      {groupedTransactions.receipts[head].map(t => (
                        <tr key={t.id} className="border-b">
                          <td className="p-2">{formatDDMMYYYY(t.addDate || t.date)}</td>
                          <td className="p-2">{t.description || t.note || t.category}</td>
                          <td className="p-2 text-right text-emerald-700 font-bold">{t.amount}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))
            )}
          </div>
          
          {/* Payments Section */}
          <div className="space-y-4">
            <h4 className="font-bold text-slate-700 text-sm">পরিশোধ (Payments)</h4>
            {Object.keys(groupedTransactions.payments).length === 0 ? (
              <p className="text-xs text-slate-400">কোনো পরিশোধ তথ্য পাওয়া যায়নি</p>
            ) : (
              Object.keys(groupedTransactions.payments).map(head => (
                <div key={head} className="border border-slate-100 rounded-xl overflow-hidden">
                  <div className="bg-rose-50 p-2 font-bold text-rose-800 text-xs border-b">{head}</div>
                  <table className="w-full text-xs">
                    <tbody>
                      {groupedTransactions.payments[head].map(t => (
                        <tr key={t.id} className="border-b">
                          <td className="p-2">{formatDDMMYYYY(t.addDate || t.date)}</td>
                          <td className="p-2">{t.description || t.note || t.category}</td>
                          <td className="p-2 text-right text-rose-700 font-bold">{t.amount}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    );
  } catch (error) {
    console.error("CashReceiptPaymentView render error:", error);
    return <div className="p-4 text-rose-500">Error: {error instanceof Error ? error.message : String(error)}</div>;
  }
};
