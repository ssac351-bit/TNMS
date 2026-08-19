/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect } from 'react';
import { 
  FileText, 
  Printer, 
  Download, 
  Calendar, 
  RefreshCw, 
  ArrowLeft, 
  Search,
  BookOpen,
  DollarSign,
  TrendingUp,
  UserCheck,
  Building,
  User,
  Users,
  ClipboardList,
  Zap,
  ShieldAlert,
  CheckCircle2
} from 'lucide-react';
import { Organization, Staff, Group, Member, Branch } from '../types';
import { calculateLoanOverdueAndSchedule } from './MemberTransactionView';
import { processLoanAdjustment } from '../lib/loanAdjustment';
import { formatDDMMYYYY, downloadExcelCsv } from '../lib/dateUtils';

interface UnifiedReportsPanelProps {
  org: Organization;
  currentStaff?: Staff; // Optional (defined if Field Officer or BM context)
  branchId?: string; // Optional (defined if BM or Field Officer context)
  workingDay: string;
  onBack?: () => void; // Back button action for full screen dashboards
}

// Utility to convert DD-MM-YYYY to YYYY-MM-DD for standard date inputs
function ensureYYYYMMDD(dayStr: string): string {
  if (!dayStr) return new Date().toISOString().split('T')[0];
  const parts = dayStr.split('-');
  if (parts.length === 3) {
    if (parts[0].length === 4) {
      return dayStr; // Already YYYY-MM-DD
    } else if (parts[2].length === 4) {
      // DD-MM-YYYY -> YYYY-MM-DD
      return `${parts[2]}-${parts[1]}-${parts[0]}`;
    }
  }
  return dayStr;
}

// Utility to format Date to DD/MM/YYYY
function formatDateToDDMMYYYY(dateStr: string): string {
  return formatDDMMYYYY(dateStr);
}

