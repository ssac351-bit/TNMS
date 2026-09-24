/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { 
  ArrowLeft, 
  Calendar, 
  Search, 
  Users, 
  Layers, 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  BookOpen, 
  Filter, 
  Printer, 
  ChevronDown, 
  ChevronUp, 
  FileText,
  UserCheck,
  Building,
  CreditCard,
  Banknote,
  CheckCircle2,
  PieChart
} from 'lucide-react';
import { Group, Member } from '../types';
import { formatDDMMYYYY } from '../lib/dateUtils';

interface TransactionSummaryViewProps {
  onBack: () => void;
  transactions: any[];
  branchGroups: Group[];
  groupMembers: Member[];
  workingDay: string;
  staffList: any[];
}

// Helper to determine payment method (Cash vs Cheque/Bank)
export const getTransactionPaymentMode = (t: any): 'bank' | 'cash' => {
  if (t.paymentMode === 'bank' || t.paymentMode === 'cheque' || t.paymentMode === 'check') {
    return 'bank';
  }
  if (t.paymentMode === 'cash') {
    return 'cash';
  }
  
  // Check debit/credit account identifiers
  const debit = String(t.debitAcc || '').toLowerCase();
  const credit = String(t.creditAcc || '').toLowerCase();
  const source = String(t.source || '').toLowerCase();
  const desc = String(t.description || '').toLowerCase();
  const note = String(t.note || '').toLowerCase();
  const category = String(t.category || '').toLowerCase();

  if (
    debit.startsWith('bank') || 
    credit.startsWith('bank') || 
    source.includes('bank') || 
    source.includes('sbl') || 
    desc.includes('ব্যাংক') || 
    desc.includes('চেক') || 
    desc.includes('cheque') || 
    desc.includes('check') || 
    desc.includes('sbl') || 
    note.includes('চেক') || 
    note.includes('ব্যাংক') || 
    category.includes('bank')
  ) {
    return 'bank';
  }

  return 'cash';
};

// Helper to classify if transaction is receipt/inflow vs payment/outflow
export const isTransactionReceipt = (t: any): boolean => {
  if (
    t.type === 'collection' ||
    t.type === 'savings_deposit' ||
    t.type === 'loan_repayment' ||
    t.type === 'income' ||
    t.id?.toString().includes('tx-dep')
  ) {
    return true;
  }
  return false;
};

