/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  ArrowLeft, 
  Search, 
  User, 
  Phone, 
  CreditCard, 
  Layers, 
  MapPin, 
  Smile, 
  ShieldAlert,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  XCircle,
  TrendingUp,
  AlertCircle,
  RefreshCw,
  Sliders,
  Scale,
  FileText
} from 'lucide-react';
import { MemberPassbook } from './MemberPassbook';
import { calculateFdrInterest } from './fdrCalculator';
import { processLoanAdjustment } from '../lib/loanAdjustment';
import DocumentCenter from './DocumentCenter';
import { formatDDMMYYYY } from '../lib/dateUtils';

interface MemberInformationViewProps {
  onBack: () => void;
  groupMembers: any[];
  branchGroups: any[];
  selectedGroupId: string;
  onUpdateStatus: (memberId: string, newStatus: 'active' | 'inactive', reason?: string) => void;
  savingsAccounts?: any[];
  cbsAccounts?: any[];
  ltsAccounts?: any[];
  transactions?: any[];
  onTransferMember?: (memberId: string, newGroupId: string) => void;
  onCloseAccount?: (memberId: string, accountId: string, accountType: 'GS' | 'CBS' | 'LTS', payoutAmount: number, interestEarned: number, penalty: number, reason: string) => void;
  onLoanAction?: (memberId: string, actionType: 'rebate' | 'reschedule' | 'adjustment' | 'auto_adjustment' | 'write_off' | 'close', details: any) => void;
  org?: any;
  staff?: any;
  workingDay?: string;
  isReadOnly?: boolean;
}