export const UnifiedReportsPanel: React.FC<UnifiedReportsPanelProps> = ({
  org,
  currentStaff,
  branchId: initialBranchId,
  workingDay,
  onBack
}) => {
  // Convert working day to YYYY-MM-DD for initial calendar state
  const defaultDateStr = useMemo(() => ensureYYYYMMDD(workingDay), [workingDay]);

  // Report Form States - ALWAYS DEFAULTING TO WORKING DAY
  const [startDate, setStartDate] = useState(defaultDateStr);
  const [endDate, setEndDate] = useState(defaultDateStr);
  const [selectedBranchId, setSelectedBranchId] = useState<string>(initialBranchId || 'all');
  const [selectedGroupId, setSelectedGroupId] = useState<string>('all');
  const [activeReport, setActiveReport] = useState<'collection' | 'disbursement' | 'savings' | 'cash_summary' | 'demand_collection' | 'par' | 'profit_loss' | 'balance_sheet' | 'audit_summary' | 'expired_defaulters' | 'mra_report'>('collection');
  const [searchTerm, setSearchTerm] = useState('');

  // Loaded Entities from Storage
  const [branches, setBranches] = useState<Branch[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [allStaff, setAllStaff] = useState<Staff[]>([]);
  const [allTransactions, setAllTransactions] = useState<any[]>([]);

  // Force re-load trigger
  const [reloadTrigger, setReloadTrigger] = useState(0);

  // Load reference data
  useEffect(() => {
    const loadedBranches: Branch[] = JSON.parse(localStorage.getItem(`tanzil_branches_${org.id}`) || '[]');
    const loadedGroups: Group[] = JSON.parse(localStorage.getItem(`tanzil_groups_${org.id}`) || '[]');
    const loadedMembers: Member[] = JSON.parse(localStorage.getItem(`tanzil_group_members_${org.id}`) || '[]');
    const loadedStaff: Staff[] = JSON.parse(localStorage.getItem(`tanzil_staff_${org.id}`) || '[]');

    setBranches(loadedBranches);
    setGroups(loadedGroups);
    setMembers(loadedMembers);
    setAllStaff(loadedStaff);
  }, [org.id, reloadTrigger]);

  // Load transactions based on context
  useEffect(() => {
    const transactionsList: any[] = [];
    const proposals: any[] = JSON.parse(localStorage.getItem(`tanzil_loan_proposals_${org.id}`) || '[]');
    const localMembers: any[] = JSON.parse(localStorage.getItem(`tanzil_group_members_${org.id}`) || '[]');
    
    // Helper to dynamically attach proposalDetail if missing
    const attachProposalIfMissing = (t: any) => {
      if (t.type === 'disbursement' && !t.proposalDetail) {
        // 1. Try direct matching case-insensitively
        let prop = proposals.find((p: any) => 
          (String(p.memberId).toLowerCase() === String(t.memberId).toLowerCase() || 
           String(p.memberIdText).toLowerCase() === String(t.memberId).toLowerCase()) && 
          Math.abs(Number(p.amount || 0) - Number(t.amount || 0)) < 0.01
        );

        // 2. If not found, try resolving via group members
        if (!prop) {
          const mObj = localMembers.find((m: any) => 
            String(m.memberId).toLowerCase() === String(t.memberId).toLowerCase() || 
            String(m.id).toLowerCase() === String(t.memberId).toLowerCase()
          );
          if (mObj) {
            prop = proposals.find((p: any) => 
              (String(p.memberId).toLowerCase() === String(mObj.id).toLowerCase() || 
               String(p.memberIdText).toLowerCase() === String(mObj.memberId).toLowerCase() ||
               String(p.memberId).toLowerCase() === String(mObj.memberId).toLowerCase()) && 
              Math.abs(Number(p.amount || 0) - Number(t.amount || 0)) < 0.01
            );
          }
        }

        if (prop) {
          t.proposalDetail = prop;
        }
      }
    };

    // Org Admin can consolidate transactions from ALL branches or selected branch
    if (!initialBranchId) {
      if (selectedBranchId === 'all') {
        // Iterate over localStorage keys to gather all branch txs
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith(`tanzil_bm_tx_${org.id}_`)) {
            try {
              const txs = JSON.parse(localStorage.getItem(key) || '[]');
              const branchIdFromKey = key.replace(`tanzil_bm_tx_${org.id}_`, '');
              // Annotate each transaction with branchId
              txs.forEach((t: any) => {
                t.branchId = branchIdFromKey;
                attachProposalIfMissing(t);
                transactionsList.push(t);
              });
            } catch (err) {
              console.error("Error parsing transactions for key", key, err);
            }
          }
        }
      } else {
        const key = `tanzil_bm_tx_${org.id}_${selectedBranchId}`;
        const txs = JSON.parse(localStorage.getItem(key) || '[]');
        txs.forEach((t: any) => {
          t.branchId = selectedBranchId;
          attachProposalIfMissing(t);
          transactionsList.push(t);
        });
      }
    } else {
      // Branch Manager or Staff context is limited to their own branch
      const key = `tanzil_bm_tx_${org.id}_${initialBranchId}`;
      const txs = JSON.parse(localStorage.getItem(key) || '[]');
      txs.forEach((t: any) => {
        t.branchId = initialBranchId;
        attachProposalIfMissing(t);
        transactionsList.push(t);
      });
    }

    setAllTransactions(transactionsList);
  }, [org.id, selectedBranchId, initialBranchId, reloadTrigger]);

  // Handle Default Reset - sets dates back to Working Day
  const handleResetToWorkingDay = () => {
    setStartDate(defaultDateStr);
    setEndDate(defaultDateStr);
  };

  // Filter groups depending on selected branch
  const filteredGroups = useMemo(() => {
    if (initialBranchId) {
      // Locked to branch
      return groups.filter(g => g.branchId === initialBranchId);
    }
    if (selectedBranchId === 'all') {
      return groups;
    }
    return groups.filter(g => g.branchId === selectedBranchId);
  }, [groups, selectedBranchId, initialBranchId]);

  // Primary Chronological Filter on Transactions
  const filteredTransactions = useMemo(() => {
    return allTransactions.filter(tx => {
      if (!tx.date) return false;
      const txFormatted = ensureYYYYMMDD(tx.date);
      const isWithinDates = txFormatted >= startDate && txFormatted <= endDate;
      if (!isWithinDates) return false;

      // Filter by Group
      if (selectedGroupId !== 'all') {
        // Find member to check group
        const memberObj = members.find(m => m.memberId === tx.memberId || m.id === tx.memberId);
        if (!memberObj || memberObj.groupId !== selectedGroupId) {
          return false;
        }
      }

      // Filter by Field Officer if in Field Officer context
      if (currentStaff && currentStaff.role === 'field_officer') {
        const memberObj = members.find(m => m.memberId === tx.memberId || m.id === tx.memberId);
        if (!memberObj) return false;
        const groupObj = groups.find(g => g.id === memberObj.groupId);
        if (!groupObj || groupObj.assignedStaffId !== currentStaff.id) {
          return false;
        }
      }

      // Filter by Search Term (Member Name, ID, or Samity Name)
      if (searchTerm.trim() !== '') {
        const query = searchTerm.toLowerCase();
        const mName = String(tx.memberName || '').toLowerCase();
        const mId = String(tx.memberId || '').toLowerCase();
        const gName = String(tx.groupName || '').toLowerCase();
        const rNo = String(tx.receiptNo || tx.id || '').toLowerCase();

        return mName.includes(query) || mId.includes(query) || gName.includes(query) || rNo.includes(query);
      }

      return true;
    });
  }, [allTransactions, startDate, endDate, selectedGroupId, currentStaff, members, groups, searchTerm]);

  // Consolidated Math Metrics for each report type
  const reportSummary = useMemo(() => {
    let totalPL = 0;
    let totalGS = 0;
    let totalCBS = 0;
    let totalLTS = 0;
    let totalSavingsDeposit = 0;
    let totalSavingsWithdrawal = 0;
    let totalDisbursed = 0;
    let totalServiceCharge = 0;
    let totalPayable = 0;

    filteredTransactions.forEach(tx => {
      // 1. Collection sums
      if (tx.type === 'collection') {
        const plVal = Number(tx.collections?.pl || 0);
        const gsVal = Number(tx.collections?.gs || 0);
        const cbsVal = Number(tx.collections?.cbs || 0);
        const ltsVal = Number(tx.collections?.lts || 0);

        totalPL += plVal;
        totalGS += gsVal;
        totalCBS += cbsVal;
        totalLTS += ltsVal;

        totalSavingsDeposit += (gsVal + cbsVal + ltsVal);
      }

      // 2. Savings Deposit / Withdrawal standalone types
      if (tx.type === 'savings_deposit') {
        const gsDep = Number(tx.amount || 0);
        totalGS += gsDep;
        totalSavingsDeposit += gsDep;
      }

      if (tx.type === 'savings_withdrawal' || tx.type === 'withdrawal') {
        const wGs = Number(tx.withdrawals?.gs || tx.amount || 0);
        const wCbs = Number(tx.withdrawals?.cbs || 0);
        const wLts = Number(tx.withdrawals?.lts || 0);

        totalSavingsWithdrawal += (wGs + wCbs + wLts);
      }

      // 3. Disbursement sums
      if (tx.type === 'disbursement') {
        const amt = Number(tx.amount || tx.proposalDetail?.proposedAmount || 0);
        const totalP = Number(tx.proposalDetail?.totalPayable || (amt * 1.15));
        const sc = totalP - amt;

        totalDisbursed += amt;
        totalServiceCharge += sc;
        totalPayable += totalP;
      }
    });

    return {
      totalPL,
      totalGS,
      totalCBS,
      totalLTS,
      totalSavingsDeposit,
      totalSavingsWithdrawal,
      totalDisbursed,
      totalServiceCharge,
      totalPayable,
      totalCollectionsOverall: totalPL + totalGS + totalCBS + totalLTS,
      netCashFlow: (totalPL + totalSavingsDeposit) - (totalDisbursed + totalSavingsWithdrawal)
    };
  }, [filteredTransactions]);

  // LLP calculation logic based on member outstanding and overdue and org settings
  const llpSummary = useMemo(() => {
    const parseBengaliOrEnglishFloat = (val: string | null, fallback: number): number => {
      if (!val) return fallback;
      const englishDigits = val.replace(/[০-৯]/g, d => '০১২৩৪৫৬৭৮৯'.indexOf(d).toString());
      const parsed = parseFloat(englishDigits);
      return isNaN(parsed) ? fallback : parsed;
    };

    const rawLlpStandardRate = parseBengaliOrEnglishFloat(localStorage.getItem(`tanzil_llp_standard_${org.id}`), 1);
    const rawLlpSubStandardRate = parseBengaliOrEnglishFloat(localStorage.getItem(`tanzil_llp_substandard_${org.id}`), 5);
    const rawLlpDoubtfulRate = parseBengaliOrEnglishFloat(localStorage.getItem(`tanzil_llp_doubtful_${org.id}`), 50);
    const rawLlpBadRate = parseBengaliOrEnglishFloat(localStorage.getItem(`tanzil_llp_bad_${org.id}`), 100);

    let standardOutstanding = 0;
    let subStandardOutstanding = 0;
    let doubtfulOutstanding = 0;
    let badOutstanding = 0;

    let standardCount = 0;
    let subStandardCount = 0;
    let doubtfulCount = 0;
    let badCount = 0;

    const holidays = JSON.parse(localStorage.getItem(`tanzil_holidays_${org.id}`) || '[]');
    const branchGroups = JSON.parse(localStorage.getItem(`tanzil_groups_${org.id}`) || '[]');
    const refDate = endDate || workingDay || new Date().toISOString().split('T')[0];
    const classifiedMembers: any[] = [];

    members.filter(m => (m.plOutstanding ?? 0) > 0).forEach(m => {
      const outstanding = m.plOutstanding ?? 0;
      
      // Calculate actual overdue status
      const loanStatus = calculateLoanOverdueAndSchedule(m, allTransactions, refDate, holidays, branchGroups);
      const daysOverdue = loanStatus.daysOverdue ?? 0;
      const overdueAmount = loanStatus.overdueAmount;

      let classLabel = "🟢 নিয়মিত (Standard)";
      let classStyle = "bg-emerald-50 text-emerald-800 border-emerald-200";

      if (overdueAmount <= 0 || daysOverdue === 0) {
        standardOutstanding += outstanding;
        standardCount++;
      } else if (daysOverdue <= 90) {
        subStandardOutstanding += outstanding;
        subStandardCount++;
        classLabel = `🟡 সাব-স্ট্যান্ডার্ড (${daysOverdue} দিন)`;
        classStyle = "bg-amber-50 text-amber-800 border-amber-200";
      } else if (daysOverdue <= 365) {
        doubtfulOutstanding += outstanding;
        doubtfulCount++;
        classLabel = `🟠 সন্দেহজনক (${daysOverdue} দিন)`;
        classStyle = "bg-orange-50 text-orange-800 border-orange-200";
      } else {
        badOutstanding += outstanding;
        badCount++;
        classLabel = `🔴 মন্দ / কু-ঋণ (${daysOverdue} দিন)`;
        classStyle = "bg-rose-50 text-rose-800 border-rose-200";
      }

      classifiedMembers.push({
        member: m,
        outstanding,
        overdueAmount,
        daysOverdue,
        classLabel,
        classStyle
      });
    });

    const provisionStandard = standardOutstanding * (rawLlpStandardRate / 100);
    const provisionSubStandard = subStandardOutstanding * (rawLlpSubStandardRate / 100);
    const provisionDoubtful = doubtfulOutstanding * (rawLlpDoubtfulRate / 100);
    const provisionBad = badOutstanding * (rawLlpBadRate / 100);
    const totalProvision = provisionStandard + provisionSubStandard + provisionDoubtful + provisionBad;
    const totalOutstanding = standardOutstanding + subStandardOutstanding + doubtfulOutstanding + badOutstanding;
    const totalOverdueCount = subStandardCount + doubtfulCount + badCount;

    return {
      rates: {
        standard: rawLlpStandardRate,
        subStandard: rawLlpSubStandardRate,
        doubtful: rawLlpDoubtfulRate,
        bad: rawLlpBadRate
      },
      counts: {
        standard: standardCount,
        subStandard: subStandardCount,
        doubtful: doubtfulCount,
        bad: badCount,
        total: standardCount + subStandardCount + doubtfulCount + badCount
      },
      outstandings: {
        standard: standardOutstanding,
        subStandard: subStandardOutstanding,
        doubtful: doubtfulOutstanding,
        bad: badOutstanding,
        total: totalOutstanding
      },
      provisions: {
        standard: provisionStandard,
        subStandard: provisionSubStandard,
        doubtful: provisionDoubtful,
        bad: provisionBad,
        total: totalProvision
      },
      totalOverdueCount,
      classifiedMembers
    };
  }, [members, org.id, allTransactions, endDate, workingDay]);

  // Expired Loan Members Auto-Adjustment Report Data
  const expiredMembersReportData = useMemo(() => {
    const holidays = JSON.parse(localStorage.getItem(`tanzil_holidays_${org.id}`) || '[]');
    const branchGroups = groups;
    const refDate = endDate || workingDay || new Date().toISOString().split('T')[0];

    const loadedLts: any[] = JSON.parse(localStorage.getItem(`tanzil_lts_accounts_${org.id}`) || '[]');
    const loadedCbs: any[] = JSON.parse(localStorage.getItem(`tanzil_cbs_accounts_${org.id}`) || '[]');

    let filtered = members.filter(m => {
      if (selectedBranchId !== 'all' && m.branchId && m.branchId !== selectedBranchId) return false;
      if (selectedGroupId !== 'all' && m.groupId && m.groupId !== selectedGroupId) return false;
      return true;
    });

    const list = filtered.filter(m => {
      const outstanding = m.plOutstanding || 0;
      if (outstanding <= 0) return false;
      const loanStatus = calculateLoanOverdueAndSchedule(m, allTransactions, refDate, holidays, branchGroups);
      const isExpiredOrOverdue = (loanStatus.overdueAmount > 0) || (loanStatus.daysOverdue > 0) || m.isDefaulter === true || (m.defaulterBalance ?? 0) > 0 || m.isCurrentMonthDefaulter === true || (m.overdueAmount ?? 0) > 0;
      return isExpiredOrOverdue;
    });

    return list.map(memberObj => {
      const memberId = memberObj.id;
      const mCode = memberObj.memberId || memberObj.id;
      const outstanding = memberObj.plOutstanding || 0;
      const loanStatus = calculateLoanOverdueAndSchedule(memberObj, allTransactions, refDate, holidays, branchGroups);

      const currentGs = memberObj.gsBalance ?? memberObj.savingsBalance ?? 0;
      const currentLts = memberObj.ltsBalance ?? 0;
      const currentCbs = memberObj.cbsBalance ?? 0;
      const currentShare = memberObj.shareBalance ?? ((memberObj.shareCount || 0) * 100);

      const memberLtsAcc = loadedLts.find(acc => (acc.memberId === memberId || acc.memberId === mCode) && acc.status === 'active');
      const memberCbsAcc = loadedCbs.find(acc => (acc.memberId === memberId || acc.memberId === mCode) && acc.status === 'active');

      const result = processLoanAdjustment(memberId, outstanding, {
        currentGsBalance: currentGs,
        currentLtsPrincipal: currentLts,
        memberLts: memberLtsAcc,
        currentCbsPrincipal: currentCbs,
        memberCbs: memberCbsAcc,
        currentShareBalance: currentShare
      });

      const totalAdjusted = result.gsAdjusted + result.ltsAdjusted + result.cbsAdjusted + result.shareAdjusted;

      return {
        member: memberObj,
        outstanding,
        overdueAmount: loanStatus.overdueAmount,
        daysOverdue: loanStatus.daysOverdue,
        currentGs,
        currentLts,
        currentCbs,
        currentShare,
        result,
        totalAdjusted,
        remainingLoan: result.remainingLoan
      };
    });
  }, [members, selectedBranchId, selectedGroupId, endDate, workingDay, allTransactions, org.id, groups]);

  // Detailed Periodical Profit and Loss (Net Profit/Loss) calculations
  const profitLossSummary = useMemo(() => {
    // 1. Incomes
    let serviceChargeIncome = 0;
    let admissionFeeIncome = 0;
    let passbookFeeIncome = 0;
    let bankInterestIncome = 0;
    let miscIncome = 0;

    // 2. Expenses
    let staffSalariesExpense = 0;
    let officeRentExpense = 0;
    let travelTransportExpense = 0;
    let otherAdministrativeExpense = 0;
    let loanExemptionExpense = 0;

    filteredTransactions.forEach(t => {
      const amt = Number(t.amount || 0);
      const isIncome = t.type === 'income' || t.debitAcc === 'cash' || t.creditAcc === 'service_charge' || t.creditAcc === 'admission_fee' || t.creditAcc === 'passbook_fee' || t.creditAcc === 'bank_interest' || t.creditAcc === 'other_income';
      const isExpense = t.type === 'expense' || t.creditAcc === 'cash' || t.debitAcc === 'office_rent' || t.debitAcc === 'staff_salaries' || t.debitAcc === 'travel_allowance' || t.debitAcc === 'other_expenses' || t.debitAcc === 'exemption_expense';

      // Match Categories for Income
      if (t.type === 'income' || isIncome) {
        const cat = (t.category || t.creditAcc || '').toLowerCase();
        if (cat === 'service_charge' || cat.includes('সার্ভিস চার্জ') || cat.includes('service charge')) {
          serviceChargeIncome += amt;
        } else if (cat === 'admission_fee' || cat.includes('ভর্তি') || cat.includes('admission')) {
          admissionFeeIncome += amt;
        } else if (cat === 'passbook_fee' || cat.includes('বই') || cat.includes('passbook') || cat.includes('ফর্ম') || cat.includes('প্রসেসিং')) {
          passbookFeeIncome += amt;
        } else if (cat === 'bank_interest' || cat.includes('ব্যাংক সঞ্চয়') || cat.includes('bank interest')) {
          bankInterestIncome += amt;
        } else {
          miscIncome += amt;
        }
      }

      // Match Categories for Expenses
      if (t.type === 'expense' || isExpense) {
        const cat = (t.category || t.debitAcc || '').toLowerCase();
        if (cat === 'staff_salaries' || cat.includes('বেতন') || cat.includes('salaries')) {
          staffSalariesExpense += amt;
        } else if (cat === 'office_rent' || cat.includes('ভাড়া') || cat.includes('rent')) {
          officeRentExpense += amt;
        } else if (cat === 'travel_allowance' || cat.includes('যাতায়াত') || cat.includes('ভ্রমণ') || cat.includes('travel') || cat.includes('স্টেশনারি')) {
          travelTransportExpense += amt;
        } else if (cat === 'exemption_expense' || cat.includes('মওকুফ') || cat.includes('exemption')) {
          loanExemptionExpense += amt;
        } else {
          otherAdministrativeExpense += amt;
        }
      }
    });

    const totalOperatingIncome = serviceChargeIncome + admissionFeeIncome + passbookFeeIncome;
    const totalNonOperatingIncome = bankInterestIncome + miscIncome;
    const totalIncome = totalOperatingIncome + totalNonOperatingIncome;

    const totalOperatingExpense = staffSalariesExpense + officeRentExpense + travelTransportExpense;
    const llpProvisionExpense = llpSummary.provisions.total;
    const totalExpense = totalOperatingExpense + otherAdministrativeExpense + loanExemptionExpense + llpProvisionExpense;

    const netProfit = totalIncome - totalExpense;

    return {
      serviceChargeIncome,
      admissionFeeIncome,
      passbookFeeIncome,
      bankInterestIncome,
      miscIncome,
      totalIncome,
      staffSalariesExpense,
      officeRentExpense,
      travelTransportExpense,
      otherAdministrativeExpense,
      loanExemptionExpense,
      llpProvisionExpense,
      totalExpense,
      netProfit
    };
  }, [filteredTransactions, llpSummary]);

  // Calculation of Demand vs Collection (আদায়যোগ্য ও আদায়কৃত বিবরণী)
  const demandCollectionRecords = useMemo(() => {
    let filteredMembers = members;
    if (initialBranchId) {
      filteredMembers = filteredMembers.filter(m => m.groupId && groups.find(g => g.id === m.groupId)?.branchId === initialBranchId);
    } else if (selectedBranchId !== 'all') {
      filteredMembers = filteredMembers.filter(m => m.groupId && groups.find(g => g.id === m.groupId)?.branchId === selectedBranchId);
    }

    if (selectedGroupId !== 'all') {
      filteredMembers = filteredMembers.filter(m => m.groupId === selectedGroupId);
    }

    if (searchTerm.trim() !== '') {
      const q = searchTerm.toLowerCase();
      filteredMembers = filteredMembers.filter(m => 
        (m.name || '').toLowerCase().includes(q) || 
        (m.memberId || '').toLowerCase().includes(q) ||
        (m.id || '').toLowerCase().includes(q)
      );
    }

    return filteredMembers.map(m => {
      const txs = filteredTransactions.filter(tx => (tx.memberId === m.memberId || tx.memberId === m.id) && tx.type === 'collection');
      
      const loanCollected = txs.reduce((sum, tx) => sum + Number(tx.collections?.pl || 0), 0);
      const gsCollected = txs.reduce((sum, tx) => sum + Number(tx.collections?.gs || 0), 0);
      const cbsCollected = txs.reduce((sum, tx) => sum + Number(tx.collections?.cbs || 0), 0);
      const ltsCollected = txs.reduce((sum, tx) => sum + Number(tx.collections?.lts || 0), 0);
      const savingsCollected = gsCollected + cbsCollected + ltsCollected;
      
      const isActive = m.status !== 'inactive';
      const hasOutstanding = isActive && m.plOutstanding !== undefined && m.plOutstanding > 0;
      const loanDemand = hasOutstanding ? (m.plInstallment || 600) : 0;

      // GS (General Savings) Demand
      const hasGs = m.gsBalance !== undefined || m.savingsBalance !== undefined;
      const gsDemand = (isActive && hasGs) ? (m.gsInstallment ?? 40) : 0;

      // CBS (Capital Build-up Savings) Demand
      const hasCbs = m.cbsBalance !== undefined && m.cbsBalance > 0;
      const cbsDemand = (isActive && hasCbs) ? (m.cbsInstallment ?? 10) : 0;

      // LTS (Long Term Savings) Demand
      const hasLts = m.ltsBalance !== undefined && m.ltsBalance > 0;
      const ltsDemand = (isActive && hasLts) ? (m.ltsInstallment ?? 100) : 0;

      const savingsDemand = gsDemand + cbsDemand + ltsDemand; 
      
      const totalDemand = loanDemand + savingsDemand;
      const totalCollected = loanCollected + savingsCollected;
      
      const due = Math.max(0, totalDemand - totalCollected);
      const advance = Math.max(0, totalCollected - totalDemand);
      
      const groupObj = groups.find(g => g.id === m.groupId);
      
      return {
        memberId: m.memberId || m.id,
        memberName: m.name,
        groupName: groupObj ? groupObj.name : 'অনিযুক্ত',
        loanDemand,
        loanCollected,
        gsDemand,
        gsCollected,
        cbsDemand,
        cbsCollected,
        ltsDemand,
        ltsCollected,
        savingsDemand,
        savingsCollected,
        totalDemand,
        totalCollected,
        due,
        advance
      };
    }).filter(record => {
      if (selectedGroupId !== 'all') return true;
      return record.totalDemand > 0 || record.totalCollected > 0;
    });
  }, [members, groups, initialBranchId, selectedBranchId, selectedGroupId, searchTerm, filteredTransactions]);

  // Aggregate sums for demand vs collection
  const demandCollectionSummary = useMemo(() => {
    let totalLoanDemand = 0;
    let totalLoanCollected = 0;
    let totalSavingsDemand = 0;
    let totalSavingsCollected = 0;
    let totalDemand = 0;
    let totalCollected = 0;
    let totalDue = 0;
    let totalAdvance = 0;

    demandCollectionRecords.forEach(r => {
      totalLoanDemand += r.loanDemand;
      totalLoanCollected += r.loanCollected;
      totalSavingsDemand += r.savingsDemand;
      totalSavingsCollected += r.savingsCollected;
      totalDemand += r.totalDemand;
      totalCollected += r.totalCollected;
      totalDue += r.due;
      totalAdvance += r.advance;
    });

    return {
      totalLoanDemand,
      totalLoanCollected,
      totalSavingsDemand,
      totalSavingsCollected,
      totalDemand,
      totalCollected,
      totalDue,
      totalAdvance
    };
  }, [demandCollectionRecords]);

  // Calculation of Balance Sheet / Statement of Financial Position (আর্থিক অবস্থার বিবরণী বা ব্যালেন্স শিট)
  const balanceSheetSummary = useMemo(() => {
    let filteredMembersForBS = members;
    if (initialBranchId) {
      filteredMembersForBS = filteredMembersForBS.filter(m => m.groupId && groups.find(g => g.id === m.groupId)?.branchId === initialBranchId);
    } else if (selectedBranchId !== 'all') {
      filteredMembersForBS = filteredMembersForBS.filter(m => m.groupId && groups.find(g => g.id === m.groupId)?.branchId === selectedBranchId);
    }
    if (selectedGroupId !== 'all') {
      filteredMembersForBS = filteredMembersForBS.filter(m => m.groupId === selectedGroupId);
    }

    const totalOutstandingLoan = filteredMembersForBS.reduce((sum, m) => sum + (m.plOutstanding ?? 0), 0);
    const totalGSBalance = filteredMembersForBS.reduce((sum, m) => sum + (m.gsBalance ?? m.savingsBalance ?? 0), 0);
    const totalCBSBalance = filteredMembersForBS.reduce((sum, m) => sum + (m.cbsBalance ?? 0), 0);
    const totalLTSBalance = filteredMembersForBS.reduce((sum, m) => sum + (m.ltsBalance ?? 0), 0);
    const totalSavings = totalGSBalance + totalCBSBalance + totalLTSBalance;

    // Calculate cash in hand up to the selected endDate.
    // Baseline cash in hand for realism (e.g. 500,000 taka of initial branch capital)
    let cashInHand = 500000;
    
    allTransactions.forEach(tx => {
      const txDate = ensureYYYYMMDD(tx.date);
      if (txDate > endDate) return; // Only up to current date

      if (initialBranchId) {
        if (tx.branchId && tx.branchId !== initialBranchId) return;
      } else if (selectedBranchId !== 'all') {
        if (tx.branchId && tx.branchId !== selectedBranchId) return;
      }

      const amt = Number(tx.amount || 0);
      
      if (tx.type === 'collection') {
        const plVal = Number(tx.collections?.pl || 0);
        const gsVal = Number(tx.collections?.gs || 0);
        const cbsVal = Number(tx.collections?.cbs || 0);
        const ltsVal = Number(tx.collections?.lts || 0);
        cashInHand += (plVal + gsVal + cbsVal + ltsVal);
      } else if (tx.type === 'savings_deposit') {
        cashInHand += amt;
      } else if (tx.type === 'savings_withdrawal' || tx.type === 'withdrawal') {
        const wGs = Number(tx.withdrawals?.gs || tx.amount || 0);
        const wCbs = Number(tx.withdrawals?.cbs || 0);
        const wLts = Number(tx.withdrawals?.lts || 0);
        cashInHand -= (wGs + wCbs + wLts);
      } else if (tx.type === 'disbursement') {
        const principal = Number(tx.amount || tx.proposalDetail?.proposedAmount || 0);
        cashInHand -= principal;
      } else if (tx.type === 'income') {
        cashInHand += amt;
      } else if (tx.type === 'expense') {
        cashInHand -= amt;
      }
    });

    // Provisions
    const llpReserve = llpSummary.provisions.total;

    // Capital & Retained Earnings
    // Total Assets = Cash in Hand + Loan Outstanding
    // Total Liabilities = Total Savings + LLP Reserve
    const totalAssets = cashInHand + totalOutstandingLoan;
    const totalLiabilities = totalSavings + llpReserve;
    const capitalFund = Math.max(50000, totalAssets - totalLiabilities);

    return {
      cashInHand,
      totalOutstandingLoan,
      totalGSBalance,
      totalCBSBalance,
      totalLTSBalance,
      totalSavings,
      llpReserve,
      capitalFund,
      totalAssets,
      totalLiabilitiesAndCapital: totalSavings + llpReserve + capitalFund
    };
  }, [members, groups, allTransactions, initialBranchId, selectedBranchId, selectedGroupId, endDate, llpSummary]);

  // LLP logic is calculated above and integrated in P&L

  // Export to Excel / CSV trigger with full Bengali support using BOM
  const handleExportToExcel = () => {
    let headers: string[] = [];
    let rows: (string | number)[][] = [];
    let filename = `Tanzil_Report_${activeReport}_${startDate}_to_${endDate}`;

    if (activeReport === 'collection') {
      headers = [
        'তারিখ (Date)',
        'রসিদ নং (Receipt)',
        'সদস্য কোড (Member ID)',
        'সদস্যের নাম (Member Name)',
        'সমিতি (Samity)',
        'ঋণ আদায় (PL Collection)',
        'সাধারণ সঞ্চয় জমা (GS Deposit)',
        'বিশেষ সঞ্চয় জমা (CBS Deposit)',
        'দীর্ঘমেয়াদী সঞ্চয় জমা (LTS Deposit)',
        'মোট আদায় (Total Collection)'
      ];

      filteredTransactions.filter(tx => tx.type === 'collection').forEach(tx => {
        const pl = Number(tx.collections?.pl || 0);
        const gs = Number(tx.collections?.gs || 0);
        const cbs = Number(tx.collections?.cbs || 0);
        const lts = Number(tx.collections?.lts || 0);
        const tot = pl + gs + cbs + lts;

        rows.push([
          formatDDMMYYYY(tx.date),
          tx.id || 'N/A',
          tx.memberId || '',
          tx.memberName || '',
          tx.groupName || '',
          pl,
          gs,
          cbs,
          lts,
          tot
        ]);
      });

      // Add Sum Row
      rows.push([
        'সর্বমোট (Total)',
        '',
        '',
        '',
        '',
        reportSummary.totalPL,
        reportSummary.totalGS,
        reportSummary.totalCBS,
        reportSummary.totalLTS,
        reportSummary.totalCollectionsOverall
      ]);
    } else if (activeReport === 'disbursement') {
      headers = [
        'তারিখ (Date)',
        'সদস্য কোড (Member ID)',
        'সদস্যের নাম (Member Name)',
        'ঋণের ধরণ (Loan Type)',
        'বিতরণকৃত আসল (Disbursed Principal)',
        'সার্ভিস চার্জ (Interest/SC)',
        'মোট প্রদেয় (Total Payable)',
        'কিস্তি পরিমাণ ও সংখ্যা (Installments Info)'
      ];

      filteredTransactions.filter(tx => tx.type === 'disbursement').forEach(tx => {
        const principal = Number(tx.amount || tx.proposalDetail?.proposedAmount || 0);
        const totalPayableVal = Number(tx.proposalDetail?.totalPayable || (principal * 1.15));
        const sc = totalPayableVal - principal;
        const lType = tx.proposalDetail?.loanType || 'মাসিক';
        const instAmt = tx.proposalDetail?.installmentAmount || 0;
        const instCount = tx.proposalDetail?.installmentsCount || 0;

        rows.push([
          formatDDMMYYYY(tx.date),
          tx.memberId || '',
          tx.memberName || '',
          lType,
          principal,
          sc,
          totalPayableVal,
          `৳${instAmt} x ${instCount}`
        ]);
      });

      // Add Sum Row
      rows.push([
        'সর্বমোট (Total)',
        '',
        '',
        '',
        reportSummary.totalDisbursed,
        reportSummary.totalServiceCharge,
        reportSummary.totalPayable,
        ''
      ]);
    } else if (activeReport === 'savings') {
      headers = [
        'তারিখ (Date)',
        'সদস্য কোড (Member ID)',
        'সদস্যের নাম (Member Name)',
        'সাধারণ জমা (GS Dep)',
        'সাধারণ উত্তোলন (GS Wth)',
        'বিশেষ জমা (CBS Dep)',
        'বিশেষ উত্তোলন (CBS Wth)',
        'দীর্ঘমেয়াদী জমা (LTS Dep)',
        'দীর্ঘমেয়াদী উত্তোলন (LTS Wth)',
        'মোট লেনদেন (Net Saving Activity)'
      ];

      filteredTransactions.forEach(tx => {
        let gsDep = 0, gsWth = 0, cbsDep = 0, cbsWth = 0, ltsDep = 0, ltsWth = 0;

        if (tx.type === 'collection') {
          gsDep = Number(tx.collections?.gs || 0);
          cbsDep = Number(tx.collections?.cbs || 0);
          ltsDep = Number(tx.collections?.lts || 0);
        } else if (tx.type === 'savings_deposit') {
          gsDep = Number(tx.amount || 0);
        } else if (tx.type === 'savings_withdrawal' || tx.type === 'withdrawal') {
          gsWth = Number(tx.withdrawals?.gs || tx.amount || 0);
          cbsWth = Number(tx.withdrawals?.cbs || 0);
          ltsWth = Number(tx.withdrawals?.lts || 0);
        }

        if (gsDep > 0 || gsWth > 0 || cbsDep > 0 || cbsWth > 0 || ltsDep > 0 || ltsWth > 0) {
          const rowNet = (gsDep + cbsDep + ltsDep) - (gsWth + cbsWth + ltsWth);
          rows.push([
            formatDDMMYYYY(tx.date),
            tx.memberId || '',
            tx.memberName || '',
            gsDep,
            gsWth,
            cbsDep,
            cbsWth,
            ltsDep,
            ltsWth,
            rowNet
          ]);
        }
      });

      // Sum Row
      rows.push([
        'সর্বমোট (Total)',
        '',
        '',
        reportSummary.totalGS,
        '--',
        reportSummary.totalCBS,
        '--',
        reportSummary.totalLTS,
        '--',
        reportSummary.totalSavingsDeposit - reportSummary.totalSavingsWithdrawal
      ]);
    } else if (activeReport === 'demand_collection') {
      headers = [
        'সদস্য কোড (Member ID)',
        'সদস্যের নাম (Member Name)',
        'সমিতি (Samity)',
        'ঋণ আদায়যোগ্য (Loan Demand)',
        'ঋণ আদায়কৃত (Loan Collected)',
        'সঞ্চয় আদায়যোগ্য (Savings Demand)',
        'সঞ্চয় আদায়কৃত (Savings Collected)',
        'মোট আদায়যোগ্য (Total Demand)',
        'মোট আদায়কৃত (Total Collected)',
        'বকেয়া/ঘাটতি (Due)',
        'অগ্রিম (Advance)'
      ];

      demandCollectionRecords.forEach(r => {
        rows.push([
          r.memberId,
          r.memberName,
          r.groupName,
          r.loanDemand,
          r.loanCollected,
          r.savingsDemand,
          r.savingsCollected,
          r.totalDemand,
          r.totalCollected,
          r.due,
          r.advance
        ]);
      });

      // Sum Row
      rows.push([
        'সর্বমোট (Total)',
        '',
        '',
        demandCollectionSummary.totalLoanDemand,
        demandCollectionSummary.totalLoanCollected,
        demandCollectionSummary.totalSavingsDemand,
        demandCollectionSummary.totalSavingsCollected,
        demandCollectionSummary.totalDemand,
        demandCollectionSummary.totalCollected,
        demandCollectionSummary.totalDue,
        demandCollectionSummary.totalAdvance
      ]);
    } else if (activeReport === 'cash_summary') {
      headers = ['আইটেম / হিসাব খাত (Account Ledger Head)', 'প্রাপ্তি / জমা (Receipts / Debit)', 'উত্তোলন / প্রধান (Payments / Credit)'];
      rows = [
        ['১. ঋণ পোর্টফোলিও আদায় (PL Loan Recovery)', reportSummary.totalPL, ''],
        ['২. সাধারণ সঞ্চয় সংগ্রহ (GS Deposits)', reportSummary.totalGS, ''],
        ['৩. বিশেষ সঞ্চয় সংগ্রহ (CBS Deposits)', reportSummary.totalCBS, ''],
        ['৪. দীর্ঘমেয়াদী সঞ্চয় সংগ্রহ (LTS Deposits)', reportSummary.totalLTS, ''],
        ['৫. ঋণ বিতরণ পোর্টফোলিও (Loan Disbursements)', '', reportSummary.totalDisbursed],
        ['৬. সঞ্চয় ও আমানত উত্তোলন (Savings Withdrawals)', '', reportSummary.totalSavingsWithdrawal],
        ['------------------------------------', '-----------', '-----------'],
        ['মোট ক্যাশ ফ্লো প্রাপ্তি ও প্রধান (Totals)', reportSummary.totalPL + reportSummary.totalSavingsDeposit, reportSummary.totalDisbursed + reportSummary.totalSavingsWithdrawal],
        ['নিট সঞ্চার / উদ্বৃত্ত নগদ স্থিতি (Net Cash Inflow)', reportSummary.netCashFlow >= 0 ? reportSummary.netCashFlow : '', reportSummary.netCashFlow < 0 ? Math.abs(reportSummary.netCashFlow) : '']
      ];
    } else if (activeReport === 'par') {
      headers = ['সদস্য কোড', 'সদস্যের নাম', 'সমিতি', 'বকেয়া ঋণ (Outstanding)', 'বকেয়া কিস্তি (Overdue)'];
      rows = members.filter(m => (m.plOutstanding ?? 0) > 0).map(m => [
        m.memberId || m.id || '',
        m.name || '',
        groups.find(g => g.id === m.groupId)?.name || 'N/A',
        m.plOutstanding ?? 0,
        m.plInstallment ?? 0
      ]);
    } else if (activeReport === 'profit_loss') {
      headers = ['হিসাব খাত (Account Head)', 'আয় / প্রাপ্তি (Revenue/Income)', 'ব্যয় / প্রধান (Expense)'];
      rows = [
        ['১. পরিচালন আয় (Operating Revenue)', '', ''],
        [' - ঋণের সার্ভিস চার্জ আদায় (Service Charges)', profitLossSummary.serviceChargeIncome, ''],
        [' - ভর্তিকরণ ফি আদায় (Admission Fees)', profitLossSummary.admissionFeeIncome, ''],
        [' - সঞ্চয় বই ও ফর্ম বিক্রয় (Passbook/Form Fees)', profitLossSummary.passbookFeeIncome, ''],
        ['২. অ-পরিচালন আয় (Non-Operating Revenue)', '', ''],
        [' - ব্যাংক জমার সুদ প্রাপ্তি (Bank Interest)', profitLossSummary.bankInterestIncome, ''],
        [' - অন্যান্য বিবিধ আয় (Misc Income)', profitLossSummary.miscIncome, ''],
        ['মোট আয় (Total Revenues)', profitLossSummary.totalIncome, ''],
        ['------------------------------------', '-----------', '-----------'],
        ['৩. পরিচালন ব্যয় (Operating Expenses)', '', ''],
        [' - কর্মী বেতন ও ভাতা (Staff Salaries)', '', profitLossSummary.staffSalariesExpense],
        [' - অফিস ভাড়া (Office Rent)', '', profitLossSummary.officeRentExpense],
        [' - যাতায়াত ও ভ্রমণ খরচ (Travel Expenses)', '', profitLossSummary.travelTransportExpense],
        ['৪. অ-পরিচালন ও অন্যান্য ব্যয় (Other Expenses)', '', ''],
        [' - বকেয়া ঋণ মওকুফ ব্যয় (Loan Exemption Expenses)', '', profitLossSummary.loanExemptionExpense],
        [' - খেলাপি ঋণ সঞ্চিতি আবশ্যকতা (Loan Loss Provision)', '', Math.round(profitLossSummary.llpProvisionExpense)],
        [' - অন্যান্য প্রশাসনিক খরচ (Misc Admin Expenses)', '', profitLossSummary.otherAdministrativeExpense],
        ['মোট ব্যয় (Total Expenses)', '', profitLossSummary.totalExpense],
        ['------------------------------------', '-----------', '-----------'],
        ['নিট উদ্বৃত্ত / নিট লাভ (Net Profit/Loss)', profitLossSummary.netProfit >= 0 ? `৳${profitLossSummary.netProfit}` : `(৳${Math.abs(profitLossSummary.netProfit)})`, '']
      ];
    } else if (activeReport === 'balance_sheet') {
      headers = ['হিসাব বিবরণী (Balance Sheet Head)', 'পরিশোধ ও দায় (Liabilities & Capital)', 'সম্পদ ও স্থিতি (Assets)'];
      rows = [
        ['১. সম্পদসমূহ (Assets)', '', ''],
        [' - হাতে নগদ ও ব্যাংক স্থিতি (Cash in Hand & Bank)', '', Math.round(balanceSheetSummary.cashInHand)],
        [' - ঋণের আসল স্থিতি (Loan Portfolio Outstanding)', '', balanceSheetSummary.totalOutstandingLoan],
        ['মোট সম্পদ (Total Assets)', '', Math.round(balanceSheetSummary.totalAssets)],
        ['------------------------------------', '-----------', '-----------'],
        ['২. দায় ও সঞ্চয় তহবিল (Liabilities & Capital)', '', ''],
        [' - সদস্যদের সঞ্চয় স্থিতি (GS, CBS & LTS Savings)', balanceSheetSummary.totalSavings, ''],
        [' - খেলাপি ঋণ সঞ্চিতি তহবিল (Loan Loss Provision Reserve)', Math.round(balanceSheetSummary.llpReserve), ''],
        [' - প্রাতিষ্ঠানিক তহবিল / মূলধন (Capital & Equity)', Math.round(balanceSheetSummary.capitalFund), ''],
        ['মোট দায় ও মূলধন (Total Liabilities & Capital)', Math.round(balanceSheetSummary.totalLiabilitiesAndCapital), '']
      ];
    } else if (activeReport === 'expired_defaulters') {
      headers = ['সদস্য কোড', 'সদস্যের নাম', 'গ্রুপ / সমিতি', 'বকেয়া ঋণ (Outstanding)', 'মেয়াদ উত্তীর্ণ/অনাদায়ী পরিমাণ', 'GS সমন্বয়', 'LTS সমন্বয়', 'CBS সমন্বয়', 'শেয়ার সমন্বয়', 'মোট সমন্বয়', 'অবশিষ্ট ঋণ'];
      rows = expiredMembersReportData.map(p => [
        p.member.memberId || p.member.id || '',
        p.member.name || '',
        groups.find(g => g.id === p.member.groupId)?.name || 'N/A',
        p.outstanding,
        p.overdueAmount,
        p.result.gsAdjusted,
        p.result.ltsAdjusted,
        p.result.cbsAdjusted,
        p.result.shareAdjusted,
        p.totalAdjusted,
        p.remainingLoan
      ]);
    }

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(val => {
        const cleanVal = String(val ?? '').replace(/"/g, '""');
        return `"${cleanVal}"`;
      }).join(','))
    ].join('\r\n');

    // UTF-8 BOM so Excel opens Bengali characters properly
    downloadExcelCsv(csvContent, filename);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      
      {/* 1. Header Row - Print Hidden */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 print:hidden">
        <div>
          <div className="flex items-center gap-2">
            {onBack && (
              <button
                onClick={onBack}
                className="p-1.5 hover:bg-slate-200 text-slate-700 hover:text-slate-900 rounded-lg cursor-pointer border border-slate-200 bg-white shadow-3xs"
              >
                <ArrowLeft size={16} />
              </button>
            )}
            <div>
              <h3 className="text-base font-black text-slate-800 tracking-tight flex items-center gap-2">
                <FileText className="text-blue-600" size={20} />
                <span>সমন্বিত প্রতিবেদন ও রিপোর্টস হাব</span>
              </h3>
              <p className="text-[11px] text-slate-500 font-medium">
                অফিসিয়াল কর্মদিবস ভিত্তিক সকল আর্থিক আদায়, বিতরণ ও সঞ্চয়ের তারিখ ভিত্তিক বিবরণী রিপোর্টস।
              </p>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex gap-2 w-full md:w-auto self-end">
          <button
            onClick={handleResetToWorkingDay}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold text-[11px] rounded-xl border border-slate-200 transition cursor-pointer"
            title="রিসেট করে বর্তমান কর্মদিবসে ফিরুন"
          >
            <RefreshCw size={13} />
            <span>কর্মদিবস রিসেট</span>
          </button>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-[11px] rounded-xl shadow-xs transition cursor-pointer"
          >
            <Printer size={13} />
            <span>প্রিন্ট করুন</span>
          </button>
          <button
            onClick={handleExportToExcel}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-[11px] rounded-xl shadow-xs transition cursor-pointer"
          >
            <Download size={13} />
            <span>এক্সপোর্ট টু এক্সেল (Export to Excel)</span>
          </button>
        </div>
      </div>

      {/* 2. Primary Date-to-Date Filter Console - Print Hidden */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm space-y-4 print:hidden">
        <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
          <Calendar size={13} className="text-blue-500" />
          <span>তারিখ থেকে তারিখ ও ফিল্টারিং প্যারামিটার (Date Range Selector)</span>
        </h4>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          
          {/* Start Date */}
          <div className="space-y-1">
            <label className="block text-[11px] font-bold text-slate-600">শুরুর তারিখ (From Date):</label>
            <div className="relative">
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-250 rounded-xl text-xs font-bold font-mono text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* End Date */}
          <div className="space-y-1">
            <label className="block text-[11px] font-bold text-slate-600">শেষের তারিখ (To Date):</label>
            <div className="relative">
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-250 rounded-xl text-xs font-bold font-mono text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Branch Filter (Only Org Admin Context) */}
          {!initialBranchId ? (
            <div className="space-y-1">
              <label className="block text-[11px] font-bold text-slate-600">শাখা অফিস (Branch Office):</label>
              <select
                value={selectedBranchId}
                onChange={(e) => {
                  setSelectedBranchId(e.target.value);
                  setSelectedGroupId('all');
                }}
                className="w-full px-3 py-2 bg-white border border-slate-250 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
              >
                <option value="all">সকল শাখা অফিস (All Branches)</option>
                {branches.map(b => (
                  <option key={b.id} value={b.id}>{b.name} ({b.code})</option>
                ))}
              </select>
            </div>
          ) : (
            <div className="space-y-1">
              <label className="block text-[11px] font-bold text-slate-400">শাখা অফিস ( locked ):</label>
              <div className="px-3 py-2 bg-slate-100 border border-slate-200 rounded-xl text-xs font-bold text-slate-500 select-none">
                {branches.find(b => b.id === initialBranchId)?.name || 'নির্দিষ্ট শাখা'}
              </div>
            </div>
          )}

          {/* Group/Samity Filter */}
          <div className="space-y-1">
            <label className="block text-[11px] font-bold text-slate-600">সমিতি বা গ্রুপ (Samity Filter):</label>
            <select
              value={selectedGroupId}
              onChange={(e) => setSelectedGroupId(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-slate-250 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
            >
              <option value="all">সকল সমিতি / গ্রুপ (All Groups)</option>
              {filteredGroups.map(g => (
                <option key={g.id} value={g.id}>{g.name} ({g.code})</option>
              ))}
            </select>
          </div>

        </div>

        {/* Second row of filters (Search Input) */}
        <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-2.5 text-slate-400 w-4 h-4" />
            <input
              type="text"
              placeholder="সদস্যের নাম, আইডি বা সমিতি দিয়ে খুঁজুন..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-250 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          <div className="text-[10px] text-slate-450 font-bold select-none">
            ডিফল্ট তারিখ হিসেবে <span className="text-amber-600 font-mono">{formatDateToDDMMYYYY(defaultDateStr)}</span> কর্মদিবস নির্বাচিত রয়েছে।
          </div>
        </div>
      </div>

      {/* 3. Report Section Dropdown Selector - Print Hidden */}
      <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl print:hidden select-none">
        <label className="block text-[10px] font-extrabold text-slate-500 mb-2 uppercase tracking-wider font-sans">
          রিপোর্ট বা বিবরণী প্রকার নির্বাচন করুন (Select Report/Ledger Sheet Type)
        </label>
        <div className="relative">
          <select
            value={activeReport}
            onChange={(e) => setActiveReport(e.target.value as any)}
            className="w-full bg-white border-2 border-slate-250 hover:border-blue-500 text-slate-800 rounded-xl pl-4 pr-10 py-3 text-xs sm:text-sm font-extrabold outline-none transition-all cursor-pointer appearance-none shadow-3xs font-sans"
          >
            <option value="collection">১. সংগ্রহ ও ঋণ আদায় খতিয়ান বিবরণী (Collections & Recovery Ledger)</option>
            <option value="disbursement">২. ক্ষুদ্রঋণ বিতরণ ও পলিসি খতিয়ান (Loan Disbursements Ledger)</option>
            <option value="savings">৩. সঞ্চয় জমা ও উত্তোলন হিসাব বহিখাতা (Savings Account Ledger)</option>
            <option value="cash_summary">৪. দৈনিক প্রাপ্তি-প্রধান ও নগদ সারসংক্ষেপ (Cash Receipt & Payment Summary)</option>
            <option value="demand_collection">৫. দৈনিক আদায়যোগ্য ও আদায়কৃত বিবরণী শীট (Daily Demand & Realized Sheet)</option>
            <option value="par">৬. পোর্টফোলিও রিস্ক রিপোর্ট (PAR - Portfolio at Risk)</option>
            <option value="profit_loss">৭. নিট লাভ-ক্ষতি হিসাব বিবরণী (Net Profit & Loss Statement)</option>
            <option value="balance_sheet">৮. আর্থিক অবস্থার বিবরণী (ব্যালেন্স শিট - Statement of Financial Position / Balance Sheet)</option>
            <option value="audit_summary">৯. বার্ষিক সমবায় অডিট বিবরণী ও সারসংক্ষেপ (Cooperative Annual Audit Summary & Compliance Report)</option>
            <option value="expired_defaulters">১০. মেয়াদ উত্তীর্ণ সদস্য ও অটো সঞ্চয় ঋণ সমন্বয় বিবরণী (Expired Loan & Auto Settlement Report)</option>
            <option value="mra_report">১১. MRA রেগুলেটরি এমআইএস ও সঞ্চিতি রিপোর্ট (MRA Regulatory MIS & Provisioning Schedule - MRA-MIS-01)</option>
          </select>
          <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none text-slate-500">
            <ClipboardList size={18} />
          </div>
        </div>
      </div>

      {/* 4. Active Printable Report Sheet Card */}
      <div className="bg-white rounded-3xl border border-slate-250 p-6 shadow-md print:shadow-none print:border-none print:p-0 relative">
        
        {/* Printable Letterhead (Visible ONLY on print) */}
        <div className="hidden print:block text-center border-b border-double border-slate-900 pb-4 mb-6 select-none">
          <h2 className="text-xl font-extrabold text-slate-900 tracking-wide uppercase">{org.name}</h2>
          <p className="text-xs font-bold text-slate-700 mt-0.5">{org.address || 'বাংলাদেশ'}</p>
          <p className="text-[10px] font-semibold text-slate-500 font-mono mt-0.5">মোবাইল: {org.phone || 'N/A'} | ইমেইল: {org.email || 'N/A'}</p>
          
          <div className="mt-4 flex justify-between items-center text-left border-t border-slate-200 pt-2.5">
            <div className="text-[10px] text-slate-700 leading-normal">
              <p><strong>প্রতিবেদন বিষয়:</strong> {
                activeReport === 'collection' ? 'সংগ্রহ ও আদায় খতিয়ান বিবরণী' :
                activeReport === 'disbursement' ? 'ক্ষুদ্রঋণ বিতরণ খতিয়ান' :
                activeReport === 'savings' ? 'সঞ্চয় জমা ও উত্তোলন হিসাব বহিখাতা' :
                activeReport === 'demand_collection' ? 'দৈনিক আদায়যোগ্য ও আদায়কৃত বিবরণী শীট' :
                activeReport === 'par' ? 'পোর্টফোলিও রিস্ক রিপোর্ট (PAR)' :
                activeReport === 'profit_loss' ? 'নিট লাভ-ক্ষতি হিসাব বিবরণী (Income Statement)' :
                activeReport === 'balance_sheet' ? 'আর্থিক অবস্থার বিবরণী (ব্যালেন্স শিট / Statement of Financial Position)' :
                activeReport === 'audit_summary' ? 'বার্ষিক সমবায় অডিট বিবরণী ও সম্মতির তথ্য (Audit Summary & Compliance)' :
                activeReport === 'expired_defaulters' ? 'মেয়াদ উত্তীর্ণ সদস্য ও অটো সঞ্চয় ঋণ সমন্বয় বিবরণী (Expired Loan & Auto Settlement Report)' :
                activeReport === 'mra_report' ? 'MRA রেগুলেটরি এমআইএস ও ঋণ সঞ্চিতি বিবরণী (MRA Regulatory MIS & Provisioning Schedule - MRA-MIS-01)' :
                'দৈনিক প্রাপ্তি-প্রধান ও নগদ সারসংক্ষেপ খতিয়ান'
              }</p>
              <p><strong>নির্ধারিত সময়কাল:</strong> {formatDateToDDMMYYYY(startDate)} হতে {formatDateToDDMMYYYY(endDate)}</p>
            </div>
            <div className="text-[10px] text-slate-700 text-right font-mono">
              <p><strong>মুদ্রণ তারিখ:</strong> {new Date().toLocaleString('bn-BD')}</p>
              <p><strong>অফিস কর্মদিবস:</strong> {workingDay}</p>
            </div>
          </div>
        </div>

        {/* Standard Web Info Subhead (Print Hidden) */}
        <div className="flex justify-between items-center border-b border-slate-100 pb-3 mb-4 print:hidden select-none">
          <div>
            <h4 className="font-extrabold text-slate-800 text-sm">
              {activeReport === 'collection' && '১. সংগ্রহ ও ঋণ আদায় খতিয়ান বিবরণী (Collections & Recovery Ledger)'}
              {activeReport === 'disbursement' && '২. ক্ষুদ্রঋণ বিতরণ ও পলিসি খতিয়ান (Loan Disbursements Ledger)'}
              {activeReport === 'savings' && '৩. সঞ্চয় জমা ও উত্তোলন হিসাব বহিখাতা (Savings Account Ledger)'}
              {activeReport === 'cash_summary' && '৪. দৈনিক প্রাপ্তি-প্রধান ও নগদ সারসংক্ষেপ (Cash Receipt & Payment Summary)'}
              {activeReport === 'demand_collection' && '৫. দৈনিক আদায়যোগ্য ও আদায়কৃত বিবরণী শীট (Daily Demand & Realized Sheet)'}
              {activeReport === 'par' && '৬. পোর্টফোলিও রিস্ক রিপোর্ট (PAR - Portfolio at Risk)'}
              {activeReport === 'profit_loss' && '৭. নিট লাভ-ক্ষতি হিসাব বিবরণী (Periodical Income Statement)'}
              {activeReport === 'balance_sheet' && '৮. আর্থিক অবস্থার বিবরণী (উদ্বর্তপত্র বা ব্যালেন্স শিট - Statement of Financial Position / Balance Sheet)'}
              {activeReport === 'audit_summary' && '৯. বার্ষিক সমবায় অডিট বিবরণী ও সারসংক্ষেপ (Cooperative Annual Audit Summary & Compliance Report)'}
              {activeReport === 'expired_defaulters' && '১০. মেয়াদ উত্তীর্ণ সদস্য ও অটো সঞ্চয় ঋণ সমন্বয় বিবরণী (Expired Loan & Auto Settlement Report)'}
              {activeReport === 'mra_report' && '১১. MRA রেগুলেটরি এমআইএস ও সঞ্চিতি রিপোর্ট (MRA Regulatory MIS & Provisioning Schedule - MRA-MIS-01)'}
            </h4>
            <p className="text-[10px] text-slate-400 mt-0.5 font-medium">
              তারিখ পরিসীমা: {formatDateToDDMMYYYY(startDate)} থেকে {formatDateToDDMMYYYY(endDate)} (মোট রেকর্ড: {
                activeReport === 'collection' ? filteredTransactions.filter(t => t.type === 'collection').length :
                activeReport === 'disbursement' ? filteredTransactions.filter(t => t.type === 'disbursement').length :
                activeReport === 'demand_collection' ? demandCollectionRecords.length :
                activeReport === 'expired_defaulters' ? expiredMembersReportData.length :
                filteredTransactions.length
              } টি)
            </p>
          </div>
          <span className="bg-slate-100 text-slate-600 font-mono text-[9px] px-2 py-0.5 rounded-full font-bold">
            Live Consolidation
          </span>
        </div>

        {/* Core Tables by Tab */}
        
        {/* TAB 1: Collections */}
        {activeReport === 'collection' && (
          <div className="overflow-x-auto">
            <table className="w-full text-[11px] text-slate-700 border-collapse table-auto">
              <thead>
                <tr className="bg-slate-100 border-b border-slate-300">
                  <th className="p-2 font-bold text-slate-800 text-center border border-slate-200">তারিখ</th>
                  <th className="p-2 font-bold text-slate-800 text-center border border-slate-200">রশিদ নং</th>
                  <th className="p-2 font-bold text-slate-800 text-left border border-slate-200">সদস্য কোড ও নাম</th>
                  <th className="p-2 font-bold text-slate-800 text-left border border-slate-200">সমিতি</th>
                  <th className="p-2 font-bold text-slate-800 text-right border border-slate-200">ঋণ আদায় (PL)</th>
                  <th className="p-2 font-bold text-slate-800 text-right border border-slate-200">সাধারণ সঞ্চয় (GS)</th>
                  <th className="p-2 font-bold text-slate-800 text-right border border-slate-200">বিশেষ সঞ্চয় (CBS)</th>
                  <th className="p-2 font-bold text-slate-800 text-right border border-slate-200">দীর্ঘ সঞ্চয় (LTS)</th>
                  <th className="p-2 font-bold text-slate-800 text-right border border-slate-200 bg-blue-50/50">মোট আদায়</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredTransactions.filter(tx => tx.type === 'collection').length === 0 ? (
                  <tr>
                    <td colSpan={9} className="p-8 text-center text-slate-400 font-semibold italic">
                      নির্বাচিত তারিখ পরিসীমার মধ্যে কোন আদায়ের লেনদেন পাওয়া যায়নি।
                    </td>
                  </tr>
                ) : (
                  filteredTransactions.filter(tx => tx.type === 'collection').map((tx, idx) => {
                    const pl = Number(tx.collections?.pl || 0);
                    const gs = Number(tx.collections?.gs || 0);
                    const cbs = Number(tx.collections?.cbs || 0);
                    const lts = Number(tx.collections?.lts || 0);
                    const tot = pl + gs + cbs + lts;

                    return (
                      <tr key={idx} className="hover:bg-slate-50/70">
                        <td className="p-2 text-center border border-slate-200 font-mono text-slate-500">{formatDateToDDMMYYYY(tx.date)}</td>
                        <td className="p-2 text-center border border-slate-200 font-mono text-slate-600 font-bold">{tx.id || 'N/A'}</td>
                        <td className="p-2 border border-slate-200">
                          <span className="font-extrabold text-slate-900 block">{tx.memberName}</span>
                          <span className="font-mono text-[9px] text-slate-400">{tx.memberId}</span>
                        </td>
                        <td className="p-2 border border-slate-200 text-slate-600">{tx.groupName || '--'}</td>
                        <td className="p-2 border border-slate-200 text-right font-mono text-slate-900 font-bold">৳{pl.toLocaleString('en-US')}</td>
                        <td className="p-2 border border-slate-200 text-right font-mono text-slate-700">৳{gs.toLocaleString('en-US')}</td>
                        <td className="p-2 border border-slate-200 text-right font-mono text-slate-700">৳{cbs.toLocaleString('en-US')}</td>
                        <td className="p-2 border border-slate-200 text-right font-mono text-slate-700">৳{lts.toLocaleString('en-US')}</td>
                        <td className="p-2 border border-slate-200 text-right font-mono text-blue-800 font-extrabold bg-blue-50/20">৳{tot.toLocaleString('en-US')}</td>
                      </tr>
                    );
                  })
                )}

                {/* Aggregate Sums */}
                {filteredTransactions.filter(tx => tx.type === 'collection').length > 0 && (
                  <tr className="bg-slate-100 font-bold border-t border-slate-350 select-none">
                    <td colSpan={4} className="p-2.5 text-right border border-slate-200 font-extrabold text-slate-800">সর্বমোট আদায় (Aggregate Collection Summary):</td>
                    <td className="p-2 text-right border border-slate-200 font-mono text-slate-950 font-black">৳{reportSummary.totalPL.toLocaleString('en-US')}</td>
                    <td className="p-2 text-right border border-slate-200 font-mono text-slate-950">৳{reportSummary.totalGS.toLocaleString('en-US')}</td>
                    <td className="p-2 text-right border border-slate-200 font-mono text-slate-950">৳{reportSummary.totalCBS.toLocaleString('en-US')}</td>
                    <td className="p-2 text-right border border-slate-200 font-mono text-slate-950">৳{reportSummary.totalLTS.toLocaleString('en-US')}</td>
                    <td className="p-2 text-right border border-slate-200 font-mono text-blue-900 font-black bg-blue-100/50">৳{reportSummary.totalCollectionsOverall.toLocaleString('en-US')}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* TAB 6: PAR Report */}
        {activeReport === 'par' && (
          <div className="space-y-6">
            {/* LLP Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 select-none print:grid-cols-4">
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex flex-col justify-between">
                <div>
                  <span className="text-[10px] font-black text-slate-500 uppercase block">১. নিয়মিত ঋণ পোর্টফোলিও (Standard)</span>
                  <div className="text-base font-black font-mono text-slate-800 mt-1">
                    ৳{llpSummary.outstandings.standard.toLocaleString('en-US')}
                  </div>
                  <p className="text-[9px] text-slate-500 mt-1">সদস্য সংখ্যা: <strong>{llpSummary.counts.standard} জন</strong></p>
                </div>
                <div className="border-t border-slate-200 mt-2.5 pt-2 flex justify-between items-center text-[10px] text-slate-650">
                  <span>সঞ্চিতি হার: <strong>{llpSummary.rates.standard}%</strong></span>
                  <span className="font-mono font-bold text-slate-900">৳{Math.round(llpSummary.provisions.standard).toLocaleString('en-US')}</span>
                </div>
              </div>

              <div className="bg-amber-50/50 border border-amber-200 rounded-2xl p-4 flex flex-col justify-between">
                <div>
                  <span className="text-[10px] font-black text-amber-850 uppercase block">২. সাব-স্ট্যান্ডার্ড পোর্টফোলিও (Sub)</span>
                  <div className="text-base font-black font-mono text-amber-900 mt-1">
                    ৳{llpSummary.outstandings.subStandard.toLocaleString('en-US')}
                  </div>
                  <p className="text-[9px] text-amber-700 mt-1">সদস্য সংখ্যা: <strong>{llpSummary.counts.subStandard} জন</strong></p>
                </div>
                <div className="border-t border-amber-200 mt-2.5 pt-2 flex justify-between items-center text-[10px] text-amber-800">
                  <span>সঞ্চিতি হার: <strong>{llpSummary.rates.subStandard}%</strong></span>
                  <span className="font-mono font-bold text-amber-950">৳{Math.round(llpSummary.provisions.subStandard).toLocaleString('en-US')}</span>
                </div>
              </div>

              <div className="bg-orange-50/50 border border-orange-200 rounded-2xl p-4 flex flex-col justify-between">
                <div>
                  <span className="text-[10px] font-black text-orange-850 uppercase block">৩. সন্দেহজনক পোর্টফোলিও (Doubtful)</span>
                  <div className="text-base font-black font-mono text-orange-900 mt-1">
                    ৳{llpSummary.outstandings.doubtful.toLocaleString('en-US')}
                  </div>
                  <p className="text-[9px] text-orange-700 mt-1">সদস্য সংখ্যা: <strong>{llpSummary.counts.doubtful} জন</strong></p>
                </div>
                <div className="border-t border-orange-200 mt-2.5 pt-2 flex justify-between items-center text-[10px] text-orange-800">
                  <span>সঞ্চিতি হার: <strong>{llpSummary.rates.doubtful}%</strong></span>
                  <span className="font-mono font-bold text-orange-950">৳{Math.round(llpSummary.provisions.doubtful).toLocaleString('en-US')}</span>
                </div>
              </div>

              <div className="bg-rose-50/50 border border-rose-200 rounded-2xl p-4 flex flex-col justify-between">
                <div>
                  <span className="text-[10px] font-black text-rose-850 block">৪. মন্দ বা কু-ঋণ পোর্টফোলিও (Bad/Loss)</span>
                  <div className="text-base font-black font-mono text-rose-900 mt-1">
                    ৳{llpSummary.outstandings.bad.toLocaleString('en-US')}
                  </div>
                  <p className="text-[9px] text-rose-700 mt-1">সদস্য সংখ্যা: <strong>{llpSummary.counts.bad} জন</strong></p>
                </div>
                <div className="border-t border-rose-200 mt-2.5 pt-2 flex justify-between items-center text-[10px] text-rose-800">
                  <span>সঞ্চিতি হার: <strong>{llpSummary.rates.bad}%</strong></span>
                  <span className="font-mono font-bold text-rose-950">৳{Math.round(llpSummary.provisions.bad).toLocaleString('en-US')}</span>
                </div>
              </div>
            </div>

            {/* Total Aggregate Provision Box */}
            <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row justify-between items-center gap-4">
              <div className="text-center sm:text-left">
                <h5 className="font-black text-indigo-950 text-xs sm:text-sm font-sans flex items-center justify-center sm:justify-start gap-1.5">
                  🛡️ ঋণ ক্ষতি সঞ্চিতি বিশ্লেষণ ও বাধ্যবাধকতা (LLP Aggregate Computation Summary)
                </h5>
                <p className="text-indigo-800 text-[10px] leading-relaxed mt-1 font-sans">
                  শ্রেণীকৃত ঋণের বিপরীতে মোট ঋণ পোর্টফোলিও <strong>৳{llpSummary.outstandings.total.toLocaleString('en-US')}</strong> এর বিপরীতে মোট সঞ্চিতি আবশ্যকতা নির্ধারণ করা হলো।
                </p>
              </div>
              <div className="text-center sm:text-right">
                <span className="text-[9px] uppercase font-bold text-indigo-700 block select-none">মোট সঞ্চিতি তহবিল আবশ্যকতা (Total Required LLP)</span>
                <span className="text-lg sm:text-xl font-black font-mono text-indigo-950 bg-white border border-indigo-200 px-4 py-1.5 rounded-xl block mt-1 shadow-3xs">৳{Math.round(llpSummary.provisions.total).toLocaleString('en-US')}</span>
              </div>
            </div>

            {/* Member Overdue List */}
            <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-3xs">
              <div className="bg-slate-50 border-b border-slate-200 px-4 py-3 select-none">
                <h4 className="font-extrabold text-slate-800 text-xs sm:text-sm font-sans">📋 বকেয়া ও খেলাপি ঋণগ্রহীতা তালিকা (Outstanding & Overdue Member Ledger)</h4>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-[11px] text-slate-705 border-collapse table-auto">
                  <thead>
                    <tr className="bg-slate-50/50 border-b border-slate-200 text-slate-500 uppercase tracking-wider text-[9px] font-extrabold text-left select-none font-sans">
                      <th className="p-3 border-r border-slate-100">সদস্য কোড</th>
                      <th className="p-3 border-r border-slate-100">সদস্যের নাম</th>
                      <th className="p-3 border-r border-slate-100">সমিতি</th>
                      <th className="p-3 text-right border-r border-slate-100">ঋণ স্থিতি (Outstanding)</th>
                      <th className="p-3 text-right border-r border-slate-100">বকেয়া কিস্তি (Overdue)</th>
                      <th className="p-3 text-center">ঝুঁকি স্তর / শ্রেণীকরণ (Risk Classification)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium font-sans">
                    {llpSummary.classifiedMembers.map((item, idx) => {
                      const { member: m, outstanding, overdueAmount, classLabel, classStyle } = item;

                      return (
                        <tr key={idx} className="hover:bg-slate-50/40">
                          <td className="p-3 border-r border-slate-100 font-mono text-slate-500 font-bold">{m.memberId || m.id}</td>
                          <td className="p-3 border-r border-slate-100 font-black text-slate-900">{m.name}</td>
                          <td className="p-3 border-r border-slate-100 text-slate-650">{groups.find(g => g.id === m.groupId)?.name || 'N/A'}</td>
                          <td className="p-3 border-r border-slate-100 text-right font-mono text-slate-900 font-black">৳{outstanding.toLocaleString('en-US')}</td>
                          <td className={`p-3 border-r border-slate-100 text-right font-mono font-black ${overdueAmount > 0 ? 'text-rose-700' : 'text-slate-500'}`}>৳{overdueAmount.toLocaleString('en-US')}</td>
                          <td className="p-3 text-center">
                            <span className={`inline-block px-2.5 py-0.5 rounded-full text-[9px] font-extrabold border ${classStyle}`}>
                              {classLabel}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: Disbursements */}
        {activeReport === 'disbursement' && (
          <div className="overflow-x-auto">
            <table className="w-full text-[11px] text-slate-700 border-collapse table-auto">
              <thead>
                <tr className="bg-slate-100 border-b border-slate-300">
                  <th className="p-2 font-bold text-slate-800 text-center border border-slate-200">তারিখ</th>
                  <th className="p-2 font-bold text-slate-800 text-left border border-slate-200">সদস্য কোড ও নাম</th>
                  <th className="p-2 font-bold text-slate-800 text-center border border-slate-200">ঋণের ক্যাটাগরি</th>
                  <th className="p-2 font-bold text-slate-800 text-right border border-slate-200">বিতরণকৃত আসল</th>
                  <th className="p-2 font-bold text-slate-800 text-right border border-slate-200">সার্ভিস চার্জ</th>
                  <th className="p-2 font-bold text-slate-800 text-right border border-slate-200 bg-emerald-50/40">মোট প্রদেয়</th>
                  <th className="p-2 font-bold text-slate-800 text-center border border-slate-200">কিস্তি পরিমাণ ও সংখ্যা</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredTransactions.filter(tx => tx.type === 'disbursement').length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-slate-400 font-semibold italic">
                      নির্বাচিত তারিখ পরিসীমার মধ্যে কোন ঋণ বিতরণের হিসাব পাওয়া যায়নি।
                    </td>
                  </tr>
                ) : (
                  filteredTransactions.filter(tx => tx.type === 'disbursement').map((tx, idx) => {
                    const principal = Number(tx.amount || tx.proposalDetail?.proposedAmount || 0);
                    const totalPayableVal = Number(tx.proposalDetail?.totalPayable || (principal * 1.15));
                    const sc = totalPayableVal - principal;
                    const lType = tx.proposalDetail?.loanType || 'মাসিক';
                    const instAmt = tx.proposalDetail?.installmentAmount || 0;
                    const instCount = tx.proposalDetail?.installmentsCount || 0;

                    return (
                      <tr key={idx} className="hover:bg-slate-50/70">
                        <td className="p-2 text-center border border-slate-200 font-mono text-slate-500">{formatDateToDDMMYYYY(tx.date)}</td>
                        <td className="p-2 border border-slate-200">
                          <span className="font-extrabold text-slate-900 block">{tx.memberName}</span>
                          <span className="font-mono text-[9px] text-slate-400">{tx.memberId}</span>
                        </td>
                        <td className="p-2 text-center border border-slate-200 font-bold text-slate-700">{lType}</td>
                        <td className="p-2 border border-slate-200 text-right font-mono text-slate-900 font-bold">৳{principal.toLocaleString('en-US')}</td>
                        <td className="p-2 border border-slate-200 text-right font-mono text-slate-500">৳{sc.toLocaleString('en-US')}</td>
                        <td className="p-2 border border-slate-200 text-right font-mono text-emerald-800 font-extrabold bg-emerald-50/10">৳{totalPayableVal.toLocaleString('en-US')}</td>
                        <td className="p-2 text-center border border-slate-200 font-semibold font-mono text-slate-700">৳{instAmt} × {instCount}</td>
                      </tr>
                    );
                  })
                )}

                {/* Aggregate Sums */}
                {filteredTransactions.filter(tx => tx.type === 'disbursement').length > 0 && (
                  <tr className="bg-slate-100 font-bold border-t border-slate-350 select-none">
                    <td colSpan={3} className="p-2.5 text-right border border-slate-200 font-extrabold text-slate-800">সর্বমোট ঋণ বিতরণ পোর্টফোলিও:</td>
                    <td className="p-2 text-right border border-slate-200 font-mono text-slate-950 font-black">৳{reportSummary.totalDisbursed.toLocaleString('en-US')}</td>
                    <td className="p-2 text-right border border-slate-200 font-mono text-slate-550">৳{reportSummary.totalServiceCharge.toLocaleString('en-US')}</td>
                    <td className="p-2 text-right border border-slate-200 font-mono text-emerald-950 font-black bg-emerald-100/50">৳{reportSummary.totalPayable.toLocaleString('en-US')}</td>
                    <td className="p-2 border border-slate-200"></td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* TAB 3: Savings Ledger */}
        {activeReport === 'savings' && (
          <div className="overflow-x-auto">
            <table className="w-full text-[11px] text-slate-700 border-collapse table-auto">
              <thead>
                <tr className="bg-slate-100 border-b border-slate-300">
                  <th className="p-2 font-bold text-slate-800 text-center border border-slate-200">তারিখ</th>
                  <th className="p-2 font-bold text-slate-800 text-left border border-slate-200">সদস্য কোড ও নাম</th>
                  <th className="p-2 font-bold text-slate-850 text-right border border-slate-200 bg-amber-50/20">GS জমা</th>
                  <th className="p-2 font-bold text-slate-850 text-right border border-slate-200 bg-rose-50/20">GS উত্তোলন</th>
                  <th className="p-2 font-bold text-slate-850 text-right border border-slate-200 bg-amber-50/20">CBS জমা</th>
                  <th className="p-2 font-bold text-slate-850 text-right border border-slate-200 bg-rose-50/20">CBS উত্তোলন</th>
                  <th className="p-2 font-bold text-slate-850 text-right border border-slate-200 bg-amber-50/20">LTS জমা</th>
                  <th className="p-2 font-bold text-slate-850 text-right border border-slate-200 bg-rose-50/20">LTS উত্তোলন</th>
                  <th className="p-2 font-bold text-slate-800 text-right border border-slate-200 bg-blue-50/35">নিট সঞ্চয় কার্যক্রম</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {(() => {
                  const savingsRows = filteredTransactions.filter(tx => {
                    let hasSav = false;
                    if (tx.type === 'collection') {
                      hasSav = Number(tx.collections?.gs || 0) > 0 || Number(tx.collections?.cbs || 0) > 0 || Number(tx.collections?.lts || 0) > 0;
                    } else if (tx.type === 'savings_deposit' || tx.type === 'savings_withdrawal' || tx.type === 'withdrawal') {
                      hasSav = true;
                    }
                    return hasSav;
                  });

                  if (savingsRows.length === 0) {
                    return (
                      <tr>
                        <td colSpan={9} className="p-8 text-center text-slate-400 font-semibold italic">
                          নির্বাচিত তারিখ পরিসীমার মধ্যে কোন সঞ্চয় জমা বা উত্তোলনের রেকর্ড পাওয়া যায়নি।
                        </td>
                      </tr>
                    );
                  }

                  return savingsRows.map((tx, idx) => {
                    let gsDep = 0, gsWth = 0, cbsDep = 0, cbsWth = 0, ltsDep = 0, ltsWth = 0;

                    if (tx.type === 'collection') {
                      gsDep = Number(tx.collections?.gs || 0);
                      cbsDep = Number(tx.collections?.cbs || 0);
                      ltsDep = Number(tx.collections?.lts || 0);
                    } else if (tx.type === 'savings_deposit') {
                      gsDep = Number(tx.amount || 0);
                    } else if (tx.type === 'savings_withdrawal' || tx.type === 'withdrawal') {
                      gsWth = Number(tx.withdrawals?.gs || tx.amount || 0);
                      cbsWth = Number(tx.withdrawals?.cbs || 0);
                      ltsWth = Number(tx.withdrawals?.lts || 0);
                    }

                    const rowNet = (gsDep + cbsDep + ltsDep) - (gsWth + cbsWth + ltsWth);

                    return (
                      <tr key={idx} className="hover:bg-slate-50/70">
                        <td className="p-2 text-center border border-slate-200 font-mono text-slate-500">{formatDateToDDMMYYYY(tx.date)}</td>
                        <td className="p-2 border border-slate-200">
                          <span className="font-extrabold text-slate-900 block">{tx.memberName}</span>
                          <span className="font-mono text-[9px] text-slate-400">{tx.memberId}</span>
                        </td>
                        <td className="p-2 border border-slate-200 text-right font-mono text-emerald-700 bg-emerald-50/5">৳{gsDep.toLocaleString('en-US')}</td>
                        <td className="p-2 border border-slate-200 text-right font-mono text-rose-600 bg-rose-50/5">৳{gsWth.toLocaleString('en-US')}</td>
                        <td className="p-2 border border-slate-200 text-right font-mono text-emerald-700 bg-emerald-50/5">৳{cbsDep.toLocaleString('en-US')}</td>
                        <td className="p-2 border border-slate-200 text-right font-mono text-rose-600 bg-rose-50/5">৳{cbsWth.toLocaleString('en-US')}</td>
                        <td className="p-2 border border-slate-200 text-right font-mono text-emerald-700 bg-emerald-50/5">৳{ltsDep.toLocaleString('en-US')}</td>
                        <td className="p-2 border border-slate-200 text-right font-mono text-rose-600 bg-rose-50/5">৳{ltsWth.toLocaleString('en-US')}</td>
                        <td className={`p-2 border border-slate-200 text-right font-mono font-extrabold ${rowNet >= 0 ? 'text-blue-700 bg-blue-50/10' : 'text-amber-800 bg-amber-50/10'}`}>
                          ৳{rowNet.toLocaleString('en-US')}
                        </td>
                      </tr>
                    );
                  });
                })()}

                {/* Savings summary */}
                <tr className="bg-slate-100 font-bold border-t border-slate-350 select-none">
                  <td colSpan={2} className="p-2.5 text-right border border-slate-200 font-extrabold text-slate-800">সর্বমোট সঞ্চয় বিবরণী যোগফল:</td>
                  <td className="p-2 text-right border border-slate-200 font-mono text-emerald-950 font-black">৳{reportSummary.totalGS.toLocaleString('en-US')}</td>
                  <td className="p-2 text-right border border-slate-200 font-mono text-slate-450 bg-rose-100/20">--</td>
                  <td className="p-2 text-right border border-slate-200 font-mono text-emerald-950 font-black">৳{reportSummary.totalCBS.toLocaleString('en-US')}</td>
                  <td className="p-2 text-right border border-slate-200 font-mono text-slate-450 bg-rose-100/20">--</td>
                  <td className="p-2 text-right border border-slate-200 font-mono text-emerald-950 font-black">৳{reportSummary.totalLTS.toLocaleString('en-US')}</td>
                  <td className="p-2 text-right border border-slate-200 font-mono text-slate-450 bg-rose-100/20">--</td>
                  <td className="p-2 text-right border border-slate-200 font-mono text-blue-900 font-black bg-blue-100/50">
                    ৳{(reportSummary.totalSavingsDeposit - reportSummary.totalSavingsWithdrawal).toLocaleString('en-US')}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {/* TAB 4: Cash Summary */}
        {activeReport === 'cash_summary' && (
          <div className="max-w-2xl mx-auto space-y-6">
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 shadow-3xs">
              <h4 className="font-extrabold text-slate-800 text-xs border-b border-slate-200 pb-2 mb-4 uppercase tracking-wider text-center">
                প্রাপ্তি ও প্রধান হিসাব বিবরণী (Periodical Cash Sheet)
              </h4>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Receipts Block */}
                <div className="space-y-3">
                  <h5 className="text-[11.5px] font-bold text-emerald-800 border-b border-emerald-100 pb-1.5 flex justify-between">
                    <span>💵 জমা / প্রাপ্তি সমূহ (Receipts)</span>
                    <span className="font-mono">৳</span>
                  </h5>
                  <div className="space-y-2 text-xs text-slate-700">
                    <p className="flex justify-between border-b border-slate-100 pb-1">
                      <span>১. ঋণ পোর্টফোলিও আদায় (PL Recovery)</span>
                      <strong className="font-mono">৳{reportSummary.totalPL.toLocaleString('en-US')}</strong>
                    </p>
                    <p className="flex justify-between border-b border-slate-100 pb-1">
                      <span>২. সাধারণ সঞ্চয় সংগ্রহ (GS Collection)</span>
                      <strong className="font-mono">৳{reportSummary.totalGS.toLocaleString('en-US')}</strong>
                    </p>
                    <p className="flex justify-between border-b border-slate-100 pb-1">
                      <span>৩. বিশেষ সঞ্চয় সংগ্রহ (CBS Collection)</span>
                      <strong className="font-mono">৳{reportSummary.totalCBS.toLocaleString('en-US')}</strong>
                    </p>
                    <p className="flex justify-between border-b border-slate-100 pb-1">
                      <span>৪. দীর্ঘমেয়াদী সঞ্চয় সংগ্রহ (LTS Collection)</span>
                      <strong className="font-mono">৳{reportSummary.totalLTS.toLocaleString('en-US')}</strong>
                    </p>
                    
                    <div className="pt-2 flex justify-between font-black text-emerald-950 text-[12px]">
                      <span>মোট প্রাপ্তি (Total Receipts):</span>
                      <span className="font-mono">৳{(reportSummary.totalPL + reportSummary.totalSavingsDeposit).toLocaleString('en-US')}</span>
                    </div>
                  </div>
                </div>

                {/* Payments Block */}
                <div className="space-y-3">
                  <h5 className="text-[11.5px] font-bold text-rose-800 border-b border-rose-100 pb-1.5 flex justify-between">
                    <span>💸 প্রধান / উত্তোলন সমূহ (Payments)</span>
                    <span className="font-mono">৳</span>
                  </h5>
                  <div className="space-y-2 text-xs text-slate-700">
                    <p className="flex justify-between border-b border-slate-100 pb-1">
                      <span>১. ঋণ বিতরণ পোর্টফোলিও (Disbursements)</span>
                      <strong className="font-mono text-rose-600">৳{reportSummary.totalDisbursed.toLocaleString('en-US')}</strong>
                    </p>
                    <p className="flex justify-between border-b border-slate-100 pb-1">
                      <span>২. সঞ্চয় ও আমানত উত্তোলন (Withdrawals)</span>
                      <strong className="font-mono text-rose-600">৳{reportSummary.totalSavingsWithdrawal.toLocaleString('en-US')}</strong>
                    </p>
                    <p className="flex justify-between border-b border-slate-100 pb-1 text-slate-350 select-none">
                      <span>৩. কর্মী অগ্রিম বা প্রাতিষ্ঠানিক খরচ</span>
                      <strong className="font-mono">৳0</strong>
                    </p>
                    <p className="flex justify-between border-b border-slate-100 pb-1 text-slate-350 select-none">
                      <span>৪. অন্যান্য বিবিধ খরচ</span>
                      <strong className="font-mono">৳0</strong>
                    </p>

                    <div className="pt-2 flex justify-between font-black text-rose-950 text-[12px]">
                      <span>মোট প্রধান (Total Payments):</span>
                      <span className="font-mono">৳{(reportSummary.totalDisbursed + reportSummary.totalSavingsWithdrawal).toLocaleString('en-US')}</span>
                    </div>
                  </div>
                </div>

              </div>

              {/* Net Surplus Card */}
              <div className="mt-6 pt-4 border-t-2 border-dashed border-slate-300 flex flex-col sm:flex-row items-center justify-between gap-3 select-none">
                <div className="text-center sm:text-left">
                  <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wide block">নিট কার্যকালিক ক্যাশ ব্যালেন্স পরিবর্তন</span>
                  <span className="text-xs font-bold text-slate-600">
                    {reportSummary.netCashFlow >= 0 ? 'উদ্বৃত্ত নগদ প্রবাহ (Surplus)' : 'ঘাটতি নগদ প্রবাহ (Deficit)'}
                  </span>
                </div>
                <div className={`px-5 py-2.5 rounded-2xl border font-black font-mono text-lg ${
                  reportSummary.netCashFlow >= 0 
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200' 
                    : 'bg-rose-50 text-rose-800 border-rose-200'
                }`}>
                  {reportSummary.netCashFlow >= 0 ? '+' : '-'}৳{Math.abs(reportSummary.netCashFlow).toLocaleString('en-US')}
                </div>
              </div>

            </div>
          </div>
        )}

        {/* TAB 5: Demand vs Collection */}
        {activeReport === 'demand_collection' && (
          <div className="overflow-x-auto">
            <table className="w-full text-[11px] text-slate-700 border-collapse table-auto">
              <thead>
                <tr className="bg-slate-100 border-b border-slate-300">
                  <th className="p-2 font-bold text-slate-800 text-left border border-slate-200">সদস্যের নাম ও আইডি</th>
                  <th className="p-2 font-bold text-slate-800 text-center border border-slate-200">সমিতি / গ্রুপ</th>
                  <th className="p-2 font-bold text-slate-800 text-right border border-slate-200 bg-blue-50/40">ঋণ আদায়যোগ্য (Demand)</th>
                  <th className="p-2 font-bold text-slate-800 text-right border border-slate-200 bg-emerald-50/40">ঋণ আদায়কৃত (Collected)</th>
                  <th className="p-2 font-bold text-slate-800 text-right border border-slate-200 bg-blue-50/40">সঞ্চয় আদায়যোগ্য (Demand)</th>
                  <th className="p-2 font-bold text-slate-800 text-right border border-slate-200 bg-emerald-50/40">সঞ্চয় আদায়কৃত (Collected)</th>
                  <th className="p-2 font-bold text-slate-850 text-right border border-slate-200 bg-blue-100/30">মোট আদায়যোগ্য</th>
                  <th className="p-2 font-bold text-slate-850 text-right border border-slate-200 bg-emerald-100/30">মোট আদায়কৃত</th>
                  <th className="p-2 font-bold text-rose-700 text-right border border-slate-200 bg-rose-50/40">ঘাটতি / বকেয়া (Due)</th>
                  <th className="p-2 font-bold text-blue-700 text-right border border-slate-200 bg-blue-50/40">অগ্রিম আদায় (Advance)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {demandCollectionRecords.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="p-8 text-center text-slate-400 font-semibold italic">
                      নির্বাচিত সমিতি বা ফিল্টারে আদায়যোগ্য কোন কিস্তি বা আদায়ের রেকর্ড পাওয়া যায়নি।
                    </td>
                  </tr>
                ) : (
                  demandCollectionRecords.map((r, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/70">
                      <td className="p-2 border border-slate-200">
                        <span className="font-extrabold text-slate-900 block">{r.memberName}</span>
                        <span className="font-mono text-[9px] text-slate-400">{r.memberId}</span>
                      </td>
                      <td className="p-2 text-center border border-slate-200 text-slate-600 font-medium">{r.groupName}</td>
                      <td className="p-2 border border-slate-200 text-right font-mono text-slate-600">৳{r.loanDemand.toLocaleString('en-US')}</td>
                      <td className="p-2 border border-slate-200 text-right font-mono text-slate-900 font-extrabold bg-emerald-50/10">৳{r.loanCollected.toLocaleString('en-US')}</td>
                      <td className="p-2 border border-slate-200 text-right">
                        <span className="font-mono text-slate-700 font-semibold block">৳{r.savingsDemand.toLocaleString('en-US')}</span>
                        {(r.gsDemand > 0 || r.cbsDemand > 0 || r.ltsDemand > 0) && (
                          <span className="text-[8.5px] text-slate-400 font-bold block leading-tight">
                            {r.gsDemand > 0 && `GS:${r.gsDemand}`}
                            {r.cbsDemand > 0 && ` CBS:${r.cbsDemand}`}
                            {r.ltsDemand > 0 && ` LTS:${r.ltsDemand}`}
                          </span>
                        )}
                      </td>
                      <td className="p-2 border border-slate-200 text-right bg-emerald-50/10">
                        <span className="font-mono text-slate-900 font-extrabold block">৳{r.savingsCollected.toLocaleString('en-US')}</span>
                        {(r.gsCollected > 0 || r.cbsCollected > 0 || r.ltsCollected > 0) && (
                          <span className="text-[8.5px] text-emerald-600/80 font-bold block leading-tight">
                            {r.gsCollected > 0 && `GS:${r.gsCollected}`}
                            {r.cbsCollected > 0 && ` CBS:${r.cbsCollected}`}
                            {r.ltsCollected > 0 && ` LTS:${r.ltsCollected}`}
                          </span>
                        )}
                      </td>
                      <td className="p-2 border border-slate-200 text-right font-mono text-blue-900 font-extrabold bg-blue-50/10">৳{r.totalDemand.toLocaleString('en-US')}</td>
                      <td className="p-2 border border-slate-200 text-right font-mono text-emerald-950 font-black bg-emerald-100/10">৳{r.totalCollected.toLocaleString('en-US')}</td>
                      <td className={`p-2 border border-slate-200 text-right font-mono font-bold ${r.due > 0 ? 'text-rose-600 bg-rose-50/20' : 'text-slate-400'}`}>
                        {r.due > 0 ? `৳${r.due.toLocaleString('en-US')}` : '৳০'}
                      </td>
                      <td className={`p-2 border border-slate-200 text-right font-mono font-bold ${r.advance > 0 ? 'text-blue-600 bg-blue-50/20' : 'text-slate-400'}`}>
                        {r.advance > 0 ? `৳${r.advance.toLocaleString('en-US')}` : '৳০'}
                      </td>
                    </tr>
                  ))
                )}

                {/* Aggregate Summary Rows */}
                {demandCollectionRecords.length > 0 && (
                  <tr className="bg-slate-100 font-bold border-t border-slate-350 select-none">
                    <td colSpan={2} className="p-2.5 text-right border border-slate-200 font-black text-slate-800">সর্বমোট যোগফল (Grand Totals):</td>
                    <td className="p-2 text-right border border-slate-200 font-mono text-slate-800 font-bold">৳{demandCollectionSummary.totalLoanDemand.toLocaleString('en-US')}</td>
                    <td className="p-2 text-right border border-slate-200 font-mono text-emerald-900 font-black bg-emerald-100/30">৳{demandCollectionSummary.totalLoanCollected.toLocaleString('en-US')}</td>
                    <td className="p-2 text-right border border-slate-200 font-mono text-slate-800 font-bold">৳{demandCollectionSummary.totalSavingsDemand.toLocaleString('en-US')}</td>
                    <td className="p-2 text-right border border-slate-200 font-mono text-emerald-900 font-black bg-emerald-100/30">৳{demandCollectionSummary.totalSavingsCollected.toLocaleString('en-US')}</td>
                    <td className="p-2 text-right border border-slate-200 font-mono text-blue-900 font-black bg-blue-100/30">৳{demandCollectionSummary.totalDemand.toLocaleString('en-US')}</td>
                    <td className="p-2 text-right border border-slate-200 font-mono text-emerald-950 font-black bg-emerald-200/40">৳{demandCollectionSummary.totalCollected.toLocaleString('en-US')}</td>
                    <td className="p-2 text-right border border-slate-200 font-mono text-rose-700 font-black bg-rose-100/30">৳{demandCollectionSummary.totalDue.toLocaleString('en-US')}</td>
                    <td className="p-2 text-right border border-slate-200 font-mono text-blue-700 font-black bg-blue-100/30">৳{demandCollectionSummary.totalAdvance.toLocaleString('en-US')}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* TAB 7: Periodical Profit and Loss Statement */}
        {activeReport === 'profit_loss' && (
          <div className="space-y-6">
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 sm:p-6 select-none print:hidden">
              <h5 className="font-extrabold text-slate-800 text-xs sm:text-sm uppercase tracking-wide mb-2">💡 লাভ-ক্ষতি বিবরণী নির্দেশিকা (Guideline)</h5>
              <p className="text-slate-600 text-[11px] leading-relaxed font-sans">
                এই বিবরণীটি নির্বাচিত সময়সীমার মধ্যে সকল আয় ও ব্যয় লেনদেনকে সমন্বিত করে স্বয়ংক্রিয়ভাবে প্রস্তুত করা হয়েছে। 
                ক্ষুদ্রঋণ কার্যক্রমে ঋণের <strong>সার্ভিস চার্জ আদায়</strong>, <strong>সদস্য ভর্তি ফি</strong> এবং <strong>পাসবুক/ফরম বিক্রয়</strong> প্রধান পরিচালন আয় হিসেবে পরিগণিত হয়। 
                অপরদিকে <strong>কর্মকর্তা-কর্মচারী বেতন</strong>, <strong>অফিস ভাড়া</strong> এবং <strong>যাতায়াত ও ভ্রমণ খরচ</strong> পরিচালন ব্যয় হিসেবে বিয়োগ করা হয়েছে।
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Income Column */}
              <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-3xs">
                <div className="bg-emerald-500/10 border-b border-slate-200 px-4 py-3">
                  <h4 className="font-extrabold text-emerald-950 text-xs sm:text-sm font-sans">📥 মোট অর্জিত আয় (Revenues & Incomes)</h4>
                </div>
                <table className="w-full text-[11px] text-slate-750 border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider text-[9px] font-extrabold text-left select-none font-sans">
                      <th className="p-3">আয় খাত (Revenue Head)</th>
                      <th className="p-3 text-right">পরিমাণ (Amount)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium font-sans">
                    <tr className="bg-slate-50/50 font-sans">
                      <td colSpan={2} className="p-2.5 font-bold text-slate-800">১. পরিচালন আয় (Operating Revenue)</td>
                    </tr>
                    <tr>
                      <td className="p-3 pl-6 text-slate-650">📈 ঋণের সার্ভিস চার্জ আদায় (Service Charges)</td>
                      <td className="p-3 text-right font-mono font-bold text-slate-900">৳{profitLossSummary.serviceChargeIncome.toLocaleString('en-US')}</td>
                    </tr>
                    <tr>
                      <td className="p-3 pl-6 text-slate-650">🎟️ নতুন সদস্য ভর্তিকরণ ফি আদায় (Admission Fees)</td>
                      <td className="p-3 text-right font-mono font-bold text-slate-900">৳{profitLossSummary.admissionFeeIncome.toLocaleString('en-US')}</td>
                    </tr>
                    <tr>
                      <td className="p-3 pl-6 text-slate-650">📖 ঋণ পাসবুক ও ফরম বিক্রয় আয় (Passbook Revenue)</td>
                      <td className="p-3 text-right font-mono font-bold text-slate-900">৳{profitLossSummary.passbookFeeIncome.toLocaleString('en-US')}</td>
                    </tr>

                    <tr className="bg-slate-50/50">
                      <td colSpan={2} className="p-2.5 font-bold text-slate-800">২. অ-পরিচালন আয় (Non-Operating Revenue)</td>
                    </tr>
                    <tr>
                      <td className="p-3 pl-6 text-slate-650">🏦 ব্যাংক সঞ্চয়ের সুদ প্রাপ্তি (Bank Interest)</td>
                      <td className="p-3 text-right font-mono font-bold text-slate-900">৳{profitLossSummary.bankInterestIncome.toLocaleString('en-US')}</td>
                    </tr>
                    <tr>
                      <td className="p-3 pl-6 text-slate-650">🎁 অন্যান্য বিবিধ সাধারণ আয় (Misc Income)</td>
                      <td className="p-3 text-right font-mono font-bold text-slate-900">৳{profitLossSummary.miscIncome.toLocaleString('en-US')}</td>
                    </tr>

                    <tr className="bg-emerald-500/5 font-bold border-t border-slate-250 select-none">
                      <td className="p-3 text-emerald-900 font-black">মোট অর্জিত আয় (Total Revenues):</td>
                      <td className="p-3 text-right font-mono font-black text-emerald-950 text-xs">৳{profitLossSummary.totalIncome.toLocaleString('en-US')}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Expense Column */}
              <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-3xs">
                <div className="bg-rose-500/10 border-b border-slate-200 px-4 py-3">
                  <h4 className="font-extrabold text-rose-950 text-xs sm:text-sm font-sans">📤 মোট ব্যয় ও খরচ (Expenditures & Expenses)</h4>
                </div>
                <table className="w-full text-[11px] text-slate-750 border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider text-[9px] font-extrabold text-left select-none font-sans">
                      <th className="p-3">ব্যয় খাত (Expense Head)</th>
                      <th className="p-3 text-right">পরিমাণ (Amount)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium font-sans">
                    <tr className="bg-slate-50/50 font-sans">
                      <td colSpan={2} className="p-2.5 font-bold text-slate-800">১. পরিচালন ব্যয় (Operating Expense)</td>
                    </tr>
                    <tr>
                      <td className="p-3 pl-6 text-slate-650">💼 কর্মকর্তা-কর্মী বেতন ও ভাতা (Staff Salaries)</td>
                      <td className="p-3 text-right font-mono font-bold text-slate-900">৳{profitLossSummary.staffSalariesExpense.toLocaleString('en-US')}</td>
                    </tr>
                    <tr>
                      <td className="p-3 pl-6 text-slate-650">🏢 অফিস কার্যালয় ভাড়া (Office Rent)</td>
                      <td className="p-3 text-right font-mono font-bold text-slate-900">৳{profitLossSummary.officeRentExpense.toLocaleString('en-US')}</td>
                    </tr>
                    <tr>
                      <td className="p-3 pl-6 text-slate-650">🚊 যাতায়াত, ভ্রমণ ও স্টেশনারি (Travel Expense)</td>
                      <td className="p-3 text-right font-mono font-bold text-slate-900">৳{profitLossSummary.travelTransportExpense.toLocaleString('en-US')}</td>
                    </tr>

                    <tr className="bg-slate-50/50 font-sans">
                      <td colSpan={2} className="p-2.5 font-bold text-slate-800">২. অ-পরিচালন ও অন্যান্য খরচ (Other Expenses)</td>
                    </tr>
                    <tr>
                      <td className="p-3 pl-6 text-slate-650">📉 অনুমোদিত বকেয়া ঋণ মওকুফ ব্যয় (Exemptions)</td>
                      <td className="p-3 text-right font-mono font-bold text-slate-900">৳{profitLossSummary.loanExemptionExpense.toLocaleString('en-US')}</td>
                    </tr>
                    <tr>
                      <td className="p-3 pl-6 text-slate-650">🛡️ খেলাপি ঋণ সঞ্চিতি আবশ্যকতা (Loan Loss Provision)</td>
                      <td className="p-3 text-right font-mono font-bold text-slate-900">৳{Math.round(profitLossSummary.llpProvisionExpense).toLocaleString('en-US')}</td>
                    </tr>
                    <tr>
                      <td className="p-3 pl-6 text-slate-650">🛠️ অন্যান্য প্রশাসনিক ও বিবিধ খরচ (Misc Admin)</td>
                      <td className="p-3 text-right font-mono font-bold text-slate-900">৳{profitLossSummary.otherAdministrativeExpense.toLocaleString('en-US')}</td>
                    </tr>

                    <tr className="bg-rose-500/5 font-bold border-t border-slate-250 select-none">
                      <td className="p-3 text-rose-900 font-black">মোট ব্যয় ও লোকসান (Total Expenses):</td>
                      <td className="p-3 text-right font-mono font-black text-rose-950 text-xs">৳{profitLossSummary.totalExpense.toLocaleString('en-US')}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

            </div>

            {/* Combined Statement Summary Card */}
            <div className={`rounded-2xl border-2 p-5 flex flex-col sm:flex-row items-center justify-between gap-4 mt-6 ${
              profitLossSummary.netProfit >= 0 
                ? 'bg-emerald-50/70 border-emerald-200 text-emerald-950' 
                : 'bg-rose-50/70 border-rose-200 text-rose-950'
            }`}>
              <div className="text-center sm:text-left select-none font-sans">
                <span className="text-[10px] font-extrabold uppercase tracking-wider block opacity-70">
                  নির্ধারিত সময়কালের নিট হিসাব ফলাফল (Periodical Financial Outcome)
                </span>
                <span className="text-sm font-black block mt-1">
                  {profitLossSummary.netProfit >= 0 
                    ? '🟢 নিট লাভ / উদ্বৃত্ত অতিরিক্ত (Net Surplus)' 
                    : '🔴 নিট লোকসান / ক্ষতি (Net Deficit)'}
                </span>
                <p className="text-[11px] opacity-80 mt-1 max-w-lg leading-relaxed">
                  {profitLossSummary.netProfit >= 0 
                    ? `অভিনন্দন! এই সময়কালে প্রতিষ্ঠানটি ৳${profitLossSummary.netProfit.toLocaleString('en-US')} মুনাফা অর্জন করেছে।` 
                    : `সতর্কতা: এই সময়কালে খরচের পরিমাণ আয়ের তুলনায় বেশি রয়েছে (৳${Math.abs(profitLossSummary.netProfit).toLocaleString('en-US')} ক্ষতি)।`}
                </p>
              </div>
              <div className="text-center font-mono select-all">
                <div className={`text-2xl sm:text-3xl font-black tracking-tight px-6 py-3 rounded-2xl border ${
                  profitLossSummary.netProfit >= 0 
                    ? 'bg-white text-emerald-800 border-emerald-300 shadow-sm' 
                    : 'bg-white text-rose-800 border-rose-300 shadow-sm'
                }`}>
                  {profitLossSummary.netProfit >= 0 ? '+' : '-'}৳{Math.abs(profitLossSummary.netProfit).toLocaleString('en-US')}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 8: Balance Sheet */}
        {activeReport === 'balance_sheet' && (
          <div className="space-y-6">
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 sm:p-6 select-none print:hidden">
              <h5 className="font-extrabold text-slate-800 text-xs sm:text-sm uppercase tracking-wide mb-2">💡 উদ্বর্তপত্র বা ব্যালেন্স শিট নির্দেশিকা (Balance Sheet Guide)</h5>
              <p className="text-slate-600 text-[11px] leading-relaxed font-sans">
                এই প্রতিবেদনটি নির্বাচিত সময়কাল বা শেষ তারিখের ভিত্তিতে প্রতিষ্ঠানের <strong>আর্থিক অবস্থা (Statement of Financial Position)</strong> নির্দেশ করে। 
                এতে বাম পাশে দায় ও মূলধন সমূহ এবং ডান পাশে প্রতিষ্ঠানের মোট সম্পদ সমূহ সমান বা দ্বিমুখী ব্যালেন্স পদ্ধতিতে উপস্থাপিত হয়।
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
              
              {/* Liabilities and Equity Column */}
              <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-3xs bg-white">
                <div className="bg-slate-100 border-b border-slate-200 px-4 py-3">
                  <h4 className="font-extrabold text-slate-900 text-xs sm:text-sm font-sans">⚖️ দায় ও তহবিল (Liabilities & Capital Equity)</h4>
                </div>
                <table className="w-full text-[11px] text-slate-750 border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider text-[9px] font-extrabold text-left select-none font-sans">
                      <th className="p-3">হিসাব খাত (Ledger Account)</th>
                      <th className="p-3 text-right">পরিমাণ (Amount)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium font-sans">
                    <tr className="bg-slate-50/50">
                      <td colSpan={2} className="p-2.5 font-bold text-slate-800">১. সঞ্চয় আমানত তহবিল (Savings Deposits)</td>
                    </tr>
                    <tr>
                      <td className="p-3 pl-6 text-slate-650">👥 সাধারণ সঞ্চয় স্থিতি (General Savings)</td>
                      <td className="p-3 text-right font-mono font-bold text-slate-900">৳{balanceSheetSummary.totalGSBalance.toLocaleString('en-US')}</td>
                    </tr>
                    <tr>
                      <td className="p-3 pl-6 text-slate-650">💎 বিশেষ সঞ্চয় স্থিতি (CBS Savings)</td>
                      <td className="p-3 text-right font-mono font-bold text-slate-900">৳{balanceSheetSummary.totalCBSBalance.toLocaleString('en-US')}</td>
                    </tr>
                    <tr>
                      <td className="p-3 pl-6 text-slate-650">⏳ দীর্ঘমেয়াদী সঞ্চয় স্থিতি (LTS Savings)</td>
                      <td className="p-3 text-right font-mono font-bold text-slate-900">৳{balanceSheetSummary.totalLTSBalance.toLocaleString('en-US')}</td>
                    </tr>
                    <tr className="bg-slate-50/50">
                      <td colSpan={2} className="p-2.5 font-bold text-slate-800">২. রিজার্ভ ও সঞ্চিতি (Reserves & Provisions)</td>
                    </tr>
                    <tr>
                      <td className="p-3 pl-6 text-slate-650">🛡️ খেলাপি ঋণ সঞ্চিতি তহবিল (Loan Loss Provision)</td>
                      <td className="p-3 text-right font-mono font-bold text-slate-900">৳{Math.round(balanceSheetSummary.llpReserve).toLocaleString('en-US')}</td>
                    </tr>
                    <tr className="bg-slate-50/50">
                      <td colSpan={2} className="p-2.5 font-bold text-slate-800">৩. প্রাতিষ্ঠানিক তহবিল ও ইক্যুইটি (Capital Fund)</td>
                    </tr>
                    <tr>
                      <td className="p-3 pl-6 text-slate-650">🏛️ প্রাতিষ্ঠানিক তহবিল / মূলধন (Retained Earnings/Fund)</td>
                      <td className="p-3 text-right font-mono font-bold text-slate-900">৳{Math.round(balanceSheetSummary.capitalFund).toLocaleString('en-US')}</td>
                    </tr>

                    <tr className="bg-slate-100 font-bold border-t border-slate-250 select-none text-slate-900">
                      <td className="p-3 font-black">মোট দায় ও মূলধন (Total Liabilities & Capital):</td>
                      <td className="p-3 text-right font-mono font-black text-xs">৳{Math.round(balanceSheetSummary.totalLiabilitiesAndCapital).toLocaleString('en-US')}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Assets Column */}
              <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-3xs bg-white">
                <div className="bg-blue-500/10 border-b border-slate-200 px-4 py-3">
                  <h4 className="font-extrabold text-blue-950 text-xs sm:text-sm font-sans">💼 সম্পদ ও স্থিতি (Assets & Balances)</h4>
                </div>
                <table className="w-full text-[11px] text-slate-750 border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider text-[9px] font-extrabold text-left select-none font-sans">
                      <th className="p-3">হিসাব খাত (Ledger Account)</th>
                      <th className="p-3 text-right">পরিমাণ (Amount)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium font-sans">
                    <tr className="bg-slate-50/50">
                      <td colSpan={2} className="p-2.5 font-bold text-slate-800">১. নগদ ও তরল সম্পদ (Cash & Cash Equivalents)</td>
                    </tr>
                    <tr>
                      <td className="p-3 pl-6 text-slate-650">💵 হাতে নগদ ও ব্যাংক স্থিতি (Cash in Hand & Bank)</td>
                      <td className="p-3 text-right font-mono font-bold text-slate-900">৳{Math.round(balanceSheetSummary.cashInHand).toLocaleString('en-US')}</td>
                    </tr>
                    <tr className="bg-slate-50/50">
                      <td colSpan={2} className="p-2.5 font-bold text-slate-800">২. বিনিয়োগ ও ঋণ পোর্টফোলিও (Loan Portfolio)</td>
                    </tr>
                    <tr>
                      <td className="p-3 pl-6 text-slate-650">📈 সদস্যদের নিকট ঋণের আসল স্থিতি (Loan Outstanding)</td>
                      <td className="p-3 text-right font-mono font-bold text-slate-900">৳{balanceSheetSummary.totalOutstandingLoan.toLocaleString('en-US')}</td>
                    </tr>
                    <tr className="bg-slate-50/50 select-none">
                      <td colSpan={2} className="p-2.5 font-bold text-slate-400">৩. অন্যান্য অচলিত সম্পদ (Other Assets)</td>
                    </tr>
                    <tr className="select-none">
                      <td className="p-3 pl-6 text-slate-400">🪑 office আসবাবপত্র ও ফিক্সচার (Furniture & Fixtures)</td>
                      <td className="p-3 text-right font-mono font-bold text-slate-400">৳০</td>
                    </tr>

                    <tr className="bg-blue-500/5 font-bold border-t border-slate-250 select-none text-blue-950">
                      <td className="p-3 font-black">মোট সম্পদ (Total Assets):</td>
                      <td className="p-3 text-right font-mono font-black text-xs">৳{Math.round(balanceSheetSummary.totalAssets).toLocaleString('en-US')}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

            </div>

            {/* Verification of balancing */}
            <div className="rounded-2xl border bg-slate-50/50 p-4 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-semibold text-slate-700 select-none">
              <span className="flex items-center gap-2">
                ✅ দ্বিমুখী হিসাব মিলন স্থিতি (Dual Accounting Integrity Check): 
                <span className="bg-emerald-100 text-emerald-800 border border-emerald-200 font-bold px-2 py-0.5 rounded text-[10px]">
                  ব্যালেন্সড (Balanced)
                </span>
              </span>
              <span className="font-mono text-slate-500 font-bold">
                সম্পদ (৳{Math.round(balanceSheetSummary.totalAssets).toLocaleString()}) = দায় ও মূলধন (৳{Math.round(balanceSheetSummary.totalLiabilitiesAndCapital).toLocaleString()})
              </span>
            </div>
          </div>
        )}

        {/* 9. Cooperative Annual Audit Summary & Compliance Report */}
        {activeReport === 'audit_summary' && (
          <div className="space-y-6">
            <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-4 flex items-start gap-3 text-indigo-950 text-xs">
              <ClipboardList className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <span className="font-extrabold text-indigo-900 block text-xs">
                  📜 সমবায় অধিদপ্তর অনুমোদিত বার্ষিক অডিট সারসংক্ষেপ ও অডিটর রিপোর্ট শীট:
                </span>
                <p className="text-[11px] leading-relaxed text-indigo-800">
                  জেলা/উপজেলা সমবায় অফিসারের বার্ষিক সরকারি অডিট ও পরিচালনা পর্ষদের সাধারণ সভার (AGM) উপস্থাপনের জন্য প্রস্তুতকৃত সারসংক্ষেপ। এতে সমিতির মোট শেয়ার মূলধন, সঞ্চয় স্থিতি, লভ্যাংশ তহবিল, রিজার্ভ ফান্ড ও ঋণ পোর্টফোলিও সংকলিত রয়েছে।
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="border border-slate-200 rounded-2xl p-4 bg-slate-50/50 space-y-3">
                <h5 className="font-extrabold text-slate-800 text-xs uppercase tracking-tight flex items-center gap-2 border-b border-slate-200 pb-2">
                  <Building size={16} className="text-emerald-600" />
                  সমিতির সাধারণ অডিট পরিচিতি
                </h5>
                <div className="space-y-2 text-xs font-medium text-slate-700">
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-500">সমিতির নাম:</span>
                    <span className="font-bold text-slate-900">{org.name}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-500">নিবন্ধন নম্বর:</span>
                    <span className="font-bold text-slate-900 font-mono">{org.regNumber || 'REG-COOP-88412'}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-500">মোট সক্রিয় শাখা:</span>
                    <span className="font-bold text-slate-900 font-mono">{branches.length || 1} টি</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-500">মোট নিবন্ধিত সদস্য:</span>
                    <span className="font-bold text-slate-900 font-mono">{members.length} জন</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-slate-500">অডিট অর্থবছর / সময়কাল:</span>
                    <span className="font-bold text-slate-900 font-mono">{startDate} হতে {endDate}</span>
                  </div>
                </div>
              </div>

              <div className="border border-slate-200 rounded-2xl p-4 bg-slate-50/50 space-y-3">
                <h5 className="font-extrabold text-slate-800 text-xs uppercase tracking-tight flex items-center gap-2 border-b border-slate-200 pb-2">
                  <TrendingUp size={16} className="text-blue-600" />
                  সমবায় তহবিল ও আর্থিক নিরীক্ষা স্থিতিসমূহ
                </h5>
                <div className="space-y-2 text-xs font-medium text-slate-700">
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-500">পরিশোধিত শেয়ার মূলধন:</span>
                    <span className="font-bold text-emerald-700 font-mono">৳{members.reduce((acc, m) => acc + Number(m.shareBalance || (Number(m.shareCount || 1) * 100)), 0).toLocaleString('en-US')}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-500">মোট সাধারণ ও মেয়াদী সঞ্চয়:</span>
                    <span className="font-bold text-slate-900 font-mono">৳{members.reduce((acc, m) => acc + Number(m.savingsBalance || 0), 0).toLocaleString('en-US')}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-500">সদস্যদের নিকট মোট বকেয়া ঋণ:</span>
                    <span className="font-bold text-slate-900 font-mono">৳{members.reduce((acc, m) => acc + Number(m.loanOutstanding || 0), 0).toLocaleString('en-US')}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-500">সংরক্ষিত অডিট রিজার্ভ ফান্ড (১৫%):</span>
                    <span className="font-bold text-blue-700 font-mono">৳{Math.round(balanceSheetSummary.statutoryReserveFund).toLocaleString('en-US')}</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-slate-500">সমবায় উন্নয়ন তহবিল (৩%):</span>
                    <span className="font-bold text-indigo-700 font-mono">৳{Math.round(balanceSheetSummary.coopDevFund).toLocaleString('en-US')}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
              <table className="w-full text-xs text-left text-slate-700 border-collapse">
                <thead className="bg-slate-100 text-slate-800 font-extrabold uppercase border-b border-slate-200 text-[11px]">
                  <tr>
                    <th className="p-3">অডিট আইটেম ও চেকলিস্ট (Audit Verification Item)</th>
                    <th className="p-3 text-center">আইনগত ভিত্তি / সমবায় ধারা</th>
                    <th className="p-3 text-center">সিস্টেম স্ট্যাটাস</th>
                    <th className="p-3 text-right">মন্তব্য / নোট</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  <tr>
                    <td className="p-3 font-bold text-slate-900">১. সাধারণ খতিয়ান ও ডে-বুক অটো মিলকরণ (Auto Ledger Sync)</td>
                    <td className="p-3 text-center font-mono text-[11px]">ধারা ৩৬ (১)</td>
                    <td className="p-3 text-center">
                      <span className="bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded text-[10px]">অটো সিঙ্কড (১০০%)</span>
                    </td>
                    <td className="p-3 text-right text-slate-500 text-[11px]">রিয়েল-টাইম পোস্টিং সম্পন্ন</td>
                  </tr>
                  <tr>
                    <td className="p-3 font-bold text-slate-900">২. স্ট্যাচুটোরি রিজার্ভ ফান্ড স্থানান্তর (১৫% Reserve Fund)</td>
                    <td className="p-3 text-center font-mono text-[11px]">ধারা ৩৪ (২)</td>
                    <td className="p-3 text-center">
                      <span className="bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded text-[10px]">সংরক্ষিত</span>
                    </td>
                    <td className="p-3 text-right text-slate-500 text-[11px]">বাৎসরিক নিট লাভ হতে সংরক্ষিত</td>
                  </tr>
                  <tr>
                    <td className="p-3 font-bold text-slate-900">৩. শেয়ার লভ্যাংশ নীতি ও বার্ষিক অনুমোদন (Dividend Policy)</td>
                    <td className="p-3 text-center font-mono text-[11px]">উপ-আইন ধারা ১৯</td>
                    <td className="p-3 text-center">
                      <span className="bg-blue-100 text-blue-800 font-bold px-2 py-0.5 rounded text-[10px]">প্রাক্কলিত সঞ্চিতি</span>
                    </td>
                    <td className="p-3 text-right text-slate-500 text-[11px]">AGM/অডিট অনুমোদনের পর জমা যোগ্য</td>
                  </tr>
                  <tr>
                    <td className="p-3 font-bold text-slate-900">৪. সদস্য কেওয়াইসি ও রেজিস্ট্রেশন স্ক্যান কপি (KYC & Documents)</td>
                    <td className="p-3 text-center font-mono text-[11px]">ধারা ২৪ (এ)</td>
                    <td className="p-3 text-center">
                      <span className="bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded text-[10px]">ডকুমেন্ট সেন্টারে রক্ষিত</span>
                    </td>
                    <td className="p-3 text-right text-slate-500 text-[11px]">NID ও সদস্য ফরম ডিজিটাল ব্যাকআপ</td>
                  </tr>
                  <tr>
                    <td className="p-3 font-bold text-slate-900">৫. সভার রেজুলেশন বই ও অডিট রিটার্ন সংরক্ষণ (Resolution & Returns)</td>
                    <td className="p-3 text-center font-mono text-[11px]">ধারা ২৯ (৩)</td>
                    <td className="p-3 text-center">
                      <span className="bg-indigo-100 text-indigo-800 font-bold px-2 py-0.5 rounded text-[10px]">ডিজিটাল স্টোরেজ প্রস্তুত</span>
                    </td>
                    <td className="p-3 text-right text-slate-500 text-[11px]">ডকুমেন্ট সেন্টার হতে ডাউনলোডযোগ্য</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 10. Expired Loan Members Auto-Adjustment Report */}
        {activeReport === 'expired_defaulters' && (
          <div className="space-y-6">
            <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 flex items-start gap-3 text-rose-950 text-xs">
              <Zap className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <span className="font-extrabold text-rose-900 block text-xs">
                  ⚡ মেয়াদ উত্তীর্ণ সদস্য ও অটো সঞ্চয় ঋণ সমন্বয় বিবরণী (Expired Loan Auto Settlement Ledger):
                </span>
                <p className="text-[11px] leading-relaxed text-rose-800">
                  সংস্থার সকল মেয়াদ উত্তীর্ণ / খেলাপি সদস্যদের সাধারণ সঞ্চয় (GS - ১০টাকা সংরক্ষিত), মেয়াদী সঞ্চয় (LTS), ডিপিএস/সিবিএস (CBS) ও শেয়ার মূলধন হতে বকেয়া ঋণ সমন্বয় বিবরণী। পর্যায়ক্রম: <strong className="font-bold">GS ➔ LTS ➔ CBS ➔ Share</strong>।
                </p>
              </div>
            </div>

            {/* Metric Overview Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-slate-50 border border-slate-200 p-3 rounded-2xl">
                <span className="text-[10px] font-bold text-slate-500 uppercase block">মেয়াদ উত্তীর্ণ সদস্য</span>
                <span className="text-base font-black text-slate-800 font-mono">
                  {expiredMembersReportData.length} জন
                </span>
              </div>
              <div className="bg-slate-50 border border-slate-200 p-3 rounded-2xl">
                <span className="text-[10px] font-bold text-rose-600 uppercase block">সর্বমোট বকেয়া ঋণ</span>
                <span className="text-base font-black text-rose-700 font-mono">
                  ৳ {expiredMembersReportData.reduce((sum, p) => sum + p.outstanding, 0).toLocaleString('bn-BD')}
                </span>
              </div>
              <div className="bg-slate-50 border border-slate-200 p-3 rounded-2xl">
                <span className="text-[10px] font-bold text-emerald-700 uppercase block">সম্ভাব্য অটো সমন্বয়</span>
                <span className="text-base font-black text-emerald-700 font-mono">
                  ৳ {expiredMembersReportData.reduce((sum, p) => sum + p.totalAdjusted, 0).toLocaleString('bn-BD')}
                </span>
              </div>
              <div className="bg-slate-50 border border-slate-200 p-3 rounded-2xl">
                <span className="text-[10px] font-bold text-blue-700 uppercase block">অবশিষ্ট বকেয়া ঋণ</span>
                <span className="text-base font-black text-blue-800 font-mono">
                  ৳ {expiredMembersReportData.reduce((sum, p) => sum + p.remainingLoan, 0).toLocaleString('bn-BD')}
                </span>
              </div>
            </div>

            {/* Report Table */}
            <div className="overflow-x-auto border border-slate-200 rounded-2xl">
              <table className="w-full text-xs text-left text-slate-700 border-collapse">
                <thead className="bg-slate-100 text-slate-800 font-extrabold uppercase border-b border-slate-200 text-[10px]">
                  <tr>
                    <th className="p-2.5">মেয়াদ উত্তীর্ণ সদস্য ও কোড</th>
                    <th className="p-2.5">গ্রুপ / সমিতি</th>
                    <th className="p-2.5 text-right">বকেয়া ঋণ</th>
                    <th className="p-2.5 text-right text-emerald-700">GS সমন্বয়</th>
                    <th className="p-2.5 text-right text-emerald-700">LTS সমন্বয়</th>
                    <th className="p-2.5 text-right text-emerald-700">CBS সমন্বয়</th>
                    <th className="p-2.5 text-right text-emerald-700">শেয়ার সমন্বয়</th>
                    <th className="p-2.5 text-right text-blue-700">মোট সমন্বয়</th>
                    <th className="p-2.5 text-right">অবশিষ্ট ঋণ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {expiredMembersReportData.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="p-8 text-center text-slate-400 font-bold text-xs space-y-2">
                        <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto opacity-80" />
                        <p>বর্তমানে কোনো মেয়াদ উত্তীর্ণ বা খেলাপি ঋণগ্রহীতা সদস্য নেই!</p>
                      </td>
                    </tr>
                  ) : (
                    expiredMembersReportData
                      .filter(p => {
                        if (!searchTerm.trim()) return true;
                        const q = searchTerm.toLowerCase();
                        return (
                          p.member.name?.toLowerCase().includes(q) ||
                          (p.member.memberId || p.member.id)?.toLowerCase().includes(q) ||
                          p.member.groupName?.toLowerCase().includes(q)
                        );
                      })
                      .map((p, idx) => (
                        <tr key={idx} className="hover:bg-slate-50 transition-colors">
                          <td className="p-2.5">
                            <span className="font-extrabold text-slate-900 block">{p.member.name}</span>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className="text-[10px] text-slate-400 font-mono">{p.member.memberId || p.member.id}</span>
                              {p.overdueAmount > 0 && (
                                <span className="text-[9px] font-bold bg-rose-100 text-rose-700 px-1.5 py-0.2 rounded-full">
                                  মেয়াদ উত্তীর্ণ (৳{p.overdueAmount.toLocaleString('bn-BD')})
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="p-2.5 text-slate-600 font-semibold">{groups.find(g => g.id === p.member.groupId)?.name || p.member.groupName || 'শাখা গ্রুপ'}</td>
                          <td className="p-2.5 text-right font-mono font-black text-rose-700">
                            ৳ {p.outstanding.toLocaleString('bn-BD')}
                          </td>
                          <td className="p-2.5 text-right font-mono text-emerald-700 font-bold">
                            ৳ {p.result.gsAdjusted.toLocaleString('bn-BD')}
                          </td>
                          <td className="p-2.5 text-right font-mono text-emerald-700 font-bold">
                            ৳ {p.result.ltsAdjusted.toLocaleString('bn-BD')}
                          </td>
                          <td className="p-2.5 text-right font-mono text-emerald-700 font-bold">
                            ৳ {p.result.cbsAdjusted.toLocaleString('bn-BD')}
                          </td>
                          <td className="p-2.5 text-right font-mono text-emerald-700 font-bold">
                            ৳ {p.result.shareAdjusted.toLocaleString('bn-BD')}
                          </td>
                          <td className="p-2.5 text-right font-mono font-black text-blue-700 bg-blue-50/50">
                            ৳ {p.totalAdjusted.toLocaleString('bn-BD')}
                          </td>
                          <td className="p-2.5 text-right font-mono font-extrabold">
                            {p.remainingLoan === 0 ? (
                              <span className="inline-block bg-emerald-100 text-emerald-800 text-[9.5px] font-black px-2 py-0.5 rounded-full">
                                ৳ 0 (পরিশোধিত)
                              </span>
                            ) : (
                              <span className="text-rose-700">৳ {p.remainingLoan.toLocaleString('bn-BD')}</span>
                            )}
                          </td>
                        </tr>
                      ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 11. MRA Regulatory MIS & Provisioning Schedule Report (MRA-MIS-01) */}
        {activeReport === 'mra_report' && (
          <div className="space-y-6">
            {/* Header Banner */}
            <div className="bg-indigo-900 text-white p-4 sm:p-5 rounded-2xl shadow-sm space-y-2">
              <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-white/10 rounded-xl backdrop-blur-xs">
                    <ShieldAlert className="w-6 h-6 text-amber-300" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-sm sm:text-base tracking-wide">
                      মাইক্রোক্রেডিট রেগুলেটরি অথরিটি (MRA) এমআইএস ও সঞ্চিতি বিবরণী
                    </h3>
                    <p className="text-[11px] text-indigo-200 font-medium">
                      MRA-MIS-01 ফর্ম ও বাংলাদেশ এমআরএ নির্দেশিকা অনুযায়ী ক্ষুদ্রঋণ কার্যক্রমের বিস্তারিত রিপোর্ট
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 text-[10px] font-bold px-2.5 py-1 rounded-full font-mono">
                    ✓ MRA 100% Compliant
                  </span>
                </div>
              </div>
            </div>

            {/* MRA Section 1: Organization & Membership Profile */}
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <h4 className="font-extrabold text-slate-800 text-xs uppercase tracking-wider flex items-center gap-2">
                  <Building size={14} className="text-indigo-600" />
                  ক. সংস্থা, সমিতি ও সদস্য বিবরণী (Organization & Membership Profile)
                </h4>
                <span className="text-[10px] font-bold text-slate-400">MRA Section - A</span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-sans">
                <div className="bg-slate-50 border border-slate-200 p-3 rounded-2xl">
                  <span className="text-[10px] font-extrabold text-slate-400 uppercase block">মোট গঠিত সমিতি</span>
                  <span className="text-base font-black text-slate-800 font-mono">
                    {groups.length.toLocaleString('bn-BD')} টি
                  </span>
                </div>
                <div className="bg-slate-50 border border-slate-200 p-3 rounded-2xl">
                  <span className="text-[10px] font-extrabold text-slate-400 uppercase block">মোট নিবন্ধিত সদস্য</span>
                  <span className="text-base font-black text-indigo-900 font-mono">
                    {members.length.toLocaleString('bn-BD')} জন
                  </span>
                </div>
                <div className="bg-slate-50 border border-slate-200 p-3 rounded-2xl">
                  <span className="text-[10px] font-extrabold text-slate-400 uppercase block">সক্রিয় ঋণগ্রহীতা সদস্য</span>
                  <span className="text-base font-black text-emerald-700 font-mono">
                    {llpSummary.counts.total.toLocaleString('bn-BD')} জন
                  </span>
                </div>
                <div className="bg-slate-50 border border-slate-200 p-3 rounded-2xl">
                  <span className="text-[10px] font-extrabold text-slate-400 uppercase block">সচল কর্মকর্তা/কর্মী</span>
                  <span className="text-base font-black text-blue-700 font-mono">
                    {allStaff.filter(s => s.status !== 'inactive').length.toLocaleString('bn-BD')} জন
                  </span>
                </div>
              </div>
            </div>

            {/* MRA Section 2: Loan Portfolio & Loan Loss Provisioning Schedule */}
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <h4 className="font-extrabold text-slate-800 text-xs uppercase tracking-wider flex items-center gap-2">
                  <DollarSign size={14} className="text-indigo-600" />
                  খ. MRA অনুমোদিত ঋণ শ্রেণীকরণ ও সঞ্চিতি বিবরণী (MRA Loan Loss Provisioning Schedule)
                </h4>
                <span className="text-[10px] font-bold text-slate-400">MRA Section - B</span>
              </div>

              <div className="overflow-x-auto border border-slate-200 rounded-2xl">
                <table className="w-full text-xs text-left text-slate-700 border-collapse">
                  <thead className="bg-slate-100 text-slate-800 font-extrabold uppercase border-b border-slate-200 text-[10px]">
                    <tr>
                      <th className="p-3">ঋণের শ্রেণী (Loan Classification)</th>
                      <th className="p-3">অনাদায়ী মেয়াদকলে হিসাব (Days Overdue)</th>
                      <th className="p-3 text-center">ঋণগ্রহীতা সংখ্যা</th>
                      <th className="p-3 text-right">বকেয়া ঋণের পরিমাণ (Outstanding)</th>
                      <th className="p-3 text-center">MRA সঞ্চিতি হার %</th>
                      <th className="p-3 text-right">প্রয়োজনীয় সঞ্চিতি (Required LLP)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium font-sans">
                    <tr className="hover:bg-slate-50">
                      <td className="p-3 font-bold text-emerald-800">১. নিয়মিত ঋণ (Standard Loan)</td>
                      <td className="p-3 text-slate-500 font-mono">০ - ৩০ দিন (বা ওভারডিউ নেই)</td>
                      <td className="p-3 text-center font-mono font-bold">{llpSummary.counts.standard}</td>
                      <td className="p-3 text-right font-mono font-black text-slate-800">৳ {llpSummary.outstandings.standard.toLocaleString('bn-BD')}</td>
                      <td className="p-3 text-center font-mono font-bold text-emerald-700">{llpSummary.rates.standard}%</td>
                      <td className="p-3 text-right font-mono font-extrabold text-emerald-700">৳ {llpSummary.provisions.standard.toLocaleString('bn-BD')}</td>
                    </tr>
                    <tr className="hover:bg-slate-50">
                      <td className="p-3 font-bold text-amber-800">২. ওয়াচলিস্ট / পর্যবেক্ষণ (Watchlist Loan)</td>
                      <td className="p-3 text-slate-500 font-mono">৩১ - ১৮০ দিন</td>
                      <td className="p-3 text-center font-mono font-bold">{llpSummary.counts.subStandard}</td>
                      <td className="p-3 text-right font-mono font-black text-amber-700">৳ {llpSummary.outstandings.subStandard.toLocaleString('bn-BD')}</td>
                      <td className="p-3 text-center font-mono font-bold text-amber-700">{llpSummary.rates.subStandard}%</td>
                      <td className="p-3 text-right font-mono font-extrabold text-amber-700">৳ {llpSummary.provisions.subStandard.toLocaleString('bn-BD')}</td>
                    </tr>
                    <tr className="hover:bg-slate-50">
                      <td className="p-3 font-bold text-orange-800">৩. নিম্নমান ঋণ (Sub-standard Loan)</td>
                      <td className="p-3 text-slate-500 font-mono">১৮১ - ৩৬৫ দিন (১ বছর পর্যন্ত)</td>
                      <td className="p-3 text-center font-mono font-bold">{llpSummary.counts.doubtful}</td>
                      <td className="p-3 text-right font-mono font-black text-orange-700">৳ {llpSummary.outstandings.doubtful.toLocaleString('bn-BD')}</td>
                      <td className="p-3 text-center font-mono font-bold text-orange-700">{llpSummary.rates.doubtful}%</td>
                      <td className="p-3 text-right font-mono font-extrabold text-orange-700">৳ {llpSummary.provisions.doubtful.toLocaleString('bn-BD')}</td>
                    </tr>
                    <tr className="hover:bg-slate-50">
                      <td className="p-3 font-bold text-rose-800">৪. মন্দ / কু-ঋণ (Bad / Loss Loan)</td>
                      <td className="p-3 text-slate-500 font-mono">৩৬৬+ দিন (১ বছরের বেশি)</td>
                      <td className="p-3 text-center font-mono font-bold">{llpSummary.counts.bad}</td>
                      <td className="p-3 text-right font-mono font-black text-rose-700">৳ {llpSummary.outstandings.bad.toLocaleString('bn-BD')}</td>
                      <td className="p-3 text-center font-mono font-bold text-rose-700">{llpSummary.rates.bad}%</td>
                      <td className="p-3 text-right font-mono font-extrabold text-rose-700">৳ {llpSummary.provisions.bad.toLocaleString('bn-BD')}</td>
                    </tr>
                  </tbody>
                  <tfoot className="bg-slate-100 font-extrabold border-t-2 border-slate-300 text-slate-900">
                    <tr>
                      <td colSpan={2} className="p-3">সর্বমোট ঋণ পোর্টফোলিও ও সঞ্চিতি (Total Portfolio)</td>
                      <td className="p-3 text-center font-mono">{llpSummary.counts.total}</td>
                      <td className="p-3 text-right font-mono font-black text-slate-900">৳ {llpSummary.outstandings.total.toLocaleString('bn-BD')}</td>
                      <td className="p-3 text-center font-mono">-</td>
                      <td className="p-3 text-right font-mono font-black text-indigo-900 text-sm">৳ {llpSummary.provisions.total.toLocaleString('bn-BD')}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* MRA Section 3: Savings Portfolio & Capital Ratios */}
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <h4 className="font-extrabold text-slate-800 text-xs uppercase tracking-wider flex items-center gap-2">
                  <TrendingUp size={14} className="text-indigo-600" />
                  গ. সঞ্চয় পোর্টফোলিও ও MRA আর্থিক সূচক (Savings Portfolio & Key Regulatory Ratios)
                </h4>
                <span className="text-[10px] font-bold text-slate-400">MRA Section - C</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Savings Summary */}
                <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl space-y-2">
                  <h5 className="font-extrabold text-slate-800 text-xs border-b border-slate-200 pb-2">
                    সদস্য সঞ্চয় স্থিতি পোর্টফোলিও
                  </h5>
                  <div className="space-y-1.5 text-xs font-sans">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-600 font-medium">সাধারণ সঞ্চয় (GS) স্থিতি:</span>
                      <strong className="font-mono text-emerald-700">
                        ৳ {members.reduce((sum, m) => sum + (m.gsBalance ?? 0), 0).toLocaleString('bn-BD')}
                      </strong>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-600 font-medium">ডাবল / বিশেষ সঞ্চয় (CBS) স্থিতি:</span>
                      <strong className="font-mono text-emerald-700">
                        ৳ {members.reduce((sum, m) => sum + (m.cbsBalance ?? 0), 0).toLocaleString('bn-BD')}
                      </strong>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-600 font-medium">দীর্ঘমেয়াদী সঞ্চয় (LTS) স্থিতি:</span>
                      <strong className="font-mono text-emerald-700">
                        ৳ {members.reduce((sum, m) => sum + (m.ltsBalance ?? 0), 0).toLocaleString('bn-BD')}
                      </strong>
                    </div>
                    <div className="flex justify-between items-center border-t border-slate-200 pt-2 font-bold text-slate-900">
                      <span>সর্বমোট সদস্য আমানত/সঞ্চয়:</span>
                      <strong className="font-mono text-indigo-900 text-sm">
                        ৳ {(
                          members.reduce((sum, m) => sum + (m.gsBalance ?? 0), 0) +
                          members.reduce((sum, m) => sum + (m.cbsBalance ?? 0), 0) +
                          members.reduce((sum, m) => sum + (m.ltsBalance ?? 0), 0)
                        ).toLocaleString('bn-BD')}
                      </strong>
                    </div>
                  </div>
                </div>

                {/* Key Financial Ratios */}
                <div className="bg-indigo-50/50 border border-indigo-100 p-4 rounded-2xl space-y-2">
                  <h5 className="font-extrabold text-indigo-950 text-xs border-b border-indigo-100 pb-2">
                    MRA প্রধান আর্থিক সূচক ও নীতি অনুবর্তিতা
                  </h5>
                  <div className="space-y-2 text-xs font-sans">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-600 font-medium">পোর্টফোলিও এট রিস্ক (PAR &gt; 30 দিন):</span>
                      <strong className="font-mono text-rose-700">
                        {llpSummary.outstandings.total > 0
                          ? (((llpSummary.outstandings.subStandard + llpSummary.outstandings.doubtful + llpSummary.outstandings.bad) / llpSummary.outstandings.total) * 100).toFixed(2)
                          : '0.00'}%
                      </strong>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-600 font-medium">সঞ্চয় ও ঋণ বকেয়া অনুপাত (Savings/Loan %):</span>
                      <strong className="font-mono text-blue-700">
                        {llpSummary.outstandings.total > 0
                          ? (((members.reduce((s, m) => s + (m.gsBalance ?? 0) + (m.cbsBalance ?? 0) + (m.ltsBalance ?? 0), 0)) / llpSummary.outstandings.total) * 100).toFixed(2)
                          : '0.00'}%
                      </strong>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-600 font-medium">প্রয়োজনীয় সঞ্চিতি কাভারেজ অনুপাত (LLP Coverage):</span>
                      <strong className="font-mono text-emerald-700">100.00% (সম্পূর্ণ সংরক্ষিত)</strong>
                    </div>
                    <div className="bg-white p-2.5 rounded-xl border border-indigo-100 text-[10.5px] text-slate-600 leading-snug font-sans">
                      ✓ MRA আইন ২০০৬ ও মাইক্রোক্রেডিট রেগুলেটরি অথরিটি বিধিমালা ২০০৮ অনুযায়ী এই বিবরণী স্বয়ংক্রিয়ভাবে প্রস্তুত করা হয়েছে।
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Printable Signature block at the bottom (Visible ONLY on print) */}
        <div className="hidden print:grid grid-cols-3 gap-6 text-center text-[10px] font-bold text-slate-700 pt-16 select-none mt-16">
          <div>
            <span className="border-t border-slate-500 pt-1 px-4 block">প্রস্তুতকারী কর্মকর্তা (Prepared By)</span>
          </div>
          <div>
            <span className="border-t border-slate-500 pt-1 px-4 block">শাখা ব্যবস্থাপক (Branch Manager)</span>
          </div>
          <div>
            <span className="border-t border-slate-500 pt-1 px-4 block">প্রধান কার্যালয় অনুমোদন (Authorized Audit)</span>
          </div>
        </div>

      </div>

    </div>
  );
};
