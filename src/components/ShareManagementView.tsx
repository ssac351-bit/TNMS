/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  Coins, 
  UserCheck, 
  TrendingUp, 
  Search, 
  PlusCircle, 
  ArrowLeft, 
  Building, 
  CheckCircle, 
  AlertCircle, 
  Percent, 
  Calendar, 
  Printer, 
  RotateCcw,
  Sliders,
  DollarSign,
  Download,
  Receipt
} from 'lucide-react';
import { parseBanglaFloat, convertBanglaToEnglishNumber } from '../utils/numberHelper';
import { formatDDMMYYYY } from '../lib/dateUtils';

interface ShareManagementViewProps {
  org: any;
  staff: any;
  groupMembers: any[];
  branchGroups: any[];
  onUpdateMember?: (updatedMember: any) => void;
  workingDay?: string;
  onBack: () => void;
}

export const ShareManagementView: React.FC<ShareManagementViewProps> = ({
  org,
  staff,
  groupMembers,
  branchGroups,
  onUpdateMember,
  workingDay = new Date().toISOString().split('T')[0],
  onBack
}) => {
  const [activeTab, setActiveTab] = useState<'register' | 'dividend' | 'history' | 'settings'>('register');

  // --- Cooperative Share Config State ---
  const [sharePrice, setSharePrice] = useState<number>(() => {
    const saved = localStorage.getItem(`tanzil_share_price_${org.id}`);
    return saved ? Number(convertBanglaToEnglishNumber(saved)) || 100 : 100;
  });

  const [minShareCount, setMinShareCount] = useState<number>(() => {
    const saved = localStorage.getItem(`tanzil_min_shares_${org.id}`);
    return saved ? Number(convertBanglaToEnglishNumber(saved)) || 1 : 1;
  });

  const [monthlyDividendRate, setMonthlyDividendRate] = useState<number>(() => {
    const saved = localStorage.getItem(`tanzil_monthly_dividend_rate_${org.id}`);
    return saved ? Number(convertBanglaToEnglishNumber(saved)) || 1.0 : 1.0;
  });

  // --- Search & Filter State ---
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGroupId, setSelectedGroupId] = useState('all');

  // --- Modal States ---
  const [selectedMemberForShare, setSelectedMemberForShare] = useState<any | null>(null);
  const [buyShareCount, setBuyShareCount] = useState('1');
  const [buyShareNote, setBuyShareNote] = useState('অতিরিক্ত শেয়ার ক্রয়');

  // --- Share Refund / Return Modal State ---
  const [selectedMemberForRefund, setSelectedMemberForRefund] = useState<any | null>(null);
  const [refundShareCount, setRefundShareCount] = useState('1');
  const [refundReason, setRefundReason] = useState('সদস্যপদ অবসান/সমাপনীতে শেয়ার ফেরত');

  // --- Dividend Calculation State ---
  const [dividendMode, setDividendMode] = useState<'monthly_provision' | 'annual_payout'>('annual_payout');
  const [dividendYearMonth, setDividendYearMonth] = useState<string>(() => {
    const date = new Date(workingDay);
    const month = String(date.getMonth() + 1).padStart(2, '0');
    return `${date.getFullYear()}-${month}`;
  });
  const [customDividendRate, setCustomDividendRate] = useState<string>(String(monthlyDividendRate));
  const [creditDestination, setCreditDestination] = useState<'GS' | 'Cash' | 'ShareCapital'>('GS');

  // --- Toast/Alert Message ---
  const [alertMsg, setAlertMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // --- Dividend History Log ---
  const [dividendLogs, setDividendLogs] = useState<any[]>(() => {
    const saved = localStorage.getItem(`tanzil_share_dividends_${org.id}`);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error(e);
      }
    }
    return [];
  });

  // Save Configs
  const handleSaveConfig = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem(`tanzil_share_price_${org.id}`, String(sharePrice));
    localStorage.setItem(`tanzil_min_shares_${org.id}`, String(minShareCount));
    localStorage.setItem(`tanzil_monthly_dividend_rate_${org.id}`, String(monthlyDividendRate));
    
    setAlertMsg({
      type: 'success',
      text: 'সমবায় সমিতি শেয়ার কনফিগারেশন সফলভাবে সংরক্ষিত হয়েছে!'
    });
  };

  // Calculate totals
  const shareholdingMembers = groupMembers.filter(m => (m.shareCount && m.shareCount > 0) || (m.shareBalance && m.shareBalance > 0) || m.status === 'active');
  const totalSharesCount = shareholdingMembers.reduce((sum, m) => sum + (Number(m.shareCount) || 1), 0);
  const totalShareCapital = shareholdingMembers.reduce((sum, m) => sum + (Number(m.shareBalance) || (Number(m.shareCount || 1) * sharePrice)), 0);
  const totalShareholders = shareholdingMembers.length;
  const estimatedMonthlyDividend = Math.round(totalShareCapital * (monthlyDividendRate / 100));

  // Filtered members for register table
  const filteredMembers = shareholdingMembers.filter(m => {
    const matchesGroup = selectedGroupId === 'all' || m.groupId === selectedGroupId;
    const query = searchQuery.toLowerCase().trim();
    const matchesSearch = !query || 
      (m.name && m.name.toLowerCase().includes(query)) ||
      (m.memberId && m.memberId.toLowerCase().includes(query)) ||
      (m.phone && m.phone.includes(query));
    return matchesGroup && matchesSearch;
  });

  // Handle Buy Additional Shares
  const handleBuyShareSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMemberForShare) return;

    const countToBuy = parseBanglaFloat(buyShareCount) || 0;
    if (countToBuy <= 0) {
      setAlertMsg({ type: 'error', text: 'শেয়ারের সংখ্যা অবশ্যই ১ বা তার বেশি হতে হবে!' });
      return;
    }

    const currentCount = Number(selectedMemberForShare.shareCount) || 1;
    const currentBal = Number(selectedMemberForShare.shareBalance) || (currentCount * sharePrice);
    const addedAmount = countToBuy * sharePrice;

    const updatedMember = {
      ...selectedMemberForShare,
      shareCount: currentCount + countToBuy,
      shareBalance: currentBal + addedAmount,
      shareValue: sharePrice
    };

    if (onUpdateMember) {
      onUpdateMember(updatedMember);
    }

    // Record Share Transaction
    const tx = {
      id: `sh-tx-${Date.now()}`,
      orgId: org.id,
      memberId: updatedMember.id,
      memberName: updatedMember.name,
      memberCode: updatedMember.memberId,
      type: 'buy',
      shareCount: countToBuy,
      sharePrice: sharePrice,
      totalAmount: addedAmount,
      date: workingDay,
      note: buyShareNote
    };

    const existingTxs = JSON.parse(localStorage.getItem(`tanzil_share_txs_${org.id}`) || '[]');
    localStorage.setItem(`tanzil_share_txs_${org.id}`, JSON.stringify([tx, ...existingTxs]));

    setAlertMsg({
      type: 'success',
      text: `${updatedMember.name} এর জন্য অতিরিক্ত ${countToBuy} টি শেয়ার (৳${addedAmount.toLocaleString('bn-BD')}) সফলভাবে ক্রয় করা হয়েছে!`
    });

    setSelectedMemberForShare(null);
    setBuyShareCount('1');
  };

  // Handle Share Refund / Return / Transfer
  const handleRefundShareSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMemberForRefund) return;

    const countToRefund = parseBanglaFloat(refundShareCount) || 0;
    const currentCount = Number(selectedMemberForRefund.shareCount) || 1;
    const currentBal = Number(selectedMemberForRefund.shareBalance) || (currentCount * sharePrice);

    if (countToRefund <= 0) {
      setAlertMsg({ type: 'error', text: 'ফেরত প্রদানযোগ্য শেয়ারের সংখ্যা অন্তত ১ টি হতে হবে!' });
      return;
    }

    if (countToRefund > currentCount) {
      setAlertMsg({ type: 'error', text: `সদস্যের সর্বোচ্চ ${currentCount} টি শেয়ার রয়েছে। আপনি তার চেয়ে বেশি ফেরত দিতে পারবেন না।` });
      return;
    }

    const refundedAmount = countToRefund * sharePrice;
    const newCount = currentCount - countToRefund;
    const newBal = Math.max(0, currentBal - refundedAmount);

    const updatedMember = {
      ...selectedMemberForRefund,
      shareCount: newCount,
      shareBalance: newBal
    };

    if (onUpdateMember) {
      onUpdateMember(updatedMember);
    }

    // Record Share Refund Transaction
    const tx = {
      id: `sh-refund-${Date.now()}`,
      orgId: org.id,
      memberId: updatedMember.id,
      memberName: updatedMember.name,
      memberCode: updatedMember.memberId,
      type: 'refund',
      shareCount: countToRefund,
      sharePrice: sharePrice,
      totalAmount: refundedAmount,
      date: workingDay,
      note: refundReason
    };

    const existingTxs = JSON.parse(localStorage.getItem(`tanzil_share_txs_${org.id}`) || '[]');
    localStorage.setItem(`tanzil_share_txs_${org.id}`, JSON.stringify([tx, ...existingTxs]));

    setAlertMsg({
      type: 'success',
      text: `${updatedMember.name} এর ${countToRefund} টি শেয়ার (৳${refundedAmount.toLocaleString('bn-BD')}) সফলভাবে ফেরত/সমন্বয় করা হয়েছে!`
    });

    setSelectedMemberForRefund(null);
    setRefundShareCount('1');
  };

  // Bulk Dividend Distribution Engine
  const handleDistributeDividend = () => {
    const rate = parseBanglaFloat(customDividendRate) || monthlyDividendRate;
    if (rate <= 0) {
      setAlertMsg({ type: 'error', text: 'লভ্যাংশের হার অবশ্যই শূন্য থেকে বেশি হতে হবে!' });
      return;
    }

    if (shareholdingMembers.length === 0) {
      setAlertMsg({ type: 'error', text: 'কোন শেয়ারহোল্ডার সদস্য পাওয়া যায়নি!' });
      return;
    }

    // Check if dividend for this month is already distributed
    const alreadyProcessed = dividendLogs.some(log => log.yearMonth === dividendYearMonth);
    if (alreadyProcessed) {
      if (!window.confirm(`${dividendYearMonth} মাসের শেয়ার লভ্যাংশ ইতিমধ্যেই পোস্ট করা হয়েছে। আপনি কি পুনরায় হিসাব ও পোস্ট করতে চান?`)) {
        return;
      }
    }

    let totalDistributed = 0;
    const newRecords: any[] = [];

    shareholdingMembers.forEach((member) => {
      const shares = Number(member.shareCount) || 1;
      const capital = Number(member.shareBalance) || (shares * sharePrice);
      const dividendAmt = Math.round(capital * (rate / 100));

      if (dividendAmt > 0) {
        totalDistributed += dividendAmt;

        // Credit to GS savings balance if selected
        if (creditDestination === 'GS') {
          const currentGs = Number(member.gsBalance || member.savingsBalance || 0);
          const updatedMember = {
            ...member,
            gsBalance: currentGs + dividendAmt,
            savingsBalance: currentGs + dividendAmt
          };
          if (onUpdateMember) {
            onUpdateMember(updatedMember);
          }
        } else if (creditDestination === 'ShareCapital') {
          const sharesAdded = Math.floor(dividendAmt / sharePrice);
          if (sharesAdded > 0) {
            const currentCount = Number(member.shareCount) || 1;
            const currentBal = Number(member.shareBalance) || (currentCount * sharePrice);
            const updatedMember = {
              ...member,
              shareCount: currentCount + sharesAdded,
              shareBalance: currentBal + dividendAmt
            };
            if (onUpdateMember) {
              onUpdateMember(updatedMember);
            }
          }
        }

        newRecords.push({
          id: `div-${Date.now()}-${member.id}`,
          orgId: org.id,
          yearMonth: dividendYearMonth,
          memberId: member.id,
          memberName: member.name,
          memberCode: member.memberId || member.id,
          shareCount: shares,
          shareCapital: capital,
          ratePercent: rate,
          dividendAmount: dividendAmt,
          distributionDate: workingDay,
          creditedTo: creditDestination,
          status: 'paid'
        });
      }
    });

    const updatedLogs = [...newRecords, ...dividendLogs];
    setDividendLogs(updatedLogs);
    localStorage.setItem(`tanzil_share_dividends_${org.id}`, JSON.stringify(updatedLogs));

    setAlertMsg({
      type: 'success',
      text: `সফলভাবে ${dividendYearMonth} মাসের মোট ৳${totalDistributed.toLocaleString('bn-BD')} শেয়ার লভ্যাংশ ${shareholdingMembers.length} জন সদস্যের অ্যাকাউন্টে (${creditDestination === 'GS' ? 'সাধারণ সঞ্চয়' : creditDestination === 'Cash' ? 'ক্যাশ পরিশোধ' : 'শেয়ার মূলধন'}) জমা করা হয়েছে!`
    });
  };

  return (
    <div className="bg-[#f8fafc] min-h-screen pb-12 font-sans animate-in fade-in duration-300">
      {/* Header Bar */}
      <div className="bg-gradient-to-r from-emerald-800 via-emerald-700 to-teal-800 text-white px-5 py-4 shadow-lg sticky top-0 z-20 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 hover:bg-white/10 rounded-xl transition-all cursor-pointer text-white/90 hover:text-white"
            title="ফিরে যান"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h2 className="text-lg font-black tracking-tight flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-300" />
              সমবায় সমিতি শেয়ার মূলধন ও লভ্যাংশ মডিউল
            </h2>
            <p className="text-[11px] text-emerald-100 font-medium">
              সমবায় সমিতি আইন ও নীতিমালা অনুযায়ী সদস্য শেয়ার হিসাব এবং প্রতিমাসের লভ্যাংশ বন্টন
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 bg-emerald-900/60 backdrop-blur-md px-3 py-1.5 rounded-xl border border-emerald-500/30 text-xs font-mono font-bold">
          <Calendar size={14} className="text-emerald-300" />
          <span>কর্মদিবস: {workingDay}</span>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-6 space-y-6">
        {/* Alert Notification Toast */}
        {alertMsg && (
          <div className={`p-4 rounded-2xl border flex items-center justify-between shadow-md animate-in slide-in-from-top-2 duration-200 ${
            alertMsg.type === 'success' 
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}>
            <div className="flex items-center gap-2 font-bold text-xs sm:text-sm">
              {alertMsg.type === 'success' ? <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" /> : <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />}
              <span>{alertMsg.text}</span>
            </div>
            <button 
              onClick={() => setAlertMsg(null)}
              className="text-slate-400 hover:text-slate-600 font-bold text-xs px-2 py-1 rounded-lg"
            >
              বন্ধ করুন
            </button>
          </div>
        )}

        {/* Overview KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-md transition-all">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">মোট শেয়ার মূলধন</span>
              <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
                <Coins size={18} />
              </div>
            </div>
            <div className="text-2xl font-black text-slate-800 font-mono">
              ৳{totalShareCapital.toLocaleString('bn-BD')}
            </div>
            <div className="text-[10px] text-slate-400 font-bold mt-1">
              প্রতি শেয়ার face value ৳{sharePrice}
            </div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-md transition-all">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">বিক্রিত মোট শেয়ার</span>
              <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                <ShieldCheck size={18} />
              </div>
            </div>
            <div className="text-2xl font-black text-slate-800 font-mono">
              {totalSharesCount.toLocaleString('bn-BD')} টি
            </div>
            <div className="text-[10px] text-slate-400 font-bold mt-1">
              সমিতির সংরক্ষিত মূলধন
            </div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-md transition-all">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">শেয়ারহোল্ডার সদস্য</span>
              <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                <UserCheck size={18} />
              </div>
            </div>
            <div className="text-2xl font-black text-slate-800 font-mono">
              {totalShareholders.toLocaleString('bn-BD')} জন
            </div>
            <div className="text-[10px] text-slate-400 font-bold mt-1">
              ১০০% সদস্য শেয়ারহোল্ডার
            </div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-md transition-all">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">মাসিক সম্ভাব্য লভ্যাংশ</span>
              <div className="p-2 bg-amber-50 text-amber-600 rounded-xl">
                <TrendingUp size={18} />
              </div>
            </div>
            <div className="text-2xl font-black text-amber-700 font-mono">
              ৳{estimatedMonthlyDividend.toLocaleString('bn-BD')}
            </div>
            <div className="text-[10px] text-slate-400 font-bold mt-1">
              মাসিক লভ্যাংশের হার {monthlyDividendRate}%
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="bg-white p-1.5 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap gap-1">
          <button
            onClick={() => setActiveTab('register')}
            className={`px-4 py-2.5 rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'register'
                ? 'bg-emerald-700 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <ShieldCheck size={15} />
            ১. সদস্য শেয়ার রেজিস্টার
          </button>

          <button
            onClick={() => setActiveTab('dividend')}
            className={`px-4 py-2.5 rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'dividend'
                ? 'bg-emerald-700 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <TrendingUp size={15} />
            ২. প্রতিমাসের শেয়ার লভ্যাংশ পোস্ট
          </button>

          <button
            onClick={() => setActiveTab('history')}
            className={`px-4 py-2.5 rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'history'
                ? 'bg-emerald-700 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Receipt size={15} />
            ৩. লভ্যাংশ বিবরণী ও রেজিস্টার
          </button>

          <button
            onClick={() => setActiveTab('settings')}
            className={`px-4 py-2.5 rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'settings'
                ? 'bg-emerald-700 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Sliders size={15} />
            ৪. সমবায় কনফিগারেশন
          </button>
        </div>

        {/* TAB 1: Member Share Register */}
        {activeTab === 'register' && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-4">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-sm font-black text-slate-800 uppercase tracking-tight flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  সদস্যদের শেয়ার মূলধন রেজিস্টার
                </h3>
                <p className="text-[11px] text-slate-500">
                  সমবায় সমিতি নীতিমালা অনুযায়ী প্রত্যেক সদস্যের সংরক্ষিত শেয়ার সংখ্যা ও মূলধন হিসাব
                </p>
              </div>

              {/* Filters */}
              <div className="flex items-center gap-2 w-full sm:w-auto">
                {/* Group Filter */}
                <select
                  value={selectedGroupId}
                  onChange={(e) => setSelectedGroupId(e.target.value)}
                  className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:border-emerald-600"
                >
                  <option value="all">সকল সমিতি/গ্রুপ</option>
                  {branchGroups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name} ({g.code})
                    </option>
                  ))}
                </select>

                {/* Search */}
                <div className="relative flex-1 sm:w-60">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    placeholder="সদস্যের নাম বা আইডি খুঁজুন..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-emerald-600"
                  />
                </div>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 font-extrabold uppercase border-b border-slate-200 text-[10px]">
                  <tr>
                    <th className="px-4 py-3">#</th>
                    <th className="px-4 py-3">সদস্যের নাম ও আইডি</th>
                    <th className="px-4 py-3">সমিতি / গ্রুপ</th>
                    <th className="px-4 py-3 text-center">শেয়ার সংখ্যা</th>
                    <th className="px-4 py-3 text-right">প্রতি শেয়ার মূল্য</th>
                    <th className="px-4 py-3 text-right">মোট শেয়ার মূলধন</th>
                    <th className="px-4 py-3 text-center">সার্টিফিকেট নং</th>
                    <th className="px-4 py-3 text-center">অ্যাকশন</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                  {filteredMembers.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-8 text-center text-slate-400 font-bold">
                        কোন শেয়ারহোল্ডার সদস্য পাওয়া যায়নি।
                      </td>
                    </tr>
                  ) : (
                    filteredMembers.map((m, idx) => {
                      const shares = Number(m.shareCount) || 1;
                      const cap = Number(m.shareBalance) || (shares * sharePrice);
                      const grp = branchGroups.find(g => g.id === m.groupId);

                      return (
                        <tr key={m.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="px-4 py-3 text-slate-400 font-mono font-bold">{idx + 1}</td>
                          <td className="px-4 py-3">
                            <div className="font-extrabold text-slate-900">{m.name}</div>
                            <div className="text-[10px] text-slate-400 font-mono font-bold">{m.memberId || m.id}</div>
                          </td>
                          <td className="px-4 py-3">
                            <span className="font-bold text-slate-700">{grp?.name || 'সাধারণ'}</span>
                          </td>
                          <td className="px-4 py-3 text-center font-mono font-black text-indigo-700">
                            {shares.toLocaleString('bn-BD')} টি
                          </td>
                          <td className="px-4 py-3 text-right font-mono font-bold text-slate-600">
                            ৳{sharePrice}
                          </td>
                          <td className="px-4 py-3 text-right font-mono font-black text-emerald-700">
                            ৳{cap.toLocaleString('bn-BD')}
                          </td>
                          <td className="px-4 py-3 text-center font-mono text-[11px] text-slate-500 font-bold">
                            SH-{m.memberId || String(idx + 1001)}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                onClick={() => {
                                  setSelectedMemberForShare(m);
                                  setBuyShareCount('1');
                                }}
                                className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg text-[11px] font-black transition-all flex items-center gap-1 cursor-pointer"
                                title="অতিরিক্ত শেয়ার ক্রয়/জমা"
                              >
                                <PlusCircle size={13} />
                                + জমা
                              </button>
                              <button
                                onClick={() => {
                                  setSelectedMemberForRefund(m);
                                  setRefundShareCount('1');
                                }}
                                className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-[11px] font-black transition-all flex items-center gap-1 cursor-pointer"
                                title="সদস্যপদ অবসান বা সমাপনীতে শেয়ার ফেরত"
                              >
                                <RotateCcw size={13} />
                                ফেরত
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 2: Monthly Share Dividend Engine */}
        {activeTab === 'dividend' && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-5">
            {/* Cooperative Bylaw Policy Notice */}
            <div className="bg-amber-50/80 border border-amber-200/90 rounded-2xl p-4 flex items-start gap-3 text-amber-900 text-xs">
              <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <span className="font-extrabold text-amber-900 block text-xs">
                  📜 সমবায় সমিতি আইন ও উপ-আইন নির্দেশিকা (শেয়ার লভ্যাংশ নীতি):
                </span>
                <p className="text-[11px] leading-relaxed text-amber-800">
                  সমবায় আইনের বিধানানুসারে, প্রতি মাসের হিসাব সমাপনীতে প্রাক্কলিত লভ্যাংশ খরচ (Monthly Dividend Provision) নীট লাভ-ক্ষতি (P&L) হিসাবে অন্তর্ভুক্ত হবে। তবে <strong>সদস্যদেরকে লভ্যাংশ প্রদান বা অ্যাকাউন্টে জমা বছর শেষে (Annual Closing & Audit/AGM) অনুমোদনের পর</strong> সম্পন্ন হবে।
                </p>
              </div>
            </div>

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-sm font-black text-slate-800 uppercase tracking-tight flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-emerald-600" />
                  শেয়ার লভ্যাংশ প্রাক্কলন ও বিতরণ ইঞ্জিন
                </h3>
                <p className="text-[11px] text-slate-500">
                  মাসিক নীট লাভ-ক্ষতির হিসাবের জন্য লভ্যাংশ সংস্থান অথবা বছর শেষে সদস্য একাউন্টে জমা করা
                </p>
              </div>

              {/* Controls */}
              <div className="flex flex-wrap items-center gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">প্রসেসিং এরিয়া</label>
                  <select
                    value={dividendMode}
                    onChange={(e) => setDividendMode(e.target.value as any)}
                    className="px-3 py-1.5 bg-emerald-50 border border-emerald-300 rounded-xl text-xs font-bold text-emerald-900 outline-none cursor-pointer"
                  >
                    <option value="annual_payout">বার্ষিক চুরান্ত লভ্যাংশ প্রদান (Year-End Payout)</option>
                    <option value="monthly_provision">মাসিক লাভ-ক্ষতি সঞ্চিতি (Monthly P&L Provision)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">মাস / বছর</label>
                  <input
                    type="month"
                    value={dividendYearMonth}
                    onChange={(e) => setDividendYearMonth(e.target.value)}
                    className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">লভ্যাংশ হার (%)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={customDividendRate}
                    onChange={(e) => setCustomDividendRate(e.target.value)}
                    className="w-20 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">প্রদানের খাত</label>
                  <select
                    value={creditDestination}
                    onChange={(e) => setCreditDestination(e.target.value as any)}
                    className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none cursor-pointer"
                  >
                    <option value="GS">সাধারণ সঞ্চয় (GS Account)</option>
                    <option value="Cash">ক্যাশ নগদ পরিশোধ (Cash)</option>
                    <option value="ShareCapital">শেয়ার পুনঃবিনয়োগ (Share Capital)</option>
                  </select>
                </div>

                <div className="self-end pt-5">
                  <button
                    type="button"
                    onClick={handleDistributeDividend}
                    className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-xl text-xs font-black shadow-md hover:shadow-lg transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <Coins size={14} />
                    {dividendMode === 'annual_payout' ? 'সদস্য একাউন্টে বিতরণ করুন' : 'মাসিক সংস্থান সেভ করুন'}
                  </button>
                </div>
              </div>
            </div>

            {/* Simulated Dividend Schedule Table */}
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 font-extrabold uppercase border-b border-slate-200 text-[10px]">
                  <tr>
                    <th className="px-4 py-3">#</th>
                    <th className="px-4 py-3">সদস্যের নাম ও আইডি</th>
                    <th className="px-4 py-3 text-center">শেয়ার সংখ্যা</th>
                    <th className="px-4 py-3 text-right">মোট শেয়ার মূলধন</th>
                    <th className="px-4 py-3 text-center">মাসিক লভ্যাংশ %</th>
                    <th className="px-4 py-3 text-right">প্রাপ্য লভ্যাংশ (৳)</th>
                    <th className="px-4 py-3 text-center">জমা হওয়ার স্থান</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                  {shareholdingMembers.map((m, idx) => {
                    const shares = Number(m.shareCount) || 1;
                    const cap = Number(m.shareBalance) || (shares * sharePrice);
                    const rate = parseBanglaFloat(customDividendRate) || monthlyDividendRate;
                    const divAmt = Math.round(cap * (rate / 100));

                    return (
                      <tr key={m.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="px-4 py-3 text-slate-400 font-mono font-bold">{idx + 1}</td>
                        <td className="px-4 py-3">
                          <div className="font-extrabold text-slate-900">{m.name}</div>
                          <div className="text-[10px] text-slate-400 font-mono font-bold">{m.memberId || m.id}</div>
                        </td>
                        <td className="px-4 py-3 text-center font-mono font-bold text-slate-700">
                          {shares.toLocaleString('bn-BD')} টি
                        </td>
                        <td className="px-4 py-3 text-right font-mono font-bold text-slate-800">
                          ৳{cap.toLocaleString('bn-BD')}
                        </td>
                        <td className="px-4 py-3 text-center font-mono font-bold text-indigo-600">
                          {rate}%
                        </td>
                        <td className="px-4 py-3 text-right font-mono font-black text-amber-700">
                          ৳{divAmt.toLocaleString('bn-BD')}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded-lg text-[10px] font-bold border border-emerald-200">
                            {creditDestination === 'GS' ? 'সাধারণ সঞ্চয়' : creditDestination === 'Cash' ? 'ক্যাশ' : 'শেয়ার মূলধন'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 3: Dividend History */}
        {activeTab === 'history' && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-black text-slate-800 uppercase tracking-tight flex items-center gap-2">
                  <Receipt className="w-4 h-4 text-emerald-600" />
                  শেয়ার লভ্যাংশ বন্টন রেজিস্টার ও হিস্টোরি
                </h3>
                <p className="text-[11px] text-slate-500">
                  বিগত মাসসমূহের বন্টনকৃত লভ্যাংশের রেকর্ড ও সদস্যভিত্তিক বিবরণী
                </p>
              </div>

              <button
                onClick={() => window.print()}
                className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <Printer size={14} />
                প্রিন্ট / রিপোর্ট
              </button>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 font-extrabold uppercase border-b border-slate-200 text-[10px]">
                  <tr>
                    <th className="px-4 py-3">#</th>
                    <th className="px-4 py-3">মাস ও তারিখ</th>
                    <th className="px-4 py-3">সদস্যের নাম ও আইডি</th>
                    <th className="px-4 py-3 text-center">শেয়ার মূলধন</th>
                    <th className="px-4 py-3 text-center">হার (%)</th>
                    <th className="px-4 py-3 text-right">প্রদেয় লভ্যাংশ (৳)</th>
                    <th className="px-4 py-3 text-center">জমাকৃত খাত</th>
                    <th className="px-4 py-3 text-center">স্ট্যাটাস</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                  {dividendLogs.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-8 text-center text-slate-400 font-bold">
                        এখনো কোন লভ্যাংশ বন্টন সম্পন্ন করা হয়নি।
                      </td>
                    </tr>
                  ) : (
                    dividendLogs.map((log, idx) => (
                      <tr key={log.id || idx} className="hover:bg-slate-50/70 transition-colors">
                        <td className="px-4 py-3 text-slate-400 font-mono font-bold">{idx + 1}</td>
                        <td className="px-4 py-3">
                          <div className="font-extrabold text-slate-900">{log.yearMonth}</div>
                          <div className="text-[10px] text-slate-400 font-mono">{formatDDMMYYYY(log.distributionDate)}</div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-bold text-slate-800">{log.memberName}</div>
                          <div className="text-[10px] text-slate-400 font-mono">{log.memberCode}</div>
                        </td>
                        <td className="px-4 py-3 text-center font-mono font-bold text-slate-700">
                          ৳{(log.shareCapital || 0).toLocaleString('bn-BD')}
                        </td>
                        <td className="px-4 py-3 text-center font-mono text-indigo-600 font-bold">
                          {log.ratePercent}%
                        </td>
                        <td className="px-4 py-3 text-right font-mono font-black text-emerald-700">
                          ৳{(log.dividendAmount || 0).toLocaleString('bn-BD')}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded text-[10px] font-bold">
                            {log.creditedTo || 'GS'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded text-[10px] font-black">
                            পরিশোধিত
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 4: Cooperative Share Settings */}
        {activeTab === 'settings' && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 max-w-2xl mx-auto space-y-5">
            <div className="border-b border-slate-100 pb-3">
              <h3 className="text-sm font-black text-slate-800 uppercase tracking-tight flex items-center gap-2">
                <Sliders className="w-4 h-4 text-emerald-600" />
                সমবায় সমিতি শেয়ার কনফিগারেশন
              </h3>
              <p className="text-[11px] text-slate-500">
                সমবায় সমিতির উপ-আইন অনুযায়ী শেয়ারের মূল্য, সর্বনিম্ন ক্ৰয় সীমা ও ডিফল্ট লভ্যাংশের হার নির্ধারণ
              </p>
            </div>

            <form onSubmit={handleSaveConfig} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  প্রতি শেয়ারের মূল্য (Face Value per Share) *
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-xs font-bold text-slate-400">৳</span>
                  <input
                    type="number"
                    value={sharePrice}
                    onChange={(e) => setSharePrice(Number(e.target.value) || 100)}
                    className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold font-mono outline-none focus:border-emerald-600"
                    required
                  />
                </div>
                <span className="text-[10px] text-slate-400 font-medium">ডিফল্ট হিসেবে ১০০ টাকা প্রযোজ্য।</span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  সদস্য ভর্তির সময় সর্বনিম্ন ক্ৰয়যোগ্য শেয়ার সংখ্যা *
                </label>
                <input
                  type="number"
                  min="1"
                  value={minShareCount}
                  onChange={(e) => setMinShareCount(Number(e.target.value) || 1)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold font-mono outline-none focus:border-emerald-600"
                  required
                />
                <span className="text-[10px] text-slate-400 font-medium">সমবায় আইন অনুযায়ী সর্বনিম্ন ১ টি শেয়ার ক্রয় বাধ্যতামূলক।</span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  ডিফল্ট মাসিক শেয়ার লভ্যাংশের হার (%) *
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.1"
                    value={monthlyDividendRate}
                    onChange={(e) => setMonthlyDividendRate(Number(e.target.value) || 1.0)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold font-mono outline-none focus:border-emerald-600"
                    required
                  />
                  <span className="absolute right-3 top-2.5 text-xs font-bold text-slate-400">%</span>
                </div>
                <span className="text-[10px] text-slate-400 font-medium">প্রতি মাসের শেয়ার লভ্যাংশ হিসাবের জন্য ডিফল্ট পার্সেন্টেজ।</span>
              </div>

              <div className="pt-3">
                <button
                  type="submit"
                  className="w-full py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-black shadow-md transition-all cursor-pointer"
                >
                  কনফিগারেশন সংরক্ষণ করুন
                </button>
              </div>
            </form>
          </div>
        )}
      </div>

      {/* Modal: Buy Additional Shares */}
      {selectedMemberForShare && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-slate-200">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="text-sm font-black text-slate-800 flex items-center gap-2">
                <PlusCircle className="w-4 h-4 text-emerald-600" />
                অতিরিক্ত শেয়ার ক্রয়
              </h3>
              <button
                onClick={() => setSelectedMemberForShare(null)}
                className="text-slate-400 hover:text-slate-600 font-bold text-xs"
              >
                ✕
              </button>
            </div>

            <div className="bg-emerald-50 p-3 rounded-xl border border-emerald-100 space-y-1">
              <div className="text-xs font-black text-emerald-900">{selectedMemberForShare.name}</div>
              <div className="text-[10px] text-emerald-700 font-mono">আইডি: {selectedMemberForShare.memberId}</div>
              <div className="text-[10px] text-emerald-800 font-bold">
                বর্তমান শেয়ার: {selectedMemberForShare.shareCount || 1} টি (৳{(selectedMemberForShare.shareBalance || (selectedMemberForShare.shareCount || 1) * sharePrice).toLocaleString('bn-BD')})
              </div>
            </div>

            <form onSubmit={handleBuyShareSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">ক্রয়কৃত শেয়ার সংখ্যা *</label>
                <input
                  type="number"
                  min="1"
                  value={buyShareCount}
                  onChange={(e) => setBuyShareCount(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-bold font-mono outline-none focus:border-emerald-600"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">মোট শেয়ার মূল্য (টাকা)</label>
                <div className="px-3 py-2 bg-slate-100 border border-slate-200 rounded-xl text-xs font-black font-mono text-emerald-700">
                  ৳{((parseBanglaFloat(buyShareCount) || 1) * sharePrice).toLocaleString('bn-BD')}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">মন্তব্য/নোট</label>
                <input
                  type="text"
                  value={buyShareNote}
                  onChange={(e) => setBuyShareNote(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-emerald-600"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedMemberForShare(null)}
                  className="w-1/2 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold cursor-pointer"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  className="w-1/2 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black shadow-md cursor-pointer"
                >
                  ক্রয় নিশ্চিত করুন
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Refund / Return Shares */}
      {selectedMemberForRefund && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-slate-200">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="text-sm font-black text-rose-700 flex items-center gap-2">
                <RotateCcw className="w-4 h-4 text-rose-600" />
                শেয়ার ফেরত / হস্তান্তর (সদস্যপদ অবসান)
              </h3>
              <button
                onClick={() => setSelectedMemberForRefund(null)}
                className="text-slate-400 hover:text-slate-600 font-bold text-xs"
              >
                ✕
              </button>
            </div>

            <div className="bg-rose-50 p-3 rounded-xl border border-rose-100 space-y-1">
              <div className="text-xs font-black text-rose-900">{selectedMemberForRefund.name}</div>
              <div className="text-[10px] text-rose-700 font-mono">আইডি: {selectedMemberForRefund.memberId}</div>
              <div className="text-[10px] text-rose-800 font-bold">
                সর্বমোট শেয়ার: {selectedMemberForRefund.shareCount || 1} টি (মূল্য: ৳{(selectedMemberForRefund.shareBalance || (selectedMemberForRefund.shareCount || 1) * sharePrice).toLocaleString('bn-BD')})
              </div>
            </div>

            <form onSubmit={handleRefundShareSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">ফেরতযোগ্য শেয়ার সংখ্যা *</label>
                <input
                  type="number"
                  min="1"
                  max={selectedMemberForRefund.shareCount || 1}
                  value={refundShareCount}
                  onChange={(e) => setRefundShareCount(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-bold font-mono outline-none focus:border-rose-600"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">ফেরতযোগ্য মোট মূল্য (টাকা)</label>
                <div className="px-3 py-2 bg-rose-50 border border-rose-200 rounded-xl text-xs font-black font-mono text-rose-700">
                  ৳{((parseBanglaFloat(refundShareCount) || 1) * sharePrice).toLocaleString('bn-BD')}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">ফেরত বা স্থানান্তরের কারণ/নোট</label>
                <input
                  type="text"
                  value={refundReason}
                  onChange={(e) => setRefundReason(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-rose-600"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedMemberForRefund(null)}
                  className="w-1/2 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold cursor-pointer"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  className="w-1/2 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-black shadow-md cursor-pointer"
                >
                  শেয়ার ফেরত নিশ্চিত করুন
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