export const MemberInformationView: React.FC<MemberInformationViewProps> = ({
  onBack,
  groupMembers,
  branchGroups,
  selectedGroupId,
  onUpdateStatus,
  savingsAccounts = [],
  cbsAccounts = [],
  ltsAccounts = [],
  transactions = [],
  onTransferMember,
  onCloseAccount,
  onLoanAction,
  org,
  staff,
  workingDay,
  isReadOnly = false
}) => {
  const calculateSavingsPayout = (
    type: string,
    balance: number,
    isMature: boolean,
    monthsElapsedOrTerm: number,
    customInterestRate?: number
  ) => {
    const principal = balance;
    const isFdr = type === 'FDR';
    const isCbs = type.includes('CBS') || type === 'CBS';
    const isLts = type.includes('LTS') || type === 'LTS';
    const isGs = type.includes('GS') || type === 'GS';

    // Annual interest rates
    const getStoredRate = (key: string, fallback: number) => {
      try {
        const saved = localStorage.getItem(`tanzil_${key}_${org?.id || ''}`);
        if (!saved) return fallback;
        const eng = saved.replace(/[০-৯]/g, (d: string) => String.fromCharCode(d.charCodeAt(0) - 2406 + 48));
        const parsed = parseFloat(eng);
        return isNaN(parsed) ? fallback : parsed;
      } catch (e) {
        return fallback;
      }
    };

    const normalRate = customInterestRate || (
      isFdr ? getStoredRate('sav_profit_fdr', 12) : 
      isCbs ? getStoredRate('sav_profit_cbs', 8.5) : 
      isLts ? getStoredRate('sav_profit_lts', 12) : 
      getStoredRate('sav_profit_gs', 6)
    );
    const generalSavingsRate = getStoredRate('sav_profit_gs', 6);

    if (isMature) {
      const interest = principal * (normalRate / 100) * (monthsElapsedOrTerm / 12);
      return {
        interestEarned: interest,
        penalty: 0,
        finalAmount: principal + interest
      };
    } else {
      // Premature
      if (isGs) {
        const interest = principal * (generalSavingsRate / 100) * (monthsElapsedOrTerm / 12);
        return {
          interestEarned: interest,
          penalty: 0,
          finalAmount: principal + interest
        };
      } else {
        // For FDR, CBS, LTS - Switch to General Savings Rate for the period elapsed
        const interestAtNormalRate = principal * (normalRate / 100) * (monthsElapsedOrTerm / 12);
        const interestAtGsRate = principal * (generalSavingsRate / 100) * (monthsElapsedOrTerm / 12);
        
        // Penalty is the difference in interest
        const penalty = interestAtNormalRate - interestAtGsRate;
        
        return {
          interestEarned: interestAtGsRate,
          penalty: penalty > 0 ? penalty : 0,
          finalAmount: principal + interestAtGsRate
        };
      }
    }
  };

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [expandedMemberId, setExpandedMemberId] = useState<string | null>(null);

  // Administrative control panel states
  const [selectedActionTab, setSelectedActionTab] = useState<'status' | 'transfer' | 'loan' | 'acc_closing' | 'documents' | null>(null);
  const [transferTargetGroupId, setTransferTargetGroupId] = useState('');
  
  // Loan actions sub-states
  const [loanActionType, setLoanActionType] = useState<'rebate' | 'reschedule' | 'adjustment' | 'write_off' | 'close' | null>(null);
  const [loanActionAmt, setLoanActionAmt] = useState('');
  const [loanActionReason, setLoanActionReason] = useState('');
  const [rescheduleInstallment, setRescheduleInstallment] = useState('');
  const [selectedSavingsAccId, setSelectedSavingsAccId] = useState('');

  // Account closing sub-states
  const [selectedAccToClose, setSelectedAccToClose] = useState<any | null>(null);
  const [isMature, setIsMature] = useState(true);
  const [monthsElapsed, setMonthsElapsed] = useState(12);
  const [calcResult, setCalcResult] = useState<{ interestEarned: number, penalty: number, finalAmount: number } | null>(null);
  
  // Statement modal/layer state
  const [selectedStatement, setSelectedStatement] = useState<{
    member: any;
    accountType: 'PL' | 'GS' | 'CBS' | 'LTS';
    accountName: string;
    accountNo?: string;
    balance: number;
  } | null>(null);

  // Status editing sub-state
  const [editingStatusId, setEditingStatusId] = useState<string | null>(null);
  const [tempStatus, setTempStatus] = useState<'active' | 'inactive'>('active');
  const [tempReason, setTempReason] = useState('ভর্তি বাতিল');
  const [statusError, setStatusError] = useState<string | null>(null);

  // Filter members based on selected Group, Search query, and Status
  const filtered = groupMembers.filter((m) => {
    // Group filter: if selectedGroupId is set, match. Otherwise show all of this branch
    if (selectedGroupId && m.groupId !== selectedGroupId) return false;
    
    // Status filter
    if (statusFilter !== 'all' && m.status !== statusFilter) return false;

    // Search text constraint
    const query = searchTerm.toLowerCase();
    if (!query) return true;

    return (
      m.name.toLowerCase().includes(query) ||
      m.memberId.toLowerCase().includes(query) ||
      m.phone.includes(query) ||
      (m.nid && m.nid.includes(query))
    );
  });

  const getGroupName = (gId: string) => {
    const group = branchGroups.find((g) => g.id === gId);
    return group ? `${group.name} (${group.code})` : 'সাধারন গ্রাহক';
  };

  const getAccountStatement = (memberObj: any, type: 'PL' | 'GS' | 'CBS' | 'LTS') => {
    const mTxList = (transactions || []).filter(
      (t) => t.memberId === memberObj.memberId || t.memberId === memberObj.id
    );

    const sortedTx = [...mTxList].sort((a, b) => (a.date || a.addDate || '').localeCompare(b.date || b.addDate || ''));

    let runningBal = 0;
    const items: any[] = [];

    if (type === 'PL') {
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
          runningBal -= credit;
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
        }
      });
    } else if (type === 'CBS') {
      const finalBal = memberObj.cbsBalance || 0;
      let netChange = 0;

      sortedTx.forEach((t) => {
        if (t.type === 'collection') {
          if (t.collections?.cbs > 0) netChange += t.collections.cbs;
          if (t.withdrawals?.cbs > 0) netChange -= t.withdrawals.cbs;
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
        }
      });
    } else if (type === 'LTS') {
      const finalBal = memberObj.ltsBalance || 0;
      let netChange = 0;

      sortedTx.forEach((t) => {
        if (t.type === 'collection' && t.collections?.lts > 0) {
          netChange += t.collections.lts;
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

          if (deposit > 0) {
            currentTempBal = currentTempBal + deposit;
            items.push({
              date: t.date || t.addDate,
              title: 'LTS সঞ্চয় জমা (Deposit)',
              debit: deposit,
              credit: 0,
              balance: currentTempBal,
            });
          }
        }
      });
    }

    return items.reverse();
  };

  const handleToggleDetails = (id: string) => {
    setExpandedMemberId(expandedMemberId === id ? null : id);
    setSelectedActionTab(null);
    setLoanActionType(null);
    setSelectedAccToClose(null);
  };

  const startEditStatus = (member: any) => {
    setEditingStatusId(member.id);
    setTempStatus(member.status || 'active');
    setTempReason(member.inactiveReason || 'ভর্তি বাতিল');
    setStatusError(null);
  };

  const saveStatusChange = (id: string) => {
    if (isReadOnly) {
      alert('শাখা ব্যবস্থাপক (BM) হিসেবে সদস্য স্ট্যাটাস পরিবর্তন করতে পারবেন না। এটি রিড-অনলি মোডে রয়েছে।');
      return;
    }
    const targetMember = groupMembers.find(m => m.id === id);
    if (tempStatus === 'inactive' && targetMember) {
      const plOut = targetMember.plOutstanding || 0;
      const cbsBal = targetMember.cbsBalance || 0;
      const ltsBal = targetMember.ltsBalance || 0;
      const gsBal = targetMember.gsBalance || targetMember.savingsBalance || 0;

      if (plOut > 0 || cbsBal > 0 || ltsBal > 0 || gsBal > 0) {
        setStatusError("সদস্যের সক্রিয় অ্যাকাউন্ট (PL, CBS, LTS, GS) ও ব্যালেন্স থাকায় নিষ্ক্রিয় করা যাবে না!");
        return;
      }
    }

    onUpdateStatus(id, tempStatus, tempStatus === 'inactive' ? tempReason : '');
    setEditingStatusId(null);
    setStatusError(null);
  };

  return (
    <div className="bg-[#f4f6f9] text-slate-800 animate-in fade-in duration-300 rounded-3xl relative overflow-hidden border border-slate-300 max-w-md mx-auto shadow-2xl">
      {/* HEADER */}
      <div className="bg-[#2f6ce5] text-white px-5 py-4 flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          className="p-1 -ml-1 rounded-full hover:bg-white/10 active:scale-90 transition-all cursor-pointer flex items-center justify-center"
        >
          <ArrowLeft className="w-5 h-5 text-white" />
        </button>
        <div className="text-center">
          <h2 className="font-black text-sm sm:text-base tracking-wide flex items-center gap-1.5 justify-center">
            <User className="w-4 h-4 text-emerald-400" />
            সদস্য তথ্য ও KYC বিবরণী
          </h2>
          <p className="text-[10px] text-sky-100/95 font-bold mt-0.5">মোট সদস্য সংখ্যা: {filtered.length} জন</p>
        </div>
        <div className="w-7"></div>
      </div>

      {isReadOnly && (
        <div className="bg-amber-50 border-b border-amber-200 text-amber-900 px-4 py-2.5 text-xs font-bold flex items-center justify-between shadow-2xs">
          <div className="flex items-center gap-1.5">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>শাখা ব্যবস্থাপক (BM) - রিড-অনলি মোড (শুধু তথ্য পরিদর্শন)</span>
          </div>
          <span className="bg-amber-200 text-amber-900 text-[10px] px-2 py-0.5 rounded font-black">View Only</span>
        </div>
      )}

      {/* FILTER SEARCH BARS */}
      <div className="bg-white border-b border-slate-200 p-4 space-y-3 font-sans">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="নাম, মোবাইল বা মেম্বার আইডি খুঁজুন..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 hover:border-slate-300 rounded-xl pl-9 pr-4 py-2 text-xs font-bold text-slate-850 outline-none focus:ring-1 focus:ring-indigo-500 transition-all"
          />
        </div>

        {/* Status Filters */}
        <div className="flex gap-1.5 justify-between">
          <button
            type="button"
            onClick={() => setStatusFilter('all')}
            className={`flex-1 py-1.5 px-2 rounded-lg text-[11px] font-black transition-colors ${
              statusFilter === 'all' 
                ? 'bg-[#2f6ce5] text-white' 
                : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
            }`}
          >
            সবাই ({groupMembers.filter(m => !selectedGroupId || m.groupId === selectedGroupId).length})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('active')}
            className={`flex-1 py-1.5 px-2 rounded-lg text-[11px] font-black transition-colors flex items-center justify-center gap-1 ${
              statusFilter === 'active' 
                ? 'bg-emerald-600 text-white' 
                : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-100'
            }`}
          >
            সচল ({groupMembers.filter(m => (!selectedGroupId || m.groupId === selectedGroupId) && m.status === 'active').length})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('inactive')}
            className={`flex-1 py-1.5 px-2 rounded-lg text-[11px] font-black transition-colors flex items-center justify-center gap-1 ${
              statusFilter === 'inactive' 
                ? 'bg-rose-600 text-white' 
                : 'bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-100'
            }`}
          >
            নিষ্ক্রিয় ({groupMembers.filter(m => (!selectedGroupId || m.groupId === selectedGroupId) && m.status === 'inactive').length})
          </button>
        </div>
      </div>

      {/* MEMBER CARDS LIST AREA */}
      <div className="p-4 space-y-4 max-h-[60vh] overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-2xl border border-slate-200 p-6 space-y-3">
            <Smile className="w-10 h-10 text-amber-400 mx-auto animate-bounce" />
            <p className="text-slate-500 font-extrabold text-xs sm:text-sm">কোনো সদস্য তথ্য পাওয়া যায়নি</p>
            <p className="text-[10px] text-slate-400">এই সমিতি বা ফিল্টারে ভর্তি হওয়া কোনো গ্রাহক নেই। নতুন সদস্য ভর্তি করতে &apos;Member Admission&apos; ফর্মটি ব্যবহার করুন।</p>
          </div>
        ) : (
          filtered.map((member) => {
            const isExpanded = expandedMemberId === member.id;
            const isCurrentEditingStatus = editingStatusId === member.id;

            return (
              <div 
                key={member.id} 
                className={`bg-white rounded-2xl border transition-all duration-200 overflow-hidden ${
                  isExpanded ? 'border-indigo-400 shadow-md ring-1 ring-indigo-200' : 'border-slate-200 shadow-sm hover:border-slate-350'
                }`}
              >
                {/* SIMPLE DETAILS PANEL (Always visible) */}
                <div 
                  className="p-4 flex items-center justify-between cursor-pointer select-none"
                  onClick={() => handleToggleDetails(member.id)}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 border border-slate-200">
                      <User className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="font-extrabold text-slate-800 text-xs sm:text-sm">{member.name}</div>
                      <div className="text-[10px] text-slate-400 font-mono mt-0.5 flex items-center gap-2">
                        <span>{member.memberId || 'MEM-N/A'}</span>
                        <span>•</span>
                        <span>{member.phone}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5">
                    {member.status === 'inactive' ? (
                      <span className="bg-rose-50 border border-rose-100 text-rose-700 text-[9px] px-2 py-0.5 rounded font-black uppercase">
                        নিষ্ক্রিয়
                      </span>
                    ) : (
                      <span className="bg-emerald-50 border border-emerald-100 text-emerald-700 text-[9px] px-2 py-0.5 rounded font-black uppercase">
                        সচল
                      </span>
                    )}
                    {isExpanded ? <ChevronUp size={14} className="text-slate-400" /> : <ChevronDown size={14} className="text-slate-400" />}
                  </div>
                </div>

                {/* EXPANDED KYC PROFILE DETAILS */}
                {isExpanded && (
                  <div className="bg-slate-50 border-t border-slate-100 p-4 space-y-4 text-[11px] animate-in slide-in-from-top-2 duration-150">
                    
                    {/* Samity Reference */}
                    <div className="bg-white p-2.5 rounded-xl border border-slate-200/80 flex justify-between items-center font-bold">
                      <span className="text-slate-400">সমিতি নাম:</span>
                      <span className="text-indigo-600 text-xs md:text-[11px] font-black">{getGroupName(member.groupId)}</span>
                    </div>

                    {/* Detailed Info Grid */}
                    <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-slate-650">
                      <div>
                        <div className="text-slate-400 font-bold mb-0.5">পিতা / স্বামীর নাম:</div>
                        <div className="text-slate-800 font-black">{member.fatherHusbandName || 'N/A'}</div>
                      </div>
                      <div>
                        <div className="text-slate-400 font-bold mb-0.5">মাতার নাম:</div>
                        <div className="text-slate-800 font-black">{member.motherName || 'N/A'}</div>
                      </div>
                      <div>
                        <div className="text-slate-400 font-bold mb-0.5">জাতীয় পরিচয় নম্বর:</div>
                        <div className="text-slate-800 font-mono font-black">{member.nid || 'N/A'}</div>
                      </div>
                      <div>
                        <div className="text-slate-400 font-bold mb-0.5">জন্ম তারিখ:</div>
                        <div className="text-slate-800 font-mono font-black">{member.dob || 'N/A'}</div>
                      </div>
                      <div>
                        <div className="text-slate-400 font-bold mb-0.5">ধর্ম / লিঙ্গ:</div>
                        <div className="text-slate-800 font-black">{member.religion || 'ইসলাম'} / {member.gender || 'মহিলা'}</div>
                      </div>
                      <div>
                        <div className="text-slate-400 font-bold mb-0.5">শিক্ষাগত যোগ্যতা:</div>
                        <div className="text-slate-800 font-black">{member.education || 'N/A'}</div>
                      </div>
                      <div>
                        <div className="text-slate-400 font-bold mb-0.5">পেশা / অভিভাবকের পেশা:</div>
                        <div className="text-slate-800 font-black">{member.profession || 'গৃহিণী'} / {member.guardianProfession || 'কৃষি'}</div>
                      </div>
                      <div>
                        <div className="text-slate-400 font-bold mb-0.5">ভর্তির তারিখ:</div>
                        <div className="text-slate-800 font-mono font-black">{member.admissionDate || member.addDate ? formatDDMMYYYY(member.admissionDate || member.addDate) : 'N/A'}</div>
                      </div>
                    </div>

                    {/* Addresses */}
                    <div className="border-t border-slate-200/60 pt-2.5 space-y-1.5 col-span-2">
                      <div className="flex items-start gap-1">
                        <MapPin size={12} className="text-[#2f6ce5] shrink-0 mt-0.5" />
                        <div>
                          <span className="text-slate-400 font-bold">বর্তমান ঠিকানা: </span>
                          <span className="text-slate-800 font-extrabold">{member.address || 'N/A'}</span>
                        </div>
                      </div>
                    </div>

                    {/* Nominee details info */}
                    <div className="border-t border-slate-200/60 pt-2.5 space-y-1 bg-white p-2.5 rounded-xl border border-slate-150">
                      <div className="text-[10px] text-teal-600 font-black uppercase tracking-wide flex items-center gap-1">
                        <Smile className="w-3.5 h-3.5" />
                        নমিনী বিবরণী (Nominee Information)
                      </div>
                      <div className="grid grid-cols-2 gap-2 mt-1.5 text-slate-600">
                        <div>
                          <span className="text-slate-400">নমিনির নাম:</span>
                          <div className="font-black text-slate-800">{member.nomineeName || 'N/A'}</div>
                        </div>
                        <div>
                          <span className="text-slate-400">সম্পর্ক:</span>
                          <div className="font-black text-slate-800">{member.nomineeRelation || 'N/A'}</div>
                        </div>
                        {member.nomineeNid && (
                          <div className="col-span-2">
                            <span className="text-slate-400">নমিনির NID/জন্ম নিবন্ধন নং:</span>
                            <div className="font-mono font-black text-slate-800">{member.nomineeNid}</div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Savings Deposit */}
                    {(() => {
                      const mSavings = savingsAccounts.filter((acc: any) => acc.memberId === member.id && acc.status === 'active');
                      const mCbs = cbsAccounts.filter((acc: any) => acc.memberId === member.id && acc.status === 'active');
                      const mLts = ltsAccounts.filter((acc: any) => acc.memberId === member.id && acc.status === 'active');
                      const hasAnyAccounts = mSavings.length > 0 || mCbs.length > 0 || mLts.length > 0;

                      if (hasAnyAccounts) return null;

                      return (
                        <div className="bg-indigo-50 border border-indigo-100 p-2.5 rounded-xl flex items-center justify-between">
                          <div className="flex items-center gap-1.5 text-indigo-700 font-bold">
                            <TrendingUp size={13} />
                            <span>প্রারম্ভিক সঞ্চয় ব্যালেন্স:</span>
                          </div>
                          <span className="text-indigo-800 font-extrabold">৳{(member.savingsBalance || 0).toLocaleString('bn-BD')}</span>
                        </div>
                      );
                    })()}

                    {/* Active Accounts List */}
                    {(() => {
                      const mSavings = savingsAccounts.filter((acc: any) => acc.memberId === member.id && acc.status === 'active');
                      const mCbs = cbsAccounts.filter((acc: any) => acc.memberId === member.id && acc.status === 'active');
                      const mLts = ltsAccounts.filter((acc: any) => acc.memberId === member.id && acc.status === 'active');
                      const hasPl = (member.plOutstanding ?? 0) > 0;
                      const hasAnyAccounts = hasPl || mSavings.length > 0 || mCbs.length > 0 || mLts.length > 0;

                      if (!hasAnyAccounts) return null;

                      return (
                        <div className="bg-white p-3 rounded-xl border border-slate-200/80 space-y-2 font-sans text-xs">
                          <div className="flex justify-between items-center border-b border-slate-100 pb-1">
                            <div className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-wide">
                              সদস্যের সক্রিয় হিসাবসমূহ (Active Accounts - PL, GS, CBS, LTS)
                            </div>
                            <span className="text-[8px] font-bold text-[#2f6ce5] bg-blue-50 px-1.5 py-0.5 rounded animate-pulse">
                              স্টেটমেন্ট দেখতে ক্লিক করুন
                            </span>
                          </div>
                          <div className="space-y-1.5">
                            {hasPl && (
                              <div
                                onClick={() => setSelectedStatement({
                                  member,
                                  accountType: 'PL',
                                  accountName: 'প্রাথমিক ঋণ হিসাব (PL)',
                                  balance: member.plOutstanding
                                })}
                                className="flex justify-between items-center text-[10px] bg-rose-50/50 hover:bg-rose-100/50 px-2 py-1.5 rounded border border-rose-100 cursor-pointer transition-colors active:scale-[0.99]"
                                title="স্টেটমেন্ট দেখতে ক্লিক করুন"
                              >
                                <div>
                                  <span className="font-extrabold text-rose-800">প্রাথমিক ঋণ হিসাব (PL)</span>
                                  <div className="text-[9px] text-rose-500 block font-bold">নির্ধারিত কিস্তি: ৳{(member.plInstallment ?? 600).toLocaleString('bn-BD')}</div>
                                </div>
                                <span className="font-black text-rose-900">৳{member.plOutstanding.toLocaleString('bn-BD')}</span>
                              </div>
                            )}
                            {mSavings.map((acc: any) => (
                              <div
                                key={acc.id}
                                onClick={() => setSelectedStatement({
                                  member,
                                  accountType: 'GS',
                                  accountName: acc.type === 'GS' ? 'সাধারণ সঞ্চয় (GS)' : 'স্থায়ী আমানত (FDR)',
                                  accountNo: acc.accountNo,
                                  balance: acc.balance
                                })}
                                className="flex justify-between items-center text-[10px] bg-slate-50 hover:bg-slate-100 px-2 py-1.5 rounded border border-slate-100 cursor-pointer transition-colors active:scale-[0.99]"
                                title="স্টেটমেন্ট দেখতে ক্লিক করুন"
                              >
                                <div>
                                  <span className="font-extrabold text-slate-700">
                                    {acc.type === 'GS' ? 'সাধারণ সঞ্চয় (GS)' : 'স্থায়ী আমানত (FDR)'}
                                  </span>
                                  <div className="text-[9px] text-slate-400 font-mono">{acc.accountNo} {acc.type === 'FDR' && `(${acc.termMonths} মাস, ${acc.interestRate}%)`}</div>
                                </div>
                                <span className="font-black text-slate-800">৳{acc.balance.toLocaleString('bn-BD')}</span>
                              </div>
                            ))}
                            {mCbs.map((acc: any) => (
                              <div
                                key={acc.id}
                                onClick={() => setSelectedStatement({
                                  member,
                                  accountType: 'CBS',
                                  accountName: 'ক্যাপিটাল বিল্ড-আপ সঞ্চয় (CBS)',
                                  accountNo: acc.accountNo,
                                  balance: acc.balance
                                })}
                                className="flex justify-between items-center text-[10px] bg-blue-50/50 hover:bg-blue-100/40 px-2 py-1.5 rounded border border-blue-105 cursor-pointer transition-colors active:scale-[0.99]"
                                title="স্টেটমেন্ট দেখতে ক্লিক করুন"
                              >
                                <div>
                                  <span className="font-extrabold text-blue-800">ক্যাপিটাল বিল্ড-আপ সঞ্চয় (CBS)</span>
                                  <div className="text-[9px] text-blue-550 block font-bold">মনোনীত: {acc.nomineeName || 'অনির্ধারিত'} | {acc.frequency === 'weekly' ? 'সাপ্তাহিক কিস্তি' : 'মাসিক কিস্তি'}: ৳{(acc.cbsInstallment || (acc.frequency === 'weekly' ? 10 : 50)).toLocaleString('bn-BD')} | {acc.accountNo}</div>
                                </div>
                                <span className="font-black text-blue-900">৳{acc.balance.toLocaleString('bn-BD')}</span>
                              </div>
                            ))}
                            {mLts.map((acc: any) => (
                              <div
                                key={acc.id}
                                onClick={() => setSelectedStatement({
                                  member,
                                  accountType: 'LTS',
                                  accountName: 'দীর্ঘমেয়াদী সঞ্চয় (LTS)',
                                  accountNo: acc.accountNo,
                                  balance: acc.balance
                                })}
                                className="flex justify-between items-center text-[10px] bg-emerald-50/50 hover:bg-emerald-100/40 px-2 py-1.5 rounded border border-emerald-105 cursor-pointer transition-colors active:scale-[0.99]"
                                title="স্টেটমেন্ট দেখতে ক্লিক করুন"
                              >
                                <div>
                                  <span className="font-extrabold text-emerald-800">দীর্ঘমেয়াদী সঞ্চয় (LTS)</span>
                                  <div className="text-[9px] text-emerald-600 block font-bold">মেয়াদ: {acc.termMonths} মাস | কিস্তি: ৳{acc.monthlyInstallment.toLocaleString('bn-BD')} | {acc.accountNo}</div>
                                </div>
                                <span className="font-black text-emerald-950">৳{acc.balance.toLocaleString('bn-BD')}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })()}

                    {/* SPECIAL ADMINISTRATIVE & FINANCIAL CONTROLS */}
                    <div className="border-t border-slate-200/60 pt-3 mt-3 space-y-3 font-sans">
                      <div className="text-[10px] text-teal-700 font-extrabold uppercase tracking-wide flex items-center gap-1">
                        <ShieldAlert size={14} className="text-teal-600" />
                        প্রশাসনিক ও আর্থিক অপশন (Administrative & Financial Controls)
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                        {/* 1. Status Change */}
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedActionTab(selectedActionTab === 'status' ? null : 'status');
                            startEditStatus(member);
                          }}
                          className={`text-[10px] font-bold p-2.5 border rounded-xl flex flex-col items-center justify-center gap-1 transition-all ${
                            selectedActionTab === 'status' 
                              ? 'bg-amber-50 border-amber-350 text-amber-900 shadow-sm' 
                              : 'bg-slate-50/50 border-slate-200 text-slate-700 hover:bg-slate-100'
                          }`}
                        >
                          <AlertCircle size={15} className="text-amber-500" />
                          <span className="font-extrabold">স্ট্যাটাস পরিবর্তন / ক্লোজিং</span>
                        </button>

                        {/* 2. Member Transfer */}
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedActionTab(selectedActionTab === 'transfer' ? null : 'transfer');
                            setTransferTargetGroupId('');
                          }}
                          className={`text-[10px] font-bold p-2.5 border rounded-xl flex flex-col items-center justify-center gap-1 transition-all ${
                            selectedActionTab === 'transfer' 
                              ? 'bg-blue-50 border-blue-350 text-blue-900 shadow-sm' 
                              : 'bg-slate-50/50 border-slate-200 text-slate-700 hover:bg-slate-100'
                          }`}
                        >
                          <RefreshCw size={15} className="text-blue-500 animate-spin-slow" />
                          <span className="font-extrabold">সদস্য স্থানান্তর (Transfer)</span>
                        </button>

                        {/* 3. Loan Special Actions (Rebate/Adjustment) */}
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedActionTab(selectedActionTab === 'loan' ? null : 'loan');
                            setLoanActionType(null);
                          }}
                          className={`text-[10px] font-bold p-2.5 border rounded-xl flex flex-col items-center justify-center gap-1 transition-all ${
                            (member.plOutstanding || 0) <= 0 
                              ? 'opacity-40 cursor-not-allowed bg-slate-50/20' 
                              : selectedActionTab === 'loan' 
                              ? 'bg-rose-50 border-rose-350 text-rose-900 shadow-sm' 
                              : 'bg-slate-50/50 border-slate-200 text-slate-700 hover:bg-slate-100'
                          }`}
                          disabled={(member.plOutstanding || 0) <= 0}
                        >
                          <Sliders size={15} className="text-rose-500" />
                          <span className="font-extrabold">ঋণ বিশেষ ব্যবস্থা (Rebate/Adj)</span>
                        </button>

                        {/* 4. Savings Account Closing */}
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedActionTab(selectedActionTab === 'acc_closing' ? null : 'acc_closing');
                            setSelectedAccToClose(null);
                          }}
                          className={`text-[10px] font-bold p-2.5 border rounded-xl flex flex-col items-center justify-center gap-1 transition-all ${
                            selectedActionTab === 'acc_closing' 
                              ? 'bg-emerald-50 border-emerald-350 text-emerald-900 shadow-sm' 
                              : 'bg-slate-50/50 border-slate-200 text-slate-700 hover:bg-slate-100'
                          }`}
                        >
                          <Scale size={15} className="text-emerald-500" />
                          <span className="font-extrabold">লভ্যাংশ ও হিসাব ক্লোজিং</span>
                        </button>

                        {/* 5. KYC Document Attachment Upload & Store */}
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedActionTab(selectedActionTab === 'documents' ? null : 'documents');
                          }}
                          className={`text-[10px] font-bold p-2.5 border rounded-xl flex flex-col items-center justify-center gap-1 transition-all ${
                            selectedActionTab === 'documents' 
                              ? 'bg-violet-50 border-violet-350 text-violet-900 shadow-sm' 
                              : 'bg-slate-50/50 border-slate-200 text-slate-700 hover:bg-slate-100'
                          }`}
                        >
                          <FileText size={15} className="text-violet-500" />
                          <span className="font-extrabold">প্রকৃত ফাইল ও সংযুক্তি (KYC)</span>
                        </button>
                      </div>

                      {/* --- SUB-PANEL: STATUS CHANGE --- */}
                      {selectedActionTab === 'status' && isCurrentEditingStatus && (
                        <div className="bg-amber-50/40 p-3.5 rounded-xl border border-amber-200 space-y-3 animate-in slide-in-from-top-1">
                          <div className="text-[10px] font-extrabold text-amber-850 flex justify-between">
                            <span>স্ট্যাটাস পরিবর্তন করুন:</span>
                            <span className="font-mono text-slate-500">{member.memberId}</span>
                          </div>
                          
                          <div className="flex gap-4">
                            <label className="flex items-center gap-1.5 cursor-pointer text-xs font-bold">
                              <input
                                type="radio"
                                name={`status-${member.id}`}
                                checked={tempStatus === 'active'}
                                onChange={() => setTempStatus('active')}
                                className="w-3.5 h-3.5 text-emerald-600 focus:ring-emerald-500"
                              />
                              <span className="text-emerald-700 font-extrabold bg-emerald-50 px-2 py-0.5 rounded">সচল (Active)</span>
                            </label>
                            
                            <label className="flex items-center gap-1.5 cursor-pointer text-xs font-bold">
                              <input
                                type="radio"
                                name={`status-${member.id}`}
                                checked={tempStatus === 'inactive'}
                                onChange={() => setTempStatus('inactive')}
                                className="w-3.5 h-3.5 text-rose-600 focus:ring-rose-500"
                              />
                              <span className="text-rose-700 font-extrabold bg-rose-50 px-2 py-0.5 rounded">নিষ্ক্রিয় (Inactive)</span>
                            </label>
                          </div>

                          {tempStatus === 'inactive' && (
                            <div className="space-y-1 animate-in slide-in-from-top-1">
                              <span className="text-[10px] text-slate-500 font-bold block">নিষ্ক্রিয়করনের কারণ (Closing Reason):</span>
                              <select
                                value={tempReason}
                                onChange={(e) => setTempReason(e.target.value)}
                                className="w-full text-[10px] font-bold py-1 px-2 border border-slate-300 rounded-md bg-white text-rose-800"
                              >
                                <option value="ভর্তি বাতিল">ভর্তি বাতিল (Admission Cancelled)</option>
                                <option value="ঋণ পরিশোধ পরবর্তী নিষ্ক্রিয়">ঋণ পরিশোধ পরবর্তী নিষ্ক্রিয় (Inactive after Loan Paid)</option>
                                <option value="স্বেচ্ছায় পদত্যাগ">স্বেচ্ছায় পদত্যাগ (Voluntary Resignation)</option>
                                <option value="স্থানান্তরিত">স্থানান্তরিত (Transferred)</option>
                                <option value="অন্যান্য সাময়িক অসচলতা">অন্যান্য সাময়িক অসচলতা</option>
                              </select>
                            </div>
                          )}

                          {statusError && (
                            <div className="bg-rose-50 text-rose-700 p-2 border border-rose-200 rounded-lg text-[10px] font-bold leading-tight">
                              {statusError}
                            </div>
                          )}

                          <div className="flex gap-2 pt-1">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingStatusId(null);
                                setSelectedActionTab(null);
                              }}
                              className="flex-1 py-1.5 bg-slate-200 hover:bg-slate-300 rounded text-slate-700 font-bold text-[10px]"
                            >
                              বাতিল
                            </button>
                            <button
                              type="button"
                              onClick={() => saveStatusChange(member.id)}
                              className="flex-1 py-1.5 bg-[#1e40af] text-white rounded font-bold text-[10px]"
                            >
                              হালনাগাদ (Update)
                            </button>
                          </div>
                        </div>
                      )}

                      {/* --- SUB-PANEL: MEMBER TRANSFER --- */}
                      {selectedActionTab === 'transfer' && (
                        <div className="bg-blue-50/40 p-3.5 rounded-xl border border-blue-200 space-y-2.5 animate-in slide-in-from-top-1">
                          <div className="text-[10px] font-extrabold text-blue-900">
                            সদস্য সমিতি স্থানান্তর (Samity Transfer)
                          </div>
                          <p className="text-[9px] text-slate-500 font-bold leading-relaxed">
                            সদস্যকে বর্তমান সমিতি/গ্রুপ হতে অন্য একটি সচল সমিতিতে স্থানান্তর করুন। গ্রাহকের পূর্বের হিসাব ও ট্রানজেকশন ইতিহাস সংরক্ষিত থাকবে।
                          </p>
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-500 block">গন্তব্য সমিতি/গ্রুপ নির্বাচন করুন:</label>
                            <select
                              value={transferTargetGroupId}
                              onChange={(e) => setTransferTargetGroupId(e.target.value)}
                              className="w-full text-xs font-bold py-1.5 px-2.5 border border-slate-300 rounded-lg bg-white"
                            >
                              <option value="">-- সমিতি নির্বাচন করুন --</option>
                              {branchGroups
                                .filter((g) => g.id !== member.groupId)
                                .map((g) => (
                                  <option key={g.id} value={g.id}>
                                    {g.name} ({g.code})
                                  </option>
                                ))}
                            </select>
                          </div>
                          <div className="flex gap-2 pt-1">
                            <button
                              type="button"
                              onClick={() => setSelectedActionTab(null)}
                              className="flex-1 py-1.5 bg-slate-200 rounded text-slate-700 font-bold text-[10px]"
                            >
                              বাতিল
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                if (!transferTargetGroupId) {
                                  alert("অনুগ্রহ করে একটি গন্তব্য সমিতি নির্বাচন করুন!");
                                  return;
                                }
                                if (isReadOnly) {
                                  alert('শাখা ব্যবস্থাপক (BM) হিসেবে সদস্য অন্য গ্রুপে স্থানান্তর করা যাবে না। এটি রিড-অনলি মোডে রয়েছে।');
                                  return;
                                }
                                if (onTransferMember) {
                                  onTransferMember(member.id, transferTargetGroupId);
                                }
                                setSelectedActionTab(null);
                              }}
                              disabled={!transferTargetGroupId}
                              className="flex-1 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded font-bold text-[10px] disabled:opacity-50"
                            >
                              স্থানান্তর নিশ্চিত করুন
                            </button>
                          </div>
                        </div>
                      )}

                      {/* --- SUB-PANEL: LOAN MANAGEMENT WORKFLOWS --- */}
                      {selectedActionTab === 'loan' && (
                        <div className="bg-rose-50/40 p-3.5 rounded-xl border border-rose-200 space-y-3 animate-in slide-in-from-top-1 text-[10px]">
                          <div className="text-[10px] font-black text-rose-900 flex justify-between">
                            <span>ঋণ বিশেষ সমন্বয় (Loan Management Options)</span>
                            <span>চলতি বকেয়া: ৳{(member.plOutstanding || 0).toLocaleString('bn-BD')}</span>
                          </div>

                          <div className="flex gap-1.5 border-b border-rose-100 pb-1.5 overflow-x-auto shrink-0 scrollbar-none">
                            {['rebate', 'reschedule', 'adjustment', 'auto_adjustment', 'write_off'].map((type) => (
                              <button
                                key={type}
                                type="button"
                                onClick={() => {
                                  setLoanActionType(type as any);
                                  setLoanActionAmt('');
                                  setLoanActionReason('');
                                  setRescheduleInstallment('');
                                  setSelectedSavingsAccId('');
                                }}
                                className={`text-[9px] font-black px-2 py-1 rounded transition-colors shrink-0 ${
                                  loanActionType === type 
                                    ? 'bg-rose-600 text-white shadow-sm' 
                                    : 'bg-white border border-rose-200 text-rose-800 hover:bg-rose-50'
                                }`}
                              >
                                {type === 'rebate' && 'রিবেট (Rebate)'}
                                {type === 'reschedule' && 'রি-শিডিউল'}
                                {type === 'adjustment' && 'একক সঞ্চয় সমন্বয়'}
                                {type === 'auto_adjustment' && 'পর্যায়ক্রমিক অটো সমন্বয়'}
                                {type === 'write_off' && 'অবলোপন (Write-off)'}
                              </button>
                            ))}
                          </div>

                          {loanActionType === 'rebate' && (
                            <div className="space-y-2 text-[10px]">
                              <div className="space-y-1">
                                <span className="font-extrabold text-slate-600">ছাড়কৃত সুদের পরিমাণ (Rebate Amount):</span>
                                <input
                                  type="number"
                                  value={loanActionAmt}
                                  onChange={(e) => setLoanActionAmt(e.target.value)}
                                  placeholder="যেমন: ৫০০"
                                  className="w-full text-xs font-bold py-1 px-2 border border-slate-300 rounded-md bg-white font-mono"
                                />
                              </div>
                              <div className="space-y-1">
                                <span className="font-extrabold text-slate-600">ছাড় দেওয়ার সুনির্দিষ্ট কারণ:</span>
                                <input
                                  type="text"
                                  value={loanActionReason}
                                  onChange={(e) => setLoanActionReason(e.target.value)}
                                  placeholder="যেমন: সম্পূর্ণ কিস্তি পরিশোধ ছাড়"
                                  className="w-full text-xs font-bold py-1 px-2 border border-slate-300 rounded-md bg-white"
                                />
                              </div>
                            </div>
                          )}

                          {loanActionType === 'reschedule' && (
                            <div className="space-y-2 text-[10px]">
                              <div className="space-y-1">
                                <span className="font-extrabold text-slate-600">নতুন কিস্তির পরিমাণ (New Installment):</span>
                                <input
                                  type="number"
                                  value={rescheduleInstallment}
                                  onChange={(e) => setRescheduleInstallment(e.target.value)}
                                  placeholder="যেমন: ৪০০"
                                  className="w-full text-xs font-bold py-1 px-2 border border-slate-300 rounded-md bg-white font-mono"
                                />
                              </div>
                              <div className="text-[9px] font-bold text-slate-500 bg-slate-100 p-2 rounded-lg leading-relaxed">
                                * এটি ব্যবহার করলে কালেকশন শিটে এই সদস্যের কিস্তির পরিমাণ পরিবর্তিত হবে।
                              </div>
                            </div>
                          )}

                          {loanActionType === 'adjustment' && (
                            <div className="space-y-2.5 text-[10px]">
                              <div className="space-y-1">
                                <span className="font-extrabold text-slate-600">সমন্বয়ের জন্য সচল সঞ্চয় হিসাব নির্বাচন করুন:</span>
                                <select
                                  value={selectedSavingsAccId}
                                  onChange={(e) => {
                                    setSelectedSavingsAccId(e.target.value);
                                    const selectedAcc = [
                                      ...savingsAccounts.filter(acc => acc.memberId === member.id && acc.status === 'active'),
                                      ...cbsAccounts.filter(acc => acc.memberId === member.id && acc.status === 'active'),
                                      ...ltsAccounts.filter(acc => acc.memberId === member.id && acc.status === 'active')
                                    ].find(a => a.id === e.target.value);
                                    if (selectedAcc) {
                                      const defaultAmt = Math.min(member.plOutstanding || 0, selectedAcc.balance);
                                      setLoanActionAmt(defaultAmt.toString());
                                    }
                                  }}
                                  className="w-full text-xs font-bold py-1.5 px-2 border border-slate-300 rounded-md bg-white"
                                >
                                  <option value="">-- সঞ্চয় হিসাব নির্বাচন করুন --</option>
                                  {savingsAccounts
                                    .filter(acc => acc.memberId === member.id && acc.status === 'active' && acc.balance > 0)
                                    .map(acc => (
                                      <option key={acc.id} value={acc.id}>
                                        GS (সাধারণ সঞ্চয়) - ব্যালেন্স: ৳{acc.balance.toLocaleString('bn-BD')}
                                      </option>
                                    ))}
                                  {cbsAccounts
                                    .filter(acc => acc.memberId === member.id && acc.status === 'active' && acc.balance > 0)
                                    .map(acc => (
                                      <option key={acc.id} value={acc.id}>
                                        CBS (DPS সঞ্চয়) - ব্যালেন্স: ৳{acc.balance.toLocaleString('bn-BD')}
                                      </option>
                                    ))}
                                  {ltsAccounts
                                    .filter(acc => acc.memberId === member.id && acc.status === 'active' && acc.balance > 0)
                                    .map(acc => (
                                      <option key={acc.id} value={acc.id}>
                                        LTS (দীর্ঘমেয়াদী) - ব্যালেন্স: ৳{acc.balance.toLocaleString('bn-BD')}
                                      </option>
                                    ))}
                                </select>
                              </div>
                              {selectedSavingsAccId && (
                                <div className="space-y-1 animate-in slide-in-from-top-1">
                                  <span className="font-extrabold text-slate-600">সমন্বয়কৃত পরিমাণ (Adjustment Amount):</span>
                                  <input
                                    type="number"
                                    value={loanActionAmt}
                                    onChange={(e) => setLoanActionAmt(e.target.value)}
                                    placeholder="যেমন: ১৫০০"
                                    className="w-full text-xs font-bold py-1 px-2 border border-slate-300 rounded-md bg-white font-mono"
                                  />
                                </div>
                              )}
                            </div>
                          )}

                          {loanActionType === 'auto_adjustment' && (() => {
                            const outstanding = member.plOutstanding || 0;
                            const currentGs = member.gsBalance ?? member.savingsBalance ?? 0;
                            const currentLts = member.ltsBalance ?? 0;
                            const currentCbs = member.cbsBalance ?? 0;
                            const currentShare = member.shareBalance ?? ((member.shareCount || 0) * 100);

                            const memberLtsAcc = ltsAccounts.find(acc => acc.memberId === member.id && acc.status === 'active');
                            const memberCbsAcc = cbsAccounts.find(acc => acc.memberId === member.id && acc.status === 'active');

                            const preview = processLoanAdjustment(member.id, outstanding, {
                              currentGsBalance: currentGs,
                              currentLtsPrincipal: currentLts,
                              memberLts: memberLtsAcc,
                              currentCbsPrincipal: currentCbs,
                              memberCbs: memberCbsAcc,
                              currentShareBalance: currentShare
                            });

                            return (
                              <div className="space-y-2 text-[10px]">
                                <div className="text-[9px] text-slate-800 bg-amber-50/80 p-2.5 rounded-lg border border-amber-200 font-bold space-y-1.5">
                                  <div className="text-amber-900 font-extrabold border-b border-amber-200 pb-1">
                                    পর্যায়ক্রমিক সমন্বয়ের বিবরণ (GS ➔ LTS ➔ CBS ➔ Share):
                                  </div>
                                  <div className="flex justify-between">
                                    <span>১. সাধারণ সঞ্চয় (GS) কর্তন (১০ টাকা সংরক্ষিত):</span>
                                    <span className="font-mono text-emerald-700 font-extrabold">৳{preview.gsAdjusted.toLocaleString('bn-BD')}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span>২. LTS মুনাফাসহ সমন্বয়:</span>
                                    <span className="font-mono text-emerald-700 font-extrabold">৳{preview.ltsAdjusted.toLocaleString('bn-BD')}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span>৩. CBS সমন্বয়:</span>
                                    <span className="font-mono text-emerald-700 font-extrabold">৳{preview.cbsAdjusted.toLocaleString('bn-BD')}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span>৪. শেয়ার মূলধন সমন্বয়:</span>
                                    <span className="font-mono text-emerald-700 font-extrabold">৳{preview.shareAdjusted.toLocaleString('bn-BD')}</span>
                                  </div>
                                  <div className="pt-1.5 border-t border-amber-200 flex justify-between font-black text-slate-900 text-[10px]">
                                    <span>অবশিষ্ট ঋণ (Remaining Loan):</span>
                                    <span className="font-mono text-rose-700 font-black">
                                      ৳{preview.remainingLoan.toLocaleString('bn-BD')} {preview.remainingLoan === 0 ? '(সম্পূর্ণ পরিশোধিত)' : ''}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            );
                          })()}

                          {loanActionType === 'write_off' && (
                            <div className="space-y-2 text-[10px]">
                              <div className="text-[9px] text-rose-800 bg-rose-50 p-2.5 rounded-lg font-bold leading-relaxed border border-rose-150">
                                ঋণ অবলোপন (Write-off) এর মাধ্যমে এই সদস্যের সম্পূর্ণ বকেয়া ৳{(member.plOutstanding || 0).toLocaleString('bn-BD')} টাকা সাধারণ ফান্ড হতে মওকুফ করে দেওয়া হবে এবং লোনটি চিরতরে অবলোপন করা হবে।
                              </div>
                              <div className="space-y-1">
                                <span className="font-extrabold text-slate-600">অবলোপন করার সুনির্দিষ্ট কারণ:</span>
                                <input
                                  type="text"
                                  value={loanActionReason}
                                  onChange={(e) => setLoanActionReason(e.target.value)}
                                  placeholder="যেমন: গ্রাহক দীর্ঘদিন নিখোঁজ/স্থায়ী অসচ্ছল"
                                  className="w-full text-xs font-bold py-1 px-2 border border-slate-300 rounded-md bg-white"
                                />
                              </div>
                            </div>
                          )}

                          {loanActionType && (
                            <div className="flex gap-2 pt-1.5 border-t border-rose-100">
                              <button
                                type="button"
                                onClick={() => setLoanActionType(null)}
                                className="flex-1 py-1.5 bg-slate-200 rounded text-slate-700 font-bold text-[10px]"
                              >
                                বাতিল
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  if (loanActionType === 'rebate') {
                                    const amt = parseFloat(loanActionAmt);
                                    if (isNaN(amt) || amt <= 0 || amt > (member.plOutstanding || 0)) {
                                      alert("বৈধ রিবেট পরিমাণ ইনপুট দিন!");
                                      return;
                                    }
                                    if (onLoanAction) onLoanAction(member.id, 'rebate', { amount: amt, reason: loanActionReason || 'সুদ মওকুফ' });
                                  } 
                                  else if (loanActionType === 'reschedule') {
                                    const amt = parseFloat(rescheduleInstallment);
                                    if (isNaN(amt) || amt <= 0) {
                                      alert("বৈধ কিস্তি পরিমাণ ইনপুট দিন!");
                                      return;
                                    }
                                    if (onLoanAction) onLoanAction(member.id, 'reschedule', { newInstallmentAmount: amt, newOutstandingAmount: member.plOutstanding });
                                  }
                                  else if (loanActionType === 'adjustment') {
                                    const amt = parseFloat(loanActionAmt);
                                    if (isNaN(amt) || amt <= 0 || amt > (member.plOutstanding || 0)) {
                                      alert("বৈধ সমন্বয় পরিমাণ ইনপুট দিন!");
                                      return;
                                    }
                                    let accType: 'GS' | 'CBS' | 'LTS' = 'GS';
                                    const isCbs = cbsAccounts.some(acc => acc.id === selectedSavingsAccId);
                                    const isLts = ltsAccounts.some(acc => acc.id === selectedSavingsAccId);
                                    if (isCbs) accType = 'CBS';
                                    else if (isLts) accType = 'LTS';

                                    const chosenAcc = [
                                      ...savingsAccounts,
                                      ...cbsAccounts,
                                      ...ltsAccounts
                                    ].find(a => a.id === selectedSavingsAccId);

                                    if (!chosenAcc || chosenAcc.balance < amt) {
                                      alert("সঞ্চয় অ্যাকাউন্টে পর্যাপ্ত ব্যালেন্স নেই!");
                                      return;
                                    }

                                    if (onLoanAction) onLoanAction(member.id, 'adjustment', { 
                                      amount: amt, 
                                      savingsType: accType, 
                                      savingsAccountId: selectedSavingsAccId 
                                    });
                                  }
                                  else if (loanActionType === 'auto_adjustment') {
                                    if (onLoanAction) onLoanAction(member.id, 'auto_adjustment' as any, { isAutoSequential: true });
                                  }
                                  else if (loanActionType === 'write_off') {
                                    if (!loanActionReason.trim()) {
                                      alert("অনুগ্রহ করে অবলোপনের কারণ লিখুন!");
                                      return;
                                    }
                                    if (onLoanAction) onLoanAction(member.id, 'write_off', { reason: loanActionReason });
                                  }

                                  setSelectedActionTab(null);
                                  setLoanActionType(null);
                                }}
                                className="flex-1 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded font-bold text-[10px]"
                              >
                                সমন্বয় সম্পন্ন করুন
                              </button>
                            </div>
                          )}
                        </div>
                      )}

                      {/* --- SUB-PANEL: ACCOUNT MATURITY & CLOSING --- */}
                      {selectedActionTab === 'acc_closing' && (
                        <div className="bg-emerald-50/40 p-3.5 rounded-xl border border-emerald-200 space-y-3 animate-in slide-in-from-top-1 text-[10px]">
                          <div className="text-[10px] font-black text-emerald-900 flex justify-between">
                            <span>মেয়াদপূর্তি ও হিসাব ক্লোজিং (Account Closing)</span>
                          </div>

                          {!selectedAccToClose ? (
                            <div className="space-y-2">
                              <span className="text-[10px] font-bold text-slate-500 block">ক্লোজিংযোগ্য সচল সঞ্চয় হিসাব নির্বাচন করুন:</span>
                              <div className="space-y-1.5">
                                {[
                                  ...savingsAccounts.filter(acc => acc.memberId === member.id && acc.status === 'active'),
                                  ...cbsAccounts.filter(acc => acc.memberId === member.id && acc.status === 'active'),
                                  ...ltsAccounts.filter(acc => acc.memberId === member.id && acc.status === 'active')
                                ].length === 0 ? (
                                  <div className="text-center text-slate-400 py-3 text-[10px] font-bold">
                                    কোন সচল সঞ্চয় বা ডিপিএস হিসাব পাওয়া যায়নি।
                                  </div>
                                ) : (
                                  [
                                    ...savingsAccounts.filter(acc => acc.memberId === member.id && acc.status === 'active').map(acc => ({ ...acc, typeLabel: acc.type === 'FDR' ? 'FDR (স্থায়ী আমানত)' : 'GS (সাধারণ সঞ্চয়)' })),
                                    ...cbsAccounts.filter(acc => acc.memberId === member.id && acc.status === 'active').map(acc => ({ ...acc, typeLabel: 'CBS (ডিপিএস সঞ্চয়)' })),
                                    ...ltsAccounts.filter(acc => acc.memberId === member.id && acc.status === 'active').map(acc => ({ ...acc, typeLabel: 'LTS (দীর্ঘমেয়াদী)' }))
                                  ].map(acc => (
                                    <button
                                      key={acc.id}
                                      type="button"
                                      onClick={() => {
                                        setSelectedAccToClose(acc);
                                        setIsMature(true);
                                        setMonthsElapsed(acc.termMonths || 12);
                                        
                                        const type = acc.type || (acc.typeLabel && acc.typeLabel.includes('CBS') ? 'CBS' : acc.typeLabel && acc.typeLabel.includes('LTS') ? 'LTS' : 'GS');
                                        const res = calculateSavingsPayout(type, acc.balance, true, acc.termMonths || 12, acc.interestRate);
                                        setCalcResult(res);
                                      }}
                                      className="w-full text-left p-2.5 bg-white border border-slate-200 rounded-xl hover:border-emerald-300 hover:bg-emerald-50/25 transition text-[10px] flex justify-between items-center"
                                    >
                                      <div>
                                        <span className="font-extrabold text-slate-700 block">{acc.typeLabel}</span>
                                        <span className="font-mono text-slate-400 text-[9px]">{acc.accountNo} {acc.termMonths && `| মেয়াদ: ${acc.termMonths} মাস`}</span>
                                      </div>
                                      <span className="font-black text-emerald-800 text-[11px]">৳{acc.balance.toLocaleString('bn-BD')}</span>
                                    </button>
                                  ))
                                )}
                              </div>
                            </div>
                          ) : (
                            <div className="space-y-3 animate-in fade-in duration-150">
                              <div className="bg-white p-2.5 rounded-xl border border-slate-150 space-y-1 font-bold text-slate-700">
                                <div className="flex justify-between">
                                  <span>হিসাব ধরণ:</span>
                                  <span className="text-slate-900">{selectedAccToClose.typeLabel}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span>হিসাব নাম্বার:</span>
                                  <span className="text-slate-900 font-mono">{selectedAccToClose.accountNo}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span>মূল জমা ব্যালেন্স:</span>
                                  <span className="text-slate-900 font-mono">৳{selectedAccToClose.balance.toLocaleString('bn-BD')}</span>
                                </div>
                              </div>

                              {(selectedAccToClose.type === 'FDR' || selectedAccToClose.typeLabel.includes('CBS') || selectedAccToClose.typeLabel.includes('LTS')) && (
                                <div className="space-y-2 bg-white p-2.5 rounded-xl border border-slate-150">
                                  <div className="flex items-center gap-4">
                                    <label className="flex items-center gap-1 cursor-pointer font-bold">
                                      <input
                                        type="radio"
                                        name="isMature"
                                        checked={isMature}
                                        value="mature"
                                        onChange={() => {
                                          setIsMature(true);
                                          const type = selectedAccToClose.type || (selectedAccToClose.typeLabel && selectedAccToClose.typeLabel.includes('CBS') ? 'CBS' : selectedAccToClose.typeLabel && selectedAccToClose.typeLabel.includes('LTS') ? 'LTS' : 'GS');
                                          const res = calculateSavingsPayout(type, selectedAccToClose.balance, true, selectedAccToClose.termMonths || 12, selectedAccToClose.interestRate);
                                          setCalcResult(res);
                                        }}
                                        className="w-3.5 h-3.5 text-emerald-600 focus:ring-emerald-500"
                                      />
                                      <span>মেয়াদপূর্তি (Mature)</span>
                                    </label>
                                    <label className="flex items-center gap-1 cursor-pointer font-bold">
                                      <input
                                        type="radio"
                                        name="isMature"
                                        checked={!isMature}
                                        value="premature"
                                        onChange={() => {
                                          setIsMature(false);
                                          const elapsed = Math.floor((selectedAccToClose.termMonths || 12) / 2) || 6;
                                          setMonthsElapsed(elapsed);
                                          const type = selectedAccToClose.type || (selectedAccToClose.typeLabel && selectedAccToClose.typeLabel.includes('CBS') ? 'CBS' : selectedAccToClose.typeLabel && selectedAccToClose.typeLabel.includes('LTS') ? 'LTS' : 'GS');
                                          const res = calculateSavingsPayout(type, selectedAccToClose.balance, false, elapsed, selectedAccToClose.interestRate);
                                          setCalcResult(res);
                                        }}
                                        className="w-3.5 h-3.5 text-rose-600 focus:ring-rose-500"
                                      />
                                      <span>মেয়াদপূর্ব প্রত্যাহার (Premature)</span>
                                    </label>
                                  </div>

                                  {!isMature && (
                                    <div className="space-y-1 animate-in slide-in-from-top-1">
                                      <span className="font-extrabold text-slate-600">অতিক্রান্ত মাস সংখ্যা (Months Elapsed):</span>
                                      <input
                                        type="number"
                                        value={monthsElapsed}
                                        onChange={(e) => {
                                          const elapsed = parseInt(e.target.value) || 0;
                                          setMonthsElapsed(elapsed);
                                          const type = selectedAccToClose.type || (selectedAccToClose.typeLabel && selectedAccToClose.typeLabel.includes('CBS') ? 'CBS' : selectedAccToClose.typeLabel && selectedAccToClose.typeLabel.includes('LTS') ? 'LTS' : 'GS');
                                          const res = calculateSavingsPayout(type, selectedAccToClose.balance, false, elapsed, selectedAccToClose.interestRate);
                                          setCalcResult(res);
                                        }}
                                        className="w-full text-xs font-bold py-1 px-2 border border-slate-300 rounded-md bg-white font-mono"
                                      />
                                    </div>
                                  )}
                                </div>
                              )}

                              {calcResult && (
                                <div className="bg-emerald-100/50 p-2.5 rounded-xl border border-emerald-200 space-y-1 font-bold text-emerald-900">
                                  <div className="flex justify-between">
                                    <span>লভ্যাংশ (Interest Earned):</span>
                                    <span className="font-mono">৳{Math.round(calcResult.interestEarned).toLocaleString('bn-BD')}</span>
                                  </div>
                                  {calcResult.penalty > 0 && (
                                    <div className="flex justify-between text-rose-800">
                                      <span>পেনাল্টি (Premature Penalty):</span>
                                      <span className="font-mono">-৳{Math.round(calcResult.penalty).toLocaleString('bn-BD')}</span>
                                    </div>
                                  )}
                                  <div className="flex justify-between text-xs font-black border-t border-emerald-200/80 pt-1.5 mt-1 text-emerald-950">
                                    <span>মোট ফেরতযোগ্য (Payout Amount):</span>
                                    <span className="font-mono">৳{Math.round(calcResult.finalAmount).toLocaleString('bn-BD')}</span>
                                  </div>
                                </div>
                              )}

                              <div className="flex gap-2">
                                <button
                                  type="button"
                                  onClick={() => setSelectedAccToClose(null)}
                                  className="flex-1 py-1.5 bg-slate-200 rounded font-bold text-[10px] text-slate-700 transition"
                                >
                                  পিছনে
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const finalAmt = Math.round(calcResult ? calcResult.finalAmount : selectedAccToClose.balance);
                                    const interestEarned = Math.round(calcResult ? calcResult.interestEarned : 0);
                                    const penalty = Math.round(calcResult ? calcResult.penalty : 0);
                                    const closeReason = isMature ? 'মেয়াদপূর্তি ক্লোজিং' : 'মেয়াদপূর্ব উত্তোলন';

                                    let category: 'GS' | 'CBS' | 'LTS' = 'GS';
                                    if (selectedAccToClose.typeLabel.includes('CBS')) category = 'CBS';
                                    else if (selectedAccToClose.typeLabel.includes('LTS')) category = 'LTS';

                                    if (onCloseAccount) {
                                      onCloseAccount(
                                        member.id,
                                        selectedAccToClose.id,
                                        category,
                                        finalAmt,
                                        interestEarned,
                                        penalty,
                                        closeReason
                                      );
                                    }

                                    setSelectedAccToClose(null);
                                    setSelectedActionTab(null);
                                  }}
                                  className="flex-1 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded font-bold text-[10px]"
                                >
                                  ক্লোজিং সম্পন্ন করুন
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* --- SUB-PANEL: DOCUMENTS & KYC ATTACHMENTS --- */}
                      {selectedActionTab === 'documents' && org && staff && (
                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 mt-2">
                          <DocumentCenter
                            org={org}
                            staff={staff}
                            workingDay={workingDay || '2026-06-30'}
                            memberId={member.memberId || member.id}
                            memberName={member.name}
                            onClose={() => setSelectedActionTab(null)}
                          />
                        </div>
                      )}

                      {member.status === 'inactive' && member.inactiveReason && (
                        <div className="bg-rose-50/50 text-rose-800 p-2 border border-rose-100 rounded-lg mt-2 text-[10px] font-extrabold flex items-center gap-1 shrink-0">
                          <XCircle className="w-3.5 h-3.5 text-rose-500" />
                          <span>নিষ্ক্রিয় কারণ: {member.inactiveReason}</span>
                        </div>
                      )}
                    </div>

                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {selectedStatement && (
        <div className="absolute inset-0 bg-[#f4f6f9] z-50 flex flex-col animate-in slide-in-from-right duration-200">
          {/* Statement Header */}
          <div className="bg-[#1e40af] text-white px-5 py-4 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setSelectedStatement(null)}
              className="p-1 -ml-1 rounded-full hover:bg-white/10 active:scale-90 transition-all cursor-pointer flex items-center justify-center"
            >
              <ArrowLeft className="w-5 h-5 text-white" />
            </button>
            <div className="text-center">
              <h2 className="font-black text-xs sm:text-sm tracking-wide flex items-center gap-1.5 justify-center">
                হিসাব বিবরণী (Statement)
              </h2>
              <p className="text-[10px] text-blue-100 font-bold mt-0.5">{selectedStatement.accountName}</p>
            </div>
            <div className="w-7"></div>
          </div>

          {/* Member & Account Identity Summary Bar */}
          <div className="bg-white border-b border-slate-200 p-4 space-y-1.5 font-sans">
            <div className="flex justify-between text-[11px] font-bold text-slate-700">
              <span>গ্রাহকের নাম:</span>
              <span className="text-slate-900 font-extrabold">{selectedStatement.member.name}</span>
            </div>
            <div className="flex justify-between text-[11px] font-bold text-slate-700">
              <span>সদস্য আইডি:</span>
              <span className="text-slate-900 font-mono font-extrabold">{selectedStatement.member.memberId}</span>
            </div>
            {selectedStatement.accountNo && (
              <div className="flex justify-between text-[11px] font-bold text-slate-700">
                <span>হিসাব নাম্বার:</span>
                <span className="text-slate-900 font-mono font-extrabold">{selectedStatement.accountNo}</span>
              </div>
            )}
            <div className="bg-blue-50/70 rounded-xl p-3 border border-blue-100 flex justify-between items-center mt-2 shrink-0">
              <span className="text-[11px] font-bold text-blue-800">মোট বর্তমান স্থিতি:</span>
              <span className="text-xs sm:text-sm font-black text-blue-900 font-mono">৳{selectedStatement.balance.toLocaleString('bn-BD')}</span>
            </div>
          </div>

          {/* Statement Table / List */}
          <div className="flex-1 overflow-y-auto p-0 font-sans">
            {(() => {
              const txs = getAccountStatement(selectedStatement.member, selectedStatement.accountType);
              return <MemberPassbook txs={txs} />;
            })()}
          </div>
          
          {/* Close button in footer */}
          <div className="p-3 bg-white border-t border-slate-200">
            <button
              type="button"
              onClick={() => setSelectedStatement(null)}
              className="w-full py-2 bg-slate-800 hover:bg-slate-900 active:scale-95 text-white font-extrabold text-[11px] rounded-xl transition duration-150 cursor-pointer text-center uppercase tracking-wide"
            >
              বন্ধ করুন (Close)
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
