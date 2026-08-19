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
  RefreshCw, 
  Printer, 
  ChevronDown, 
  ChevronUp, 
  FileText,
  UserCheck
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
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);

  // Quick helper to format Bengali numbers / currency
  const formatCurrency = (amount: number) => {
    return '৳' + amount.toLocaleString('bn-BD', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
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
        if (!memberName.includes(query) && !memberCode.includes(query) && !groupName.includes(query) && !desc.includes(query)) {
          return false;
        }
      }

      return true;
    });
  }, [transactions, selectedDate, selectedGroup, selectedStaff, selectedType, searchQuery, groupMap]);

  // Financial summary metrics based on currently filtered transactions
  const metrics = useMemo(() => {
    let totalSavingsDeposit = 0;
    let totalSavingsWithdrawal = 0;
    let totalLoanRepayment = 0;
    let totalLoanDisbursement = 0;
    let totalInsurancePremium = 0;
    let totalOtherIncome = 0;
    let totalOtherExpense = 0;

    filteredTransactions.forEach(t => {
      const amt = Number(t.amount) || 0;
      
      // Determine category based on type/category attributes
      if (t.type === 'collection' || t.type === 'savings_deposit' || t.id?.toString().includes('tx-dep')) {
        totalSavingsDeposit += amt;
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

    const totalReceipts = totalSavingsDeposit + totalLoanRepayment + totalInsurancePremium + totalOtherIncome;
    const totalPayments = totalSavingsWithdrawal + totalLoanDisbursement + totalOtherExpense;
    const netCashFlow = totalReceipts - totalPayments;

    return {
      totalSavingsDeposit,
      totalSavingsWithdrawal,
      totalLoanRepayment,
      totalLoanDisbursement,
      totalInsurancePremium,
      totalOtherIncome,
      totalOtherExpense,
      totalReceipts,
      totalPayments,
      netCashFlow
    };
  }, [filteredTransactions]);

  // Group-wise transaction summaries for current selection
  const groupSummaries = useMemo(() => {
    const summaryMap = new Map<string, {
      groupId: string;
      groupName: string;
      assignedStaffName: string;
      savingsDeposit: number;
      savingsWithdrawal: number;
      loanRepayment: number;
      loanDisbursement: number;
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
        savingsDeposit: 0,
        savingsWithdrawal: 0,
        loanRepayment: 0,
        loanDisbursement: 0,
        totalTx: 0
      });
    });

    // Populate from filtered transactions
    filteredTransactions.forEach(t => {
      if (!t.groupId) return;
      let summary = summaryMap.get(t.groupId);
      if (!summary) {
        // Group was not in list (maybe closed or archived), create on the fly
        const grp = groupMap.get(t.groupId);
        const staffObj = grp ? staffMap.get(grp.assignedStaffId) : null;
        summary = {
          groupId: t.groupId,
          groupName: t.groupName || grp?.name || 'অজানা সমিতি',
          assignedStaffName: staffObj ? staffObj.name : 'অজানা কর্মী',
          savingsDeposit: 0,
          savingsWithdrawal: 0,
          loanRepayment: 0,
          loanDisbursement: 0,
          totalTx: 0
        };
        summaryMap.set(t.groupId, summary);
      }

      const amt = Number(t.amount) || 0;
      summary.totalTx += 1;

      if (t.type === 'collection' || t.type === 'savings_deposit' || t.id?.toString().includes('tx-dep')) {
        summary.savingsDeposit += amt;
      } else if (t.type === 'savings_withdrawal' || t.id?.toString().includes('tx-ret')) {
        summary.savingsWithdrawal += amt;
      } else if (t.type === 'loan_repayment') {
        summary.loanRepayment += amt;
      } else if (t.type === 'disbursement' || t.type === 'loan_disbursement') {
        summary.loanDisbursement += amt;
      }
    });

    // Sort by group name or code
    return Array.from(summaryMap.values())
      .filter(item => item.totalTx > 0 || selectedGroup !== 'all' || selectedStaff !== 'all')
      .sort((a, b) => a.groupName.localeCompare(b.groupName));
  }, [filteredTransactions, branchGroups, selectedGroup, selectedStaff, staffMap, groupMap]);

  // Translate type to Bengali label
  const getTxTypeLabel = (t: any) => {
    if (t.type === 'collection' || t.type === 'savings_deposit' || t.id?.toString().includes('tx-dep')) {
      return { label: 'সঞ্চয় আদায়', bg: 'bg-emerald-100 text-emerald-800 border-emerald-200' };
    }
    if (t.type === 'savings_withdrawal' || t.id?.toString().includes('tx-ret')) {
      return { label: 'সঞ্চয় ফেরত', bg: 'bg-rose-100 text-rose-800 border-rose-200' };
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
      return { label: 'খরচ / প্রদান', bg: 'bg-slate-100 text-slate-800 border-slate-200' };
    }
    return { label: 'অন্যান্য', bg: 'bg-gray-100 text-gray-800 border-gray-200' };
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
            <BookOpen className="text-blue-600 animate-pulse" size={20} />
            দৈনিক লেনদেন সামারী (Daily Transaction Summary)
          </h2>
          <p className="text-xs text-slate-500 font-bold mt-0.5">
            কর্মদিবস ভিত্তিক আদায়, বিতরণ, ফেরত এবং যাবতীয় নগদ বা ব্যাংক লেনদেনের সামারী ও বিশ্লেষণ।
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handlePrint}
            className="px-3.5 py-2 bg-white border border-slate-250 hover:bg-slate-50 text-slate-700 text-xs font-black rounded-xl transition flex items-center gap-1.5 shadow-3xs cursor-pointer"
          >
            <Printer size={14} /> প্রিন্ট করুন
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

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          
          {/* Working Date Select */}
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
                  <option key={date} value={date}>{date === workingDay ? `${formatDDMMYYYY(date)} (আজকের কর্মদিবস)` : formatDDMMYYYY(date)}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Group Select */}
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

          {/* Field Officer Select */}
          <div className="space-y-1">
            <label className="block text-[10px] font-black text-slate-500 uppercase">মাঠ কর্মী (Field Officer)</label>
            <div className="relative">
              <UserCheck size={14} className="absolute left-3 top-3 text-slate-400" />
              <select
                value={selectedStaff}
                onChange={(e) => setSelectedStaff(e.target.value)}
                className="w-full pl-8.5 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-black text-slate-700 focus:outline-none focus:border-indigo-500 focus:bg-white transition cursor-pointer"
              >
                <option value="all">সকল কর্মী ({staffList.filter(s => s.designation?.includes('মাঠ কর্মী') || s.designation?.includes('সংগঠক') || s.id?.startsWith('ILO')).length})</option>
                {staffList.filter(s => s.designation?.includes('মাঠ কর্মী') || s.designation?.includes('সংগঠক') || s.staffId?.startsWith('ILO') || s.id?.startsWith('ILO')).map(s => (
                  <option key={s.staffId || s.id} value={s.staffId || s.id}>{s.name} ({s.staffId || s.id})</option>
                ))}
              </select>
            </div>
          </div>

          {/* Transaction Type Filter */}
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
                <option value="savings_deposit">সঞ্চয় আদায় (Deposit)</option>
                <option value="savings_withdrawal">সঞ্চয় ফেরত (Withdrawal)</option>
                <option value="loan_repayment">ঋণ কিস্তি আদায় (Repayment)</option>
                <option value="loan_disbursement">ঋণ বিতরণ (Disbursement)</option>
                <option value="insurance">বীমা প্রিমিয়াম</option>
                <option value="other_income">অন্যান্য আয় / প্রাপ্তি</option>
                <option value="other_expense">অন্যান্য ব্যয় / খরচ</option>
              </select>
            </div>
          </div>

          {/* Keyword Search */}
          <div className="space-y-1">
            <label className="block text-[10px] font-black text-slate-500 uppercase">সদস্য বা বর্ণনা খুঁজুন</label>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-3 text-slate-400" />
              <input
                type="text"
                placeholder="সদস্য নাম, কোড বা বিবরণ..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8.5 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:bg-white transition"
              />
            </div>
          </div>

        </div>
      </div>

      {/* OVERVIEW STATS (KPI GRID) */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4 mb-6">
        
        {/* Metric 1: Total Receipts */}
        <div className="bg-emerald-50/50 border border-emerald-100 rounded-2xl p-4.5 space-y-1">
          <span className="text-[10px] font-black text-emerald-800 uppercase tracking-wide flex items-center gap-1">
            <TrendingUp size={12} /> মোট জমা / প্রাপ্তি
          </span>
          <p className="text-xl font-black text-emerald-700 font-mono">{formatCurrency(metrics.totalReceipts)}</p>
          <p className="text-[10px] font-semibold text-slate-400">সঞ্চয়, লোন কিস্তি ও অন্যান্য আয়</p>
        </div>

        {/* Metric 2: Total Payments */}
        <div className="bg-rose-50/50 border border-rose-100 rounded-2xl p-4.5 space-y-1">
          <span className="text-[10px] font-black text-rose-800 uppercase tracking-wide flex items-center gap-1">
            <TrendingDown size={12} /> মোট খরচ / প্রদান
          </span>
          <p className="text-xl font-black text-rose-700 font-mono">{formatCurrency(metrics.totalPayments)}</p>
          <p className="text-[10px] font-semibold text-slate-400">লোন বিতরণ, সঞ্চয় ফেরত ও খরচ</p>
        </div>

        {/* Metric 3: Net Cash Flow */}
        <div className={`border rounded-2xl p-4.5 space-y-1 ${metrics.netCashFlow >= 0 ? 'bg-indigo-50/50 border-indigo-100' : 'bg-amber-50/50 border-amber-100'}`}>
          <span className="text-[10px] font-black uppercase tracking-wide block">
            {metrics.netCashFlow >= 0 ? '💸 উদ্বৃত্ত (Net Surplus)' : '⚠️ ঘাটতি (Net Deficit)'}
          </span>
          <p className={`text-xl font-black font-mono ${metrics.netCashFlow >= 0 ? 'text-indigo-700' : 'text-amber-700'}`}>{formatCurrency(metrics.netCashFlow)}</p>
          <p className="text-[10px] font-semibold text-slate-400">মোট প্রাপ্তি বিয়োগ মোট প্রদান</p>
        </div>

        {/* Metric 4: Core Collection break down */}
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4.5 space-y-2 col-span-2 md:col-span-1 lg:col-span-2 grid grid-cols-2 gap-2 text-xs">
          <div>
            <p className="text-slate-400 text-[10px] font-bold">আদায়কৃত সঞ্চয়:</p>
            <p className="font-extrabold text-slate-850 text-slate-800 font-mono">{formatCurrency(metrics.totalSavingsDeposit)}</p>
          </div>
          <div>
            <p className="text-slate-400 text-[10px] font-bold">আদায়কৃত কিস্তি:</p>
            <p className="font-extrabold text-slate-850 text-slate-800 font-mono">{formatCurrency(metrics.totalLoanRepayment)}</p>
          </div>
          <div>
            <p className="text-slate-400 text-[10px] font-bold">বিতরণকৃত ঋণ:</p>
            <p className="font-extrabold text-rose-600 font-mono">{formatCurrency(metrics.totalLoanDisbursement)}</p>
          </div>
          <div>
            <p className="text-slate-400 text-[10px] font-bold">ফেরতকৃত সঞ্চয়:</p>
            <p className="font-extrabold text-rose-600 font-mono">{formatCurrency(metrics.totalSavingsWithdrawal)}</p>
          </div>
        </div>

      </div>

      {/* TABS FOR DETAILS & GROUP-WISE VIEW */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
        
        <div className="bg-slate-50 px-5 py-4 border-b border-slate-150 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <h4 className="text-xs font-black text-slate-700 flex items-center gap-1.5 uppercase">
              <FileText size={14} className="text-indigo-600" />
              লেনদেন খতিয়ান তালিকা ও তথ্য বিশ্লেষণ
            </h4>
            <p className="text-[10px] text-slate-400 font-bold mt-0.5">
              ফিল্টারকৃত মোট {filteredTransactions.length.toLocaleString('bn-BD')} টি লেনদেনের তালিকা নিচে প্রদর্শিত হচ্ছে।
            </p>
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
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-100/70 border-b border-slate-200 text-[10.5px] font-black text-slate-500 uppercase tracking-wider">
                  <th className="py-3.5 px-4">লেনদেন আইডি / তারিখ</th>
                  <th className="py-3.5 px-4">সদস্যের তথ্য</th>
                  <th className="py-3.5 px-4">সমিতি / গ্রুপ</th>
                  <th className="py-3.5 px-4 text-center">লেনদেন ধরন</th>
                  <th className="py-3.5 px-4">খাত বিবরণী / ডেবিট-ক্রেডিট হিসাব</th>
                  <th className="py-3.5 px-4 text-right">টাকার পরিমাণ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-150 text-xs text-slate-700 font-medium">
                {filteredTransactions.map((tx) => {
                  const typeLabel = getTxTypeLabel(tx);
                  const txDate = tx.date || tx.addDate || workingDay;
                  return (
                    <tr key={tx.id} className="hover:bg-slate-50/80 transition duration-150">
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="font-mono text-[10px] text-slate-400 font-bold">{tx.id || 'N/A'}</div>
                        <div className="text-[10px] font-bold text-slate-600 mt-0.5 flex items-center gap-1 font-mono">
                          <Calendar size={10} className="text-slate-400" /> {formatDDMMYYYY(txDate)}
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        {tx.memberName ? (
                          <div>
                            <div className="font-extrabold text-slate-800">{tx.memberName}</div>
                            <div className="text-[10px] text-slate-400 font-mono font-bold mt-0.5">ID: {tx.memberId || 'N/A'}</div>
                          </div>
                        ) : (
                          <span className="text-slate-400 font-bold italic">অফিস সংক্রান্ত / সাধারণ</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        {tx.groupName ? (
                          <div>
                            <div className="font-bold text-slate-700">{tx.groupName}</div>
                            <div className="text-[10px] text-slate-400 font-mono font-bold mt-0.5">ID: {tx.groupId || 'N/A'}</div>
                          </div>
                        ) : (
                          <span className="text-slate-400 font-bold">—</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap text-center">
                        <span className={`inline-block text-[9px] font-black px-2.5 py-1 rounded-md border ${typeLabel.bg}`}>
                          {typeLabel.label}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 max-w-xs">
                        <div className="font-bold text-slate-700 line-clamp-2">{tx.description || tx.category || 'দৈনিক লেনদেন পোস্টিং'}</div>
                        <div className="flex items-center gap-2 mt-1 text-[10px] font-bold text-slate-400">
                          {tx.debitAcc && <span>Dr: <strong className="text-slate-600 font-mono">{tx.debitAcc}</strong></span>}
                          {tx.creditAcc && <span>Cr: <strong className="text-slate-600 font-mono">{tx.creditAcc}</strong></span>}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono text-sm font-black whitespace-nowrap">
                        <span className={
                          tx.type === 'collection' || tx.type === 'savings_deposit' || tx.type === 'loan_repayment' || tx.type === 'income' || tx.id?.toString().includes('tx-dep')
                            ? 'text-emerald-600'
                            : 'text-rose-600'
                        }>
                          {tx.type === 'collection' || tx.type === 'savings_deposit' || tx.type === 'loan_repayment' || tx.type === 'income' || tx.id?.toString().includes('tx-dep')
                            ? '+' : '—'} {formatCurrency(Number(tx.amount) || 0)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
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
            প্রতিটি সমিতির মোট সঞ্চয় আদায়, ঋণ কিস্তি আদায়, ঋণ বিতরণ এবং সঞ্চয় ফেরত হিসেব।
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
                const totalIn = summary.savingsDeposit + summary.loanRepayment;
                const totalOut = summary.savingsWithdrawal + summary.loanDisbursement;
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
                          <p className="text-slate-400 text-[9px]">নেট ক্যাশ-ইন:</p>
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
                              প্রাপ্তি (Inflow)
                            </span>
                            <div className="flex justify-between items-center py-1 border-b border-dashed border-slate-100">
                              <span className="text-slate-500 font-medium">সঞ্চয় জমা:</span>
                              <span className="font-mono text-slate-700">{formatCurrency(summary.savingsDeposit)}</span>
                            </div>
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
                              প্রদান (Outflow)
                            </span>
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
