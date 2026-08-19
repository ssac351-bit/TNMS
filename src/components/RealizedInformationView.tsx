/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect } from 'react';
import { 
  ArrowLeft, 
  Users, 
  User,
  Calendar,
  Layers,
  FileText,
  Check,
  Search,
  MoreVertical,
  Plus,
  Building,
  Clock,
  ArrowLeftRight,
  Sparkles,
  PiggyBank,
  CheckCircle,
  XCircle,
  Coins,
  ChevronDown
} from 'lucide-react';
import { Group, Member } from '../types';
import { formatDDMMYYYY } from '../lib/dateUtils';

interface SavingsRefundRequest {
  id: string;
  memberId: string;
  memberName: string;
  memberCode: string;
  groupId: string;
  groupName: string;
  openingDate: string;
  meetingDay: string;
  productName: string;
  duration: string;
  minimumDeposit: number;
  installmentType: string;
  status: string;
  reason: string;
  returnDate: string;
  paymentMethod: string;
  returnAmount: number;
  adjustDate: string;
  adjustedAmount: number;
  notes: string;
  createdAt: string;
  profit?: number;
  approvalStatus?: 'pending' | 'approved' | 'rejected';
  orgId?: string;
}

interface RealizedInformationViewProps {
  onBack: () => void;
  branchGroups: Group[];
  groupMembers: Member[];
  workingDay: string;
  transactions: any[];
  staff: { name: string; staffId?: string; designation?: string };
  branchName?: string;
  onUpdateMembers: (updated: Member[]) => void;
  onUpdateSavingsAccounts: (updated: any[]) => void;
  onUpdateTransactions: (updated: any[]) => void;
  savingsAccounts?: any[];
  cbsAccounts?: any[];
  onUpdateCbsAccounts?: (updated: any[]) => void;
  ltsAccounts?: any[];
  onUpdateLtsAccounts?: (updated: any[]) => void;
  defaultGroupId?: string;
  mode?: 'refund' | 'adjustment';
}