export const TransactionSummaryView: React.FC<TransactionSummaryViewProps> = ({
  onBack,
  transactions,
  branchGroups,
  groupMembers,
  workingDay,
  staffList
}) => {
  // Filters
  const [selectedDate, setSelectedDate] = useState<string>(workingDay);
  const [selectedGroup, setSelectedGroup] = useState<string>('all');
  const [selectedStaff, setSelectedStaff] = useState<string>('all');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [selectedPaymentMode, setSelectedPaymentMode] = useState<string>('all'); // all, cash, bank
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);

  // Quick helper to format Bengali numbers / currency
  const formatCurrency = (amount: number) => {
    return '৳' + Math.abs(amount).toLocaleString('bn-BD', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  };

  // Unique list of dates present in transactions (sorted descending)
  const availableDates = useMemo(() => {
    const dates = new Set<string>();
    dates.add(workingDay); // always make sure workingDay is in list
    transactions.forEach(t => {
      const d = t.date || t.addDate;
      if (d) dates.add(d);
    });
    return Array.from(dates).sort((a, b) => b.localeCompare(a));
  }, [transactions, workingDay]);

  // Map of groups for quick lookup
  const groupMap = useMemo(() => {
    const map = new Map<string, Group>();
    branchGroups.forEach(g => map.set(g.id, g));
    return map;
  }, [branchGroups]);

  // Map of staff for quick lookup
  const staffMap = useMemo(() => {
    const map = new Map<string, any>();
    staffList.forEach(s => map.set(s.staffId || s.id, s));
    return map;
  }, [staffList]);

  // Filtered list of transactions
  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => {
      const txDate = t.date || t.addDate;
      
      // Date Filter
      if (selectedDate !== 'all' && txDate !== selectedDate) {
        return false;
      }

      // Group Filter
      if (selectedGroup !== 'all' && t.groupId !== selectedGroup) {
        return false;
      }

      // Staff/Field Officer Filter (based on group assigned staff)
      if (selectedStaff !== 'all') {
        const grp = t.groupId ? groupMap.get(t.groupId) : null;
        if (!grp || grp.assignedStaffId !== selectedStaff) {
          return false;
        }
      }

      // Payment Mode Filter (Cash vs Bank/Cheque)
      const pMode = getTransactionPaymentMode(t);
      if (selectedPaymentMode !== 'all' && pMode !== selectedPaymentMode) {
        return false;
      }

      // Transaction Type Filter
      if (selectedType !== 'all') {
        if (selectedType === 'savings_deposit' && t.type !== 'collection' && t.type !== 'savings_deposit' && !t.id?.toString().includes('tx-dep')) {
          return false;
        }
        if (selectedType === 'savings_withdrawal' && t.type !== 'savings_withdrawal' && !t.id?.toString().includes('tx-ret')) {
          return false;
        }
        if (selectedType === 'loan_repayment' && t.type !== 'loan_repayment') {
          return false;
        }
        if (selectedType === 'loan_disbursement' && t.type !== 'disbursement' && t.type !== 'loan_disbursement') {
          return false;
        }
        if (selectedType === 'insurance' && t.type !== 'income' && t.category !== 'বীমা প্রিমিয়াম (তহবিল)') {
          return false;
        }
        if (selectedType === 'other_income' && (t.type !== 'income' || t.category === 'বীমা প্রিমিয়াম (তহবিল)')) {
          return false;
        }
        if (selectedType === 'other_expense' && t.type !== 'expense') {
          return false;
        }
      }

      // Search query (member name, member code, group name, desc)
      if (searchQuery.trim() !== '') {
        const query = searchQuery.toLowerCase();
        const memberName = (t.memberName || '').toLowerCase();
        const memberCode = (t.memberCode || t.memberId || '').toLowerCase();
        const groupName = (t.groupName || '').toLowerCase();
        const desc = (t.description || '').toLowerCase();
        const note = (t.note || '').toLowerCase();
        if (
          !memberName.includes(query) && 
          !memberCode.includes(query) && 
          !groupName.includes(query) && 
          !desc.includes(query) &&
          !note.includes(query)
        ) {
          return false;
        }
      }

      return true;
    });
  }, [transactions, selectedDate, selectedGroup, selectedStaff, selectedType, selectedPaymentMode, searchQuery, groupMap]);

  // Financial summary metrics based on currently filtered transactions: Cash vs Bank/Cheque separation
  const metrics = useMemo(() => {
    // Receipts breakdown
    let cashReceipts = 0;
    let bankReceipts = 0;

    // Payments breakdown
    let cashPayments = 0;
    let bankPayments = 0;

    // Sub-accounts breakdown
    let totalSavingsDeposit = 0;
    let totalSavingsWithdrawal = 0;
    let totalLoanRepayment = 0;
    let totalLoanDisbursement = 0;
    let totalInsurancePremium = 0;
    let totalOtherIncome = 0;
    let totalOtherExpense = 0;

    // Savings breakdown specifically (General Savings, CBS মূলধন সঞ্চয়, LTS দীর্ঘমেয়াদী)
    let gsDeposit = 0;
    let cbsDeposit = 0;
    let ltsDeposit = 0;

    filteredTransactions.forEach(t => {
      const amt = Number(t.amount) || 0;
      const mode = getTransactionPaymentMode(t);
      const isReceipt = isTransactionReceipt(t);

      if (isReceipt) {
        if (mode === 'bank') bankReceipts += amt;
        else cashReceipts += amt;
      } else {
        if (mode === 'bank') bankPayments += amt;
        else cashPayments += amt;
      }

      // Category breakdown
      if (t.type === 'collection' || t.type === 'savings_deposit' || t.id?.toString().includes('tx-dep')) {
        totalSavingsDeposit += amt;
        if (t.collections) {
          gsDeposit += Number(t.collections.gs) || 0;
          cbsDeposit += Number(t.collections.cbs) || 0;
          ltsDeposit += Number(t.collections.lts) || 0;
        }
      } else if (t.type === 'savings_withdrawal' || t.id?.toString().includes('tx-ret')) {
        totalSavingsWithdrawal += amt;
      } else if (t.type === 'loan_repayment') {
        totalLoanRepayment += amt;
      } else if (t.type === 'disbursement' || t.type === 'loan_disbursement') {
        totalLoanDisbursement += amt;
      } else if (t.type === 'income' && t.category === 'বীমা প্রিমিয়াম (তহবিল)') {
        totalInsurancePremium += amt;
      } else if (t.type === 'income') {
        totalOtherIncome += amt;
      } else if (t.type === 'expense') {
        totalOtherExpense += amt;
      }
    });

    const totalReceipts = cashReceipts + bankReceipts;
    const totalPayments = cashPayments + bankPayments;
    const netCashFlow = totalReceipts - totalPayments;
    const netCashSurplus = cashReceipts - cashPayments;
    const netBankSurplus = bankReceipts - bankPayments;

    return {
      cashReceipts,
      bankReceipts,
      totalReceipts,
      cashPayments,
      bankPayments,
      totalPayments,
      netCashFlow,
      netCashSurplus,
      netBankSurplus,
      totalSavingsDeposit,
      totalSavingsWithdrawal,
      totalLoanRepayment,
      totalLoanDisbursement,
      totalInsurancePremium,
      totalOtherIncome,
      totalOtherExpense,
      gsDeposit,
      cbsDeposit,
      ltsDeposit
    };
  }, [filteredTransactions]);

  // Group-wise transaction summaries for current selection
  const groupSummaries = useMemo(() => {
    const summaryMap = new Map<string, {
      groupId: string;
      groupName: string;
      assignedStaffName: string;
      cashReceipts: number;
      bankReceipts: number;
      cashPayments: number;
      bankPayments: number;
      savingsDeposit: number;
      savingsWithdrawal: number;
      loanRepayment: number;
      loanDisbursement: number;
      cbsDeposit: number;
      totalTx: number;
    }>();

    // Prepopulate with all active branch groups under selected staff (if any)
    branchGroups.forEach(g => {
      if (selectedStaff !== 'all' && g.assignedStaffId !== selectedStaff) return;
      if (selectedGroup !== 'all' && g.id !== selectedGroup) return;

      const staffObj = staffMap.get(g.assignedStaffId);
      summaryMap.set(g.id, {
        groupId: g.id,
        groupName: g.name,
        assignedStaffName: staffObj ? staffObj.name : 'অজানা কর্মী',
        cashReceipts: 0,
        bankReceipts: 0,
        cashPayments: 0,
        bankPayments: 0,
        savingsDeposit: 0,
        savingsWithdrawal: 0,
        loanRepayment: 0,
        loanDisbursement: 0,
        cbsDeposit: 0,
        totalTx: 0
      });
    });

    // Populate from filtered transactions
    filteredTransactions.forEach(t => {
      if (!t.groupId) return;
      let summary = summaryMap.get(t.groupId);
      if (!summary) {
        const grp = groupMap.get(t.groupId);
        const staffObj = grp ? staffMap.get(grp.assignedStaffId) : null;
        summary = {
          groupId: t.groupId,
          groupName: t.groupName || grp?.name || 'অজানা সমিতি',
          assignedStaffName: staffObj ? staffObj.name : 'অজানা কর্মী',
          cashReceipts: 0,
          bankReceipts: 0,
          cashPayments: 0,
          bankPayments: 0,
          savingsDeposit: 0,
          savingsWithdrawal: 0,
          loanRepayment: 0,
          loanDisbursement: 0,
          cbsDeposit: 0,
          totalTx: 0
        };
        summaryMap.set(t.groupId, summary);
      }

      const amt = Number(t.amount) || 0;
      const mode = getTransactionPaymentMode(t);
      const isReceipt = isTransactionReceipt(t);

      summary.totalTx += 1;

      if (isReceipt) {
        if (mode === 'bank') summary.bankReceipts += amt;
        else summary.cashReceipts += amt;
      } else {
        if (mode === 'bank') summary.bankPayments += amt;
        else summary.cashPayments += amt;
      }

      if (t.type === 'collection' || t.type === 'savings_deposit' || t.id?.toString().includes('tx-dep')) {
        summary.savingsDeposit += amt;
        if (t.collections?.cbs) {
          summary.cbsDeposit += Number(t.collections.cbs) || 0;
        }
      } else if (t.type === 'savings_withdrawal' || t.id?.toString().includes('tx-ret')) {
        summary.savingsWithdrawal += amt;
      } else if (t.type === 'loan_repayment') {
        summary.loanRepayment += amt;
      } else if (t.type === 'disbursement' || t.type === 'loan_disbursement') {
        summary.loanDisbursement += amt;
      }
    });

    // Sort by group name
    return Array.from(summaryMap.values())
      .filter(item => item.totalTx > 0 || selectedGroup !== 'all' || selectedStaff !== 'all')
      .sort((a, b) => a.groupName.localeCompare(b.groupName));
  }, [filteredTransactions, branchGroups, selectedGroup, selectedStaff, staffMap, groupMap]);

  // Translate type to Bengali label with CBS as মূলধন সঞ্চয়
  const getTxTypeLabel = (t: any) => {
    // Check specific CBS descriptions or categories
    const isCbs = 
      t.category === 'cbs_savings' || 
      t.category === 'cbs' || 
      t.debitAcc === 'cbs_savings' || 
      t.creditAcc === 'cbs_savings' || 
      t.description?.includes('CBS') || 
      t.description?.includes('মূলধন সঞ্চয়') || 
      t.description?.includes('মূলধন সঞ্চয়');

    if (isCbs && (t.type === 'collection' || t.type === 'savings_deposit' || t.id?.toString().includes('tx-dep'))) {
      return { label: 'মূলধন সঞ্চয় (CBS) জমা', bg: 'bg-emerald-100 text-emerald-800 border-emerald-300' };
    }
    if (isCbs && (t.type === 'savings_withdrawal' || t.id?.toString().includes('tx-ret'))) {
      return { label: 'মূলধন সঞ্চয় (CBS) ফেরত', bg: 'bg-rose-100 text-rose-800 border-rose-300' };
    }
    if (t.type === 'collection' || t.type === 'savings_deposit' || t.id?.toString().includes('tx-dep')) {
      return { label: 'সঞ্চয় আদায় (জমা)', bg: 'bg-emerald-100 text-emerald-800 border-emerald-200' };
    }
    if (t.type === 'savings_withdrawal' || t.id?.toString().includes('tx-ret')) {
      return { label: 'সঞ্চয় ফেরত (উত্তোলন)', bg: 'bg-rose-100 text-rose-800 border-rose-200' };
    }
    if (t.type === 'loan_repayment') {
      return { label: 'ঋণ কিস্তি আদায়', bg: 'bg-blue-100 text-blue-800 border-blue-200' };
    }
    if (t.type === 'disbursement' || t.type === 'loan_disbursement') {
      return { label: 'ঋণ বিতরণ', bg: 'bg-purple-100 text-purple-800 border-purple-200' };
    }
    if (t.type === 'income' && t.category === 'বীমা প্রিমিয়াম (তহবিল)') {
      return { label: 'বীমা প্রিমিয়াম', bg: 'bg-indigo-100 text-indigo-800 border-indigo-200' };
    }
    if (t.type === 'income') {
      return { label: 'অন্যান্য প্রাপ্তি', bg: 'bg-amber-100 text-amber-800 border-amber-200' };
    }
    if (t.type === 'expense') {
      return { label: 'খরচ / ব্যয় প্রদান', bg: 'bg-slate-100 text-slate-800 border-slate-200' };
    }
    return { label: 'সাধারণ লেনদেন', bg: 'bg-gray-100 text-gray-800 border-gray-200' };
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="bg-[#f8fafc] rounded-b-2xl border-x border-b border-slate-200 p-4 sm:p-6 font-sans text-slate-800 min-h-[600px] shadow-lg">
      
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-200">
        <div>
          <h2 className="text-lg font-black text-slate-800 flex items-center gap-2">
            <BookOpen className="text-emerald-600 animate-pulse" size={20} />
            দৈনিক লেনদেন সামারী (Daily Transaction Summary)
          </h2>
          <p className="text-xs text-slate-500 font-bold mt-0.5">
            শাখার দৈনিক আদায়, ঋণ বিতরণ, সঞ্চয় ফেরত এবং নগদ (Cash) ও চেক/ব্যাংক (Cheque/Bank) লেনদেনের পৃথক কলামভিত্তিক খতিয়ান।
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handlePrint}
            className="px-3.5 py-2 bg-white border border-slate-250 hover:bg-slate-50 text-slate-700 text-xs font-black rounded-xl transition flex items-center gap-1.5 shadow-3xs cursor-pointer"
          >
            <Printer size={14} /> প্রিন্ট বিবরণী
          </button>
          <button
            type="button"
            onClick={onBack}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-black rounded-xl transition flex items-center gap-1 shadow-3xs cursor-pointer"
          >
            <ArrowLeft size={14} /> মূল মেনু
          </button>
        </div>
      </div>

      {/* FILTER PANEL */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 mb-6 shadow-sm">
        <div className="flex items-center gap-1.5 mb-3 pb-2 border-b border-slate-100">
          <Filter size={14} className="text-indigo-600" />
          <span className="text-[11px] font-black uppercase text-slate-500 tracking-wider">ফিল্টারসমূহ (Search & Filter)</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3.5">
          
          {/* 1. Working Date Select */}
          <div className="space-y-1">
            <label className="block text-[10px] font-black text-slate-500 uppercase">তারিখ নির্বাচন</label>
            <div className="relative">
              <Calendar size={14} className="absolute left-3 top-3 text-slate-400" />
              <select
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-full pl-8.5 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-black text-slate-700 focus:outline-none focus:border-indigo-500 focus:bg-white transition cursor-pointer"
              >
                <option value="all">সব তারিখ</option>
                {availableDates.map(date => (
                  <option key={date} value={date}>{date === workingDay ? `${formatDDMMYYYY(date)} (আজকের দিন)` : formatDDMMYYYY(date)}</option>
                ))}
              </select>
            </div>
          </div>

          {/* 2. Group Select */}
          <div className="space-y-1">
            <label className="block text-[10px] font-black text-slate-500 uppercase">সমিতি / গ্রুপ</label>
            <div className="relative">
              <Layers size={14} className="absolute left-3 top-3 text-slate-400" />
              <select
                value={selectedGroup}
                onChange={(e) => setSelectedGroup(e.target.value)}
                className="w-full pl-8.5 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-black text-slate-700 focus:outline-none focus:border-indigo-500 focus:bg-white transition cursor-pointer"
              >
                <option value="all">সকল সমিতি ({branchGroups.length})</option>
                {branchGroups.map(g => (
                  <option key={g.id} value={g.id}>{g.name} ({g.code})</option>
                ))}
              </select>
            </div>
          </div>

          {/* 3. Field Officer Select */}
          <div className="space-y-1">
            <label className="block text-[10px] font-black text-slate-500 uppercase">মাঠ কর্মী (Officer)</label>
            <div className="relative">
              <UserCheck size={14} className="absolute left-3 top-3 text-slate-400" />
              <select
                value={selectedStaff}
                onChange={(e) => setSelectedStaff(e.target.value)}
                className="w-full pl-8.5 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-black text-slate-700 focus:outline-none focus:border-indigo-500 focus:bg-white transition cursor-pointer"
              >
                <option value="all">সকল কর্মকর্তা</option>
                {staffList.filter(s => s.designation?.includes('মাঠ কর্মী') || s.designation?.includes('সংগঠক') || s.staffId?.startsWith('ILO') || s.id?.startsWith('ILO')).map(s => (
                  <option key={s.staffId || s.id} value={s.staffId || s.id}>{s.name} ({s.staffId || s.id})</option>
                ))}
              </select>
            </div>
          </div>

          {/* 4. Payment Mode (Cash vs Cheque/Bank) Filter */}
          <div className="space-y-1">
            <label className="block text-[10px] font-black text-slate-500 uppercase">পরিশোধ মাধ্যম (Mode)</label>
            <div className="relative">
              <CreditCard size={14} className="absolute left-3 top-3 text-slate-400" />
              <select
                value={selectedPaymentMode}
                onChange={(e) => setSelectedPaymentMode(e.target.value)}
                className="w-full pl-8.5 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-black text-slate-700 focus:outline-none focus:border-indigo-500 focus:bg-white transition cursor-pointer"
              >
                <option value="all">সব মাধ্যম (ক্যাশ ও ব্যাংক)</option>
                <option value="cash">💵 শুধুমাত্র ক্যাশ (Cash)</option>
                <option value="bank">🏦 শুধুমাত্র চেক / ব্যাংক (Cheque/Bank)</option>
              </select>
            </div>
          </div>

          {/* 5. Transaction Type Filter */}
          <div className="space-y-1">
            <label className="block text-[10px] font-black text-slate-500 uppercase">লেনদেন ধরন</label>
            <div className="relative">
              <DollarSign size={14} className="absolute left-3 top-3 text-slate-400" />
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                className="w-full pl-8.5 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-black text-slate-700 focus:outline-none focus:border-indigo-500 focus:bg-white transition cursor-pointer"
              >
                <option value="all">সকল লেনদেন ধরন</option>
                <option value="savings_deposit">সঞ্চয় জমা (সাধারণ ও মূলধন সঞ্চয়)</option>
                <option value="savings_withdrawal">সঞ্চয় ফেরত (Withdrawal)</option>
                <option value="loan_repayment">ঋণ কিস্তি আদায় (Repayment)</option>
                <option value="loan_disbursement">ঋণ বিতরণ (Disbursement)</option>
                <option value="insurance">বীমা প্রিমিয়াম</option>
                <option value="other_income">অন্যান্য আয় / প্রাপ্তি</option>
                <option value="other_expense">অন্যান্য ব্যয় / খরচ</option>
              </select>
            </div>
          </div>

          {/* 6. Keyword Search */}
          <div className="space-y-1">
            <label className="block text-[10px] font-black text-slate-500 uppercase">সদস্য বা বিবরণী</label>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-3 text-slate-400" />
              <input
                type="text"
                placeholder="সদস্য নাম, কোড, বিবরণ..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8.5 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:bg-white transition"
              />
            </div>
          </div>

        </div>
      </div>

      {/* OVERVIEW STATS (KPI GRID WITH CASH VS CHEQUE/BANK BREAKDOWN) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        
        {/* Metric 1: Total Receipts (Cash vs Bank/Cheque) */}
        <div className="bg-emerald-50/70 border border-emerald-200/90 rounded-2xl p-4.5 space-y-2.5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black text-emerald-900 uppercase tracking-wide flex items-center gap-1.5">
              <TrendingUp size={14} className="text-emerald-700" /> মোট আদায় ও প্রাপ্তি (Receipts)
            </span>
            <span className="bg-emerald-100 text-emerald-800 text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border border-emerald-300">
              ইনফ্লো
            </span>
          </div>
          
          <p className="text-2xl font-black text-emerald-700 font-mono tracking-tight">{formatCurrency(metrics.totalReceipts)}</p>
          
          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-emerald-200/60 text-xs">
            <div className="bg-white/80 p-2 rounded-xl border border-emerald-100">
              <span className="text-[10px] font-bold text-slate-500 flex items-center gap-1">
                <Banknote size={11} className="text-emerald-600" /> ক্যাশ প্রাপ্তি:
              </span>
              <p className="font-extrabold text-emerald-800 font-mono mt-0.5">{formatCurrency(metrics.cashReceipts)}</p>
            </div>
            <div className="bg-white/80 p-2 rounded-xl border border-emerald-100">
              <span className="text-[10px] font-bold text-slate-500 flex items-center gap-1">
                <Building size={11} className="text-blue-600" /> চেক / ব্যাংক প্রাপ্তি:
              </span>
              <p className="font-extrabold text-blue-800 font-mono mt-0.5">{formatCurrency(metrics.bankReceipts)}</p>
            </div>
          </div>
        </div>

        {/* Metric 2: Total Payments (Cash vs Bank/Cheque) */}
        <div className="bg-rose-50/70 border border-rose-200/90 rounded-2xl p-4.5 space-y-2.5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black text-rose-900 uppercase tracking-wide flex items-center gap-1.5">
              <TrendingDown size={14} className="text-rose-700" /> মোট বিতরণ ও প্রদান (Payments)
            </span>
            <span className="bg-rose-100 text-rose-800 text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border border-rose-300">
              আউটফ্লো
            </span>
          </div>

          <p className="text-2xl font-black text-rose-700 font-mono tracking-tight">{formatCurrency(metrics.totalPayments)}</p>

          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-rose-200/60 text-xs">
            <div className="bg-white/80 p-2 rounded-xl border border-rose-100">
              <span className="text-[10px] font-bold text-slate-500 flex items-center gap-1">
                <Banknote size={11} className="text-rose-600" /> ক্যাশ প্রদান:
              </span>
              <p className="font-extrabold text-rose-800 font-mono mt-0.5">{formatCurrency(metrics.cashPayments)}</p>
            </div>
            <div className="bg-white/80 p-2 rounded-xl border border-rose-100">
              <span className="text-[10px] font-bold text-slate-500 flex items-center gap-1">
                <Building size={11} className="text-purple-600" /> চেক / ব্যাংক বিতরণ:
              </span>
              <p className="font-extrabold text-purple-800 font-mono mt-0.5">{formatCurrency(metrics.bankPayments)}</p>
            </div>
          </div>
        </div>

        {/* Metric 3: Net Cash Flow & Surplus */}
        <div className={`border rounded-2xl p-4.5 space-y-2.5 shadow-sm ${metrics.netCashFlow >= 0 ? 'bg-indigo-50/70 border-indigo-200/90' : 'bg-amber-50/70 border-amber-200/90'}`}>
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black uppercase tracking-wide flex items-center gap-1.5">
              {metrics.netCashFlow >= 0 ? '💸 নীট উদ্বৃত্ত (Net Surplus)' : '⚠️ নীট ঘাটতি (Net Deficit)'}
            </span>
            <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border ${metrics.netCashFlow >= 0 ? 'bg-indigo-100 text-indigo-800 border-indigo-300' : 'bg-amber-100 text-amber-800 border-amber-300'}`}>
              {metrics.netCashFlow >= 0 ? 'পজিটিভ' : 'নেগেটিভ'}
            </span>
          </div>

          <p className={`text-2xl font-black font-mono tracking-tight ${metrics.netCashFlow >= 0 ? 'text-indigo-700' : 'text-amber-700'}`}>
            {metrics.netCashFlow < 0 ? '-' : '+'}{formatCurrency(metrics.netCashFlow)}
          </p>

          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-indigo-200/60 text-xs">
            <div className="bg-white/80 p-2 rounded-xl border border-slate-200">
              <span className="text-[10px] font-bold text-slate-500">হাতে নগদ নীট:</span>
              <p className={`font-extrabold font-mono mt-0.5 ${metrics.netCashSurplus >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                {metrics.netCashSurplus < 0 ? '-' : '+'}{formatCurrency(metrics.netCashSurplus)}
              </p>
            </div>
            <div className="bg-white/80 p-2 rounded-xl border border-slate-200">
              <span className="text-[10px] font-bold text-slate-500">ব্যাংক ব্যালেন্স নীট:</span>
              <p className={`font-extrabold font-mono mt-0.5 ${metrics.netBankSurplus >= 0 ? 'text-blue-700' : 'text-rose-700'}`}>
                {metrics.netBankSurplus < 0 ? '-' : '+'}{formatCurrency(metrics.netBankSurplus)}
              </p>
            </div>
          </div>
        </div>

      </div>

      {/* QUICK SECTOR SUMMARY PILLS */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 mb-6 shadow-sm">
        <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-2">
          <span className="text-xs font-black text-slate-700 uppercase flex items-center gap-1.5">
            <PieChart size={14} className="text-indigo-600" />
            প্রধান খাতের সমষ্টিগত বিশ্লেষণ (Core Heads Breakdown)
          </span>
          <span className="text-[10px] text-slate-400 font-bold">
            সিবিএস (CBS): মূলধন সঞ্চয়
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
          <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-150">
            <span className="text-[10px] text-slate-500 font-bold block">মোট সঞ্চয় জমা</span>
            <span className="font-black text-slate-800 font-mono text-sm">{formatCurrency(metrics.totalSavingsDeposit)}</span>
            {metrics.cbsDeposit > 0 && (
              <span className="text-[9px] text-emerald-700 block font-semibold mt-0.5">
                (মূলধন সঞ্চয় CBS: {formatCurrency(metrics.cbsDeposit)})
              </span>
            )}
          </div>
          <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-150">
            <span className="text-[10px] text-slate-500 font-bold block">ঋণ কিস্তি আদায়</span>
            <span className="font-black text-emerald-700 font-mono text-sm">{formatCurrency(metrics.totalLoanRepayment)}</span>
          </div>
          <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-150">
            <span className="text-[10px] text-slate-500 font-bold block">ঋণ বিতরণ</span>
            <span className="font-black text-rose-700 font-mono text-sm">{formatCurrency(metrics.totalLoanDisbursement)}</span>
          </div>
          <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-150">
            <span className="text-[10px] text-slate-500 font-bold block">সঞ্চয় ফেরত</span>
            <span className="font-black text-rose-600 font-mono text-sm">{formatCurrency(metrics.totalSavingsWithdrawal)}</span>
          </div>
          <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-150">
            <span className="text-[10px] text-slate-500 font-bold block">বীমা প্রিমিয়াম আদায়</span>
            <span className="font-black text-indigo-700 font-mono text-sm">{formatCurrency(metrics.totalInsurancePremium)}</span>
          </div>
          <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-150">
            <span className="text-[10px] text-slate-500 font-bold block">অন্যান্য আয় / ব্যয়</span>
            <span className="font-black text-slate-700 font-mono text-sm">
              +{formatCurrency(metrics.totalOtherIncome)} / -{formatCurrency(metrics.totalOtherExpense)}
            </span>
          </div>
        </div>
      </div>

      {/* TRANSACTION DETAILS TABLE: WITH SEPARATE CASH VS CHEQUE/BANK COLUMNS */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
        
        <div className="bg-slate-50 px-5 py-4 border-b border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <h4 className="text-xs font-black text-slate-800 flex items-center gap-1.5 uppercase">
              <FileText size={15} className="text-indigo-600" />
              দৈনিক লেনদেন বিবরণী খতিয়ান (ক্যাশ ও চেক/ব্যাংক পৃথক কলাম সহ)
            </h4>
            <p className="text-[10px] text-slate-400 font-bold mt-0.5">
              মোট <strong>{filteredTransactions.length.toLocaleString('bn-BD')}</strong> টি লেনদেন। নগদ ও ব্যাংকের জমা-খরচ পৃথক কলামে সাজানো হয়েছে।
            </p>
          </div>

          <div className="flex items-center gap-3 text-[11px] font-bold">
            <span className="flex items-center gap-1 text-emerald-800 bg-emerald-50 px-2 py-1 rounded-md border border-emerald-200">
              <Banknote size={12} className="text-emerald-600" /> ক্যাশ
            </span>
            <span className="flex items-center gap-1 text-blue-800 bg-blue-50 px-2 py-1 rounded-md border border-blue-200">
              <Building size={12} className="text-blue-600" /> চেক / ব্যাংক
            </span>
          </div>
        </div>

        {/* DETAILS TABLE */}
        {filteredTransactions.length === 0 ? (
          <div className="py-16 text-center select-none">
            <Users size={40} className="text-slate-300 mx-auto mb-3" />
            <p className="text-slate-400 text-sm font-bold">এই ফিল্টার ও সার্চ ক্রাইটেরিয়ায় কোনো লেনদেন পাওয়া যায়নি!</p>
            <p className="text-slate-300 text-xs mt-1">দয়া করে উপরে অন্য কোনো তারিখ বা ফিল্টার অপশন পরিবর্তন করে চেষ্টা করুন।</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[900px]">
              <thead>
                {/* 2-Tier Header for Crystal Clear Separation */}
                <tr className="bg-slate-100 border-b border-slate-200 text-[10px] font-black text-slate-600 uppercase tracking-wider">
                  <th rowSpan={2} className="py-3 px-3 border-r border-slate-200 w-28">আইডি ও তারিখ</th>
                  <th rowSpan={2} className="py-3 px-3 border-r border-slate-200">সদস্যের তথ্য</th>
                  <th rowSpan={2} className="py-3 px-3 border-r border-slate-200">সমিতি / গ্রুপ</th>
                  <th rowSpan={2} className="py-3 px-3 border-r border-slate-200 text-center">লেনদেনের খাত / ধরণ</th>
                  <th rowSpan={2} className="py-3 px-3 border-r border-slate-200">বিবরণ / খতিয়ান</th>
                  <th colSpan={2} className="py-2 px-3 text-center bg-emerald-100/60 border-b border-r border-emerald-200 text-emerald-900">
                    আদায় / জমা (Receipts)
                  </th>
                  <th colSpan={2} className="py-2 px-3 text-center bg-rose-100/60 border-b border-rose-200 text-rose-900">
                    বিতরণ / প্রদান (Payments)
                  </th>
                </tr>
                <tr className="bg-slate-50 border-b border-slate-200 text-[9.5px] font-black uppercase tracking-wider">
                  <th className="py-2 px-3 text-right bg-emerald-50/80 border-r border-slate-200 text-emerald-800">
                    💵 ক্যাশ
                  </th>
                  <th className="py-2 px-3 text-right bg-emerald-50/80 border-r border-slate-200 text-blue-800">
                    🏦 চেক / ব্যাংক
                  </th>
                  <th className="py-2 px-3 text-right bg-rose-50/80 border-r border-slate-200 text-rose-800">
                    💵 ক্যাশ
                  </th>
                  <th className="py-2 px-3 text-right bg-rose-50/80 text-purple-800">
                    🏦 চেক / ব্যাংক
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-150 text-xs text-slate-700 font-medium">
                {filteredTransactions.map((tx) => {
                  const typeLabel = getTxTypeLabel(tx);
                  const txDate = tx.date || tx.addDate || workingDay;
                  const paymentMode = getTransactionPaymentMode(tx);
                  const isReceipt = isTransactionReceipt(tx);
                  const amt = Number(tx.amount) || 0;

                  // Columns amounts
                  const receiptCash = isReceipt && paymentMode === 'cash' ? amt : null;
                  const receiptBank = isReceipt && paymentMode === 'bank' ? amt : null;
                  const paymentCash = !isReceipt && paymentMode === 'cash' ? amt : null;
                  const paymentBank = !isReceipt && paymentMode === 'bank' ? amt : null;

                  return (
                    <tr key={tx.id} className="hover:bg-slate-50/80 transition duration-150">
                      {/* ID and Date */}
                      <td className="py-3 px-3 whitespace-nowrap border-r border-slate-100">
                        <div className="font-mono text-[10px] text-slate-400 font-bold">{tx.id || 'N/A'}</div>
                        <div className="text-[10px] font-bold text-slate-600 mt-0.5 flex items-center gap-1 font-mono">
                          <Calendar size={10} className="text-slate-400" /> {formatDDMMYYYY(txDate)}
                        </div>
                      </td>

                      {/* Member Info */}
                      <td className="py-3 px-3 border-r border-slate-100">
                        {tx.memberName ? (
                          <div>
                            <div className="font-extrabold text-slate-800">{tx.memberName}</div>
                            <div className="text-[10px] text-slate-400 font-mono font-bold mt-0.5">ID: {tx.memberId || 'N/A'}</div>
                          </div>
                        ) : (
                          <span className="text-slate-400 font-bold italic">অফিস সংক্রান্ত / সাধারণ</span>
                        )}
                      </td>

                      {/* Group */}
                      <td className="py-3 px-3 border-r border-slate-100">
                        {tx.groupName ? (
                          <div>
                            <div className="font-bold text-slate-700">{tx.groupName}</div>
                            <div className="text-[10px] text-slate-400 font-mono font-bold mt-0.5">ID: {tx.groupId || 'N/A'}</div>
                          </div>
                        ) : (
                          <span className="text-slate-400 font-bold">—</span>
                        )}
                      </td>

                      {/* Type Pill */}
                      <td className="py-3 px-3 whitespace-nowrap text-center border-r border-slate-100">
                        <span className={`inline-block text-[9px] font-black px-2.5 py-1 rounded-md border ${typeLabel.bg}`}>
                          {typeLabel.label}
                        </span>
                      </td>

                      {/* Description & Accounts */}
                      <td className="py-3 px-3 max-w-xs border-r border-slate-100">
                        <div className="font-bold text-slate-700 line-clamp-2">
                          {tx.description || tx.note || tx.category || 'দৈনিক লেনদেন পোস্টিং'}
                        </div>
                        <div className="flex flex-wrap items-center gap-2 mt-1 text-[9.5px] font-bold text-slate-400">
                          {tx.debitAcc && <span>Dr: <strong className="text-slate-600 font-mono">{tx.debitAcc}</strong></span>}
                          {tx.creditAcc && <span>Cr: <strong className="text-slate-600 font-mono">{tx.creditAcc}</strong></span>}
                          {paymentMode === 'bank' && (
                            <span className="bg-blue-50 text-blue-700 border border-blue-200 px-1 py-0.2 rounded text-[9px]">
                              🏦 ব্যাংক
                            </span>
                          )}
                        </div>
                      </td>

                      {/* 1. Receipt Cash */}
                      <td className="py-3 px-3 text-right font-mono text-xs font-black whitespace-nowrap bg-emerald-50/20 border-r border-slate-100">
                        {receiptCash !== null ? (
                          <span className="text-emerald-700">+{formatCurrency(receiptCash)}</span>
                        ) : (
                          <span className="text-slate-300 font-sans">—</span>
                        )}
                      </td>

                      {/* 2. Receipt Cheque/Bank */}
                      <td className="py-3 px-3 text-right font-mono text-xs font-black whitespace-nowrap bg-blue-50/20 border-r border-slate-100">
                        {receiptBank !== null ? (
                          <span className="text-blue-700">+{formatCurrency(receiptBank)}</span>
                        ) : (
                          <span className="text-slate-300 font-sans">—</span>
                        )}
                      </td>

                      {/* 3. Payment Cash */}
                      <td className="py-3 px-3 text-right font-mono text-xs font-black whitespace-nowrap bg-rose-50/20 border-r border-slate-100">
                        {paymentCash !== null ? (
                          <span className="text-rose-700">-{formatCurrency(paymentCash)}</span>
                        ) : (
                          <span className="text-slate-300 font-sans">—</span>
                        )}
                      </td>

                      {/* 4. Payment Cheque/Bank */}
                      <td className="py-3 px-3 text-right font-mono text-xs font-black whitespace-nowrap bg-purple-50/20">
                        {paymentBank !== null ? (
                          <span className="text-purple-700">-{formatCurrency(paymentBank)}</span>
                        ) : (
                          <span className="text-slate-300 font-sans">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>

              {/* Table Footer with Column Totals */}
              <tfoot>
                <tr className="bg-slate-100/90 font-black text-slate-800 border-t-2 border-slate-300 text-xs font-mono">
                  <td colSpan={5} className="py-3.5 px-4 text-right uppercase tracking-wider font-sans text-[11px] border-r border-slate-200">
                    সর্বমোট যোগফল (Grand Total):
                  </td>
                  {/* Receipt Cash Total */}
                  <td className="py-3.5 px-3 text-right text-emerald-800 bg-emerald-100/40 border-r border-slate-200">
                    +{formatCurrency(metrics.cashReceipts)}
                  </td>
                  {/* Receipt Bank Total */}
                  <td className="py-3.5 px-3 text-right text-blue-800 bg-blue-100/40 border-r border-slate-200">
                    +{formatCurrency(metrics.bankReceipts)}
                  </td>
                  {/* Payment Cash Total */}
                  <td className="py-3.5 px-3 text-right text-rose-800 bg-rose-100/40 border-r border-slate-200">
                    -{formatCurrency(metrics.cashPayments)}
                  </td>
                  {/* Payment Bank Total */}
                  <td className="py-3.5 px-3 text-right text-purple-800 bg-purple-100/40">
                    -{formatCurrency(metrics.bankPayments)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}

      </div>

      {/* SECTION: GROUP-WISE AGGREGATION & STATISTICS */}
      <div className="mt-8 bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
        
        <div className="bg-slate-50 px-5 py-4 border-b border-slate-150">
          <h4 className="text-xs font-black text-slate-700 flex items-center gap-1.5 uppercase">
            <Layers size={14} className="text-indigo-600 animate-pulse" />
            সমিতি / গ্রুপ ভিত্তিক দৈনিক আদায় ও বিতরণ সামারী
          </h4>
          <p className="text-[10px] text-slate-400 font-bold mt-0.5">
            প্রতিটি সমিতির সঞ্চয় জমা, মূলধন সঞ্চয় (CBS), ঋণ কিস্তি আদায়, ঋণ বিতরণ এবং ক্যাশ বনাম ব্যাংক লেনদেন বিশ্লেষণ।
          </p>
        </div>

        <div className="p-4 sm:p-5">
          {groupSummaries.length === 0 ? (
            <div className="py-8 text-center text-slate-400 text-xs font-bold select-none">
              আজকে বা নির্বাচিত ফিল্টারে কোনো সমিতির দলীয় আদায়/প্রদান নেই।
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {groupSummaries.map((summary) => {
                const totalIn = summary.cashReceipts + summary.bankReceipts;
                const totalOut = summary.cashPayments + summary.bankPayments;
                const isExpanded = expandedGroup === summary.groupId;

                return (
                  <div 
                    key={summary.groupId} 
                    className="border border-slate-200 rounded-xl bg-slate-50/50 hover:bg-white transition hover:shadow-xs overflow-hidden"
                  >
                    {/* Collapsible header */}
                    <button
                      type="button"
                      onClick={() => setExpandedGroup(isExpanded ? null : summary.groupId)}
                      className="w-full text-left p-4 flex justify-between items-center transition cursor-pointer border-0 bg-transparent focus:outline-none"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <h5 className="font-extrabold text-slate-800 text-xs">{summary.groupName}</h5>
                          <span className="bg-slate-100 text-slate-500 text-[9px] font-bold px-1.5 py-0.5 rounded">
                            {summary.groupId.substring(0, 8)}
                          </span>
                        </div>
                        <p className="text-[10px] font-bold text-slate-400 mt-0.5">দায়িত্বরত মাঠ কর্মী: <strong className="text-slate-600">{summary.assignedStaffName}</strong></p>
                      </div>

                      <div className="flex items-center gap-4">
                        <div className="text-right text-[11px] font-black">
                          <p className="text-slate-400 text-[9px]">নীট ব্যালেন্স:</p>
                          <p className={totalIn >= totalOut ? 'text-indigo-600' : 'text-rose-600'}>
                            {formatCurrency(totalIn - totalOut)}
                          </p>
                        </div>
                        <div className="text-slate-400">
                          {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </div>
                      </div>
                    </button>

                    {/* Collapsible details table */}
                    {isExpanded && (
                      <div className="bg-white border-t border-slate-150 p-4 space-y-3.5 text-xs font-bold animate-in slide-in-from-top-2 duration-150">
                        <div className="grid grid-cols-2 gap-3">
                          
                          {/* INFLOWS */}
                          <div className="space-y-2 border-r border-slate-150 pr-3">
                            <span className="text-[9px] font-black text-emerald-800 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded uppercase">
                              প্রাপ্তি ও আদায় (Inflow)
                            </span>
                            <div className="flex justify-between items-center py-1 border-b border-dashed border-slate-100">
                              <span className="text-slate-500 font-medium">ক্যাশ আদায়:</span>
                              <span className="font-mono text-emerald-700">{formatCurrency(summary.cashReceipts)}</span>
                            </div>
                            <div className="flex justify-between items-center py-1 border-b border-dashed border-slate-100">
                              <span className="text-slate-500 font-medium">ব্যাংক / চেক আদায়:</span>
                              <span className="font-mono text-blue-700">{formatCurrency(summary.bankReceipts)}</span>
                            </div>
                            <div className="flex justify-between items-center py-1 border-b border-dashed border-slate-100">
                              <span className="text-slate-500 font-medium">সঞ্চয় জমা:</span>
                              <span className="font-mono text-slate-700">{formatCurrency(summary.savingsDeposit)}</span>
                            </div>
                            {summary.cbsDeposit > 0 && (
                              <div className="flex justify-between items-center py-1 border-b border-dashed border-slate-100 text-[11px]">
                                <span className="text-emerald-700 font-medium">তন্মধ্যে মূলধন সঞ্চয় (CBS):</span>
                                <span className="font-mono text-emerald-800">{formatCurrency(summary.cbsDeposit)}</span>
                              </div>
                            )}
                            <div className="flex justify-between items-center py-1">
                              <span className="text-slate-500 font-medium">ঋণ কিস্তি আদায়:</span>
                              <span className="font-mono text-slate-700">{formatCurrency(summary.loanRepayment)}</span>
                            </div>
                            <div className="flex justify-between items-center pt-2 border-t border-slate-150 font-black text-emerald-600">
                              <span>মোট আদায়:</span>
                              <span className="font-mono">{formatCurrency(totalIn)}</span>
                            </div>
                          </div>

                          {/* OUTFLOWS */}
                          <div className="space-y-2 pl-2">
                            <span className="text-[9px] font-black text-rose-800 bg-rose-50 border border-rose-100 px-2 py-0.5 rounded uppercase">
                              বিতরণ ও ফেরত (Outflow)
                            </span>
                            <div className="flex justify-between items-center py-1 border-b border-dashed border-slate-100">
                              <span className="text-slate-500 font-medium">ক্যাশ বিতরণ/খরচ:</span>
                              <span className="font-mono text-rose-700">{formatCurrency(summary.cashPayments)}</span>
                            </div>
                            <div className="flex justify-between items-center py-1 border-b border-dashed border-slate-100">
                              <span className="text-slate-500 font-medium">ব্যাংক / চেক প্রদান:</span>
                              <span className="font-mono text-purple-700">{formatCurrency(summary.bankPayments)}</span>
                            </div>
                            <div className="flex justify-between items-center py-1 border-b border-dashed border-slate-100">
                              <span className="text-slate-500 font-medium">সঞ্চয় ফেরত:</span>
                              <span className="font-mono text-slate-700">{formatCurrency(summary.savingsWithdrawal)}</span>
                            </div>
                            <div className="flex justify-between items-center py-1">
                              <span className="text-slate-500 font-medium">ঋণ বিতরণ:</span>
                              <span className="font-mono text-slate-700">{formatCurrency(summary.loanDisbursement)}</span>
                            </div>
                            <div className="flex justify-between items-center pt-2 border-t border-slate-150 font-black text-rose-600">
                              <span>মোট প্রদান:</span>
                              <span className="font-mono">{formatCurrency(totalOut)}</span>
                            </div>
                          </div>

                        </div>
                      </div>
                    )}

                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>

    </div>
  );
};
