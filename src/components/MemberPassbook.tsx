import React from 'react';
import { formatDDMMYYYY } from '../lib/dateUtils';

interface MemberPassbookProps {
  txs: any[];
}

export const MemberPassbook: React.FC<MemberPassbookProps> = ({ txs }) => {
  console.log('MemberPassbook txs:', txs);
  
  if (!txs || txs.length === 0) {
    return (
      <div className="text-center py-8 text-xs text-slate-400 font-semibold italic">
        কোনো লেনদেন রেকর্ড পাওয়া যায়নি।
      </div>
    );
  }

  // Map transaction internal titles/types to user-friendly English strings similar to the screenshot
  const getDisplayTypeAndProcess = (tx: any) => {
    const title = tx.title || '';
    const category = tx.category || '';
    let displayType = 'Savings Deposit';
    let process = 'Cash';

    if (category === 'fdr_interest' || title.includes('এফডিআর লাভ') || title.includes('FDR Interest') || title.includes('এফডিআর লভ্যাংশ')) {
      displayType = 'FDR Interest';
      process = 'Transfer';
    } else if (category === 'savings_interest' || title.includes('সঞ্চয় লাভ') || title.includes('Savings Interest') || title.includes('সঞ্চয় লভ্যাংশ')) {
      displayType = 'Savings Interest';
      process = 'Transfer';
    } else if (category === 'share_dividend' || title.includes('শেয়ার লভ্যাংশ') || title.includes('Share Dividend')) {
      displayType = 'Share Dividend';
      process = 'Transfer';
    } else if (title.includes('শেয়ার প্রত্যাহার') || title.includes('শেয়ার ফেরত') || title.includes('Share Refund')) {
      displayType = 'Share Refund';
    } else if (title.includes('শেয়ার') || title.includes('Share')) {
      if (title.includes('উত্তোলন') || title.includes('Withdrawal') || title.includes('ফেরত')) {
        displayType = 'Share Refund';
      } else {
        displayType = 'Share Deposit';
      }
    } else if (title.includes('CBS') || title.includes('cbs')) {
      if (title.includes('উত্তোলন') || title.includes('Withdrawal') || title.includes('ফেরত')) {
        displayType = 'CBS Withdraw';
      } else {
        displayType = 'CBS Deposit';
      }
    } else if (title.includes('LTS') || title.includes('lts')) {
      if (title.includes('উত্তোলন') || title.includes('Withdrawal') || title.includes('ফেরত')) {
        displayType = 'LTS Withdraw';
      } else {
        displayType = 'LTS Deposit';
      }
    } else if (title.includes('উত্তোলন') || title.includes('Withdrawal') || title.includes('ফেরত')) {
      displayType = 'Savings Withdraw';
    } else if (title.includes('আদায়') || title.includes('repayment')) {
      displayType = title.includes('ঋণ') ? 'Installment Paid' : 'Savings Deposit';
    } else if (title.includes('প্রারম্ভিক') || title.includes('Opening')) {
      displayType = 'Opening Balance';
    } else if (title.includes('ঋণ বিতরণ') || title.includes('Disbursed')) {
      displayType = 'Loan Disbursement';
    } else if (title.includes('কিস্তি') || title.includes('Installment')) {
      displayType = 'Installment Paid';
    } else if (title.includes('লাভ') || title.includes('Interest') || title.includes('মুনাফা')) {
      displayType = 'Savings Interest';
      process = 'Transfer';
    }

    return { displayType, process };
  };

  return (
    <div className="w-full bg-white overflow-hidden">
      {/* Table Wrapper for Horizontal Scroll on small screens */}
      <div className="overflow-x-auto w-full">
        <table className="w-full text-[11px] sm:text-xs text-slate-700 border-collapse table-auto">
          {/* Table Header matching the screenshot styling */}
          <thead>
            <tr className="bg-slate-100 border-b border-slate-250">
              <th className="p-2 sm:p-2.5 font-bold text-slate-800 text-center border-r border-slate-200">Date</th>
              <th className="p-2 sm:p-2.5 font-bold text-slate-800 text-center border-r border-slate-200">Amount</th>
              <th className="p-2 sm:p-2.5 font-bold text-slate-800 text-left border-r border-slate-200 pl-4">Type</th>
              <th className="p-2 sm:p-2.5 font-bold text-slate-800 text-right border-r border-slate-200 pr-4">Balance</th>
              <th className="p-2 sm:p-2.5 font-bold text-slate-800 text-center">Process</th>
            </tr>
          </thead>
          <tbody>
            {txs.map((tx, idx) => {
              const amount = tx.debit > 0 ? tx.debit : tx.credit;
              const { displayType, process } = getDisplayTypeAndProcess(tx);
              const isDebit = tx.debit > 0;

              return (
                <tr 
                  key={idx} 
                  className={`border-b border-slate-150 hover:bg-slate-50 transition-colors ${
                    idx % 2 === 1 ? 'bg-slate-50/40' : 'bg-white'
                  }`}
                >
                  {/* Date Column */}
                  <td className="p-2 sm:p-2.5 font-mono text-center text-slate-600 border-r border-slate-150">
                    {formatDDMMYYYY(tx.date)}
                  </td>

                  {/* Amount Column - Styled in blue and bold like the screenshot links */}
                  <td className="p-2 sm:p-2.5 text-center border-r border-slate-150 font-mono font-bold">
                    <span className="text-[#1d59d1] hover:underline cursor-pointer">
                      {amount.toLocaleString('en-US')}
                    </span>
                  </td>

                  {/* Type Column */}
                  <td className="p-2 sm:p-2.5 text-left border-r border-slate-150 font-medium pl-4 text-slate-700">
                    {displayType}
                  </td>

                  {/* Running Balance Column */}
                  <td className="p-2 sm:p-2.5 text-right border-r border-slate-150 font-mono font-bold pr-4 text-slate-800">
                    ৳{tx.balance.toLocaleString('en-US')}
                  </td>

                  {/* Process Column */}
                  <td className="p-2 sm:p-2.5 text-center font-medium text-slate-500">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] ${
                      process === 'Cash' 
                        ? 'bg-slate-100 text-slate-600 font-semibold' 
                        : 'bg-blue-50 text-blue-600 font-semibold'
                    }`}>
                      {process}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