export const RealizedInformationView: React.FC<RealizedInformationViewProps> = ({
  onBack,
  branchGroups,
  groupMembers,
  workingDay,
  transactions = [],
  staff,
  branchName = '',
  onUpdateMembers,
  onUpdateSavingsAccounts,
  onUpdateTransactions,
  savingsAccounts = [],
  cbsAccounts = [],
  onUpdateCbsAccounts,
  ltsAccounts = [],
  onUpdateLtsAccounts,
  defaultGroupId = '',
  mode
}) => {
  const isBM = staff?.designation === 'শাখা ব্যবস্থাপক';

  // Determine selected group: default to prop value or first available group
  const [selectedGroupId, setSelectedGroupId] = useState<string>(() => {
    if (defaultGroupId && branchGroups.some(g => g.id === defaultGroupId)) {
      return defaultGroupId;
    }
    return branchGroups.length > 0 ? branchGroups[0].id : '';
  });

  const [selectedMemberId, setSelectedMemberId] = useState<string>('');
  const [isMemberDropdownOpen, setIsMemberDropdownOpen] = useState<boolean>(false);
  const [isGroupDropdownOpen, setIsGroupDropdownOpen] = useState<boolean>(false);
  const [isFormOpen, setIsFormOpen] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'info' | 'history'>('info');

  // Form Fields State
  const [openingDate, setOpeningDate] = useState<string>('03-07-2019');
  const [productName, setProductName] = useState<string>('GENERAL SAVINGS');
  const [duration, setDuration] = useState<string>('0');
  const [minimumDeposit, setMinimumDeposit] = useState<number>(50);
  const [installmentType, setInstallmentType] = useState<string>('Weekly');
  const [status, setStatus] = useState<string>('Closing');
  const [reason, setReason] = useState<string>('Return');
  const [returnDate, setReturnDate] = useState<string>(workingDay || new Date().toISOString().split('T')[0]);
  const [paymentMethod, setPaymentMethod] = useState<string>('Cash');
  const [adjustDate, setAdjustDate] = useState<string>(workingDay || '29-12-2024');
  const [notes, setNotes] = useState<string>('migrated from old db');

  // Profit state
  const [profit, setProfit] = useState<number>(0);

  // Manual input values for refund amounts
  const [manualReturnAmount, setManualReturnAmount] = useState<string>('');
  const [manualAdjustedAmount, setManualAdjustedAmount] = useState<string>('');

  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState<number>(0);
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');

  const orgId = useMemo(() => {
    return groupMembers[0]?.orgId || 'default-org';
  }, [groupMembers]);

  // Load all refund requests from localStorage (for any member in organization)
  const allRefundRequests: SavingsRefundRequest[] = useMemo(() => {
    try {
      const saved = localStorage.getItem(`tanzil_savings_refunds_${orgId}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        return Array.isArray(parsed) ? parsed : [];
      }
    } catch (e) {
      console.error('Error reading all refund requests', e);
    }
    return [];
  }, [orgId, refreshKey]);

  // Filter requests based on mode
  const modeFilteredRequests = useMemo(() => {
    return allRefundRequests.filter(r => {
      if (mode === 'refund') {
        return (r.returnAmount > 0 || r.status !== 'AdjustmentOnly') && (r.adjustedAmount === 0 || !r.adjustedAmount);
      }
      if (mode === 'adjustment') {
        return r.adjustedAmount > 0 || r.status === 'AdjustmentOnly';
      }
      return true;
    });
  }, [allRefundRequests, mode]);

  // Synchronize adjustDate and returnDate to workingDay on change
  useEffect(() => {
    if (workingDay) {
      setReturnDate(workingDay);
      setAdjustDate(workingDay);
    }
  }, [workingDay]);

  // Synchronize status and reason to mode
  useEffect(() => {
    if (mode === 'adjustment') {
      setStatus('AdjustmentOnly');
      setReason('Loan Adjustment');
    } else if (mode === 'refund') {
      setStatus('Closing');
      setReason('Return');
    }
  }, [mode]);

  // Get active group name & members
  const selectedGroup = useMemo(() => {
    return branchGroups.find(g => g.id === selectedGroupId) || null;
  }, [branchGroups, selectedGroupId]);

  const activeMembersInGroup = useMemo(() => {
    if (!selectedGroupId) return [];
    return groupMembers.filter(m => m.groupId === selectedGroupId && m.status !== 'inactive');
  }, [groupMembers, selectedGroupId]);

  // Find currently selected member details
  const selectedMember = useMemo(() => {
    return activeMembersInGroup.find(m => m.id === selectedMemberId) || null;
  }, [activeMembersInGroup, selectedMemberId]);

  // Get selected member index for labeling e.g. Shantona Rani/Bishajit(2)
  const selectedMemberIndex = useMemo(() => {
    if (!selectedMemberId) return -1;
    return activeMembersInGroup.findIndex(m => m.id === selectedMemberId) + 1;
  }, [activeMembersInGroup, selectedMemberId]);

  // Load all refund requests from localStorage
  const refundRequests: SavingsRefundRequest[] = useMemo(() => {
    if (!selectedMember) return [];
    try {
      const saved = localStorage.getItem(`tanzil_savings_refunds_${selectedMember.orgId}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        return Array.isArray(parsed) ? parsed.filter((r: any) => r.memberId === selectedMember.id) : [];
      }
    } catch (e) {
      console.error('Error reading refund requests', e);
    }
    return [];
  }, [selectedMember, refreshKey]);

  // Filter member-specific requests based on mode
  const modeFilteredMemberRequests = useMemo(() => {
    return refundRequests.filter(r => {
      if (mode === 'refund') {
        return (r.returnAmount > 0 || r.status !== 'AdjustmentOnly') && (r.adjustedAmount === 0 || !r.adjustedAmount);
      }
      if (mode === 'adjustment') {
        return r.adjustedAmount > 0 || r.status === 'AdjustmentOnly';
      }
      return true;
    });
  }, [refundRequests, mode]);

  // Calculate default values based on member balances
  const savingsBalance = useMemo(() => {
    if (!selectedMember) return 0;
    const prod = productName?.toLowerCase();
    if (prod?.includes('lts')) {
      return selectedMember.ltsBalance ?? 0;
    }
    if (prod?.includes('cbs')) {
      return selectedMember.cbsBalance ?? 0;
    }
    return selectedMember.gsBalance ?? selectedMember.savingsBalance ?? 0;
  }, [selectedMember, productName]);
  const loanOutstanding = selectedMember ? (selectedMember.plOutstanding ?? 0) : 0;

  // Total Return = Savings Balance + Profit
  const totalReturn = useMemo(() => {
    return savingsBalance + profit;
  }, [savingsBalance, profit]);

  // Derived amount states: default adjusted amount to 0 (unless typed in by user)
  const calculatedAdjustedAmount = useMemo(() => {
    if (mode === 'refund') {
      return 0;
    }
    if (manualAdjustedAmount !== '') {
      return Number(manualAdjustedAmount) || 0;
    }
    return 0; // Default is 0. If worker wants to adjust loan from savings, they enter the amount.
  }, [manualAdjustedAmount, mode]);

  const calculatedReturnAmount = useMemo(() => {
    if (mode === 'adjustment') {
      return 0;
    }
    if (manualReturnAmount !== '') {
      return Number(manualReturnAmount) || 0;
    }
    if (status === 'AdjustmentOnly') {
      return 0;
    }
    // Return Amount = Total Return (Savings Balance + Profit) - Adjusted Amount
    const diff = totalReturn - calculatedAdjustedAmount;
    return diff > 0 ? diff : 0;
  }, [totalReturn, calculatedAdjustedAmount, manualReturnAmount, status, mode]);

  // Handle dropdown selection or changes
  const handleSelectMember = (memberId: string) => {
    setSelectedMemberId(memberId);
    setIsMemberDropdownOpen(false);
    setIsFormOpen(false);
    setManualReturnAmount('');
    setManualAdjustedAmount('');
    setProfit(0);
  };

  // Format date nicely
  const formatDateHeading = (dateStr: string): string => {
    if (!dateStr) return '';
    try {
      const parts = dateStr.split('-');
      if (parts.length !== 3) return dateStr;
      const dateObj = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
      const dd = String(dateObj.getDate()).padStart(2, '0');
      const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
      const yyyy = dateObj.getFullYear();
      const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      return `${dd}/${mm}/${yyyy} ${days[dateObj.getDay()]}`;
    } catch {
      return dateStr;
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMember) return;

    const returnAmt = calculatedReturnAmount;
    const adjustedAmt = calculatedAdjustedAmount;

    if (status === 'AdjustmentOnly' && adjustedAmt <= 0) {
      alert('সমন্বয় করার জন্য দয়া করে একটি সঠিক সমন্বয় পরিমাণ (Adjusted Amount) লিখুন!');
      return;
    }

    if (adjustedAmt > loanOutstanding) {
      alert('সমন্বয়কৃত পরিমাণ ঋণ বকেয়ার চেয়ে বেশি হতে পারে না!');
      return;
    }

    // Check balance validity
    if (adjustedAmt > (savingsBalance + profit)) {
      alert('সমন্বয়কৃত পরিমাণ মোট সঞ্চয় ও লাভ এর চেয়ে বেশি হতে পারে না!');
      return;
    }

    // Save to localStorage refund requests as pending for BM approval
    const newRequest: SavingsRefundRequest = {
      id: `ref-${Date.now()}`,
      memberId: selectedMember.id,
      memberName: selectedMember.name,
      memberCode: selectedMember.memberId || '',
      groupId: selectedGroupId,
      groupName: selectedGroup?.name || '',
      openingDate,
      meetingDay: selectedGroup?.meetingDay || 'Wed',
      productName,
      duration,
      minimumDeposit,
      installmentType,
      status,
      reason,
      returnDate,
      paymentMethod,
      returnAmount: returnAmt,
      adjustDate,
      adjustedAmount: adjustedAmt,
      notes,
      createdAt: new Date().toISOString(),
      profit: profit,
      approvalStatus: 'pending',
      orgId: selectedMember.orgId
    };

    try {
      const savedRefunds = JSON.parse(localStorage.getItem(`tanzil_savings_refunds_${selectedMember.orgId}`) || '[]');
      localStorage.setItem(`tanzil_savings_refunds_${selectedMember.orgId}`, JSON.stringify([newRequest, ...savedRefunds]));
    } catch (e) {
      console.error(e);
    }

    setRefreshKey(prev => prev + 1);

    // Show success dialog indicating that it is pending BM approval
    setSuccessMessage('সঞ্চয় ফেরত ও ঋণ সমন্বয় আবেদনটি সফলভাবে জমা দেওয়া হয়েছে! বিএম পেজে অনুমোদনের জন্য অপেক্ষমান থাকবে।');
    setIsFormOpen(false);
  };

  const handleApproveRequest = (req: SavingsRefundRequest) => {
    // 1. Find target member
    const targetMember = groupMembers.find(m => m.id === req.memberId);
    if (!targetMember) {
      alert('দুঃখিত, আবেদনকারী সদস্যটিকে খুঁজে পাওয়া যায়নি!');
      return;
    }

    const returnAmt = req.returnAmount;
    const adjustedAmt = req.adjustedAmount;
    const profitAmt = req.profit || 0;

    const isLts = req.productName?.toLowerCase()?.includes('lts');
    const isCbs = req.productName?.toLowerCase()?.includes('cbs');

    // 2. Prepare updated member's balances
    const updatedMembers = groupMembers.map((m) => {
      if (m.id === req.memberId) {
        const balanceDeduction = Math.max(0, returnAmt + adjustedAmt - profitAmt);
        const newPlOutstanding = Math.max(0, (m.plOutstanding ?? 0) - adjustedAmt);

        if (isLts) {
          const currentBal = m.ltsBalance ?? 0;
          return {
            ...m,
            ltsBalance: Math.max(0, currentBal - balanceDeduction),
            plOutstanding: newPlOutstanding
          };
        } else if (isCbs) {
          const currentBal = m.cbsBalance ?? 0;
          return {
            ...m,
            cbsBalance: Math.max(0, currentBal - balanceDeduction),
            plOutstanding: newPlOutstanding
          };
        } else {
          const currentBal = m.gsBalance ?? m.savingsBalance ?? 0;
          const newSavingsBalance = Math.max(0, (m.savingsBalance ?? 0) - balanceDeduction);
          return {
            ...m,
            gsBalance: Math.max(0, currentBal - balanceDeduction),
            savingsBalance: newSavingsBalance,
            plOutstanding: newPlOutstanding
          };
        }
      }
      return m;
    });

    // 3. Prepare updated account lists
    let updatedGeneralAccounts = [...savingsAccounts];
    if (isLts) {
      const updatedLts = ltsAccounts.map((acc) => {
        if (acc.memberId === req.memberId && acc.type === 'LTS') {
          const currentBal = acc.balance ?? 0;
          const balanceDeduction = Math.max(0, returnAmt + adjustedAmt - profitAmt);
          return {
            ...acc,
            balance: Math.max(0, currentBal - balanceDeduction),
            status: req.status === 'Closing' ? 'closed' : 'active'
          };
        }
        return acc;
      });
      if (onUpdateLtsAccounts) {
        onUpdateLtsAccounts(updatedLts);
        localStorage.setItem(`tanzil_lts_accounts_${orgId}`, JSON.stringify(updatedLts));
      }
    } else if (isCbs) {
      const updatedCbs = cbsAccounts.map((acc) => {
        if (acc.memberId === req.memberId && acc.type === 'CBS') {
          const currentBal = acc.balance ?? 0;
          const balanceDeduction = Math.max(0, returnAmt + adjustedAmt - profitAmt);
          return {
            ...acc,
            balance: Math.max(0, currentBal - balanceDeduction),
            status: req.status === 'Closing' ? 'closed' : 'active'
          };
        }
        return acc;
      });
      if (onUpdateCbsAccounts) {
        onUpdateCbsAccounts(updatedCbs);
        localStorage.setItem(`tanzil_cbs_accounts_${orgId}`, JSON.stringify(updatedCbs));
      }
    } else {
      updatedGeneralAccounts = savingsAccounts.map((acc) => {
        if (acc.memberId === req.memberId && acc.type === 'GS') {
          const currentBal = acc.balance ?? 0;
          const balanceDeduction = Math.max(0, returnAmt + adjustedAmt - profitAmt);
          return {
            ...acc,
            balance: Math.max(0, currentBal - balanceDeduction),
            status: req.status === 'Closing' ? 'closed' : 'active'
          };
        }
        return acc;
      });
    }

    // 4. Prepare transactions
    const newTransactions = [...transactions];
    if (returnAmt > 0) {
      newTransactions.push({
        id: `tx-ret-${Date.now()}-1`,
        orgId: req.orgId || orgId,
        memberId: req.memberId,
        memberName: req.memberName,
        type: 'savings_withdrawal',
        amount: returnAmt,
        date: req.returnDate,
        groupId: req.groupId,
        groupName: req.groupName,
        category: req.productName?.toLowerCase()?.includes('lts') ? 'lts_savings' : req.productName?.toLowerCase()?.includes('cbs') ? 'cbs_savings' : 'general_savings',
        debitAcc: req.productName?.toLowerCase()?.includes('lts') ? 'lts_savings' : req.productName?.toLowerCase()?.includes('cbs') ? 'cbs_savings' : 'general_savings',
        creditAcc: 'cash',
        isRefund: req.status === 'Closing',
        description: req.status === 'Closing' ? 'সঞ্চয় ফেরত' : 'সঞ্চয় উত্তোলন'
      });
    }
    if (adjustedAmt > 0) {
      newTransactions.push({
        id: `tx-ret-${Date.now()}-2`,
        orgId: req.orgId || orgId,
        memberId: req.memberId,
        memberName: req.memberName,
        type: 'loan_repayment',
        amount: adjustedAmt,
        date: req.adjustDate,
        groupId: req.groupId,
        groupName: req.groupName
      });
    }

    // 5. Save updated request status to localStorage
    try {
      const savedRefunds = JSON.parse(localStorage.getItem(`tanzil_savings_refunds_${orgId}`) || '[]');
      const updatedRefunds = savedRefunds.map((r: any) => {
        if (r.id === req.id) {
          return { ...r, approvalStatus: 'approved' };
        }
        return r;
      });
      localStorage.setItem(`tanzil_savings_refunds_${orgId}`, JSON.stringify(updatedRefunds));
    } catch (e) {
      console.error(e);
    }

    // 6. Push state updates
    onUpdateMembers(updatedMembers);
    onUpdateSavingsAccounts(updatedGeneralAccounts);
    onUpdateTransactions(newTransactions);

    setRefreshKey(prev => prev + 1);
    alert('সঞ্চয় ফেরত ও ঋণ সমন্বয় আবেদনটি সফলভাবে অনুমোদন করা হয়েছে!');
  };

  const handleRejectRequest = (req: SavingsRefundRequest) => {
    try {
      const savedRefunds = JSON.parse(localStorage.getItem(`tanzil_savings_refunds_${orgId}`) || '[]');
      const updatedRefunds = savedRefunds.map((r: any) => {
        if (r.id === req.id) {
          return { ...r, approvalStatus: 'rejected' };
        }
        return r;
      });
      localStorage.setItem(`tanzil_savings_refunds_${orgId}`, JSON.stringify(updatedRefunds));
    } catch (e) {
      console.error(e);
    }

    setRefreshKey(prev => prev + 1);
    alert('আবেদনটি প্রত্যাখ্যান করা হয়েছে।');
  };

  return (
    <div className="flex flex-col bg-[#f0f4f8] min-h-[600px] font-sans text-slate-800 rounded-b-2xl border-x border-b border-slate-200 overflow-hidden shadow-lg relative">
      
      {/* 1. DARK BLUE HEADER BAR */}
      <div className="bg-[#1e40af] text-white px-4 py-4 flex items-center justify-between shadow-md">
        <button 
          onClick={onBack}
          type="button"
          className="hover:bg-white/10 p-2 rounded-full transition active:scale-95 cursor-pointer text-white flex items-center justify-center shrink-0"
        >
          <ArrowLeft size={22} className="stroke-[2.5]" />
        </button>
        
        <div className="text-center flex-1 mx-3">
          <p className="font-extrabold text-[14px] text-yellow-300 leading-tight tracking-wider font-mono">
            {formatDateHeading(workingDay)}
          </p>
          <p className="font-black text-[16px] leading-tight mt-0.5 tracking-wide">
            {branchName}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0 font-bold text-xs text-blue-200">
          <span>v: 4.0.43</span>
          <MoreVertical size={18} className="text-white cursor-pointer hover:text-blue-100" />
        </div>
      </div>

      {/* 2. STAFF & GROUP BADGE ROW */}
      <div className="bg-white border-b border-slate-200 py-3.5 px-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 shadow-sm">
        <div className="flex items-center gap-2">
          <div className="bg-blue-600 text-white w-8 h-8 rounded-full flex items-center justify-center font-bold shadow-3xs shrink-0">
            <User size={16} className="stroke-[2.5]" />
          </div>
          <div>
            <span className="text-slate-400 text-[10px] block font-extrabold uppercase tracking-wide">দায়িত্বরত কর্মকর্তা</span>
            <span className="text-slate-800 tracking-wide font-black text-sm uppercase">
              {staff.name ? staff.name.toUpperCase() : ''} - {staff.staffId || '0000'}
            </span>
          </div>
        </div>

        {/* Group Selector Dropdown */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setIsGroupDropdownOpen(!isGroupDropdownOpen)}
            className="bg-slate-50 border border-slate-200 rounded-lg py-1.5 px-3 flex items-center gap-2 text-xs font-bold text-slate-700 hover:bg-slate-100 transition shadow-3xs cursor-pointer"
          >
            <Layers size={14} className="text-blue-600 shrink-0" />
            <span>সমিতি: {selectedGroup ? selectedGroup.name : 'নির্বাচন করুন'}</span>
            <ChevronDown size={12} className="text-slate-400" />
          </button>

          {isGroupDropdownOpen && (
            <div className="absolute right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-xl z-50 w-56 max-h-60 overflow-y-auto divide-y divide-slate-100 font-bold text-xs text-slate-800">
              {branchGroups.map((g) => {
                const isCurrent = g.id === selectedGroupId;
                return (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => {
                      setSelectedGroupId(g.id);
                      setSelectedMemberId('');
                      setIsFormOpen(false);
                      setIsGroupDropdownOpen(false);
                    }}
                    className={`w-full px-3 py-2.5 text-left hover:bg-slate-50 transition flex justify-between items-center ${
                      isCurrent ? 'bg-blue-50 text-blue-700 font-black' : ''
                    }`}
                  >
                    <span>{g.name} ({g.code})</span>
                    {isCurrent && <Check size={14} className="stroke-[2.5] text-blue-600" />}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* 3. CORE INTERFACE CONTAINER */}
      <div className="flex-1 p-4 md:p-6 max-w-4xl mx-auto w-full flex flex-col">
        
        {/* SUCCESS ALERTS */}
        {successMessage && (
          <div className="mb-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl p-4 flex items-center gap-3 shadow-sm animate-fade-in">
            <CheckCircle className="text-emerald-600 shrink-0" size={20} />
            <div className="flex-1 text-xs font-bold">{successMessage}</div>
            <button 
              onClick={() => setSuccessMessage(null)}
              className="text-emerald-500 hover:text-emerald-700 font-bold text-sm ml-2"
            >
              ✕
            </button>
          </div>
        )}

        {/* MEMBER DROPDOWN FIELD */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm mb-5 relative">
          <label className="block text-[11px] font-black text-slate-400 uppercase tracking-wider mb-1.5">
            Select Member (সদস্য নির্বাচন করুন)
          </label>
          
          <button
            type="button"
            onClick={() => setIsMemberDropdownOpen(!isMemberDropdownOpen)}
            className="w-full bg-slate-50 border border-slate-200 rounded-lg py-3 px-4 flex items-center justify-between text-sm font-bold text-slate-800 hover:bg-slate-100/50 transition cursor-pointer shadow-3xs"
          >
            <span>
              {selectedMember 
                ? `${selectedMember.name} / ${selectedMember.fatherHusbandName || 'N/A'}(${selectedMemberIndex})`
                : 'Select One'
              }
            </span>
            <ChevronDown size={16} className="text-slate-400" />
          </button>

          {/* Overlaid Popup Dropdown matching Screenshot 1 & 2 */}
          {isMemberDropdownOpen && (
            <div className="fixed inset-0 bg-slate-900/30 backdrop-blur-3xs z-[100] flex items-center justify-center p-4">
              <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[80vh] animate-scale-up">
                <div className="px-5 py-4 border-b border-slate-150 bg-slate-50 flex justify-between items-center">
                  <h4 className="text-sm font-black text-slate-700 tracking-wide">সদস্য তালিকা (Select One)</h4>
                  <button 
                    onClick={() => setIsMemberDropdownOpen(false)}
                    className="text-slate-400 hover:text-slate-600 font-extrabold text-sm py-1 px-2 rounded-lg hover:bg-slate-200 transition"
                  >
                    ✕
                  </button>
                </div>
                
                <div className="overflow-y-auto divide-y divide-slate-100 flex-1 py-1">
                  <button
                    type="button"
                    onClick={() => handleSelectMember('')}
                    className="w-full text-left px-5 py-3 hover:bg-slate-50 text-xs font-bold text-slate-500 transition"
                  >
                    Select One
                  </button>
                  {activeMembersInGroup.map((m, idx) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => handleSelectMember(m.id)}
                      className={`w-full text-left px-5 py-3.5 hover:bg-slate-50 transition flex items-center justify-between text-xs font-extrabold ${
                        m.id === selectedMemberId ? 'bg-blue-50/50 text-blue-700' : 'text-slate-700'
                      }`}
                    >
                      <span>{m.name} / {m.fatherHusbandName || 'N/A'}({idx + 1})</span>
                      {m.id === selectedMemberId && <Check size={14} className="text-blue-600 stroke-[2.5]" />}
                    </button>
                  ))}
                  {activeMembersInGroup.length === 0 && (
                    <div className="text-center py-8 text-slate-400 text-xs font-bold">
                      এই সমিতিতে কোনো সক্রিয় সদস্য নেই।
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* CONTAINER CONTENT */}
        {!selectedMember ? (
          <div className="flex-1 bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm flex flex-col">
            <div className="bg-slate-50 px-5 py-4 border-b border-slate-150 flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div>
                <span className="text-xs font-black text-slate-600 flex items-center gap-1.5 uppercase tracking-wider">
                  <FileText size={14} className="text-blue-600" /> {mode === 'refund' ? 'সঞ্চয় ফেরত আবেদন তালিকা' : mode === 'adjustment' ? 'সঞ্চয় সমন্বয় আবেদন তালিকা' : 'সঞ্চয় ফেরত ও সমন্বয় আবেদন তালিকা'}
                </span>
                <p className="text-[11px] text-slate-400 font-bold mt-0.5">{mode === 'refund' ? 'সংগঠনের সকল সদস্যের সঞ্চয় ফেরত আবেদনের তালিকা এবং অনুমোদন' : mode === 'adjustment' ? 'সংগঠনের সকল সদস্যের সঞ্চয় সমন্বয় আবেদনের তালিকা এবং অনুমোদন' : 'সংগঠনের সকল সদস্যের সঞ্চয় ফেরত ও সমন্বয় আবেদনের তালিকা এবং অনুমোদন'}</p>
              </div>
              
              {/* Filter Tabs */}
              <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-lg border border-slate-200">
                <button
                  type="button"
                  onClick={() => setStatusFilter('all')}
                  className={`px-3 py-1 text-[10px] font-black rounded-md transition ${statusFilter === 'all' ? 'bg-white text-slate-800 shadow-3xs' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  সকল ({modeFilteredRequests.length})
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('pending')}
                  className={`px-3 py-1 text-[10px] font-black rounded-md transition ${statusFilter === 'pending' ? 'bg-amber-500 text-white shadow-3xs' : 'text-amber-600 hover:text-amber-800'}`}
                >
                  অপেক্ষমান ({modeFilteredRequests.filter(r => (r.approvalStatus || 'pending') === 'pending').length})
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('approved')}
                  className={`px-3 py-1 text-[10px] font-black rounded-md transition ${statusFilter === 'approved' ? 'bg-green-600 text-white shadow-3xs' : 'text-green-600 hover:text-green-800'}`}
                >
                  অনুমোদিত ({modeFilteredRequests.filter(r => r.approvalStatus === 'approved').length})
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('rejected')}
                  className={`px-3 py-1 text-[10px] font-black rounded-md transition ${statusFilter === 'rejected' ? 'bg-rose-600 text-white shadow-3xs' : 'text-rose-600 hover:text-rose-800'}`}
                >
                  প্রত্যাখ্যাত ({modeFilteredRequests.filter(r => r.approvalStatus === 'rejected').length})
                </button>
              </div>
            </div>

            <div className="p-5 flex-1 overflow-y-auto max-h-[500px]">
              {(() => {
                const filteredList = statusFilter === 'all' 
                  ? modeFilteredRequests 
                  : statusFilter === 'pending' 
                    ? modeFilteredRequests.filter(r => (r.approvalStatus || 'pending') === 'pending')
                    : modeFilteredRequests.filter(r => r.approvalStatus === statusFilter);

                if (filteredList.length === 0) {
                  return (
                    <div className="py-16 px-4 flex flex-col items-center justify-center select-none text-center">
                      <PiggyBank size={48} className="text-slate-300 mb-3" />
                      <p className="text-slate-400 text-sm font-bold">এই ফিল্টারে কোনো আবেদন পাওয়া যায়নি।</p>
                      <p className="text-slate-300 text-xs mt-1">নতুন আবেদন তৈরি করতে উপরে একজন সদস্য নির্বাচন করুন।</p>
                    </div>
                  );
                }

                return (
                  <div className="space-y-4">
                    {filteredList.map((req) => (
                      <div key={req.id} className="border border-slate-200 rounded-xl p-4.5 bg-slate-50/50 hover:shadow-xs transition flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <div className="flex-1 space-y-2">
                          {/* Member & Group Info */}
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="text-xs font-black text-slate-800">{req.memberName}</h4>
                            <span className="text-[10px] font-bold text-slate-400">({req.memberCode})</span>
                            <span className="bg-blue-100 text-blue-800 text-[9px] font-black px-2 py-0.5 rounded-md">
                              {req.groupName}
                            </span>
                            <span className="bg-slate-100 text-slate-600 text-[9px] font-mono px-2 py-0.5 rounded-md">
                              {req.productName}
                            </span>
                          </div>

                          {/* Financial figures */}
                          <div className="grid grid-cols-3 gap-2 border-y border-slate-150 py-2 my-1 max-w-xl text-[11px] font-bold">
                            <div>
                              <p className="text-slate-400 text-[10px]">সঞ্চয় ফেরত (Cash):</p>
                              <p className="text-blue-700 font-black">৳{req.returnAmount.toLocaleString('bn-BD')}</p>
                            </div>
                            <div>
                              <p className="text-slate-400 text-[10px]">ঋণ সমন্বয়:</p>
                              <p className="text-rose-700 font-black">৳{req.adjustedAmount.toLocaleString('bn-BD')}</p>
                            </div>
                            <div>
                              <p className="text-slate-400 text-[10px]">লাভ (Profit):</p>
                              <p className="text-emerald-700 font-black">৳{(req.profit || 0).toLocaleString('bn-BD')}</p>
                            </div>
                          </div>

                          {/* Extra Request details */}
                          <div className="flex items-center gap-4 text-[10px] font-semibold text-slate-400 flex-wrap">
                            <span>আবেদনের ধরণ: <strong className="text-slate-600">{req.status} ({req.reason})</strong></span>
                            <span>তারিখ: <strong className="text-slate-600 font-mono">{formatDDMMYYYY(req.returnDate)}</strong></span>
                            {req.notes && <span className="italic bg-white px-2 py-0.5 rounded border border-slate-100">Note: {req.notes}</span>}
                          </div>
                        </div>

                        {/* Action buttons or status indicator */}
                        <div className="flex items-center gap-2 self-stretch md:self-auto justify-end border-t border-slate-100 md:border-t-0 pt-3 md:pt-0 shrink-0">
                          {(!req.approvalStatus || req.approvalStatus === 'pending') ? (
                            <>
                              <button
                                type="button"
                                onClick={() => handleRejectRequest(req)}
                                className="px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-black rounded-lg transition active:scale-95 cursor-pointer"
                              >
                                প্রত্যাখ্যান করুন
                              </button>
                              <button
                                type="button"
                                onClick={() => handleApproveRequest(req)}
                                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black rounded-lg transition shadow-sm hover:shadow-md active:scale-95 cursor-pointer flex items-center gap-1"
                              >
                                <Check size={14} className="stroke-[3]" /> অনুমোদন করুন
                              </button>
                            </>
                          ) : req.approvalStatus === 'approved' ? (
                            <div className="flex items-center gap-1.5 text-green-700 font-black text-xs bg-green-50 border border-green-100 px-3 py-2 rounded-lg">
                              <CheckCircle size={15} /> অনুমোদিত
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5 text-rose-700 font-black text-xs bg-rose-50 border border-rose-100 px-3 py-2 rounded-lg">
                              <XCircle size={15} /> প্রত্যাখ্যাত
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
          </div>
        ) : !isFormOpen ? (
          /* LIST AND HISTORY SCREEN FOR SELECTED MEMBER */
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm flex flex-col flex-1 min-h-[350px]">
            <div className="bg-slate-50 px-5 py-3.5 border-b border-slate-150 flex items-center justify-between">
              <span className="text-xs font-black text-slate-600 flex items-center gap-1.5 uppercase tracking-wider">
                <FileText size={14} className="text-blue-600" /> আবেদন এবং খতিয়ান তালিকা
              </span>
              <div className="flex items-center gap-2">
                <span className="bg-blue-100 text-blue-800 text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider">
                  {productName?.toLowerCase()?.includes('lts') ? 'LTS' : productName?.toLowerCase()?.includes('cbs') ? 'CBS' : 'GS'} Balance: {savingsBalance.toFixed(1)} TK
                </span>
                <button
                  type="button"
                  onClick={() => setIsFormOpen(true)}
                  className="bg-[#1e40af] hover:bg-blue-800 text-white font-bold text-[10px] px-3 py-1 rounded-lg transition active:scale-95 flex items-center gap-1 cursor-pointer"
                >
                  <Plus size={10} className="stroke-[3]" />
                  <span>নতুন আবেদন</span>
                </button>
              </div>
            </div>

            <div className="flex-1 p-5 flex flex-col justify-between">
              {/* If no requests found */}
              {modeFilteredMemberRequests.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center py-12">
                  <span className="text-[#1e40af] font-black text-lg tracking-wider block animate-pulse">
                    {mode === 'refund' ? 'No Refund Request Found' : mode === 'adjustment' ? 'No Adjustment Request Found' : 'No Request Found'}
                  </span>
                  <p className="text-slate-400 text-xs font-bold mt-1 text-center max-w-xs leading-normal">
                    {mode === 'refund' 
                      ? 'এই সদস্যের জন্য কোনো সচল সঞ্চয় ফেরত আবেদন পাওয়া যায়নি। নতুন আবেদনের জন্য নিচের বাটনে অথবা ডান পাশের \'+\' বাটনে চাপুন।' 
                      : mode === 'adjustment' 
                      ? 'এই সদস্যের জন্য কোনো সচল সঞ্চয় সমন্বয় আবেদন পাওয়া যায়নি। নতুন আবেদনের জন্য নিচের বাটনে অথবা ডান পাশের \'+\' বাটনে চাপুন।' 
                      : 'এই সদস্যের জন্য কোনো সচল সঞ্চয় ফেরত বা সমন্বয় আবেদন পাওয়া যায়নি। নতুন আবেদনের জন্য নিচের বাটনে অথবা ডান পাশের \'+\' বাটনে চাপুন।'}
                  </p>
                  <button
                    type="button"
                    onClick={() => setIsFormOpen(true)}
                    className="mt-6 px-6 py-3 bg-[#1e40af] hover:bg-blue-800 text-white font-black text-xs sm:text-sm rounded-xl shadow-md active:scale-95 transition flex items-center gap-2 cursor-pointer"
                  >
                    <Plus size={16} className="stroke-[3]" />
                    <span>{mode === 'refund' ? 'নতুন সঞ্চয় ফেরত আবেদন তৈরি করুন' : mode === 'adjustment' ? 'নতুন সঞ্চয় সমন্বয় আবেদন তৈরি করুন' : 'নতুন আবেদন তৈরি করুন'}</span>
                  </button>
                </div>
              ) : (
                /* LIST OF REFUND REQUEST CARDS */
                <div className="space-y-4 overflow-y-auto max-h-[300px] pr-1">
                  {modeFilteredMemberRequests.map((req) => (
                    <div key={req.id} className="border border-slate-150 rounded-xl p-4 hover:shadow-xs transition bg-slate-50/50">
                      <div className="flex justify-between items-start mb-2.5">
                        <div>
                          <div className="flex gap-1.5 flex-wrap">
                            <span className="bg-emerald-100 text-emerald-800 text-[9px] font-black px-2 py-0.5 rounded-md uppercase tracking-wide">
                              {req.status}
                            </span>
                            {req.approvalStatus === 'approved' ? (
                              <span className="bg-green-100 text-green-800 text-[9px] font-black px-2 py-0.5 rounded-md tracking-wide">
                                অনুমোদিত
                              </span>
                            ) : req.approvalStatus === 'rejected' ? (
                              <span className="bg-rose-100 text-rose-800 text-[9px] font-black px-2 py-0.5 rounded-md tracking-wide">
                                প্রত্যাখ্যাত
                              </span>
                            ) : (
                              <span className="bg-amber-100 text-amber-800 text-[9px] font-black px-2 py-0.5 rounded-md tracking-wide">
                                অপেক্ষমান
                              </span>
                            )}
                          </div>
                          <h5 className="text-xs font-black text-slate-800 mt-1">{req.productName} ({req.reason})</h5>
                        </div>
                        <span className="text-slate-400 text-[10px] font-bold font-mono">{formatDDMMYYYY(req.returnDate)}</span>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-2 text-[11px] font-bold border-t border-slate-100 pt-2.5 mt-2">
                        <div className="flex justify-between border-r border-slate-200 pr-3.5">
                          <span className="text-slate-500">ফেরত ক্যাশ:</span>
                          <span className="text-blue-700 font-black">{req.returnAmount.toFixed(1)} TK</span>
                        </div>
                        <div className="flex justify-between pl-3.5">
                          <span className="text-slate-500">ঋণ সমন্বয়:</span>
                          <span className="text-rose-700 font-black">{req.adjustedAmount.toFixed(1)} TK</span>
                        </div>
                      </div>
                      {req.notes && (
                        <p className="text-[10px] text-slate-400 italic mt-2.5 font-mono bg-white p-1.5 rounded-lg border border-slate-100">
                          Note: {req.notes}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Floating Action Button (FAB) at Bottom Right Corner */}
              <div className="flex justify-end mt-4">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(true)}
                  className="bg-[#1e40af] text-white hover:bg-blue-800 active:scale-95 transition-all p-4 rounded-full shadow-lg flex items-center justify-center cursor-pointer hover:rotate-90 transition-transform duration-300 group"
                  title="নতুন ফেরত আবেদন"
                >
                  <Plus size={24} className="stroke-[3]" />
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* RETURN REQUEST FORM (SCREEN 4 & 5) */
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm flex flex-col flex-1 animate-scale-up">
            
            {/* Form Title & Back to Member List */}
            <div className="bg-slate-50 px-5 py-4 border-b border-slate-150 flex justify-between items-center">
              <h3 className="text-xs font-black text-[#1e40af] tracking-wide uppercase flex items-center gap-1.5">
                <Sparkles size={14} className="text-yellow-500" /> Return Request Form
              </h3>
              <button 
                type="button"
                onClick={() => setIsFormOpen(false)}
                className="text-slate-400 hover:text-slate-600 font-extrabold text-xs flex items-center gap-1 bg-white py-1 px-2.5 rounded-lg border border-slate-200 shadow-3xs transition"
              >
                ← তালিকা
              </button>
            </div>

            {/* TAB CONTROLS */}
            <div className="flex border-b border-slate-200 bg-slate-50/50 select-none">
              <button
                type="button"
                onClick={() => setActiveTab('info')}
                className={`flex-1 py-3 text-xs font-black flex items-center justify-center gap-2 border-b-2 transition ${
                  activeTab === 'info' 
                    ? 'border-blue-600 text-blue-700 bg-white' 
                    : 'border-transparent text-slate-400 hover:text-slate-600'
                }`}
              >
                <Building size={14} /> Account Info
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('history')}
                className={`flex-1 py-3 text-xs font-black flex items-center justify-center gap-2 border-b-2 transition ${
                  activeTab === 'history' 
                    ? 'border-blue-600 text-blue-700 bg-white' 
                    : 'border-transparent text-slate-400 hover:text-slate-600'
                }`}
              >
                <Clock size={14} /> Account History
              </button>
            </div>

            {/* TAB CONTENTS */}
            <div className="p-5 md:p-6 flex-1 overflow-y-auto max-h-[500px]">
              {activeTab === 'info' ? (
                /* TAB 1: FORM FIELDS */
                <form onSubmit={handleSubmit} className="space-y-5">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    
                    {/* Member */}
                    <div className="relative">
                      <label className="absolute top-0 left-3 -translate-y-1/2 bg-white px-1 text-[10px] font-black text-slate-400 uppercase tracking-wide">
                        Member
                      </label>
                      <input
                        type="text"
                        disabled
                        value={`${selectedMember.name} / ${selectedMember.fatherHusbandName || 'N/A'}(${selectedMemberIndex})`}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs font-bold text-slate-500 cursor-not-allowed"
                      />
                    </div>

                    {/* Opening Date */}
                    <div className="relative">
                      <label className="absolute top-0 left-3 -translate-y-1/2 bg-white px-1 text-[10px] font-black text-slate-400 uppercase tracking-wide">
                        Opening Date
                      </label>
                      <input
                        type="text"
                        value={openingDate}
                        onChange={(e) => setOpeningDate(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-lg p-3 text-xs font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>

                    {/* Group */}
                    <div className="relative">
                      <label className="absolute top-0 left-3 -translate-y-1/2 bg-white px-1 text-[10px] font-black text-slate-400 uppercase tracking-wide">
                        Group
                      </label>
                      <input
                        type="text"
                        disabled
                        value={selectedGroup?.name || ''}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs font-bold text-slate-500 cursor-not-allowed"
                      />
                    </div>

                    {/* Meeting Date */}
                    <div className="relative">
                      <label className="absolute top-0 left-3 -translate-y-1/2 bg-white px-1 text-[10px] font-black text-slate-400 uppercase tracking-wide">
                        Meeting Date
                      </label>
                      <input
                        type="text"
                        disabled
                        value={selectedGroup?.meetingDay || 'Wed'}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs font-bold text-slate-500 cursor-not-allowed"
                      />
                    </div>

                    {/* Product Name */}
                    <div className="relative">
                      <label className="absolute top-0 left-3 -translate-y-1/2 bg-white px-1 text-[10px] font-black text-slate-400 uppercase tracking-wide">
                        Product Name (সঞ্চয় প্রোডাক্ট)
                      </label>
                      <select
                        value={productName}
                        onChange={(e) => setProductName(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-lg p-3 text-xs font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      >
                        <option value="GENERAL SAVINGS">GENERAL SAVINGS (GS - সাধারণ সঞ্চয়)</option>
                        <option value="CBS SAVINGS">CBS SAVINGS (CBS - বিশেষ সঞ্চয়)</option>
                        <option value="LTS SAVINGS">LTS SAVINGS (LTS - দীর্ঘমেয়াদী সঞ্চয়)</option>
                      </select>
                    </div>

                    {/* Duration */}
                    <div className="relative">
                      <label className="absolute top-0 left-3 -translate-y-1/2 bg-white px-1 text-[10px] font-black text-slate-400 uppercase tracking-wide">
                        Duration
                      </label>
                      <input
                        type="text"
                        value={duration}
                        onChange={(e) => setDuration(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-lg p-3 text-xs font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>

                    {/* Minimum Deposit */}
                    <div className="relative">
                      <label className="absolute top-0 left-3 -translate-y-1/2 bg-white px-1 text-[10px] font-black text-slate-400 uppercase tracking-wide">
                        Minimum Deposit
                      </label>
                      <input
                        type="number"
                        value={minimumDeposit}
                        onChange={(e) => setMinimumDeposit(Number(e.target.value) || 0)}
                        className="w-full bg-white border border-slate-200 rounded-lg p-3 text-xs font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>

                    {/* Installment Type */}
                    <div className="relative">
                      <label className="absolute top-0 left-3 -translate-y-1/2 bg-white px-1 text-[10px] font-black text-slate-400 uppercase tracking-wide">
                        Installment Type
                      </label>
                      <select
                        value={installmentType}
                        onChange={(e) => setInstallmentType(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-lg p-3 text-xs font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      >
                        <option value="Weekly">Weekly</option>
                        <option value="Monthly">Monthly</option>
                        <option value="One-time">One-time</option>
                      </select>
                    </div>

                    {/* Status */}
                    <div className="relative">
                      <label className="absolute top-0 left-3 -translate-y-1/2 bg-white px-1 text-[10px] font-black text-slate-400 uppercase tracking-wide">
                        Status
                      </label>
                      <select
                        value={status}
                        onChange={(e) => {
                          const val = e.target.value;
                          setStatus(val);
                          if (val === 'AdjustmentOnly') {
                            setReason('Loan Adjustment');
                          } else {
                            setReason('Return');
                          }
                        }}
                        className="w-full bg-white border border-slate-200 rounded-lg p-3 text-xs font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        disabled={mode === 'adjustment'}
                      >
                        {mode === 'refund' ? (
                          <>
                            <option value="Closing">Closing (পুর্ন সঞ্চয় ফেরত)</option>
                            <option value="Partial">Partial Withdrawal (আংশিক সঞ্চয় উত্তোলন)</option>
                          </>
                        ) : mode === 'adjustment' ? (
                          <option value="AdjustmentOnly">Adjustment Only (কোনো ফেরত নেই, শুধু ঋণ সমন্বয়)</option>
                        ) : (
                          <>
                            <option value="Closing">Closing (পুর্ন ফেরত ও সমন্বয়)</option>
                            <option value="Partial">Partial Withdrawal (আংশিক উত্তোলন)</option>
                            <option value="AdjustmentOnly">Adjustment Only (কোনো ফেরত নেই, শুধু ঋণ সমন্বয়)</option>
                          </>
                        )}
                      </select>
                    </div>

                    {/* Reason */}
                    <div className="relative">
                      <label className="absolute top-0 left-3 -translate-y-1/2 bg-white px-1 text-[10px] font-black text-slate-400 uppercase tracking-wide">
                        Reason
                      </label>
                      <input
                        type="text"
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-lg p-3 text-xs font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>

                    {/* Return Date */}
                    {mode !== 'adjustment' && (
                      <div className="relative">
                        <label className="absolute top-0 left-3 -translate-y-1/2 bg-white px-1 text-[10px] font-black text-slate-400 uppercase tracking-wide">
                          Return Date
                        </label>
                        <input
                          type="date"
                          value={returnDate}
                          onChange={(e) => setReturnDate(e.target.value)}
                          className="w-full bg-white border border-slate-200 rounded-lg p-3 text-xs font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
                        />
                      </div>
                    )}

                    {/* Payment Method */}
                    {mode !== 'adjustment' && (
                      <div className="relative">
                        <label className="absolute top-0 left-3 -translate-y-1/2 bg-white px-1 text-[10px] font-black text-slate-400 uppercase tracking-wide">
                          Payment Method
                        </label>
                        <select
                          value={paymentMethod}
                          onChange={(e) => setPaymentMethod(e.target.value)}
                          className="w-full bg-white border border-slate-200 rounded-lg p-3 text-xs font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        >
                          <option value="Cash">Cash</option>
                          <option value="Bank">Bank Account</option>
                          <option value="bKash">bKash</option>
                          <option value="Nagad">Nagad</option>
                        </select>
                      </div>
                    )}

                    {/* BALANCES HIGHLIGHTS FOR CALCULATING REFUNDS */}
                    <div className="md:col-span-2 bg-gradient-to-r from-blue-50 to-indigo-50 p-4 rounded-xl border border-blue-150 flex flex-col sm:flex-row justify-around gap-4 text-xs font-bold text-slate-700 shadow-3xs">
                      <div className="flex flex-col items-center">
                        <span className="text-slate-400 text-[10px] uppercase font-black">সঞ্চয় স্থিতি (GS Balance)</span>
                        <span className="text-blue-700 font-black text-sm mt-0.5">{savingsBalance.toFixed(1)} TK</span>
                      </div>
                      <div className="flex flex-col items-center border-t sm:border-t-0 sm:border-x border-slate-200 sm:px-6 py-2 sm:py-0">
                        <span className="text-slate-400 text-[10px] uppercase font-black">ঋণ স্থিতি (Loan Outstanding)</span>
                        <span className="text-rose-700 font-black text-sm mt-0.5">{loanOutstanding.toFixed(1)} TK</span>
                      </div>
                      <div className="flex flex-col items-center">
                        <span className="text-slate-400 text-[10px] uppercase font-black">মোট ফেরতযোগ্য (Savings + Profit)</span>
                        <span className="text-emerald-700 font-black text-sm mt-0.5">{totalReturn.toFixed(1)} TK</span>
                      </div>
                    </div>

                    {/* Savings Balance (সঞ্চয় স্থিতি) */}
                    <div className="relative">
                      <label className="absolute top-0 left-3 -translate-y-1/2 bg-white px-1 text-[10px] font-black text-slate-500 uppercase tracking-wide">
                        সঞ্চয় স্থিতি (Savings Balance)
                      </label>
                      <input
                        type="number"
                        disabled
                        value={savingsBalance}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs font-bold text-slate-500 cursor-not-allowed"
                      />
                    </div>

                    {/* Profit (লাভ) */}
                    <div className="relative">
                      <label className="absolute top-0 left-3 -translate-y-1/2 bg-white px-1 text-[10px] font-black text-blue-600 uppercase tracking-wide">
                        লাভ (Profit)
                      </label>
                      <input
                        type="number"
                        placeholder="Enter profit amount"
                        value={profit || ''}
                        onChange={(e) => setProfit(Number(e.target.value) || 0)}
                        className="w-full bg-white border border-blue-200 rounded-lg p-3 text-xs font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>

                    {/* Total Return (মোট ফেরত) */}
                    <div className="relative">
                      <label className="absolute top-0 left-3 -translate-y-1/2 bg-white px-1 text-[10px] font-black text-slate-500 uppercase tracking-wide">
                        মোট ফেরত (Total Return)
                      </label>
                      <input
                        type="number"
                        disabled
                        value={totalReturn}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs font-bold text-slate-500 cursor-not-allowed"
                      />
                    </div>

                    {/* Adjusted Amount (সমন্বয়কৃত পরিমাণ) */}
                    <div className="relative">
                      <label className="absolute top-0 left-3 -translate-y-1/2 bg-white px-1 text-[10px] font-black text-indigo-600 uppercase tracking-wide">
                        সমন্বয়কৃত পরিমাণ (Adjusted Amount)
                      </label>
                      <input
                        type="number"
                        placeholder="ঋণ সমন্বয় এর এমাউন্ট লিখুন"
                        value={manualAdjustedAmount}
                        onChange={(e) => setManualAdjustedAmount(e.target.value)}
                        className="w-full bg-white border border-indigo-200 rounded-lg p-3 text-xs font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                      {loanOutstanding > 0 && (
                        <span className="absolute right-3.5 top-3 text-[9px] text-rose-500 font-extrabold bg-rose-50 px-1.5 py-0.5 rounded">
                          ঋণ বকেয়া: {loanOutstanding.toFixed(0)} TK
                        </span>
                      )}
                    </div>

                    {/* Adjust Date (সমন্বয় তারিখ) */}
                    <div className="relative">
                      <label className="absolute top-0 left-3 -translate-y-1/2 bg-white px-1 text-[10px] font-black text-indigo-600 uppercase tracking-wide">
                        সমন্বয় তারিখ (Adjust Date)
                      </label>
                      <input
                        type="date"
                        value={adjustDate}
                        onChange={(e) => setAdjustDate(e.target.value)}
                        className="w-full bg-white border border-indigo-200 rounded-lg p-3 text-xs font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
                      />
                    </div>

                    {/* Return Amount (ফেরত পরিমাণ / নিট ফেরত) */}
                    <div className="relative">
                      <label className="absolute top-0 left-3 -translate-y-1/2 bg-white px-1 text-[10px] font-black text-emerald-600 uppercase tracking-wide">
                        নিট ফেরত পরিমাণ (Return Amount)
                      </label>
                      <input
                        type="number"
                        disabled
                        value={calculatedReturnAmount}
                        className="w-full bg-emerald-50/50 border border-emerald-200 rounded-lg p-3 text-xs font-black text-emerald-700 cursor-not-allowed"
                      />
                    </div>

                    {/* Notes */}
                    <div className="relative md:col-span-2">
                      <label className="absolute top-0 left-3 -translate-y-1/2 bg-white px-1 text-[10px] font-black text-slate-400 uppercase tracking-wide">
                        Notes
                      </label>
                      <textarea
                        rows={2}
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-lg p-3 text-xs font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
                      />
                    </div>

                  </div>

                  <button
                    type="submit"
                    className="w-full bg-[#1e40af] text-white hover:bg-blue-800 font-black text-sm tracking-wide uppercase py-3.5 rounded-xl transition duration-200 active:scale-98 shadow-md mt-4 cursor-pointer"
                  >
                    SUBMIT
                  </button>
                </form>
              ) : (
                /* TAB 2: ACCOUNT HISTORY */
                <div className="space-y-4">
                  {/* Real transactions for general savings of this member */}
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-150">
                    <h4 className="text-xs font-black text-slate-700 uppercase tracking-wider mb-3 flex items-center gap-1">
                      <ArrowLeftRight size={13} className="text-blue-600" /> লেনদেন খতিয়ান (Ledger Transactions)
                    </h4>
                    
                    <div className="space-y-2 max-h-[250px] overflow-y-auto pr-1">
                      {transactions
                        .filter(t => t.memberId === selectedMember.id)
                        .map((t, idx) => (
                          <div key={t.id || idx} className="bg-white border border-slate-150 rounded-lg p-2.5 flex justify-between items-center text-[11px] font-bold">
                            <div>
                              <span className={`text-[9px] px-1.5 py-0.5 rounded-md ${
                                t.type === 'savings_deposit' 
                                  ? 'bg-emerald-100 text-emerald-800' 
                                  : t.type === 'savings_withdrawal' 
                                    ? 'bg-amber-100 text-amber-800' 
                                    : 'bg-blue-100 text-blue-800'
                              }`}>
                                {t.type === 'savings_deposit' ? 'জমা' : t.type === 'savings_withdrawal' ? 'উত্তোলন' : 'ঋণ পরিশোধ'}
                              </span>
                              <span className="text-slate-400 text-[10px] font-mono ml-2">{formatDDMMYYYY(t.date || t.addDate)}</span>
                            </div>
                            <span className="font-mono text-slate-800 font-black">{Number(t.amount || 0).toFixed(1)} TK</span>
                          </div>
                        ))
                      }
                      {transactions.filter(t => t.memberId === selectedMember.id).length === 0 && (
                        <div className="text-center py-6 text-slate-400 text-[11px] font-bold">
                          কোনো পূর্ববর্তী লেনদেনের রেকর্ড পাওয়া যায়নি।
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

          </div>
        )}

      </div>

    </div>
  );
};
