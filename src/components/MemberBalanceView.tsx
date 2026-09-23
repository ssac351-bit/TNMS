/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  ArrowLeft, 
  Users, 
  User, 
  Search, 
  ChevronDown, 
  Check, 
  DollarSign, 
  Plus, 
  Scale, 
  ShieldAlert, 
  BookOpen, 
  HelpCircle,
  MoreVertical,
  X
} from 'lucide-react';
import { Group, Member, Holiday } from '../types';
import { MemberPassbook } from './MemberPassbook';
import { LoanScheduleDetails } from './LoanScheduleDetails';

interface MemberBalanceViewProps {
  onBack: () => void;
  branchGroups: Group[];
  groupMembers: Member[];
  savingsAccounts?: any[];
  cbsAccounts?: any[];
  ltsAccounts?: any[];
  staff: { name: string; staffId?: string };
  workingDay: string;
  transactions?: any[];
  org: any;
  holidays?: Holiday[];
}

export const MemberBalanceView: React.FC<MemberBalanceViewProps> = ({
  onBack,
  branchGroups,
  groupMembers,
  savingsAccounts = [],
  cbsAccounts = [],
  ltsAccounts = [],
  staff,
  workingDay,
  transactions = [],
  org,
  holidays = []
}) => {
  const [selectedGroupId, setSelectedGroupId] = useState<string>('');
  const [selectedStatement, setSelectedStatement] = useState<{
    member: Member;
    accountType: 'PL' | 'GS' | 'CBS' | 'LTS' | 'SHARE';
    accountName: string;
    accountNo?: string;
    balance: number;
  } | null>(null);

  // Helper: compute statement rows with running balances
  const getAccountStatement = (memberObj: any, type: 'PL' | 'GS' | 'CBS' | 'LTS' | 'SHARE') => {
    const mTxList = (transactions || []).filter(
      (t) => t.memberId === memberObj.memberId || t.memberId === memberObj.id
    );

    const sortedTx = [...mTxList].sort((a, b) => (a.date || a.addDate || '').localeCompare(b.date || b.addDate || ''));

    let runningBal = 0;
    const items: any[] = [];

    if (type === 'PL') {
      const finalOutstanding = memberObj.plOutstanding ?? 0;
      let totalRepaid = 0;
      let hasDisbursementTx = false;

      sortedTx.forEach((t) => {
        if (t.type === 'disbursement') {
          hasDisbursementTx = true;
        } else if (t.type === 'collection' && t.collections?.pl > 0) {
          totalRepaid += t.collections.pl;
        } else if (t.type === 'loan_repayment' || t.category === 'loan_installment') {
          totalRepaid += t.amount || 0;
        }
      });

      if (!hasDisbursementTx && (finalOutstanding > 0 || totalRepaid > 0)) {
        const estimatedOriginalLoan = finalOutstanding + totalRepaid;
        runningBal = estimatedOriginalLoan;
        items.push({
          date: memberObj.admissionDate || memberObj.addDate || 'প্রারম্ভিক',
          title: 'ঋণ প্রারম্ভিক স্থিতি (Original Loan)',
          debit: estimatedOriginalLoan,
          credit: 0,
          balance: runningBal,
        });
      }

      sortedTx.forEach((t) => {
        let isTxRelated = false;
        let title = '';
        let debit = 0;
        let credit = 0;

        if (t.type === 'disbursement') {
          isTxRelated = true;
          title = 'ঋণ বিতরণ (Loan Disbursed)';
          debit = t.proposalDetail?.totalPayable || (t.amount * 1.15) || 0;
          runningBal += debit;
        } else if (t.type === 'collection' && t.collections?.pl > 0) {
          isTxRelated = true;
          title = 'ঋণ কিস্তি আদায় (Installment Paid)';
          credit = t.collections.pl;
          runningBal = Math.max(0, runningBal - credit);
        } else if (t.type === 'loan_repayment' || t.category === 'loan_installment') {
          isTxRelated = true;
          title = t.description || 'ঋণ কিস্তি আদায় (Loan Repaid)';
          credit = t.amount || 0;
          runningBal = Math.max(0, runningBal - credit);
        }

        if (isTxRelated) {
          items.push({
            date: t.date || t.addDate,
            title,
            debit,
            credit,
            balance: runningBal,
          });
        }
      });
    } else if (type === 'GS') {
      const finalBal = memberObj.savingsBalance || memberObj.gsBalance || 0;
      let netChange = 0;
      
      sortedTx.forEach((t) => {
        if (t.type === 'collection') {
          if (t.collections?.gs > 0) netChange += t.collections.gs;
          if (t.withdrawals?.gs > 0) netChange -= t.withdrawals.gs;
        } else if (t.type === 'savings_deposit' || t.category === 'savings_interest' || t.category === 'fdr_interest') {
          netChange += t.amount || 0;
        } else if (t.type === 'savings_withdrawal' || t.category === 'savings_refund' || (t.isRefund && t.category === 'general_savings')) {
          netChange -= t.amount || 0;
        }
      });

      let currentTempBal = finalBal - netChange;
      items.push({
        date: memberObj.admissionDate || memberObj.addDate || 'প্রারম্ভিক',
        title: 'প্রারম্ভিক স্থিতি (Opening Balance)',
        debit: currentTempBal,
        credit: 0,
        balance: currentTempBal,
      });

      sortedTx.forEach((t) => {
        if (t.type === 'collection') {
          const deposit = t.collections?.gs || 0;
          const withdraw = t.withdrawals?.gs || 0;

          if (deposit > 0 || withdraw > 0) {
            currentTempBal = currentTempBal + deposit - withdraw;
            items.push({
              date: t.date || t.addDate,
              title: deposit > 0 ? 'সঞ্চয় জমা (Deposit)' : 'সঞ্চয় উত্তোলন (Withdrawal)',
              debit: deposit,
              credit: withdraw,
              balance: currentTempBal,
            });
          }
        } else if (t.type === 'savings_deposit' || t.category === 'savings_interest' || t.category === 'fdr_interest') {
          const deposit = t.amount || 0;
          currentTempBal = currentTempBal + deposit;
          items.push({
            date: t.date || t.addDate,
            title: t.description || (t.category === 'fdr_interest' ? 'এফডিআর লভ্যাংশ (FDR Interest)' : 'সঞ্চয় লভ্যাংশ (Savings Interest)'),
            debit: deposit,
            credit: 0,
            balance: currentTempBal,
            category: t.category,
          });
        } else if (t.type === 'savings_withdrawal' || t.category === 'savings_refund' || (t.isRefund && t.category === 'general_savings')) {
          const withdraw = t.amount || 0;
          currentTempBal = Math.max(0, currentTempBal - withdraw);
          items.push({
            date: t.date || t.addDate,
            title: t.description || 'সঞ্চয় ফেরত/উত্তোলন (Withdrawal)',
            debit: 0,
            credit: withdraw,
            balance: currentTempBal,
          });
        }
      });
    } else if (type === 'SHARE') {
      const sharePrice = Number((org as any)?.sharePrice || 10);
      const finalBal = memberObj.shareBalance ?? ((memberObj.shareCount ?? 1) * sharePrice);
      let netChange = 0;

      sortedTx.forEach((t) => {
        if (t.type === 'collection') {
          if (t.collections?.share > 0) netChange += t.collections.share;
          if (t.withdrawals?.share > 0) netChange -= t.withdrawals.share;
        } else if (t.type === 'share_deposit' || t.type === 'share_purchase' || t.category === 'share_dividend') {
          netChange += t.amount || 0;
        } else if (t.type === 'share_refund' || t.type === 'share_surrender' || t.type === 'share_withdrawal') {
          netChange -= t.amount || 0;
        }
      });

      let currentTempBal = Math.max(0, finalBal - netChange);
      items.push({
        date: memberObj.admissionDate || memberObj.addDate || 'প্রারম্ভিক',
        title: 'প্রারম্ভিক শেয়ার মূলধন (Opening Share)',
        debit: currentTempBal,
        credit: 0,
        balance: currentTempBal,
      });

      sortedTx.forEach((t) => {
        if (t.type === 'collection') {
          const deposit = t.collections?.share || 0;
          const withdraw = t.withdrawals?.share || 0;

          if (deposit > 0 || withdraw > 0) {
            currentTempBal = currentTempBal + deposit - withdraw;
            items.push({
              date: t.date || t.addDate,
              title: deposit > 0 ? 'শেয়ার ক্রয়/জমা (Share Deposit)' : 'শেয়ার প্রত্যাহার (Share Refund)',
              debit: deposit,
              credit: withdraw,
              balance: currentTempBal,
            });
          }
        } else if (t.type === 'share_deposit' || t.type === 'share_purchase' || t.category === 'share_dividend') {
          const deposit = t.amount || 0;
          currentTempBal = currentTempBal + deposit;
          items.push({
            date: t.date || t.addDate,
            title: t.description || (t.category === 'share_dividend' ? 'শেয়ার লভ্যাংশ (Share Dividend)' : 'শেয়ার ক্রয় (Share Purchase)'),
            debit: deposit,
            credit: 0,
            balance: currentTempBal,
            category: t.category,
          });
        } else if (t.type === 'share_refund' || t.type === 'share_surrender' || t.type === 'share_withdrawal') {
          const withdraw = t.amount || 0;
          currentTempBal = Math.max(0, currentTempBal - withdraw);
          items.push({
            date: t.date || t.addDate,
            title: t.description || 'শেয়ার ফেরত (Share Refund)',
            debit: 0,
            credit: withdraw,
            balance: currentTempBal,
          });
        }
      });
    } else if (type === 'CBS') {
      const finalBal = memberObj.cbsBalance || 0;
      let netChange = 0;

      sortedTx.forEach((t) => {
        if (t.type === 'collection') {
          if (t.collections?.cbs > 0) netChange += t.collections.cbs;
          if (t.withdrawals?.cbs > 0) netChange -= t.withdrawals.cbs;
        } else if (t.type === 'savings_withdrawal' && t.category === 'cbs_savings') {
          netChange -= t.amount || 0;
        }
      });

      let currentTempBal = finalBal - netChange;
      items.push({
        date: memberObj.admissionDate || memberObj.addDate || 'প্রারম্ভিক',
        title: 'প্রারম্ভিক স্থিতি (Opening Balance)',
        debit: currentTempBal,
        credit: 0,
        balance: currentTempBal,
      });

      sortedTx.forEach((t) => {
        if (t.type === 'collection') {
          const deposit = t.collections?.cbs || 0;
          const withdraw = t.withdrawals?.cbs || 0;

          if (deposit > 0 || withdraw > 0) {
            currentTempBal = currentTempBal + deposit - withdraw;
            items.push({
              date: t.date || t.addDate,
              title: deposit > 0 ? 'CBS জমা (Deposit)' : 'CBS উত্তোলন (Withdrawal)',
              debit: deposit,
              credit: withdraw,
              balance: currentTempBal,
            });
          }
        } else if (t.type === 'savings_withdrawal' && t.category === 'cbs_savings') {
          const withdraw = t.amount || 0;
          currentTempBal = Math.max(0, currentTempBal - withdraw);
          items.push({
            date: t.date || t.addDate,
            title: t.description || 'CBS উত্তোলন/ফেরত',
            debit: 0,
            credit: withdraw,
            balance: currentTempBal,
          });
        }
      });
    } else if (type === 'LTS') {
      const finalBal = memberObj.ltsBalance || 0;
      let netChange = 0;

      sortedTx.forEach((t) => {
        if (t.type === 'collection') {
          if (t.collections?.lts > 0) netChange += t.collections.lts;
          if (t.withdrawals?.lts > 0) netChange -= t.withdrawals.lts;
        } else if (t.type === 'savings_withdrawal' && t.category === 'lts_savings') {
          netChange -= t.amount || 0;
        }
      });

      let currentTempBal = finalBal - netChange;
      items.push({
        date: memberObj.admissionDate || memberObj.addDate || 'প্রারম্ভিক',
        title: 'প্রারম্ভিক স্থিতি (Opening Balance)',
        debit: currentTempBal,
        credit: 0,
        balance: currentTempBal,
      });

      sortedTx.forEach((t) => {
        if (t.type === 'collection') {
          const deposit = t.collections?.lts || 0;
          const withdraw = t.withdrawals?.lts || 0;

          if (deposit > 0 || withdraw > 0) {
            currentTempBal = currentTempBal + deposit - withdraw;
            items.push({
              date: t.date || t.addDate,
              title: deposit > 0 ? 'LTS সঞ্চয় জমা (Deposit)' : 'LTS সঞ্চয় উত্তোলন (Withdrawal)',
              debit: deposit,
              credit: withdraw,
              balance: currentTempBal,
            });
          }
        } else if (t.type === 'savings_withdrawal' && t.category === 'lts_savings') {
          const withdraw = t.amount || 0;
          currentTempBal = Math.max(0, currentTempBal - withdraw);
          items.push({
            date: t.date || t.addDate,
            title: t.description || 'LTS সঞ্চয় ফেরত/উত্তোলন',
            debit: 0,
            credit: withdraw,
            balance: currentTempBal,
          });
        }
      });
    }

    return items.reverse();
  };
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Find currently selected group
  const selectedGroup = branchGroups.find(g => g.id === selectedGroupId);

  // Helper: Format date into native screenshot header style (e.g., 16/06/2026 Tue)
  const formatHeaderDate = (dateStr: string): string => {
    if (!dateStr) return '';
    try {
      const parts = dateStr.split('-');
      if (parts.length !== 3) return dateStr;
      const dateObj = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
      const dd = String(dateObj.getDate()).padStart(2, '0');
      const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
      const yyyy = dateObj.getFullYear();
      const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const ddd = days[dateObj.getDay()];
      return `${dd}/${mm}/${yyyy} ${ddd}`;
    } catch {
      return dateStr;
    }
  };

  // Helper: Convert day names to short English representation for group label
  const getDayAbbr = (dayName?: string): string => {
    if (!dayName) return 'SAT';
    const dayLower = dayName.toLowerCase();
    if (dayLower.includes('রবি') || dayLower.includes('sun')) return 'SUN';
    if (dayLower.includes('সোম') || dayLower.includes('mon')) return 'MON';
    if (dayLower.includes('মঙ্গ') || dayLower.includes('tue')) return 'TUE';
    if (dayLower.includes('বুধ') || dayLower.includes('wed')) return 'WED';
    if (dayLower.includes('বৃহ') || dayLower.includes('thu')) return 'THU';
    if (dayLower.includes('শুক্র') || dayLower.includes('fri')) return 'FRI';
    if (dayLower.includes('শনি') || dayLower.includes('sat')) return 'SAT';
    return 'SAT';
  };

  // Format group option label to closely match user screenshot
  const formatGroupLabel = (g: Group) => {
    const countVal = groupMembers.filter(m => m.groupId === g.id && m.status !== 'inactive').length;
    
    let label = g.name;
    
    // Clean any trailing parenthesis of count (e.g. " (35)" or " (29)") to avoid doubling
    label = label.replace(/\s*\(\d+\)\s*$/, '');
    
    // Check if label contains day abbreviation or meeting day already, if not, we can append it
    const hasDay = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'].some(day => label.toUpperCase().includes(day));
    if (!hasDay && g.meetingDay) {
      const dayAbbr = getDayAbbr(g.meetingDay);
      label = `${label} - ${dayAbbr}`;
    }
    
    return `${label} (${countVal})`;
  };

  // Filter members of selected group
  const activeMembersInGroup = groupMembers.filter(m => {
    if (m.groupId !== selectedGroupId) return false;
    if (m.status === 'inactive') return false; // display active members in balance sheet
    
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      return (
        m.name.toLowerCase().includes(q) ||
        (m.memberId && m.memberId.toLowerCase().includes(q))
      );
    }
    return true;
  });

  // Calculate totals
  const totalGs = activeMembersInGroup.reduce((sum, m) => {
    // GS balance is savingsBalance or gsBalance preference
    return sum + (m.gsBalance ?? m.savingsBalance ?? 0);
  }, 0);

  const totalCbs = activeMembersInGroup.reduce((sum, m) => {
    return sum + (m.cbsBalance ?? 0);
  }, 0);

  const totalLts = activeMembersInGroup.reduce((sum, m) => {
    return sum + (m.ltsBalance ?? 0);
  }, 0);

  const totalOutstanding = activeMembersInGroup.reduce((sum, m) => {
    return sum + (m.plOutstanding ?? 0);
  }, 0);

  const totalNet = (totalGs + totalCbs + totalLts) - totalOutstanding;

  // Parse staff first name for ID Badge style
  const staffNameToShow = staff.name ? staff.name.split(' ')[0].toUpperCase() : 'ZAKARIA';

  return (
    <div className="flex flex-col bg-[#eff3f6] min-h-[500px] font-sans text-slate-800 rounded-b-2xl border-x border-b border-slate-200 overflow-hidden shadow-xs">
      {/* 3. DROPDOWN GROUP SELECT BAR */}
      <div className="p-4 bg-[#eff3f6] relative">
        <div className="relative">
          <button
            type="button"
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className="w-full bg-white border border-slate-200 hover:border-slate-350 px-4 py-3 rounded-md flex justify-between items-center shadow-2xs hover:bg-slate-50 transition cursor-pointer select-none"
          >
            <span className="text-slate-800 font-extrabold text-xs sm:text-sm">
              {selectedGroup ? formatGroupLabel(selectedGroup) : 'Select Group'}
            </span>
            <span className={`text-slate-400 text-[10px] sm:text-xs transition-transform duration-250 shrink-0 ${isDropdownOpen ? 'rotate-180' : ''}`}>
              ▼
            </span>
          </button>

          {/* Group Options Dropdown List */}
          {isDropdownOpen && (
            <div className="absolute left-0 right-0 mt-1.5 bg-white border border-slate-200 rounded-lg shadow-xl z-50 max-h-80 overflow-y-auto divide-y divide-slate-100 font-semibold text-xs sm:text-sm animate-in fade-in slide-in-from-top-1 duration-150">
              <button
                type="button"
                onClick={() => {
                  setSelectedGroupId('');
                  setIsDropdownOpen(false);
                }}
                className={`w-full px-4 py-3 text-left hover:bg-slate-50 transition font-bold flex justify-between items-center ${!selectedGroupId ? 'text-blue-600 bg-blue-50/50' : 'text-slate-600'}`}
              >
                <span>Select Group</span>
                {!selectedGroupId && <Check size={14} className="stroke-[2.5]" />}
              </button>

              {branchGroups.map((g) => {
                const isCurrent = g.id === selectedGroupId;
                return (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => {
                      setSelectedGroupId(g.id);
                      setIsDropdownOpen(false);
                    }}
                    className={`w-full px-4 py-3 text-left hover:bg-slate-50 transition flex justify-between items-center ${isCurrent ? 'text-blue-600 bg-blue-50/30 font-bold' : 'text-slate-800'}`}
                  >
                    <span>{formatGroupLabel(g)}</span>
                    {isCurrent && <Check size={14} className="stroke-[2.5]" />}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* 4. MAIN WORKSPACE / MAIN VIEW AREA */}
      <div className="flex-1 bg-white px-4 pb-6 min-h-[300px] flex flex-col">
        {!selectedGroupId ? (
          /* NO GROUP SELECTED VIEW (Matches screenshot 2) */
          <div className="flex-1 flex flex-col items-center justify-center py-20 min-h-[250px] select-none">
            <p className="text-[#3b82f6] font-bold text-[19px] sm:text-[22px] tracking-wide text-center">
              No Group Selected
            </p>
          </div>
        ) : (
          /* GROUP REPORT BALANCES SHEET */
          <div className="flex-1 flex flex-col space-y-4 animate-in fade-in duration-200">
            {/* Filter Search Bar */}
            <div className="flex items-center gap-2 bg-[#f4f7fa] border border-slate-200 rounded-xl px-3 py-2">
              <Search size={15} className="text-slate-400 shrink-0" />
              <input
                type="text"
                placeholder="সদস্য খুঁজুন (নাম বা কোড)..."
                className="w-full bg-transparent text-xs sm:text-sm placeholder-slate-400 outline-none font-medium text-slate-800 focus:ring-0 focus:outline-none"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            {/* Header info stats */}
            <div className="flex items-center justify-between text-slate-500 text-[11px] sm:text-xs font-bold leading-tight select-none">
              <p>গ্রুপের কোড: <span className="text-slate-800">{selectedGroup?.code}</span></p>
              <p>সদস্য সংখ্যা: <span className="text-slate-800 font-extrabold">{activeMembersInGroup.length} জন</span></p>
            </div>

            {/* Member Balances Table */}
            {activeMembersInGroup.length === 0 ? (
              <div className="text-center py-12 text-slate-400 font-bold text-xs">
                কোনো সচল সদস্য পাওয়া যায়নি।
              </div>
            ) : (
              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-left text-xs text-slate-700 min-w-[650px] border-collapse">
                  <thead>
                    <tr className="bg-[#f8fafc] border-b border-slate-200 text-slate-600 font-extrabold select-none">
                      <th className="py-2.5 px-3 text-center w-10">ক্রমিক</th>
                      <th className="py-2.5 px-3 text-left">সদস্যের নাম ও কোড</th>
                      <th className="py-2.5 px-3 text-right">ঋণ বকেয়া (PL)</th>
                      <th className="py-2.5 px-3 text-right">সাধারণ সঞ্চয় (GS)</th>
                      <th className="py-2.5 px-3 text-right">সিবিএস (CBS)</th>
                      <th className="py-2.5 px-3 text-right">এলটিএস (LTS)</th>
                      <th className="py-2.5 px-3 text-right">নীট ব্যালেন্স</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-semibold">
                    {activeMembersInGroup.map((m, index) => {
                      const gsVal = m.gsBalance ?? m.savingsBalance ?? 0;
                      const cbsVal = m.cbsBalance ?? 0;
                      const ltsVal = m.ltsBalance ?? 0;
                      const plVal = m.plOutstanding ?? 0;
                      const netVal = (gsVal + cbsVal + ltsVal) - plVal;

                      return (
                        <tr key={m.id} className="hover:bg-slate-50/50">
                          <td className="py-2 px-3 text-center text-slate-400 font-mono">
                            {(index + 1).toLocaleString('bn-BD')}
                          </td>
                          <td className="py-2 px-3">
                            <p className="text-slate-900 font-bold text-[12.5px]">{m.name}</p>
                            <p className="text-slate-400 font-mono text-[10.5px] mt-0.5">{m.memberId || 'N/A'}</p>
                          </td>
                          <td 
                            onClick={() => setSelectedStatement({
                              member: m,
                              accountType: 'PL',
                              accountName: 'প্রাথমিক ঋণ হিসাব (PL)',
                              balance: plVal
                            })}
                            className={`py-2 px-3 text-right font-mono text-[12.5px] cursor-pointer hover:bg-slate-100 hover:text-rose-600 transition-all ${plVal > 0 ? 'text-rose-600 font-bold underline decoration-dotted' : 'text-slate-400'}`}
                            title="ঋণ স্টেটমেন্ট দেখতে ক্লিক করুন"
                          >
                            ৳{plVal.toLocaleString('bn-BD')}
                          </td>
                          <td 
                            onClick={() => setSelectedStatement({
                              member: m,
                              accountType: 'GS',
                              accountName: 'সাধারণ সঞ্চয় (GS)',
                              balance: gsVal
                            })}
                            className={`py-2 px-3 text-right font-mono text-[12.5px] cursor-pointer hover:bg-slate-100 hover:text-indigo-600 transition-all ${gsVal > 0 ? 'text-indigo-900 font-bold underline decoration-dotted' : 'text-slate-400'}`}
                            title="GS সঞ্চয় স্টেটমেন্ট দেখতে ক্লিক করুন"
                          >
                            ৳{gsVal.toLocaleString('bn-BD')}
                          </td>
                          <td 
                            onClick={() => setSelectedStatement({
                              member: m,
                              accountType: 'CBS',
                              accountName: 'ক্যাপিটাল বিল্ড-আপ সঞ্চয় (CBS)',
                              balance: cbsVal
                            })}
                            className={`py-2 px-3 text-right font-mono text-[12.5px] cursor-pointer hover:bg-slate-100 hover:text-emerald-600 transition-all ${cbsVal > 0 ? 'text-emerald-900 font-bold underline decoration-dotted' : 'text-slate-400'}`}
                            title="CBS স্টেটমেন্ট দেখতে ক্লিক করুন"
                          >
                            ৳{cbsVal.toLocaleString('bn-BD')}
                          </td>
                          <td 
                            onClick={() => setSelectedStatement({
                              member: m,
                              accountType: 'LTS',
                              accountName: 'দীর্ঘমেয়াদী সঞ্চয় (LTS)',
                              balance: ltsVal
                            })}
                            className={`py-2 px-3 text-right font-mono text-[12.5px] cursor-pointer hover:bg-slate-100 hover:text-teal-600 transition-all ${ltsVal > 0 ? 'text-teal-900 font-bold underline decoration-dotted' : 'text-slate-400'}`}
                            title="LTS স্টেটমেন্ট দেখতে ক্লিক করুন"
                          >
                            ৳{ltsVal.toLocaleString('bn-BD')}
                          </td>
                          <td className={`py-2 px-3 text-right font-mono text-[12.5px] ${netVal !== 0 ? (netVal > 0 ? 'text-blue-900' : 'text-rose-600') : 'text-slate-400'}`}>
                            ৳{netVal.toLocaleString('bn-BD')}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  {/* Totals Row */}
                  <tfoot>
                    <tr className="bg-slate-50/80 border-t border-slate-200 text-slate-900 font-extrabold select-none">
                      <td colSpan={2} className="py-2.5 px-3 text-right text-xs">সর্বমোট স্থিতি:</td>
                      <td className="py-2.5 px-3 text-right font-mono text-[13px] text-rose-700 border-l border-slate-100">
                        ৳{totalOutstanding.toLocaleString('bn-BD')}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-[13px] text-indigo-900 border-l border-slate-100">
                        ৳{totalGs.toLocaleString('bn-BD')}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-[13px] text-emerald-950 text-emerald-900 border-l border-slate-100">
                        ৳{totalCbs.toLocaleString('bn-BD')}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-[13px] text-teal-950 text-teal-900 border-l border-slate-100">
                        ৳{totalLts.toLocaleString('bn-BD')}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-[13px] text-blue-900 border-l border-slate-100">
                        ৳{totalNet.toLocaleString('bn-BD')}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {selectedStatement && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          {selectedStatement.accountType === 'PL' ? (
            <LoanScheduleDetails
              member={selectedStatement.member}
              transactions={transactions}
              workingDay={workingDay}
              org={org}
              holidays={holidays}
              branchGroups={branchGroups}
              onClose={() => setSelectedStatement(null)}
            />
          ) : (
            <div className="bg-[#f4f6f9] w-full max-w-md rounded-2xl overflow-hidden shadow-2xl border border-slate-200 flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200">
              {/* Modal Header */}
              <div className="bg-[#1e40af] text-white px-5 py-4 flex items-center justify-between">
                <div>
                  <h3 className="font-black text-sm tracking-wide">হিসাব বিবরণী (Statement)</h3>
                  <p className="text-[10px] text-blue-100 font-bold mt-0.5">{selectedStatement.accountName}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedStatement(null)}
                  className="p-1 rounded-full hover:bg-white/15 transition-all text-white cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Account Details Box */}
              <div className="p-4 bg-white border-b border-slate-200 grid grid-cols-2 gap-3 text-xs text-slate-700 leading-normal select-none">
                <div>
                  <span className="text-[10px] font-black text-slate-400 uppercase block tracking-wider">সদস্যের নাম</span>
                  <span className="text-slate-900 font-extrabold">{selectedStatement.member.name}</span>
                </div>
                <div>
                  <span className="text-[10px] font-black text-slate-400 uppercase block tracking-wider">সদস্য কোড</span>
                  <span className="text-slate-900 font-mono font-extrabold">{selectedStatement.member.memberId || 'N/A'}</span>
                </div>
                {selectedStatement.accountNo && (
                  <div>
                    <span className="text-[10px] font-black text-slate-400 uppercase block tracking-wider">হিসাব নম্বর</span>
                    <span className="text-slate-900 font-mono font-extrabold">{selectedStatement.accountNo}</span>
                  </div>
                )}
                <div className="col-span-2 bg-[#f0f4ff] border border-blue-100 rounded-lg p-2.5 flex items-center justify-between mt-1">
                  <span className="text-[10px] font-black text-blue-800 uppercase tracking-wider">মোট বর্তমান স্থিতি (Balance):</span>
                  <span className="text-xs sm:text-sm font-black text-blue-900 font-mono">৳{selectedStatement.balance.toLocaleString('bn-BD')}</span>
                </div>
              </div>

              {/* Quick Account Switcher Bar */}
              <div className="bg-slate-100 border-b border-slate-200 px-3 py-2 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                <span className="text-[9px] font-bold text-slate-500 shrink-0">হিসাব নির্বাচন:</span>

                {/* GS Tab */}
                <button
                  type="button"
                  onClick={() => setSelectedStatement({
                    member: selectedStatement.member,
                    accountType: 'GS',
                    accountName: 'সাধারণ সঞ্চয় (GS)',
                    accountNo: selectedStatement.member?.savingsAccountNo || `SAV-GS-${selectedStatement.member?.memberId || selectedStatement.member?.id}`,
                    balance: selectedStatement.member?.savingsBalance || selectedStatement.member?.gsBalance || 0
                  })}
                  className={`px-2.5 py-1 rounded-full text-[10px] font-bold shrink-0 transition-all cursor-pointer ${
                    selectedStatement.accountType === 'GS'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-white text-slate-700 hover:bg-slate-50 border border-slate-200'
                  }`}
                >
                  GS (সাধারণ সঞ্চয়)
                </button>

                {/* Share Tab */}
                <button
                  type="button"
                  onClick={() => {
                    const sPrice = Number((org as any)?.sharePrice || 10);
                    const sCount = selectedStatement.member?.shareCount ?? 1;
                    const sBal = Number(selectedStatement.member?.shareBalance ?? (sCount * sPrice));
                    setSelectedStatement({
                      member: selectedStatement.member,
                      accountType: 'SHARE',
                      accountName: 'শেয়ার আমানত হিসাব (Share Capital)',
                      accountNo: selectedStatement.member?.shareAccountNo || `SHR-${selectedStatement.member?.memberId || selectedStatement.member?.id}`,
                      balance: sBal
                    });
                  }}
                  className={`px-2.5 py-1 rounded-full text-[10px] font-bold shrink-0 transition-all cursor-pointer ${
                    selectedStatement.accountType === 'SHARE'
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'bg-white text-slate-700 hover:bg-slate-50 border border-slate-200'
                  }`}
                >
                  Share (শেয়ার)
                </button>

                {/* PL Tab */}
                {(selectedStatement.member?.plOutstanding ?? 0) > 0 && (
                  <button
                    type="button"
                    onClick={() => setSelectedStatement({
                      member: selectedStatement.member,
                      accountType: 'PL',
                      accountName: 'প্রাথমিক ঋণ হিসাব (PL)',
                      accountNo: selectedStatement.member?.loanAccountNo || `LN-${selectedStatement.member?.memberId || selectedStatement.member?.id}`,
                      balance: selectedStatement.member?.plOutstanding || 0
                    })}
                    className={`px-2.5 py-1 rounded-full text-[10px] font-bold shrink-0 transition-all cursor-pointer ${
                      selectedStatement.accountType === 'PL'
                        ? 'bg-rose-600 text-white shadow-xs'
                        : 'bg-white text-slate-700 hover:bg-slate-50 border border-slate-200'
                    }`}
                  >
                    PL (ঋণ)
                  </button>
                )}

                {/* CBS Tab */}
                {(selectedStatement.member?.cbsBalance ?? 0) > 0 && (
                  <button
                    type="button"
                    onClick={() => setSelectedStatement({
                      member: selectedStatement.member,
                      accountType: 'CBS',
                      accountName: 'ক্যাপিটাল বিল্ড-আপ সঞ্চয় (CBS)',
                      accountNo: selectedStatement.member?.cbsAccountNo || `CBS-${selectedStatement.member?.memberId || selectedStatement.member?.id}`,
                      balance: selectedStatement.member?.cbsBalance || 0
                    })}
                    className={`px-2.5 py-1 rounded-full text-[10px] font-bold shrink-0 transition-all cursor-pointer ${
                      selectedStatement.accountType === 'CBS'
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'bg-white text-slate-700 hover:bg-slate-50 border border-slate-200'
                    }`}
                  >
                    CBS (ডিপিএস)
                  </button>
                )}

                {/* LTS Tab */}
                {(selectedStatement.member?.ltsBalance ?? 0) > 0 && (
                  <button
                    type="button"
                    onClick={() => setSelectedStatement({
                      member: selectedStatement.member,
                      accountType: 'LTS',
                      accountName: 'দীর্ঘমেয়াদী সঞ্চয় (LTS)',
                      accountNo: selectedStatement.member?.ltsAccountNo || `LTS-${selectedStatement.member?.memberId || selectedStatement.member?.id}`,
                      balance: selectedStatement.member?.ltsBalance || 0
                    })}
                    className={`px-2.5 py-1 rounded-full text-[10px] font-bold shrink-0 transition-all cursor-pointer ${
                      selectedStatement.accountType === 'LTS'
                        ? 'bg-teal-600 text-white shadow-xs'
                        : 'bg-white text-slate-700 hover:bg-slate-50 border border-slate-200'
                    }`}
                  >
                    LTS (দীর্ঘমেয়াদী)
                  </button>
                )}
              </div>

              {/* Statement Passbook Table */}
              <div className="flex-1 overflow-y-auto p-0 font-sans text-left bg-[#f4f6f9]">
                {(() => {
                  const txs = getAccountStatement(selectedStatement.member, selectedStatement.accountType);
                  return <MemberPassbook txs={txs} />;
                })()}
              </div>

              {/* Footer Done button */}
              <div className="p-3 bg-white border-t border-slate-200 flex justify-end">
                <button
                  type="button"
                  onClick={() => setSelectedStatement(null)}
                  className="px-5 py-2.5 bg-[#1e40af] hover:bg-[#1d4ed8] text-white rounded-xl font-bold text-xs shadow-md transition-all active:scale-95 cursor-pointer"
                >
                  DONE (বন্ধ করুন)
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
