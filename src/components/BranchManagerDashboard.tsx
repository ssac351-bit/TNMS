/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, 
  Users, 
  CreditCard, 
  Layers, 
  Plus, 
  Edit, 
  Trash2, 
  ArrowLeft, 
  RefreshCw, 
  Calendar, 
  Check, 
  AlertCircle, 
  LogOut, 
  CheckCircle2, 
  UserCheck, 
  ShieldAlert, Lock, AlertTriangle, Zap,
  ArrowLeftRight, 
  HelpCircle,
  Menu,
  Maximize2,
  Minimize2,
  FileText,
  UserX,
  BookOpen,
  DollarSign,
  Clock,
  Key,
  Building,
  X,
  Search,
  Sliders,
  CalendarRange,
  FileSpreadsheet,
  Save,
  Download,
  Upload,
  Cloud,
  FileClock,
  Banknote,
  HandCoins,
  Power,
  UserPlus,
  Coins,
  PiggyBank,
  ClipboardList,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Info,
  Printer,
  Percent,
  TrendingDown,
  ShieldCheck
} from 'lucide-react';
import { Organization, Staff, Group, Branch, Holiday } from '../types';
import { processLoanAdjustment } from '../lib/loanAdjustment';
import { MemberAdmissionForm } from './MemberAdmissionForm';
import { UnifiedReportsPanel } from './UnifiedReportsPanel';
import { MemberInformationView } from './MemberInformationView';
import DocumentCenter from './DocumentCenter';
import InterestProvisionPanel from './InterestProvisionPanel';
import YearEndClosingPanel from './YearEndClosingPanel';
import { MemberTransactionView, calculateLoanOverdueAndSchedule } from './MemberTransactionView';
import ChartOfAccountsView from './ChartOfAccountsView';
import { GeneralJournalView } from './GeneralJournalView';
import { COA_TREE } from '../lib/coa';
import { LoanProposalView } from './LoanProposalView';
import { LoanDisburseView } from './LoanDisburseView';
import { AddSavingsAccountForm } from './AddSavingsAccountForm';
import { AddCbsAccountForm } from './AddCbsAccountForm';
import { AddLtsAccountForm } from './AddLtsAccountForm';
import { MemberBalanceView } from './MemberBalanceView';
import { ShareManagementView } from './ShareManagementView';
import { RealizedInformationView } from './RealizedInformationView';
import { TransactionSummaryView } from './TransactionSummaryView';
import { getDefaultHolidays } from '../utils/holidayHelper';
import SyncStatusHub from './SyncStatusHub';
import { PwaInstallBanner } from './PwaInstallBanner';
import { MasterRollView } from './MasterRollView';
import { CashReceiptPaymentView } from './CashReceiptPaymentView';
import { registerDeletedId } from '../lib/deletedIds';
import { TanzilLogo } from './TanzilLogo';
import { OrgLogo } from './OrgLogo';
import { formatDDMMYYYY, downloadExcelCsv } from '../lib/dateUtils';

interface BranchManagerDashboardProps {
  org: Organization;
  staff: Staff; // Logged-in Branch Manager details
  onLogout: () => void;
  isSimulated?: boolean;
}

export default function BranchManagerDashboard({ org, staff, onLogout, isSimulated }: BranchManagerDashboardProps) {
  const isBM = staff.designation === 'শাখা ব্যবস্থাপক';
  const isRealBMReadOnly = !isSimulated && staff.designation === 'শাখা ব্যবস্থাপক';
  console.log("staff designation:", staff.designation, "isBM:", isBM, "isRealBMReadOnly:", isRealBMReadOnly);

  // Working day retrieved from localStorage (Branch-specific, isolated for simulated admin overview)
  const workingDayKey = isSimulated
    ? `tanzil_working_day_${org.id}_branch_${staff.branchId || 'default'}_simulated`
    : `tanzil_working_day_${org.id}_branch_${staff.branchId || 'default'}`;
  const closedDaysKey = isSimulated
    ? `tanzil_closed_days_${org.id}_branch_${staff.branchId || 'default'}_simulated`
    : `tanzil_closed_days_${org.id}_branch_${staff.branchId || 'default'}`;

  // Navigation states
  const [activeTab, setActiveTab] = useState<'home' | 'dashboard' | 'hrm' | 'account' | 'holidays' | 'reports'>('home');

  React.useEffect(() => {
    if (!isBM && ['hrm', 'account', 'holidays'].includes(activeTab)) {
      setActiveTab('home');
    }
  }, [activeTab, isBM]);
  const [accountSubTab, setAccountSubTab] = useState<'cash_book' | 'double_entry' | 'coa' | 'ledger' | 'journal' | 'cash_receipt_payment' | 'depreciation' | 'llpf'>('cash_book');
  const [depRateBuilding, setDepRateBuilding] = useState<string>('5');
  const [depRateFurniture, setDepRateFurniture] = useState<string>('10');
  const [depRateComputer, setDepRateComputer] = useState<string>('20');
  const [depRateVehicle, setDepRateVehicle] = useState<string>('15');
  const [depPeriod, setDepPeriod] = useState<'monthly' | 'yearly'>('monthly');

  const [llpStandardRate, setLlpStandardRate] = useState<string>(() => localStorage.getItem(`tanzil_llp_standard_${org.id}`) || '1');
  const [llpSubStandardRate, setLlpSubStandardRate] = useState<string>(() => localStorage.getItem(`tanzil_llp_substandard_${org.id}`) || '5');
  const [llpDoubtfulRate, setLlpDoubtfulRate] = useState<string>(() => localStorage.getItem(`tanzil_llp_doubtful_${org.id}`) || '50');
  const [llpBadRate, setLlpBadRate] = useState<string>(() => localStorage.getItem(`tanzil_llp_bad_${org.id}`) || '100');
  const [llpManualAmount, setLlpManualAmount] = useState<string>('');

  // Bank accounts state & inputs
  const [bankAccounts, setBankAccounts] = useState<any[]>(() => {
    const saved = localStorage.getItem(`tanzil_bank_accounts_${org.id}`);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      } catch (e) {
        console.error("Error loading bank accounts:", e);
      }
    }
    return []; // No default demo bank accounts to respect user request
  });

  const [isBankModalOpen, setIsBankModalOpen] = useState(false);
  const [bankNameInput, setBankNameInput] = useState('');
  const [bankAccountNoInput, setBankAccountNoInput] = useState('');
  const [bankBranchInput, setBankBranchInput] = useState('');
  const [bankTypeInput, setBankTypeInput] = useState<'চলতি (Current)' | 'সঞ্চয়ী (Savings)' | 'এসএনডি (SND)' | 'এফডিআর (FDR)'>('চলতি (Current)');
  const [bankInitialBalanceInput, setBankInitialBalanceInput] = useState('');

  // Selected Bank for individual Bank Statement viewing
  const [selectedBankStatementId, setSelectedBankStatementId] = useState<string>(() => {
    const saved = localStorage.getItem(`tanzil_bank_accounts_${org.id}`);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed[0].id;
        }
      } catch (e) {}
    }
    return '';
  });

  // Selected head for General Ledger view
  const [selectedLedgerHead, setSelectedLedgerHead] = useState<string>('cash');
  const [selectedLedgerBankId, setSelectedLedgerBankId] = useState<string>('all');
  const [ledgerStartDate, setLedgerStartDate] = useState<string>('');
  const [ledgerEndDate, setLedgerEndDate] = useState<string>('');
  const [ledgerSearchQuery, setLedgerSearchQuery] = useState<string>('');

  // Double entry voucher fields
  const [voucherType, setVoucherType] = useState<'receipt' | 'payment'>('receipt');
  const [voucherDebitAcc, setVoucherDebitAcc] = useState<string>('cash');
  const [voucherCreditAcc, setVoucherCreditAcc] = useState<string>('admission_fee');
  const [voucherAmount, setVoucherAmount] = useState<string>('');
  const [voucherNote, setVoucherNote] = useState<string>('');

  // Working day state initialized from the branch-isolated key (or manager user-specific override if present for Admin simulation)
  const [workingDay, setWorkingDay] = useState<string>(() => {
    if (isSimulated) {
      const managerOverrideKey = `tanzil_working_day_override_${org.id}_branch_${staff.branchId || 'default'}_user_${staff.id || staff.staffId || 'admin'}`;
      const savedOverride = localStorage.getItem(managerOverrideKey);
      if (savedOverride) return savedOverride;
    }

    const savedBranchDay = localStorage.getItem(workingDayKey);
    if (savedBranchDay) return savedBranchDay;

    // First time initializing: default to current date
    const fallback = new Date().toISOString().split('T')[0];
    localStorage.setItem(workingDayKey, fallback);
    return fallback;
  });

  const [voucherDateInput, setVoucherDateInput] = useState<string>(workingDay);
  const [singleTxDate, setSingleTxDate] = useState<string>(workingDay);

  // Automatically reset selectedLedgerBankId when selectedLedgerHead changes
  React.useEffect(() => {
    setSelectedLedgerBankId('all');
  }, [selectedLedgerHead]);
  const [cashBookViewMode, setCashBookViewMode] = useState<'t_summary' | 'columnar'>('columnar');
  const [cashBookStartDate, setCashBookStartDate] = useState<string>('');
  const [cashBookEndDate, setCashBookEndDate] = useState<string>('');

  const [isFullScreenOperation, setIsFullScreenOperation] = useState(false);
  const [isSidebarHidden, setIsSidebarHidden] = useState(false);
  const [statementModalAccount, setStatementModalAccount] = useState<any | null>(null);
  const [isBatchDefaulterModalOpen, setIsBatchDefaulterModalOpen] = useState(false);
  const [batchSearchQuery, setBatchSearchQuery] = useState('');
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [selectedOperation, setSelectedOperation] = useState<'menu' | 'add_group' | 'group_operation' | 'move_group' | 'loan_proposal_requests' | 'exemption_requests' | 'chart_of_accounts' | 'master_roll' | 'savings_refund_approval' | 'savings_refund_and_adjustment' | 'transaction_summary' | 'interest_posting' | 'document_center' | 'interest_provision' | 'year_end_closing' | 'share_management'>('menu');

  const [journalVoucherDate, setJournalVoucherDate] = useState<string>(workingDay);
  const [selectedViewDate, setSelectedViewDate] = useState<string>(workingDay);

  const [closedDays, setClosedDays] = useState<string[]>(() => {
    const saved = localStorage.getItem(closedDaysKey);
    if (saved) return JSON.parse(saved);
    
    const globalSaved = localStorage.getItem(`tanzil_closed_days_${org.id}`);
    if (globalSaved) {
      localStorage.setItem(closedDaysKey, globalSaved);
      return JSON.parse(globalSaved);
    }
    return [];
  });

  const getCalculatedNextWorkingDay = (currentDayStr: string, holidayList: Holiday[] = []): string => {
    if (!currentDayStr) return new Date().toISOString().split('T')[0];
    const [y, m, d] = currentDayStr.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    
    const checkIsHolidayLocal = (testDate: Date, list: Holiday[]): boolean => {
      if (!Array.isArray(list)) return false;
      const dateStr = `${testDate.getFullYear()}-${String(testDate.getMonth() + 1).padStart(2, '0')}-${String(testDate.getDate()).padStart(2, '0')}`;
      const dayNames = ['রবিবার', 'সোমবার', 'মঙ্গলবার', 'বুধবার', 'বৃহস্পতিবার', 'শুক্রবার', 'শনিবার'];
      const bDay = dayNames[testDate.getDay()];
      
      return list.some(h => {
        if (h.type === 'direct') {
          return h.date === dateStr;
        } else if (h.type === 'general') {
          return h.dayOfWeek === bDay;
        }
        return false;
      });
    };

    let safetyCounter = 0;
    while (safetyCounter < 365) {
      date.setDate(date.getDate() + 1);
      if (!checkIsHolidayLocal(date, holidayList)) {
        break;
      }
      safetyCounter++;
    }

    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  };

  const handleCloseDay = () => {
    if (!isBM && !isSimulated) {
      alert('শুধুমাত্র শাখা ব্যবস্থাপক (BM) বা অ্যাডমিন কর্মদিবস সমাপ্ত (ডে ক্লোজ) করতে পারেন।');
      return;
    }
    console.log("handleCloseDay called. Current workingDay:", workingDay);
    if (!window.confirm(`${workingDay} এই দিনটি সফলভাবে ক্লোজ করে পরবর্তী কর্মদিবসে প্রবেশ করতে চান?`)) return;
    
    // Add to closed days across all branch & admin keys
    const updatedClosedDays = Array.from(new Set([...closedDays, workingDay]));
    setClosedDays(updatedClosedDays);
    const branchId = staff.branchId || 'default';
    const realClosedKey = `tanzil_closed_days_${org.id}_branch_${branchId}`;
    const simClosedKey = `tanzil_closed_days_${org.id}_branch_${branchId}_simulated`;
    const adminClosedKey = `tanzil_admin_closed_days_${org.id}`;
    
    localStorage.setItem(closedDaysKey, JSON.stringify(updatedClosedDays));
    localStorage.setItem(realClosedKey, JSON.stringify(updatedClosedDays));
    localStorage.setItem(simClosedKey, JSON.stringify(updatedClosedDays));
    localStorage.setItem(adminClosedKey, JSON.stringify(updatedClosedDays));
    
    // Move to next day (robust calculation skipping holidays)
    const nextDay = getCalculatedNextWorkingDay(workingDay, holidays);

    // Month-end auto-posting of Depreciation and LLPF
    const currentMonth = workingDay.split('-')[1];
    const nextMonth = nextDay.split('-')[1];
    if (currentMonth !== nextMonth) {
      console.log("Month-end detected! Auto-posting Depreciation and LLPF.");
      let updatedTransactions = [...transactions];
      let postedSomething = false;
      let msgParts: string[] = [];

      // 1. Depreciation Auto-Post
      const alreadyHasDepreciation = transactions.some(t => t.date === workingDay && t.debitAcc === 'depreciation_expense');
      if (!alreadyHasDepreciation) {
        const getBalance = (accId: string, txs: any[]) => {
          if (accId === 'land_building') {
            return txs.reduce((sum, t) => {
              let val = sum;
              if (t.debitAcc === 'land_building') val += Number(t.amount || 0);
              if (t.creditAcc === 'land_building') val -= Number(t.amount || 0);
              return val;
            }, 0) + txs.filter(t => !t.debitAcc && !t.creditAcc && ((t.category || '').includes('জমি') || (t.category || '').includes('ভবন'))).reduce((sum, t) => sum + Number(t.amount || 0), 0);
          }
          if (accId === 'furniture') {
            return txs.reduce((sum, t) => {
              let val = sum;
              if (t.debitAcc === 'furniture') val += Number(t.amount || 0);
              if (t.creditAcc === 'furniture') val -= Number(t.amount || 0);
              return val;
            }, 0) + txs.filter(t => !t.debitAcc && !t.creditAcc && (t.category || '').includes('আসবাবপত্র')).reduce((sum, t) => sum + Number(t.amount || 0), 0);
          }
          if (accId === 'computer_it') {
            return txs.reduce((sum, t) => {
              let val = sum;
              if (t.debitAcc === 'computer_it') val += Number(t.amount || 0);
              if (t.creditAcc === 'computer_it') val -= Number(t.amount || 0);
              return val;
            }, 0) + txs.filter(t => !t.debitAcc && !t.creditAcc && ((t.category || '').includes('কম্পিউটার') || (t.category || '').includes('আইটি'))).reduce((sum, t) => sum + Number(t.amount || 0), 0);
          }
          if (accId === 'vehicles') {
            return txs.reduce((sum, t) => {
              let val = sum;
              if (t.debitAcc === 'vehicles') val += Number(t.amount || 0);
              if (t.creditAcc === 'vehicles') val -= Number(t.amount || 0);
              return val;
            }, 0) + txs.filter(t => !t.debitAcc && !t.creditAcc && ((t.category || '').includes('যানবাহন') || (t.category || '').includes('মোটরসাইকেল'))).reduce((sum, t) => sum + Number(t.amount || 0), 0);
          }
          return 0;
        };

        const assets = [
          { id: 'land_building', name: 'জমি ও ভবন', code: '1301', balance: getBalance('land_building', updatedTransactions), rate: Number(depRateBuilding) || 0 },
          { id: 'furniture', name: 'অফিস আসবাবপত্র ও ফিক্সচার', code: '1302', balance: getBalance('furniture', updatedTransactions), rate: Number(depRateFurniture) || 0 },
          { id: 'computer_it', name: 'কম্পিউটার ও আইটি সরঞ্জাম', code: '1303', balance: getBalance('computer_it', updatedTransactions), rate: Number(depRateComputer) || 0 },
          { id: 'vehicles', name: 'যানবাহন/মোটরসাইকেল', code: '1304', balance: getBalance('vehicles', updatedTransactions), rate: Number(depRateVehicle) || 0 }
        ];

        const newDepVouchers: any[] = [];
        assets.forEach(a => {
          const factor = depPeriod === 'monthly' ? (12 * 100) : 100;
          const depAmt = Math.round(a.balance * (a.rate / factor));
          if (depAmt > 0) {
            newDepVouchers.push({
              id: `DEP-AUTO-${Date.now().toString().slice(-4)}-${a.code}`,
              type: 'expense',
              category: 'স্থায়ী সম্পদের অবচয় খরচ',
              amount: depAmt,
              note: `${a.name} এর অবচয় অবলোপন (হার: ${a.rate}%, সময়কাল: ${depPeriod === 'monthly' ? 'মাসিক' : 'বাৎসরিক'}) [অটো-পোস্ট]`,
              date: workingDay,
              addDate: workingDay,
              debitAcc: 'depreciation_expense',
              creditAcc: a.id,
              paymentMode: 'cash'
            });
          }
        });

        if (newDepVouchers.length > 0) {
          updatedTransactions = [...newDepVouchers, ...updatedTransactions];
          postedSomething = true;
          const totalDep = newDepVouchers.reduce((sum, v) => sum + v.amount, 0);
          msgParts.push(`স্থায়ী সম্পদের অবচয় অবলোপন (৳${totalDep.toLocaleString('bn-BD')})`);
        }
      }

      // 2. LLPF Auto-Post
      const alreadyHasLLPF = transactions.some(t => t.date === workingDay && t.creditAcc === 'llpf');
      if (!alreadyHasLLPF) {
        const holidaysList = JSON.parse(localStorage.getItem(`tanzil_holidays_${org.id}`) || '[]');
        const branchGroups = JSON.parse(localStorage.getItem(`tanzil_groups_${org.id}`) || '[]');
        const refDate = workingDay;

        const getLLPFReserve = (txs: any[]) => {
          return txs.reduce((sum, t) => {
            let val = sum;
            if (t.creditAcc === 'llpf') val += Number(t.amount || 0);
            if (t.debitAcc === 'llpf') val -= Number(t.amount || 0);
            return val;
          }, 0) + txs.filter(t => !t.debitAcc && !t.creditAcc && (t.category || '').includes('LLPF')).reduce((sum, t) => sum + Number(t.amount || 0), 0);
        };

        const ledgerLLPFReserve = getLLPFReserve(updatedTransactions);

        const parseBengaliOrEnglishFloat = (val: string | null, fallback: number): number => {
          if (!val) return fallback;
          const englishDigits = val.replace(/[০-৯]/g, d => '০১২৩৪৫৬৭৮৯'.indexOf(d).toString());
          const parsed = parseFloat(englishDigits);
          return isNaN(parsed) ? fallback : parsed;
        };

        const rawLlpStandardRate = parseBengaliOrEnglishFloat(llpStandardRate, 1);
        const rawLlpSubStandardRate = parseBengaliOrEnglishFloat(llpSubStandardRate, 5);
        const rawLlpDoubtfulRate = parseBengaliOrEnglishFloat(llpDoubtfulRate, 50);
        const rawLlpBadRate = parseBengaliOrEnglishFloat(llpBadRate, 100);

        let standardOutstanding = 0;
        let subStandardOutstanding = 0;
        let doubtfulOutstanding = 0;
        let badOutstanding = 0;

        groupMembers.filter((m: any) => (m.plOutstanding ?? 0) > 0).forEach((m: any) => {
          const outstanding = m.plOutstanding ?? 0;
          const loanStatus = calculateLoanOverdueAndSchedule(m, updatedTransactions, refDate, holidaysList, branchGroups);
          const daysOverdue = loanStatus.daysOverdue ?? 0;
          const overdueAmount = loanStatus.overdueAmount;

          if (overdueAmount <= 0 || daysOverdue === 0) {
            standardOutstanding += outstanding;
          } else if (daysOverdue <= 90) {
            subStandardOutstanding += outstanding;
          } else if (daysOverdue <= 365) {
            doubtfulOutstanding += outstanding;
          } else {
            badOutstanding += outstanding;
          }
        });

        const reqStandard = Math.round(standardOutstanding * (rawLlpStandardRate / 100));
        const reqSubStandard = Math.round(subStandardOutstanding * (rawLlpSubStandardRate / 100));
        const reqDoubtful = Math.round(doubtfulOutstanding * (rawLlpDoubtfulRate / 100));
        const reqBad = Math.round(badOutstanding * (rawLlpBadRate / 100));
        const totalRequiredProvision = reqStandard + reqSubStandard + reqDoubtful + reqBad;
        const shortfall = Math.max(0, totalRequiredProvision - ledgerLLPFReserve);

        if (totalRequiredProvision > 0) {
          const amtToPost = shortfall > 0 ? shortfall : totalRequiredProvision;
          if (amtToPost > 0) {
            const newLLPFVoucher = {
              id: `LLP-AUTO-${Date.now().toString().slice(-4)}`,
              type: 'expense',
              category: 'খেলাপি ঋণের সঞ্চিতি (LLPF)',
              amount: amtToPost,
              note: `খেলাপি ঋণের সঞ্চিতি (LLPF) প্রভিশন অটো-পোস্টিং (প্রয়োজনীয়: ৳${totalRequiredProvision}, বর্তমান জের: ৳${ledgerLLPFReserve}) [অটো-পোস্ট]`,
              date: workingDay,
              addDate: workingDay,
              debitAcc: 'bad_debt',
              creditAcc: 'llpf',
              paymentMode: 'cash'
            };
            updatedTransactions = [newLLPFVoucher, ...updatedTransactions];
            postedSomething = true;
            msgParts.push(`খেলাপি ঋণের সঞ্চিতি (LLPF) প্রভিশন (৳${amtToPost.toLocaleString('bn-BD')})`);
          }
        }
      }

      if (postedSomething) {
        setTransactions(updatedTransactions);
        setAlertMsg({
          type: 'success',
          text: `মাসের শেষ দিন হিসেবে নিম্নোক্ত এন্ট্রিগুলো স্বয়ংক্রিয়ভাবে পোস্টিং করা হয়েছে:\n- ${msgParts.join('\n- ')}`
        });
      }
    }

    setWorkingDay(nextDay);
    
    // Save nextDay across all branch & admin storage keys so everyone sees the updated date
    const realBranchKey = `tanzil_working_day_${org.id}_branch_${branchId}`;
    const simBranchKey = `tanzil_working_day_${org.id}_branch_${branchId}_simulated`;
    const adminKey = `tanzil_admin_working_day_${org.id}`;
    const orgKey = `tanzil_working_day_${org.id}`;

    localStorage.setItem(workingDayKey, nextDay);
    localStorage.setItem(realBranchKey, nextDay);
    localStorage.setItem(simBranchKey, nextDay);
    localStorage.setItem(adminKey, nextDay);
    localStorage.setItem(orgKey, nextDay);
    
    // Clear user working date override
    const managerOverrideKey = `tanzil_working_day_override_${org.id}_branch_${branchId}_user_${staff.id || staff.staffId || 'admin'}`;
    localStorage.removeItem(managerOverrideKey);
    
    setSelectedViewDate(nextDay);
    window.dispatchEvent(new Event('storage'));
    
    console.log("Day closed, nextDay set to:", nextDay);
    alert(`কর্মদিবস ${workingDay} সফলভাবে ক্লোজ করা হয়েছে!\nনতুন কর্মদিবস: ${nextDay}`);
  };

  const [isWorkingDayModalOpen, setIsWorkingDayModalOpen] = useState(false);
  const [workingDayInput, setWorkingDayInput] = useState(workingDay);

  React.useEffect(() => {
    setWorkingDayInput(workingDay);
    setVoucherDateInput(workingDay);
    setSingleTxDate(workingDay);
    setJournalVoucherDate(workingDay);
    setSelectedViewDate(workingDay);
  }, [workingDay]);

  // Topbar Action Change Password dialogs
  const [isChangePasswordModalOpen, setIsChangePasswordModalOpen] = useState(false);
  const [oldPasswordVal, setOldPasswordVal] = useState('');
  const [newPasswordVal, setNewPasswordVal] = useState('');
  const [confirmPasswordVal, setConfirmPasswordVal] = useState('');
  const [passwordChangeSuccess, setPasswordChangeSuccess] = useState('');

  // Load branches
  const [branchesList] = useState<Branch[]>(() => {
    const saved = localStorage.getItem(`tanzil_branches_${org.id}`);
    return saved ? JSON.parse(saved) : [];
  });

  const currentBranch = branchesList.find(b => b.id === staff.branchId);
  const currentBranchCode = currentBranch?.code || staff.branchId?.slice(-4) || 'HO';

  // Staff and Groups records synced with the Organization database
  const [staffList, setStaffList] = useState<Staff[]>(() => {
    const saved = localStorage.getItem(`tanzil_staff_${org.id}`);
    if (!saved) return [];
    const parsed: Staff[] = JSON.parse(saved);
    
    // Only migrate if any staff member is missing staffId or password
    const needsMigration = parsed.some(s => !s.staffId || !s.password);
    if (!needsMigration) return parsed;
    
    let humanStaffCounter = 9;
    // Determine the next numeric staff ID to avoid collision
    parsed.forEach(s => {
      if (s.staffId && /^\d+$/.test(s.staffId)) {
        const num = parseInt(s.staffId, 10);
        if (num >= humanStaffCounter) {
          humanStaffCounter = num + 1;
        }
      }
    });

    const updated = parsed.map((s: Staff) => {
      const updatedStaff = { ...s };
      if (!updatedStaff.staffId) {
        if (s.name?.includes('ILO') || s.designation?.includes('ILO')) {
          updatedStaff.staffId = 'ILO-' + Math.random().toString(36).substring(2, 6).toUpperCase();
        } else {
          updatedStaff.staffId = humanStaffCounter.toString().padStart(3, '0');
          humanStaffCounter++;
        }
      }
      if (!updatedStaff.password) {
        updatedStaff.password = '1234';
      }
      return updatedStaff;
    });

    localStorage.setItem(`tanzil_staff_${org.id}`, JSON.stringify(updated));
    return updated;
  });

  const [groupList, setGroupList] = useState<Group[]>(() => {
    const saved = localStorage.getItem(`tanzil_groups_${org.id}`);
    const loaded = saved ? JSON.parse(saved) : [];
    // We filter out any seed groups to respect the "no demo data" (ডেমো ডাটা থাকবে না) instruction
    const filtered = loaded.filter((g: any) => !g.id.startsWith('grp-seed-'));
    return filtered;
  });

  const [groupSearchQuery, setGroupSearchQuery] = useState('');

  // Simple branch expense/income transactions record
  const [transactions, setTransactions] = useState<any[]>(() => {
    const saved = localStorage.getItem(`tanzil_bm_tx_${org.id}_${staff.branchId}`);
    if (!saved) return [];
    
    const parsed = JSON.parse(saved);
    const filtered = parsed.filter((t: any) => !t.id?.toString().startsWith('S-'));
    
    // Clean up localStorage immediately if demo data was found
    if (filtered.length !== parsed.length) {
        localStorage.setItem(`tanzil_bm_tx_${org.id}_${staff.branchId}`, JSON.stringify(filtered));
    }

    // Dynamically resolve proposalDetail if missing on load
    try {
      const proposals: any[] = JSON.parse(localStorage.getItem(`tanzil_loan_proposals_${org.id}`) || '[]');
      const localMembers: any[] = JSON.parse(localStorage.getItem(`tanzil_group_members_${org.id}`) || '[]');
      
      filtered.forEach((t: any) => {
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
      });
    } catch (e) {
      console.error("Error attaching proposal details to loaded transactions", e);
    }

    return filtered;
  });


  // Save transactions to localStorage whenever they change
  useEffect(() => {
    // Only save cleaned transactions
    const cleanTransactions = transactions.filter((t: any) => !t.id?.toString().startsWith('S-'));
    localStorage.setItem(`tanzil_bm_tx_${org.id}_${staff.branchId}`, JSON.stringify(cleanTransactions));
  }, [transactions, org.id, staff.branchId]);

  const pendingSavingsRefundsCount = React.useMemo(() => {
    try {
      const saved = localStorage.getItem(`tanzil_savings_refunds_${org.id}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed.filter((r: any) => (r.approvalStatus || 'pending') === 'pending').length;
        }
      }
    } catch (e) {
      console.error(e);
    }
    return 0;
  }, [org.id, transactions]);

  // Ensure branch-specific 'ILO' exists by default in this branch
  useEffect(() => {
    const expectedIloId = `ILO-${currentBranchCode}`;
    const hasBranchIlo = staffList.some(s => s.staffId === expectedIloId);
    const hasLegacyIlo = staffList.some(s => s.staffId === 'ILO');
    const hasWrongIloPassword = staffList.some(s => s.staffId === expectedIloId && s.password !== '12345');

    if (!hasBranchIlo || hasLegacyIlo || hasWrongIloPassword) {
      let filtered = staffList.filter(s => s.staffId !== 'ILO');
      
      // Update any existing ILO account passwords to '12345'
      filtered = filtered.map(s => {
        if (s.staffId?.startsWith('ILO') && s.password !== '12345') {
          return { ...s, password: '12345' };
        }
        return s;
      });

      const branchIloExistsInFiltered = filtered.some(s => s.staffId === expectedIloId);
      
      let updated = [...filtered];
      if (!branchIloExistsInFiltered) {
        const defaultILO: Staff = {
          id: `ilo-branch-${staff.branchId}`,
          orgId: org.id,
          name: `ইন্টারন্যাশনাল লিয়াজোঁ অফিসার (${currentBranch?.name || 'ILO'})`,
          phone: currentBranch?.phone || '01712345678',
          designation: 'মাঠ কর্মী',
          joiningDate: new Date().toISOString().split('T')[0],
          branchId: staff.branchId,
          branchJoiningDate: new Date().toISOString().split('T')[0],
          staffId: expectedIloId,
          password: '12345'
        };
        updated.push(defaultILO);
      }
      
      // Deduplicate before saving
      const uniqueMap = new Map<string, Staff>();
      updated.forEach((s: Staff) => {
        if (s && s.id) uniqueMap.set(s.id, s);
      });
      const deduplicated = Array.from(uniqueMap.values());
      
      setStaffList(deduplicated);
      localStorage.setItem(`tanzil_staff_${org.id}`, JSON.stringify(deduplicated));
    }
  }, [staffList, org.id, staff.branchId, currentBranchCode, currentBranch]);

  // Sync state changes back to centralized local storage
  useEffect(() => {
    localStorage.setItem(`tanzil_staff_${org.id}`, JSON.stringify(staffList));
  }, [staffList, org.id]);

  useEffect(() => {
    localStorage.setItem(`tanzil_groups_${org.id}`, JSON.stringify(groupList));
  }, [groupList, org.id]);

  // Rich member accounts list
  const [groupMembers, setGroupMembers] = useState<any[]>(() => {
    const saved = localStorage.getItem(`tanzil_group_members_${org.id}`);
    return saved ? JSON.parse(saved) : [];
  });

  // Savings, CBS, LTS accounts state
  const [savingsAccounts, setSavingsAccounts] = useState<any[]>(() => {
    const saved = localStorage.getItem(`tanzil_savings_accounts_${org.id}`);
    return saved ? JSON.parse(saved) : [];
  });
  
  const [cbsAccounts, setCbsAccounts] = useState<any[]>(() => {
    const saved = localStorage.getItem(`tanzil_cbs_accounts_${org.id}`);
    return saved ? JSON.parse(saved) : [];
  });

  const [ltsAccounts, setLtsAccounts] = useState<any[]>(() => {
    const saved = localStorage.getItem(`tanzil_lts_accounts_${org.id}`);
    return saved ? JSON.parse(saved) : [];
  });

  const maturedFdrAccounts = React.useMemo(() => {
    return savingsAccounts.filter(acc => {
      if (acc.type !== 'FDR' || acc.status !== 'active') return false;
      const depositDate = new Date(acc.date);
      const oneMonthLater = new Date(depositDate);
      oneMonthLater.setMonth(oneMonthLater.getMonth() + 1);
      
      // If today is before 1 month of deposit, not matured yet
      if (new Date(workingDay) < oneMonthLater) return false;

      // If already posted interest in this month, or posted within 28 days of workingDay, skip
      if (acc.lastInterestPostDate) {
        const lastPost = new Date(acc.lastInterestPostDate);
        const currentWork = new Date(workingDay);
        const daysDiff = (currentWork.getTime() - lastPost.getTime()) / (1000 * 3600 * 24);
        if (daysDiff < 28) return false;
      }
      
      return true;
    });
  }, [savingsAccounts, workingDay]);

  const dueSavingsAccounts = React.useMemo(() => {
    return savingsAccounts.filter(acc => {
      if (acc.type !== 'GS' || acc.status !== 'active') return false;
      // Assume interest posting in June. If it's June, show notification.
      const wd = new Date(workingDay);
      return wd.getMonth() === 5; // June is index 5
    });
  }, [savingsAccounts, workingDay]);

  const handlePostFdrInterest = (acc: any) => {
    // Basic interest calculation: P * R * T (1 month = 1/12 year)
    const principal = acc.balance;
    const rate = acc.interestRate || 12; // default to 12% as specified
    const interest = Math.round((principal * rate / 100) / 12);

    if (interest <= 0) {
      alert("কোনো লভ্যাংশ প্রাপ্য নেই (লভ্যাংশের পরিমাণ ০)।");
      return;
    }

    // 1. Create a transaction for interest deposit
    const newTransaction = {
      id: `tx-fdr-int-${Date.now()}`,
      orgId: org.id,
      memberId: acc.memberId,
      memberName: acc.memberName,
      type: 'savings_deposit', // Deposit into GS savings
      amount: interest,
      date: workingDay,
      category: 'fdr_interest',
      description: `এফডিআর লভ্যাংশ (FDR Interest): ${acc.accountNo}`
    };

    // 2. Update the member's GS account balance in savingsAccounts
    setSavingsAccounts((prev) => prev.map((sa) => {
      if ((sa.memberId === acc.memberId || sa.memberCode === acc.memberId) && sa.type === 'GS') {
        return { ...sa, balance: (sa.balance || 0) + interest };
      }
      return sa;
    }));

    // 3. Update the member's gsBalance/savingsBalance in groupMembers
    setGroupMembers((prev) => prev.map((m) => {
      if (m.id === acc.memberId || m.memberId === acc.memberId) {
        const currentGs = m.savingsBalance ?? m.gsBalance ?? 0;
        return {
          ...m,
          savingsBalance: currentGs + interest,
          gsBalance: currentGs + interest
        };
      }
      return m;
    }));

    // 4. Update the current FDR account's lastInterestPostDate to avoid double posting
    setSavingsAccounts((prev) => prev.map((sa) => {
      if (sa.id === acc.id) {
        return { ...sa, lastInterestPostDate: workingDay };
      }
      return sa;
    }));

    setTransactions(prev => [...prev, newTransaction]);
    alert(`সদস্য ${acc.memberName}-এর সঞ্চয় হিসাবে ৳${interest} লভ্যাংশ সফলভাবে পোস্টিং করা হয়েছে।`);
  };

  const handlePostSavingsInterest = (acc: any) => {
      // Annual interest: P * R (assuming 1 year, so P * R / 100). 
      const principal = acc.balance;
      const rate = acc.interestRate || 6; // Annual 6%
      const interest = Math.round((principal * rate / 100)); 

      const newTransaction = {
        id: `tx-gs-int-${Date.now()}`,
        orgId: org.id,
        memberId: acc.memberId,
        memberName: acc.memberName,
        type: 'savings_deposit',
        amount: interest,
        date: workingDay,
        category: 'savings_interest',
        description: `সঞ্চয় লভ্যাংশ (বার্ষিক): ${acc.accountNo}`
      };

      setSavingsAccounts((prev) => prev.map((sa) => {
          if (sa.id === acc.id) {
            return { ...sa, balance: (sa.balance || 0) + interest, lastInterestPostDate: workingDay };
          }
          return sa;
      }));

      setGroupMembers((prev) => prev.map((m) => {
        if (m.id === acc.memberId || m.memberId === acc.memberId) {
          const currentGs = m.savingsBalance ?? m.gsBalance ?? 0;
          return {
            ...m,
            savingsBalance: currentGs + interest,
            gsBalance: currentGs + interest
          };
        }
        return m;
      }));

      setTransactions(prev => [...prev, newTransaction]);
      alert(`সদস্য ${acc.memberName}-এর সঞ্চয় হিসাবে ৳${interest} লভ্যাংশ সফলভাবে পোস্টিং করা হয়েছে।`);
  };

  const handlePostAllSavingsInterest = () => {
      if (dueSavingsAccounts.length === 0) return;

      const now = Date.now();
      const newTransactions: any[] = [];
      const updatedSavings = [...savingsAccounts];
      const updatedMembers = [...groupMembers];

      dueSavingsAccounts.forEach((acc, index) => {
          const interest = Math.round((acc.balance * (acc.interestRate || 6) / 100)); 

          if (interest > 0) {
              newTransactions.push({
                  id: `tx-gs-int-${now + index}`,
                  orgId: org.id,
                  memberId: acc.memberId,
                  memberName: acc.memberName,
                  type: 'savings_deposit',
                  amount: interest,
                  date: workingDay,
                  category: 'savings_interest',
                  description: `সঞ্চয় লভ্যাংশ (বার্ষিক): ${acc.accountNo}`
              });

              // Update savings
              const saIndex = updatedSavings.findIndex(s => s.id === acc.id);
              if (saIndex !== -1) {
                  updatedSavings[saIndex] = {
                      ...updatedSavings[saIndex],
                      balance: (updatedSavings[saIndex].balance || 0) + interest,
                      lastInterestPostDate: workingDay
                  };
              }

              // Update groupMembers
              const memberIndex = updatedMembers.findIndex(m => m.id === acc.memberId || m.memberId === acc.memberId);
              if (memberIndex !== -1) {
                  const currentGs = updatedMembers[memberIndex].savingsBalance ?? updatedMembers[memberIndex].gsBalance ?? 0;
                  updatedMembers[memberIndex] = {
                      ...updatedMembers[memberIndex],
                      savingsBalance: currentGs + interest,
                      gsBalance: currentGs + interest
                  };
              }
          }
      });

      setTransactions(prev => [...prev, ...newTransactions]);
      setSavingsAccounts(updatedSavings);
      setGroupMembers(updatedMembers);
      alert(`${dueSavingsAccounts.length} জন সদস্যের সঞ্চয় হিসাবে লভ্যাংশ সফলভাবে পোস্টিং করা হয়েছে।`);
  };

  // Holiday management
  const [holidays, setHolidays] = useState<Holiday[]>(() => {
    try {
      const saved = localStorage.getItem(`tanzil_holidays_${org.id}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.error("Error reading holidays", e);
    }
    const defaultHolidays = getDefaultHolidays(org.id);
    localStorage.setItem(`tanzil_holidays_${org.id}`, JSON.stringify(defaultHolidays));
    return defaultHolidays;
  });

  // Custom dialog confirmation & alert states (Iframe safe)
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  } | null>(null);

  const [alertModal, setAlertModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
  } | null>(null);

  const showConfirm = (message: string, onConfirm: () => void, title = "নিশ্চিত করুন") => {
    setConfirmModal({
      isOpen: true,
      title,
      message,
      onConfirm: () => {
        onConfirm();
        setConfirmModal(null);
      }
    });
  };

  const showAlert = (message: string, title = "বিজ্ঞপ্তি") => {
    setAlertModal({
      isOpen: true,
      title,
      message
    });
  };
  
  const [holidayYearFilter, setHolidayYearFilter] = useState('all');
  const [holidaySearchQuery, setHolidaySearchQuery] = useState('');

  // Holiday Modal & Form States
  const [isHolidayModalOpen, setIsHolidayModalOpen] = useState(false);
  const [editingHolidayId, setEditingHolidayId] = useState<string | null>(null);
  const [holidayType, setHolidayType] = useState<'direct' | 'general'>('direct');
  const [holidayName, setHolidayName] = useState('');
  const [holidayDate, setHolidayDate] = useState(() => workingDay || new Date().toISOString().split('T')[0]);
  const [holidayDayOfWeek, setHolidayDayOfWeek] = useState('শুক্রবার');

  const handleAddHoliday = (e: React.FormEvent) => {
    e.preventDefault();
    if (!holidayName.trim()) {
      alert('দয়া করে ছুটির কারণ বা বিবরণ লিখুন।');
      return;
    }

    let updatedHolidays;
    if (editingHolidayId) {
      updatedHolidays = holidays.map(h => {
        if (h.id === editingHolidayId) {
          return {
            ...h,
            type: holidayType,
            name: holidayName.trim(),
            date: holidayType === 'direct' ? holidayDate : undefined,
            dayOfWeek: holidayType === 'general' ? holidayDayOfWeek : undefined
          };
        }
        return h;
      });
      setEditingHolidayId(null);
    } else {
      const newHoliday: Holiday = {
        id: `HLD-${Math.floor(1000 + Math.random() * 9000)}-${Date.now().toString().slice(-4)}`,
        orgId: org.id,
        type: holidayType,
        name: holidayName.trim(),
        date: holidayType === 'direct' ? holidayDate : undefined,
        dayOfWeek: holidayType === 'general' ? holidayDayOfWeek : undefined,
        addDate: workingDay
      };
      updatedHolidays = [newHoliday, ...holidays];
    }

    setHolidays(updatedHolidays);
    localStorage.setItem(`tanzil_holidays_${org.id}`, JSON.stringify(updatedHolidays));
    setHolidayName('');
    setIsHolidayModalOpen(false);
  };

  const handleEditHoliday = (holiday: Holiday) => {
    if (holiday.date && holiday.date < workingDay) {
        alert("অতীতের ছুটির তথ্য সম্পাদন করা সম্ভব নয়!");
        return;
    }
    setEditingHolidayId(holiday.id);
    setHolidayType(holiday.type);
    setHolidayName(holiday.name);
    if (holiday.type === 'direct' && holiday.date) {
      setHolidayDate(holiday.date);
    }
    if (holiday.type === 'general' && holiday.dayOfWeek) {
      setHolidayDayOfWeek(holiday.dayOfWeek);
    }
    setIsHolidayModalOpen(true);
  };

  const handleDeleteHoliday = (id: string, name: string) => {
    const holiday = holidays.find(h => h.id === id);
    if (holiday && holiday.date && holiday.date < workingDay) {
      alert("অতীতের ছুটির তথ্য ডিলিট করা সম্ভব নয়!");
      return;
    }
    
    showConfirm(`আপনি কি নিশ্চিতভাবে "${name}" ছুটিটি ডিলিট করতে চান?`, () => {
      const updatedHolidays = holidays.filter(h => h.id !== id);
      setHolidays(updatedHolidays);
      registerDeletedId(org.id, id);
      localStorage.setItem(`tanzil_holidays_${org.id}`, JSON.stringify(updatedHolidays));
    });
  };

  // Sync state with Admin declared holidays when tab shifts
  useEffect(() => {
    if (activeTab === 'holidays') {
      try {
        const saved = localStorage.getItem(`tanzil_holidays_${org.id}`);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setHolidays(parsed);
          }
        }
      } catch (e) {
        console.error("Error reading holidays for branch", e);
      }
    }
  }, [activeTab, org.id]);

  // Sync state changes back to centralized local storage for member accounts
  useEffect(() => {
    localStorage.setItem(`tanzil_group_members_${org.id}`, JSON.stringify(groupMembers));
  }, [groupMembers, org.id]);

  useEffect(() => {
    localStorage.setItem(`tanzil_savings_accounts_${org.id}`, JSON.stringify(savingsAccounts));
  }, [savingsAccounts, org.id]);

  useEffect(() => {
    localStorage.setItem(`tanzil_cbs_accounts_${org.id}`, JSON.stringify(cbsAccounts));
  }, [cbsAccounts, org.id]);

  useEffect(() => {
    localStorage.setItem(`tanzil_lts_accounts_${org.id}`, JSON.stringify(ltsAccounts));
  }, [ltsAccounts, org.id]);

  useEffect(() => {
    localStorage.setItem(`tanzil_bm_tx_${org.id}_${staff.branchId}`, JSON.stringify(transactions));
  }, [transactions, org.id, staff.branchId]);

  useEffect(() => {
    localStorage.setItem(`tanzil_bank_accounts_${org.id}`, JSON.stringify(bankAccounts));
    // Auto-select standard active bank statement if current is invalid
    if (bankAccounts.length > 0) {
      if (!selectedBankStatementId || !bankAccounts.some(b => b.id === selectedBankStatementId)) {
        setSelectedBankStatementId(bankAccounts[0].id);
      }
    } else {
      setSelectedBankStatementId('');
    }
  }, [bankAccounts, org.id, selectedBankStatementId]);

  // Loan proposals state
  const [loanProposals, setLoanProposals] = useState<any[]>(() => {
    const saved = localStorage.getItem(`tanzil_loan_proposals_${org.id}`);
    return saved ? JSON.parse(saved) : [];
  });

  // Sync loan proposals state on change
  useEffect(() => {
    localStorage.setItem(`tanzil_loan_proposals_${org.id}`, JSON.stringify(loanProposals));
  }, [loanProposals, org.id]);

  // Exemption and LSRF requests state
  const [exemptionRequests, setExemptionRequests] = useState<any[]>(() => {
    const saved = localStorage.getItem(`tanzil_exemption_requests_${org.id}`);
    return saved ? JSON.parse(saved) : [];
  });

  // Sync exemption requests state on change
  useEffect(() => {
    localStorage.setItem(`tanzil_exemption_requests_${org.id}`, JSON.stringify(exemptionRequests));
  }, [exemptionRequests, org.id]);

  // Filter staff that belongs to the logged-in BM's branch. If not BM, only show themselves.
  const branchStaff = staffList.filter(s => 
    s.branchId === staff.branchId && (isBM || s.id === staff.id)
  );

  // Filter groups that belongs to this branch. If not BM, only show assigned groups.
  const branchGroups = groupList.filter(g => 
    g.branchId === staff.branchId && 
    (isBM || g.assignedStaffId === staff.id || g.assignedStaffId === staff.staffId)
  );

  // --- HRM Modal & form states ---
  const [isStaffModalOpen, setIsStaffModalOpen] = useState(false);
  const [isStaffEditMode, setIsStaffEditMode] = useState(false);
  const [editingStaffId, setEditingStaffId] = useState<string | null>(null);
  
  const [staffNameInput, setStaffNameInput] = useState('');
  const [staffPhoneInput, setStaffPhoneInput] = useState('');
  const [staffDesignationInput, setStaffDesignationInput] = useState('মাঠ কর্মী');
  const [staffJoiningDateInput, setStaffJoiningDateInput] = useState(() => new Date().toISOString().split('T')[0]);

  // --- Leave Modal states ---
  const [isLeaveModalOpen, setIsLeaveModalOpen] = useState(false);
  const [leaveStaffTarget, setLeaveStaffTarget] = useState<Staff | null>(null);
  const [leaveReason, setLeaveReason] = useState('অসুস্থতা জনিত ছুটি');
  const [leaveStart, setLeaveStart] = useState(() => new Date().toISOString().split('T')[0]);
  const [leaveEnd, setLeaveEnd] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().split('T')[0];
  });
  const [alertMsg, setAlertMsg] = useState<{ type: 'success' | 'info'; text: string } | null>(null);

  // --- Add/Edit Group form states ---
  const [groupNameInput, setGroupNameInput] = useState('');
  const [groupCodeInput, setGroupCodeInput] = useState('');
  const [groupStaffSelect, setGroupStaffSelect] = useState(() => {
    return staff.designation === 'শাখা ব্যবস্থাপক' ? `ILO-${currentBranchCode}` : (staff.staffId || staff.id);
  });
  const [groupMeetingDayInput, setGroupMeetingDayInput] = useState('শনিবার');
  const [groupVillageInput, setGroupVillageInput] = useState('');
  const [isGroupEditMode, setIsGroupEditMode] = useState(false);
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);

  useEffect(() => {
    if (selectedOperation === 'add_group' && !isGroupEditMode && !groupCodeInput) {
      const nextNum = groupList.length + 1;
      setGroupCodeInput(`GRP-${nextNum.toString().padStart(3, '0')}`);
    }
  }, [selectedOperation, isGroupEditMode, groupCodeInput, groupList.length]);

  // --- Group Operation Member Search tab and control states ---
  const [activeCardView, setActiveCardView] = useState<'grid' | 'member_admission' | 'member_information' | 'member_transaction' | 'loan_proposal' | 'loan_disburse' | 'add_savings_account' | 'add_cbs_account' | 'add_lts_account' | 'member_balance' | 'realized_information' | 'share_management'>('grid');

  const handleSavingsSuccess = (newAccount: any, updatedMembersList: any[]) => {
    if (isRealBMReadOnly) {
      alert('শাখা ব্যবস্থাপক (BM) হিসেবে আপনি গ্রুপ কার্যক্রমের কোনো তথ্য পরিবর্তন করতে পারবেন না। এটি রিড-অনলি মুডে রয়েছে।');
      return;
    }
    setSavingsAccounts((prev: any[]) => [...prev, newAccount]);
    setGroupMembers(updatedMembersList);
    setActiveCardView('grid');
    setAlertMsg({
      type: 'success',
      text: `সদস্য ${newAccount.memberName} এর ${newAccount.type === 'GS' ? 'সাধারণ সঞ্চয় (GS)' : 'স্থায়ী আমানত (FDR)'} হিসাব সফলভাবে খোলা হয়েছে!`
    });
  };

  const handleCbsSuccess = (newAccount: any, updatedMembersList: any[]) => {
    if (isRealBMReadOnly) {
      alert('শাখা ব্যবস্থাপক (BM) হিসেবে আপনি গ্রুপ কার্যক্রমের কোনো তথ্য পরিবর্তন করতে পারবেন না। এটি রিড-অনলি মুডে রয়েছে।');
      return;
    }
    setCbsAccounts((prev: any[]) => [...prev, newAccount]);
    setGroupMembers(updatedMembersList);
    setActiveCardView('grid');
    setAlertMsg({
      type: 'success',
      text: `সদস্য ${newAccount.memberName} এর ক্যাপিটাল বিল্ড-আপ সঞ্চয় (CBS) হিসাব সফলভাবে খোলা হয়েছে!`
    });
  };

  const handleLtsSuccess = (newAccount: any, updatedMembersList: any[]) => {
    if (isRealBMReadOnly) {
      alert('শাখা ব্যবস্থাপক (BM) হিসেবে আপনি গ্রুপ কার্যক্রমের কোনো তথ্য পরিবর্তন করতে পারবেন না। এটি রিড-অনলি মুডে রয়েছে।');
      return;
    }
    setLtsAccounts((prev: any[]) => [...prev, newAccount]);
    setGroupMembers(updatedMembersList);
    setActiveCardView('grid');
    setAlertMsg({
      type: 'success',
      text: `সদস্য ${newAccount.memberName} এর দীর্ঘমেয়াদী সঞ্চয় (LTS) হিসাব সফলভাবে খোলা হয়েছে!`
    });
  };

  const handleMemberAdmissionSuccess = (newMember: any) => {
    if (isRealBMReadOnly) {
      alert('শাখা ব্যবস্থাপক (BM) হিসেবে আপনি গ্রুপ কার্যক্রমের কোনো তথ্য পরিবর্তন করতে পারবেন না। এটি রিড-অনলি মুডে রয়েছে।');
      return;
    }
    setGroupMembers((prev: any[]) => [...prev, newMember]);
    
    // Automatically create General Savings (GS) account record for the newly admitted member helper
    const depositAmount = Number(newMember.gsBalance) || Number(newMember.savingsBalance) || 0;
    const accountNo = `SAV-GS-${Date.now().toString().slice(-6)}`;
    const newAccount = {
      id: `acc-sav-${Date.now()}`,
      accountNo,
      memberId: newMember.id,
      memberName: newMember.name,
      memberCode: newMember.memberId,
      groupId: newMember.groupId,
      groupName: branchGroups.find((g) => g.id === newMember.groupId)?.name || '',
      type: 'GS',
      initialDeposit: depositAmount,
      balance: depositAmount,
      interestRate: 7.5,
      termMonths: null,
      admissionFee: 0,
      date: newMember.admissionDate || new Date().toISOString().split('T')[0],
      status: 'active'
    };
    
    setSavingsAccounts((prev: any[]) => [newAccount, ...prev]);

    // Create auto transactions for admission fee, passbook fee, and initial savings
    const autoTxs: any[] = [];
    const admissionFee = Number(newMember.admissionFee) || 0;
    const passbookFee = Number(newMember.passbookFee) || 0;
    const txDate = newMember.admissionDate || new Date().toISOString().split('T')[0];
    const memberGroupName = branchGroups.find((g) => g.id === newMember.groupId)?.name || '';

    if (admissionFee > 0) {
      autoTxs.push({
        id: `tx-adm-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        orgId: org.id,
        branchId: staff.branchId || 'default-branch',
        staffId: staff.id || staff.staffId || '009',
        staffName: staff.name,
        memberId: newMember.memberId,
        memberName: newMember.name,
        groupName: memberGroupName,
        groupId: newMember.groupId,
        type: 'income',
        amount: admissionFee,
        category: 'admission_fee',
        debitAcc: 'cash',
        creditAcc: 'admission_fee',
        date: txDate,
        addDate: txDate,
        description: `ভর্তি ফি আদায় (সদস্য: ${newMember.name}, আইডি: ${newMember.memberId})`
      });
    }

    if (passbookFee > 0) {
      autoTxs.push({
        id: `tx-psb-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        orgId: org.id,
        branchId: staff.branchId || 'default-branch',
        staffId: staff.id || staff.staffId || '009',
        staffName: staff.name,
        memberId: newMember.memberId,
        memberName: newMember.name,
        groupName: memberGroupName,
        groupId: newMember.groupId,
        type: 'income',
        amount: passbookFee,
        category: 'passbook_fee',
        debitAcc: 'cash',
        creditAcc: 'passbook_fee',
        date: txDate,
        addDate: txDate,
        description: `পাসবই ও ফর্ম বিক্রি (সদস্য: ${newMember.name}, আইডি: ${newMember.memberId})`
      });
    }

    if (depositAmount > 0) {
      autoTxs.push({
        id: `tx-gsd-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        orgId: org.id,
        branchId: staff.branchId || 'default-branch',
        staffId: staff.id || staff.staffId || '009',
        staffName: staff.name,
        memberId: newMember.memberId,
        memberName: newMember.name,
        groupName: memberGroupName,
        groupId: newMember.groupId,
        type: 'savings_deposit',
        accountType: 'general',
        amount: depositAmount,
        category: 'general_savings',
        debitAcc: 'cash',
        creditAcc: 'general_savings',
        date: txDate,
        addDate: txDate,
        description: `প্রাথমিক সঞ্চয় আমানত জমা (সদস্য: ${newMember.name}, আইডি: ${newMember.memberId})`
      });
    }

    if (autoTxs.length > 0) {
      setTransactions((prev) => [...autoTxs, ...prev]);
    }

    setActiveCardView('grid');
    setAlertMsg({ 
      type: 'success', 
      text: `নতুন সদস্য ${newMember.name} (${newMember.memberId}) সফলভাবে ভর্তি করা হয়েছে! ${
        autoTxs.length > 0 ? 'জমা ফি ও আমানত স্বয়ংক্রিয়ভাবে খতিয়ান ও কর্মী লেনদেনে পোস্টিং করা হয়েছে।' : ''
      }` 
    });
  };

  const handleLoanProposalSuccess = () => {
    if (isRealBMReadOnly) {
      alert('শাখা ব্যবস্থাপক (BM) হিসেবে আপনি গ্রুপ কার্যক্রমের কোনো তথ্য পরিবর্তন করতে পারবেন না। এটি রিড-অনলি মুডে রয়েছে।');
      return;
    }
    // Reload dynamically from localStorage to stay perfectly in sync
    const saved = localStorage.getItem(`tanzil_loan_proposals_${org.id}`);
    if (saved) {
      setLoanProposals(JSON.parse(saved));
    }
    setActiveCardView('grid');
    setAlertMsg({
      type: 'success',
      text: 'নতুন ঋণ প্রস্তাবটি সফলভাবে দাখিল করা হয়েছে এবং অনুমোদনের জন্য শাখা ব্যবস্থাপকের অপেক্ষমাণ তদারকিতে রয়েছে!'
    });
  };

  const handleLoanDisburseSuccess = (updatedMembersList: any[], txDetails: any) => {
    if (isRealBMReadOnly) {
      alert('শাখা ব্যবস্থাপক (BM) হিসেবে আপনি গ্রুপ কার্যক্রমের কোনো তথ্য পরিবর্তন করতে পারবেন না। এটি রিড-অনলি মুডে রয়েছে।');
      return;
    }
    setGroupMembers(updatedMembersList);
    
    // Add transaction to local BM records
    const newTx = {
      id: `tx-sys-${Date.now()}`,
      orgId: org.id,
      branchId: staff.branchId || 'default-branch',
      staffId: staff.id || staff.staffId || '009',
      staffName: staff.name,
      memberId: txDetails.memberId,
      memberName: txDetails.memberName,
      groupName: txDetails.groupName,
      type: 'disbursement',
      amount: txDetails.netAmount,
      date: txDetails.date,
      addDate: txDetails.date,
      proposalDetail: txDetails.proposalDetail,
      description: `ঋণ বিতরণ: ${txDetails.netAmount} BDT (খাত: ${txDetails.proposalDetail.purpose}) — সোর্স: ${txDetails.source}`
    };

    const extraTxs: any[] = [];
    if (txDetails.insurancePremium && txDetails.insurancePremium > 0) {
      const insTx = {
        id: `tx-sys-ins-${Date.now()}`,
        orgId: org.id,
        branchId: staff.branchId || 'default-branch',
        staffId: staff.id || staff.staffId || '009',
        staffName: staff.name,
        memberId: txDetails.memberId,
        memberName: txDetails.memberName,
        groupName: txDetails.groupName,
        type: 'income',
        amount: txDetails.insurancePremium,
        category: 'বীমা প্রিমিয়াম (তহবিল)',
        debitAcc: 'cash',
        creditAcc: 'risk_fund',
        date: txDetails.date,
        addDate: txDetails.date,
        description: `ঋণ বিতরণকালীন বীমা প্রিমিয়াম আদায়: ${txDetails.insurancePremium} BDT (সদস্য: ${txDetails.memberName}) — পলিসি: ${txDetails.insuranceLabel}`
      };
      extraTxs.push(insTx);
    }
    
    setTransactions((prev) => [...extraTxs, newTx, ...prev]);

    // Reload proposals to update status to disbursed
    const saved = localStorage.getItem(`tanzil_loan_proposals_${org.id}`);
    if (saved) {
      setLoanProposals(JSON.parse(saved));
    }

    setActiveCardView('grid');
    setAlertMsg({
      type: 'success',
      text: `সদস্য ${txDetails.memberName} (${txDetails.memberId})-কে সফলভাবে ঋণ বিতরণ করা হয়েছে!${
        txDetails.insurancePremium > 0 ? ` একইসাথে বীমা পলিসি প্রিমিয়াম ৳${txDetails.insurancePremium.toLocaleString('bn-BD')} নগদ আদায় তহবিলে জমা হয়েছে।` : ''
      }`
    });
  };

  const handleUpdateMemberStatus = (memberId: string, newStatus: 'active' | 'inactive', reason?: string) => {
    if (isRealBMReadOnly) {
      alert('শাখা ব্যবস্থাপক (BM) হিসেবে আপনি গ্রুপ কার্যক্রমের কোনো তথ্য পরিবর্তন করতে পারবেন না। এটি রিড-অনলি মুডে রয়েছে।');
      return;
    }
    setGroupMembers((prev: any[]) => prev.map((m: any) => 
      m.id === memberId ? { ...m, status: newStatus, inactiveReason: reason || '' } : m
    ));
    setAlertMsg({
      type: 'success',
      text: `সদস্যের স্ট্যাটাস সফলভাবে '${newStatus === 'active' ? 'সচল' : 'নিষ্ক্রিয়'}' করা হয়েছে!`
    });
  };

  const handleTransferMember = (memberId: string, newGroupId: string) => {
    if (isRealBMReadOnly) {
      alert('শাখা ব্যবস্থাপক (BM) হিসেবে আপনি গ্রুপ কার্যক্রমের কোনো তথ্য পরিবর্তন করতে পারবেন না। এটি রিড-অনলি মুডে রয়েছে।');
      return;
    }
    setGroupMembers((prev: any[]) => prev.map((m: any) => {
      if (m.id === memberId) {
        return { ...m, groupId: newGroupId };
      }
      return m;
    }));
    
    const targetMember = groupMembers.find(m => m.id === memberId);
    const targetGroup = branchGroups.find(g => g.id === newGroupId);
    
    setAlertMsg({
      type: 'success',
      text: `সদস্য ${targetMember?.name || ''}-কে সফলভাবে ${targetGroup?.name || ''} সমিতিতে স্থানান্তর করা হয়েছে!`
    });
  };

  const handleCloseAccount = (
    memberId: string, 
    accountId: string, 
    accountType: 'GS' | 'CBS' | 'LTS', 
    payoutAmount: number, 
    interestEarned: number, 
    penalty: number, 
    reason: string
  ) => {
    if (isRealBMReadOnly) {
      alert('শাখা ব্যবস্থাপক (BM) হিসেবে আপনি গ্রুপ কার্যক্রমের কোনো তথ্য পরিবর্তন করতে পারবেন না। এটি রিড-অনলি মুডে রয়েছে।');
      return;
    }
    // 1. Update the account status to 'closed'
    if (accountType === 'GS') {
      setSavingsAccounts((prev) => prev.map((acc) => {
        if (acc.id === accountId) {
          return { ...acc, status: 'closed', balance: 0, closedDate: workingDay };
        }
        return acc;
      }));
    } else if (accountType === 'CBS') {
      setCbsAccounts((prev) => prev.map((acc) => {
        if (acc.id === accountId) {
          return { ...acc, status: 'closed', balance: 0, closedDate: workingDay };
        }
        return acc;
      }));
    } else if (accountType === 'LTS') {
      setLtsAccounts((prev) => prev.map((acc) => {
        if (acc.id === accountId) {
          return { ...acc, status: 'closed', balance: 0, closedDate: workingDay };
        }
        return acc;
      }));
    }

    // 2. Find member name & update member balance
    const memberObj = groupMembers.find(m => m.id === memberId || m.memberId === memberId);
    const mName = memberObj ? memberObj.name : 'অজ্ঞাত সদস্য';
    const mCode = memberObj ? memberObj.memberId : memberId;

    if (memberObj) {
      setGroupMembers((prev) => prev.map((m) => {
        if (m.id === memberId || m.memberId === memberId) {
          if (accountType === 'GS') {
            return { ...m, savingsBalance: 0, gsBalance: 0 };
          } else if (accountType === 'CBS') {
            return { ...m, cbsBalance: 0 };
          } else if (accountType === 'LTS') {
            return { ...m, ltsBalance: 0 };
          }
        }
        return m;
      }));
    }

    // 3. Create double-entry/cashbook transaction
    setTransactions((prev) => {
      const txCategory = accountType === 'GS' ? 'general_savings' : accountType === 'CBS' ? 'cbs_savings' : 'lts_savings';
      const withdrawalDetails = {
        pl: 0,
        gs: accountType === 'GS' ? payoutAmount : 0,
        cbs: accountType === 'CBS' ? payoutAmount : 0,
        lts: accountType === 'LTS' ? payoutAmount : 0
      };

      const newTx = {
        id: `tx-close-${Date.now()}`,
        orgId: org.id,
        branchId: staff.branchId || 'default-branch',
        staffId: staff.id || staff.staffId || '009',
        staffName: staff.name,
        memberId: mCode,
        memberName: mName,
        groupName: memberObj ? branchGroups.find(g => g.id === memberObj.groupId)?.name || 'সাধারন' : 'সাধারন',
        type: 'savings_withdrawal',
        category: txCategory,
        debitAcc: txCategory,
        creditAcc: 'cash',
        amount: payoutAmount,
        date: workingDay,
        addDate: workingDay,
        description: `হিসাব ক্লোজিং ফেরত (${accountType} - ${reason}). লভ্যাংশ: ৳${interestEarned.toLocaleString('bn-BD')}, পেনাল্টি: ৳${penalty.toLocaleString('bn-BD')}`,
        collections: { pl: 0, gs: 0, cbs: 0, lts: 0 },
        withdrawals: withdrawalDetails,
        exemption: 0,
        exemptionReason: null
      };

      return [newTx, ...prev];
    });

    setAlertMsg({
      type: 'success',
      text: `${accountType} হিসাবটি সফলভাবে ক্লোজ করা হয়েছে! গ্রাহককে লভ্যাংশ সহ মোট ৳${payoutAmount.toLocaleString('bn-BD')} ফেরত দেওয়া হয়েছে।`
    });
  };

  const handleLoanAction = (
    memberId: string,
    actionType: 'rebate' | 'reschedule' | 'adjustment' | 'auto_adjustment' | 'write_off' | 'close',
    details: any
  ) => {
    if (isRealBMReadOnly) {
      alert('শাখা ব্যবস্থাপক (BM) হিসেবে আপনি গ্রুপ কার্যক্রমের কোনো তথ্য পরিবর্তন করতে পারবেন না। এটি রিড-অনলি মুডে রয়েছে।');
      return;
    }
    const memberObj = groupMembers.find(m => m.id === memberId || m.memberId === memberId);
    if (!memberObj) return;

    const mName = memberObj.name;
    const mCode = memberObj.memberId;
    const gName = branchGroups.find(g => g.id === memberObj.groupId)?.name || 'সাধারন';

    // 1. Handle Rebate
    if (actionType === 'rebate') {
      const rebateAmt = details.amount;
      setGroupMembers((prev) => prev.map((m) => {
        if (m.id === memberId || m.memberId === memberId) {
          const currentOutstanding = m.plOutstanding || 0;
          const newOutstanding = Math.max(0, currentOutstanding - rebateAmt);
          return { ...m, plOutstanding: newOutstanding };
        }
        return m;
      }));

      // Record transaction
      setTransactions((prev) => {
        const newTx = {
          id: `tx-rebate-${Date.now()}`,
          orgId: org.id,
          branchId: staff.branchId || 'default-branch',
          staffId: staff.id || staff.staffId || '009',
          staffName: staff.name,
          memberId: mCode,
          memberName: mName,
          groupName: gName,
          type: 'collection',
          category: 'rebate',
          debitAcc: 'rebate',
          creditAcc: 'loan_outstanding',
          amount: rebateAmt,
          date: workingDay,
          addDate: workingDay,
          description: `ঋণ ছাড় (Rebate) প্রদান করা হয়েছে। কারণ: ${details.reason}`,
          collections: { pl: rebateAmt, gs: 0, cbs: 0, lts: 0 },
          withdrawals: { pl: 0, gs: 0, cbs: 0, lts: 0 },
          exemption: rebateAmt,
          exemptionReason: details.reason
        };
        return [newTx, ...prev];
      });

      setAlertMsg({
        type: 'success',
        text: `সদস্য ${mName}-কে সফলভাবে ৳${rebateAmt.toLocaleString('bn-BD')} ঋণ ছাড় দেওয়া হয়েছে!`
      });
    }

    // 2. Handle Reschedule
    else if (actionType === 'reschedule') {
      setGroupMembers((prev) => prev.map((m) => {
        if (m.id === memberId || m.memberId === memberId) {
          return { 
            ...m, 
            plInstallment: details.newInstallmentAmount,
            plOutstanding: details.newOutstandingAmount
          };
        }
        return m;
      }));

      setTransactions((prev) => {
        const newTx = {
          id: `tx-reschedule-${Date.now()}`,
          orgId: org.id,
          branchId: staff.branchId || 'default-branch',
          staffId: staff.id || staff.staffId || '009',
          staffName: staff.name,
          memberId: mCode,
          memberName: mName,
          groupName: gName,
          type: 'general',
          category: 'loan_reschedule',
          debitAcc: 'loan_outstanding',
          creditAcc: 'loan_outstanding',
          amount: 0,
          date: workingDay,
          addDate: workingDay,
          description: `ঋণ রি-শিডিউল করা হয়েছে। নতুন কিস্তির পরিমাণ: ৳${details.newInstallmentAmount.toLocaleString('bn-BD')}`,
          collections: { pl: 0, gs: 0, cbs: 0, lts: 0 },
          withdrawals: { pl: 0, gs: 0, cbs: 0, lts: 0 },
          exemption: 0,
          exemptionReason: null
        };
        return [newTx, ...prev];
      });

      setAlertMsg({
        type: 'success',
        text: `সদস্য ${mName} এর ঋণ কিস্তি রি-শিডিউল সম্পন্ন হয়েছে! নতুন কিস্তি ৳${details.newInstallmentAmount.toLocaleString('bn-BD')} টাকা।`
      });
    }

    // 3. Handle Auto Sequential Adjustment or Single Account Adjustment
    else if (actionType === 'auto_adjustment' || (actionType === 'adjustment' && details?.isAutoSequential)) {
      const outstanding = memberObj.plOutstanding || 0;
      const currentGs = memberObj.gsBalance ?? memberObj.savingsBalance ?? 0;
      const currentLts = memberObj.ltsBalance ?? 0;
      const currentCbs = memberObj.cbsBalance ?? 0;
      const currentShare = memberObj.shareBalance ?? ((memberObj.shareCount || 0) * 100);

      const memberLtsAcc = ltsAccounts.find(acc => (acc.memberId === memberId || acc.memberId === mCode) && acc.status === 'active');
      const memberCbsAcc = cbsAccounts.find(acc => (acc.memberId === memberId || acc.memberId === mCode) && acc.status === 'active');

      const result = processLoanAdjustment(memberId, outstanding, {
        currentGsBalance: currentGs,
        currentLtsPrincipal: currentLts,
        memberLts: memberLtsAcc,
        currentCbsPrincipal: currentCbs,
        memberCbs: memberCbsAcc,
        currentShareBalance: currentShare
      });

      // Update Member state
      setGroupMembers((prev) => prev.map((m) => {
        if (m.id === memberId || m.memberId === memberId) {
          return {
            ...m,
            gsBalance: result.finalGsBalance,
            savingsBalance: result.finalGsBalance,
            ltsBalance: result.finalLtsBalance,
            cbsBalance: result.finalCbsBalance,
            shareBalance: result.finalShareBalance,
            shareCount: Math.floor(result.finalShareBalance / 100),
            plOutstanding: result.remainingLoan,
            status: result.isShareInactive && result.remainingLoan === 0 ? 'inactive' : m.status
          };
        }
        return m;
      }));

      // Update Savings accounts
      if (result.gsAdjusted > 0) {
        setSavingsAccounts((prev) => prev.map((acc) => {
          if (acc.memberId === memberId || acc.memberId === mCode) {
            return { ...acc, balance: result.finalGsBalance };
          }
          return acc;
        }));
      }

      if (result.ltsAdjusted > 0 && memberLtsAcc) {
        setLtsAccounts((prev) => prev.map((acc) => {
          if (acc.id === memberLtsAcc.id) {
            return { ...acc, balance: result.finalLtsBalance };
          }
          return acc;
        }));
      }

      if (result.cbsAdjusted > 0 && memberCbsAcc) {
        setCbsAccounts((prev) => prev.map((acc) => {
          if (acc.id === memberCbsAcc.id) {
            return { ...acc, balance: result.finalCbsBalance };
          }
          return acc;
        }));
      }

      const totalAdjusted = result.gsAdjusted + result.ltsAdjusted + result.cbsAdjusted + result.shareAdjusted;

      setTransactions((prev) => {
        const adjustTx = {
          id: `tx-autoadjust-${Date.now()}`,
          orgId: org.id,
          branchId: staff.branchId || 'default-branch',
          staffId: staff.id || staff.staffId || '009',
          staffName: staff.name,
          memberId: mCode,
          memberName: mName,
          groupName: gName,
          type: 'collection',
          category: 'loan_adjustment',
          debitAcc: 'auto_sequential_savings',
          creditAcc: 'loan_outstanding',
          amount: totalAdjusted,
          date: workingDay,
          addDate: workingDay,
          description: `স্বয়ংক্রিয় পর্যায়ক্রমিক লোন সমন্বয় সম্পন্ন (GS: ৳${result.gsAdjusted}, LTS: ৳${result.ltsAdjusted}, CBS: ৳${result.cbsAdjusted}, Share: ৳${result.shareAdjusted})। অবশিষ্ট ঋণ: ৳${result.remainingLoan}`,
          collections: { pl: totalAdjusted, gs: 0, cbs: 0, lts: 0 },
          withdrawals: { pl: 0, gs: result.gsAdjusted, cbs: result.cbsAdjusted, lts: result.ltsAdjusted },
          exemption: 0,
          exemptionReason: null
        };
        return [adjustTx, ...prev];
      });

      setAlertMsg({
        type: 'success',
        text: `সদস্য ${mName} এর স্বয়ংক্রিয় পর্যায়ক্রমিক লোন সমন্বয় সফল হয়েছে! মোট সমন্বয়: ৳${totalAdjusted.toLocaleString('bn-BD')}`
      });
    }

    // 4. Handle Single Account Adjustment
    else if (actionType === 'adjustment') {
      const adjustAmt = details.amount;
      const savType = details.savingsType;
      const savAccId = details.savingsAccountId;

      if (savType === 'GS') {
        setSavingsAccounts((prev) => prev.map((acc) => {
          if (acc.id === savAccId) {
            return { ...acc, balance: Math.max(0, acc.balance - adjustAmt) };
          }
          return acc;
        }));
        setGroupMembers((prev) => prev.map((m) => {
          if (m.id === memberId || m.memberId === memberId) {
            const currentSavings = m.savingsBalance || m.gsBalance || 0;
            const currentOutstanding = m.plOutstanding || 0;
            return { 
              ...m, 
              savingsBalance: Math.max(0, currentSavings - adjustAmt),
              gsBalance: Math.max(0, currentSavings - adjustAmt),
              plOutstanding: Math.max(0, currentOutstanding - adjustAmt)
            };
          }
          return m;
        }));
      } else if (savType === 'CBS') {
        setCbsAccounts((prev) => prev.map((acc) => {
          if (acc.id === savAccId) {
            return { ...acc, balance: Math.max(0, acc.balance - adjustAmt) };
          }
          return acc;
        }));
        setGroupMembers((prev) => prev.map((m) => {
          if (m.id === memberId || m.memberId === memberId) {
            const currentCbs = m.cbsBalance || 0;
            const currentOutstanding = m.plOutstanding || 0;
            return { 
              ...m, 
              cbsBalance: Math.max(0, currentCbs - adjustAmt),
              plOutstanding: Math.max(0, currentOutstanding - adjustAmt)
            };
          }
          return m;
        }));
      } else if (savType === 'LTS') {
        setLtsAccounts((prev) => prev.map((acc) => {
          if (acc.id === savAccId) {
            return { ...acc, balance: Math.max(0, acc.balance - adjustAmt) };
          }
          return acc;
        }));
        setGroupMembers((prev) => prev.map((m) => {
          if (m.id === memberId || m.memberId === memberId) {
            const currentLts = m.ltsBalance || 0;
            const currentOutstanding = m.plOutstanding || 0;
            return { 
              ...m, 
              ltsBalance: Math.max(0, currentLts - adjustAmt),
              plOutstanding: Math.max(0, currentOutstanding - adjustAmt)
            };
          }
          return m;
        }));
      }

      setTransactions((prev) => {
        const txCategory = savType === 'GS' ? 'general_savings' : savType === 'CBS' ? 'cbs_savings' : 'lts_savings';
        const adjustTx = {
          id: `tx-adjust-${Date.now()}`,
          orgId: org.id,
          branchId: staff.branchId || 'default-branch',
          staffId: staff.id || staff.staffId || '009',
          staffName: staff.name,
          memberId: mCode,
          memberName: mName,
          groupName: gName,
          type: 'collection',
          category: 'loan_adjustment',
          debitAcc: txCategory,
          creditAcc: 'loan_outstanding',
          amount: adjustAmt,
          date: workingDay,
          addDate: workingDay,
          description: `সঞ্চয় হতে ঋণ সমন্বয় করা হয়েছে। সমন্বয়কৃত পরিমাণ: ৳${adjustAmt.toLocaleString('bn-BD')} (${savType} অ্যাকাউন্ট হতে)`,
          collections: { pl: adjustAmt, gs: 0, cbs: 0, lts: 0 },
          withdrawals: { pl: 0, gs: savType === 'GS' ? adjustAmt : 0, cbs: savType === 'CBS' ? adjustAmt : 0, lts: savType === 'LTS' ? adjustAmt : 0 },
          exemption: 0,
          exemptionReason: null
        };
        return [adjustTx, ...prev];
      });

      setAlertMsg({
        type: 'success',
        text: `সদস্য ${mName} এর সঞ্চয় ব্যালেন্স হতে সফলভাবে ৳${adjustAmt.toLocaleString('bn-BD')} টাকা ঋণ সমন্বয় করা হয়েছে!`
      });
    }

    // 4. Handle Write-off
    else if (actionType === 'write_off') {
      const writeoffAmt = memberObj.plOutstanding || 0;
      setGroupMembers((prev) => prev.map((m) => {
        if (m.id === memberId || m.memberId === memberId) {
          return { ...m, plOutstanding: 0 };
        }
        return m;
      }));

      setTransactions((prev) => {
        const writeoffTx = {
          id: `tx-writeoff-${Date.now()}`,
          orgId: org.id,
          branchId: staff.branchId || 'default-branch',
          staffId: staff.id || staff.staffId || '009',
          staffName: staff.name,
          memberId: mCode,
          memberName: mName,
          groupName: gName,
          type: 'collection',
          category: 'write_off',
          debitAcc: 'write_off',
          creditAcc: 'loan_outstanding',
          amount: writeoffAmt,
          date: workingDay,
          addDate: workingDay,
          description: `অনাদায়ী ঋণ অবলোপন (Write-off) করা হয়েছে। অবলোপনকৃত পরিমাণ: ৳${writeoffAmt.toLocaleString('bn-BD')}. কারণ: ${details.reason}`,
          collections: { pl: writeoffAmt, gs: 0, cbs: 0, lts: 0 },
          withdrawals: { pl: 0, gs: 0, cbs: 0, lts: 0 },
          exemption: writeoffAmt,
          exemptionReason: details.reason
        };
        return [writeoffTx, ...prev];
      });

      setAlertMsg({
        type: 'success',
        text: `সদস্য ${mName} এর অনাদায়ী লোন ৳${writeoffAmt.toLocaleString('bn-BD')} সফলভাবে অবলোপন করা হয়েছে!`
      });
    }

    // 5. Handle Close Loan
    else if (actionType === 'close') {
      setGroupMembers((prev) => prev.map((m) => {
        if (m.id === memberId || m.memberId === memberId) {
          return { ...m, plOutstanding: 0, plInstallment: 0 };
        }
        return m;
      }));

      setAlertMsg({
        type: 'success',
        text: `সদস্য ${mName} এর ঋণ হিসাবটি সফলভাবে ক্লোজ করা হয়েছে!`
      });
    }
  };

  const handleSaveTransactions = (updatedMembersList: any[], txDetails: any) => {
    if (isRealBMReadOnly) {
      alert('শাখা ব্যবস্থাপক (BM) হিসেবে আপনি গ্রুপ কার্যক্রমের কোনো তথ্য পরিবর্তন করতে পারবেন না। এটি রিড-অনলি মুডে রয়েছে।');
      return;
    }
    setGroupMembers(updatedMembersList);
    
    // Find the updated member profile to sync specific ledger account list balances
    const updatedMember = updatedMembersList.find(m => m.memberId === txDetails.memberId || m.id === txDetails.memberId);
    if (updatedMember) {
      // 1. Sync active General Savings (GS) account balance
      setSavingsAccounts((prev) => prev.map((acc) => {
        if ((acc.memberId === updatedMember.id || acc.memberId === updatedMember.memberId || acc.memberCode === updatedMember.memberId) && acc.type === 'GS') {
          return { ...acc, balance: updatedMember.savingsBalance ?? updatedMember.gsBalance ?? 0 };
        }
        return acc;
      }));

      // 2. Sync active CBS Account balance
      setCbsAccounts((prev) => prev.map((acc) => {
        if (acc.memberId === updatedMember.id || acc.memberId === updatedMember.memberId || acc.memberCode === updatedMember.memberId) {
          return { ...acc, balance: updatedMember.cbsBalance ?? 0 };
        }
        return acc;
      }));

      // 3. Sync active LTS Account balance
      setLtsAccounts((prev) => prev.map((acc) => {
        if (acc.memberId === updatedMember.id || acc.memberId === updatedMember.memberId || acc.memberCode === updatedMember.memberId) {
          return { ...acc, balance: updatedMember.ltsBalance ?? 0 };
        }
        return acc;
      }));
    }

    setTransactions((prev) => {
      // Find if there is an existing transaction on the same day for this member of type 'collection'
      const existingIdx = prev.findIndex(t => 
        t.type === 'collection' && 
        t.memberId === txDetails.memberId && 
        t.date === txDetails.date
      );
      
      const newTx = {
        id: existingIdx >= 0 ? prev[existingIdx].id : `tx-sys-${Date.now()}`,
        orgId: org.id,
        branchId: staff.branchId || 'default-branch',
        staffId: staff.id || staff.staffId || '009',
        staffName: staff.name,
        memberId: txDetails.memberId,
        memberName: txDetails.memberName,
        groupName: txDetails.groupName,
        type: 'collection',
        category: 'savings_collection',
        debitAcc: 'cash',
        creditAcc: 'savings_collection',
        amount: txDetails.netAmount,
        date: txDetails.date,
        addDate: txDetails.date,
        description: `Daily collection (PL: ${txDetails.collections.pl}, GS: ${txDetails.collections.gs}, CBS: ${txDetails.collections.cbs}, LTS: ${txDetails.collections.lts})`,
        collections: txDetails.collections,
        withdrawals: txDetails.withdrawals,
        exemption: 0, // Exemption is 0 here as it is pending BM approval
        exemptionReason: null
      };
      
      let nextList = [...prev];
      if (existingIdx >= 0) {
        nextList[existingIdx] = newTx;
      } else {
        nextList = [newTx, ...nextList];
      }
      
      return nextList;
    });

    // If they specified an exemption in the form, automatically create a pending request instead of ledger-posting it immediately.
    if (txDetails.exemption && txDetails.exemption > 0) {
      const gId = updatedMember ? updatedMember.groupId : '';
      const newExReq = {
        id: `exem-req-${Date.now()}-${txDetails.memberId}`,
        orgId: org.id,
        branchId: staff.branchId || 'default-branch',
        memberId: txDetails.memberId,
        memberName: txDetails.memberName,
        groupId: gId,
        groupName: txDetails.groupName,
        amount: Number(txDetails.exemption) || 0,
        reason: txDetails.exemptionReason || 'special_waiver',
        requestDate: txDetails.date || workingDay,
        requestedBy: staff.name,
        requestedById: staff.id || staff.staffId || '009',
        status: 'pending'
      };

      setExemptionRequests(prevReqs => {
        const existingReqIdx = prevReqs.findIndex(r => 
          r.memberId === txDetails.memberId && 
          r.requestDate === txDetails.date && 
          r.status === 'pending'
        );
        if (existingReqIdx >= 0) {
          const updatedReqs = [...prevReqs];
          updatedReqs[existingReqIdx] = newExReq;
          return updatedReqs;
        } else {
          return [newExReq, ...prevReqs];
        }
      });
      
      setAlertMsg({
        type: 'success',
        text: `আদায় লেনদেন সফলভাবে সংরক্ষিত হয়েছে! ঋণ মওকুফ ও LSRF এর অংশটি (৳${txDetails.exemption}) শাখা ব্যবস্থাপক (BM)-এর অনুমোদনের জন্য প্রেরণ করা হয়েছে।`
      });
    } else {
      setAlertMsg({
        type: 'success',
        text: `${txDetails.memberName} এর দৈনিক আদায়কৃত লেনদেন (আদায়: ৳${txDetails.netAmount}) সফলভাবে সংরক্ষণ করা হয়েছে!`
      });
    }
  };

  // Exemption / LSRF inline editing states
  const [editingExemId, setEditingExemId] = useState<string | null>(null);
  const [editingExemAmount, setEditingExemAmount] = useState<string>('');

  // Exemption approval logic
  const handleApproveExemption = (reqId: string) => {
    const requestObj = exemptionRequests.find(r => r.id === reqId);
    if (!requestObj) return;

    if (!window.confirm(`আপনি কি এই ঋণ মওকুফ আবেদনটি অনুমোদন করতে চান? (পরিমাণ: ৳${requestObj.amount})`)) return;

    // Apply the outstanding reduction to the member
    setGroupMembers((prevMembers) => {
      return prevMembers.map((m) => {
        if (m.memberId === requestObj.memberId) {
          const basePlOutstanding = Number(m.plOutstanding) || 0;
          return {
            ...m,
            plOutstanding: Math.max(0, basePlOutstanding - requestObj.amount),
            status: requestObj.reason === 'member_death' ? 'inactive' : m.status,
            inactiveReason: requestObj.reason === 'member_death' ? 'গ্রাহকের মৃত্যু (LSRF ঋণ মওকুফ)' : m.inactiveReason
          };
        }
        return m;
      });
    });

    // Create the auto voucher transaction
    const debAcc = (requestObj.reason === 'member_death' || requestObj.reason === 'guardian_death')
      ? 'risk_fund'
      : 'exemption_expense';

    const mapReasonText = (reason: string) => {
      if (reason === 'member_death') return 'সদস্যের মৃত্যু (LSRF ঋণ মওকুফ)';
      if (reason === 'guardian_death') return 'অভিভাবকের মৃত্যু (LSRF ঋণ মওকুফ)';
      if (reason === 'special_waiver') return 'বিশেষ বিবেচনা মওকুফ';
      return 'সাধারণ ঋণ মওকুফ ছাড়';
    };

    const voucherId = `VOU-EXEM-${requestObj.memberId}-${workingDay}`;
    const autoVoucher = {
      id: voucherId,
      orgId: org.id,
      branchId: staff.branchId || 'default-branch',
      staffId: staff.id || staff.staffId || '009',
      staffName: staff.name,
      memberId: requestObj.memberId,
      memberName: requestObj.memberName,
      groupName: requestObj.groupName,
      type: 'collection',
      category: `ঋণ মওকুফ (সাধারণ)`,
      amount: requestObj.amount,
      note: `ঋণ মওকুফ খতিয়ান পোস্টিং (LSRF): সদস্যঃ ${requestObj.memberName} (${requestObj.memberId}), কারণঃ ${mapReasonText(requestObj.reason || '')}`,
      addDate: workingDay,
      date: workingDay,
      debitAcc: debAcc,
      creditAcc: 'general_loan_disburse',
      paymentMode: 'cash'
    };

    // Add transaction
    setTransactions((prevTx) => {
      const filtered = prevTx.filter(t => t.id !== voucherId);
      return [autoVoucher, ...filtered];
    });

    // Update request status
    setExemptionRequests((prevReqs) => {
      return prevReqs.map((r) => {
        if (r.id === reqId) {
          return {
            ...r,
            status: 'approved',
            resolvedBy: staff.name,
            resolvedDate: workingDay
          };
        }
        return r;
      });
    });

    setAlertMsg({
      type: 'success',
      text: `${requestObj.memberName}-এর ৳${requestObj.amount} পরিমাণ ঋণ মওকুফ এবং খতিয়ান পোস্টিং সফলভাবে অনুমোদিত হয়েছে!`
    });
  };

  // Exemption reject logic
  const handleRejectExemption = (reqId: string) => {
    const requestObj = exemptionRequests.find(r => r.id === reqId);
    if (!requestObj) return;

    const notes = prompt("প্রত্যাখ্যান করার জন্য কোনো কারণ উল্লেখ করুন (ঐচ্ছিক):");
    if (notes === null) return; // Cancelled

    setExemptionRequests((prevReqs) => {
      return prevReqs.map((r) => {
        if (r.id === reqId) {
          return {
            ...r,
            status: 'rejected',
            resolvedBy: staff.name,
            resolvedDate: workingDay,
            rejectReason: notes || 'কোন মন্তব্য নেই'
          };
        }
        return r;
      });
    });

    setAlertMsg({
      type: 'success',
      text: `${requestObj.memberName}-এর ঋণ মওকুফ আবেদনটি প্রত্যাখ্যান করা হয়েছে।`
    });
  };

  // Exemption edit amount logic
  const handleSaveEditExemption = (reqId: string, newAmount: number) => {
    if (isNaN(newAmount) || newAmount <= 0) {
      alert("দয়া করে একটি সঠিক পরিমাণ লিখুন!");
      return;
    }

    setExemptionRequests((prevReqs) => {
      return prevReqs.map((r) => {
        if (r.id === reqId) {
          return {
            ...r,
            amount: newAmount
          };
        }
        return r;
      });
    });

    setEditingExemId(null);
    setAlertMsg({
      type: 'success',
      text: `আবেদনের পরিমাণ পরিবর্তন করে ৳${newAmount} করা হয়েছে!`
    });
  };

  const [groupOpActiveSubTab, setGroupOpActiveSubTab] = useState<'list' | 'search'>('list');
  const [selectedStaffIdForSearch, setSelectedStaffIdForSearch] = useState(() => {
    return staff.designation === 'শাখা ব্যবস্থাপক' ? 'all' : (staff.staffId || staff.id);
  });
  const [selectedGroupIdForSearch, setSelectedGroupIdForSearch] = useState('');
  const [selectedMemberIdForSearch, setSelectedMemberIdForSearch] = useState('');
  const [isAccountCardViewOpen, setIsAccountCardViewOpen] = useState(false);
  const [isAccountStatementOpen, setIsAccountStatementOpen] = useState(false);
  const [isLoanScheduleOpen, setIsLoanScheduleOpen] = useState(false);

  // --- Move Group states ---
  const [moveGroupTargetId, setMoveGroupTargetId] = useState('');
  const [moveGroupDestinationStaffId, setMoveGroupDestinationStaffId] = useState('');
  const [moveGroupTransferDate, setMoveGroupTransferDate] = useState(() => workingDay || new Date().toISOString().split('T')[0]);
  const [moveGroupDonorId, setMoveGroupDonorId] = useState('all'); // default to all or a specific staffId
  const [moveGroupSelectedGroupIds, setMoveGroupSelectedGroupIds] = useState<string[]>([]);

  // --- Accounts form states ---
  const [isTxModalOpen, setIsTxModalOpen] = useState(false);
  const [txType, setTxType] = useState<'income' | 'expense'>('income');
  const [txCategory, setTxCategory] = useState('ভর্তিকরণ ফি');
  const [txAmount, setTxAmount] = useState('');
  const [txNote, setTxNote] = useState('');
  const [txPaymentMode, setTxPaymentMode] = useState<'cash' | 'bank'>('cash');

  // Synchronize all transaction and general date fields to workingDay by default
  React.useEffect(() => {
    if (workingDay) {
      setJournalVoucherDate(workingDay);
      setVoucherDateInput(workingDay);
      setSingleTxDate(workingDay);
      setStaffJoiningDateInput(workingDay);
      setLeaveStart(workingDay);
      const d = new Date(workingDay + 'T00:00:00');
      d.setDate(d.getDate() + 7);
      setLeaveEnd(d.toISOString().split('T')[0]);
      setHolidayDate(workingDay);
      setMoveGroupTransferDate(workingDay);
    }
  }, [workingDay]);

  // --- Accounts module additional states & filters ---
  const [coaSubTab, setCoaSubTab] = useState<'ledger' | 'coa'>('ledger');
  const [startDate, setStartDate] = useState(() => {
    // Default to first day of current month
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
  });
  const [endDate, setEndDate] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });

  // Auto clean alert messages after 5 seconds
  useEffect(() => {
    if (alertMsg) {
      const t = setTimeout(() => setAlertMsg(null), 6000);
      return () => clearTimeout(t);
    }
  }, [alertMsg]);

  // Handle staff addition/editing
  const handleSaveStaff = (e: React.FormEvent) => {
    e.preventDefault();
    if (!staffNameInput || !staffPhoneInput) {
      alert('অনুগ্রহ করে নাম এবং মোবাইল নম্বর দিন।');
      return;
    }

    if (isStaffEditMode && editingStaffId) {
      setStaffList(prev => prev.map(s => s.id === editingStaffId ? {
        ...s,
        name: staffNameInput,
        phone: staffPhoneInput,
        designation: staffDesignationInput,
        joiningDate: staffJoiningDateInput
      } : s));
      setAlertMsg({ type: 'success', text: `কর্মকর্তা "${staffNameInput}" এর তথ্য সফলভাবে আপডেট করা হয়েছে।` });
    } else {
      // Generate unique numeric staff UID starting from 009
      let autoStaffId = '';
      let currentNum = 9;
      do {
        autoStaffId = currentNum.toString().padStart(3, '0');
        currentNum++;
      } while (staffList.some(s => s.staffId === autoStaffId));
      
      const generatedPassword = '1234';

      const newStaff: Staff = {
        id: Date.now().toString(),
        orgId: org.id,
        name: staffNameInput,
        phone: staffPhoneInput,
        designation: staffDesignationInput,
        joiningDate: staffJoiningDateInput,
        branchId: staff.branchId, // Assigned automatically to current BM's branch
        branchJoiningDate: new Date().toISOString().split('T')[0],
        staffId: autoStaffId,
        password: generatedPassword
      };

      setStaffList(prev => [...prev, newStaff]);
      setAlertMsg({ 
        type: 'success', 
        text: `নতুন কর্মী "${staffNameInput}" সফলভাবে যুক্ত হয়েছে! আইডি: ${autoStaffId}, পাসওয়ার্ড: ${generatedPassword}` 
      });
    }

    // Reset fields
    setStaffNameInput('');
    setStaffPhoneInput('');
    setStaffDesignationInput('মাঠ কর্মী');
    setIsStaffModalOpen(false);
  };

  // Open Edit Staff Modal
  const openEditStaff = (target: Staff) => {
    setIsStaffEditMode(true);
    setEditingStaffId(target.id);
    setStaffNameInput(target.name);
    setStaffPhoneInput(target.phone);
    setStaffDesignationInput(target.designation);
    setStaffJoiningDateInput(target.joiningDate || new Date().toISOString().split('T')[0]);
    setIsStaffModalOpen(true);
  };

  // Delete staff/officer
  const handleDeleteStaff = (target: Staff) => {
    if (target.staffId?.startsWith('ILO')) {
      alert('সিস্টেম ও ব্যাকআপ এও "ILO" কে ডিলেট করা যাবে না!');
      return;
    }
    
    // Prevent the logged-in Branch Manager from deleting themselves
    if (target.id === staff.id || (target.staffId && target.staffId === staff.staffId)) {
      alert('আপনি বর্তমানে এই ব্রাঞ্চ ম্যানেজার অ্যাকাউন্টে লগইন আছেন। লগইন থাকা অবস্থায় নিজেকে ডিলিট বা অপসারণ করা সম্ভব নয়!');
      return;
    }

    // Find groups assigned to this staff member
    const assignedGroups = groupList.filter(g => g.assignedStaffId === target.id || g.assignedStaffId === target.staffId);
    
    let confirmMsg = `আপনি কি নিশ্চিতভাবে "${target.name}" কে কর্মী তালিকা থেকে বাদ দিতে চান?`;
    if (assignedGroups.length > 0) {
      confirmMsg = `কর্মী "${target.name}" বর্তমানে ${assignedGroups.length} টি গ্রুপ/সমিতির দায়িত্বে আছেন (যেমন: ${assignedGroups.map(g => g.name).join(', ')})।\n\nডিলিট করার পর তার দায়ীত্বাধীন গ্রুপগুলো স্বয়ংক্রিয়ভাবে আপনার শাখার ডেক্স ব্যাকআপ কর্মকর্তা "ILO-${currentBranchCode}" তে স্থানান্তরিত হবে।\n\nআপনি কি নিশ্চিতভাবে তাকে কর্মী তালিকা থেকে বাদ দিতে চান?`;
    }

    if (confirm(confirmMsg)) {
      if (assignedGroups.length > 0) {
        const updatedGroups = groupList.map(g => {
          if (g.assignedStaffId === target.id || g.assignedStaffId === target.staffId) {
            return { ...g, assignedStaffId: `ILO-${currentBranchCode}` };
          }
          return g;
        });
        setGroupList(updatedGroups);
      }
      const newStaffList = staffList.filter(s => s.id !== target.id);
      setStaffList(newStaffList);
      registerDeletedId(org.id, target.id);
      if (target.staffId) {
        registerDeletedId(org.id, target.staffId);
      }
      localStorage.setItem(`tanzil_staff_${org.id}`, JSON.stringify(newStaffList));
      setAlertMsg({ type: 'success', text: `কর্মী "${target.name}" বাদ দেয়া হয়েছে এবং তার দায়িত্বাধীন গ্রুপ ও সমিতিগুলো স্বয়ংক্রিয়ভাবে ILO-তে স্থানান্তরিত হয়েছে।` });
    }
  };

  // Handle granting leave to a staff and automatically transfer all assigned groups to ILO!
  const handleGrantLeave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!leaveStaffTarget) return;

    // 1. Mark staff as on leave
    const targetId = leaveStaffTarget.id;
    const targetUid = leaveStaffTarget.staffId || '';
    const name = leaveStaffTarget.name;

    setStaffList(prev => prev.map(s => s.id === targetId ? {
      ...s,
      onLeave: true,
      leaveStart,
      leaveEnd,
      leaveReason
    } as any : s));

    // 2. Identify groups and migrate to ILO
    // Note: We check if group is assigned to this staff (using UID or DB ID)
    let movedCount = 0;
    const updatedGroups = groupList.map(g => {
      if (g.branchId === staff.branchId && (g.assignedStaffId === targetId || g.assignedStaffId === targetUid)) {
        movedCount++;
        return { ...g, assignedStaffId: `ILO-${currentBranchCode}` }; // Transfer to branch-specific ILO target
      }
      return g;
    });

    if (movedCount > 0) {
      setGroupList(updatedGroups);
      setAlertMsg({ 
        type: 'info', 
        text: `কর্মী "${name}" কে ছুটিতে পাঠানো হয়েছে। দ্বায়িত্বরত ${movedCount} টি গ্রুপ সফলভাবে সিস্টেম ব্যাকআপ অফিসার "ILO-${currentBranchCode}" তে স্থানান্তর করা হয়েছে!` 
      });
    } else {
      setAlertMsg({ 
        type: 'success', 
        text: `কর্মী "${name}" কে সফলভাবে ছুটিতে পাঠানো হয়েছে। (কোনো গ্রুপ বরাদ্দ ছিল না)` 
      });
    }

    setIsLeaveModalOpen(false);
    setLeaveStaffTarget(null);
  };

  // Cancel/Rescind Leave (Restore Staff to Active State)
  const handleCancelLeave = (srv: Staff) => {
    setStaffList(prev => prev.map(s => s.id === srv.id ? {
      ...s,
      onLeave: false,
      leaveStart: undefined,
      leaveEnd: undefined,
      leaveReason: undefined
    } as any : s));
    setAlertMsg({ type: 'success', text: `কর্মী "${srv.name}" এর ছুটি বাতিল করে পুনরায় দায়িত্বে ফিরিয়ে আনা হয়েছে।` });
  };

  // --- Group Operations logic ---
  const handleSaveGroup = (e: React.FormEvent) => {
    e.preventDefault();
    if (isRealBMReadOnly) {
      alert('শাখা ব্যবস্থাপক (BM) হিসেবে আপনি গ্রুপ কার্যক্রমের কোনো তথ্য পরিবর্তন করতে পারবেন না। এটি রিড-অনলি মুডে রয়েছে।');
      return;
    }
    if (!groupNameInput || !groupCodeInput) {
      alert('গ্রুপের নাম এবং কোড পূরণ করুন।');
      return;
    }

    const normalizedName = groupNameInput.trim().toLowerCase();
    const branchId = staff.branchId || '';
    
    // Check duplicate group name in the same branch
    const duplicateExists = groupList.some(g => 
      g.branchId === branchId && 
      g.name.trim().toLowerCase() === normalizedName && 
      (!isGroupEditMode || g.id !== editingGroupId)
    );
    
    if (duplicateExists) {
      alert(`একই শাখায় "${groupNameInput}" নামে ইতিমধ্যে একটি গ্রুপ রয়েছে! অনুগ্রহ করে অন্য নাম ব্যবহার করুন।`);
      return;
    }

    if (isGroupEditMode && editingGroupId) {
      setGroupList(prev => prev.map(g => g.id === editingGroupId ? {
        ...g,
        name: groupNameInput,
        code: groupCodeInput,
        assignedStaffId: groupStaffSelect,
        meetingDay: groupMeetingDayInput,
        village: groupVillageInput
      } : g));
      setAlertMsg({ type: 'success', text: `গ্রুপ "${groupNameInput}" সফলভাবে আপডেট করা হয়েছে।` });
    } else {
      // Add new group
      const newGroup: Group = {
        id: Date.now().toString(),
        orgId: org.id,
        branchId: staff.branchId || '',
        name: groupNameInput,
        code: groupCodeInput,
        assignedStaffId: groupStaffSelect,
        meetingDay: groupMeetingDayInput,
        village: groupVillageInput,
        addDate: new Date().toISOString().split('T')[0]
      };
      setGroupList(prev => [...prev, newGroup]);
      setAlertMsg({ type: 'success', text: `নতুন গ্রুপ "${groupNameInput}" সফলভাবে যুক্ত করা হয়েছে।` });
    }

    // Reset inputs
    setGroupNameInput('');
    setGroupCodeInput('');
    setGroupStaffSelect(`ILO-${currentBranchCode}`);
    setGroupMeetingDayInput('শনিবার');
    setGroupVillageInput('');
    setIsGroupEditMode(false);
    setEditingGroupId(null);
    setSelectedOperation('group_operation'); // Switch back to group list view
  };

  const openEditGroup = (g: Group) => {
    setIsGroupEditMode(true);
    setEditingGroupId(g.id);
    setGroupNameInput(g.name);
    setGroupCodeInput(g.code);
    setGroupStaffSelect(g.assignedStaffId);
    setGroupMeetingDayInput(g.meetingDay || 'শনিবার');
    setGroupVillageInput(g.village || '');
    setSelectedOperation('add_group');
  };

  const handleDeleteGroup = (g: Group) => {
    if (isRealBMReadOnly) {
      alert('শাখা ব্যবস্থাপক (BM) হিসেবে আপনি গ্রুপ কার্যক্রমের কোনো তথ্য পরিবর্তন করতে পারবেন না। এটি রিড-অনলি মুডে রয়েছে।');
      return;
    }
    if (confirm(`আপনি কি নিশ্চিতভাবে "${g.name}" গ্রুপটি ডিলিট করতে চান?`)) {
      setGroupList(prev => prev.filter(x => x.id !== g.id));
      registerDeletedId(org.id, g.id);
      setAlertMsg({ type: 'success', text: `গ্রুপ "${g.name}" মুছে ফেলা হয়েছে।` });
    }
  };

  // Handle custom multi-group Transfer/Move Action with Handover Details
  const handleMoveGroupAction = (e: React.FormEvent) => {
    e.preventDefault();
    if (isRealBMReadOnly) {
      alert('শাখা ব্যবস্থাপক (BM) হিসেবে আপনি গ্রুপ কার্যক্রমের কোনো তথ্য পরিবর্তন করতে পারবেন না। এটি রিড-অনলি মুডে রয়েছে।');
      return;
    }
    if (moveGroupSelectedGroupIds.length === 0) {
      alert('অনুগ্রহ করে অন্তত একটি গ্রুপ/সমিতি নির্বাচন করুন।');
      return;
    }
    if (!moveGroupDestinationStaffId) {
      alert('নতুন দায়িত্বপ্রাপ্ত কর্মকর্তার নাম (কে পাবেন) নির্বাচন করুন।');
      return;
    }

    const matchedRecipient = staffList.find(s => s.staffId === moveGroupDestinationStaffId || s.id === moveGroupDestinationStaffId);
    if (!matchedRecipient) {
      alert('গ্রহণকারী কর্মকর্তা খুঁজে পাওয়া যায়নি।');
      return;
    }

    const matchedDonor = staffList.find(s => s.staffId === moveGroupDonorId || s.id === moveGroupDonorId);
    const donorLabel = matchedDonor ? matchedDonor.name : 'একাধিক কর্মকর্তা / সাধারণ পুল';

    // Collect names of transferred groups for notification
    const transferredGroupNames = groupList
      .filter(g => moveGroupSelectedGroupIds.includes(g.id))
      .map(g => g.name);

    // Update assignment in groups state
    setGroupList(prev => prev.map(g => {
      if (moveGroupSelectedGroupIds.includes(g.id)) {
        return {
          ...g,
          assignedStaffId: moveGroupDestinationStaffId
        };
      }
      return g;
    }));

    setAlertMsg({ 
      type: 'success', 
      text: `হস্তান্তর সম্পন্ন হয়েছে! ${moveGroupTransferDate} তারিখে (${transferredGroupNames.join(', ')}) মোট ${moveGroupSelectedGroupIds.length} টি গ্রুপের দায়িত্ব "${donorLabel}" থেকে সফলভাবে কর্মকর্তা "${matchedRecipient.name}" এর নিকট স্থানান্তর করা হয়েছে।` 
    });

    // Reset move group states
    setMoveGroupSelectedGroupIds([]);
    setMoveGroupDestinationStaffId('');
    setMoveGroupDonorId('all');
    setSelectedOperation('group_operation');
  };

  // Adding random financial operations/ledgers for branch
  const handleSaveTransaction = (e: React.FormEvent) => {
    e.preventDefault();
    if (!txAmount || isNaN(Number(txAmount))) {
      alert('সঠিক পরিমাণ দিন।');
      return;
    }

    const newTx = {
      id: Date.now().toString(),
      type: txType,
      category: txCategory,
      amount: Number(txAmount),
      note: txNote || 'কোনো মন্তব্য নেই',
      date: singleTxDate || workingDay || new Date().toISOString().split('T')[0],
      addDate: singleTxDate || workingDay || new Date().toISOString().split('T')[0],
      paymentMode: txPaymentMode
    };

    setTransactions(prev => [newTx, ...prev]);
    setIsTxModalOpen(false);
    setTxAmount('');
    setTxNote('');
    setTxPaymentMode('cash');
    setAlertMsg({ type: 'success', text: `লেনদেন বিবরণী সফলভাবে একাউন্ট খাতায় যুক্ত করা হয়েছে।` });
  };

  const handleSaveDoubleEntryVoucher = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAmount = Number(voucherAmount);
    if (!voucherAmount || isNaN(parsedAmount) || parsedAmount <= 0) {
      alert('সঠিক পরিমাণ দিন।');
      return;
    }

    const type = voucherType === 'receipt' ? 'income' : 'expense';

    // Map account code/name to readable category dynamically
    let category = '';
    const findAccountName = (accId: string) => {
      if (accId === 'cash') return '💵 ক্যাশ বক্স (নগদ তহবিল)';
      const bank = bankAccounts.find(b => b.id === accId);
      if (bank) return `🏦 ${bank.bankName} [A/C: ${bank.accountNo}]`;
      
      for (const g of COA_TREE) {
        const found = g.accounts.find(a => a.id === accId);
        if (found) {
          if (accId === 'admission_fee') return 'ভর্তিকরণ ফি (Admission)';
          if (accId === 'passbook_fee') return 'ঋণ বই ও পাসবুক বিক্রয়';
          if (accId === 'service_charge') return 'সার্ভিস চার্জ আদায়';
          if (accId === 'general_savings') return 'সদস্য সাধারণ সঞ্চয় আদায়';
          if (accId === 'bank_interest') return 'ব্যাংক জমাকৃত সুদ প্রাপ্তি';
          if (accId === 'office_rent') return 'অফিস ভাড়া';
          if (accId === 'staff_salaries') return 'কর্মকর্তা-কর্মচারীদের বেতন ও ভাতা';
          if (accId === 'travel_allowance') return 'যাতায়াত ও ভ্রমণ খরচ';
          if (accId === 'staff_advance') return 'কর্মচারী অগ্রিম';
          return `${found.name} (${found.enName})`;
        }
      }
      return accId;
    };

    if (voucherType === 'receipt') {
      category = findAccountName(voucherCreditAcc);
    } else {
      category = findAccountName(voucherDebitAcc);
    }

    const newTx = {
      id: `VOU-${Date.now().toString().slice(-6)}`,
      type: type,
      category: category,
      amount: parsedAmount,
      note: voucherNote || 'কোনো মন্তব্য নেই',
      date: voucherDateInput || workingDay,
      addDate: voucherDateInput || workingDay,
      debitAcc: voucherDebitAcc,
      creditAcc: voucherCreditAcc,
      paymentMode: (voucherDebitAcc?.startsWith('bank') || voucherCreditAcc?.startsWith('bank')) ? 'bank' : 'cash'
    };

    setTransactions(prev => [newTx, ...prev]);
    setVoucherAmount('');
    setVoucherNote('');
    setAlertMsg({ type: 'success', text: `দ্বৈত দাখিলা ভাউচার (${newTx.id}) সফলভাবে একাউন্ট খাতায় যুক্ত করা হয়েছে।` });
  };

  const handleAddBankAccount = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedBal = Number(bankInitialBalanceInput);
    if (!bankNameInput.trim()) {
      alert('ব্যাংকের নাম দিন।');
      return;
    }
    if (!bankAccountNoInput.trim()) {
      alert('হিসাব নাম্বার দিন।');
      return;
    }
    if (isNaN(parsedBal) || parsedBal < 0) {
      alert('সঠিক প্রারম্ভিক জমা দিন।');
      return;
    }

    const newBank = {
      id: `bank-${Date.now()}`,
      bankName: bankNameInput.trim(),
      accountNo: bankAccountNoInput.trim(),
      branchName: bankBranchInput.trim() || 'প্রধান শাখা',
      accountType: bankTypeInput,
      initialBalance: parsedBal,
      balance: parsedBal
    };

    setBankAccounts(prev => [...prev, newBank]);
    setIsBankModalOpen(false);
    
    // Reset inputs
    setBankNameInput('');
    setBankAccountNoInput('');
    setBankBranchInput('');
    setBankInitialBalanceInput('');
    
    setAlertMsg({ type: 'success', text: `নতুন ব্যাংক অ্যাকাউন্ট "${newBank.bankName}" সফলভাবে যুক্ত হয়েছে!` });
  };

  const resetAccounting = () => {
    if (confirm("আপনি কি নিশ্চিত যে সকল লেনদেন, মেম্বার ও হিসাব রিমুভ করতে চান?")) {
      localStorage.removeItem(`tanzil_bm_tx_${org.id}_${staff.branchId}`);
      localStorage.removeItem(`tanzil_bank_accounts_${org.id}`);
      localStorage.removeItem(`tanzil_group_members_${org.id}`);
      localStorage.removeItem(`tanzil_savings_accounts_${org.id}`);
      localStorage.removeItem(`tanzil_cbs_accounts_${org.id}`);
      localStorage.removeItem(`tanzil_lts_accounts_${org.id}`);
      
      setTransactions([]);
      setGroupMembers([]);
      setSavingsAccounts([]);
      setCbsAccounts([]);
      setLtsAccounts([]);
      setLoanProposals([]);
      setBankAccounts([]);
      alert("সকল ডেটা সফলভাবে মুছে ফেলা হয়েছে! এখন নতুন করে শুরু করুন।");
    }
  };

  // Change BM/Staff Password
  const handleBMChangePassword = (e: React.FormEvent) => {
    e.preventDefault();
    const currentStaffUser = staffList.find(s => s.id === staff.id || (s.staffId && s.staffId.toLowerCase() === staff.staffId.toLowerCase())) || staff;
    const currentPassword = currentStaffUser?.password || staff?.password || '1234';
    if (oldPasswordVal !== currentPassword) {
      alert('পুরাতন পাসওয়ার্ডটি সঠিক নয়!');
      return;
    }
    if (newPasswordVal.trim().length === 0) {
      alert('দয়া করে সঠিক পাসওয়ার্ড দিন');
      return;
    }
    if (newPasswordVal !== confirmPasswordVal) {
      alert('পাসওয়ার্ড দুটি মেলেনি!');
      return;
    }

    setStaffList(prev => prev.map(s => {
      if (s.id === staff.id || (s.staffId && s.staffId.toLowerCase() === staff.staffId.toLowerCase())) {
        const updatedStaff = { ...s, password: newPasswordVal };
        // Update the active logged in session credentials so this browser session remains valid
        localStorage.setItem('tanzil_session_password', newPasswordVal);
        localStorage.setItem('tanzil_session_activeStaff', JSON.stringify(updatedStaff));
        return updatedStaff;
      }
      return s;
    }));

    setPasswordChangeSuccess('পাসওয়ার্ড সফলভাবে পরিবর্তন করা হয়েছে!');
    setTimeout(() => {
      setPasswordChangeSuccess('');
      setIsChangePasswordModalOpen(false);
    }, 2000);
  };

  const handleUpdateWorkingDay = (e: React.FormEvent) => {
    e.preventDefault();
    if (!window.confirm(`আপনি কি নিশ্চিত? ${workingDayInput} তারিখটি দিয়ে কাজ শুরু করতে চান?`)) return;

    setWorkingDay(workingDayInput);
    
    // Admin user changes their own working day: save to user-specific override key, NOT branch-wide key!
    const managerOverrideKey = `tanzil_working_day_override_${org.id}_branch_${staff.branchId || 'default'}_user_${staff.id || staff.staffId || 'admin'}`;
    localStorage.setItem(managerOverrideKey, workingDayInput);
    
    setSelectedViewDate(workingDayInput);
    setIsWorkingDayModalOpen(false);
    alert('কর্মদিবস পরিবর্তন সফল হয়েছে। এটি কেবল আপনার সেশনের জন্য কার্যকর হবে, মূল ব্রাঞ্চের তারিখ অপরিবর্তিত থাকবে।');
  };

  const handleResetWorkingDay = () => {
    const managerOverrideKey = `tanzil_working_day_override_${org.id}_branch_${staff.branchId || 'default'}_user_${staff.id || staff.staffId || 'admin'}`;
    localStorage.removeItem(managerOverrideKey);
    
    const savedBranchDay = localStorage.getItem(workingDayKey) || new Date().toISOString().split('T')[0];
    setWorkingDay(savedBranchDay);
    setWorkingDayInput(savedBranchDay);
    setSelectedViewDate(savedBranchDay);
    alert('আপনার সেশনের তারিখটি সফলভাবে মূল ব্রাঞ্চের তারিখের সাথে রিসেট করা হয়েছে।');
  };

  // Branch statistics calculations
  const totalStaffCount = branchStaff.length;
  const staffOnLeaveCount = branchStaff.filter((s: any) => s.onLeave === true).length;
  const activeStaffCount = totalStaffCount - staffOnLeaveCount;
  const totalGroupsCount = branchGroups.length;

  // Rich dynamic indicators for the branch dashboard:
  const allowedGroupIds = branchGroups.map(g => g.id);
  const activeMembersList = groupMembers.filter((m: any) => m.status === 'active' && allowedGroupIds.includes(m.groupId));
  const activeMembersCount = activeMembersList.length > 0 ? activeMembersList.length : 0;
  const debtorMembersList = activeMembersList.filter((m: any) => (m.plOutstanding ?? 0) > 0);
  const debtorMembersCount = debtorMembersList.length > 0 ? debtorMembersList.length : Math.round(activeMembersCount * 0.72);
  const liveLoansOutstanding = activeMembersList.reduce((sum: number, m: any) => sum + (m.plOutstanding ?? 0), 0);
  const loansOutstanding = liveLoansOutstanding > 0 ? liveLoansOutstanding : 0;

  const liveDefaultersList = activeMembersList.filter((m: any) => m.isDefaulter === true || (m.defaulterBalance ?? 0) > 0);
  const defaultersCount = liveDefaultersList.length > 0 ? liveDefaultersList.length : 0;
  const liveDefaultersAmount = liveDefaultersList.reduce((sum: number, m: any) => sum + (m.defaulterBalance ?? 0), 0);
  const defaultersAmount = liveDefaultersAmount > 0 ? liveDefaultersAmount : 0;

  const liveAbscondedList = activeMembersList.filter((m: any) => m.isAbsconded === true || (m.abscondedBalance ?? 0) > 0);
  const abscondedCount = liveAbscondedList.length > 0 ? liveAbscondedList.length : 0;
  const liveAbscondedAmount = liveAbscondedList.reduce((sum: number, m: any) => sum + (m.abscondedBalance ?? 0), 0);
  const abscondedAmount = liveAbscondedAmount > 0 ? liveAbscondedAmount : 0;

  const currentMonthDefaultersCount = activeMembersList.filter((m: any) => m.isCurrentMonthDefaulter === true).length || 0;
  const currentMonthDefaultersAmount = activeMembersList.reduce((sum: number, m: any) => sum + (m.currentMonthDefaulterAmount ?? 0), 0) || 0;
  const ongoingProjectsCount = 0;

  // Batch Defaulter Settlement Calculations for Expired / Overdue Loan Members:
  const batchDefaultersList = React.useMemo(() => {
    return activeMembersList.filter((m: any) => {
      const outstanding = m.plOutstanding || 0;
      if (outstanding <= 0) return false;

      const loanStatus = calculateLoanOverdueAndSchedule(m, transactions, workingDay, holidays, branchGroups);
      const isExpiredOrOverdue = (loanStatus.overdueAmount > 0) || (loanStatus.daysOverdue > 0) || m.isDefaulter === true || (m.defaulterBalance ?? 0) > 0 || m.isCurrentMonthDefaulter === true || (m.overdueAmount ?? 0) > 0;
      
      return isExpiredOrOverdue;
    });
  }, [activeMembersList, transactions, workingDay, holidays, branchGroups]);

  React.useEffect(() => {
    if (isBatchDefaulterModalOpen) {
      setSelectedMemberIds(batchDefaultersList.map((m: any) => m.id));
    }
  }, [isBatchDefaulterModalOpen, batchDefaultersList]);

  const selectedMemberSet = React.useMemo(() => new Set(selectedMemberIds), [selectedMemberIds]);

  const toggleSelectMember = (id: string) => {
    setSelectedMemberIds(prev => 
      prev.includes(id) ? prev.filter(mId => mId !== id) : [...prev, id]
    );
  };

  const batchAdjustmentPreviews = React.useMemo(() => {
    return batchDefaultersList.map((memberObj: any) => {
      const memberId = memberObj.id;
      const mCode = memberObj.memberId || memberObj.id;
      const outstanding = memberObj.plOutstanding || 0;

      const loanStatus = calculateLoanOverdueAndSchedule(memberObj, transactions, workingDay, holidays, branchGroups);

      const currentGs = memberObj.gsBalance ?? memberObj.savingsBalance ?? 0;
      const currentLts = memberObj.ltsBalance ?? 0;
      const currentCbs = memberObj.cbsBalance ?? 0;
      const currentShare = memberObj.shareBalance ?? ((memberObj.shareCount || 0) * 100);

      const memberLtsAcc = ltsAccounts.find(acc => (acc.memberId === memberId || acc.memberId === mCode) && acc.status === 'active');
      const memberCbsAcc = cbsAccounts.find(acc => (acc.memberId === memberId || acc.memberId === mCode) && acc.status === 'active');

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
  }, [batchDefaultersList, transactions, workingDay, holidays, branchGroups, ltsAccounts, cbsAccounts]);

  const batchTotals = React.useMemo(() => {
    let totalOutstanding = 0;
    let totalGsAdjusted = 0;
    let totalLtsAdjusted = 0;
    let totalCbsAdjusted = 0;
    let totalShareAdjusted = 0;
    let totalOverallAdjusted = 0;
    let totalRemainingLoan = 0;
    let fullySettledCount = 0;

    const selectedPreviews = batchAdjustmentPreviews.filter(p => selectedMemberSet.has(p.member.id));

    selectedPreviews.forEach(p => {
      totalOutstanding += p.outstanding;
      totalGsAdjusted += p.result.gsAdjusted;
      totalLtsAdjusted += p.result.ltsAdjusted;
      totalCbsAdjusted += p.result.cbsAdjusted;
      totalShareAdjusted += p.result.shareAdjusted;
      totalOverallAdjusted += p.totalAdjusted;
      totalRemainingLoan += p.remainingLoan;
      if (p.remainingLoan === 0) {
        fullySettledCount++;
      }
    });

    return {
      totalDefaulters: batchDefaultersList.length,
      selectedCount: selectedPreviews.length,
      totalOutstanding,
      totalGsAdjusted,
      totalLtsAdjusted,
      totalCbsAdjusted,
      totalShareAdjusted,
      totalOverallAdjusted,
      totalRemainingLoan,
      fullySettledCount
    };
  }, [batchAdjustmentPreviews, batchDefaultersList, selectedMemberSet]);

  const executeBatchDefaulterAdjustment = () => {
    if (isRealBMReadOnly) {
      setAlertMsg({ type: 'error', text: 'রিড-অনলি মোডে ব্যাচ লোন সমন্বয় পরিচালনা করা সম্ভব নয়!' });
      return;
    }

    const selectedPreviews = batchAdjustmentPreviews.filter(p => selectedMemberSet.has(p.member.id));

    if (selectedPreviews.length === 0) {
      setAlertMsg({ type: 'info', text: 'অনুগ্রহ করে সমন্বয়ের জন্য কমপক্ষে একজন মেয়াদ উত্তীর্ণ সদস্য সিলেক্ট করুন!' });
      return;
    }

    let totalAdjustedAll = 0;
    let membersProcessedCount = 0;
    let fullySettledCount = 0;

    const updatedMembersMap = new Map();
    const updatedGSMap = new Map();
    const updatedLTSMap = new Map();
    const updatedCBSMap = new Map();
    const newTransactions: any[] = [];

    selectedPreviews.forEach(p => {
      const memberObj = p.member;
      const memberId = memberObj.id;
      const mCode = memberObj.memberId || memberObj.id;
      const mName = memberObj.name;
      const gName = memberObj.groupName || 'শাখা গ্রুপ';
      const result = p.result;
      const totalMemberAdjusted = p.totalAdjusted;

      if (totalMemberAdjusted > 0) {
        membersProcessedCount++;
        totalAdjustedAll += totalMemberAdjusted;
        if (result.remainingLoan === 0) {
          fullySettledCount++;
        }

        updatedMembersMap.set(memberId, {
          ...memberObj,
          gsBalance: result.finalGsBalance,
          savingsBalance: result.finalGsBalance,
          ltsBalance: result.finalLtsBalance,
          cbsBalance: result.finalCbsBalance,
          shareBalance: result.finalShareBalance,
          shareCount: Math.floor(result.finalShareBalance / 100),
          plOutstanding: result.remainingLoan,
          status: result.isShareInactive && result.remainingLoan === 0 ? 'inactive' : memberObj.status
        });

        if (result.gsAdjusted > 0) {
          const gsAcc = savingsAccounts.find(acc => acc.memberId === memberId || acc.memberId === mCode);
          if (gsAcc) {
            updatedGSMap.set(gsAcc.id, { ...gsAcc, balance: result.finalGsBalance });
          }
        }

        const memberLtsAcc = ltsAccounts.find(acc => (acc.memberId === memberId || acc.memberId === mCode) && acc.status === 'active');
        if (result.ltsAdjusted > 0 && memberLtsAcc) {
          updatedLTSMap.set(memberLtsAcc.id, { ...memberLtsAcc, balance: result.finalLtsBalance });
        }

        const memberCbsAcc = cbsAccounts.find(acc => (acc.memberId === memberId || acc.memberId === mCode) && acc.status === 'active');
        if (result.cbsAdjusted > 0 && memberCbsAcc) {
          updatedCBSMap.set(memberCbsAcc.id, { ...memberCbsAcc, balance: result.finalCbsBalance });
        }

        newTransactions.push({
          id: `tx-autoadjust-batch-${Date.now()}-${memberId}`,
          orgId: org.id,
          branchId: staff.branchId || 'default-branch',
          staffId: staff.id || staff.staffId || '009',
          staffName: staff.name,
          memberId: mCode,
          memberName: mName,
          groupName: gName,
          type: 'collection',
          category: 'batch_loan_adjustment',
          debitAcc: 'auto_sequential_savings',
          creditAcc: 'loan_outstanding',
          amount: totalMemberAdjusted,
          date: workingDay,
          addDate: workingDay,
          description: `[ব্যাচ অটো সমন্বয়] মেয়াদ উত্তীর্ণ ঋণ সমন্বয়: (GS: ৳${result.gsAdjusted}, LTS: ৳${result.ltsAdjusted}, CBS: ৳${result.cbsAdjusted}, Share: ৳${result.shareAdjusted})। অবশিষ্ট ঋণ: ৳${result.remainingLoan}`,
          collections: { pl: totalMemberAdjusted, gs: 0, cbs: 0, lts: 0 },
          withdrawals: { pl: 0, gs: result.gsAdjusted, cbs: result.cbsAdjusted, lts: result.ltsAdjusted },
          exemption: 0,
          exemptionReason: null
        });
      }
    });

    if (membersProcessedCount === 0) {
      setAlertMsg({ type: 'info', text: 'সিলেক্টকৃত মেয়াদ উত্তীর্ণ সদস্যদের সঞ্চয় হতে সমন্বয় করার মতো ব্যালেন্স ছিল না!' });
      return;
    }

    setGroupMembers((prev) => prev.map(m => updatedMembersMap.get(m.id) || m));
    setSavingsAccounts((prev) => prev.map(acc => updatedGSMap.get(acc.id) ? updatedGSMap.get(acc.id) : acc));
    setLtsAccounts((prev) => prev.map(acc => updatedLTSMap.get(acc.id) ? updatedLTSMap.get(acc.id) : acc));
    setCbsAccounts((prev) => prev.map(acc => updatedCBSMap.get(acc.id) ? updatedCBSMap.get(acc.id) : acc));
    setTransactions((prev) => [...newTransactions, ...prev]);

    setIsBatchDefaulterModalOpen(false);

    setAlertMsg({
      type: 'success',
      text: `নির্বাচিত মেয়াদ উত্তীর্ণ সদস্যদের অটো সঞ্চয় হতে ঋণ সমন্বয় সফলভাবে সম্পন্ন হয়েছে! মোট ${membersProcessedCount} জন সদস্যের ৳${totalAdjustedAll.toLocaleString('bn-BD')} টাকা সমন্বয় করা হয়েছে (${fullySettledCount} জনের ঋণ সম্পূর্ণ পরিশোধিত)।`
    });
  };

  const getBankBalance = (bankId: string): number => {
    const bank = bankAccounts.find(b => b.id === bankId);
    if (!bank) return 0;
    let bal = Number(bank.initialBalance || 0);
    
    transactions.forEach(t => {
      if (t.debitAcc === bankId) {
        bal += Number(t.amount || 0);
      } else if (t.creditAcc === bankId) {
        bal -= Number(t.amount || 0);
      } else if (t.type === 'disbursement' && t.source?.includes('Bank') && bankId === 'bank-sbl') {
        // Fallback for default SBL bank on legacy disbursements
        bal -= Number(t.amount || 0);
      }
    });
    return bal;
  };

  const getCashInHand = (): number => {
    let bal = 0;
    transactions.forEach(t => {
      const isCashDebit = t.debitAcc === 'cash' || (!t.debitAcc && t.paymentMode !== 'bank' && !t.source?.includes('Bank') && !t.description?.includes('SBL') && (t.type === 'income' || t.type === 'collection'));
      const isCashCredit = t.creditAcc === 'cash' || (!t.creditAcc && t.paymentMode !== 'bank' && !t.source?.includes('Bank') && !t.description?.includes('SBL') && (t.type === 'expense' || t.type === 'disbursement'));
      
      if (isCashDebit && isCashCredit) {
        // self transfers - do nothing
      } else if (isCashDebit) {
        bal += Number(t.amount || 0);
      } else if (isCashCredit) {
        bal -= Number(t.amount || 0);
      }
    });
    return bal;
  };

  const getCashInHandPriorToDate = (targetDate: string): number => {
    let bal = 0;
    transactions.forEach(t => {
      const txDate = t.addDate || t.date || '';
      if (txDate >= targetDate) return;

      const isCashDebit = t.debitAcc === 'cash' || (!t.debitAcc && t.paymentMode !== 'bank' && !t.source?.includes('Bank') && !t.description?.includes('SBL') && (t.type === 'income' || t.type === 'collection'));
      const isCashCredit = t.creditAcc === 'cash' || (!t.creditAcc && t.paymentMode !== 'bank' && !t.source?.includes('Bank') && !t.description?.includes('SBL') && (t.type === 'expense' || t.type === 'disbursement'));
      
      if (isCashDebit && isCashCredit) {
        // self transfers - do nothing
      } else if (isCashDebit) {
        bal += Number(t.amount || 0);
      } else if (isCashCredit) {
        bal -= Number(t.amount || 0);
      }
    });
    return bal;
  };

  const totalIncome = transactions.filter(t => t.type === 'income' || t.type === 'collection').reduce((sum, t) => sum + Number(t.amount || 0), 0);
  const totalExpense = transactions.filter(t => t.type === 'expense' || t.type === 'disbursement').reduce((sum, t) => sum + Number(t.amount || 0), 0);
  
  const coaCashInHand = getCashInHand();
  const totalBankBalance = bankAccounts.reduce((sum, b) => sum + getBankBalance(b.id), 0);
  const netBalance = coaCashInHand + totalBankBalance;

  // Chart of Accounts (COA) / Balance Sheet calculations
  const coaGeneralSavings = savingsAccounts ? savingsAccounts.reduce((sum, acc) => sum + (Number(acc.balance) || 0), 0) : 0;
  const coaCbsSavings = cbsAccounts ? cbsAccounts.reduce((sum, acc) => sum + (Number(acc.balance) || 0), 0) : 0;
  const coaLtsSavings = ltsAccounts ? ltsAccounts.reduce((sum, acc) => sum + (Number(acc.balance) || 0), 0) : 0;

  const coaServiceCharge = transactions.filter(t => t.type === 'income' && (t.category || '').includes('সার্ভিস চার্জ')).reduce((sum, t) => sum + Number(t.amount || 0), 0);
  const coaAdmissionFee = transactions.filter(t => t.type === 'income' && ((t.category || '').includes('ভর্তি') || (t.category || '').includes('Admission'))).reduce((sum, t) => sum + Number(t.amount || 0), 0);
  const coaSavingsFee = transactions.filter(t => t.type === 'income' && ((t.category || '').includes('বই') || (t.category || '').includes('ফর্ম') || (t.category || '').includes('প্রসেসিং'))).reduce((sum, t) => sum + Number(t.amount || 0), 0);
  const coaMiscIncome = transactions.filter(t => t.type === 'income' && !((t.category || '').includes('সার্ভিস চার্জ') || (t.category || '').includes('ভর্তি') || (t.category || '').includes('Admission') || (t.category || '').includes('বই') || (t.category || '').includes('ফর্ম') || (t.category || '').includes('প্রসেসিং'))).reduce((sum, t) => sum + Number(t.amount || 0), 0);

  const coaSalariesExpense = transactions.filter(t => t.type === 'expense' && (t.category || '').includes('বেতন')).reduce((sum, t) => sum + Number(t.amount || 0), 0);
  const coaRentExpense = transactions.filter(t => t.type === 'expense' && (t.category || '').includes('ভাড়া')).reduce((sum, t) => sum + Number(t.amount || 0), 0);
  const coaTransportExpense = transactions.filter(t => t.type === 'expense' && ((t.category || '').includes('যাতায়াত') || (t.category || '').includes('ভ্রমণ') || (t.category || '').includes('স্টেশনারি'))).reduce((sum, t) => sum + Number(t.amount || 0), 0);
  const coaOtherExpense = transactions.filter(t => t.type === 'expense' && !((t.category || '').includes('বেতন') || (t.category || '').includes('ভাড়া') || (t.category || '').includes('যাতায়াত') || (t.category || '').includes('ভ্রমণ') || (t.category || '').includes('স্টেশনারি'))).reduce((sum, t) => sum + Number(t.amount || 0), 0);

  const coaRetainedEarnings = (coaServiceCharge + coaAdmissionFee + coaSavingsFee + coaMiscIncome) - (coaSalariesExpense + coaRentExpense + coaTransportExpense + coaOtherExpense);
  const coaCapitalFund = 0;

  const totalLiabilities = coaGeneralSavings + coaCbsSavings + coaLtsSavings;
  const totalEquity = coaRetainedEarnings + coaCapitalFund;
  const totalLiabilitiesAndEquity = totalLiabilities + totalEquity;

  const coaOutstandingLoan = totalLiabilitiesAndEquity > (coaCashInHand + totalBankBalance) ? totalLiabilitiesAndEquity - (coaCashInHand + totalBankBalance) : 0;
  const totalAssets = coaCashInHand + totalBankBalance + coaOutstandingLoan;

  const totalCOAIncome = coaServiceCharge + coaAdmissionFee + coaSavingsFee + coaMiscIncome;
  const totalCOAExpenses = coaSalariesExpense + coaRentExpense + coaTransportExpense + coaOtherExpense;

  const coaBalances: Record<string, number> = {
    cash: coaCashInHand,
    current_ac: bankAccounts.filter(b => b.accountType.includes('Current') || b.accountType.includes('চলতি') || b.accountType.includes('SND') || b.accountType.includes('এসএনডি')).reduce((sum, b) => sum + getBankBalance(b.id), 0),
    savings_ac: bankAccounts.filter(b => b.accountType.includes('Savings') || b.accountType.includes('সঞ্চয়ী')).reduce((sum, b) => sum + getBankBalance(b.id), 0),
    fdr: bankAccounts.filter(b => b.accountType.includes('FDR') || b.accountType.includes('এফডিআর')).reduce((sum, b) => sum + getBankBalance(b.id), 0) + transactions.filter(t => (t.category || '').includes('FDR')).reduce((sum, t) => sum + Number(t.amount || 0), 0),
    
    general_loan: transactions.filter(t => t.type === 'disbursement' && (t.description || t.category || '').includes('সাধারণ')).reduce((sum, t) => sum + Number(t.amount || 0), 0) - transactions.filter(t => t.type === 'collection' && (t.description || t.category || '').includes('সাধারণ')).reduce((sum, t) => sum + Number(t.amount || 0), 0),
    micro_loan: transactions.filter(t => t.type === 'disbursement' && (t.description || t.category || '').includes('উদ্যোগ')).reduce((sum, t) => sum + Number(t.amount || 0), 0),
    agri_loan: transactions.filter(t => t.type === 'disbursement' && (t.description || t.category || '').includes('কৃষি')).reduce((sum, t) => sum + Number(t.amount || 0), 0),
    special_loan: transactions.filter(t => t.type === 'disbursement' && !(t.description || t.category || '').includes('সাধারণ') && !(t.description || t.category || '').includes('উদ্যোগ') && !(t.description || t.category || '').includes('কৃষি')).reduce((sum, t) => sum + Number(t.amount || 0), 0),

    land_building: transactions.reduce((sum, t) => {
      let val = sum;
      if (t.debitAcc === 'land_building') val += Number(t.amount || 0);
      if (t.creditAcc === 'land_building') val -= Number(t.amount || 0);
      return val;
    }, 0) + transactions.filter(t => !t.debitAcc && !t.creditAcc && ((t.category || '').includes('জমি') || (t.category || '').includes('ভবন'))).reduce((sum, t) => sum + Number(t.amount || 0), 0),

    furniture: transactions.reduce((sum, t) => {
      let val = sum;
      if (t.debitAcc === 'furniture') val += Number(t.amount || 0);
      if (t.creditAcc === 'furniture') val -= Number(t.amount || 0);
      return val;
    }, 0) + transactions.filter(t => !t.debitAcc && !t.creditAcc && (t.category || '').includes('আসবাবপত্র')).reduce((sum, t) => sum + Number(t.amount || 0), 0),

    computer_it: transactions.reduce((sum, t) => {
      let val = sum;
      if (t.debitAcc === 'computer_it') val += Number(t.amount || 0);
      if (t.creditAcc === 'computer_it') val -= Number(t.amount || 0);
      return val;
    }, 0) + transactions.filter(t => !t.debitAcc && !t.creditAcc && ((t.category || '').includes('কম্পিউটার') || (t.category || '').includes('আইটি'))).reduce((sum, t) => sum + Number(t.amount || 0), 0),

    vehicles: transactions.reduce((sum, t) => {
      let val = sum;
      if (t.debitAcc === 'vehicles') val += Number(t.amount || 0);
      if (t.creditAcc === 'vehicles') val -= Number(t.amount || 0);
      return val;
    }, 0) + transactions.filter(t => !t.debitAcc && !t.creditAcc && ((t.category || '').includes('যানবাহন') || (t.category || '').includes('মোটরসাইকেল'))).reduce((sum, t) => sum + Number(t.amount || 0), 0),

    rent_advance: transactions.filter(t => (t.category || '').includes('অগ্রিম অফিস')).reduce((sum, t) => sum + Number(t.amount || 0), 0),
    staff_advance: transactions.filter(t => (t.category || '').includes('কর্মচারী অগ্রিম')).reduce((sum, t) => sum + Number(t.amount || 0), 0),

    general_savings: coaGeneralSavings,
    cbs_savings: coaCbsSavings,
    lts_savings: coaLtsSavings,

    retained_earnings: coaRetainedEarnings,
    capital_fund: coaCapitalFund,

    service_charge: coaServiceCharge,
    admission_fee: coaAdmissionFee,
    passbook_fee: coaSavingsFee,
    misc_income: coaMiscIncome,

    staff_salaries: coaSalariesExpense,
    office_rent: coaRentExpense,
    travel_allowance: coaTransportExpense,
    admin_expense: coaOtherExpense,
    
    depreciation_expense: transactions.filter(t => t.debitAcc === 'depreciation_expense' || (t.category || '').includes('অবচয়')).reduce((sum, t) => sum + Number(t.amount || 0), 0),
    bad_debt: transactions.filter(t => t.debitAcc === 'bad_debt' || (t.category || '').includes('কুঋণ')).reduce((sum, t) => sum + Number(t.amount || 0), 0),
    llpf: transactions.reduce((sum, t) => {
      let val = sum;
      if (t.creditAcc === 'llpf') val += Number(t.amount || 0);
      if (t.debitAcc === 'llpf') val -= Number(t.amount || 0);
      return val;
    }, 0) + transactions.filter(t => !t.debitAcc && !t.creditAcc && (t.category || '').includes('LLPF')).reduce((sum, t) => sum + Number(t.amount || 0), 0),
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-800">
      
      {/* Redesigned Large Responsive Header */}
      <header className={`fixed top-0 left-0 right-0 z-50 text-slate-100 shadow-xl border-b transition-all bg-slate-900 border-slate-800`}>
        <div className="max-w-7xl mx-auto px-4 py-2 sm:py-2.5 flex flex-col gap-2">
          
          {/* Row 1: Brand & Organization Info */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
            <div className="flex items-center gap-3">
              <TanzilLogo size={36} className="bg-slate-900 rounded-full border border-slate-700/50 p-0.5 hover:scale-105 transition-transform" />
              <span className="text-base sm:text-lg font-black tracking-wide bg-gradient-to-r from-emerald-400 via-indigo-200 to-white bg-clip-text text-transparent">
                তানজিল মাইক্রোক্রেডিট সফটওয়্যার
              </span>
              {isSimulated ? (
                <span className="text-[10px] bg-rose-600 text-white px-2 py-0.5 rounded font-extrabold tracking-wide animate-pulse">
                  সিমুলেশন সক্রিয়
                </span>
              ) : (
                <span className="hidden sm:inline-block px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/20 text-[10px] text-emerald-400 font-bold rounded-md">
                  অনলাইন সিস্টেম
                </span>
              )}
            </div>
            
            <div className="flex items-center gap-3 self-stretch sm:self-auto justify-between sm:justify-end">
              <div className="flex items-center gap-1.5 bg-slate-800 border border-slate-700/80 px-2.5 py-1 rounded-lg text-xs">
                <OrgLogo orgId={org.id} size={16} className="rounded-sm" />
                <span className="font-bold text-slate-200">প্রতিষ্ঠান: {org.name}</span>
              </div>
              <SyncStatusHub 
                org={org} 
                userId={staff.staffId} 
                userName={staff.name} 
                role={staff.designation} 
                branchId={staff.branchId} 
              />
            </div>
          </div>

          {/* Row 2: Branch Name, Code, Working Date, User Credentials & Action Buttons */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 border-t border-slate-800/80 pt-2 text-xs text-slate-300">
            {/* Left side: Branch, Code & Working Date */}
            <div className="flex flex-wrap items-center gap-2 sm:gap-4">
              <div className="flex items-center gap-1.5 bg-slate-800/60 border border-slate-700/50 px-2.5 py-1 rounded-lg">
                <span className="font-medium text-slate-400">শাখা:</span>
                <span className="font-bold text-slate-200">{currentBranch?.name || 'প্রধান কার্যালয়'}</span>
                <span className="text-slate-600">|</span>
                <span className="font-medium text-slate-400">কোড:</span>
                <span className="font-mono font-bold text-emerald-400">{currentBranchCode}</span>
              </div>

              {/* Working Date Button */}
              <div className="flex items-center gap-1.5">
                {(isBM || isSimulated) ? (
                  <button 
                    type="button"
                    onClick={() => setIsWorkingDayModalOpen(true)}
                    className={`flex items-center gap-1.5 font-bold px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                      localStorage.getItem(`tanzil_working_day_override_${org.id}_branch_${staff.branchId || 'default'}_user_${staff.id || staff.staffId || 'admin'}`)
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                        : 'bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-300'
                    }`}
                    title="কর্মদিবস পরিবর্তন করতে বা ডে ক্লোজ করতে এখানে ক্লিক করুন"
                  >
                    <Clock size={12} className={localStorage.getItem(`tanzil_working_day_override_${org.id}_branch_${staff.branchId || 'default'}_user_${staff.id || staff.staffId || 'admin'}`) ? "text-amber-400 animate-bounce" : "text-emerald-400 animate-pulse"} />
                    <span>তারিখ:</span>
                    <span className="font-mono font-black">{workingDay}</span>
                    {localStorage.getItem(`tanzil_working_day_override_${org.id}_branch_${staff.branchId || 'default'}_user_${staff.id || staff.staffId || 'admin'}`) && (
                      <span className="text-[9px] bg-amber-500 text-slate-900 font-extrabold px-1 rounded-sm ml-1 select-none">সেশন</span>
                    )}
                  </button>
                ) : (
                  <div 
                    className="flex items-center gap-1.5 font-bold px-2.5 py-1 rounded-lg bg-slate-800/80 border border-slate-700/80 text-emerald-300"
                    title="শাখা কার্যদিবস (মাঠ কর্মী মুড)"
                  >
                    <Clock size={12} className="text-emerald-400" />
                    <span>তারিখ:</span>
                    <span className="font-mono font-black">{workingDay}</span>
                  </div>
                )}

                {(isBM || isSimulated) && localStorage.getItem(`tanzil_working_day_override_${org.id}_branch_${staff.branchId || 'default'}_user_${staff.id || staff.staffId || 'admin'}`) && (
                  <button
                    type="button"
                    onClick={handleResetWorkingDay}
                    className="flex items-center gap-1 bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/30 text-rose-300 font-extrabold px-2 py-1 rounded-lg text-[10px] cursor-pointer transition-colors"
                    title="সেশন রিসেট করে মূল ব্রাঞ্চ তারিখে ফিরে যান"
                  >
                    রিসেট
                  </button>
                )}

                {(isBM || isSimulated) && (
                  <button
                    type="button"
                    onClick={handleCloseDay}
                    className="flex items-center gap-1.5 bg-rose-600 hover:bg-rose-700 text-white font-black px-2.5 py-1 rounded-lg text-xs cursor-pointer shadow-xs transition-all active:scale-95 ml-1"
                    title="আজকের দিন ক্লোজ করে পরবর্তী কর্মদিবসে যান"
                  >
                    <Lock size={12} />
                    <span>ডে ক্লোজ</span>
                  </button>
                )}
              </div>
            </div>

            {/* Right side: User, ID, Password Change & Logout Buttons */}
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              <div className="flex items-center gap-2 bg-slate-800/60 border border-slate-700/50 px-2.5 py-1 rounded-lg">
                <span className="text-slate-400">ব্যবহারকারী:</span>
                <span className="font-bold text-slate-100">{staff.name}</span>
                <span className="text-slate-400">({staff.designation})</span>
                <span className="text-slate-600">|</span>
                <span className="text-slate-400 font-mono">আইডি: {staff.staffId}</span>
              </div>

              {isSidebarHidden && (
                <button
                  type="button"
                  onClick={() => setIsSidebarHidden(false)}
                  className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                  title="মেনুবার দেখান"
                >
                  <Menu size={11} />
                  <span>মেনু</span>
                </button>
              )}

              {/* Password Change Button */}
              <button 
                type="button"
                onClick={() => {
                  setOldPasswordVal('');
                  setNewPasswordVal('');
                  setConfirmPasswordVal('');
                  setPasswordChangeSuccess('');
                  setIsChangePasswordModalOpen(true);
                }}
                className="flex items-center gap-1 px-2 py-1 bg-indigo-600 hover:bg-indigo-700 hover:text-white text-white rounded-lg text-xs font-bold transition-all cursor-pointer"
                title="শাখা পাসওয়ার্ড পরিবর্তন করুন"
              >
                <Key size={11} />
                <span>পাসওয়ার্ড পরিবর্তন</span>
              </button>

              {/* Logout Button */}
              {isSimulated ? (
                <button
                  type="button"
                  onClick={onLogout}
                  className="px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold rounded-lg text-xs transition duration-150 flex items-center gap-1 cursor-pointer"
                  title="অ্যাডমিন ড্যাশবোর্ডে ফিরে যান"
                >
                  <ChevronLeft size={11} />
                  <span>অ্যাডমিন প্যানেল</span>
                </button>
              ) : (
                <button 
                  type="button"
                  onClick={onLogout}
                  className="flex items-center gap-1 px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold transition-all cursor-pointer"
                  title="লগআউট"
                >
                  <LogOut size={11} />
                  <span>লগআউট</span>
                </button>
              )}
            </div>
          </div>

        </div>
      </header>

      {/* Main Body Grid Container */}
      <div className="flex-1 w-full mx-auto flex flex-col pt-[155px] md:pt-[105px] min-h-0 bg-white shadow-md">


        {/* MAIN CONTAINER CONTENT */}
        <main className="flex-1 flex flex-col min-w-0 bg-white">
          
          {/* Full Screen operation warning bar if running operations */}
          {isFullScreenOperation && (
            <div className="bg-amber-50/70 border-b border-amber-200/50 p-3.5 flex justify-between items-center px-6">
              <span className="text-[11px] font-bold text-amber-800 flex items-center gap-2">
                <span className="w-2 h-2 bg-amber-500 rounded-full animate-ping"></span>
                {isBM ? 'শাখা অপারেশন ফুল স্ক্রিন মোড সক্রিয় আছে' : 'মাঠকর্মী অপারেশন মোড সক্রিয় আছে'}
              </span>
              <button
                id="bm_full_exit_btn"
                onClick={() => setIsFullScreenOperation(false)}
                className="px-3.5 py-1.5 bg-slate-900 text-white hover:bg-slate-800 text-[10px] font-extrabold rounded-lg shadow-xs transition flex items-center gap-1.5 cursor-pointer"
              >
                <ArrowLeft size={12} />
                <span>অপারেশন থেকে ফিরে যান</span>
              </button>
            </div>
          )}
          {/* Sub Header (replaces the old head with the dates) */}
          {!isFullScreenOperation && (
            <div className="border-b border-slate-100 p-3 px-6 shrink-0 flex items-center justify-between bg-slate-50/50 text-[11px] text-slate-500 font-bold">
              <div className="flex items-center gap-3">
                {isSidebarHidden && (
                  <button
                    type="button"
                    onClick={() => setIsSidebarHidden(false)}
                    className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[10px] font-black shadow-xs transition duration-150 cursor-pointer"
                    title="মেনুবার ফিরিয়ে আনুন"
                  >
                    <Menu size={12} />
                    <span>মেনুবার দেখান</span>
                  </button>
                )}
                <div className="flex items-center gap-2">
                  <span className="text-slate-700 font-bold">
                    কার্যদিবস: {new Date(workingDay + 'T00:00:00').toLocaleDateString('bn-BD', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                  </span>
                  {(isBM || isSimulated) && (
                    <button 
                      type="button"
                      onClick={handleCloseDay}
                      className="flex items-center gap-1.5 px-3 py-1 bg-rose-600 hover:bg-rose-700 active:scale-95 text-white rounded-lg text-xs font-black shadow-xs transition duration-150 cursor-pointer"
                      title="আজকের কর্মদিবস সমাপ্ত করে পরবর্তী কর্মদিবসে যান"
                    >
                      <Lock size={12} />
                      <span>ডে ক্লোজ (Close Day)</span>
                    </button>
                  )}
                </div>
                

              </div>

              <div className="flex items-center gap-2">
              </div>
            </div>
          )}

        {/* CONTAINER VIEWPORTS */}
        <div className="flex-1 p-4 sm:p-6 overflow-y-auto">
          
          {/* TOASTER ALERTS */}
          {alertMsg && (
            <div className={`mb-6 p-4 rounded-xl shadow-xs border transition duration-300 flex items-start gap-3 animate-in slide-in-from-top-4 ${
              alertMsg.type === 'success' 
                ? 'bg-emerald-50 border-emerald-100 text-emerald-800' 
                : 'bg-blue-50 border-blue-100 text-blue-800'
            }`}>
              <CheckCircle2 size={18} className="shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-extrabold">{alertMsg.text}</p>
              </div>
            </div>
          )}

          {/* -------------------- DYNAMIC RENDER START -------------------- */}

          {/* 1. FULL SCREEN OPERATION VIEW */}
          {isFullScreenOperation ? (
            <div id="bm_operation_fullscreen_panel" className="max-w-5xl mx-auto space-y-6">
              
              {/* OPERATION HEADER AND SELECTOR CARDS */}
              {selectedOperation !== 'group_operation' && selectedOperation !== 'menu' && (
                <div className="bg-amber-600 bg-gradient-to-r from-amber-500 to-amber-700 rounded-2xl text-white p-6 shadow-md relative overflow-hidden">
                  <div className="relative z-10">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">ফুল স্ক্রিন সিস্টেম</span>
                      <span className="text-[10px] bg-amber-400 text-slate-950 px-2 py-0.5 rounded-full font-bold">
                        {isBM ? 'শাখা অপারেশন প্যানেল' : 'মাঠকর্মী অপারেশন প্যানেল'}
                      </span>
                    </div>
                    <h2 className="text-xl sm:text-2xl font-black">
                      {isBM ? 'ইউজার ম্যানু অপারেশনস' : 'মাঠকর্মী (FO) অপারেশনস'}
                    </h2>
                    <p className="text-xs text-amber-50/80 font-medium max-w-xl mt-1">
                      {isBM 
                        ? 'কর্মী স্থানান্তর, নতুন গ্রুপ তৈরি ও পরিচালনা, এবং গ্রুপের দৈনিক আদায়/বিতরণ কার্যক্রম এখানে সম্পন্ন করুন।'
                        : 'আপনার দায়িত্বপ্রাপ্ত গ্রুপের দৈনিক আদায় ও বিতরণ কার্যক্রম এখানে সম্পন্ন করুন।'
                      }
                    </p>
                  </div>
                  <div className="absolute right-0 bottom-0 top-0 translate-x-12 opacity-15 text-[140px] pointer-events-none font-black text-white select-none">
                    {isBM ? 'BM' : 'FO'}
                  </div>
                </div>
              )}

              {/* THREE MAIN ICON ACTIONS */}
              {selectedOperation === 'menu' && isBM && (
                <div className="grid grid-cols-1 md:grid-cols-2 md:max-w-4xl mx-auto gap-6 pt-2">
                  
                  {/* ICON CARD 1: ADD GROUP */}
                  {isBM && (
                    <button
                      id="bm_op_add_group_btn"
                      onClick={() => {
                        setIsGroupEditMode(false);
                        setEditingGroupId(null);
                        setGroupNameInput('');
                        setGroupCodeInput('');
                        setSelectedOperation('add_group');
                      }}
                      className="p-6 bg-white hover:bg-slate-50 border border-slate-200 hover:border-amber-500 rounded-2xl shadow-sm text-left transition group relative overflow-hidden"
                    >
                      <div className="w-12 h-12 bg-amber-100 text-amber-700 rounded-xl flex items-center justify-center mb-4 transition-transform group-hover:scale-105">
                        <Plus size={24} />
                      </div>
                      <h3 className="font-extrabold text-slate-800 text-base">এড গ্রুপ (Add Group)</h3>
                      <p className="text-xs text-slate-400 mt-2 font-medium">আপনার ব্রাঞ্চের জন্য নতুন ঋণ ও সঞ্চয় দাতা দল/সমিতি গ্রুপ তৈরি করুন।</p>
                      <span className="text-[10px] text-amber-600 font-bold block mt-4 underline group-hover:text-amber-700">জমা করুন →</span>
                    </button>
                  )}

                  {/* ICON CARD 2: GROUP OPERATION */}
                  <button
                    id="bm_op_list_group_btn"
                    onClick={() => setSelectedOperation('group_operation')}
                    className="p-6 bg-white hover:bg-slate-50 border border-slate-200 hover:border-amber-500 rounded-2xl shadow-sm text-left transition group relative overflow-hidden"
                  >
                    <div className="w-12 h-12 bg-amber-100 text-amber-700 rounded-xl flex items-center justify-center mb-4 transition-transform group-hover:scale-105">
                      <Layers size={24} />
                    </div>
                    <h3 className="font-extrabold text-slate-800 text-base">গ্রুপ অপারেশন (Group Operation)</h3>
                    <p className="text-xs text-slate-400 mt-2 font-medium">ব্রাঞ্চের গ্রুপসমূহ পরীক্ষা করুন, সভার তালিকা দেখুন এবং আদায় পরিচালনা করুন।</p>
                    <span className="text-[10px] text-amber-600 font-bold block mt-4 underline group-hover:text-amber-700">অংশগ্রহণ করুন →</span>
                  </button>


                  {/* ICON CARD 3: MOVE GROUP */}
                  {isBM && (
                    <button
                      id="bm_op_move_group_btn"
                      onClick={() => {
                        setMoveGroupTargetId('');
                        setMoveGroupDestinationStaffId('');
                        setSelectedOperation('move_group');
                      }}
                      className="p-6 bg-white hover:bg-slate-50 border border-slate-200 hover:border-amber-500 rounded-2xl shadow-sm text-left transition group relative overflow-hidden"
                    >
                      <div className="w-12 h-12 bg-amber-100 text-amber-700 rounded-xl flex items-center justify-center mb-4 transition-transform group-hover:scale-105">
                        <ArrowLeftRight size={24} />
                      </div>
                      <h3 className="font-extrabold text-slate-800 text-base">মুভ গ্রুপ (Move Group)</h3>
                      <p className="text-xs text-slate-400 mt-2 font-medium">এক মাঠ কর্মীর আওতাভুক্ত গ্রুপ বা সমিতি অন্য মাঠ কর্মীর দায়িত্বে স্থানান্তর করুন।</p>
                      <span className="text-[10px] text-amber-600 font-bold block mt-4 underline group-hover:text-amber-700">স্থানান্তর করুন →</span>
                    </button>
                  )}

                  {/* ICON CARD 4: LOAN PROPOSAL REQUESTS */}
                  {isBM && (
                    <button
                      id="bm_op_loan_proposal_btn"
                      onClick={() => {
                        setSelectedOperation('loan_proposal_requests');
                      }}
                      className="p-6 bg-white hover:bg-slate-50 border border-slate-200 hover:border-indigo-500 rounded-2xl shadow-sm text-left transition group relative overflow-hidden"
                    >
                      <div className="w-12 h-12 bg-indigo-100 text-[#2f6ce5] rounded-xl flex items-center justify-center mb-4 transition-transform group-hover:scale-105">
                        <ClipboardList size={24} />
                      </div>
                      <h3 className="font-extrabold text-slate-800 text-base">লোন প্রপোজাল রিকুয়েষ্ট (Loan Proposal Requests)</h3>
                      <p className="text-xs text-slate-400 mt-2 font-medium">মাঠ কর্মীদের প্রেরিত নতুন ঋণ প্রস্তাব তদারকি করে অনুমোদন বা বাতিল করুন।</p>
                      <span className="text-[10px] text-indigo-600 font-bold block mt-4 underline group-hover:text-indigo-750 font-sans">আবেদন সমূহ দেখুন →</span>
                    </button>
                  )}

                  {/* ICON CARD 6: EXEMPTION & LSRF REQUESTS */}
                  {isBM && (
                    <button
                      id="bm_op_exemption_btn"
                      onClick={() => {
                        setSelectedOperation('exemption_requests');
                      }}
                      className="p-6 bg-white hover:bg-slate-50 border border-slate-200 hover:border-rose-500 rounded-2xl shadow-sm text-left transition group relative overflow-hidden"
                    >
                      <div className="w-12 h-12 bg-rose-100 text-rose-700 rounded-xl flex items-center justify-center mb-4 transition-transform group-hover:scale-105">
                        <HandCoins size={24} />
                      </div>
                      <div className="flex justify-between items-start">
                        <h3 className="font-extrabold text-slate-800 text-base">ঋণ মওকুফ ও LSRF অনুমোদন</h3>
                        {exemptionRequests.filter(r => r.status === 'pending').length > 0 && (
                          <span className="bg-rose-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full animate-pulse">
                            {exemptionRequests.filter(r => r.status === 'pending').length} টি নতুন
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400 mt-2 font-medium">গ্রাহক/অভিভাবক মারা যাওয়ার পর ঋণ মওকুফ ও জীবন বীমা প্রিমিয়াম (LSRF) দাবি অনুমোদন বা পরিবর্তন করুন।</p>
                      <span className="text-[10px] text-rose-600 font-bold block mt-4 underline group-hover:text-rose-700 font-sans">আবেদন সমূহ দেখুন →</span>
                    </button>
                  )}

                  {/* ICON CARD 5: MASTER ROLL */}
                  {isBM && (
                    <button
                      id="bm_op_master_roll_btn"
                      onClick={() => {
                        setSelectedOperation('master_roll');
                      }}
                      className="p-6 bg-white hover:bg-slate-50 border border-slate-200 hover:border-indigo-500 rounded-2xl shadow-sm text-left transition group relative overflow-hidden"
                    >
                      <div className="w-12 h-12 bg-indigo-100 text-[#2f6ce5] rounded-xl flex items-center justify-center mb-4 transition-transform group-hover:scale-105">
                        <FileText size={24} />
                      </div>
                      <h3 className="font-extrabold text-slate-800 text-base">মাস্টার রোল (Master Roll)</h3>
                      <p className="text-xs text-slate-400 mt-2 font-medium">বিতরণকৃত ঋণের বিস্তারিত তালিকা দেখুন এবং প্রয়োজন অনুযায়ী ইডিট বা ডিলিট করুন।</p>
                      <span className="text-[10px] text-indigo-600 font-bold block mt-4 underline group-hover:text-indigo-750 font-sans">তালিকা দেখুন →</span>
                    </button>
                  )}

                  {/* ICON CARD: SAVINGS REFUND & APPROVAL */}
                  {isBM && (
                    <button
                      id="bm_op_savings_refund_btn"
                      onClick={() => {
                        setSelectedOperation('savings_refund_approval');
                      }}
                      className="p-6 bg-white hover:bg-slate-50 border border-slate-200 hover:border-blue-500 rounded-2xl shadow-sm text-left transition group relative overflow-hidden"
                    >
                      <div className="w-12 h-12 bg-blue-100 text-blue-700 rounded-xl flex items-center justify-center mb-4 transition-transform group-hover:scale-105">
                        <ArrowLeftRight size={24} />
                      </div>
                      <div className="flex justify-between items-start">
                        <h3 className="font-extrabold text-slate-800 text-base">সঞ্চয় ফেরত ও সমন্বয় অনুমোদন</h3>
                        {pendingSavingsRefundsCount > 0 && (
                          <span className="bg-blue-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full animate-pulse">
                            {pendingSavingsRefundsCount} টি অপেক্ষমান
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400 mt-2 font-medium">সদস্যদের সঞ্চয় ফেরত ও ঋণ সমন্বয়ের আবেদনসমূহ পর্যালোচনা করুন এবং অনুমোদন বা প্রত্যাখ্যান করুন।</p>
                      <span className="text-[10px] text-blue-600 font-bold block mt-4 underline group-hover:text-blue-700 font-sans">আবেদন সমূহ দেখুন →</span>
                    </button>
                  )}

                  {/* ICON CARD: INTEREST POSTING */}
                  {isBM && (
                    <button
                      id="bm_op_interest_posting_btn"
                      onClick={() => {
                        setSelectedOperation('interest_posting');
                      }}
                      className="p-6 bg-white hover:bg-slate-50 border border-slate-200 hover:border-emerald-500 rounded-2xl shadow-sm text-left transition group relative overflow-hidden"
                    >
                      <div className="w-12 h-12 bg-emerald-100 text-emerald-700 rounded-xl flex items-center justify-center mb-4 transition-transform group-hover:scale-105">
                        <AlertCircle size={24} />
                      </div>
                      <h3 className="font-extrabold text-slate-800 text-base">লভ্যাংশ পোস্টিং (Interest Posting)</h3>
                      <p className="text-xs text-slate-400 mt-2 font-medium">সঞ্চয় ও এফডিআর হিসাবসমূহে লভ্যাংশ গণনা ও পোস্টিং করুন।</p>
                      <span className="text-[10px] text-emerald-600 font-bold block mt-4 underline group-hover:text-emerald-700 font-sans font-sans">শুরু করুন →</span>
                    </button>
                  )}

                  {/* ICON CARD: TRANSACTION SUMMARY */}
                  {isBM && (
                    <button
                      id="bm_op_transaction_summary_btn"
                      onClick={() => {
                        setSelectedOperation('transaction_summary');
                      }}
                      className="p-6 bg-white hover:bg-slate-50 border border-slate-200 hover:border-emerald-500 rounded-2xl shadow-sm text-left transition group relative overflow-hidden"
                    >
                      <div className="w-12 h-12 bg-emerald-100 text-emerald-700 rounded-xl flex items-center justify-center mb-4 transition-transform group-hover:scale-105">
                        <BookOpen size={24} />
                      </div>
                      <h3 className="font-extrabold text-slate-800 text-base">লেনদেন সামারী</h3>
                      <p className="text-xs text-slate-400 mt-2 font-medium">শাখার দৈনিক আদায়, সঞ্চয় ফেরত, লোন বিতরণ ও অন্যান্য খরচ সহ সকল ধরণের লেনদেন বিবরণী ও বিশ্লেষণ দেখুন।</p>
                      <span className="text-[10px] text-emerald-600 font-bold block mt-4 underline group-hover:text-emerald-700 font-sans">বিবরণী দেখুন →</span>
                    </button>
                  )}

                  {/* ICON CARD: DOCUMENT CENTER STORAGE */}
                  {isBM && (
                    <button
                      id="bm_op_document_center_btn"
                      onClick={() => {
                        setSelectedOperation('document_center');
                      }}
                      className="p-6 bg-white hover:bg-slate-50 border border-slate-200 hover:border-violet-500 rounded-2xl shadow-sm text-left transition group relative overflow-hidden"
                    >
                      <div className="w-12 h-12 bg-violet-100 text-violet-700 rounded-xl flex items-center justify-center mb-4 transition-transform group-hover:scale-105">
                        <FileText size={24} />
                      </div>
                      <h3 className="font-extrabold text-slate-800 text-base">দলিল ও ডকুমেন্ট সেন্টার</h3>
                      <p className="text-xs text-slate-400 mt-2 font-medium">অফিসিয়াল সার্কুলার, নোটিশ, রেজলিউশন খাতা এবং সদস্য কেওয়াইসি (KYC) দলিলের কেন্দ্রীয় স্টোরেজ হাব।</p>
                      <span className="text-[10px] text-violet-600 font-bold block mt-4 underline group-hover:text-violet-750 font-sans">ডকুমেন্ট সেন্টারে যান →</span>
                    </button>
                  )}

                  {/* ICON CARD: INTEREST PROVISION PANEL */}
                  {isBM && (
                    <button
                      id="bm_op_interest_provision_btn"
                      onClick={() => {
                        setSelectedOperation('interest_provision');
                      }}
                      className="p-6 bg-white hover:bg-slate-50 border border-slate-200 hover:border-blue-500 rounded-2xl shadow-sm text-left transition group relative overflow-hidden"
                    >
                      <div className="w-12 h-12 bg-blue-100 text-blue-700 rounded-xl flex items-center justify-center mb-4 transition-transform group-hover:scale-105">
                        <Coins size={24} />
                      </div>
                      <h3 className="font-extrabold text-slate-800 text-base">লাভ/ইন্টারেস্ট প্রভিশন ও বণ্টন</h3>
                      <p className="text-xs text-slate-400 mt-2 font-medium">সদস্য সঞ্চয়ের ওপর স্বয়ংক্রিয় লভ্যাংশ প্রাক্কলন, একাউন্টিং প্রভিশন জার্নাল এবং ব্যালেন্স বণ্টন সম্পন্ন করুন।</p>
                      <span className="text-[10px] text-blue-600 font-bold block mt-4 underline group-hover:text-blue-755 font-sans">হিসাব শুরু করুন →</span>
                    </button>
                  )}

                  {/* ICON CARD: YEAR END CLOSING PANEL */}
                  {isBM && (
                    <button
                      id="bm_op_year_end_closing_btn"
                      onClick={() => {
                        setSelectedOperation('year_end_closing');
                      }}
                      className="p-6 bg-white hover:bg-slate-50 border border-slate-200 hover:border-indigo-500 rounded-2xl shadow-sm text-left transition group relative overflow-hidden"
                    >
                      <div className="w-12 h-12 bg-indigo-100 text-indigo-700 rounded-xl flex items-center justify-center mb-4 transition-transform group-hover:scale-105">
                        <CalendarRange size={24} />
                      </div>
                      <h3 className="font-extrabold text-slate-800 text-base">ফাইন্যান্সিয়াল বছর ক্লোজিং (Year-End)</h3>
                      <p className="text-xs text-slate-400 mt-2 font-medium">আয় ও ব্যয় লেজার হিসাবসমূহ বন্ধকরণ, চূড়ান্ত সমাপনী নিরূপণ এবং পরবর্তী অর্থবছরে উদ্বৃত্ত স্থানান্তর ও লক।</p>
                      <span className="text-[10px] text-indigo-600 font-bold block mt-4 underline group-hover:text-indigo-755 font-sans">ক্লোজিং উইজার্ড চালু করুন →</span>
                    </button>
                  )}

                  {/* ICON CARD: SHARE & DIVIDEND MANAGEMENT */}
                  {isBM && (
                    <button
                      id="bm_op_share_management_btn"
                      onClick={() => {
                        setSelectedOperation('share_management');
                      }}
                      className="p-6 bg-white hover:bg-slate-50 border border-slate-200 hover:border-emerald-500 rounded-2xl shadow-sm text-left transition group relative overflow-hidden"
                    >
                      <div className="w-12 h-12 bg-emerald-100 text-emerald-700 rounded-xl flex items-center justify-center mb-4 transition-transform group-hover:scale-105">
                        <ShieldCheck size={24} />
                      </div>
                      <h3 className="font-extrabold text-slate-800 text-base">সমবায় শেয়ার ও লভ্যাংশ</h3>
                      <p className="text-xs text-slate-400 mt-2 font-medium">সদস্যদের সমবায় শেয়ার মূলধন, অতিরিক্ত শেয়ার ক্রয় ও প্রতি মাসের বা বার্ষিক লভ্যাংশ হিসাব ও বিতরণ।</p>
                      <span className="text-[10px] text-emerald-600 font-bold block mt-4 underline group-hover:text-emerald-700 font-sans">শেয়ার সেন্টারে যান →</span>
                    </button>
                  )}

                </div>
              )}

              {/* FOR FIELD OFFICER (FO) OPERATIONS - User Action Menus */}
              {selectedOperation === 'menu' && !isBM && (
                <div className="max-w-4xl mx-auto bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-200">
                  
                  {/* Title Banner (User Action Menus) */}
                  <div className="relative mb-8 border-b-2 border-[#2f6ce5] pb-2">
                    <span className="inline-block bg-[#2f6ce5] text-white font-bold text-xs sm:text-xs px-4 py-1.5 uppercase select-none tracking-wide">
                      User Action Menus
                    </span>
                    <button 
                      type="button"
                      onClick={() => {
                        setAlertMsg({ type: 'info', text: 'ডাটা সংরক্ষণ স্ট্যাটাস: সিস্টেম সক্রিয় এবং প্রস্তুত।' });
                      }}
                      className="absolute right-1 bottom-1 text-slate-400 hover:text-slate-600 transition-colors"
                      title="সংরক্ষণ করুন"
                    >
                      <Save className="w-6 h-6 stroke-[1.5]" />
                    </button>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
                    {/* 1. Collection (আদায়) */}
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedOperation('group_operation');
                        if (selectedGroupIdForSearch) {
                          setActiveCardView('member_transaction');
                        } else {
                          setActiveCardView('grid');
                          setAlertMsg({ type: 'info', text: 'দয়া করে কাজ শুরু করার জন্য প্রথমে একটি সমিতি / গ্রুপ নির্বাচন করুন!' });
                        }
                      }}
                      className="flex flex-col rounded-2xl overflow-hidden transition-all duration-200 cursor-pointer active:scale-95 group border border-amber-200 hover:border-amber-400 hover:shadow-xl shadow-[0_4px_12px_rgba(0,0,0,0.1)] bg-white h-44 sm:h-48"
                    >
                      <div className="bg-[#2f6ce5] py-5 sm:py-6 flex items-center justify-center w-full transition-colors group-hover:bg-[#1d59d1]">
                        <BookOpen className="w-10 h-10 sm:w-11 sm:h-11 text-white stroke-[1.5]" />
                      </div>
                      <div className="bg-[#eaeaea] flex-1 px-3 flex items-center justify-center text-slate-800 font-extrabold text-sm sm:text-base leading-tight">
                        Collection (আদায়)
                      </div>
                    </button>

                    {/* 2. Savings Refund (সঞ্চয় ফেরত) */}
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedOperation('group_operation');
                        if (selectedGroupIdForSearch) {
                          setActiveCardView('realized_information');
                        } else {
                          setActiveCardView('grid');
                          setAlertMsg({ type: 'info', text: 'দয়া করে কাজ শুরু করার জন্য প্রথমে একটি সমিতি / গ্রুপ নির্বাচন করুন!' });
                        }
                      }}
                      className="flex flex-col rounded-2xl overflow-hidden transition-all duration-200 cursor-pointer active:scale-95 group border border-amber-200 hover:border-amber-400 hover:shadow-xl shadow-[0_4px_12px_rgba(0,0,0,0.1)] bg-white h-44 sm:h-48"
                    >
                      <div className="bg-[#2f6ce5] py-5 sm:py-6 flex items-center justify-center w-full transition-colors group-hover:bg-[#1d59d1]">
                        <ArrowLeftRight className="w-10 h-10 sm:w-11 sm:h-11 text-white stroke-[1.5]" />
                      </div>
                      <div className="bg-[#eaeaea] flex-1 px-3 flex items-center justify-center text-slate-800 font-extrabold text-sm sm:text-base leading-tight">
                        Savings Refund (সঞ্চয় ফেরত)
                      </div>
                    </button>

                    {/* 3. New Admission (নতুন ভর্তি) */}
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedOperation('group_operation');
                        setActiveCardView('member_admission');
                      }}
                      className="flex flex-col rounded-2xl overflow-hidden transition-all duration-200 cursor-pointer active:scale-95 group border border-amber-200 hover:border-amber-400 hover:shadow-xl shadow-[0_4px_12px_rgba(0,0,0,0.1)] bg-white h-44 sm:h-48"
                    >
                      <div className="bg-[#2f6ce5] py-5 sm:py-6 flex items-center justify-center w-full transition-colors group-hover:bg-[#1d59d1]">
                        <UserPlus className="w-10 h-10 sm:w-11 sm:h-11 text-white stroke-[1.5]" />
                      </div>
                      <div className="bg-[#eaeaea] flex-1 px-3 flex items-center justify-center text-slate-800 font-extrabold text-sm sm:text-base leading-tight">
                        New Admission (নতুন ভর্তি)
                      </div>
                    </button>

                    {/* 4. New Loan (নতুন লোন) */}
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedOperation('group_operation');
                        if (selectedGroupIdForSearch) {
                          setActiveCardView('loan_proposal');
                        } else {
                          setActiveCardView('grid');
                          setAlertMsg({ type: 'info', text: 'দয়া করে কাজ শুরু করার জন্য প্রথমে একটি সমিতি / গ্রুপ নির্বাচন করুন!' });
                        }
                      }}
                      className="flex flex-col rounded-2xl overflow-hidden transition-all duration-200 cursor-pointer active:scale-95 group border border-amber-200 hover:border-amber-400 hover:shadow-xl shadow-[0_4px_12px_rgba(0,0,0,0.1)] bg-white h-44 sm:h-48"
                    >
                      <div className="bg-[#2f6ce5] py-5 sm:py-6 flex items-center justify-center w-full transition-colors group-hover:bg-[#1d59d1]">
                        <HandCoins className="w-10 h-10 sm:w-11 sm:h-11 text-white stroke-[1.5]" />
                      </div>
                      <div className="bg-[#eaeaea] flex-1 px-3 flex items-center justify-center text-slate-800 font-extrabold text-sm sm:text-base leading-tight">
                        New Loan (নতুন লোন)
                      </div>
                    </button>

                    {/* 5. Active Members (সক্রিয় সদস্য) */}
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedOperation('group_operation');
                        setActiveCardView('member_information');
                      }}
                      className="flex flex-col rounded-2xl overflow-hidden transition-all duration-200 cursor-pointer active:scale-95 group border border-amber-200 hover:border-amber-400 hover:shadow-xl shadow-[0_4px_12px_rgba(0,0,0,0.1)] bg-white h-44 sm:h-48"
                    >
                      <div className="bg-[#2f6ce5] py-5 sm:py-6 flex items-center justify-center w-full transition-colors group-hover:bg-[#1d59d1]">
                        <Users className="w-10 h-10 sm:w-11 sm:h-11 text-white stroke-[1.5]" />
                      </div>
                      <div className="bg-[#eaeaea] flex-1 px-3 flex items-center justify-center text-slate-800 font-extrabold text-sm sm:text-base leading-tight">
                        Active Members
                      </div>
                    </button>

                    {/* 6. Overdue Members */}
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedOperation('group_operation');
                        setActiveCardView('member_balance');
                      }}
                      className="flex flex-col rounded-2xl overflow-hidden transition-all duration-200 cursor-pointer active:scale-95 group border border-amber-200 hover:border-amber-400 hover:shadow-xl shadow-[0_4px_12px_rgba(0,0,0,0.1)] bg-white h-44 sm:h-48"
                    >
                      <div className="bg-[#2f6ce5] py-5 sm:py-6 flex items-center justify-center w-full transition-colors group-hover:bg-[#1d59d1]">
                        <AlertTriangle className="w-10 h-10 sm:w-11 sm:h-11 text-white stroke-[1.5]" />
                      </div>
                      <div className="bg-[#eaeaea] flex-1 px-3 flex items-center justify-center text-slate-800 font-extrabold text-sm sm:text-base leading-tight">
                        Overdue Members
                      </div>
                    </button>

                    {/* 7. Share & Dividend (সমবায় শেয়ার ও লভ্যাংশ) */}
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedOperation('group_operation');
                        setActiveCardView('share_management');
                      }}
                      className="flex flex-col rounded-2xl overflow-hidden transition-all duration-200 cursor-pointer active:scale-95 group border border-amber-200 hover:border-amber-400 hover:shadow-xl shadow-[0_4px_12px_rgba(0,0,0,0.1)] bg-white h-44 sm:h-48"
                    >
                      <div className="bg-[#2f6ce5] py-5 sm:py-6 flex items-center justify-center w-full transition-colors group-hover:bg-[#1d59d1]">
                        <ShieldCheck className="w-10 h-10 sm:w-11 sm:h-11 text-white stroke-[1.5]" />
                      </div>
                      <div className="bg-[#eaeaea] flex-1 px-3 flex items-center justify-center text-slate-800 font-extrabold text-sm sm:text-base leading-tight">
                        Share & Dividend (শেয়ার ও লভ্যাংশ)
                      </div>
                    </button>

                    {/* 7. Export Data */}
                    <button
                      type="button"
                      onClick={() => {
                        setAlertMsg({ type: 'info', text: 'এক্সপোর্ট ডাটা মডিউলটি পরবর্তীতে সক্রিয় করা হবে।' });
                      }}
                      className="flex flex-col rounded-2xl overflow-hidden transition-all duration-200 cursor-pointer active:scale-95 group border border-amber-200 hover:border-amber-400 hover:shadow-xl shadow-[0_4px_12px_rgba(0,0,0,0.1)] bg-white h-44 sm:h-48"
                    >
                      <div className="bg-[#2f6ce5] py-5 sm:py-6 flex items-center justify-center w-full transition-colors group-hover:bg-[#1d59d1]">
                        <Upload className="w-10 h-10 sm:w-11 sm:h-11 text-white stroke-[1.5]" />
                      </div>
                      <div className="bg-[#eaeaea] flex-1 px-3 flex items-center justify-center text-slate-800 font-extrabold text-sm sm:text-base leading-tight">
                        Export Data
                      </div>
                    </button>

                    {/* 8. Export Online */}
                    <button
                      type="button"
                      onClick={() => {
                        setAlertMsg({ type: 'info', text: 'অনলাইন এক্সপোর্ট মডিউলটি পরবর্তীতে সক্রিয় করা হবে।' });
                      }}
                      className="flex flex-col rounded-2xl overflow-hidden transition-all duration-200 cursor-pointer active:scale-95 group border border-amber-200 hover:border-amber-400 hover:shadow-xl shadow-[0_4px_12px_rgba(0,0,0,0.1)] bg-white h-44 sm:h-48"
                    >
                      <div className="bg-[#2f6ce5] py-5 sm:py-6 flex items-center justify-center w-full transition-colors group-hover:bg-[#1d59d1]">
                        <div className="relative flex items-center justify-center">
                          <Cloud className="w-10 h-10 sm:w-11 sm:h-11 text-white stroke-[1.5]" />
                          <RefreshCw className="absolute w-3.5 h-3.5 text-white/95 animate-spin [animation-duration:12s] translate-y-0.5" />
                        </div>
                      </div>
                      <div className="bg-[#eaeaea] flex-1 px-3 flex items-center justify-center text-slate-800 font-extrabold text-sm sm:text-base leading-tight">
                        Export Online
                      </div>
                    </button>

                  </div>
                </div>
              )}

              {/* SECTION: ADD GROUP FORM & INTEGRATED GROUP LIST */}
              {selectedOperation === 'add_group' && (
                <div className="space-y-6 animate-in fade-in duration-300 font-sans max-w-7xl mx-auto">
                  {/* Title & Navigation */}
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-slate-900 text-white p-4 sm:p-5 rounded-2xl border border-slate-800 shadow-lg gap-3">
                    <div>
                      <h2 className="text-base sm:text-lg font-black tracking-wide">গ্রুপ ও সমিতি ব্যবস্থাপনা (Group & Samity Management)</h2>
                      <p className="text-[10px] sm:text-xs text-slate-400 mt-1 font-medium font-sans">নতুন সঞ্চয় ও ঋণ গ্রুপ তৈরি করুন এবং বর্তমান গ্রুপসমূহ পরিচালনা করুন।</p>
                    </div>
                    <button 
                      onClick={() => {
                        setIsGroupEditMode(false);
                        setEditingGroupId(null);
                        setGroupNameInput('');
                        setGroupCodeInput('');
                        setGroupStaffSelect(`ILO-${currentBranchCode}`);
                        setGroupMeetingDayInput('শনিবার');
                        setGroupVillageInput('');
                        setSelectedOperation('menu');
                      }}
                      className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 hover:text-white font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer border border-slate-700"
                    >
                      <ArrowLeft size={13} /> অপারেশন মেনু
                    </button>
                  </div>

                  {/* Integrated Grid Layout */}
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                    
                    {/* Left Column: Add / Edit Form (lg:col-span-5) */}
                    <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 shadow-sm p-5 sm:p-6">
                      {isSimulated ? (
                        <>
                          <div className="flex items-center gap-2 pb-3 mb-4 border-b border-slate-100">
                            <div className={`w-2 h-2 rounded-full ${isGroupEditMode ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'}`}></div>
                            <h3 className="font-extrabold text-slate-800 text-sm">
                              {isGroupEditMode ? 'গ্রুপ তথ্য সংশোধন করুন' : 'নতুন গ্রুপ যুক্ত করুন (Add Group)'}
                            </h3>
                          </div>

                          {isGroupEditMode && (
                            <div className="mb-4 bg-amber-50 border border-amber-200/60 text-amber-800 px-3 py-2 rounded-xl text-[11px] font-bold flex justify-between items-center">
                              <span>⚠️ আপনি বর্তমানে গ্রুপটি সম্পাদন (Edit) করছেন।</span>
                              <button
                                type="button"
                                onClick={() => {
                                  setIsGroupEditMode(false);
                                  setEditingGroupId(null);
                                  setGroupNameInput('');
                                  setGroupCodeInput('');
                                  setGroupStaffSelect(`ILO-${currentBranchCode}`);
                                  setGroupMeetingDayInput('শনিবার');
                                  setGroupVillageInput('');
                                }}
                                className="text-[10px] underline hover:text-amber-950 cursor-pointer"
                              >
                                নতুন গ্রুপ মোডে যান
                              </button>
                            </div>
                          )}

                          <form onSubmit={handleSaveGroup} className="space-y-4">
                            <div>
                              <label className="block text-xs font-bold text-slate-500 mb-1.5">গ্রুপের নাম (Samity Name) *</label>
                              <input 
                                type="text"
                                placeholder="যেমন: পদ্মা সমিতি"
                                value={groupNameInput}
                                onChange={(e) => setGroupNameInput(e.target.value)}
                                className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-xs sm:text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-bold"
                                required
                              />
                            </div>

                            <div>
                              <label className="block text-xs font-bold text-slate-500 mb-1.5">গ্রুপ কোড (Group Code) *</label>
                              <input 
                                type="text"
                                placeholder="যেমন: GRP-001"
                                value={groupCodeInput}
                                onChange={(e) => setGroupCodeInput(e.target.value)}
                                className={`w-full px-3.5 py-2 border rounded-xl text-xs sm:text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-mono font-bold ${!isGroupEditMode ? 'bg-slate-50 border-slate-200 text-slate-500 cursor-not-allowed' : 'border-slate-200 bg-white'}`}
                                disabled={!isGroupEditMode}
                                required
                              />
                              {!isGroupEditMode && (
                                <p className="text-[10px] text-slate-400 mt-1 font-semibold font-sans">সমিতির গ্রুপ কোড সিস্টেম কর্তৃক স্বয়ংক্রিয়ভাবে তৈরি হয়েছে।</p>
                              )}
                            </div>

                            <div>
                              <label className="block text-xs font-bold text-slate-500 mb-1.5">দায়িত্বপ্রাপ্ত মাঠ কর্মকর্তা *</label>
                              <select
                                value={groupStaffSelect}
                                onChange={(e) => setGroupStaffSelect(e.target.value)}
                                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs sm:text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 bg-white font-bold text-slate-700"
                              >
                                {staffList
                                  .filter((s) => s.branchId === staff.branchId)
                                  .map((s) => (
                                    <option key={s.id} value={s.staffId}>
                                      {s.name} ({s.designation || 'মাঠ কর্মী'})
                                    </option>
                                  ))}
                              </select>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1.5">বৈঠকের দিন *</label>
                                <select
                                  value={groupMeetingDayInput}
                                  onChange={(e) => setGroupMeetingDayInput(e.target.value)}
                                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs sm:text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 bg-white font-bold"
                                >
                                  <option value="শনিবার">শনিবার</option>
                                  <option value="রবিবার">রবিবার</option>
                                  <option value="সোমবার">সোমবার</option>
                                  <option value="মঙ্গলবার">মঙ্গলবার</option>
                                  <option value="বুধবার">বুধবার</option>
                                  <option value="বৃহস্পতিবার">বৃহস্পতিবার</option>
                                  <option value="শুক্রবার">শুক্রবার</option>
                                </select>
                              </div>

                              <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1.5">গ্রাম / এলাকা</label>
                                <input 
                                  type="text"
                                  placeholder="যেমন: চাঁদপুর"
                                  value={groupVillageInput}
                                  onChange={(e) => setGroupVillageInput(e.target.value)}
                                  className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-xs sm:text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-bold"
                                />
                              </div>
                            </div>

                            <div className="flex gap-3 pt-2">
                              <button 
                                type="button" 
                                onClick={() => {
                                  setIsGroupEditMode(false);
                                  setEditingGroupId(null);
                                  setGroupNameInput('');
                                  setGroupCodeInput('');
                                  setGroupStaffSelect(`ILO-${currentBranchCode}`);
                                  setGroupMeetingDayInput('শনিবার');
                                  setGroupVillageInput('');
                                }}
                                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 transition-all rounded-xl text-xs font-bold text-slate-600 cursor-pointer"
                              >
                                ফর্ম পরিষ্কার করুন
                              </button>
                              <button 
                                type="submit" 
                                className="flex-1 py-2.5 bg-[#2f6ce5] hover:bg-[#1d59d1] transition-all text-white font-bold rounded-xl text-xs shadow-sm flex items-center justify-center gap-1 cursor-pointer"
                              >
                                {isGroupEditMode ? 'হালনাগাদ করুন' : 'গ্রুপ তৈরি করুন'}
                              </button>
                            </div>
                          </form>
                        </>
                      ) : (
                        <div className="flex flex-col items-center text-center py-8 px-4 font-sans space-y-4">
                          <div className="w-12 h-12 bg-amber-500/10 border border-amber-500/20 rounded-full flex items-center justify-center text-amber-600 animate-pulse">
                            <Lock size={22} className="stroke-[2.5]" />
                          </div>
                          <div>
                            <h4 className="font-extrabold text-slate-800 text-sm">গ্রুপ কার্যক্রম রিড-অনলি মোডে রয়েছে</h4>
                            <p className="text-[11.5px] text-slate-500 mt-2.5 leading-relaxed font-medium">
                              নিরাপত্তা ও নিয়ন্ত্রণ নীতি অনুযায়ী, শাখা ব্যবস্থাপক (BM) বা সাধারণ কোনো আইডি থেকে গ্রুপ বা সমিতি তৈরি, সংশোধন বা বাতিল করা অনুমোদিত নয়।
                            </p>
                            <p className="text-[11.2px] text-[#2f6ce5] font-extrabold mt-3">
                              শুধুমাত্র প্রধান এডমিন (Org Admin) গ্রুপ কোড বরাদ্দ ও নতুন গ্রুপ তৈরি করতে পারবেন।
                            </p>
                          </div>
                          <div className="w-full bg-slate-50 border border-slate-100 rounded-xl p-3.5 text-[10.5px] text-slate-500 font-semibold leading-relaxed">
                            যেকোনো পরিবর্তনের জন্য দয়া করে প্রধান কার্যালয়ে এডমিনের সাথে যোগাযোগ করুন।
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Right Column: Existing Group List with Real-time Search and Stats (lg:col-span-7) */}
                    <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 shadow-sm p-5 sm:p-6 space-y-4">
                      
                      {/* Search Bar and Micro Statistics */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
                        <div>
                          <h3 className="font-extrabold text-slate-800 text-sm">গ্রুপ ও সমিতি তালিকা ({groupList.filter(g => g.branchId === staff.branchId).length})</h3>
                          <p className="text-[10px] text-slate-400 mt-0.5">আপনার শাখার আওতাধীন সকল গ্রুপের বাস্তব তথ্য</p>
                        </div>

                        {/* Soft Micro Statistics */}
                        <div className="flex flex-wrap items-center gap-1.5 text-[9px] font-extrabold">
                          <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded-md border border-blue-100">
                            মোট: {groupList.filter(g => g.branchId === staff.branchId).length}
                          </span>
                          <span className="bg-emerald-50 text-emerald-700 px-2 py-1 rounded-md border border-emerald-100">
                            সক্রিয়: {groupList.filter(g => g.branchId === staff.branchId && g.isActive !== false).length}
                          </span>
                          <span className="bg-rose-50 text-rose-700 px-2 py-1 rounded-md border border-rose-100">
                            নিষ্ক্রিয়: {groupList.filter(g => g.branchId === staff.branchId && g.isActive === false).length}
                          </span>
                        </div>
                      </div>

                      {/* Search Input Filter */}
                      <div className="relative">
                        <input 
                          type="text" 
                          placeholder="গ্রুপের নাম, কোড, গ্রাম বা কর্মকর্তার নাম দিয়ে খুঁজুন..." 
                          className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-bold"
                          value={groupSearchQuery}
                          onChange={(e) => setGroupSearchQuery(e.target.value)}
                        />
                        <span className="absolute left-3.5 top-2.5 text-slate-400">
                          <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                          </svg>
                        </span>
                        {groupSearchQuery && (
                          <button 
                            onClick={() => setGroupSearchQuery('')}
                            className="absolute right-3.5 top-2.5 text-slate-400 hover:text-slate-600 font-bold text-[10px]"
                          >
                            মুছুন
                          </button>
                        )}
                      </div>

                      {/* Table Container */}
                      <div className="overflow-x-auto border border-slate-100 rounded-xl">
                        <table className="w-full text-xs text-left">
                          <thead className="bg-slate-50 text-slate-500 font-extrabold border-b border-slate-100">
                            <tr>
                              <th className="py-2.5 px-3">নাম ও কোড</th>
                              <th className="py-2.5 px-3">মাঠ কর্মী</th>
                              <th className="py-2.5 px-3">বৈঠক ও এলাকা</th>
                              <th className="py-2.5 px-3 text-center">অবস্থা</th>
                              {isSimulated && <th className="py-2.5 px-3 text-center">অ্যাকশন</th>}
                            </tr>
                          </thead>
                          <tbody className="text-slate-700 divide-y divide-slate-100">
                            {groupList
                              .filter(g => g.branchId === staff.branchId)
                              .filter(g => {
                                if (!groupSearchQuery.trim()) return true;
                                const q = groupSearchQuery.toLowerCase();
                                const officer = staffList.find(s => s.id === g.assignedStaffId || s.staffId === g.assignedStaffId);
                                return (
                                  g.name.toLowerCase().includes(q) ||
                                  g.code.toLowerCase().includes(q) ||
                                  (g.meetingDay || '').toLowerCase().includes(q) ||
                                  (g.village || '').toLowerCase().includes(q) ||
                                  (officer?.name || '').toLowerCase().includes(q)
                                );
                              })
                              .map((group) => {
                                const officer = staffList.find(s => s.id === group.assignedStaffId || s.staffId === group.assignedStaffId);
                                return (
                                  <tr key={group.id} className="hover:bg-slate-50/80 transition-colors">
                                    <td className="py-3 px-3">
                                      <div className="font-extrabold text-slate-800">{group.name}</div>
                                      <div className="text-[10px] font-mono font-bold text-blue-500 mt-0.5">{group.code}</div>
                                    </td>
                                    <td className="py-3 px-3">
                                      <div className="font-bold text-slate-700">{officer?.name || 'অনির্ধারিত'}</div>
                                      <div className="text-[9px] text-slate-400 mt-0.5 font-sans">ID: {group.assignedStaffId}</div>
                                    </td>
                                    <td className="py-3 px-3">
                                      <div className="font-bold text-slate-600">{group.meetingDay || 'শনিবার'}</div>
                                      <div className="text-[9px] text-slate-500 font-sans mt-0.5">{group.village || 'চাঁদপুর'}</div>
                                    </td>
                                    <td className="py-3 px-3 text-center">
                                      {isSimulated ? (
                                        <button
                                          type="button"
                                          onClick={() => {
                                            const updatedGroups = groupList.map(g => 
                                              g.id === group.id ? { ...g, isActive: g.isActive === false ? true : false } : g
                                            );
                                            setGroupList(updatedGroups);
                                            setAlertMsg({ type: 'success', text: `"${group.name}" এর স্ট্যাটাস পরিবর্তন করা হয়েছে।` });
                                          }}
                                          className={`px-2.5 py-1 rounded-full font-black text-[9px] tracking-wide cursor-pointer transition-all border ${group.isActive === false ? 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100' : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'}`}
                                        >
                                          {group.isActive === false ? 'নিষ্ক্রিয়' : 'সক্রিয়'}
                                        </button>
                                      ) : (
                                        <span
                                          className={`px-2.5 py-1 rounded-full font-black text-[9px] tracking-wide border select-none ${group.isActive === false ? 'bg-rose-50 text-rose-600 border-rose-100' : 'bg-emerald-50 text-emerald-600 border-emerald-100'}`}
                                        >
                                          {group.isActive === false ? 'নিষ্ক্রিয়' : 'সক্রিয়'}
                                        </span>
                                      )}
                                    </td>
                                    {isSimulated && (
                                      <td className="py-3 px-3 text-center">
                                        <div className="flex items-center justify-center gap-1.5">
                                          <button 
                                            type="button"
                                            onClick={() => openEditGroup(group)}
                                            className="p-1.5 bg-blue-50 hover:bg-blue-100 text-blue-600 hover:text-blue-800 rounded-lg transition-all cursor-pointer"
                                            title="ইডিট করুন"
                                          >
                                            <Edit size={12} />
                                          </button>
                                          <button 
                                            type="button"
                                            onClick={() => handleDeleteGroup(group)}
                                            className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 hover:text-rose-800 rounded-lg transition-all cursor-pointer"
                                            title="ডিলিট করুন"
                                          >
                                            <Trash2 size={12} />
                                          </button>
                                        </div>
                                      </td>
                                    )}
                                  </tr>
                                );
                              })}

                            {groupList.filter(g => g.branchId === staff.branchId).length === 0 && (
                              <tr>
                                <td colSpan={isSimulated ? 5 : 4} className="py-8 text-center text-slate-400 font-bold text-xs font-sans">
                                  আপনার শাখায় কোনো গ্রুপ বা সমিতি খুঁজে পাওয়া যায়নি। বামদিকের ফর্ম ব্যবহার করে আপনার প্রথম গ্রুপটি যোগ করুন!
                                </td>
                              </tr>
                            )}

                            {groupList.filter(g => g.branchId === staff.branchId).length > 0 && 
                             groupList
                              .filter(g => g.branchId === staff.branchId)
                              .filter(g => {
                                if (!groupSearchQuery.trim()) return true;
                                const q = groupSearchQuery.toLowerCase();
                                const officer = staffList.find(s => s.id === g.assignedStaffId || s.staffId === g.assignedStaffId);
                                return (
                                  g.name.toLowerCase().includes(q) ||
                                  g.code.toLowerCase().includes(q) ||
                                  (g.meetingDay || '').toLowerCase().includes(q) ||
                                  (g.village || '').toLowerCase().includes(q) ||
                                  (officer?.name || '').toLowerCase().includes(q)
                                );
                              }).length === 0 && (
                              <tr>
                                <td colSpan={isSimulated ? 5 : 4} className="py-8 text-center text-slate-400 font-bold text-xs font-sans">
                                  অনুসন্ধানকৃত তথ্য অনুযায়ী কোনো গ্রুপ খুঁজে পাওয়া যায়নি!
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>

                  </div>
                </div>
              )}

              {/* SECTION: GROUP OPERATION (LIST AND ACTIONS) - STYLED TO MATCH SYSTEM BENTO-GRID DASHBOARD */}
              {(selectedOperation === 'group_operation' || selectedOperation === 'interest_posting' || selectedOperation === 'share_management') && (
                <div id="bm_sub_group_op" className="max-w-5xl mx-auto bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-5 animate-in fade-in duration-300 font-sans max-sm:fixed max-sm:inset-0 max-sm:z-[100] max-sm:overflow-y-auto max-sm:bg-white max-sm:p-4 max-sm:rounded-none">
                  
                  {/* HEADER BAR FOR GROUP OPERATIONS */}
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-slate-100 pb-4 mb-5 gap-3 bg-slate-50/50 p-4 rounded-t-2xl">
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          if (activeCardView === 'grid') {
                            setSelectedOperation('menu');
                          } else {
                            setActiveCardView('grid');
                          }
                        }}
                        className="p-1.5 rounded-lg bg-white border border-slate-200 hover:border-[#2f6ce5]/50 hover:bg-slate-50 text-slate-600 active:scale-95 transition-all cursor-pointer shadow-3xs"
                        title={activeCardView === 'grid' ? "প্রধান মেনুতে ফিরে যান" : "গ্রুপ মডিউলে ফিরে যান"}
                      >
                        <ChevronLeft className="w-5 h-5 stroke-[2.5]" />
                      </button>
                      <div>
                        <h3 className="font-extrabold text-slate-800 text-sm sm:text-base flex items-center gap-2">
                          <Layers className="w-4 h-4 text-[#2f6ce5]" />
                          {activeCardView === 'grid' ? (
                            'সমিতি / গ্রুপ কার্যক্রম (Group Operations)'
                          ) : activeCardView === 'member_admission' ? (
                            'সদস্য ভর্তি ফরম (Member Admission)'
                          ) : activeCardView === 'member_information' ? (
                            'সদস্য প্রোফাইল ও বিবরণ (Member Information)'
                          ) : activeCardView === 'add_savings_account' ? (
                            'নতুন সঞ্চয় হিসাব (General Savings)'
                          ) : activeCardView === 'add_cbs_account' ? (
                            'নতুন বিশেষ সঞ্চয় হিসাব (CBS Account)'
                          ) : activeCardView === 'add_lts_account' ? (
                            'নতুন দীর্ঘমেয়াদী সঞ্চয় হিসাব (LTS Account)'
                          ) : activeCardView === 'member_transaction' ? (
                            'গ্রুপ ভিত্তিক আদায় ও লেনদেন (Member Transaction)'
                          ) : activeCardView === 'loan_proposal' ? (
                            'ঋণ প্রস্তাব বা আবেদন ফরম (Loan Proposal)'
                          ) : activeCardView === 'loan_disburse' ? (
                            'ঋণ বা লট অনুমোদন ও বিতরণ (Loan Disbursement)'
                          ) : activeCardView === 'member_balance' ? (
                            'সদস্যের হিসাবের ব্যালেন্স (Member Ledger Balance)'
                          ) : activeCardView === 'realized_information' ? (
                            'সঞ্চয় ফেরত আবেদন (Savings Refund Application)'
                          ) : (activeCardView === 'share_management' || selectedOperation === 'share_management') ? (
                            'সমবায় শেয়ার ও লভ্যাংশ ব্যবস্থাপনা (Share & Dividend)'
                          ) : (
                            'সমিতি / গ্রুপ কার্যক্রম'
                          )}
                        </h3>
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-slate-500 font-semibold mt-1 font-sans">
                          {isSimulated ? (
                            <form onSubmit={handleUpdateWorkingDay} className="flex items-center gap-1.5 bg-blue-50 text-blue-800 px-2 py-0.5 rounded-lg border border-blue-100 shadow-3xs">
                              <span className="font-extrabold text-[10px]">তারিখ:</span>
                              <input
                                type="date"
                                className="px-1 py-0.5 border border-blue-200 rounded-md text-[10px] bg-white text-blue-900 font-extrabold focus:outline-none focus:ring-1 focus:ring-blue-500"
                                value={workingDayInput}
                                onChange={(e) => setWorkingDayInput(e.target.value)}
                              />
                              <button
                                type="submit"
                                className="bg-blue-600 hover:bg-blue-700 text-white font-extrabold px-2 py-0.5 rounded-md text-[9px] cursor-pointer transition-colors"
                              >
                                লোড করুন
                              </button>
                              {localStorage.getItem(`tanzil_working_day_override_${org.id}_branch_${staff.branchId || 'default'}_user_${staff.id || staff.staffId || 'admin'}`) && (
                                <button
                                  type="button"
                                  onClick={handleResetWorkingDay}
                                  className="bg-amber-500 hover:bg-amber-600 text-white font-extrabold px-2 py-0.5 rounded-md text-[9px] cursor-pointer transition-colors"
                                  title="মূল ব্রাঞ্চ তারিখে ফিরে যান"
                                >
                                  রিসেট
                                </button>
                              )}
                            </form>
                          ) : (
                            <span className="text-[10px] text-slate-400 font-mono">
                              তারিখ: {new Date(workingDay).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                            </span>
                          )}
                          <span className="text-[10px] text-slate-400 font-mono">| শাখা: {currentBranch?.name || 'HO'} | কর্মকর্তা: {staff.name} ({staff.staffId || '009'})</span>
                        </div>
                      </div>
                    </div>

                    <button 
                      onClick={() => setSelectedOperation('menu')}
                      className="text-xs text-rose-600 hover:text-rose-755 font-extrabold flex items-center gap-1.5 cursor-pointer font-sans border border-rose-250 bg-white hover:bg-rose-50 px-2.5 py-1.5 rounded-lg transition-all shadow-3xs"
                    >
                      <Power size={13} /> প্রধান মেন্যু
                    </button>
                  </div>

                  {/* BODY AREA */}
                  <div className="space-y-6">
                    {isRealBMReadOnly && (
                      <div className="bg-amber-500/10 border border-amber-500/20 text-amber-800 px-4 py-3.5 rounded-2xl text-xs font-bold flex items-center gap-2.5 shadow-sm">
                        <AlertCircle className="w-4 h-4 text-amber-600 animate-pulse flex-shrink-0" />
                        <span>শাখা ব্যবস্থাপক (BM) হিসেবে আপনি গ্রুপ কার্যক্রম রিড-অনলি মুডে দেখছেন। আপনি কোনো নতুন তথ্য যোগ, সংশোধন বা সেভ করতে পারবেন না।</span>
                      </div>
                    )}
                    {/* INTEREST POSTING UI */}
                    {selectedOperation === 'interest_posting' && (
                      <div className="space-y-6 animate-in fade-in">
                        <div className="flex justify-between items-center border-b border-slate-100 pb-3 mb-4">
                          <h3 className="font-extrabold text-slate-800 text-sm sm:text-base flex items-center gap-1.5 font-sans">
                            <AlertCircle size={18} className="text-emerald-600" />
                            লভ্যাংশ পোস্টিং প্যানেল (Interest Posting)
                          </h3>
                          <button 
                            onClick={() => setSelectedOperation('menu')}
                            className="text-xs text-slate-400 hover:text-slate-600 font-bold flex items-center gap-1 cursor-pointer font-sans border-0 bg-transparent"
                          >
                            <ArrowLeft size={12} /> অপারেশন মেনু
                          </button>
                        </div>

                        {maturedFdrAccounts.length > 0 && (
                            <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 mb-6 animate-in fade-in slide-in-from-top-2">
                            <h4 className="text-rose-800 font-black text-sm flex items-center gap-2">
                                <AlertCircle size={16}/>
                                ম্যাচিউরড এফডিআর লভ্যাংশ পোস্টিং ({maturedFdrAccounts.length})
                            </h4>
                            <p className="text-xs text-rose-600 mt-1 mb-3">নিম্নোক্ত এফডিআর হিসাবসমূহের ১ মাস পূর্ণ হয়েছে। অনুগ্রহ করে লভ্যাংশ প্রদান করুন।</p>
                            <div className="space-y-2">
                                {maturedFdrAccounts.map(acc => (
                                <div key={acc.id} className="flex justify-between items-center bg-white p-2 rounded-lg text-xs font-mono border border-rose-100">
                                    <span>{acc.memberName} ({acc.accountNo})</span>
                                    <button 
                                    onClick={() => handlePostFdrInterest(acc)}
                                    className="bg-rose-600 text-white px-3 py-1 rounded hover:bg-rose-700"
                                    >
                                    লভ্যাংশ পোস্টিং করুন
                                    </button>
                                </div>
                                ))}
                            </div>
                            </div>
                        )}

                        {dueSavingsAccounts.length > 0 && (
                            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 mb-6 animate-in fade-in slide-in-from-top-2">
                            <h4 className="text-emerald-800 font-black text-sm flex items-center justify-between gap-2">
                                <span className="flex items-center gap-2">
                                <AlertCircle size={16}/>
                                বার্ষিক সঞ্চয় লভ্যাংশ পোস্টিং ({dueSavingsAccounts.length})
                                </span>
                                <button 
                                onClick={handlePostAllSavingsInterest}
                                className="bg-emerald-700 text-white text-xs px-3 py-1 rounded hover:bg-emerald-800"
                                >
                                সবগুলো লভ্যাংশ পোস্টিং করুন
                                </button>
                            </h4>
                            <p className="text-xs text-emerald-600 mt-1 mb-3">জুন মাস উপলক্ষ্যে নিম্নোক্ত সঞ্চয় হিসাবসমূহের বার্ষিক লভ্যাংশ পোস্টিং করুন।</p>
                            <div className="space-y-2">
                                {dueSavingsAccounts.map(acc => (
                                <div key={acc.id} className="flex justify-between items-center bg-white p-2 rounded-lg text-xs font-mono border border-emerald-100">
                                    <span>{acc.memberName} ({acc.accountNo})</span>
                                    <button 
                                    onClick={() => handlePostSavingsInterest(acc)}
                                    className="bg-emerald-600 text-white px-3 py-1 rounded hover:bg-emerald-700"
                                    >
                                    লভ্যাংশ পোস্টিং করুন
                                    </button>
                                </div>
                                ))}
                            </div>
                            </div>
                        )}
                        
                        {maturedFdrAccounts.length === 0 && dueSavingsAccounts.length === 0 && (
                           <div className="text-center p-10 bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-slate-500 font-bold">
                              কোন লভ্যাংশ পোস্টিংযোগ্য হিসাব পাওয়া যায়নি।
                           </div>
                        )}
                      </div>
                    )}

                    {activeCardView === 'member_admission' ? (
                      <MemberAdmissionForm
                        onBack={() => setActiveCardView('grid')}
                        branchGroups={branchGroups}
                        staff={staff}
                        org={org}
                        defaultGroupId={selectedGroupIdForSearch}
                        existingMembersCount={groupMembers.length}
                        onSuccess={handleMemberAdmissionSuccess}
                        workingDay={workingDay}
                      />
                    ) : activeCardView === 'member_information' ? (
                      <MemberInformationView
                        onBack={() => setActiveCardView('grid')}
                        groupMembers={groupMembers}
                        branchGroups={branchGroups}
                        selectedGroupId={selectedGroupIdForSearch}
                        onUpdateStatus={handleUpdateMemberStatus}
                        savingsAccounts={savingsAccounts}
                        cbsAccounts={cbsAccounts}
                        ltsAccounts={ltsAccounts}
                        transactions={transactions}
                        onTransferMember={handleTransferMember}
                        onCloseAccount={handleCloseAccount}
                        onLoanAction={handleLoanAction}
                        org={org}
                        staff={staff}
                        workingDay={workingDay}
                      />
                    ) : activeCardView === 'add_savings_account' ? (
                      <AddSavingsAccountForm
                        onBack={() => setActiveCardView('grid')}
                        branchGroups={branchGroups}
                        groupMembers={groupMembers}
                        savingsAccounts={savingsAccounts}
                        defaultGroupId={selectedGroupIdForSearch}
                        onSuccess={handleSavingsSuccess}
                        org={org}
                        workingDay={workingDay}
                      />
                    ) : activeCardView === 'add_cbs_account' ? (
                      <AddCbsAccountForm
                        onBack={() => setActiveCardView('grid')}
                        branchGroups={branchGroups}
                        groupMembers={groupMembers}
                        cbsAccounts={cbsAccounts}
                        defaultGroupId={selectedGroupIdForSearch}
                        onSuccess={handleCbsSuccess}
                        org={org}
                        workingDay={workingDay}
                      />
                    ) : activeCardView === 'add_lts_account' ? (
                      <AddLtsAccountForm
                        onBack={() => setActiveCardView('grid')}
                        branchGroups={branchGroups}
                        groupMembers={groupMembers}
                        defaultGroupId={selectedGroupIdForSearch}
                        onSuccess={handleLtsSuccess}
                        org={org}
                        workingDay={workingDay}
                      />
                    ) : activeCardView === 'member_transaction' ? (
                      <MemberTransactionView
                        onBack={() => setActiveCardView('grid')}
                        groupId={selectedGroupIdForSearch}
                        branchGroups={branchGroups}
                        groupMembers={groupMembers}
                        savingsAccounts={savingsAccounts}
                        cbsAccounts={cbsAccounts}
                        ltsAccounts={ltsAccounts}
                        onSaveTransactions={handleSaveTransactions}
                        staff={staff}
                        transactions={transactions}
                        workingDay={workingDay}
                        org={org}
                        holidays={holidays}
                      />
                    ) : activeCardView === 'loan_proposal' ? (
                      <LoanProposalView
                        onBack={() => setActiveCardView('grid')}
                        branchGroups={branchGroups}
                        groupMembers={groupMembers}
                        workingDay={workingDay}
                        org={org}
                        staff={staff}
                        defaultGroupId={selectedGroupIdForSearch}
                        onSuccess={handleLoanProposalSuccess}
                        holidays={holidays}
                      />
                    ) : activeCardView === 'loan_disburse' ? (
                      <LoanDisburseView
                        onBack={() => setActiveCardView('grid')}
                        branchGroups={branchGroups}
                        groupMembers={groupMembers}
                        workingDay={workingDay}
                        org={org}
                        staff={staff}
                        defaultGroupId={selectedGroupIdForSearch}
                        onSuccess={handleLoanDisburseSuccess}
                      />
                    ) : activeCardView === 'member_balance' ? (
                      <MemberBalanceView
                        onBack={() => setActiveCardView('grid')}
                        branchGroups={branchGroups}
                        groupMembers={groupMembers}
                        savingsAccounts={savingsAccounts}
                        cbsAccounts={cbsAccounts}
                        ltsAccounts={ltsAccounts}
                        staff={staff}
                        workingDay={workingDay}
                        transactions={transactions}
                        org={org}
                        holidays={holidays}
                      />
                    ) : activeCardView === 'realized_information' ? (
                      <RealizedInformationView
                        onBack={() => setActiveCardView('grid')}
                        branchGroups={branchGroups}
                        groupMembers={groupMembers}
                        workingDay={workingDay}
                        transactions={transactions}
                        staff={staff}
                        branchName={currentBranch?.name || 'HO'}
                        onUpdateMembers={setGroupMembers}
                        onUpdateSavingsAccounts={setSavingsAccounts}
                        onUpdateTransactions={setTransactions}
                        savingsAccounts={savingsAccounts}
                        cbsAccounts={cbsAccounts}
                        onUpdateCbsAccounts={setCbsAccounts}
                        ltsAccounts={ltsAccounts}
                        onUpdateLtsAccounts={setLtsAccounts}
                        defaultGroupId={selectedGroupIdForSearch}
                      />
                    ) : (activeCardView === 'share_management' || selectedOperation === 'share_management') ? (
                      <ShareManagementView
                        onBack={() => {
                          setActiveCardView('grid');
                          if (selectedOperation === 'share_management') {
                            setSelectedOperation('menu');
                          }
                        }}
                        org={org}
                        staff={staff}
                        groupMembers={groupMembers}
                        branchGroups={branchGroups}
                        workingDay={workingDay}
                        onUpdateMember={(updatedMem) => {
                          setGroupMembers(prev => prev.map(m => m.id === updatedMem.id ? updatedMem : m));
                        }}
                      />
                    ) : (
                      <>
                        {/* 3. GROUPS DROPDOWN SELECTOR */}
                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 shadow-3xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                          <div className="flex items-center gap-2">
                            <Layers className="w-5 h-5 text-[#2f6ce5] shrink-0" />
                            <div>
                              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider">সমিতি ভিত্তিক ফিল্টার (Group Filter)</label>
                              <span className="text-xs font-bold text-slate-600">কাজ শুরু করার আগে একটি সমিতি বা গ্রুপ সিলেক্ট করুন:</span>
                            </div>
                          </div>
                          
                          <div className="w-full sm:w-80 bg-white rounded-lg border border-slate-200 p-1 shadow-xs">
                            <select
                              id="op_group_select"
                              className="w-full bg-transparent border-0 outline-none text-slate-800 font-extrabold text-xs cursor-pointer py-1.5 focus:ring-0 px-2"
                              value={selectedGroupIdForSearch}
                              onChange={(e) => {
                                const val = e.target.value;
                                setSelectedGroupIdForSearch(val);
                                setSelectedMemberIdForSearch('');
                              }}
                            >
                              <option value="" className="text-slate-400 font-bold">-- সমিতি / গ্রুপ নির্বাচন করুন --</option>
                              {branchGroups.map((g) => (
                                <option key={g.id} value={g.id} className="text-slate-800 font-bold">
                                  {g.name} ({g.code}) - {g.meetingDay || 'শনিবার'}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>

                        {/* 4. USER ACTION MENUS TITLE */}
                        <div className="relative border-b-2 border-[#2f6ce5] pb-1.5 mt-2">
                          <span className="inline-block bg-[#2f6ce5] text-white font-black text-[10px] sm:text-xs px-4 py-1.5 uppercase select-none tracking-wide rounded-t-md">
                            User Action Menus
                          </span>
                        </div>

                        {/* 5. RESPONSIVE CARDS GRID */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5 pb-2">
                          {[
                            { id: 'member_transaction', label: 'গ্রুপ লেনদেন আদায়', englishLabel: 'Member Transaction', desc: 'দৈনিক সঞ্চয় ও কিস্তি আদায় পোস্টিং করুন।', icon: BookOpen, active: true, color: 'bg-emerald-50 text-emerald-700 border-emerald-100 hover:border-emerald-500' },
                            { id: 'realized_information', label: 'সঞ্চয় ফেরত ও ঋণ সমন্বয়', englishLabel: 'Savings Refund & Adjustment', desc: 'সদস্যদের সঞ্চয় ফেরত ও সমন্বয় আবেদন এবং তালিকা।', icon: HandCoins, active: true, color: 'bg-rose-50 text-rose-700 border-rose-100 hover:border-rose-500' },
                            { id: 'member_information', label: 'সদস্য প্রোফাইল ও তথ্য', englishLabel: 'Member Information', desc: 'সদস্যদের খতিয়ান, স্ট্যাটাস ও নাম সংশোধন।', icon: UserCheck, active: true, color: 'bg-amber-50 text-amber-700 border-amber-100 hover:border-amber-500' },
                            { id: 'member_balance', label: 'সদস্য লেজার ব্যালেন্স', englishLabel: 'Member Ledger Balance', desc: 'গ্রাহকের সঞ্চয় ও ঋণ স্থিতি দ্রুত চেক করুন।', icon: FileText, active: true, color: 'bg-blue-50 text-[#2f6ce5] border-blue-100 hover:border-blue-500' },
                            { id: 'member_admission', label: 'নতুন সদস্য ভর্তি ফরম', englishLabel: 'Member Admission', desc: 'নতুন সঞ্চয়ী ও ঋণ গ্রহীতা সদস্য ভর্তি করুন।', icon: UserPlus, active: true, color: 'bg-purple-50 text-purple-700 border-purple-100 hover:border-purple-500' },
                            { id: 'add_lts_account', label: 'দীঘমেয়াদী সঞ্চয় হিসাব', englishLabel: 'Add LTS Account', desc: 'নতুন ডিপিএস বা এফডিআর খতিয়ান বুকিং করুন।', icon: Coins, active: true, color: 'bg-cyan-50 text-cyan-700 border-cyan-100 hover:border-cyan-500' },
                            { id: 'loan_disburse', label: 'ঋণ বিতরণ ও খাতা পোস্টিং', englishLabel: 'Loan Disbursement', desc: 'অনুমোদিত ঋণের চেক বা ক্যাশ বিতরণ ফরম।', icon: HandCoins, active: true, color: 'bg-indigo-50 text-indigo-700 border-indigo-100 hover:border-indigo-500' },
                            { id: 'loan_proposal', label: 'নতুন ঋণ প্রস্তাব ফরম', englishLabel: 'Loan Proposal', desc: 'মাঠ থেকে নেওয়া ঋণের প্রস্তাব বা আবেদন ফরম।', icon: ClipboardList, active: true, color: 'bg-teal-50 text-teal-700 border-teal-100 hover:border-teal-500' },
                            { id: 'add_cbs_account', label: 'বিশেষ সঞ্চয় হিসাব বুকিং', englishLabel: 'Add CBS Account', desc: 'নতুন বিশেষ মেয়াদ উত্তীর্ণ সঞ্চয় স্কিম চালু করুন।', icon: PiggyBank, active: true, color: 'bg-rose-50 text-rose-700 border-rose-100 hover:border-rose-500' },
                            { id: 'add_savings_account', label: 'সাধারণ সঞ্চয় হিসাব খুলুন', englishLabel: 'Add GS Account', desc: 'নতুন সাধারণ সঞ্চয় খাতা বা সঞ্চয় বিধি সেটআপ।', icon: DollarSign, active: true, color: 'bg-amber-50 text-amber-700 border-amber-100 hover:border-amber-500' },
                            { id: 'share_management', label: 'সমবায় শেয়ার ও লভ্যাংশ', englishLabel: 'Share & Dividend', desc: 'সদস্যদের শেয়ার মূলধন ও লভ্যাংশ হিসাব।', icon: ShieldCheck, active: true, color: 'bg-emerald-50 text-emerald-700 border-emerald-100 hover:border-emerald-500' },
                            { id: 'batch_defaulter_adjustment', label: 'সকল খেলাপির অটো ঋণ সমন্বয়', englishLabel: 'Batch Defaulter Settlement', desc: 'সকল খেলাপি সদস্যের সঞ্চয় হতে পর্যায়ক্রমিক লোন সমন্বয়।', icon: Zap, active: true, color: 'bg-rose-100 text-rose-800 border-rose-200 hover:border-rose-600' }
                          ].filter((card) => {
                            if (isBM && ['add_savings_account', 'add_cbs_account', 'add_lts_account'].includes(card.id)) {
                              return false;
                            }
                            return true;
                          }).map((card) => {
                            const IconComponent = card.icon;
                            const isGroupSelectRequired = ['member_transaction', 'loan_proposal', 'loan_disburse', 'realized_information'].includes(card.id);
                            return (
                              <button
                                key={card.id}
                                type="button"
                                onClick={() => {
                                  if (card.id === 'member_admission') {
                                    setActiveCardView('member_admission');
                                  } else if (card.id === 'member_information') {
                                    setActiveCardView('member_information');
                                  } else if (card.id === 'member_transaction') {
                                    if (!selectedGroupIdForSearch) {
                                      setAlertMsg({ type: 'error', text: 'দয়া করে প্রথমে একটি সমিতি / গ্রুপ নির্বাচন করুন!' });
                                    } else {
                                      setActiveCardView('member_transaction');
                                    }
                                  } else if (card.id === 'loan_proposal') {
                                    if (!selectedGroupIdForSearch) {
                                      setAlertMsg({ type: 'error', text: 'দয়া করে প্রথমে একটি সমিতি / গ্রুপ নির্বাচন করুন!' });
                                    } else {
                                      setActiveCardView('loan_proposal');
                                    }
                                  } else if (card.id === 'loan_disburse') {
                                    if (!selectedGroupIdForSearch) {
                                      setAlertMsg({ type: 'error', text: 'দয়া করে প্রথমে একটি সমিতি / গ্রুপ নির্বাচন করুন!' });
                                    } else {
                                      setActiveCardView('loan_disburse');
                                    }
                                  } else if (card.id === 'add_savings_account') {
                                    setActiveCardView('add_savings_account');
                                  } else if (card.id === 'add_cbs_account') {
                                    setActiveCardView('add_cbs_account');
                                  } else if (card.id === 'add_lts_account') {
                                    setActiveCardView('add_lts_account');
                                  } else if (card.id === 'member_balance') {
                                    setActiveCardView('member_balance');
                                  } else if (card.id === 'realized_information') {
                                    if (!selectedGroupIdForSearch) {
                                      setAlertMsg({ type: 'error', text: 'দয়া করে প্রথমে একটি সমিতি / গ্রুপ নির্বাচন করুন!' });
                                    } else {
                                      setActiveCardView('realized_information');
                                    }
                                  } else if (card.id === 'share_management') {
                                    setActiveCardView('share_management');
                                  } else if (card.id === 'batch_defaulter_adjustment') {
                                    setIsBatchDefaulterModalOpen(true);
                                  } else {
                                    setAlertMsg({ type: 'info', text: `"${card.label}" মডিউলটি পরবর্তীতে সক্রিয় করা হবে।` });
                                  }
                                }}
                                className="group relative flex flex-col justify-between p-5 bg-white hover:bg-slate-50 border border-slate-200 hover:border-[#2f6ce5]/50 hover:shadow-md rounded-2xl transition-all duration-200 text-left active:scale-[0.98] cursor-pointer shadow-3xs min-h-[160px]"
                              >
                                <div>
                                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-transform group-hover:scale-105 shadow-3xs ${card.color.split(' ')[0]} ${card.color.split(' ')[1]}`}>
                                    <IconComponent className="w-5 h-5 stroke-[2]" />
                                  </div>
                                  <div className="mt-3">
                                    <h4 className="font-extrabold text-slate-800 text-xs sm:text-sm tracking-tight leading-snug">{card.label}</h4>
                                    <span className="text-[9px] text-[#2f6ce5] font-black uppercase mt-0.5 block tracking-wider font-mono">{card.englishLabel}</span>
                                    <p className="text-[11px] text-slate-400 font-bold font-sans leading-snug mt-1.5 opacity-90">{card.desc}</p>
                                  </div>
                                </div>
                                
                                <div className="mt-4 flex items-center justify-between border-t border-slate-100/80 pt-2 w-full">
                                  {isGroupSelectRequired && !selectedGroupIdForSearch ? (
                                    <span className="text-[9px] text-amber-600 font-bold bg-amber-50 px-1.5 py-0.5 rounded border border-amber-100">সমিতি প্রয়োজন</span>
                                  ) : (
                                    <span className="text-[9px] text-emerald-600 font-bold bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100">প্রস্তুত</span>
                                  )}
                                  <span className="text-[10px] text-blue-600 font-extrabold flex items-center gap-0.5 group-hover:translate-x-1 transition-transform">
                                    চালু <ChevronRight size={10} />
                                  </span>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* SECTION: DOCUMENT CENTER */}
              {selectedOperation === 'document_center' && (
                <div className="space-y-6 animate-in fade-in">
                  <DocumentCenter
                    org={org}
                    staff={staff}
                    workingDay={workingDay}
                    branchMembers={groupMembers}
                    onClose={() => setSelectedOperation('menu')}
                  />
                </div>
              )}

              {/* SECTION: INTEREST ACCRUED PROVISION & POSTING */}
              {selectedOperation === 'interest_provision' && (
                <div className="space-y-6 animate-in fade-in">
                  <InterestProvisionPanel
                    org={org}
                    staff={staff}
                    workingDay={workingDay}
                    savingsAccounts={savingsAccounts}
                    cbsAccounts={cbsAccounts}
                    ltsAccounts={ltsAccounts}
                    groupMembers={groupMembers}
                    setSavingsAccounts={setSavingsAccounts}
                    setCbsAccounts={setCbsAccounts}
                    setLtsAccounts={setLtsAccounts}
                    setGroupMembers={setGroupMembers}
                    setTransactions={setTransactions}
                    onClose={() => setSelectedOperation('menu')}
                  />
                </div>
              )}

              {/* SECTION: FINANCIAL YEAR END CLOSING & LOCK */}
              {selectedOperation === 'year_end_closing' && (
                <div className="space-y-6 animate-in fade-in">
                  <YearEndClosingPanel
                    org={org}
                    staff={staff}
                    workingDay={workingDay}
                    transactions={transactions}
                    setTransactions={setTransactions}
                    onClose={() => setSelectedOperation('menu')}
                  />
                </div>
              )}

              {/* SECTION: MOVE GROUP (TRANSFER) */}
              {selectedOperation === 'move_group' && (
                <div id="bm_sub_move_group" className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 max-w-xl mx-auto max-sm:fixed max-sm:inset-0 max-sm:z-[100] max-sm:overflow-y-auto max-sm:bg-white max-sm:p-4 max-sm:rounded-none">
                  <div className="flex justify-between items-center border-b border-slate-100 pb-3 mb-4">
                    <h3 className="font-extrabold text-slate-800 text-sm flex items-center gap-1.5 font-sans">
                      <ArrowLeftRight size={16} className="text-[#2f6ce5]" />
                      গ্রুপ দায়িত্ব হস্তান্তর (Multi-Group Move)
                    </h3>
                    <button 
                      onClick={() => setSelectedOperation('menu')}
                      className="text-xs text-slate-400 hover:text-slate-600 font-bold flex items-center gap-1 cursor-pointer font-sans bg-transparent border-0"
                    >
                      <ArrowLeft size={12} /> অপারেশন মেনু
                    </button>
                  </div>

                  {branchGroups.length === 0 ? (
                    <div className="text-center py-6 text-slate-400">
                      <p className="text-xs font-semibold font-sans">হস্তান্তর করার মতো কোনো গ্রুপ বিদ্যমান নেই।</p>
                      <p className="text-[10px] text-slate-400 mt-1 font-sans">প্রথমে একটি গ্রুপ এড করুন।</p>
                    </div>
                  ) : (
                    <form onSubmit={handleMoveGroupAction} className="space-y-4 font-sans text-left">
                      {/* 1. Transfer Date */}
                      <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1">হস্তান্তর তারিখ (Transfer Date) *</label>
                        <input 
                          type="date"
                          className="w-full px-3 py-2 border border-slate-250 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 font-sans font-bold"
                          value={isSimulated ? moveGroupTransferDate : workingDay}
                          onChange={(e) => setMoveGroupTransferDate(e.target.value)}
                          disabled={!isSimulated}
                          required
                        />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {/* 2. Donor FO (Who gave / কে দিলো) */}
                        <div>
                          <label className="block text-xs font-bold text-slate-500 mb-1">কে দায়িত্ব হ্যান্ডওভার করলেন? (কে দিলো) *</label>
                          <select 
                            className="w-full px-3 py-2 border border-slate-250 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 font-sans"
                            value={moveGroupDonorId}
                            onChange={(e) => {
                              setMoveGroupDonorId(e.target.value);
                              setMoveGroupSelectedGroupIds([]); // Reset selection
                            }}
                            required
                          >
                            <option value="all">সবাই / সাধারণ পুল (All Staff)</option>
                            {branchStaff.map(s => (
                              <option key={s.id} value={s.staffId || s.id}>
                                {s.name} ({s.staffId || 'ILO'})
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* 3. Recipient FO (Who received / কে পেলো) */}
                        <div>
                          <label className="block text-xs font-bold text-slate-500 mb-1">নতুন কার দায়িত্বে স্থানান্তর করবেন? (কে পেলো) *</label>
                          <select 
                            className="w-full px-3 py-2 border border-slate-250 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 font-sans animate-in fade-in"
                            value={moveGroupDestinationStaffId}
                            onChange={(e) => setMoveGroupDestinationStaffId(e.target.value)}
                            required
                          >
                            <option value="">-- নতুন কর্মকর্তা নির্বাচন করুন --</option>
                            {branchStaff
                              .filter(s => s.staffId !== moveGroupDonorId && s.id !== moveGroupDonorId)
                              .map(s => (
                                <option key={s.id} value={s.staffId || s.id}>
                                  {s.name} ({s.staffId || 'ILO'}) {s.onLeave ? '[ছুটিতে]' : ''}
                                </option>
                              ))
                            }
                          </select>
                        </div>
                      </div>

                      {/* 4. Group List with Checkmarks (গ্রুপ লিস্ট চেকমার্ক ইত্যাদি) */}
                      <div>
                        <div className="flex justify-between items-center mb-1">
                          <label className="block text-xs font-extrabold text-slate-600">হস্তান্তরযোগ্য সমিতির তালিকা (গ্রুপ সমূহ) *</label>
                          <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-bold">
                            ফিল্টার করা মোট: {branchGroups.filter(g => moveGroupDonorId === 'all' || g.assignedStaffId === moveGroupDonorId).length} টি
                          </span>
                        </div>

                        {(() => {
                          const donorFilteredGroups = branchGroups.filter(g => moveGroupDonorId === 'all' || g.assignedStaffId === moveGroupDonorId);
                          
                          if (donorFilteredGroups.length === 0) {
                            return (
                              <div className="p-5 text-center rounded-xl bg-slate-50 border border-slate-200/50 text-slate-400 text-xs font-semibold">
                                এই কর্মকর্তার অধীনে স্থানান্তর করার মতো কোনো সক্রিয় গ্রুপ পাওয়া যায়নি।
                              </div>
                            );
                          }

                          return (
                            <div className="space-y-2">
                              {/* Select All Toggle */}
                              <div className="flex justify-between items-center text-xs font-extrabold text-slate-705 bg-slate-50 p-2.5 rounded-xl border border-slate-200/70">
                                <label className="flex items-center gap-2 cursor-pointer select-none">
                                  <input 
                                    type="checkbox"
                                    checked={donorFilteredGroups.length > 0 && moveGroupSelectedGroupIds.length === donorFilteredGroups.length}
                                    onChange={(e) => {
                                      if (e.target.checked) {
                                        setMoveGroupSelectedGroupIds(donorFilteredGroups.map(g => g.id));
                                      } else {
                                        setMoveGroupSelectedGroupIds([]);
                                      }
                                    }}
                                    className="rounded border-slate-300 text-[#2f6ce5] focus:ring-blue-500 h-4 w-4"
                                  />
                                  <span className="text-[#2f6ce5] font-black">সবগুলো গ্রুপ পছন্দ করুন (Select All)</span>
                                </label>
                                <span className="text-[11px] text-indigo-700 bg-indigo-50/80 px-2 py-0.5 rounded-md font-sans">
                                  নির্বাচিত: <b>{moveGroupSelectedGroupIds.length}</b> টি
                                </span>
                              </div>

                              {/* Scrollable Checklist */}
                              <div className="max-h-56 overflow-y-auto border border-slate-200 rounded-2xl divide-y divide-slate-100 p-2.5 bg-white shadow-inner">
                                {donorFilteredGroups.map(g => {
                                  const isChecked = moveGroupSelectedGroupIds.includes(g.id);
                                  const currentLO = staffList.find(s => s.staffId === g.assignedStaffId || s.id === g.assignedStaffId);
                                  const mCount = groupMembers.filter(m => m.groupId === g.id && m.status !== 'inactive').length;
                                  
                                  return (
                                    <label 
                                      key={g.id} 
                                      className={`flex items-center justify-between p-2.5 hover:bg-indigo-50/30 cursor-pointer select-none transition-colors rounded-xl ${
                                        isChecked ? 'bg-indigo-50/20' : ''
                                      }`}
                                    >
                                      <div className="flex items-center gap-3">
                                        <input 
                                          type="checkbox"
                                          checked={isChecked}
                                          onChange={() => {
                                            setMoveGroupSelectedGroupIds(prev => 
                                              isChecked 
                                                ? prev.filter(id => id !== g.id) 
                                                : [...prev, g.id]
                                            );
                                          }}
                                          className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                                        />
                                        <div className="text-left">
                                          <p className="text-xs font-black text-slate-800 leading-tight flex items-center gap-1.5">
                                            {g.name}
                                            <span className="text-[9px] bg-slate-100 px-1 py-0.5 rounded font-mono text-slate-500">{g.code}</span>
                                          </p>
                                          <p className="text-[9px] font-bold text-slate-400 mt-0.5">
                                            বার: <span className="text-slate-600 font-black">{g.meetingDay || 'মিটিং বার নেই'}</span> | গ্রাম: {g.village || 'অজ্ঞাত'}
                                          </p>
                                        </div>
                                      </div>

                                      <div className="text-right">
                                        <span className="text-[9px] font-extrabold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full inline-block">
                                          {mCount} জন সদস্য
                                        </span>
                                        <p className="text-[9px] text-slate-400 font-bold mt-0.5">
                                          বর্তমান দায়িত্ব: <span className="text-indigo-600 font-extrabold">{currentLO?.name || 'অনির্ধারিত'}</span>
                                        </p>
                                      </div>
                                    </label>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })()}
                      </div>

                      {/* 5. Bottom Buttons */}
                      <div className="flex gap-2.5 pt-3">
                        <button 
                          type="button" 
                          onClick={() => setSelectedOperation('menu')}
                          className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-150 text-slate-600 rounded-xl text-xs font-black transition cursor-pointer"
                        >
                          বাতিল করুন
                        </button>
                        <button 
                          type="submit" 
                          className="flex-1 py-2.5 bg-[#2f6ce5] hover:bg-blue-650 text-white font-black rounded-xl text-xs transition shadow-sm cursor-pointer"
                        >
                          দায়িত্ব হস্তান্তর নিশ্চিত করুন
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              )}

              {/* SECTION: CHART OF ACCOUNTS */}
              {selectedOperation === 'chart_of_accounts' && (
                <div id="bm_sub_chart_of_accounts" className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-6 max-w-4xl mx-auto animate-in fade-in duration-200">
                  <div className="flex justify-between items-center border-b border-slate-100 pb-3 mb-4">
                    <h3 className="font-extrabold text-slate-800 text-sm sm:text-base flex items-center gap-1.5 font-sans">
                      <BookOpen size={18} className="text-[#2f6ce5]" />
                      হিসাব খাতা ও জেনারেল জার্নাল
                    </h3>
                    <button 
                      onClick={() => setSelectedOperation('menu')}
                      className="text-xs text-slate-400 hover:text-slate-600 font-bold flex items-center gap-1 cursor-pointer font-sans"
                    >
                      <ArrowLeft size={12} /> অপারেশন মেনু
                    </button>
                  </div>

                  <div className="min-h-[550px] w-full">
                    <ChartOfAccountsView onReset={resetAccounting} balances={coaBalances} />
                  </div>
                </div>
              )}

              {/* SECTION: LOAN PROPOSAL REQUESTS */}
              {selectedOperation === 'loan_proposal_requests' && (
                <div id="bm_sub_loan_proposal_requests" className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 max-w-4xl mx-auto animate-in fade-in duration-200 max-sm:fixed max-sm:inset-0 max-sm:z-[100] max-sm:overflow-y-auto max-sm:bg-white max-sm:p-4 max-sm:rounded-none">
                  <div className="flex justify-between items-center border-b border-slate-100 pb-3 mb-4">
                    <h3 className="font-extrabold text-slate-800 text-sm sm:text-base flex items-center gap-1.5 font-sans">
                      <ClipboardList size={18} className="text-[#2f6ce5]" />
                      ঋণ প্রস্তাব অনুমোদন প্যানেল (Loan Proposals)
                    </h3>
                    <button 
                      onClick={() => setSelectedOperation('menu')}
                      className="text-xs text-slate-400 hover:text-slate-600 font-bold flex items-center gap-1 cursor-pointer font-sans"
                    >
                      <ArrowLeft size={12} /> অপারেশন মেনু
                    </button>
                  </div>

                  {loanProposals.length === 0 ? (
                    <div className="text-center py-12 text-slate-400 font-sans">
                      <ClipboardList className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                      <p className="text-xs font-black font-sans">কোনো ঋণ প্রস্তাব জমা দেওয়া হয়নি!</p>
                      <p className="text-[10px] text-slate-450 mt-1 font-medium font-sans">মাঠকর্মী প্রস্তাব পেশ করলে BM অনুমোদন দিতে পারেন।</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {/* Interactive Metrics Bar */}
                      <div className="grid grid-cols-3 gap-3 text-center font-sans">
                        <div className="bg-slate-50 border border-slate-200/80 p-2.5 rounded-xl">
                          <span className="text-[9px] text-amber-700 font-extrabold uppercase">অপেক্ষমাণ (Pending)</span>
                          <strong className="text-sm font-black text-slate-800 block mt-0.5 font-mono">
                            {loanProposals.filter((p: any) => p.status === 'pending').length} টি
                          </strong>
                        </div>
                        <div className="bg-emerald-50 border border-emerald-100 p-2.5 rounded-xl">
                          <span className="text-[9px] text-emerald-600 font-extrabold uppercase">অনুমোদিত (Approved)</span>
                          <strong className="text-sm font-black text-emerald-800 block mt-0.5 font-mono">
                            {loanProposals.filter((p: any) => p.status === 'approved').length} টি
                          </strong>
                        </div>
                        <div className="bg-sky-50 border border-sky-100 p-2.5 rounded-xl">
                          <span className="text-[9px] text-sky-600 font-extrabold uppercase">বিতরণকৃত (Disbursed)</span>
                          <strong className="text-sm font-black text-sky-800 block mt-0.5 font-mono">
                            {loanProposals.filter((p: any) => p.status === 'disbursed').length} টি
                          </strong>
                        </div>
                      </div>

                      {/* Proposals List Table */}
                      <div className="overflow-x-auto rounded-xl border border-slate-250">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="bg-slate-100/80 border-b border-slate-200 text-[10px] sm:text-xs text-slate-600 font-extrabold uppercase select-none font-sans">
                              <th className="px-3.5 py-2.5 font-bold font-sans">সদস্য তথ্য</th>
                              <th className="px-3 py-2.5 font-bold text-center font-sans">পরিমাণ ও কিস্তি</th>
                              <th className="px-3 py-2.5 font-bold font-sans">উদ্দেশ্য / তারিখ</th>
                              <th className="px-3 py-2.5 font-bold font-sans">দাখিলকারী</th>
                              <th className="px-3 py-2.5 font-bold text-center font-sans">স্ট্যাটাস</th>
                              <th className="px-3 py-2.5 font-bold text-right font-sans">কার্যক্রম</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-150">
                            {loanProposals.map((proposalObj: any) => {
                              const isPending = proposalObj.status === 'pending';
                              const isApproved = proposalObj.status === 'approved';
                              const isDisbursed = proposalObj.status === 'disbursed';

                              // Approve handler
                              const handleApprove = (proposalId: string, pDate: string) => {
                                if (pDate < workingDay) {
                                  alert("অতীতের প্রস্তাবনা অনুমোদন করা সম্ভব নয়!");
                                  return;
                                }
                                const updated = loanProposals.map((p) => {
                                  if (p.id === proposalId) {
                                    return { ...p, status: 'approved', approvedBy: staff.name, approvalDay: workingDay };
                                  }
                                  return p;
                                });
                                setLoanProposals(updated);
                                setAlertMsg({
                                  type: 'success',
                                  text: `ঋণ প্রস্তাবটি সফলভাবে অনুমোদন করা হয়েছে! এখন কর্মী এই ঋণ বিতরণ করতে পারবেন।`
                                });
                              };

                              // Decline/Reject handler
                              const handleReject = (proposalId: string, pDate: string) => {
                                if (pDate < workingDay) {
                                  alert("অতীতের প্রস্তাবনা বাতিল বা অপসারণ করা সম্ভব নয়!");
                                  return;
                                }
                                const updated = loanProposals.filter((p) => p.id !== proposalId);
                                setLoanProposals(updated);
                                setAlertMsg({
                                  type: 'info',
                                  text: `ঋণ প্রস্তাবটি বাতিল ও অপসারণ করা হয়েছে!`
                                });
                              };

                              return (
                                <tr key={proposalObj.id} className="text-xs sm:text-xs hover:bg-slate-50/50">
                                  {/* Member Info */}
                                  <td className="px-3.5 py-3 font-sans">
                                    <div className="font-bold text-slate-800">{proposalObj.memberName}</div>
                                    <div className="text-[10px] text-slate-500 font-mono mt-0.5">{proposalObj.memberIdText} · {proposalObj.groupName}</div>
                                  </td>

                                  {/* Amount & Installment details */}
                                  <td className="px-3 py-3 text-center">
                                    <div className="font-extrabold text-slate-800 font-mono">{proposalObj.amount} ৳</div>
                                    <div className="text-[9px] text-slate-500 font-semibold mt-0.5 font-mono">{proposalObj.installmentAmount}৳ × {proposalObj.installmentsCount} কিস্তি</div>
                                  </td>

                                  {/* Purpose & Date */}
                                  <td className="px-3 py-3 font-sans">
                                    <div className="font-semibold text-slate-700">{proposalObj.purpose}</div>
                                    <div className="text-[10px] text-slate-400 font-mono mt-0.5">{proposalObj.proposalDate}</div>
                                  </td>

                                  {/* Submitter */}
                                  <td className="px-3 py-3 text-slate-600 font-bold font-sans">
                                    {proposalObj.createdBy}
                                  </td>

                                  {/* Status */}
                                  <td className="px-3 py-3 text-center font-sans">
                                    {isPending && (
                                      <span className="px-2 py-0.5 rounded-full text-[9px] font-black tracking-wide text-amber-700 bg-amber-50 border border-amber-200">
                                        অপেক্ষমাণ (Pending)
                                      </span>
                                    )}
                                    {isApproved && (
                                      <span className="px-2 py-0.5 rounded-full text-[9px] font-black tracking-wide text-emerald-700 bg-emerald-50 border border-emerald-200">
                                        অনুমোদিত (Approved)
                                      </span>
                                    )}
                                    {isDisbursed && (
                                      <span className="px-2 py-0.5 rounded-full text-[9px] font-black tracking-wide text-sky-700 bg-sky-50 border border-sky-200 font-sans">
                                        বিতরণকৃত (Disbursed)
                                      </span>
                                    )}
                                  </td>

                                  {/* Action Buttons */}
                                  <td className="px-3 py-3 text-right">
                                    {isPending ? (
                                      <div className="flex gap-1.5 justify-end">
                                        <button
                                          type="button"
                                          onClick={() => handleApprove(proposalObj.id, proposalObj.proposalDate)}
                                          className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-[10px] px-2.5 py-1 rounded-lg shadow-2xs transition-all cursor-pointer font-sans"
                                        >
                                          অনুমোদন
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => handleReject(proposalObj.id, proposalObj.proposalDate)}
                                          className="bg-rose-50 hover:bg-rose-100 text-rose-700 font-extrabold text-[10px] px-2.5 py-1 rounded-lg border border-rose-200 transition-all cursor-pointer font-sans"
                                        >
                                          বাতিল
                                        </button>
                                      </div>
                                    ) : (
                                      <span className="text-[9px] text-slate-400 font-bold italic font-sans">সম্পন্ন</span>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* SECTION: EXEMPTION & LSRF REQUESTS */}
              {selectedOperation === 'exemption_requests' && (
                <div id="bm_sub_exemption_requests" className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-5 max-w-5xl mx-auto animate-in fade-in duration-200 max-sm:fixed max-sm:inset-0 max-sm:z-[100] max-sm:overflow-y-auto max-sm:bg-white max-sm:p-4 max-sm:rounded-none">
                  <div className="flex justify-between items-center border-b border-slate-100 pb-3 mb-4">
                    <h3 className="font-extrabold text-slate-800 text-sm sm:text-base flex items-center gap-1.5 font-sans">
                      <HandCoins size={18} className="text-[#2f6ce5]" />
                      ঋণ মওকুফ ও LSRF অনুমোদন প্যানেল (Waivers & LSRF)
                    </h3>
                    <button 
                      onClick={() => setSelectedOperation('menu')}
                      className="text-xs text-slate-400 hover:text-slate-600 font-bold flex items-center gap-1 cursor-pointer font-sans border-0 bg-transparent"
                    >
                      <ArrowLeft size={12} /> অপারেশন মেনু
                    </button>
                  </div>

                  {exemptionRequests.length === 0 ? (
                    <div className="text-center py-12">
                      <div className="w-16 h-16 bg-slate-50 text-slate-300 rounded-full flex items-center justify-center mx-auto mb-3">
                        <HandCoins size={32} />
                      </div>
                      <p className="text-sm font-bold text-slate-500 font-sans">কোন ঋণ মওকুফ বা LSRF দাবি আবেদন পাওয়া যায়নি।</p>
                      <p className="text-xs text-slate-400 mt-1">মাঠ কর্মিগণ লেনদেন আদায় ফর্মে মওকুফ চেক করলে আবেদন এখানে জমা হবে।</p>
                    </div>
                  ) : (
                    <div className="space-y-4 font-sans">
                      {/* STATS ROW */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-center">
                          <span className="text-[10px] font-bold text-slate-400 block uppercase font-sans">সর্বমোট আবেদন (Total)</span>
                          <strong className="text-lg font-black text-slate-700 block mt-0.5 font-mono">{exemptionRequests.length} টি</strong>
                        </div>
                        <div className="p-3 bg-amber-50 rounded-xl border border-amber-100 text-center">
                          <span className="text-[10px] font-bold text-amber-600 block uppercase font-sans">অপেক্ষমান (Pending)</span>
                          <strong className="text-lg font-black text-amber-700 block mt-0.5 font-mono">
                            {exemptionRequests.filter((r: any) => r.status === 'pending').length} টি
                          </strong>
                        </div>
                        <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-100 text-center">
                          <span className="text-[10px] font-bold text-emerald-600 block uppercase font-sans">অনুমোদিত (Approved)</span>
                          <strong className="text-lg font-black text-emerald-700 block mt-0.5 font-mono">
                            {exemptionRequests.filter((r: any) => r.status === 'approved').length} টি
                          </strong>
                        </div>
                        <div className="p-3 bg-rose-50 rounded-xl border border-rose-100 text-center">
                          <span className="text-[10px] font-bold text-rose-600 block uppercase font-sans">প্রত্যাখ্যাত (Rejected)</span>
                          <strong className="text-lg font-black text-rose-700 block mt-0.5 font-mono">
                            {exemptionRequests.filter((r: any) => r.status === 'rejected').length} টি
                          </strong>
                        </div>
                      </div>

                      {/* RESPONSIVE TABLE CONTAINER */}
                      <div className="overflow-x-auto rounded-xl border border-slate-200">
                        <table className="w-full text-left border-collapse text-xs">
                          <thead>
                            <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-extrabold uppercase">
                              <th className="px-3 py-3 font-semibold">আবেদনের তারিখ</th>
                              <th className="px-3 py-3 font-semibold">গ্রাহকের বিবরণ</th>
                              <th className="px-3 py-3 font-semibold">মওকুফ কারণ</th>
                              <th className="px-3 py-3 font-semibold">দাবিকৃত পরিমাণ (৳)</th>
                              <th className="px-3 py-3 font-semibold">আবেদনকারী</th>
                              <th className="px-3 py-3 font-semibold">অবস্থা (Status)</th>
                              <th className="px-3 py-3 text-right font-semibold">অ্যাকশন</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 text-slate-700">
                            {exemptionRequests.map((reqObj: any) => {
                              const isPending = reqObj.status === 'pending';
                              const isApproved = reqObj.status === 'approved';
                              const isRejected = reqObj.status === 'rejected';

                              const mapReasonLabel = (reason: string) => {
                                if (reason === 'member_death') return 'সদস্যের মৃত্যু (LSRF)';
                                if (reason === 'guardian_death') return 'অভিভাবকের মৃত্যু (LSRF)';
                                if (reason === 'special_waiver') return 'বিশেষ বিবেচনা মওকুফ';
                                return 'সাধারণ মওকুফ ছাড়';
                              };

                              return (
                                <tr key={reqObj.id} className="hover:bg-slate-50/50 transition-colors font-medium">
                                  <td className="px-3 py-3 whitespace-nowrap font-mono font-bold text-slate-500">
                                    {reqObj.requestDate}
                                  </td>
                                  <td className="px-3 py-3">
                                    <div className="font-extrabold text-slate-800">{reqObj.memberName}</div>
                                    <div className="text-[10px] text-slate-400 font-semibold font-mono mt-0.5">ID: {reqObj.memberId} | {reqObj.groupName}</div>
                                  </td>
                                  <td className="px-3 py-3 whitespace-nowrap">
                                    <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                                      reqObj.reason === 'member_death' || reqObj.reason === 'guardian_death'
                                        ? 'bg-red-50 text-red-700 border border-red-200'
                                        : 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                                    }`}>
                                      {mapReasonLabel(reqObj.reason)}
                                    </span>
                                  </td>
                                  <td className="px-3 py-3 whitespace-nowrap">
                                    {editingExemId === reqObj.id ? (
                                      <div className="flex items-center gap-1">
                                        <input
                                          type="number"
                                          value={editingExemAmount}
                                          onChange={(e) => setEditingExemAmount(e.target.value)}
                                          className="w-20 px-1.5 py-0.5 border border-slate-300 rounded font-mono font-bold text-xs"
                                        />
                                        <button
                                          onClick={() => handleSaveEditExemption(reqObj.id, Number(editingExemAmount))}
                                          className="bg-emerald-600 text-white px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer"
                                        >
                                          সেভ
                                        </button>
                                        <button
                                          onClick={() => setEditingExemId(null)}
                                          className="bg-slate-200 text-slate-600 px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer"
                                        >
                                          বাতিল
                                        </button>
                                      </div>
                                    ) : (
                                      <div className="flex items-center gap-1.5">
                                        <strong className="text-sm text-slate-800 font-extrabold font-mono">
                                          {reqObj.amount}৳
                                        </strong>
                                        {isPending && (
                                          <button
                                            type="button"
                                            onClick={() => {
                                              setEditingExemId(reqObj.id);
                                              setEditingExemAmount(String(reqObj.amount));
                                            }}
                                            className="text-[10px] text-blue-600 font-bold hover:underline bg-transparent border-0 p-0 cursor-pointer"
                                          >
                                            [সম্পাদনা]
                                          </button>
                                        )}
                                      </div>
                                    )}
                                  </td>
                                  <td className="px-3 py-3 whitespace-nowrap text-slate-500 font-semibold">
                                    {reqObj.requestedBy}
                                  </td>
                                  <td className="px-3 py-3 whitespace-nowrap">
                                    {isPending && (
                                      <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase text-amber-600 bg-amber-50 border border-amber-200">
                                        অপেক্ষমান (Pending)
                                      </span>
                                    )}
                                    {isApproved && (
                                      <div>
                                        <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase text-emerald-600 bg-emerald-50 border border-emerald-200">
                                          অনুমোদিত (Approved)
                                        </span>
                                        <div className="text-[8px] text-slate-400 mt-0.5 font-sans font-semibold">
                                          BM: {reqObj.resolvedBy} on {reqObj.resolvedDate}
                                        </div>
                                      </div>
                                    )}
                                    {isRejected && (
                                      <div>
                                        <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase text-rose-600 bg-rose-50 border border-rose-200">
                                          প্রত্যাখ্যাত (Rejected)
                                        </span>
                                        <div className="text-[8px] text-slate-400 mt-0.5 font-sans font-bold italic max-w-[125px] overflow-hidden text-ellipsis whitespace-nowrap" title={reqObj.rejectReason}>
                                          कारण: {reqObj.rejectReason}
                                        </div>
                                      </div>
                                    )}
                                  </td>

                                  {/* Action Buttons */}
                                  <td className="px-3 py-3 text-right whitespace-nowrap">
                                    {isPending ? (
                                      <div className="flex gap-1.5 justify-end">
                                        <button
                                          type="button"
                                          onClick={() => handleApproveExemption(reqObj.id)}
                                          className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-[10px] px-2.5 py-1 rounded-lg shadow-2xs transition-all cursor-pointer font-sans"
                                        >
                                          অনুমোদন (Approve)
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => handleRejectExemption(reqObj.id)}
                                          className="bg-rose-50 hover:bg-rose-100 text-rose-700 font-extrabold text-[10px] px-2.5 py-1 rounded-lg border border-rose-200 transition-all cursor-pointer font-sans"
                                        >
                                          বাতিল (Reject)
                                        </button>
                                      </div>
                                    ) : (
                                      <span className="text-[9px] text-slate-400 font-bold italic font-sans">সম্পন্ন</span>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* SECTION: MASTER ROLL */}
              {selectedOperation === 'master_roll' && (
                <div id="bm_sub_master_roll" className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-5 max-w-6xl mx-auto animate-in fade-in duration-200 max-sm:fixed max-sm:inset-0 max-sm:z-[100] max-sm:overflow-y-auto max-sm:bg-white max-sm:p-4 max-sm:rounded-none">
                  <div className="flex justify-between items-center border-b border-slate-100 pb-3 mb-4">
                    <h3 className="font-extrabold text-slate-800 text-sm sm:text-base flex items-center gap-1.5 font-sans">
                      <FileText size={18} className="text-[#2f6ce5]" />
                      শাখা মাস্টার রোল (Master Roll Overview)
                    </h3>
                    <button 
                      onClick={() => setSelectedOperation('menu')}
                      className="text-xs text-slate-400 hover:text-slate-600 font-bold flex items-center gap-1 cursor-pointer font-sans border-0 bg-transparent"
                    >
                      <ArrowLeft size={12} /> অপারেশন মেনু
                    </button>
                  </div>
                  <MasterRollView 
                    org={org} 
                    staffList={staffList} 
                    branchesList={branchesList} 
                    loanProposals={loanProposals} 
                    setLoanProposals={setLoanProposals}
                    groupMembers={groupMembers}
                    setGroupMembers={setGroupMembers}
                    forceBranchId={staff.branchId}
                  />
                </div>
              )}

              {/* SECTION: SAVINGS REFUND AND ADJUSTMENT APPROVAL */}
              {selectedOperation === 'savings_refund_and_adjustment' && (
                <div id="bm_sub_savings_refund_and_adjustment" className="max-w-6xl mx-auto animate-in fade-in duration-200 max-sm:fixed max-sm:inset-0 max-sm:z-[100] max-sm:overflow-y-auto max-sm:bg-white max-sm:p-4 max-sm:rounded-none">
                  <div className="flex justify-between items-center bg-white rounded-t-2xl border-t border-x border-slate-200 p-4 font-sans">
                    <h3 className="font-extrabold text-slate-800 text-sm sm:text-base flex items-center gap-1.5">
                      <ArrowLeftRight size={18} className="text-blue-600 animate-pulse" />
                      সঞ্চয় ফেরত ও ঋণ সমন্বয়
                    </h3>
                    <button 
                      onClick={() => setSelectedOperation('menu')}
                      className="text-xs text-[#2f6ce5] hover:text-blue-800 font-extrabold flex items-center gap-1 cursor-pointer border-0 bg-transparent"
                    >
                      <ArrowLeft size={12} /> অপারেশন মেনু
                    </button>
                  </div>
                  <RealizedInformationView
                    onBack={() => setSelectedOperation('menu')}
                    branchGroups={branchGroups}
                    groupMembers={groupMembers}
                    workingDay={workingDay}
                    transactions={transactions}
                    staff={staff}
                    branchName={currentBranch?.name || 'HO'}
                    onUpdateMembers={setGroupMembers}
                    onUpdateSavingsAccounts={setSavingsAccounts}
                    onUpdateTransactions={setTransactions}
                    savingsAccounts={savingsAccounts}
                    mode={isBM ? undefined : 'refund'}
                  />
                </div>
              )}

              {/* SECTION: TRANSACTION SUMMARY */}
              {selectedOperation === 'transaction_summary' && (
                <div id="bm_sub_transaction_summary" className="max-w-6xl mx-auto animate-in fade-in duration-200 max-sm:fixed max-sm:inset-0 max-sm:z-[100] max-sm:overflow-y-auto max-sm:bg-white max-sm:p-4 max-sm:rounded-none">
                  <div className="flex justify-between items-center bg-white rounded-t-2xl border-t border-x border-slate-200 p-4 font-sans">
                    <h3 className="font-extrabold text-slate-800 text-sm sm:text-base flex items-center gap-1.5">
                      <BookOpen size={18} className="text-emerald-600 animate-pulse" />
                      লেনদেন সামারী
                    </h3>
                    <button 
                      onClick={() => setSelectedOperation('menu')}
                      className="text-xs text-[#2f6ce5] hover:text-blue-800 font-extrabold flex items-center gap-1 cursor-pointer border-0 bg-transparent"
                    >
                      <ArrowLeft size={12} /> অপারেশন মেনু
                    </button>
                  </div>
                  <TransactionSummaryView
                    onBack={() => setSelectedOperation('menu')}
                    transactions={transactions}
                    branchGroups={branchGroups}
                    groupMembers={groupMembers}
                    workingDay={workingDay}
                    staffList={staffList}
                  />
                </div>
              )}

            </div>
          ) : (
            <>
              {/* 2. REGULAR BM VIEWS (HOME, DASHBOARD, HRM, ACCOUNT) */}

              {/* CENTRAL HOME LAUNCHER MENU */}
              {activeTab === 'home' && (
                <div className="space-y-6 animate-in fade-in duration-205">
                  <PwaInstallBanner />


                  {/* ACTION GRID MODULES */}
                  <div>
                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-wider mb-3.5 font-sans">শাখার মডিউল ও অপশনসমূহ</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                      
                      {/* CARD 1: DASHBOARD */}
                      <button
                        onClick={() => setActiveTab('dashboard')}
                        className="p-5 bg-white hover:bg-slate-50 border border-slate-200 hover:border-blue-500 rounded-2xl shadow-3xs text-left transition duration-205 cursor-pointer group flex flex-col justify-between min-h-[160px]"
                      >
                        <div>
                          <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
                            <LayoutDashboard size={20} />
                          </div>
                          <h4 className="font-extrabold text-slate-800 text-sm font-sans">শাখা বিবরণী ও ড্যাশবোর্ড</h4>
                          <p className="text-[11px] text-slate-400 mt-1 font-medium leading-relaxed font-sans">শাখার সচল অবস্থা, কর্মকর্তা এবং নীতিগত নির্দেশাবলী মনিটর করুন।</p>
                        </div>
                        <span className="text-[10px] text-[#2f6ce5] font-black block mt-3 underline group-hover:text-blue-705">ড্যাশবোর্ডে যান →</span>
                      </button>

                      {/* CARD 2: HRM */}
                      {isBM && (
                        <button
                          onClick={() => setActiveTab('hrm')}
                          className="p-5 bg-white hover:bg-slate-50 border border-slate-200 hover:border-emerald-500 rounded-2xl shadow-3xs text-left transition duration-200 cursor-pointer group flex flex-col justify-between min-h-[160px]"
                        >
                          <div>
                            <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
                              <Users size={20} />
                            </div>
                            <h4 className="font-extrabold text-slate-800 text-sm font-sans">এইচআরএম ও কর্মী নিয়ন্ত্রণ</h4>
                            <p className="text-[11px] text-slate-400 mt-1 font-medium leading-relaxed font-sans">মাঠকর্মী ও কর্মকর্তাদের তালিকা, ছুটি আবেদন এবং হাজিরা পরিবর্তন।</p>
                          </div>
                          <span className="text-[10px] text-emerald-600 font-extrabold block mt-3 underline group-hover:text-emerald-705">এইচআরএম প্যানেলে যান →</span>
                        </button>
                      )}

                      {/* CARD 3: ACCOUNT & LEDGER */}
                      {isBM && (
                        <button
                          onClick={() => setActiveTab('account')}
                          className="p-5 bg-white hover:bg-slate-50 border border-slate-200 hover:border-indigo-500 rounded-2xl shadow-3xs text-left transition duration-200 cursor-pointer group flex flex-col justify-between min-h-[160px]"
                        >
                          <div>
                            <div className="w-10 h-10 bg-indigo-50 text-indigo-700 rounded-xl flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
                              <CreditCard size={20} />
                            </div>
                            <h4 className="font-extrabold text-slate-800 text-sm font-sans">হিসাব ও সাধারণ খতিয়ান</h4>
                            <p className="text-[11px] text-slate-400 mt-1 font-medium leading-relaxed font-sans">ডাবল এন্ট্রি ভাউচার পোস্টিং, ক্যাশ বুক ক্যাশিন, অল লেজার খতিয়ান।</p>
                          </div>
                          <span className="text-[10px] text-indigo-600 font-extrabold block mt-3 underline group-hover:text-indigo-705 font-sans">লেজার বুক খুলুন →</span>
                        </button>
                      )}

                      {/* CARD 4: HOLIDAYS */}
                      {isBM && (
                        <button
                          onClick={() => setActiveTab('holidays')}
                          className="p-5 bg-white hover:bg-slate-50 border border-slate-200 hover:border-amber-500 rounded-2xl shadow-3xs text-left transition duration-200 cursor-pointer group flex flex-col justify-between min-h-[160px]"
                        >
                          <div>
                            <div className="w-10 h-10 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
                              <Calendar size={20} />
                            </div>
                            <h4 className="font-extrabold text-slate-800 text-sm font-sans">শাখা ছুটি ক্যালেন্ডার</h4>
                            <p className="text-[11px] text-slate-400 mt-1 font-medium leading-relaxed font-sans">শাখার কাজের দিন নির্ধারণ এবং ছুটি ক্যালেন্ডার ও বিশেষ দিন কনফিগার।</p>
                          </div>
                          <span className="text-[10px] text-amber-600 font-extrabold block mt-3 underline group-hover:text-amber-705 font-sans">ছুটি তালিকা দেখুন →</span>
                        </button>
                      )}

                      {/* CARD 5: OPERATIONS */}
                      <button
                        onClick={() => { 
                          setIsFullScreenOperation(true); 
                          setSelectedOperation('menu'); 
                        }}
                        className="p-5 bg-gradient-to-br from-amber-500/5 to-orange-500/5 hover:from-amber-500/10 hover:to-orange-500/10 border border-amber-200 hover:border-amber-500 rounded-2xl shadow-3xs text-left transition duration-200 cursor-pointer group flex flex-col justify-between min-h-[160px]"
                      >
                        <div>
                          <div className="w-10 h-10 bg-amber-100 text-amber-700 rounded-xl flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
                            <Layers size={20} />
                          </div>
                          <h4 className="font-extrabold text-slate-800 text-sm text-amber-900 font-sans">শাখা মাঠ অপারেশন প্যানেল</h4>
                          <p className="text-[11px] text-amber-850 bg-amber-500/5 p-1 rounded mt-1 font-medium leading-relaxed font-sans">ব্রাঞ্চ গ্রুপ, সঞ্চয় সংগ্রহ, ঋণ অনুমোদন, আদায় বিতরণ ও লাইভ মনিটর।</p>
                        </div>
                        <span className="text-[10px] text-amber-700 font-extrabold block mt-3 underline group-hover:text-amber-805 font-sans">মাঠ কার্যক্রম পরিচালনা করুন →</span>
                      </button>

                      {/* CARD 6: REPORTS */}
                      <button
                        onClick={() => setActiveTab('reports')}
                        className="p-5 bg-gradient-to-br from-blue-500/5 to-indigo-500/5 hover:from-blue-500/10 hover:to-indigo-500/10 border border-indigo-200 hover:border-indigo-500 rounded-2xl shadow-3xs text-left transition duration-200 cursor-pointer group flex flex-col justify-between min-h-[160px]"
                      >
                        <div>
                          <div className="w-10 h-10 bg-indigo-100 text-indigo-700 rounded-xl flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
                            <FileText size={20} />
                          </div>
                          <h4 className="font-extrabold text-slate-800 text-sm font-sans">প্রতিবেদন ও রিপোর্টস হাব</h4>
                          <p className="text-[11px] text-slate-400 mt-1 font-medium leading-relaxed font-sans">শাখার আদায়, ঋণ বিতরণ এবং সঞ্চয়ের তারিখ ভিত্তিক সমন্বিত প্রিন্ট ও এক্সেল রিপোর্টস।</p>
                        </div>
                        <span className="text-[10px] text-indigo-700 font-extrabold block mt-3 underline group-hover:text-indigo-805 font-sans">রিপোর্টস হাব খুলুন →</span>
                      </button>

                    </div>
                  </div>

                </div>
              )}

              {/* TABS 1: DASHBOARD VIEW */}
              {activeTab === 'dashboard' && (
                <div id="bm_viewport_dashboard" className="space-y-6 animate-in fade-in duration-100 max-sm:fixed max-sm:inset-0 max-sm:z-[100] max-sm:overflow-y-auto max-sm:bg-white max-sm:p-4 max-sm:rounded-none">
                  
                  {/* Back button */}
                  <div className="pb-1">
                    <button
                      onClick={() => setActiveTab('home')}
                      className="inline-flex items-center gap-1 px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold hover:text-slate-900 rounded-lg text-[10.5px] border border-slate-200 cursor-pointer transition"
                    >
                      <ChevronLeft size={13} />
                      <span>← মূল মেনুতে ফিরুন</span>
                    </button>
                  </div>
                  
                  {/* Branch Brief Banner */}
                  <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                      <h2 className="text-lg font-black text-slate-800">শাখা বিবরণী ড্যাশবোর্ড (Branch Overview)</h2>
                      <p className="text-xs text-slate-500 font-medium mt-0.5">আপনার ব্রাঞ্চ অফিসের সকল কর্মকান্ড এবং কর্মীবাহিনীর অবস্থা পর্যবেক্ষণ করুন।</p>
                    </div>
                    <div className="bg-emerald-50 border border-emerald-100 text-emerald-800 rounded-xl py-1 px-3 text-xs font-extrabold flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                      <span>শাখা সচল রয়েছে</span>
                    </div>
                  </div>

                  {/* STATISTICAL ROW */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    
                    {/* STAT A: Total Staff */}
                    <div className="bg-white rounded-2xl border border-slate-202 border-slate-200 p-4.5 space-y-2 relative overflow-hidden group">
                      <span className="p-2 bg-slate-150 bg-slate-100 rounded-lg inline-block text-slate-700">
                        <Users size={16} />
                      </span>
                      <p className="text-[11px] text-slate-500 font-bold block">মোট কর্মকর্তা ও কর্মী</p>
                      <p className="text-2xl font-black text-slate-850 text-slate-800">{totalStaffCount} জন</p>
                    </div>

                    {/* STAT B: Total Group */}
                    <div className="bg-white rounded-2xl border border-slate-200 p-4.5 space-y-2 relative overflow-hidden group">
                      <span className="p-2 bg-slate-100 text-slate-700 rounded-lg inline-block">
                        <Layers size={16} />
                      </span>
                      <p className="text-[11px] text-slate-500 font-bold block">মোট সঞ্চয়ী ও ঋণ গ্রুপ</p>
                      <p className="text-2xl font-black text-slate-800">{totalGroupsCount} টি</p>
                    </div>

                    {/* STAT C: Active Staff */}
                    <div className="bg-white rounded-2xl border border-slate-200 p-4.5 space-y-2 relative overflow-hidden group">
                      <span className="p-2 bg-emerald-50 text-emerald-700 rounded-lg inline-block">
                        <UserCheck size={16} />
                      </span>
                      <p className="text-[11px] text-slate-400 text-slate-500 font-bold block">কর্মরত মাঠ কর্মী (Active)</p>
                      <p className="text-2xl font-black text-emerald-600">{activeStaffCount} জন</p>
                    </div>

                    {/* STAT D: On Leave Staff */}
                    <div className="bg-white rounded-2xl border border-slate-200 p-4.5 space-y-2 relative overflow-hidden group">
                      <span className="p-2 bg-rose-50 text-rose-700 rounded-lg inline-block">
                        <UserX size={16} />
                      </span>
                      <p className="text-[11px] text-slate-500 font-bold block">ছুটিতে আছেন (On Leave)</p>
                      <p className="text-2xl font-black text-rose-600">{staffOnLeaveCount} জন</p>
                    </div>

                  </div>

                  {/* SECTION: OPERATIONAL & FIELD STATISTICS */}
                  <div className="space-y-3.5 bg-slate-50/50 p-4 rounded-3xl border border-slate-100 shadow-3xs">
                    <div className="flex justify-between items-center border-b border-slate-200/60 pb-2 mb-2">
                      <h3 className="font-extrabold text-[#1e293b] text-xs sm:text-sm flex items-center gap-1.5 font-sans uppercase tracking-wide">
                        <Coins size={16} className="text-[#2f6ce5]" />
                        মাঠ কার্যক্রম ও আর্থিক সূচক {isBM ? '(শাখা ভিত্তিক সর্বমোট)' : '(আপনার অ্যাসাইনকৃত গ্রুপ ভিত্তিক)'}
                      </h3>
                      <span className="text-[9.5px] bg-[#2f6ce5]/10 text-[#2f6ce5] font-black px-2.5 py-1 rounded-full uppercase tracking-wider font-sans">
                        রোল: {isBM ? 'শাখা ব্যবস্থাপক' : 'মাঠ কর্মী (FO)'}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                      
                      {/* CARD 1: Active Member Count */}
                      <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-2 relative overflow-hidden group shadow-3xs hover:border-emerald-300 transition-all duration-200">
                        <div className="flex justify-between items-start">
                          <span className="p-2 bg-emerald-50 text-emerald-600 rounded-xl inline-block">
                            <UserCheck size={18} />
                          </span>
                          <span className="text-[8.5px] font-black bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded font-sans uppercase">সক্রিয়</span>
                        </div>
                        <div>
                          <p className="text-[10px] text-slate-500 font-bold block">এক্টিভ সদস্য সংখ্যা</p>
                          <p className="text-xl font-black text-slate-850 text-slate-800 tracking-tight mt-0.5">{activeMembersCount} জন</p>
                          <p className="text-[9px] text-slate-400 font-bold mt-1.5 flex items-center gap-1">
                            <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                            ফিল্ড কাভারেজ সচল
                          </p>
                        </div>
                      </div>

                      {/* CARD 2: Debtor Member Count */}
                      <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-2 relative overflow-hidden group shadow-3xs hover:border-blue-300 transition-all duration-200">
                        <div className="flex justify-between items-start">
                          <span className="p-2 bg-blue-50 text-blue-600 rounded-xl inline-block">
                            <HandCoins size={18} />
                          </span>
                          <span className="text-[8.5px] font-black bg-blue-50 text-blue-700 px-2 py-0.5 rounded font-sans uppercase">ঋণগ্রহীতা</span>
                        </div>
                        <div>
                          <p className="text-[10px] text-slate-500 font-bold block">ঋণী সদস্য সংখ্যা</p>
                          <p className="text-xl font-black text-slate-850 text-slate-800 tracking-tight mt-0.5">{debtorMembersCount} জন</p>
                          <p className="text-[9px] text-slate-400 font-bold mt-1.5">
                            অনুপাত: {Math.round((debtorMembersCount / (activeMembersCount || 1)) * 100)}% কার্যক্রমে
                          </p>
                        </div>
                      </div>

                      {/* CARD 3: Loans Outstanding (Loan Status) */}
                      <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-2 relative overflow-hidden group shadow-3xs hover:border-indigo-300 transition-all duration-200">
                        <div className="flex justify-between items-start">
                          <span className="p-2 bg-indigo-50 text-indigo-600 rounded-xl inline-block">
                            <Banknote size={18} />
                          </span>
                          <span className="text-[8.5px] font-black bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded font-sans uppercase">স্থিতি</span>
                        </div>
                        <div>
                          <p className="text-[10px] text-slate-500 font-bold block">ঋণের স্থিতি (Outstanding)</p>
                          <p className="text-xl font-black text-[#2f6ce5] tracking-tight mt-0.5">৳ {loansOutstanding.toLocaleString('bn-BD')}</p>
                          <p className="text-[9px] text-slate-400 font-semibold mt-1.5">চলতি আদায়যোগ্য স্থিতি</p>
                        </div>
                      </div>

                      {/* CARD 4: Defaulters Count & Amount */}
                      <div className="bg-rose-50/40 rounded-2xl border border-rose-100 p-4 space-y-2 relative overflow-hidden group shadow-3xs hover:border-rose-300 transition-all duration-200">
                        <div className="flex justify-between items-start">
                          <span className="p-2 bg-rose-100/60 text-rose-700 rounded-xl inline-block">
                            <AlertCircle size={18} className="text-rose-600" />
                          </span>
                          <span className="text-[8.5px] font-black bg-rose-100 text-rose-700 px-2 py-0.5 rounded font-sans uppercase">খেলাপী</span>
                        </div>
                        <div>
                          <p className="text-[10px] text-slate-600 font-bold block">খেলাপী জন ও টাকা</p>
                          <div className="flex items-baseline gap-1 mt-0.5 flex-wrap">
                            <span className="text-xl font-black text-rose-700">{defaultersCount} / ৳ {defaultersAmount.toLocaleString('bn-BD')}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => setIsBatchDefaulterModalOpen(true)}
                            className="mt-2 w-full text-[9.5px] font-extrabold bg-rose-600 hover:bg-rose-700 text-white px-2 py-1.5 rounded-lg shadow-3xs flex items-center justify-center gap-1 transition-all cursor-pointer active:scale-95"
                          >
                            <Zap size={12} /> সকল খেলাপির অটো লোন সমন্বয়
                          </button>
                        </div>
                      </div>

                      {/* CARD 5: Absconding Member Count and Money */}
                      <div className="bg-red-50/40 rounded-2xl border border-red-105 p-4 space-y-2 relative overflow-hidden group shadow-3xs hover:border-red-300 transition-all duration-200">
                        <div className="flex justify-between items-start">
                          <span className="p-2 bg-red-100/60 text-red-700 rounded-xl inline-block">
                            <UserX size={18} className="text-red-600" />
                          </span>
                          <span className="text-[8.5px] font-black bg-red-100 text-red-700 px-2 py-0.5 rounded font-sans uppercase">পালাতক</span>
                        </div>
                        <div>
                          <p className="text-[10px] text-slate-600 font-bold block">পালাতক সদস্য সংখ্যা ও টাকা</p>
                          <div className="flex items-baseline gap-1 mt-0.5 flex-wrap">
                            <span className="text-xl font-black text-red-700">{abscondedCount} / ৳ {abscondedAmount.toLocaleString('bn-BD')}</span>
                          </div>
                          <p className="text-[9px] text-red-500 font-bold mt-1.5">সালিশি তদারকি সচল</p>
                        </div>
                      </div>

                      {/* CARD 6: Day Defaulter of Current Month */}
                      <div className="bg-amber-50/40 rounded-2xl border border-amber-100 p-4 space-y-2 relative overflow-hidden group shadow-3xs hover:border-amber-300 transition-all duration-200">
                        <div className="flex justify-between items-start">
                          <span className="p-2 bg-amber-100 text-amber-800 rounded-xl inline-block">
                            <CalendarRange size={18} className="text-amber-700" />
                          </span>
                          <span className="text-[8.5px] font-black bg-amber-100/85 text-amber-850 px-2 py-0.5 rounded font-sans uppercase">চলতি মাস</span>
                        </div>
                        <div>
                          <p className="text-[10px] text-slate-600 font-bold block">চলতি মাসে ডে খেলাপি</p>
                          <div className="flex items-baseline gap-1 mt-0.5 flex-wrap">
                            <span className="text-xl font-black text-amber-800">{currentMonthDefaultersCount} / ৳ {currentMonthDefaultersAmount.toLocaleString('bn-BD')}</span>
                          </div>
                          <p className="text-[9px] text-amber-600 font-bold mt-1.5">সঞ্চয় দ্বারা সমন্বয়যোগ্য</p>
                        </div>
                      </div>

                      {/* CARD 7: Ongoing Project Count and Info */}
                      <div className="bg-slate-100/60 rounded-2xl border border-slate-200 p-4 space-y-2 relative overflow-hidden group shadow-3xs col-span-1 sm:col-span-2 hover:border-slate-350 transition-all duration-200">
                        <div className="flex justify-between items-start">
                          <span className="p-2 bg-slate-200 text-slate-700 rounded-xl inline-block">
                            <ClipboardList size={18} />
                          </span>
                          <span className="text-[8.5px] font-black bg-slate-200 text-slate-800 px-2.5 py-0.5 rounded font-sans uppercase">পিকেএসএফ অনুমোদিত</span>
                        </div>
                        <div className="grid grid-cols-1 xs:grid-cols-2 gap-2">
                          <div>
                            <p className="text-[10px] text-slate-500 font-bold block">চলমান প্রজেক্ট সংখ্যা</p>
                            <p className="text-lg font-black text-slate-800 tracking-tight mt-0.5">{ongoingProjectsCount} টি প্রজেক্টস</p>
                          </div>
                        </div>
                      </div>

                    </div>
                  </div>

                  {/* BRANCH POLICIES & QUICK LINKS */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    
                    {/* Panel 1: Branch Details information */}
                    <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3.5">
                      <h3 className="font-extrabold text-slate-800 text-sm border-b border-indigo-50 pb-2.5 flex items-center gap-1.5">
                        <BookOpen size={16} className="text-emerald-500" />
                        শাখা নিয়ন্ত্রণ ও কর্মপরিধি
                      </h3>
                      <div className="space-y-2.5 text-xs">
                        <div className="flex justify-between py-1 border-b border-slate-50">
                          <span className="text-slate-500">শাখার নাম:</span>
                          <span className="font-bold text-slate-800">হেড অফিস ও প্রধান নিয়ন্ত্রণ শাখা</span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-slate-50">
                          <span className="text-slate-500">অনলাইন পোর্টাল আইডি:</span>
                          <span className="font-mono font-bold text-emerald-600">{staff.branchId || 'MAIN-HO'}</span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-slate-50">
                          <span className="text-slate-500">নিবন্ধিত মোবাইল:</span>
                          <span className="font-bold text-slate-800">{staff.phone}</span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-slate-50">
                          <span className="text-slate-500">দ্বায়িত্বরত প্রধান ব্যবস্থাপক:</span>
                          <span className="font-bold text-emerald-700 underline">{staff.name}</span>
                        </div>
                      </div>
                    </div>

                    {/* Panel 2: ILO stand-by mechanism info */}
                    <div className="bg-gradient-to-br from-indigo-50 to-emerald-50 rounded-2xl border border-slate-200 p-5 space-y-2">
                      <h4 className="font-black text-slate-850 text-slate-850 text-slate-800 text-xs sm:text-sm flex items-center gap-1.5">
                        <ShieldAlert size={16} className="text-indigo-600 shrink-0" />
                        স্ট্যান্ড-বাই ছুটি স্থানান্তর নীতি (ILO AO)
                      </h4>
                      <p className="text-[11px] text-slate-600 leading-relaxed font-semibold">
                        সিস্টেমের নির্ভরযোগ্যতার স্বার্থে আপনার ব্রাঞ্চে একজন ডিফল্ট কর্মকর্তা <span className="font-bold text-indigo-700">"ILO" (আইডি: ILO, পাসওয়ার্ড: 12345)</span> স্বয়ংক্রিয়ভাবে বহাল থাকে।
                      </p>
                      <p className="text-[11.5px] text-slate-505 text-emerald-800 leading-relaxed font-bold">
                        যখনই আপনি কোনো মাঠ কর্মীকে এইচআরএম (HRM) থেকে ছুটিতে পাঠান, ওই কর্মকর্তার অধীনে চালিত সকল গ্রুপ ও সমিতির দৈনিক আদায় প্রক্রিয়া ব্যাহত হওয়া এড়াতে তাৎক্ষণিকভাবে ILO কর্মকর্তাতে স্থানান্তর করা হয়।
                      </p>
                    </div>

                  </div>
                </div>
              )}

              {/* TABS 2: HRM (STAFF OPERATIONS AND LEAVES) */}
              {activeTab === 'hrm' && (
                <div id="bm_viewport_hrm" className="space-y-6 animate-in fade-in duration-100 max-sm:fixed max-sm:inset-0 max-sm:z-[100] max-sm:overflow-y-auto max-sm:bg-white max-sm:p-4 max-sm:rounded-none">
                  
                  {/* Back button */}
                  <div className="pb-1">
                    <button
                      onClick={() => setActiveTab('home')}
                      className="inline-flex items-center gap-1 px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold hover:text-slate-900 rounded-lg text-[10.5px] border border-slate-200 cursor-pointer transition"
                    >
                      <ChevronLeft size={13} />
                      <span>← মূল মেনুতে ফিরুন</span>
                    </button>
                  </div>
                  
                  {/* HRM Action Header */}
                  <div className="flex justify-between items-center flex-wrap gap-4 border-b border-slate-100 pb-4">
                    <div>
                      <h2 className="text-lg font-extrabold text-slate-800 tracking-tight flex items-center gap-2">
                        <Users size={20} className="text-emerald-600" />
                        শাখা মানবসম্পদ প্যানেল (Branch HRM)
                      </h2>
                      <p className="text-xs text-slate-505 text-slate-500 font-semibold">
                        ব্রাঞ্চে নিয়োজিত কর্মকর্তাদের তথ্য সম্পাদন, নতুন নিয়োগ এবং ছুটিতে যাওয়া নিয়ন্ত্রণ করুন।
                      </p>
                    </div>
                    <button
                      id="bm_hrm_add_staff_btn"
                      onClick={() => {
                        setIsStaffEditMode(false);
                        setEditingStaffId(null);
                        setStaffNameInput('');
                        setStaffPhoneInput('');
                        setStaffDesignationInput('মাঠ কর্মী');
                        setIsStaffModalOpen(true);
                      }}
                      className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer shadow-xs transition active:scale-95"
                    >
                      <Plus size={15} />
                      <span>নতুন কর্মী যুক্ত করুন</span>
                    </button>
                  </div>

                  {/* HRM STAT CARDS */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-4 flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                        <Users size={18} />
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-400 font-bold block font-sans">নিযুক্ত মোট কর্মী</p>
                        <h5 className="text-base font-black text-slate-800">{branchStaff.length} জন</h5>
                      </div>
                    </div>

                    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-4 flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                        <UserCheck size={18} />
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-400 font-bold block font-sans">কর্মরত মাঠ কর্মী</p>
                        <h5 className="text-base font-black text-slate-800">{activeStaffCount} জন</h5>
                      </div>
                    </div>

                    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-4 flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center font-bold">
                        <UserX size={18} />
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-400 font-bold block font-sans">ছুটিতে আছেন</p>
                        <h5 className="text-base font-black text-slate-800">{staffOnLeaveCount} জন</h5>
                      </div>
                    </div>

                    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-4 flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
                        <Calendar size={18} />
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-400 font-bold block font-sans">মোট ছুটির রেকর্ড</p>
                        <h5 className="text-base font-black text-slate-800">{holidays.length} দিন</h5>
                      </div>
                    </div>
                  </div>

                  {/* STAFF DATATABLE / LIST */}
                  <div className="bg-white rounded-2xl border border-slate-200/85 p-5 space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                      <div>
                        <h4 className="font-extrabold text-slate-800 text-sm">কর্মকর্তা ও মাঠ কর্মী তালিকা (Staff List)</h4>
                        <p className="text-[10px] text-slate-400">এই কার্যালয়ের অধীনে নিয়োজিত সকল কর্মকর্তাদের পাসওয়ার্ড ও স্ট্যাটাস তথ্য</p>
                      </div>
                    </div>

                    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="bg-slate-50 text-slate-500 text-[10px] sm:text-xs font-bold uppercase tracking-wider border-b border-slate-150">
                              <th className="py-3.5 px-4">নাম ও ফোন</th>
                              <th className="py-3.5 px-4">পদবি ও যোগদানের তারিখ</th>
                              <th className="py-3.5 px-4">ইউনিক আইডি ও পাসওয়ার্ড</th>
                              <th className="py-3.5 px-4 font-center">ছুটি ও অবস্থা</th>
                              <th className="py-3.5 px-4 text-right">কার্যক্রম</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 text-xs sm:text-xs text-slate-705">
                            {branchStaff.length === 0 ? (
                              <tr>
                                <td colSpan={5} className="py-12 text-center text-slate-400 font-medium text-xs">
                                  বর্তমান ব্রাঞ্চে কোনো কর্মকর্তা তালিকাভুক্ত নেই।
                                </td>
                              </tr>
                            ) : (
                              branchStaff.map(s => {
                                const isOnLeave = (s as any).onLeave === true;
                                return (
                                  <tr key={s.id} className="hover:bg-slate-50/50 transition">
                                    <td className="py-3.5 px-4 font-medium">
                                      <div className="space-y-0.5">
                                        <p className="font-extrabold text-slate-800 text-sm flex items-center gap-1.5">
                                          {s.name}
                                          {s.staffId?.startsWith('ILO') && (
                                            <span className="bg-amber-100 text-amber-800 text-[9px] font-bold px-1.5 py-0.5 rounded-md border border-amber-300">
                                              ডিফল্ট ব্যাকআপ
                                            </span>
                                          )}
                                        </p>
                                        <p className="text-[10px] text-slate-400 font-semibold">{s.phone}</p>
                                      </div>
                                    </td>
                                    
                                    <td className="py-3.5 px-4 text-slate-600">
                                      <div className="space-y-0.5">
                                        <p className="font-bold text-indigo-700">{s.designation}</p>
                                        <p className="text-[10px] text-slate-400 font-mono font-medium">নিয়োগ: {s.joiningDate || 'অনির্ধারিত'}</p>
                                      </div>
                                    </td>

                                    <td className="py-3.5 px-4">
                                      <div className="space-y-1 text-slate-550 font-mono text-[10px] bg-slate-50 p-1.5 rounded-lg border border-slate-100 inline-block min-w-[145px]">
                                        <div className="flex justify-between gap-2">
                                          <span className="text-slate-400">UID:</span>
                                          <span className="font-extrabold text-blue-700">{s.staffId || 'অনির্ধারিত'}</span>
                                        </div>
                                        <div className="flex justify-between gap-2">
                                          <span className="text-slate-400">পাসওয়ার্ড:</span>
                                          <span className="font-extrabold text-slate-700">{s.password || 'অনির্ধারিত'}</span>
                                        </div>
                                      </div>
                                    </td>

                                    <td className="py-3.5 px-4">
                                      {isOnLeave ? (
                                        <div className="space-y-1">
                                          <span className="bg-rose-50 text-rose-700 text-[10px] font-extrabold px-2 py-0.5 rounded-md border border-rose-150 inline-block">
                                            ● ছুটিতে আছেন
                                          </span>
                                          <p className="text-[9px] text-slate-500 font-semibold truncate max-w-[150px]" title={(s as any).leaveReason}>
                                            কারণ: {(s as any).leaveReason}
                                          </p>
                                          <p className="text-[9px] text-slate-400 font-mono">
                                            {(s as any).leaveStart} হতে {(s as any).leaveEnd}
                                          </p>
                                        </div>
                                      ) : (
                                        <span className="bg-emerald-50 text-emerald-700 text-[10px] font-extrabold px-2 py-0.5 rounded-md border border-emerald-150 inline-block">
                                          ● কর্মরত আছেন
                                        </span>
                                      )}
                                    </td>

                                    <td className="py-3.5 px-4 text-right">
                                      <div className="flex items-center justify-end gap-1.5">
                                        {!isOnLeave ? (
                                          <button
                                            type="button"
                                            onClick={() => {
                                              setLeaveStaffTarget(s);
                                              setIsLeaveModalOpen(true);
                                            }}
                                            className="text-[10px] bg-amber-50 hover:bg-amber-100 text-amber-700 font-extrabold py-1 px-2.5 rounded-lg border border-amber-200 transition"
                                            title="ছুটি দিন"
                                          >
                                            ছুটি দিন
                                          </button>
                                        ) : (
                                          <button
                                            type="button"
                                            onClick={() => handleCancelLeave(s)}
                                            className="text-[10px] bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-extrabold py-1 px-2.5 rounded-lg border border-emerald-250 transition"
                                            title="ছুটি বাতিল"
                                          >
                                            ছুটি বাতিল
                                          </button>
                                        )}

                                        {!s.staffId?.startsWith('ILO') && (
                                          <button
                                            type="button"
                                            onClick={() => openEditStaff(s)}
                                            className="p-1 px-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-500 transition"
                                            title="কর্মী তথ্য সংশোধন"
                                          >
                                            <Edit size={12} />
                                          </button>
                                        )}
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
                  </div>

                </div>
              )}



            {/* TABS: HOLIDAYS VIEW / ছুটি ক্যালেন্ডার */}
            {activeTab === 'holidays' && (
              <div id="bm_viewport_holidays" className="space-y-6 animate-in fade-in duration-100 max-sm:fixed max-sm:inset-0 max-sm:z-[100] max-sm:overflow-y-auto max-sm:bg-white max-sm:p-4 max-sm:rounded-none">
                
                {/* Back button */}
                <div className="pb-1">
                  <button
                    onClick={() => setActiveTab('home')}
                    className="inline-flex items-center gap-1 px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold hover:text-slate-900 rounded-lg text-[10.5px] border border-slate-200 cursor-pointer transition"
                  >
                    <ChevronLeft size={13} />
                    <span>← মূল মেনুতে ফিরুন</span>
                  </button>
                </div>
                
                {/* Top Header */}
                <div className="flex justify-between items-center flex-wrap gap-4 border-b border-slate-100 pb-4">
                  <div>
                    <h2 className="text-lg font-extrabold text-slate-800 tracking-tight flex items-center gap-2">
                      <Calendar size={20} className="text-emerald-600" />
                      সংগঠনের বার্ষিক ছুটি ক্যালেন্ডার (Holidays)
                    </h2>
                    <p className="text-xs text-slate-500 font-semibold font-sans">
                      প্রাক-ঘোষিত পরবর্তী ৩ বছরের ছুটির তালিকা ও সাপ্তাহিক বন্ধের দিনসমূহ দেখুন ও নতুন ছুটি ঘোষণা করুন।
                    </p>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingHolidayId(null);
                        setHolidayType('direct');
                        setHolidayName('');
                        setHolidayDate(workingDay || new Date().toISOString().split('T')[0]);
                        setHolidayDayOfWeek('শুক্রবার');
                        setIsHolidayModalOpen(true);
                      }}
                      className="px-4.5 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-extrabold text-xs rounded-xl flex items-center gap-1.5 transition duration-150 shadow-xs cursor-pointer text-center"
                    >
                      <Plus size={15} />
                      <span>নতুন ছুটি ঘোষণা</span>
                    </button>
                  </div>
                </div>

                {/* Informative Guidance Callout block */}
                <div className="bg-amber-50/75 border border-amber-200 rounded-2xl p-4 flex gap-3 text-xs text-amber-950 leading-relaxed max-w-4xl">
                  <Info size={18} className="text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-extrabold text-amber-955 mb-1 text-xs">ক্যালেন্ডারে সরকারি ছুটির নির্দেশিকা ও তথ্য:</h4>
                    <p className="mb-0.5">
                      ১. <strong>স্বয়ংক্রিয় সরকারি ছুটিসমূহ:</strong> এই সিস্টেমে ২০২৬, ২০২৭ এবং ২০২৮ সালের সমস্ত প্রধান প্রধান সরকারি ও জাতীয় ছুটিসমূহ ইতোমধ্যে প্রাক-ঘোষিত রয়েছে।
                    </p>
                    <p className="mb-0.5">
                      ২. <strong>জুন মাসের বিবরণ:</strong> সিস্টেমে কাজের তারিখ অনুযায়ী বর্তমান মাস হচ্ছে <strong>জুন ২০২৬</strong>। জুনের পুরো মাসে সাপ্তাহিক ছুটি (শুক্রবার) ছাড়া সরকারি কোনো সাধারণ ছুটি নেই। পূর্ববর্তী বা পরবর্তী মাসগুলোতে (যেমন: ফেব্রুয়ারি ২০২৬, মার্চ ২০২৬ ইত্যাদি) সুন্দরভাবে সব সরকারি লাল চিহ্নিত ছুটির দিন দেখতে পাবেন।
                    </p>
                    <p>
                      ৩. <strong>নতুন ছুটির ঘোষণা:</strong> আপনি যেকোনো বিশেষ ছুটির দিন বা সাপ্তাহিক ছুটির দিন যুক্ত করতে <strong>"নতুন ছুটি ঘোষণা"</strong> বাটনটি ব্যবহার করতে পারেন।
                    </p>
                  </div>
                </div>

                {/* Holiday Summary KPIs at a Glance */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-4 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                      <Calendar size={18} />
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-400 font-bold block font-sans">২০২৬ সালের ছুটি</p>
                      <h5 className="text-base font-black text-slate-800">{holidays.filter(h => h.type === 'direct' && h.date?.startsWith('2026')).length} টি</h5>
                    </div>
                  </div>

                  <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-4 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center font-bold">
                      <Calendar size={18} />
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-400 font-bold block font-sans">২০২৭ সালের ছুটি</p>
                      <h5 className="text-base font-black text-slate-800">{holidays.filter(h => h.type === 'direct' && h.date?.startsWith('2027')).length} টি</h5>
                    </div>
                  </div>

                  <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-4 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-fuchsia-50 text-fuchsia-600 flex items-center justify-center font-bold">
                      <Calendar size={18} />
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-400 font-bold block font-sans">২০২৮ সালের ছুটি</p>
                      <h5 className="text-base font-black text-slate-800">{holidays.filter(h => h.type === 'direct' && h.date?.startsWith('2028')).length} টি</h5>
                    </div>
                  </div>

                  <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-4 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center font-bold">
                      <Clock size={18} />
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-400 font-bold block font-sans">নিয়মিত সাপ্তাহিক সাধারণ বন্ধ</p>
                      <h5 className="text-base font-black text-slate-800">{holidays.filter(h => h.type === 'general').length} দিন</h5>
                    </div>
                  </div>
                </div>

                {/* 1. Holidays list table/grid directly in the Holidays tab */}
                <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
                  <div className="border-b border-slate-100 pb-3 flex justify-between items-center">
                    <div>
                      <h4 className="font-extrabold text-slate-800 text-xs sm:text-sm font-sans flex items-center gap-1.5">
                        <Calendar className="w-4 h-4 text-emerald-600" />
                        ছুটি তালিকা ও সাপ্তাহিক বন্ধ সমূহ (Declared Holidays List)
                      </h4>
                      <p className="text-[10px] text-slate-400 font-semibold font-sans">শাখার সকল নিয়মিত সাপ্তাহিক সাধারণ বন্ধ এবং বিশেষ সরকারি ছুটির দিনসমূহ</p>
                    </div>
                  </div>

                  {holidays.length === 0 ? (
                    <div className="py-8 text-center text-slate-400 font-semibold border border-dashed border-slate-150 rounded-2xl text-xs font-sans">
                      কোনো ছুটির রেকর্ড পাওয়া যায়নি।
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-[11px] font-medium font-sans">
                        <thead>
                          <tr className="bg-slate-50 text-slate-500 border-b border-slate-150 font-bold">
                            <th className="py-2 px-3">ছুটির ধরণ</th>
                            <th className="py-2 px-3">ছুটির নাম / বিবরণ</th>
                            <th className="py-2 px-3">তারিখ / বার</th>
                            <th className="py-2 px-3 text-right">অ্যাকশন</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-150/60 font-sans">
                          {holidays.map(h => (
                            <tr key={h.id} className="hover:bg-slate-50/40">
                              <td className="py-2.5 px-3">
                                {h.type === 'direct' ? (
                                  <span className="inline-flex items-center gap-1 text-[8.5px] bg-amber-50 text-amber-800 border border-amber-200/50 px-1.5 py-0.5 rounded-md font-bold uppercase">
                                    বিশেষ ছুটি (Direct)
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 text-[8.5px] bg-emerald-50 text-emerald-800 border border-emerald-200/50 px-1.5 py-0.5 rounded-md font-bold uppercase">
                                    সাপ্তাহিক বন্ধ (General)
                                  </span>
                                )}
                              </td>
                              <td className="py-2.5 px-3 font-extrabold text-slate-800">
                                {h.name}
                              </td>
                              <td className="py-2.5 px-3 font-mono text-slate-600">
                                {h.type === 'direct' ? h.date : h.dayOfWeek}
                              </td>
                              <td className="py-2.5 px-3 text-right">
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (confirm('আপনি কি এই ছুটির দিনটি মুছে ফেলতে চান?')) {
                                      setHolidays(prev => {
                                        const next = prev.filter(x => x.id !== h.id);
                                        localStorage.setItem(`tanzil_holidays_${org.id}`, JSON.stringify(next));
                                        return next;
                                      });
                                    }
                                  }}
                                  className="p-1 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded transition-colors cursor-pointer"
                                  title="মুছে ফেলুন"
                                >
                                  <Trash2 size={13} />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

              </div>
            )}

            {/* TABS: REPORTS VIEW / প্রতিবেদন ও রিপোর্টস */}
            {activeTab === 'reports' && (
              <div id="bm_viewport_reports" className="space-y-6 animate-in fade-in duration-100 max-sm:fixed max-sm:inset-0 max-sm:z-[100] max-sm:overflow-y-auto max-sm:bg-white max-sm:p-4 max-sm:rounded-none">
                <UnifiedReportsPanel
                  org={org}
                  currentStaff={staff}
                  branchId={staff.branchId}
                  workingDay={workingDay}
                  onBack={() => setActiveTab('home')}
                />
              </div>
            )}

            {/* TABS: ACCOUNT & GENERAL LEDGER VIEW / হিসাব ও সাধারণ খতিয়ান */}
            {activeTab === 'account' && (
              <div id="bm_viewport_account" className="space-y-6 animate-in fade-in duration-100 max-sm:fixed max-sm:inset-0 max-sm:z-[100] max-sm:overflow-y-auto max-sm:bg-white max-sm:p-4 max-sm:rounded-none">
                
                {/* Back button and Subtab selection bar */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-4">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setActiveTab('home')}
                      className="inline-flex items-center gap-1 px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold hover:text-slate-900 rounded-lg text-[10.5px] border border-slate-200 cursor-pointer transition"
                    >
                      <ChevronLeft size={13} />
                      <span>← মূল মেনু</span>
                    </button>
                    <div>
                      <h2 className="text-base font-extrabold text-slate-800 tracking-tight font-sans">শাখা হিসাব ও সাধারণ খতিয়ান (Accounting)</h2>
                      <p className="text-[10px] text-slate-400 font-semibold font-sans">শাখার সকল নগদ, ব্যাংক ও দ্বৈত দাখিলা খতিয়ান পোস্টিং</p>
                    </div>
                  </div>

                  {/* Subtab selection tabs */}
                  <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl self-start md:self-auto flex-wrap">
                    <button
                      onClick={() => setAccountSubTab('cash_book')}
                      className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                        accountSubTab === 'cash_book' 
                          ? 'bg-white text-indigo-750 shadow-3xs' 
                          : 'text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      নগদান বই বা ডে বুক
                    </button>
                    <button
                      onClick={() => setAccountSubTab('double_entry')}
                      className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                        accountSubTab === 'double_entry' 
                          ? 'bg-white text-indigo-750 shadow-3xs' 
                          : 'text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      দ্বৈত দাখিলা পোস্টিং
                    </button>
                    <button
                      onClick={() => setAccountSubTab('journal')}
                      className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                        accountSubTab === 'journal' 
                          ? 'bg-white text-indigo-750 shadow-3xs' 
                          : 'text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      সাধারণ জার্নাল খাতা
                    </button>
                    <button
                      onClick={() => setAccountSubTab('ledger')}
                      className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                        accountSubTab === 'ledger' 
                          ? 'bg-white text-indigo-750 shadow-3xs' 
                          : 'text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      খতিয়ান বা লেজার বুক
                    </button>
                    <button
                      onClick={() => setAccountSubTab('coa')}
                      className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                        accountSubTab === 'coa' 
                          ? 'bg-white text-indigo-750 shadow-3xs' 
                          : 'text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      MRA হিসাব কোড তালিকা
                    </button>
                    <button
                      onClick={() => setAccountSubTab('depreciation')}
                      className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                        accountSubTab === 'depreciation' 
                          ? 'bg-white text-indigo-750 shadow-3xs' 
                          : 'text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      স্থায়ী সম্পদের অবচয় (Depreciation)
                    </button>
                    <button
                      onClick={() => setAccountSubTab('llpf')}
                      className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                        accountSubTab === 'llpf' 
                          ? 'bg-white text-indigo-750 shadow-3xs' 
                          : 'text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      ঋণ সঞ্চিতি হিসাব (LLPF)
                    </button>
                  </div>
                </div>

                {/* Subtab Content Render Grid */}
                <div className="w-full">
                  
                        {/* 1. CASH BOOK & REGISTER VIEW */}
                      {accountSubTab === 'cash_book' && (() => {
                        const isCashDebit = (t: any) => t.debitAcc === 'cash' || (!t.debitAcc && t.paymentMode !== 'bank' && !t.source?.includes('Bank') && !t.description?.includes('SBL') && (t.type === 'income' || t.type === 'collection' || t.type === 'savings_deposit'));
                        const isCashCredit = (t: any) => t.creditAcc === 'cash' || (!t.creditAcc && t.paymentMode !== 'bank' && !t.source?.includes('Bank') && !t.description?.includes('SBL') && (t.type === 'expense' || t.type === 'disbursement' || t.type === 'savings_withdrawal'));

                        const todayTransactions = transactions.filter(t => t.addDate === workingDay || t.date === workingDay);

                        const receiptSectors: { [key: string]: { total: number; count: number; details: string[] } } = {};
                        const paymentSectors: { [key: string]: { total: number; count: number; details: string[] } } = {};

                        const addReceipt = (sector: string, amt: number, note: string) => {
                          if (amt <= 0) return;
                          if (!receiptSectors[sector]) {
                            receiptSectors[sector] = { total: 0, count: 0, details: [] };
                          }
                          receiptSectors[sector].total += amt;
                          receiptSectors[sector].count += 1;
                          if (note && !receiptSectors[sector].details.includes(note)) {
                            receiptSectors[sector].details.push(note);
                          }
                        };

                        const addPayment = (sector: string, amt: number, note: string) => {
                          if (amt <= 0) return;
                          if (!paymentSectors[sector]) {
                            paymentSectors[sector] = { total: 0, count: 0, details: [] };
                          }
                          paymentSectors[sector].total += amt;
                          paymentSectors[sector].count += 1;
                          if (note && !paymentSectors[sector].details.includes(note)) {
                            paymentSectors[sector].details.push(note);
                          }
                        };

                        todayTransactions.forEach(t => {
                          const isDebit = isCashDebit(t);
                          const isCredit = isCashCredit(t);
                          const amt = Number(t.amount || 0);
                          const note = t.note || '';

                          if (isDebit && isCredit) {
                            return;
                          }

                          if (isDebit) {
                            if (t.type === 'collection') {
                              const pl = Number(t.collections?.pl || 0);
                              const gs = Number(t.collections?.gs || 0);
                              const lts = Number(t.collections?.lts || 0);
                              const cbs = Number(t.collections?.cbs || 0);
                              const adFee = Number(t.collections?.admission_fee || 0);

                              if (pl > 0) addReceipt('ঋণ কিস্তি ও সার্ভিস চার্জ আদায় (Installment & Service Charge)', pl, note || 'ঋণ কিস্তি আদায়');
                              if (gs > 0) addReceipt('সাধারণ সঞ্চয় আদায় (General Savings Deposit)', gs, note || 'সাধারণ সঞ্চয় আদায়');
                              if (lts > 0) addReceipt('দীর্ঘমেয়াদী সঞ্চয় আদায় (LTS Deposit)', lts, note || 'দীর্ঘমেয়াদী সঞ্চয় আদায়');
                              if (cbs > 0) addReceipt('সিবিএস সঞ্চয় আদায় (CBS Deposit)', cbs, note || 'সিবিএস সঞ্চয় আদায়');
                              if (adFee > 0) addReceipt('ভর্তিকরণ ফি আদায় (Admission Fees)', adFee, note || 'ভর্তিকরণ ফি');

                              const totalBreakdown = pl + gs + lts + cbs + adFee;
                              if (totalBreakdown < amt) {
                                addReceipt('অন্যান্য সদস্য আদায় (Other Member Receipts)', amt - totalBreakdown, note || 'বিবিধ আদায়');
                              }

                              const wGs = Number(t.withdrawals?.gs || 0);
                              const wCbs = Number(t.withdrawals?.cbs || 0);
                              if (wGs > 0) addPayment('সাধারণ সঞ্চয় উত্তোলন (General Savings Withdrawal)', wGs, note || 'সাধারণ সঞ্চয় উত্তোলন');
                              if (wCbs > 0) addPayment('সিবিএস সঞ্চয় উত্তোলন (CBS Withdrawal)', wCbs, note || 'সিবিএস সঞ্চয় উত্তোলন');
                            } else if (t.type === 'savings_deposit') {
                              if (t.category === 'general_savings' || t.creditAcc === 'general_savings') {
                                addReceipt('সাধারণ সঞ্চয় আদায় (General Savings Deposit)', amt, note || 'সাধারণ সঞ্চয় ডিপোজিট');
                              } else if (t.category === 'lts_savings' || t.creditAcc === 'lts_savings') {
                                addReceipt('দীর্ঘমেয়াদী সঞ্চয় আদায় (LTS Deposit)', amt, note || 'দীর্ঘমেয়াদী সঞ্চয় ডিপোজিট');
                              } else if (t.category === 'cbs_savings' || t.creditAcc === 'cbs_savings') {
                                addReceipt('সিবিএস সঞ্চয় আদায় (CBS Deposit)', amt, note || 'সিবিএস সঞ্চয় ডিপোজিট');
                              } else {
                                addReceipt('সদস্য সঞ্চয় সংগ্রহ (Member Savings Deposit)', amt, note || 'সঞ্চয় ডিপোজিট');
                              }
                            } else if (t.creditAcc?.startsWith('bank')) {
                              addReceipt('ব্যাংক হতে নগদ উত্তোলন (Bank Withdrawal)', amt, note || 'ব্যাংক হিসাব হতে উত্তোলন');
                            } else if (t.category === 'admission_fee' || t.creditAcc === 'admission_fee' || t.category === 'ভর্তিকরণ ফি') {
                              addReceipt('ভর্তিকরণ ফি আদায় (Admission Fees)', amt, note || 'ভর্তিকরণ ফি');
                            } else if (t.category === 'passbook_fee' || t.creditAcc === 'passbook_fee' || t.category === 'পাসবুক ফি') {
                              addReceipt('ঋণ পাসবুক বিক্রয় আয় (Passbook Revenue)', amt, note || 'পাসবুক বিক্রয়');
                            } else if (t.category === 'service_charge' || t.creditAcc === 'service_charge' || t.category === 'সার্ভিস চার্জ') {
                              addReceipt('ঋণ কিস্তি ও সার্ভিস চার্জ আদায় (Installment & Service Charge)', amt, note || 'সার্ভিস চার্জ আদায়');
                            } else {
                              const rawSectorName = t.category || t.description || 'বিবিধ সাধারণ আয়';
                              let sectorName = rawSectorName;
                              if (rawSectorName === 'admission_fee') sectorName = 'ভর্তিকরণ ফি আদায় (Admission Fees)';
                              else if (rawSectorName === 'passbook_fee') sectorName = 'ঋণ পাসবুক বিক্রয় আয় (Passbook Revenue)';
                              else if (rawSectorName === 'service_charge') sectorName = 'ঋণ কিস্তি ও সার্ভিস চার্জ আদায় (Installment & Service Charge)';
                              else if (rawSectorName === 'other_income') sectorName = 'বিবিধ সাধারণ আয় (Misc Income)';
                              else if (rawSectorName === 'bank_interest') sectorName = 'ব্যাংক সঞ্চয়ের সুদ প্রাপ্তি (Bank Interest)';

                              addReceipt(sectorName, amt, note || 'নগদ জমা/প্রাপ্তি');
                            }
                          } else if (isCredit) {
                            if (t.type === 'disbursement' || t.category === 'loan_disbursement' || t.category === 'general_loan_disburse') {
                              addPayment('ঋণ বিতরণ (Loan Disbursement)', amt, note || 'সদস্য ঋণ বিতরণ');
                            } else if (t.type === 'savings_withdrawal') {
                              if (t.category === 'general_savings' || t.debitAcc === 'general_savings') {
                                addPayment('সাধারণ সঞ্চয় ফেরত (General Savings Refund)', amt, note || 'সাধারণ সঞ্চয় ফেরত');
                              } else if (t.category === 'lts_savings' || t.debitAcc === 'lts_savings') {
                                addPayment('দীর্ঘমেয়াদী সঞ্চয় ফেরত (LTS Refund)', amt, note || 'দীর্ঘমেয়াদী সঞ্চয় ফেরত');
                              } else if (t.category === 'cbs_savings' || t.debitAcc === 'cbs_savings') {
                                addPayment('সিবিএস সঞ্চয় ফেরত (CBS Refund)', amt, note || 'সিবিএস সঞ্চয় ফেরত');
                              } else {
                                addPayment('সদস্য সঞ্চয় ফেরত ও সমন্বয় (Member Savings Refund)', amt, note || 'সঞ্চয় ফেরত');
                              }
                            } else if (t.debitAcc?.startsWith('bank')) {
                              addPayment('ব্যাংকে নগদ জমা (Bank Deposit)', amt, note || 'ব্যাংক হিসাবে নগদ জমা');
                            } else if (t.category === 'office_rent' || t.debitAcc === 'office_rent') {
                              addPayment('অফিস ভাড়া (Office Rent)', amt, note || 'অফিস ভাড়া বাবদ ব্যয়');
                            } else if (t.category === 'staff_salaries' || t.debitAcc === 'staff_salaries') {
                              addPayment('কর্মী বেতন ও ভাতা (Staff Salaries)', amt, note || 'কর্মী বেতন ও ভাতা পরিশোধ');
                            } else if (t.category === 'travel_allowance' || t.debitAcc === 'travel_allowance') {
                              addPayment('যাতায়াত ও ভ্রমণ (Travel Expense)', amt, note || 'যাতায়াত ও ভ্রমণ বিল');
                            } else if (t.category === 'staff_advance' || t.debitAcc === 'staff_advance') {
                              addPayment('কর্মী অগ্রিম প্রদান (Staff Advance)', amt, note || 'কর্মী অগ্রিম ঋণ প্রদান');
                            } else if (t.category === 'other_expenses' || t.debitAcc === 'other_expenses') {
                              addPayment('অন্যান্য প্রশাসনিক খরচ (Misc Expense)', amt, note || 'প্রশাসনিক ব্যয়');
                            } else {
                              const rawSectorName = t.category || t.description || 'বিবিধ প্রশাসনিক ব্যয়';
                              let sectorName = rawSectorName;
                              if (rawSectorName === 'office_rent') sectorName = 'অফিস ভাড়া (Office Rent)';
                              else if (rawSectorName === 'staff_salaries') sectorName = 'কর্মী বেতন ও ভাতা (Staff Salaries)';
                              else if (rawSectorName === 'travel_allowance') sectorName = 'যাতায়াত ও ভ্রমণ (Travel Expense)';
                              else if (rawSectorName === 'staff_advance') sectorName = 'কর্মী অগ্রিম প্রদান (Staff Advance)';
                              else if (rawSectorName === 'other_expenses') sectorName = 'অন্যান্য প্রশাসনিক খরচ (Misc Expense)';

                              addPayment(sectorName, amt, note || 'নগদ খরচ/পরিশোধ');
                            }
                          }
                        });

                        const openingCashToday = getCashInHandPriorToDate(workingDay);
                        const totalTodayReceipts = Object.values(receiptSectors).reduce((sum, d) => sum + d.total, 0);
                        const totalTodayPayments = Object.values(paymentSectors).reduce((sum, d) => sum + d.total, 0);
                        const closingCashToday = openingCashToday + totalTodayReceipts - totalTodayPayments;

                        // 1. Compute unique transaction dates from all transactions
                        const uniqueDates = Array.from(new Set(transactions.map(t => t.addDate || t.date).filter(Boolean))) as string[];
                        uniqueDates.sort((a, b) => b.localeCompare(a)); // Newest first

                        // 2. Columnar calculation helper for a single date
                        const getColumnarRowForDate = (dStr: string) => {
                          const col2_opening = getCashInHandPriorToDate(dStr);
                          const dayTxs = transactions.filter(t => (t.addDate === dStr || t.date === dStr));
                          
                          const isCashDebit = (t: any) => t.debitAcc === 'cash' || (!t.debitAcc && t.paymentMode !== 'bank' && !t.source?.includes('Bank') && !t.description?.includes('SBL') && (t.type === 'income' || t.type === 'collection' || t.type === 'savings_deposit'));
                          const isCashCredit = (t: any) => t.creditAcc === 'cash' || (!t.creditAcc && t.paymentMode !== 'bank' && !t.source?.includes('Bank') && !t.description?.includes('SBL') && (t.type === 'expense' || t.type === 'disbursement' || t.type === 'savings_withdrawal'));

                          let col3_installment_sc = 0;
                          let col4_gs = 0;
                          let col5_lts = 0;
                          let col6_cbs = 0;
                          let col7_lsrf_collection = 0;
                          let col8_bankWithdrawal = 0;
                          let col9_otherReceipts = 0;
                          
                          let col11_loanDisburse = 0;
                          let col12_gsWithdrawal = 0;
                          let col13_gsRefund = 0;
                          let col14_ltsWithdrawal = 0;
                          let col15_ltsRefund = 0;
                          let col16_cbsWithdrawal = 0;
                          let col17_cbsRefund = 0;
                          let col18_lsrfRefund = 0;
                          let col19_bankDeposit = 0;
                          let col20_officeExpenses = 0;
                          let col22_fdrRefund = 0; // Added

                          dayTxs.forEach(t => {
                            const amt = Number(t.amount || 0);
                            const debit = isCashDebit(t);
                            const credit = isCashCredit(t);

                            if (debit && credit) {
                              return;
                            }

                            if (debit) {
                              if (t.creditAcc === 'risk_fund' || t.category === 'বীমা প্রিমিয়াম (তহবিল)' || t.category?.toLowerCase()?.includes('lsrf') || t.category?.toLowerCase()?.includes('risk_fund') || t.category?.includes('বীমা')) {
                                col7_lsrf_collection += amt;
                              } else if (t.type === 'collection') {
                                col3_installment_sc += Number(t.collections?.pl || 0);
                                col4_gs += Number(t.collections?.gs || 0);
                                col5_lts += Number(t.collections?.lts || 0);
                                col6_cbs += Number(t.collections?.cbs || 0);
                                const adFee = Number(t.collections?.admission_fee || 0);
                                if (adFee > 0) {
                                  col9_otherReceipts += adFee;
                                }
                                const totalBreakdown = Number(t.collections?.pl || 0) + Number(t.collections?.gs || 0) + Number(t.collections?.lts || 0) + Number(t.collections?.cbs || 0) + adFee;
                                if (totalBreakdown < amt) {
                                  col9_otherReceipts += (amt - totalBreakdown);
                                }
                                // Track daily meeting withdrawals (উত্তোলন)
                                const wGs = Number(t.withdrawals?.gs || 0);
                                const wCbs = Number(t.withdrawals?.cbs || 0);
                                col12_gsWithdrawal += wGs;
                                col16_cbsWithdrawal += wCbs;
                              } else if (t.type === 'savings_deposit') {
                                if (t.category === 'general_savings' || t.creditAcc === 'general_savings') {
                                  col4_gs += amt;
                                } else if (t.category === 'lts_savings' || t.creditAcc === 'lts_savings') {
                                  col5_lts += amt;
                                } else if (t.category === 'cbs_savings' || t.creditAcc === 'cbs_savings') {
                                  col6_cbs += amt;
                                } else {
                                  col9_otherReceipts += amt;
                                }
                              } else if (t.creditAcc?.startsWith('bank')) {
                                col8_bankWithdrawal += amt;
                              } else if (t.category === 'service_charge' || t.creditAcc === 'service_charge' || t.category === 'সার্ভিস চার্জ') {
                                col3_installment_sc += amt;
                              } else {
                                col9_otherReceipts += amt;
                              }
                            } else if (credit) {
                              if (t.debitAcc === 'risk_fund' || t.category?.toLowerCase()?.includes('lsrf_claims') || t.category?.includes('বীমা দাবি') || t.category?.toLowerCase()?.includes('risk_fund')) {
                                col18_lsrfRefund += amt;
                              } else if (t.type === 'disbursement' || t.category === 'loan_disbursement' || t.category === 'general_loan_disburse') {
                                col11_loanDisburse += amt;
                              } else if (t.type === 'savings_withdrawal') {
                                const isRefund = t.isRefund === true || 
                                                 t.description?.includes('ফেরত') || 
                                                 t.description?.includes('Refund') || 
                                                 t.description?.includes('Closing') || 
                                                 t.notes?.includes('ফেরত') || 
                                                 (t.id?.startsWith('tx-ret-') && !t.description?.includes('উত্তোলন'));

                                if (isRefund) {
                                  if (t.category === 'general_savings' || t.debitAcc === 'general_savings') {
                                    col13_gsRefund += amt;
                                  } else if (t.category === 'lts_savings' || t.debitAcc === 'lts_savings') {
                                    col15_ltsRefund += amt;
                                  } else if (t.category === 'cbs_savings' || t.debitAcc === 'cbs_savings') {
                                    col17_cbsRefund += amt;
                                  } else if (t.category === 'fdr' || t.debitAcc === 'fdr') { // Added FDR handling
                                    col22_fdrRefund += amt;
                                  } else {
                                    col13_gsRefund += amt;
                                  }
                                } else {
                                  if (t.category === 'general_savings' || t.debitAcc === 'general_savings') {
                                    col12_gsWithdrawal += amt;
                                  } else if (t.category === 'cbs_savings' || t.debitAcc === 'cbs_savings') {
                                    col16_cbsWithdrawal += amt;
                                  } else {
                                    col12_gsWithdrawal += amt;
                                  }
                                }
                              } else if (t.debitAcc?.startsWith('bank')) {
                                col19_bankDeposit += amt;
                              } else {
                                col20_officeExpenses += amt;
                              }
                            }
                          });

                          const col10_totalReceipts = col2_opening + col3_installment_sc + col4_gs + col5_lts + col6_cbs + col7_lsrf_collection + col8_bankWithdrawal + col9_otherReceipts;
                          const col21_totalPayments = col11_loanDisburse + col12_gsWithdrawal + col13_gsRefund + col14_ltsWithdrawal + col15_ltsRefund + col16_cbsWithdrawal + col17_cbsRefund + col18_lsrfRefund + col19_bankDeposit + col20_officeExpenses;
                          const col22_closing = col10_totalReceipts - col21_totalPayments;

                          return {
                            date: dStr,
                            opening: col2_opening,
                            installment_sc: col3_installment_sc,
                            gs: col4_gs,
                            lts: col5_lts,
                            cbs: col6_cbs,
                            lsrf_collection: col7_lsrf_collection,
                            bankWithdrawal: col8_bankWithdrawal,
                            otherReceipts: col9_otherReceipts,
                            totalReceipts: col10_totalReceipts,
                            loanDisburse: col11_loanDisburse,
                            gsWithdrawal: col12_gsWithdrawal,
                            gsRefund: col13_gsRefund,
                            ltsWithdrawal: col14_ltsWithdrawal,
                            ltsRefund: col15_ltsRefund,
                            cbsWithdrawal: col16_cbsWithdrawal,
                            cbsRefund: col17_cbsRefund,
                            lsrfRefund: col18_lsrfRefund,
                            bankDeposit: col19_bankDeposit,
                            officeExpenses: col20_officeExpenses,
                            totalPayments: col21_totalPayments,
                            closing: col22_closing
                          };
                        };

                        // 3. Apply Date Filters on unique dates list
                        const filteredDates = uniqueDates.filter(d => {
                          if (cashBookStartDate && d < cashBookStartDate) return false;
                          if (cashBookEndDate && d > cashBookEndDate) return false;
                          return true;
                        });

                        // 4. Excel File Exporter
                        const handleExportColumnarToExcel = () => {
                          const headers = [
                            'তারিখ (১)', 'গতদিনের হাতে নগদ (২)', 'কিস্তি ও সার্ভিস চার্জ আদায় (৩)', 'সাধারণ সঞ্চয় আদায় (৪)', 'দীর্ঘমেয়াদী সঞ্চয় আদায় (৫)', 'সিবিএস সঞ্চয় আদায় (৬)', 'এলএসআরএফ (LSRF) আদায় (৭)', 'ব্যাংক উত্তোলন (৮)', 'অন্যান্য প্রাপ্তি (৯)', 'মোট আদায় (১০)',
                            'ঋণ বিতরণ (১১)', 'সাধারণ সঞ্চয় উত্তোলন (১২)', 'সাধারণ সঞ্চয় ফেরত (১৩)', 'দীর্ঘমেয়াদী সঞ্চয় উত্তোলন (১৪)', 'দীর্ঘমেয়াদী সঞ্চয় ফেরত (১৫)', 'সিবিএস সঞ্চয় উত্তোলন (১৬)', 'সিবিএস সঞ্চয় ফেরত (১৭)', 'এলএসআরএফ (LSRF) ফেরত/দাবি (১৮)', 'ব্যাংক জমা (১৯)', 'অফিস খরচ ও নগদ ব্যয় (২০)', 'মোট ব্যয় (২১)', 'আজকের সমাপনী নগদ (২২)'
                          ];
                          
                          // Chronological order (oldest first for excel spreadsheets)
                          const rows = [...filteredDates].reverse().map(d => getColumnarRowForDate(d));
                          const csvRows = [
                            headers.join(','),
                            ...rows.map(r => [
                              `"${formatDDMMYYYY(r.date)}"`,
                              r.opening,
                              r.installment_sc,
                              r.gs,
                              r.lts,
                              r.cbs,
                              r.lsrf_collection,
                              r.bankWithdrawal,
                              r.otherReceipts,
                              r.totalReceipts,
                              r.loanDisburse,
                              r.gsWithdrawal,
                              r.gsRefund,
                              r.ltsWithdrawal,
                              r.ltsRefund,
                              r.cbsWithdrawal,
                              r.cbsRefund,
                              r.lsrfRefund,
                              r.bankDeposit,
                              r.officeExpenses,
                              r.totalPayments,
                              r.closing
                            ].join(','))
                          ].join('\r\n');
                          
                          downloadExcelCsv(csvRows, `Tanzil_Cash_Book_Register_${workingDay || 'Export'}`);
                        };

                        return (
                          <div className="space-y-6 animate-in fade-in duration-100">
                            
                            {/* Heading Card */}
                            <div className="bg-indigo-900 bg-gradient-to-r from-blue-700 to-indigo-800 rounded-2xl p-5 text-white shadow-md relative overflow-hidden">
                              <div className="absolute right-0 top-0 translate-x-12 -translate-y-12 w-48 h-48 bg-white/5 rounded-full pointer-events-none"></div>
                              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative z-10">
                                <div>
                                  <span className="text-[10px] bg-white/20 text-white font-extrabold px-2.5 py-1 rounded-md uppercase tracking-wider font-sans">
                                    নগদান খাতা ও ডেইলি ট্রানজেকশন খতিয়ান
                                  </span>
                                  <h3 className="font-extrabold text-lg sm:text-xl mt-1.5 font-sans flex items-center gap-2">
                                    <BookOpen className="w-5 h-5 text-amber-300" />
                                    নগদান বই বা ডে বুক (Cash Book / Day Book)
                                  </h3>
                                  <p className="text-xs text-blue-100 font-medium font-sans mt-0.5">
                                    আজকের কর্মদিবসের সকল নগদ লেনদেন, খাত অনুযায়ী হিসাব এবং দিন শেষে সমাপনী হাতনগদ হিসাব বিবরণী।
                                  </p>
                                </div>
                                <div className="bg-white/10 border border-white/25 px-4 py-2.5 rounded-xl text-right">
                                  <span className="text-[9px] text-white/70 font-bold block leading-none">আজকের কর্মদিবস</span>
                                  <span className="font-mono text-base font-black text-amber-300 block mt-1">{formatDDMMYYYY(workingDay)}</span>
                                </div>
                              </div>
                            </div>

                            {/* View Switcher Tabs: T-Ledger vs Columnar */}
                            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl self-start w-fit">
                              <button
                                type="button"
                                onClick={() => setCashBookViewMode('t_summary')}
                                className={`px-4 py-2 text-xs font-extrabold rounded-lg transition-all cursor-pointer ${
                                  cashBookViewMode === 't_summary'
                                    ? 'bg-white text-indigo-950 shadow-xs'
                                    : 'text-slate-500 hover:text-slate-700'
                                }`}
                              >
                                📊 খাত ভিত্তিক আজকের সারাংশ (T-Ledger)
                              </button>
                              <button
                                type="button"
                                onClick={() => setCashBookViewMode('columnar')}
                                className={`px-4 py-2 text-xs font-extrabold rounded-lg transition-all cursor-pointer ${
                                  cashBookViewMode === 'columnar'
                                    ? 'bg-white text-indigo-950 shadow-xs'
                                    : 'text-slate-500 hover:text-slate-700'
                                }`}
                              >
                                📋 নগদান রেজিস্টার (Cash Register)
                              </button>
                            </div>

                            {cashBookViewMode === 'columnar' ? (
                              <div className="space-y-5 animate-in fade-in duration-150 w-full">
                                
                                {/* Controls & Date Range Filter & Excel Copy */}
                                <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-3xs flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                                  <div className="flex items-center gap-3 flex-wrap">
                                    <div className="flex items-center gap-2">
                                      <span className="text-[10px] text-slate-500 font-bold uppercase font-sans">তারিখ ফিল্টার:</span>
                                      <input 
                                        type="date" 
                                        value={cashBookStartDate}
                                        onChange={(e) => setCashBookStartDate(e.target.value)}
                                        className="p-1.5 border border-slate-250 rounded-lg text-xs font-semibold focus:outline-hidden focus:border-indigo-500 font-mono"
                                      />
                                      <span className="text-xs text-slate-400 font-bold">থেকে</span>
                                      <input 
                                        type="date" 
                                        value={cashBookEndDate}
                                        onChange={(e) => setCashBookEndDate(e.target.value)}
                                        className="p-1.5 border border-slate-250 rounded-lg text-xs font-semibold focus:outline-hidden focus:border-indigo-500 font-mono"
                                      />
                                    </div>
                                    {(cashBookStartDate || cashBookEndDate) && (
                                      <button 
                                        type="button"
                                        onClick={() => { setCashBookStartDate(''); setCashBookEndDate(''); }}
                                        className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-[10px] font-black uppercase transition-colors cursor-pointer"
                                      >
                                        ফিল্টার মুছুন
                                      </button>
                                    )}
                                  </div>

                                  <button
                                    type="button"
                                    onClick={handleExportColumnarToExcel}
                                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black rounded-xl flex items-center gap-2 shadow-xs transition-colors cursor-pointer"
                                  >
                                    <FileSpreadsheet className="w-4 h-4 text-emerald-200" />
                                    এক্সপোর্ট টু এক্সেল (Export to Excel)
                                  </button>
                                </div>



                                {/* Columnar Cash Book Table */}
                                <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden w-full">
                                  <div className="overflow-x-auto">
                                    <table className="w-full text-center border-collapse min-w-[1200px] font-sans">
                                      <thead>
                                        {/* Double row header for grouped categories */}
                                        <tr className="bg-slate-100 text-slate-700 font-extrabold text-xs border-b border-slate-200 divide-x divide-slate-200">
                                          <th className="py-2.5 px-2" rowSpan={2}>তারিখ</th>
                                          <th className="py-2 px-2 bg-emerald-50/70 text-emerald-900 font-black" colSpan={9}>📥 নগদ জমা ও আদায় পাশ (Debit Side - Cash Receipts)</th>
                                          <th className="py-2 px-2 bg-rose-50/70 text-rose-900 font-black" colSpan={11}>📤 নগদ পরিশোধ ও ব্যয় পাশ (Credit Side - Cash Payments)</th>
                                          <th className="py-2.5 px-2 bg-indigo-50/70 text-indigo-900 font-black" rowSpan={2}>আজকের সমাপনী নগদ BDT</th>
                                        </tr>
                                        <tr className="bg-slate-50 text-slate-600 font-bold text-[10.5px] border-b border-slate-200 divide-x divide-slate-200">
                                          <th className="py-2 px-1 bg-emerald-50/40">গতদিনের হাতে নগদ (২)</th>
                                          <th className="py-2 px-1 bg-emerald-50/40">কিস্তি ও সার্ভিস চার্জ আদায় (৩)</th>
                                          <th className="py-2 px-1 bg-emerald-50/40">সাধারণ সঞ্চয় আদায় (৪)</th>
                                          <th className="py-2 px-1 bg-emerald-50/40">দীর্ঘমেয়াদী সঞ্চয় আদায় (৫)</th>
                                          <th className="py-2 px-1 bg-emerald-50/40">সিবিএস সঞ্চয় আদায় (৬)</th>
                                          <th className="py-2 px-1 bg-emerald-50/40">এলএসআরএফ (LSRF) আদায় (৭)</th>
                                          <th className="py-2 px-1 bg-emerald-50/40">ব্যাংক উত্তোলন (৮)</th>
                                          <th className="py-2 px-1 bg-emerald-50/40">অন্যান্য আদায় (৯)</th>
                                          <th className="py-2 px-1 bg-emerald-50 font-black text-emerald-800">মোট আদায় (১০)</th>

                                          <th className="py-2 px-1 bg-rose-50/40">ঋণ বিতরণ (১১)</th>
                                          <th className="py-2 px-1 bg-rose-50/40">সাধারণ সঞ্চয় উত্তোলন (১২)</th>
                                          <th className="py-2 px-1 bg-rose-50/40">সাধারণ সঞ্চয় ফেরত (১৩)</th>
                                          <th className="py-2 px-1 bg-rose-50/40">দীর্ঘমেয়াদী সঞ্চয় উত্তোলন (১৪)</th>
                                          <th className="py-2 px-1 bg-rose-50/40">দীর্ঘমেয়াদী সঞ্চয় ফেরত (১৫)</th>
                                          <th className="py-2 px-1 bg-rose-50/40">সিবিএস সঞ্চয় উত্তোলন (১৬)</th>
                                          <th className="py-2 px-1 bg-rose-50/40">সিবিএস সঞ্চয় ফেরত (১৭)</th>
                                          <th className="py-2 px-1 bg-rose-50/40">এলএসআরএফ (LSRF) ফেরত/দাবি (১৮)</th>
                                          <th className="py-2 px-1 bg-rose-50/40">ব্যাংক জমা (১৯)</th>
                                          <th className="py-2 px-1 bg-rose-50/40">অফিস ও নগদ ব্যয় (২০)</th>
                                          <th className="py-2 px-1 bg-rose-50 font-black text-rose-800">মোট ব্যয় (২১)</th>
                                        </tr>
                                        {/* Column indices row */}
                                        <tr className="bg-slate-100/40 text-slate-400 font-bold text-[9px] border-b border-slate-150 divide-x divide-slate-150">
                                          <td className="py-1">১</td>
                                          <td className="py-1">২ (প্রারম্ভিক)</td>
                                          <td className="py-1">৩ (আদায়)</td>
                                          <td className="py-1">৪ (GS)</td>
                                          <td className="py-1">৫ (LTS)</td>
                                          <td className="py-1">৬ (CBS)</td>
                                          <td className="py-1">৭ (LSRF)</td>
                                          <td className="py-1">৮</td>
                                          <td className="py-1">৯</td>
                                          <td className="py-1 text-emerald-700 bg-emerald-50/20">১০ (২ থেকে ৯ যোগফল)</td>
                                          <td className="py-1">১১ (বিতরণ)</td>
                                          <td className="py-1">১২ (GS উত্তোলন)</td>
                                          <td className="py-1">১৩ (GS ফেরত)</td>
                                          <td className="py-1">১৪ (LTS উত্তোলন)</td>
                                          <td className="py-1">১৫ (LTS ফেরত)</td>
                                          <td className="py-1">১৬ (CBS উত্তোলন)</td>
                                          <td className="py-1">১৭ (CBS ফেরত)</td>
                                          <td className="py-1">১৮ (LSRF ফেরত)</td>
                                          <td className="py-1">১৯ (জমা)</td>
                                          <td className="py-1">২০</td>
                                          <td className="py-1 text-rose-700 bg-rose-50/20">২১ (১১ থেকে ২০ যোগফল)</td>
                                          <td className="py-1 text-indigo-700 bg-indigo-50/20">২২ (১০ - ২১ বিয়োগফল)</td>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-slate-200 text-slate-700 font-medium text-xs divide-x divide-slate-200">
                                        {filteredDates.length === 0 ? (
                                          <tr>
                                            <td className="py-8 text-center text-slate-400 font-sans" colSpan={22}>
                                              এই তারিখ সীমার মধ্যে কোনো নগদান বই পাওয়া যায়নি।
                                            </td>
                                          </tr>
                                        ) : (
                                          filteredDates.map(dStr => {
                                            const row = getColumnarRowForDate(dStr);
                                            return (
                                              <tr key={dStr} className="hover:bg-slate-50 font-sans transition-colors divide-x divide-slate-200">
                                                <td className="py-3 px-2 font-black font-mono text-slate-800 text-[11px] bg-slate-50/50">{row.date}</td>
                                                <td className="py-3 px-2 font-mono text-slate-600">৳{row.opening.toLocaleString('en-US')}</td>
                                                <td className="py-3 px-2 font-mono text-slate-800">৳{row.installment_sc.toLocaleString('en-US')}</td>
                                                <td className="py-3 px-2 font-mono text-slate-800">৳{row.gs.toLocaleString('en-US')}</td>
                                                <td className="py-3 px-2 font-mono text-slate-800">৳{row.lts.toLocaleString('en-US')}</td>
                                                <td className="py-3 px-2 font-mono text-slate-800">৳{row.cbs.toLocaleString('en-US')}</td>
                                                <td className="py-3 px-2 font-mono text-slate-800 text-emerald-700 font-bold">৳{row.lsrf_collection.toLocaleString('en-US')}</td>
                                                <td className="py-3 px-2 font-mono text-slate-655 text-blue-700">৳{row.bankWithdrawal.toLocaleString('en-US')}</td>
                                                <td className="py-3 px-2 font-mono text-slate-600">৳{row.otherReceipts.toLocaleString('en-US')}</td>
                                                <td className="py-3 px-2 font-mono font-extrabold text-emerald-800 bg-emerald-50/15">৳{row.totalReceipts.toLocaleString('en-US')}</td>

                                                <td className="py-3 px-2 font-mono text-slate-800">৳{row.loanDisburse.toLocaleString('en-US')}</td>
                                                <td className="py-3 px-2 font-mono text-slate-800">৳{row.gsWithdrawal.toLocaleString('en-US')}</td>
                                                <td className="py-3 px-2 font-mono text-slate-800">৳{row.gsRefund.toLocaleString('en-US')}</td>
                                                <td className="py-3 px-2 font-mono text-slate-800">৳{row.ltsWithdrawal.toLocaleString('en-US')}</td>
                                                <td className="py-3 px-2 font-mono text-slate-800">৳{row.ltsRefund.toLocaleString('en-US')}</td>
                                                <td className="py-3 px-2 font-mono text-slate-800">৳{row.cbsWithdrawal.toLocaleString('en-US')}</td>
                                                <td className="py-3 px-2 font-mono text-slate-800">৳{row.cbsRefund.toLocaleString('en-US')}</td>
                                                <td className="py-3 px-2 font-mono text-rose-700 font-bold">৳{row.lsrfRefund.toLocaleString('en-US')}</td>
                                                <td className="py-3 px-2 font-mono text-slate-655 text-rose-700">৳{row.bankDeposit.toLocaleString('en-US')}</td>
                                                <td className="py-3 px-2 font-mono text-slate-600">৳{row.officeExpenses.toLocaleString('en-US')}</td>
                                                <td className="py-3 px-2 font-mono font-extrabold text-rose-800 bg-rose-50/15">৳{row.totalPayments.toLocaleString('en-US')}</td>

                                                <td className="py-3 px-2 font-mono font-black text-indigo-955 bg-indigo-50/20 text-sm">৳{row.closing.toLocaleString('en-US')}</td>
                                              </tr>
                                            );
                                          })
                                        )}
                                      </tbody>
                                      {/* Total sum row of filtered date range */}
                                      {filteredDates.length > 0 && (() => {
                                        let sumInstallmentSC = 0;
                                        let sumGs = 0;
                                        let sumLts = 0;
                                        let sumCbs = 0;
                                        let sumLsrfCollection = 0;
                                        let sumWithdrawal = 0;
                                        let sumOtherReceipts = 0;
                                        let sumTotalReceipts = 0;
                                        let sumLoanDisburse = 0;
                                        let sumGsWithdrawal = 0;
                                        let sumGsRefund = 0;
                                        let sumLtsWithdrawal = 0;
                                        let sumLtsRefund = 0;
                                        let sumCbsWithdrawal = 0;
                                        let sumCbsRefund = 0;
                                        let sumLsrfRefund = 0;
                                        let sumDeposit = 0;
                                        let sumOfficeExpenses = 0;
                                        let sumTotalPayments = 0;

                                        filteredDates.forEach(dStr => {
                                          const row = getColumnarRowForDate(dStr);
                                          sumInstallmentSC += row.installment_sc;
                                          sumGs += row.gs;
                                          sumLts += row.lts;
                                          sumCbs += row.cbs;
                                          sumLsrfCollection += row.lsrf_collection;
                                          sumWithdrawal += row.bankWithdrawal;
                                          sumOtherReceipts += row.otherReceipts;
                                          sumTotalReceipts += row.totalReceipts;
                                          sumLoanDisburse += row.loanDisburse;
                                          sumGsWithdrawal += row.gsWithdrawal;
                                          sumGsRefund += row.gsRefund;
                                          sumLtsWithdrawal += row.ltsWithdrawal;
                                          sumLtsRefund += row.ltsRefund;
                                          sumCbsWithdrawal += row.cbsWithdrawal;
                                          sumCbsRefund += row.cbsRefund;
                                          sumLsrfRefund += row.lsrfRefund;
                                          sumDeposit += row.bankDeposit;
                                          sumOfficeExpenses += row.officeExpenses;
                                          sumTotalPayments += row.totalPayments;
                                        });

                                        const latestRow = getColumnarRowForDate(filteredDates[0]);

                                        return (
                                          <tfoot>
                                            <tr className="bg-slate-100 text-slate-800 font-extrabold text-[11px] border-t-2 border-slate-300 divide-x divide-slate-200">
                                              <td className="py-3 px-2 bg-slate-200/60 font-black">মোট জমা যোগফল</td>
                                              <td className="py-3 px-2 font-mono text-slate-500 font-normal">জের (-)</td>
                                              <td className="py-3 px-2 font-mono text-emerald-800">৳{sumInstallmentSC.toLocaleString('en-US')}</td>
                                              <td className="py-3 px-2 font-mono text-emerald-800">৳{sumGs.toLocaleString('en-US')}</td>
                                              <td className="py-3 px-2 font-mono text-emerald-800">৳{sumLts.toLocaleString('en-US')}</td>
                                              <td className="py-3 px-2 font-mono text-emerald-800">৳{sumCbs.toLocaleString('en-US')}</td>
                                              <td className="py-3 px-2 font-mono text-emerald-800 font-bold">৳{sumLsrfCollection.toLocaleString('en-US')}</td>
                                              <td className="py-3 px-2 font-mono text-blue-755">৳{sumWithdrawal.toLocaleString('en-US')}</td>
                                              <td className="py-3 px-2 font-mono text-emerald-850">৳{sumOtherReceipts.toLocaleString('en-US')}</td>
                                              <td className="py-3 px-2 font-mono font-black text-emerald-900 bg-emerald-100/50">৳{sumTotalReceipts.toLocaleString('en-US')}</td>

                                              <td className="py-3 px-2 font-mono text-rose-800">৳{sumLoanDisburse.toLocaleString('en-US')}</td>
                                              <td className="py-3 px-2 font-mono text-rose-800">৳{sumGsWithdrawal.toLocaleString('en-US')}</td>
                                              <td className="py-3 px-2 font-mono text-rose-800">৳{sumGsRefund.toLocaleString('en-US')}</td>
                                              <td className="py-3 px-2 font-mono text-rose-800">৳{sumLtsWithdrawal.toLocaleString('en-US')}</td>
                                              <td className="py-3 px-2 font-mono text-rose-800">৳{sumLtsRefund.toLocaleString('en-US')}</td>
                                              <td className="py-3 px-2 font-mono text-rose-800">৳{sumCbsWithdrawal.toLocaleString('en-US')}</td>
                                              <td className="py-3 px-2 font-mono text-rose-800">৳{sumCbsRefund.toLocaleString('en-US')}</td>
                                              <td className="py-3 px-2 font-mono text-rose-800 font-bold">৳{sumLsrfRefund.toLocaleString('en-US')}</td>
                                              <td className="py-3 px-2 font-mono text-rose-755">৳{sumDeposit.toLocaleString('en-US')}</td>
                                              <td className="py-3 px-2 font-mono text-rose-850">৳{sumOfficeExpenses.toLocaleString('en-US')}</td>
                                              <td className="py-3 px-2 font-mono font-black text-rose-900 bg-rose-100/50">৳{sumTotalPayments.toLocaleString('en-US')}</td>

                                              <td className="py-3 px-2 font-mono font-black text-indigo-955 bg-indigo-100/50 text-sm">৳{latestRow.closing.toLocaleString('en-US')}</td>
                                            </tr>
                                          </tfoot>
                                        );
                                      })()}
                                    </table>
                                  </div>
                                </div>

                              </div>
                            ) : (
                              <>

                            {/* Cash KPIs Segment */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                              <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-3xs flex items-center gap-3.5">
                                <div className="p-3 bg-amber-50 rounded-xl border border-amber-100 text-amber-600">
                                  <Banknote className="w-5 h-5" />
                                </div>
                                <div>
                                  <span className="text-[10px] text-slate-400 font-bold block">প্রারম্ভিক হাতে নগদ</span>
                                  <span className="font-mono text-sm font-black text-slate-800">৳{openingCashToday.toLocaleString('bn-BD')}</span>
                                </div>
                              </div>

                              <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-3xs flex items-center gap-3.5">
                                <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-100 text-emerald-650">
                                  <Coins className="w-5 h-5" />
                                </div>
                                <div>
                                  <span className="text-[10px] text-slate-400 font-bold block">আজকের মোট প্রাপ্তি</span>
                                  <span className="font-mono text-sm font-black text-emerald-700">৳{totalTodayReceipts.toLocaleString('bn-BD')}</span>
                                </div>
                              </div>

                              <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-3xs flex items-center gap-3.5">
                                <div className="p-3 bg-rose-50 rounded-xl border border-rose-100 text-rose-600">
                                  <Banknote className="w-5 h-5" />
                                </div>
                                <div>
                                  <span className="text-[10px] text-slate-400 font-bold block">আজকের মোট পরিশোধ</span>
                                  <span className="font-mono text-sm font-black text-rose-700">৳{totalTodayPayments.toLocaleString('bn-BD')}</span>
                                </div>
                              </div>

                              <div className="bg-white rounded-2xl border border-indigo-200 p-4 shadow-3xs flex items-center gap-3.5 bg-indigo-50/10">
                                <div className="p-3 bg-indigo-100 text-indigo-700 rounded-xl">
                                  <PiggyBank className="w-5 h-5" />
                                </div>
                                <div>
                                  <span className="text-[10px] text-indigo-500 font-bold block">সমাপনী হাতে নগদ (হাতনগদ)</span>
                                  <span className="font-mono text-sm font-black text-indigo-700">৳{closingCashToday.toLocaleString('bn-BD')}</span>
                                </div>
                              </div>
                            </div>

                            {/* Unified Sector/Category Wise T-Ledger Table */}
                            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
                              <div className="p-4 border-b border-slate-200/80 bg-slate-50/50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                                <div>
                                  <h4 className="font-extrabold text-slate-800 text-xs sm:text-sm flex items-center gap-1.5 font-sans">
                                    <ClipboardList className="w-4 h-4 text-indigo-600" />
                                    খাত অনুযায়ী আজকের নগদ লেনদেন ও হাতনগদ হিসাব (Day Book Sector Summary)
                                  </h4>
                                  <p className="text-[10px] text-slate-400 font-semibold font-sans">
                                    আজকে সম্পন্ন হওয়া সকল আয় ও ব্যয় খাতসমূহ একত্রিত করে দুই পাশে ব্যালেন্স সমন্বয় করা হয়েছে।
                                  </p>
                                </div>
                                <div className="text-right">
                                  <span className="inline-flex items-center gap-1 text-[10px] bg-indigo-100 text-indigo-800 font-black px-2.5 py-1 rounded-full font-sans">
                                    হাতে নগদ সমন্বিত (Balanced)
                                  </span>
                                </div>
                              </div>

                              <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-slate-200">
                                
                                {/* DEBIT / RECEIPT SIDE */}
                                <div className="p-4 space-y-3">
                                  <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                                    <span className="text-[11px] font-black text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md uppercase">
                                      প্রাপ্তি ও জমা পাশ (Receipts — Debit Side)
                                    </span>
                                    <span className="font-mono text-[9px] text-slate-400 font-bold">DR (ডেবিট)</span>
                                  </div>

                                  <div className="overflow-x-auto">
                                    <table className="w-full text-left text-xs font-sans">
                                      <thead>
                                        <tr className="bg-slate-50/80 text-slate-500 border-b border-slate-150 font-bold text-[10.5px]">
                                          <th className="py-2 px-3">লেনদেন / আয়ের খাত (Receipt Sector)</th>
                                          <th className="py-2 px-3 text-center">এন্ট্রি সংখ্যা</th>
                                          <th className="py-2 px-3 text-right">টাকা (৳)</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                                        {/* Opening cash row */}
                                        <tr className="bg-amber-50/20">
                                          <td className="py-2.5 px-3">
                                            <span className="font-extrabold text-slate-800 block">প্রারম্ভিক হাতে নগদ (Opening Cash)</span>
                                            <span className="text-[9px] text-slate-400 font-bold">পূর্ববর্তী কর্মদিবসের সমাপনী ব্যালেন্স</span>
                                          </td>
                                          <td className="py-2.5 px-3 text-center font-mono text-slate-400">---</td>
                                          <td className="py-2.5 px-3 text-right font-mono font-extrabold text-slate-800">
                                            ৳{openingCashToday.toLocaleString('bn-BD')}
                                          </td>
                                        </tr>

                                        {/* Today's categorized receipts */}
                                        {Object.keys(receiptSectors).length === 0 ? (
                                          <tr>
                                            <td colSpan={3} className="py-8 text-center text-slate-400 font-semibold text-xs border-dashed border-slate-150">
                                              আজকে কোনো নগদ প্রাপ্তির লেনদেন নেই।
                                            </td>
                                          </tr>
                                        ) : (
                                          Object.entries(receiptSectors).map(([sector, data]) => (
                                            <tr key={sector} className="hover:bg-slate-50/50">
                                              <td className="py-2.5 px-3">
                                                <span className="font-bold text-slate-800 text-[11.5px] block">{sector}</span>
                                                <span className="text-[9.5px] text-slate-400 block truncate max-w-xs">{data.details.join(', ') || 'ক্যাশ কালেকশন/রিসিভ'}</span>
                                              </td>
                                              <td className="py-2.5 px-3 text-center font-mono font-bold text-slate-500">{data.count} টি</td>
                                              <td className="py-2.5 px-3 text-right font-mono font-extrabold text-emerald-700">
                                                ৳{data.total.toLocaleString('bn-BD')}
                                              </td>
                                            </tr>
                                          ))
                                        )}
                                      </tbody>
                                    </table>
                                  </div>
                                </div>

                                {/* CREDIT / PAYMENT SIDE */}
                                <div className="p-4 space-y-3">
                                  <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                                    <span className="text-[11px] font-black text-rose-850 bg-rose-50 px-2 py-0.5 rounded-md uppercase">
                                      পরিশোধ ও খরচ পাশ (Payments — Credit Side)
                                    </span>
                                    <span className="font-mono text-[9px] text-slate-400 font-bold">CR (ক্রেডিট)</span>
                                  </div>

                                  <div className="overflow-x-auto">
                                    <table className="w-full text-left text-xs font-sans">
                                      <thead>
                                        <tr className="bg-slate-50/80 text-slate-500 border-b border-slate-150 font-bold text-[10.5px]">
                                          <th className="py-2 px-3">লেনদেন / খরচের খাত (Payment Sector)</th>
                                          <th className="py-2 px-3 text-center">এন্ট্রি সংখ্যা</th>
                                          <th className="py-2 px-3 text-right">টাকা (৳)</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                                        {/* Today's categorized payments */}
                                        {Object.keys(paymentSectors).length === 0 ? (
                                          <tr>
                                            <td colSpan={3} className="py-8 text-center text-slate-400 font-semibold text-xs border-dashed border-slate-150">
                                              আজকে কোনো নগদ খরচের লেনদেন নেই।
                                            </td>
                                          </tr>
                                        ) : (
                                          Object.entries(paymentSectors).map(([sector, data]) => (
                                            <tr key={sector} className="hover:bg-slate-50/50">
                                              <td className="py-2.5 px-3">
                                                <span className="font-bold text-slate-800 text-[11.5px] block">{sector}</span>
                                                <span className="text-[9.5px] text-slate-400 block truncate max-w-xs">{data.details.join(', ') || 'ক্যাশ ব্যয়/পেমেন্ট'}</span>
                                              </td>
                                              <td className="py-2.5 px-3 text-center font-mono font-bold text-slate-500">{data.count} টি</td>
                                              <td className="py-2.5 px-3 text-right font-mono font-extrabold text-rose-700">
                                                ৳{data.total.toLocaleString('bn-BD')}
                                              </td>
                                            </tr>
                                          ))
                                        )}

                                        {/* Closing cash balancing row */}
                                        <tr className="bg-indigo-50/30">
                                          <td className="py-2.5 px-3">
                                            <span className="font-extrabold text-indigo-800 block">সমাপনী হাতে নগদ (Closing Cash-in-Hand)</span>
                                            <span className="text-[9px] text-indigo-500 font-bold">হাতনগদ হিসাব (আজকের দিনের সমাপনী ব্যালেন্স)</span>
                                          </td>
                                          <td className="py-2.5 px-3 text-center font-mono text-slate-400">---</td>
                                          <td className="py-2.5 px-3 text-right font-mono font-black text-indigo-700">
                                            ৳{closingCashToday.toLocaleString('bn-BD')}
                                          </td>
                                        </tr>
                                      </tbody>
                                    </table>
                                  </div>
                                </div>

                              </div>

                              {/* Balanced Summary Row at the Bottom of T-Ledger */}
                              <div className="grid grid-cols-1 lg:grid-cols-2 bg-slate-100/80 border-t border-slate-200 font-sans text-xs font-black text-slate-800 divide-y lg:divide-y-0 lg:divide-x divide-slate-200">
                                <div className="py-3 px-4 flex justify-between items-center bg-emerald-50/30">
                                  <span>মোট জমা পাশে যোগফল (Total Receipts + Opening Cash)</span>
                                  <span className="font-mono text-sm text-emerald-800">৳{(openingCashToday + totalTodayReceipts).toLocaleString('bn-BD')}</span>
                                </div>
                                <div className="py-3 px-4 flex justify-between items-center bg-indigo-50/30">
                                  <span>মোট খরচ পাশে যোগফল (Total Payments + Closing Cash)</span>
                                  <span className="font-mono text-sm text-indigo-800">৳{(totalTodayPayments + closingCashToday).toLocaleString('bn-BD')}</span>
                                </div>
                              </div>
                            </div>

                            {/* Today's Itemized Detailed Cash Register */}
                            <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4 shadow-3xs">
                              <div>
                                <h4 className="font-extrabold text-slate-800 text-xs sm:text-sm flex items-center gap-1.5 font-sans">
                                  <FileText className="w-4 h-4 text-blue-600" />
                                  আজকের বিস্তারিত নগদ ট্রানজেকশন রেজিস্টার (Detailed Daily Cash Register)
                                </h4>
                                <p className="text-[10px] text-slate-400 font-semibold font-sans">আজকে সম্পন্ন হওয়া প্রতিটি ভাউচার বা প্রাপ্তির বিস্তারিত তালিকা</p>
                              </div>

                              {todayTransactions.length === 0 ? (
                                <div className="py-8 text-center text-slate-400 font-semibold border border-dashed border-slate-150 rounded-2xl text-xs font-sans">
                                  আজকের কর্মদিবসে কোনো নগদ বা ব্যাংক লেনদেন নথিভুক্ত হয়নি।
                                </div>
                              ) : (
                                <div className="overflow-x-auto">
                                  <table className="w-full text-left text-[11px] font-medium font-sans">
                                    <thead>
                                      <tr className="bg-slate-50 text-slate-500 border-b border-slate-150 font-bold">
                                        <th className="py-2 px-3">লেনদেন আইডি</th>
                                        <th className="py-2 px-3">ধরণ (Type)</th>
                                        <th className="py-2 px-3">খাত / বিবরণ (Sector / Description)</th>
                                        <th className="py-2 px-3">ডেবিট অ্যাকাউন্ট</th>
                                        <th className="py-2 px-3">ক্রেডিট অ্যাকাউন্ট</th>
                                        <th className="py-2 px-3 text-right">টাকা (৳)</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-150/60 font-sans">
                                      {todayTransactions.map(t => {
                                        const isReceipt = t.debitAcc === 'cash' || (!t.debitAcc && t.paymentMode !== 'bank' && !t.source?.includes('Bank') && !t.description?.includes('SBL') && (t.type === 'income' || t.type === 'collection'));
                                        const isPayment = t.creditAcc === 'cash' || (!t.creditAcc && t.paymentMode !== 'bank' && !t.source?.includes('Bank') && !t.description?.includes('SBL') && (t.type === 'expense' || t.type === 'disbursement'));
                                        
                                        return (
                                          <tr key={t.id} className="hover:bg-slate-50/40">
                                            <td className="py-2.5 px-3">
                                              <span className="font-mono text-[9px] text-blue-600 font-bold block">{t.id}</span>
                                              <span className="font-mono text-[8px] text-slate-400 block">{t.addDate || t.date}</span>
                                            </td>
                                            <td className="py-2.5 px-3">
                                              {isReceipt && !isPayment && (
                                                <span className="inline-flex items-center gap-1 text-[8.5px] bg-emerald-50 text-emerald-800 border border-emerald-200/50 px-1.5 py-0.5 rounded-md font-bold uppercase">
                                                  প্রাপ্তি (DR)
                                                </span>
                                              )}
                                              {isPayment && !isReceipt && (
                                                <span className="inline-flex items-center gap-1 text-[8.5px] bg-rose-50 text-rose-800 border border-rose-200/50 px-1.5 py-0.5 rounded-md font-bold uppercase">
                                                  পরিশোধ (CR)
                                                </span>
                                              )}
                                              {((isReceipt && isPayment) || (!isReceipt && !isPayment)) && (
                                                <span className="inline-flex items-center gap-1 text-[8.5px] bg-slate-50 text-slate-600 border border-slate-200/50 px-1.5 py-0.5 rounded-md font-bold uppercase">
                                                  জার্নাল / ব্যাংক
                                                </span>
                                              )}
                                            </td>
                                            <td className="py-2.5 px-3">
                                              <span className="font-extrabold text-slate-800 block text-[11.5px]">{t.category || t.description || 'আদায়'}</span>
                                              {t.note && <span className="text-[9.5px] text-slate-400 italic block mt-0.5">{t.note}</span>}
                                            </td>
                                            <td className="py-2.5 px-3 text-[10px] font-bold text-slate-500 font-mono">
                                              {(() => {
                                                if (t.debitAcc === 'cash') return '💵 হাতে নগদ (Cash)';
                                                if (t.debitAcc?.startsWith('bank')) {
                                                  const b = bankAccounts.find(bank => bank.id === t.debitAcc);
                                                  return b ? `🏦 ${b.bankName.slice(0, 15)}...` : '🏦 ব্যাংক হিসাব';
                                                }
                                                if (t.debitAcc) return t.debitAcc;
                                                return (t.type === 'income' || t.type === 'collection') ? '💵 হাতে নগদ (Cash)' : '-';
                                              })()}
                                            </td>
                                            <td className="py-2.5 px-3 text-[10px] font-bold text-slate-500 font-mono">
                                              {(() => {
                                                if (t.creditAcc === 'cash') return '💵 হাতে নগদ (Cash)';
                                                if (t.creditAcc?.startsWith('bank')) {
                                                  const b = bankAccounts.find(bank => bank.id === t.creditAcc);
                                                  return b ? `🏦 ${b.bankName.slice(0, 15)}...` : '🏦 ব্যাংক হিসাব';
                                                }
                                                if (t.creditAcc) {
                                                  return t.creditAcc === 'admission_fee' ? '🎟️ ভর্তিকরণ ফি' : 
                                                         t.creditAcc === 'passbook_fee' ? '📖 পাসবুক বিক্রয়' : 
                                                         t.creditAcc === 'service_charge' ? '📈 সার্ভিস চার্জ' : 
                                                         t.creditAcc === 'savings_collection' ? '💰 সঞ্চয় সংগ্রহ' : 
                                                         t.creditAcc;
                                                }
                                                if (t.type === 'collection') return '💰 সঞ্চয় ও কিস্তি আদায়';
                                                return (t.type === 'expense' || t.type === 'disbursement') ? '💵 হাতে নগদ (Cash)' : '-';
                                              })()}
                                            </td>
                                            <td className="py-2.5 px-3 text-right font-black text-slate-850 font-mono">
                                              ৳{Number(t.amount || 0).toLocaleString('bn-BD')}
                                            </td>
                                          </tr>
                                        );
                                      })}
                                    </tbody>
                                  </table>
                                </div>
                              )}
                            </div>
                              </>
                            )}

                            {/* Bank Accounts Overview Segment (Keep below) */}
                            <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
                              <div className="flex justify-between items-center border-b border-slate-150 pb-3">
                                <div>
                                  <h4 className="font-extrabold text-slate-800 text-xs sm:text-sm flex items-center gap-1.5 font-sans">
                                    <Building className="w-4 h-4 text-indigo-600" />
                                    শাখার নিবন্ধিত ব্যাংক হিসাবসমূহ (Registered Bank Accounts)
                                </h4>
                                <p className="text-[10px] text-slate-400 font-semibold font-sans">শাখার ব্যাংক সঞ্চয় ও চলতি হিসাব খতিয়ান তালিকা</p>
                              </div>
                              <button
                                type="button"
                                onClick={() => setIsBankModalOpen(true)}
                                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-[11px] rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
                              >
                                <Plus size={12} /> ব্যাংক হিসাব যুক্ত করুন
                              </button>
                            </div>

                            {bankAccounts.length === 0 ? (
                              <div className="py-8 text-center text-slate-400 font-semibold border border-dashed border-slate-150 rounded-2xl text-xs font-sans">
                                এখনো কোনো ব্যাংক অ্যাকাউন্ট যুক্ত করা হয়নি। উপরোক্ত বাটনটি দিয়ে শাখার ব্যাংক হিসাব যুক্ত করুন।
                              </div>
                            ) : (
                              <div className="space-y-6">
                                {(() => {
                                  const getCleanType = (b: any) => String(b.accountType || '').toLowerCase();
                                  const currentAccounts = bankAccounts.filter(b => {
                                    const t = getCleanType(b);
                                    return t.includes('চলতি') || t.includes('current') || t === '';
                                  });
                                  const savingsAccounts = bankAccounts.filter(b => {
                                    const t = getCleanType(b);
                                    return t.includes('সঞ্চয়ী') || t.includes('savings') || t.includes('sanchay');
                                  });
                                  const sndAccounts = bankAccounts.filter(b => {
                                    const t = getCleanType(b);
                                    return t.includes('এসএনডি') || t.includes('snd');
                                  });
                                  const fdrAccounts = bankAccounts.filter(b => {
                                    const t = getCleanType(b);
                                    return t.includes('এফডিআর') || t.includes('fdr');
                                  });
                                  const otherAccounts = bankAccounts.filter(b => {
                                    const t = getCleanType(b);
                                    return !t.includes('চলতি') && !t.includes('current') && t !== '' &&
                                           !t.includes('সঞ্চয়ী') && !t.includes('savings') && !t.includes('sanchay') &&
                                           !t.includes('এসএনডি') && !t.includes('snd') &&
                                           !t.includes('এফডিআর') && !t.includes('fdr');
                                  });

                                  const groups = [
                                    { title: 'চলতি হিসাব (Current Accounts)', accounts: currentAccounts, color: 'bg-indigo-500' },
                                    { title: 'সঞ্চয়ী হিসাব (Savings Accounts)', accounts: savingsAccounts, color: 'bg-emerald-500' },
                                    { title: 'এসএনডি হিসাব (SND Accounts)', accounts: sndAccounts, color: 'bg-amber-500' },
                                    { title: 'এফডিআর হিসাব (FDR Accounts)', accounts: fdrAccounts, color: 'bg-rose-500' },
                                    { title: 'অন্যান্য হিসাব (Other Accounts)', accounts: otherAccounts, color: 'bg-slate-500' },
                                  ];

                                  return (
                                    <div className="space-y-6">
                                      {groups.map((group) => {
                                        if (group.accounts.length === 0) return null;
                                        return (
                                          <div key={group.title} className="space-y-3">
                                            <div className="flex items-center gap-2">
                                              <span className={`w-1.5 h-3.5 ${group.color} rounded-sm`}></span>
                                              <h5 className="font-extrabold text-slate-700 text-xs tracking-wide font-sans flex items-center gap-1.5">
                                                {group.title}
                                                <span className="text-[10px] text-slate-400 font-bold font-mono">({group.accounts.length})</span>
                                              </h5>
                                            </div>
                                            
                                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                                              {group.accounts.map((b) => {
                                                const bal = getBankBalance(b.id);
                                                return (
                                                  <div 
                                                    key={b.id}
                                                    className={`p-4 rounded-2xl border transition duration-150 cursor-pointer select-none relative overflow-hidden ${
                                                      selectedBankStatementId === b.id 
                                                        ? 'border-blue-500 bg-blue-50/20 shadow-xs' 
                                                        : 'border-slate-200 bg-slate-50/50 hover:bg-slate-50'
                                                      }`}
                                                    onClick={() => setSelectedBankStatementId(b.id)}
                                                  >
                                                    <div className="flex justify-between items-start gap-4">
                                                      <div className="space-y-1">
                                                        <span className="text-[9px] bg-slate-200 font-extrabold px-2 py-0.5 rounded text-slate-600 block w-max font-sans">
                                                          {b.accountType}
                                                        </span>
                                                        <h5 className="font-extrabold text-slate-800 text-xs leading-snug">{b.bankName}</h5>
                                                        <p className="font-semibold text-[10px] text-slate-400 leading-none">শাখা: {b.branchName}</p>
                                                        <p className="font-mono text-[10px] text-slate-500 font-extrabold">A/C: {b.accountNo}</p>
                                                      </div>
                                                      <div className="text-right space-y-1.5">
                                                        <div>
                                                          <p className="text-[9px] text-slate-400 font-bold">বর্তমান জের</p>
                                                          <p className="font-black text-xs text-indigo-700">৳{bal.toLocaleString('bn-BD')}</p>
                                                        </div>
                                                        <button
                                                          type="button"
                                                          onClick={(e) => {
                                                            e.stopPropagation();
                                                            if (confirm(`আপনি কি "${b.bankName}" ব্যাংক হিসাবটি সম্পূর্ণ মুছে ফেলতে চান?`)) {
                                                              setBankAccounts(prev => prev.filter(x => x.id !== b.id));
                                                              setAlertMsg({ type: 'success', text: `ব্যাংক অ্যাকাউন্টটি সফলভাবে মুছে ফেলা হয়েছে!` });
                                                            }
                                                          }}
                                                          className="p-1 hover:bg-rose-50 text-rose-500 hover:text-rose-700 rounded-lg transition-colors cursor-pointer block ml-auto"
                                                          title="মুছে ফেলুন"
                                                        >
                                                          <Trash2 size={13} />
                                                        </button>
                                                      </div>
                                                    </div>
                                                    <div className="pt-2 mt-2 border-t border-slate-200/50 flex justify-between items-center text-[9px] font-bold text-slate-400 font-sans">
                                                      <span>প্রারম্ভিক জমা: ৳{b.initialBalance.toLocaleString('bn-BD')}</span>
                                                      {selectedBankStatementId === b.id && (
                                                        <span className="text-blue-650 bg-blue-50 px-1.5 py-0.2 rounded text-[8px]">লেজার নির্বাচিত</span>
                                                      )}
                                                    </div>
                                                  </div>
                                                );
                                              })}
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  );
                                })()}
                              </div>
                            )}
                          </div>

                          {/* Dual column Cash Book Ledger */}
                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
                            
                            {/* Cash Ledger Receipts (Left / Debit) */}
                            <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3 shadow-3xs">
                              <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                                <div>
                                  <h5 className="font-black text-emerald-850 text-xs uppercase tracking-wide flex items-center gap-1.5">
                                    <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-pulse inline-block"></span>
                                    প্রাপ্তি ও জমা পাশ (Receipts — Debit Side)
                                  </h5>
                                  <p className="text-[9px] text-slate-400 font-bold">ক্যাশ বহিতে জমা হওয়া নগদ ও ব্যাংক ফান্ড এন্ট্রি</p>
                                </div>
                                <span className="text-[10px] font-extrabold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
                                  ডেবিট (DR)
                                </span>
                              </div>

                              {/* List of Receipt details */}
                              {(() => {
                                const receipts = transactions.filter(t => 
                                  t.debitAcc === 'cash' || 
                                  (!t.debitAcc && t.paymentMode !== 'bank' && !t.source?.includes('Bank') && !t.description?.includes('SBL') && (t.type === 'income' || t.type === 'collection'))
                                );
                                
                                if (receipts.length === 0) {
                                  return (
                                    <div className="py-12 text-center text-slate-400 font-semibold border border-dashed border-slate-150 rounded-2xl text-xs">
                                      কোনো ক্যাশ প্রাপ্তি এখনও নেই।
                                    </div>
                                  );
                                }

                                return (
                                  <div className="overflow-x-auto">
                                    <table className="w-full text-left text-[11px] font-medium font-sans">
                                      <thead>
                                        <tr className="bg-slate-50 text-slate-500 border-b border-slate-100">
                                          <th className="py-2 px-3 font-bold">তারিখ ও আইডি</th>
                                          <th className="py-2 px-3 font-bold">বিবরণ / খাত</th>
                                          <th className="py-2 px-3 font-bold text-right">টাকা (৳)</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-slate-100">
                                        {receipts.map(r => (
                                          <tr key={r.id} className="hover:bg-slate-50/50">
                                            <td className="py-2 px-3">
                                              <span className="font-mono text-[9px] text-blue-600 font-bold block">{r.id}</span>
                                              <span className="font-mono text-[8.5px] text-slate-400 block">{r.addDate}</span>
                                            </td>
                                            <td className="py-2 px-3">
                                              <span className="font-extrabold text-slate-800 text-[11.5px] block">{r.category || 'আদায়'}</span>
                                              <span className="text-[9.5px] text-slate-400 italic block">{r.note || r.description}</span>
                                            </td>
                                            <td className="py-2 px-3 text-right font-black text-emerald-750 font-mono">
                                              ৳{r.amount}
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                );
                              })()}
                            </div>

                            {/* Cash Ledger Payments (Right / Credit) */}
                            <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3 shadow-3xs">
                              <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                                <div>
                                  <h5 className="font-black text-rose-850 text-xs uppercase tracking-wide flex items-center gap-1.5">
                                    <span className="w-2.5 h-2.5 bg-rose-500 rounded-full inline-block"></span>
                                    পরিশোধ ও খরচ পাশ (Payments — Credit Side)
                                  </h5>
                                  <p className="text-[9px] text-slate-400 font-bold">ক্যাশ বহি থেকে সম্পন্ন হওয়া নগদ ও ব্যাংক বিতরণ এন্ট্রি</p>
                                </div>
                                <span className="text-[10px] font-extrabold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-md">
                                  ক্রেডিট (CR)
                                </span>
                              </div>

                              {/* List of Payment details */}
                              {(() => {
                                const payments = transactions.filter(t => 
                                  t.creditAcc === 'cash' || 
                                  (!t.creditAcc && t.paymentMode !== 'bank' && !t.source?.includes('Bank') && !t.description?.includes('SBL') && (t.type === 'expense' || t.type === 'disbursement'))
                                );
                                
                                if (payments.length === 0) {
                                  return (
                                    <div className="py-12 text-center text-slate-400 font-semibold border border-dashed border-slate-150 rounded-2xl text-xs">
                                      কোনো ক্যাশ পরিশোধ এখনও নেই।
                                    </div>
                                  );
                                }

                                return (
                                  <div className="overflow-x-auto">
                                    <table className="w-full text-left text-[11px] font-medium font-sans">
                                      <thead>
                                        <tr className="bg-slate-50 text-slate-500 border-b border-slate-100">
                                          <th className="py-2 px-3 font-bold">তারিখ ও আইডি</th>
                                          <th className="py-2 px-3 font-bold">বিবরণ / খাত</th>
                                          <th className="py-2 px-3 font-bold text-right">টাকা (৳)</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-slate-100">
                                        {payments.map(p => (
                                          <tr key={p.id} className="hover:bg-slate-50/50">
                                            <td className="py-2 px-3">
                                              <span className="font-mono text-[9px] text-blue-600 font-bold block">{p.id}</span>
                                              <span className="font-mono text-[8.5px] text-slate-400 block">{p.addDate}</span>
                                            </td>
                                            <td className="py-2 px-3">
                                              <span className="font-extrabold text-slate-800 text-[11.5px] block">{p.category || 'ব্যয় / বিতরণ'}</span>
                                              <span className="text-[9.5px] text-slate-400 italic block font-semibold leading-tight">{p.note || p.description}</span>
                                            </td>
                                            <td className="py-2 px-3 text-right font-black text-rose-750 font-mono">
                                              ৳{p.amount}
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                );
                              })()}
                            </div>

                          </div>

                          {/* Statement Summary of Selected Bank Account Ledger */}
                          {selectedBankStatementId && (
                            <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4 animate-in fade-in shadow-3xs">
                              {(() => {
                                const activeBank = bankAccounts.find(b => b.id === selectedBankStatementId);
                                if (!activeBank) return null;

                                const bankLedgerItems = transactions.filter(t => 
                                  t.debitAcc === selectedBankStatementId || 
                                  t.creditAcc === selectedBankStatementId ||
                                  (t.type === 'disbursement' && t.source?.includes('Bank') && selectedBankStatementId === 'bank-sbl')
                                );

                                return (
                                  <>
                                    <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                                      <div>
                                        <h4 className="font-extrabold text-slate-800 text-xs sm:text-sm flex items-center gap-1.5 uppercase font-sans">
                                          🏦 {activeBank.bankName} — খতিয়ান ও বিবরণী (Bank Statement Ledger)
                                        </h4>
                                        <p className="text-[10px] text-slate-400 font-semibold font-sans">
                                          হিসাব নম্বর: {activeBank.accountNo} | শাখা: {activeBank.branchName}
                                        </p>
                                      </div>
                                      <div className="text-right">
                                        <p className="text-[11px] text-slate-400 font-bold font-sans">লেজার ব্যালেন্স</p>
                                        <p className="font-black text-sm sm:text-base text-indigo-750">৳{getBankBalance(activeBank.id).toLocaleString('bn-BD')}</p>
                                      </div>
                                    </div>

                                    <div className="overflow-x-auto text-[11px] font-sans">
                                      <table className="w-full text-left font-sans">
                                        <thead>
                                          <tr className="bg-slate-50 text-slate-500 border-b border-slate-100 font-bold">
                                            <th className="py-2 px-3 font-sans">তারিখ ও আইডি</th>
                                            <th className="py-2 px-3 font-sans">বিবরণ / খাত</th>
                                            <th className="py-2 px-3 text-right font-sans">জমা (+) BDT</th>
                                            <th className="py-2 px-3 text-right font-sans font-bold">উত্তোলন (-) BDT</th>
                                            <th className="py-2 px-3 text-right font-sans">চলতি জের BDT</th>
                                          </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 font-medium">
                                          {/* Opening balance row */}
                                          <tr>
                                            <td className="py-2.5 px-3 font-mono text-slate-400">---</td>
                                            <td className="py-2.5 px-3 font-extrabold text-slate-500 font-sans">প্রারম্ভিক ব্যালেন্স (Opening Deposit)</td>
                                            <td className="py-2.5 px-3 text-right font-mono text-slate-400">-</td>
                                            <td className="py-2.5 px-3 text-right font-mono text-slate-400">-</td>
                                            <td className="py-2.5 px-3 text-right font-black font-mono text-indigo-600">৳{activeBank.initialBalance.toLocaleString('bn-BD')}</td>
                                          </tr>
                                          {(() => {
                                            let runningBal = Number(activeBank.initialBalance || 0);
                                            const sortedItems = [...bankLedgerItems].reverse(); 

                                            return sortedItems.map(item => {
                                              const isDep = item.debitAcc === selectedBankStatementId;
                                              const isWith = item.creditAcc === selectedBankStatementId || (item.type === 'disbursement' && item.source?.includes('Bank') && selectedBankStatementId === 'bank-sbl');
                                              
                                              if (isDep) runningBal += Number(item.amount || 0);
                                              if (isWith) runningBal -= Number(item.amount || 0);

                                              return (
                                                <tr key={item.id} className="hover:bg-slate-50/50">
                                                  <td className="py-2.5 px-3">
                                                    <span className="font-mono text-[9px] text-blue-600 font-bold block">{item.id}</span>
                                                    <span className="font-mono text-[9px] text-slate-400 block">{item.addDate}</span>
                                                  </td>
                                                  <td className="py-2.5 px-3">
                                                    <span className="font-bold text-slate-800 text-[11.5px] block">{item.category || item.description}</span>
                                                    <p className="text-[10px] text-slate-400 font-semibold pr-4">{item.note || 'কোন মন্তব্য নেই'}</p>
                                                  </td>
                                                  <td className="py-2.5 px-3 text-right font-mono text-emerald-700 font-black">
                                                    {isDep ? `+ ৳${item.amount}` : '-'}
                                                  </td>
                                                  <td className="py-2.5 px-3 text-right font-mono text-rose-700 font-black">
                                                    {isWith ? `- ৳${item.amount}` : '-'}
                                                  </td>
                                                  <td className="py-2.5 px-3 text-right font-mono text-indigo-700 font-black">
                                                    ৳{runningBal.toLocaleString('bn-BD')}
                                                  </td>
                                                </tr>
                                              );
                                            });
                                          })().reverse()}
                                        </tbody>
                                      </table>
                                    </div>
                                  </>
                                );
                              })()}
                            </div>
                          )}

                        </div>
                      );
                    })()}

                      {/* 2. DOUBLE ENTRY VOUCHER TELLER VIEW */}
                      {accountSubTab === 'double_entry' && (
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start animate-in fade-in duration-100">
                          
                          {/* Left Form: Voucher Entry Card (Debit / Credit Teller) */}
                          <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4 lg:col-span-1 shadow-xs">
                            <div className="border-b border-slate-100 pb-3">
                              <h4 className="font-extrabold text-slate-800 text-xs sm:text-sm flex items-center gap-1.5 font-sans">
                                <ArrowLeftRight className="w-4 h-4 text-blue-600" />
                                দ্বৈত দাখিলা ভাউচার অন্তর্ভুক্তি
                              </h4>
                              <p className="text-[10px] text-slate-400 font-semibold font-sans">দ্বিপাক্ষিক ডেবিট-ক্রেডিট হিসাব এন্ট্রি করুন</p>
                            </div>

                            <form onSubmit={handleSaveDoubleEntryVoucher} className="space-y-4 font-sans text-xs">
                              {/* Voucher Type selection */}
                              <div>
                                <label className="block text-[10px] font-extrabold text-slate-400 uppercase mb-1.5">ভাউচার ধরণ (Voucher Type) *</label>
                                <div className="grid grid-cols-2 gap-2">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setVoucherType('receipt');
                                      setVoucherDebitAcc('cash');
                                      setVoucherCreditAcc('admission_fee');
                                    }}
                                    className={`py-2 px-3 rounded-xl font-bold border transition duration-150 cursor-pointer ${
                                      voucherType === 'receipt' 
                                        ? 'bg-emerald-50 text-emerald-850 border-emerald-400' 
                                        : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                                    }`}
                                  >
                                    রিসিভ (Receipt / জমা)
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setVoucherType('payment');
                                      setVoucherDebitAcc('office_rent');
                                      setVoucherCreditAcc('cash');
                                    }}
                                    className={`py-2 px-3 rounded-xl font-bold border transition duration-150 cursor-pointer ${
                                      voucherType === 'payment' 
                                        ? 'bg-rose-50 text-rose-850 border-rose-400' 
                                        : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                                    }`}
                                  >
                                    পেমেন্ট (Payment / খরচ)
                                  </button>
                                </div>
                              </div>

                              {/* Voucher Date Selection */}
                              <div>
                                <label className="block text-[10px] font-extrabold text-slate-400 uppercase mb-1">
                                  ভাউচার তারিখ (Voucher Date) *
                                </label>
                                <input
                                  type="date"
                                  value={isSimulated ? voucherDateInput : workingDay}
                                  onChange={(e) => setVoucherDateInput(e.target.value)}
                                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono font-bold text-slate-800 focus:outline-none focus:border-blue-500 cursor-pointer"
                                  disabled={!isSimulated}
                                  required
                                />
                              </div>

                              {/* DR Account Selection */}
                              <div>
                                <label className="block text-[10px] font-extrabold text-slate-400 uppercase mb-1">
                                  ডেবিট অ্যাকাউন্ট খতিয়ান (Debit side - DR) *
                                </label>
                                {voucherType === 'receipt' ? (
                                  <select
                                    value={voucherDebitAcc}
                                    onChange={(e) => setVoucherDebitAcc(e.target.value)}
                                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-250 select-none font-bold text-xs rounded-xl focus:border-blue-500 cursor-pointer text-slate-800"
                                  >
                                    <option value="cash">💵 ক্যাশ বক্স (নগদ তহবিল)</option>
                                    {bankAccounts.map(b => (
                                      <option key={b.id} value={b.id}>🏦 {b.bankName} [A/C: {b.accountNo}]</option>
                                    ))}
                                  </select>
                                ) : (
                                  <select
                                    value={voucherDebitAcc}
                                    onChange={(e) => setVoucherDebitAcc(e.target.value)}
                                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-250 select-none font-bold text-xs rounded-xl focus:border-blue-500 cursor-pointer text-slate-800"
                                  >
                                    <option value="office_rent">🏢 অফিস ভাড়া (Office Rent)</option>
                                    <option value="staff_salaries">💼 কর্মী বেতন ও ভাতা (Staff Salary)</option>
                                    <option value="travel_allowance">🚊 যাতায়াত ও ভ্রমণ (Travel Expense)</option>
                                    <option value="staff_advance">🤝 কর্মী অগ্রিম প্রদান (Staff Advance)</option>
                                    <option value="general_loan_disburse">💸 ঋণ বিতরণ (সাধারণ ঋণ আসল কমানো)</option>
                                    <option value="risk_fund">🛡️ জীবন বীমা তহবিল ডেবিট (LSRF claims adjustment)</option>
                                    <option value="exemption_expense">📉 ঋণ মওকুফ ব্যয় (Exemption Expense)</option>
                                    <option value="other_expenses">🛠️ অন্যান্য প্রশাসনিক খরচ (Misc Expense)</option>
                                  </select>
                                )}
                              </div>

                              {/* CR Account Selection */}
                              <div>
                                <label className="block text-[10px] font-extrabold text-slate-400 uppercase mb-1">
                                  ক্রেডিট অ্যাকাউন্ট খতিয়ার (Credit side - CR) *
                                </label>
                                {voucherType === 'receipt' ? (
                                  <select
                                    value={voucherCreditAcc}
                                    onChange={(e) => setVoucherCreditAcc(e.target.value)}
                                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-250 select-none font-bold text-xs rounded-xl focus:border-blue-500 cursor-pointer text-slate-800"
                                  >
                                    <option value="admission_fee">🎟️ ভর্তিকরণ ফি (Admission Fee Income)</option>
                                    <option value="passbook_fee">📖 ঋণ বই ও ফরম বিক্রয় আয় (Passbook Revenue)</option>
                                    <option value="service_charge">📈 সার্ভিস চার্জ ও মুনাফা প্রাপ্তি (Service Charge)</option>
                                    <option value="savings_collection">💰 সদস্য সাধারণ সঞ্চয় জমা (Member Savings Collection)</option>
                                    <option value="bank_interest">💰 ব্যাংক জমাকৃত সুদ আয় (Bank Interest Income)</option>
                                    <option value="risk_fund">🛡️ জীবন বীমা প্রিমিয়াম জমা (LSRF Premium liability)</option>
                                    <option value="other_income">🎁 অন্যান্য সাধারণ বিবিধ আয় (Misc Income)</option>
                                  </select>
                                ) : (
                                  <select
                                    value={voucherCreditAcc}
                                    onChange={(e) => setVoucherCreditAcc(e.target.value)}
                                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-250 select-none font-bold text-xs rounded-xl focus:border-blue-500 cursor-pointer text-slate-800"
                                  >
                                    <option value="cash">💵 ক্যাশ বক্স (নগদ তহবিল)</option>
                                    <option value="general_loan_disburse">💸 সাধারণ ঋণ আসল ক্রেডিট (Loan outstanding settlement)</option>
                                    {bankAccounts.map(b => (
                                      <option key={b.id} value={b.id}>🏦 {b.bankName} [A/C: {b.accountNo}]</option>
                                    ))}
                                  </select>
                                )}
                              </div>

                              {/* Amount input */}
                              <div>
                                <label className="block text-[10px] font-extrabold text-slate-400 uppercase mb-1">টাকার পরিমাণ (Voucher Amount) *</label>
                                <div className="relative">
                                  <span className="absolute left-3.5 top-2.5 text-slate-550 font-black text-xs">৳</span>
                                  <input
                                    type="number"
                                    value={voucherAmount}
                                    onChange={(e) => setVoucherAmount(e.target.value)}
                                    placeholder="0.00"
                                    className="w-full pl-7 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono font-bold text-slate-850"
                                    required
                                  />
                                </div>
                              </div>

                              {/* Note input */}
                              <div>
                                <label className="block text-[10px] font-extrabold text-slate-400 uppercase mb-1">ভাউচার বিবরণী / মন্তব্য (Particulars) *</label>
                                <textarea
                                  value={voucherNote}
                                  onChange={(e) => setVoucherNote(e.target.value)}
                                  placeholder="ভাউচার বা নগদ হিসাব আদায়ের সংক্ষিপ্ত বর্ণনা..."
                                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold h-16 resize-none focus:outline-none text-slate-850"
                                  required
                                />
                              </div>

                              {/* Submit */}
                              <button
                                type="submit"
                                className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-extrabold rounded-2xl text-xs flex justify-center items-center gap-1.5 transition cursor-pointer shadow-md"
                              >
                                <CheckCircle2 size={15} /> ডাবল এন্ট্রি ভাউচার সংরক্ষণ করুন
                              </button>

                            </form>
                          </div>

                          {/* Right Lists: Journal of Vouchers */}
                          <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4 lg:col-span-2 shadow-xs">
                            <div>
                              <h4 className="font-extrabold text-slate-800 text-xs sm:text-sm font-sans">ডাবল এন্ট্রি ভাউচার খতিয়ান (Double Entry Journal Ledger)</h4>
                              <p className="text-[10px] text-slate-400 font-semibold font-sans">শাখার সকল বৈধ দ্বিমুখী আর্থিক দলিলাাদি ও ভাউচার রেজিস্টার</p>
                            </div>

                            {transactions.length === 0 ? (
                              <div className="text-center py-16 text-slate-400 border border-dashed border-slate-200 rounded-3xl">
                                <ArrowLeftRight size={32} className="mx-auto text-slate-300 stroke-1 mb-2" />
                                <p className="text-xs font-bold text-slate-500 font-sans">কোনো আর্থিক ভাউচার এখনো রেকর্ড করা হয়নি।</p>
                              </div>
                            ) : (
                              <div className="overflow-x-auto">
                                <table className="w-full text-left font-sans text-[11px] font-medium">
                                  <thead>
                                    <tr className="bg-slate-50 text-slate-500 border-b border-slate-150 font-bold">
                                      <th className="py-2.5 px-3">ভাউচার আইডি</th>
                                      <th className="py-2.5 px-3">লেনদেন খতিয়ান বিবরণী</th>
                                      <th className="py-2.5 px-3">ডেবিট খাত (DR)</th>
                                      <th className="py-2.5 px-3">ক্রেডিট খাত (CR)</th>
                                      <th className="py-2.5 px-3 text-right">পরিমাণ (৳)</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-100 font-bold text-slate-800">
                                    {transactions.map(t => {
                                      // Determine names of DR and CR accounts visually
                                      let drLabel = '-';
                                      if (t.debitAcc === 'cash') drLabel = '💵 হাতে নগদ (Cash)';
                                      else if (t.debitAcc?.startsWith('bank')) {
                                        const b = bankAccounts.find(bank => bank.id === t.debitAcc);
                                        drLabel = b ? `🏦 ${b.bankName.slice(0, 15)}...` : '🏦 ব্যাংক হিসাব';
                                      } else if (t.debitAcc) {
                                        drLabel = t.debitAcc === 'office_rent' ? '🏢 অফিস ভাড়া' : t.debitAcc === 'staff_salaries' ? '💼 কর্মী বেতন' : t.debitAcc === 'travel_allowance' ? '🚊 যাতায়াত' : t.debitAcc === 'staff_advance' ? '🤝 কর্মী অগ্রিম' : t.debitAcc;
                                      } else {
                                        drLabel = (t.type === 'income' || t.type === 'collection') ? '💵 হাতে নগদ (Cash)' : '-';
                                      }

                                      let crLabel = '-';
                                      if (t.creditAcc === 'cash') crLabel = '💵 হাতে নগদ (Cash)';
                                      else if (t.creditAcc?.startsWith('bank')) {
                                        const b = bankAccounts.find(bank => bank.id === t.creditAcc);
                                        crLabel = b ? `🏦 ${b.bankName.slice(0, 15)}...` : '🏦 ব্যাংক হিসাব';
                                      } else if (t.creditAcc) {
                                        crLabel = t.creditAcc === 'admission_fee' ? '🎟️ ভর্তিকরণ ফি' : t.creditAcc === 'passbook_fee' ? '📖 পাসবুক বিক্রয়' : t.creditAcc === 'service_charge' ? '📈 সার্ভিস চার্জ' : t.creditAcc === 'savings_collection' ? '💰 সঞ্চয় সংগ্রহ' : t.creditAcc;
                                      } else {
                                        crLabel = (t.type === 'expense' || t.type === 'disbursement') ? '💵 হাতে নগদ (Cash)' : (t.type === 'collection' ? '💰 সঞ্চয় সংগ্রহ ও কিস্তি' : '-');
                                      }

                                      return (
                                        <tr key={t.id} className="hover:bg-slate-50/40">
                                          <td className="py-3 px-3">
                                            <span className="font-mono text-blue-650 text-[11px] font-black block">{t.id}</span>
                                            <span className="font-mono text-[9px] text-slate-400 block">{t.addDate}</span>
                                          </td>
                                          <td className="py-3 px-3">
                                            <p className="text-slate-800 text-[11.5px] font-extrabold leading-tight">{t.category || t.description}</p>
                                            <p className="text-[10px] text-slate-400 italic font-semibold leading-tight">{t.note || t.description}</p>
                                          </td>
                                          <td className="py-3 px-3 text-emerald-800 text-[11px]">
                                            {drLabel}
                                          </td>
                                          <td className="py-3 px-3 text-indigo-850 text-[11px] text-indigo-755 font-bold">
                                            {crLabel}
                                          </td>
                                          <td className={`py-3 px-3 text-right font-black text-xs font-mono ${
                                            t.type === 'income' || t.type === 'collection' ? 'text-emerald-700' : 'text-rose-700'
                                          }`}>
                                            {t.type === 'income' || t.type === 'collection' ? '+' : '-'} ৳{t.amount.toLocaleString('bn-BD')}
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </div>
                        </div>
                      )}



                      {accountSubTab === 'journal' && (
                        <div className="space-y-6 animate-in fade-in duration-100 min-h-[550px] w-full">
                          <GeneralJournalView 
                            transactions={transactions} 
                            bankAccounts={bankAccounts} 
                            workingDay={workingDay} 
                            onAddTransactions={(newTxs) => setTransactions(prev => [...newTxs, ...prev])}
                            onDeleteTransaction={(id) => setTransactions(prev => prev.filter(t => t.id !== id))}
                            onUpdateTransaction={(id, updatedTx) => setTransactions(prev => prev.map(t => t.id === id ? { ...t, ...updatedTx } : t))}
                            voucherDate={journalVoucherDate}
                            setVoucherDate={setJournalVoucherDate}
                          />
                        </div>
                      )}
                      {accountSubTab === 'ledger' && (() => {
                        // Chronological sorting of transactions (oldest first)
                        const chronologicalTx = [...transactions].sort((a, b) => a.addDate.localeCompare(b.addDate));

                        // Ledger Head Accounts selector config
                        const ledgerAccountsList = [
                          { value: 'cash', label: '💵 হাতে নগদ খতিয়ান (Cash Ledger)', type: 'asset' },
                          { value: 'current_ac', label: '🏦 ব্যাংক চলতি হিসাব গ্রুপ খতিয়ান (Current Accounts Group)', type: 'bank_group' },
                          { value: 'savings_ac', label: '🏦 ব্যাংক সঞ্চয়ী হিসাব গ্রুপ খতিয়ান (Savings Accounts Group)', type: 'bank_group' },
                          { value: 'fdr', label: '🏦 স্থায়ী আমানত গ্রুপ খতিয়ান (FDR Accounts Group)', type: 'bank_group' },
                          ...bankAccounts.map(b => ({ 
                            value: b.id, 
                            label: `🏦 ${b.bankName} [A/C: ${b.accountNo}]`, 
                            type: 'bank' 
                          })),
                          { value: 'office_rent', label: '🏢 অফিস ভাড়া (Office Rent)', type: 'expense' },
                          { value: 'staff_salaries', label: '💼 কর্মী বেতন ও ভাতা (Staff Salaries)', type: 'expense' },
                          { value: 'travel_allowance', label: '🚊 যাতায়াত ও ভ্রমণ (Travel Expense)', type: 'expense' },
                          { value: 'staff_advance', label: '🤝 কর্মী অগ্রিম প্রদান (Staff Advance)', type: 'expense' },
                          { value: 'general_loan_disburse', label: '💸 ঋণ বিতরণ (Loan Disbursement - Portfolio)', type: 'expense' },
                          { value: 'other_expenses', label: '🛠️ অন্যান্য প্রশাসনিক খরচ (Misc Expense)', type: 'expense' },
                          { value: 'risk_fund', label: '🛡️ জীবন বীমা তহবিল সমন্বয় (LSRF Account)', type: 'liability' },
                          { value: 'exemption_expense', label: '📉 ঋণ মওকুফ ব্যয় খতিয়ান (Exemption Expense)', type: 'expense' },
                          { value: 'admission_fee', label: '🎟️ ভর্তিকরণ ফি আদায় (Admission Fees)', type: 'income' },
                          { value: 'passbook_fee', label: '📖 ঋণ পাসবুক বিক্রয় আয় (Passbook Revenue)', type: 'income' },
                          { value: 'service_charge', label: '📈 সার্ভিস চার্জ আদায় (Service Charge Income)', type: 'income' },
                          { value: 'savings_collection', label: '💰 সদস্য সঞ্চয় সংগ্রহ (Member Savings)', type: 'income' },
                          { value: 'bank_interest', label: '💰 ব্যাংক সঞ্চয়ের সুদ প্রাপ্তি (Bank Interest)', type: 'income' },
                          { value: 'other_income', label: '🎁 বিবিধ সাধারণ আয় (Misc Income)', type: 'income' }
                        ];

                        // Match transactions associated with the selected head
                        const isTxMatchedToHead = (t: any, head: string) => {
                          if (head === 'all') return true;
                          if (head === 'cash') {
                            if (t.debitAcc === 'cash' || t.creditAcc === 'cash') return true;
                            if (!t.debitAcc && !t.creditAcc) {
                              if (t.type === 'income' || t.type === 'collection') return true;
                              if (t.type === 'expense' || t.type === 'disbursement') return true;
                            }
                            return false;
                          }

                          // Handle bank group selection (current_ac, savings_ac, fdr)
                          if (head === 'current_ac' || head === 'savings_ac' || head === 'fdr') {
                            if (selectedLedgerBankId !== 'all') {
                              return t.debitAcc === selectedLedgerBankId || t.creditAcc === selectedLedgerBankId;
                            }
                            // Otherwise check if any bank account of that group matches
                            const matchingBankIds = bankAccounts
                              .filter(b => {
                                const type = b.accountType?.toLowerCase() || '';
                                if (head === 'current_ac') {
                                  return type.includes('current') || type.includes('চলতি') || type.includes('snd') || type.includes('এসএনডি');
                                } else if (head === 'savings_ac') {
                                  return type.includes('savings') || type.includes('সঞ্চয়ী') || type.includes('সঞ্চয়') || type.includes('সঞ্চয়ী');
                                } else {
                                  return type.includes('fdr') || type.includes('স্থায়ী') || type.includes('স্থায়ী');
                                }
                              })
                              .map(b => b.id);
                            return matchingBankIds.includes(t.debitAcc) || matchingBankIds.includes(t.creditAcc);
                          }

                          return t.debitAcc === head || t.creditAcc === head;
                        };

                        // Determine debit/credit side relative to the selected head
                        const getLedgerDrCr = (t: any, head: string) => {
                          let isDr = false;
                          let isCr = false;

                          if (head === 'current_ac' || head === 'savings_ac' || head === 'fdr') {
                            if (selectedLedgerBankId !== 'all') {
                              if (t.debitAcc === selectedLedgerBankId) isDr = true;
                              else if (t.creditAcc === selectedLedgerBankId) isCr = true;
                            } else {
                              const matchingBankIds = bankAccounts
                                .filter(b => {
                                  const type = b.accountType?.toLowerCase() || '';
                                  if (head === 'current_ac') {
                                    return type.includes('current') || type.includes('চলতি') || type.includes('snd') || type.includes('এসএনডি');
                                  } else if (head === 'savings_ac') {
                                    return type.includes('savings') || type.includes('সঞ্চয়ী') || type.includes('সঞ্চয়') || type.includes('সঞ্চয়ী');
                                  } else {
                                    return type.includes('fdr') || type.includes('স্থায়ী') || type.includes('স্থায়ী');
                                  }
                                })
                                .map(b => b.id);
                              
                              if (matchingBankIds.includes(t.debitAcc)) isDr = true;
                              else if (matchingBankIds.includes(t.creditAcc)) isCr = true;
                            }
                          } else if (t.debitAcc === head) {
                            isDr = true;
                          } else if (t.creditAcc === head) {
                            isCr = true;
                          } else if (!t.debitAcc && !t.creditAcc) {
                            if (head === 'cash') {
                              if (t.type === 'income' || t.type === 'collection') isDr = true;
                              if (t.type === 'expense' || t.type === 'disbursement') isCr = true;
                            } else {
                              if (t.type === 'income' || t.type === 'collection') isCr = true;
                              if (t.type === 'expense' || t.type === 'disbursement') isDr = true;
                            }
                          }
                          return { isDr, isCr };
                        };

                        // Check debit/credit normal balance nature
                        const isDebitNature = (head: string) => {
                          if (head === 'cash') return true;
                          if (head === 'current_ac' || head === 'savings_ac' || head === 'fdr') return true;
                          if (head.startsWith('bank') || !isNaN(Number(head))) return true; 
                          const debitNormalHeads = [
                            'office_rent', 'staff_salaries', 'travel_allowance', 
                            'staff_advance', 'general_loan_disburse', 'other_expenses', 'exemption_expense'
                          ];
                          return debitNormalHeads.includes(head);
                        };

                        const isDebitNormal = isDebitNature(selectedLedgerHead);

                        // 1. Calculate Opening Balance before the start date
                        const priorTransactions = chronologicalTx.filter((t: any) => {
                          if (!isTxMatchedToHead(t, selectedLedgerHead)) return false;
                          if (ledgerStartDate && t.addDate < ledgerStartDate) return true;
                          return false;
                        });

                        let openingBalance = 0;
                        if (selectedLedgerHead === 'current_ac' || selectedLedgerHead === 'savings_ac' || selectedLedgerHead === 'fdr') {
                          const matchingBanks = bankAccounts.filter(b => {
                            const type = b.accountType?.toLowerCase() || '';
                            if (selectedLedgerHead === 'current_ac') {
                              return type.includes('current') || type.includes('চলতি') || type.includes('snd') || type.includes('এসএনডি');
                            } else if (selectedLedgerHead === 'savings_ac') {
                              return type.includes('savings') || type.includes('সঞ্চয়ী') || type.includes('সঞ্চয়') || type.includes('সঞ্চয়ী');
                            } else {
                              return type.includes('fdr') || type.includes('স্থায়ী') || type.includes('স্থায়ী');
                            }
                          });

                          if (selectedLedgerBankId !== 'all') {
                            const singleBank = matchingBanks.find(b => b.id === selectedLedgerBankId);
                            if (singleBank) {
                              openingBalance += Number(singleBank.initialBalance) || 0;
                            }
                          } else {
                            matchingBanks.forEach(b => {
                              openingBalance += Number(b.initialBalance) || 0;
                            });
                          }
                        } else if (selectedLedgerHead.startsWith('bank')) {
                          const bank = bankAccounts.find(b => b.id === selectedLedgerHead);
                          if (bank) {
                            openingBalance += Number(bank.initialBalance) || 0;
                          }
                        }

                        priorTransactions.forEach((t: any) => {
                          const { isDr, isCr } = getLedgerDrCr(t, selectedLedgerHead);
                          const amt = Number(t.amount) || 0;
                          if (isDebitNormal) {
                            if (isDr) openingBalance += amt;
                            if (isCr) openingBalance -= amt;
                          } else {
                            if (isCr) openingBalance += amt;
                            if (isDr) openingBalance -= amt;
                          }
                        });

                        // 2. Filter Active Transactions in Selected Range/Search
                        const activeTxList = chronologicalTx.filter((t: any) => {
                          if (!isTxMatchedToHead(t, selectedLedgerHead)) return false;
                          if (ledgerStartDate && t.addDate < ledgerStartDate) return false;
                          if (ledgerEndDate && t.addDate > ledgerEndDate) return false;

                          if (ledgerSearchQuery.trim() !== '') {
                            const q = ledgerSearchQuery.toLowerCase();
                            const idMatch = t.id?.toLowerCase().includes(q);
                            const catMatch = t.category?.toLowerCase().includes(q);
                            const noteMatch = t.note?.toLowerCase().includes(q);
                            const amtMatch = t.amount?.toString().includes(q);
                            if (!idMatch && !catMatch && !noteMatch && !amtMatch) {
                              return false;
                            }
                          }
                          return true;
                        });

                        // 3. Generate Statement Rows with Running Balance
                        let currentBal = openingBalance;
                        const statementRows = activeTxList.map((t: any) => {
                          const { isDr, isCr } = getLedgerDrCr(t, selectedLedgerHead);
                          const amt = Number(t.amount) || 0;

                          if (isDebitNormal) {
                            if (isDr) currentBal += amt;
                            if (isCr) currentBal -= amt;
                          } else {
                            if (isCr) currentBal += amt;
                            if (isDr) currentBal -= amt;
                          }

                          return {
                            ...t,
                            isDr,
                            isCr,
                            runningBalance: currentBal
                          };
                        });

                        // Calculate total DR and CR within period
                        const totalDrInPeriod = statementRows.reduce((sum, row) => sum + (row.isDr ? Number(row.amount) || 0 : 0), 0);
                        const totalCrInPeriod = statementRows.reduce((sum, row) => sum + (row.isCr ? Number(row.amount) || 0 : 0), 0);
                        const closingBalance = statementRows.length > 0 ? statementRows[statementRows.length - 1].runningBalance : openingBalance;

                        return (
                          <div className="space-y-6 animate-in fade-in duration-100">
                            
                            {/* General Ledger Header Block */}
                            <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
                              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 border-b border-slate-100 pb-3">
                                <div>
                                  <h4 className="font-extrabold text-slate-800 text-xs sm:text-sm font-sans flex items-center gap-1.5">
                                    <ClipboardList className="w-4.5 h-4.5 text-[#2f6ce5]" />
                                    সাধারণ খতিয়ান বই (General Ledger Accounts Statement)
                                  </h4>
                                  <p className="text-[10px] text-slate-400 font-semibold font-sans">
                                    শাখার ক্যাশ ও ব্যাংক সহ সকল হিসাব খাতের প্রারম্ভিক ও সমাপনী জের বিবরণী
                                  </p>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => window.print()}
                                  className="px-3 py-1.5 border border-slate-200 hover:bg-slate-50 text-slate-650 rounded-lg text-xs font-bold font-sans flex items-center gap-1 cursor-pointer transition shadow-3xs"
                                >
                                  <Printer size={13} /> প্রিন্ট করুন 
                                </button>
                              </div>

                              {/* FILTER TOOLBAR */}
                              <div className="bg-slate-50 border border-slate-150 p-4 rounded-xl space-y-3.5">
                                <div className="text-[10.5px] font-black text-slate-600 font-sans flex items-center gap-1">
                                  <Sliders className="w-3.5 h-3.5 text-[#2f6ce5]" />
                                  <span>অ্যাডভান্সড খতিয়ান ফিল্টারিং টুলস</span>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                                  
                                  {/* Select Account Head Dropdown */}
                                  <div>
                                    <label className="block text-[10px] text-slate-500 font-bold mb-1">হিসাব খাত (Account Head) *</label>
                                    <select
                                      value={selectedLedgerHead}
                                      onChange={(e) => setSelectedLedgerHead(e.target.value)}
                                      className="w-full px-3 py-2 bg-white border border-slate-200 focus:border-blue-500 font-bold text-xs rounded-xl text-slate-800 focus:outline-none cursor-pointer"
                                    >
                                      {ledgerAccountsList.map((acc) => (
                                        <option key={acc.value} value={acc.value}>
                                          {acc.label}
                                        </option>
                                      ))}
                                    </select>

                                    {/* Sub-selector for specific registered bank accounts under current_ac/savings_ac/fdr */}
                                    {(selectedLedgerHead === 'current_ac' || selectedLedgerHead === 'savings_ac' || selectedLedgerHead === 'fdr') && (
                                      <div className="mt-2.5 animate-in slide-in-from-top-1 duration-100">
                                        <label className="block text-[9px] text-[#2f6ce5] font-black uppercase mb-1">নির্দিষ্ট ব্যাংক হিসাব (Specific Account) *</label>
                                        <select
                                          value={selectedLedgerBankId}
                                          onChange={(e) => setSelectedLedgerBankId(e.target.value)}
                                          className="w-full px-2.5 py-1.5 bg-blue-50/50 border border-blue-200 focus:border-blue-500 font-bold text-[11px] rounded-xl text-slate-800 focus:outline-none cursor-pointer"
                                        >
                                          <option value="all">
                                            {selectedLedgerHead === 'current_ac' ? '📋 সকল চলতি হিসাব (All Current Accounts)' :
                                             selectedLedgerHead === 'savings_ac' ? '📋 সকল সঞ্চয়ী হিসাব (All Savings Accounts)' :
                                             '📋 সকল স্থায়ী আমানত হিসাব (All FDR Accounts)'}
                                          </option>
                                          {bankAccounts
                                            .filter(b => {
                                              const type = b.accountType?.toLowerCase() || '';
                                              if (selectedLedgerHead === 'current_ac') {
                                                return type.includes('current') || type.includes('চলতি') || type.includes('snd') || type.includes('এসএনডি');
                                              } else if (selectedLedgerHead === 'savings_ac') {
                                                return type.includes('savings') || type.includes('সঞ্চয়ী') || type.includes('সঞ্চয়') || type.includes('সঞ্চয়ী');
                                              } else {
                                                return type.includes('fdr') || type.includes('স্থায়ী') || type.includes('স্থায়ী');
                                              }
                                            })
                                            .map(b => (
                                              <option key={b.id} value={b.id}>
                                                🏦 {b.bankName} [A/C: {b.accountNo}]
                                              </option>
                                            ))
                                          }
                                        </select>
                                      </div>
                                    )}
                                  </div>

                                  {/* Start Date */}
                                  <div>
                                    <label className="block text-[10px] text-slate-500 font-bold mb-1">শুরুর তারিখ (Start Date)</label>
                                    <input
                                      type="date"
                                      value={ledgerStartDate}
                                      onChange={(e) => setLedgerStartDate(e.target.value)}
                                      className="w-full px-3 py-1.5 bg-white border border-slate-200 focus:border-blue-500 font-bold text-xs rounded-xl text-slate-800 focus:outline-none"
                                    />
                                  </div>

                                  {/* End Date */}
                                  <div>
                                    <label className="block text-[10px] text-slate-500 font-bold mb-1">শেষের তারিখ (End Date)</label>
                                    <input
                                      type="date"
                                      value={ledgerEndDate}
                                      onChange={(e) => setLedgerEndDate(e.target.value)}
                                      className="w-full px-3 py-1.5 bg-white border border-slate-200 focus:border-blue-500 font-bold text-xs rounded-xl text-slate-800 focus:outline-none"
                                    />
                                  </div>

                                  {/* Search Box */}
                                  <div>
                                    <label className="block text-[10px] text-slate-500 font-bold mb-1">মন্তব্য বা আইডি দিয়ে সার্চ করুন</label>
                                    <div className="relative">
                                      <input
                                        type="text"
                                        placeholder="সার্চ করুন..."
                                        value={ledgerSearchQuery}
                                        onChange={(e) => setLedgerSearchQuery(e.target.value)}
                                        className="w-full pl-8 pr-3 py-2 bg-white border border-slate-200 focus:border-blue-500 font-bold text-xs rounded-xl text-slate-800 focus:outline-none"
                                      />
                                      <span className="absolute left-2.5 top-2.5 text-slate-400">
                                        <Search size={12} />
                                      </span>
                                    </div>
                                  </div>

                                </div>

                                {/* Reset Filter Button */}
                                {(ledgerStartDate || ledgerEndDate || ledgerSearchQuery || selectedLedgerHead !== 'cash') && (
                                  <div className="flex justify-end pt-1">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setLedgerStartDate('');
                                        setLedgerEndDate('');
                                        setLedgerSearchQuery('');
                                        setSelectedLedgerHead('cash');
                                      }}
                                      className="px-3 py-1 text-slate-700 bg-slate-200 hover:bg-slate-300 font-extrabold text-[10px] rounded-lg cursor-pointer border-0 transition"
                                    >
                                      ফিল্টার রিসেট
                                    </button>
                                  </div>
                                )}
                              </div>

                              {/* Statistical balances layout card */}
                              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                                <div className="p-3.5 bg-indigo-50 border border-indigo-100 rounded-2xl flex flex-col justify-center">
                                  <span className="text-[10px] uppercase font-extrabold text-indigo-700 font-sans">প্রারম্ভিক জের (Opening)</span>
                                  <strong className="text-sm font-black text-indigo-950 font-mono mt-0.5">৳{openingBalance.toLocaleString('bn-BD')}</strong>
                                </div>
                                <div className="p-3.5 bg-emerald-50 border border-emerald-100 rounded-2xl flex flex-col justify-center">
                                  <span className="text-[10px] uppercase font-extrabold text-emerald-700 font-sans">মোট ডেবিট (Debit Side)</span>
                                  <strong className="text-sm font-black text-emerald-950 font-mono mt-0.5">৳{totalDrInPeriod.toLocaleString('bn-BD')}</strong>
                                </div>
                                <div className="p-3.5 bg-rose-50 border border-rose-100 rounded-2xl flex flex-col justify-center">
                                  <span className="text-[10px] uppercase font-extrabold text-rose-700 font-sans">মোট ক্রেডিট (Credit Side)</span>
                                  <strong className="text-sm font-black text-rose-950 font-mono mt-0.5">৳{totalCrInPeriod.toLocaleString('bn-BD')}</strong>
                                </div>
                                <div className="p-3.5 bg-blue-50 border border-blue-105 rounded-2xl flex flex-col justify-center">
                                  <span className="text-[10px] uppercase font-extrabold text-blue-700 font-sans">সমাপনী খতিয়ান উদ্বৃত্ত</span>
                                  <strong className="text-sm font-black text-blue-950 font-mono mt-0.5 animate-pulse">৳{closingBalance.toLocaleString('bn-BD')}</strong>
                                </div>
                              </div>

                              {/* STATEMENT TABLE SUMMARY LIST */}
                              <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-3xs bg-white">
                                <div className="p-3.5 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
                                  <strong className="text-xs text-slate-800 font-extrabold font-sans flex items-center gap-1">
                                    <FileText size={14} className="text-[#2f6ce5]" />
                                    <span>খতিয়ান হিসাব খাতা বিবরণী (Ledger Entries Statement)</span>
                                  </strong>
                                  <span className="text-[9px] bg-slate-200 font-extrabold text-slate-600 px-2.5 py-0.5 rounded-lg">
                                    মোট লেনদেন: {statementRows.length.toLocaleString('bn-BD')} টি
                                  </span>
                                </div>

                                <div className="overflow-x-auto">
                                  <table className="w-full text-left font-sans text-[11px] border-collapse">
                                    <thead>
                                      <tr className="bg-slate-50/70 border-b border-slate-200 text-slate-500 font-bold">
                                        <th className="p-3 text-center">তারিখ</th>
                                        <th className="p-3">আইডি / ভাউচার</th>
                                        <th className="p-3">হিসাব খাত / শ্রেণি</th>
                                        <th className="p-3">মন্তব্য / ন্যারেশন (Particulars)</th>
                                        <th className="p-3 text-right">ডেবিট (Debit - DR) ৳</th>
                                        <th className="p-3 text-right">ক্রেডিট (Credit - CR) ৳</th>
                                        <th className="p-3 text-right">চলতি জের (Balance) ৳</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 font-bold text-slate-800">
                                      
                                      {/* Opening row */}
                                      <tr className="bg-slate-50/20 text-slate-450 italic">
                                        <td className="p-3 text-center font-mono">{ledgerStartDate || '-'}</td>
                                        <td className="p-3 text-slate-400 font-mono">OPB-000</td>
                                        <td className="p-3 font-bold">প্রারম্ভিক ব্যালেন্স (Opening Balance)</td>
                                        <td className="p-3 font-semibold text-[10px]">নির্বাচিত তারিখ সীমার পূর্বে সঞ্চিত লেজার উদ্বৃত্ত জের</td>
                                        <td className="p-3 text-right">-</td>
                                        <td className="p-3 text-right">-</td>
                                        <td className="p-3 text-right font-mono text-slate-600">
                                          ৳{openingBalance.toLocaleString('bn-BD')}
                                        </td>
                                      </tr>

                                      {statementRows.length === 0 ? (
                                        <tr>
                                          <td colSpan={7} className="p-12 text-center text-slate-400 font-sans">
                                            <ClipboardList className="w-10 h-10 text-slate-300 mx-auto mb-2.5" />
                                            <strong className="text-xs font-black block text-slate-650">কোনো খতিয়ান রেকর্ড পাওয়া যায়নি!</strong>
                                            <p className="text-[10px] text-slate-400 mt-1">অনুগ্রহ করে তারিখ সীমা বা ফিল্টারের হিসাব পরিবর্তন করে পুনরায় চেষ্টা করুন।</p>
                                          </td>
                                        </tr>
                                      ) : (
                                        statementRows.map((row: any) => {
                                          return (
                                            <tr key={row.id} className="hover:bg-slate-50/40 text-xs text-slate-700">
                                              <td className="p-3 text-center font-mono font-bold">{row.addDate}</td>
                                              <td className="p-3">
                                                <span className="font-mono text-[10px] bg-slate-100 text-slate-650 px-2 py-0.5 rounded-md font-black">{row.id}</span>
                                              </td>
                                              <td className="p-3 font-extrabold text-[#2f6ce5]">
                                                {row.category || 'সাধারণ হিসাব'}
                                              </td>
                                              <td className="p-3 text-slate-500 font-medium max-w-[170px] truncate" title={row.note}>
                                                {row.note}
                                              </td>
                                              <td className="p-3 text-right text-emerald-700 font-mono">
                                                {row.isDr ? `৳${row.amount.toLocaleString('bn-BD')}` : '-'}
                                              </td>
                                              <td className="p-3 text-right text-rose-700 font-mono">
                                                {row.isCr ? `৳${row.amount.toLocaleString('bn-BD')}` : '-'}
                                              </td>
                                              <td className="p-3 text-right font-mono text-slate-900 font-black">
                                                ৳{row.runningBalance.toLocaleString('bn-BD')}
                                              </td>
                                            </tr>
                                          );
                                        })
                                      )}

                                    </tbody>
                                  </table>
                                </div>
                              </div>

                            </div>
                          </div>
                        );
                      })()}
                      {accountSubTab === 'coa' && (
                        <div className="space-y-6 animate-in fade-in duration-100">
                          <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
                            <div className="border-b border-slate-100 pb-3">
                              <h4 className="font-extrabold text-slate-800 text-xs sm:text-sm font-sans">হিসাব তালিকা এবং ব্যালেন্স শীট (MRA Chart of Accounts & Trial Balance)</h4>
                              <p className="text-[10px] text-slate-400 font-semibold font-sans">মাইক্রোফাইন্যান্স রেগুলেটরি অথরিটি (MRA) কর্তৃক অনুমোদিত হিসাব কোড সমূহ</p>
                            </div>
                            <ChartOfAccountsView onReset={resetAccounting} balances={coaBalances} />
                          </div>
                        </div>
                      )}

                      {accountSubTab === 'depreciation' && (
                        <div className="space-y-6 animate-in fade-in duration-100 font-sans">
                          {/* Top stats or settings block */}
                          <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4 shadow-3xs">
                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-100 pb-3">
                              <div>
                                <h4 className="font-extrabold text-slate-800 text-xs sm:text-sm flex items-center gap-1.5">
                                  <span>⚙️ স্থায়ী সম্পদের অবচয় তালিকা ও শিডিউল (Depreciation Schedule)</span>
                                </h4>
                                <p className="text-[10px] text-slate-400 font-semibold mt-0.5">প্রতিষ্ঠানের স্থায়ী সম্পদের বাৎসরিক/মাসিক অবচয় হিসাব এবং সাধারণ জাবেদা পোস্টিং</p>
                              </div>
                              <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl text-[10.5px] font-bold">
                                <button
                                  type="button"
                                  onClick={() => setDepPeriod('monthly')}
                                  className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${depPeriod === 'monthly' ? 'bg-white text-indigo-750 shadow-3xs' : 'text-slate-500 hover:text-slate-750'}`}
                                >
                                  মাসিক (Monthly)
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setDepPeriod('yearly')}
                                  className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${depPeriod === 'yearly' ? 'bg-white text-indigo-750 shadow-3xs' : 'text-slate-500 hover:text-slate-750'}`}
                                >
                                  বাৎসরিক (Yearly)
                                </button>
                              </div>
                            </div>

                            {/* Configuration form for rates */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-xl">
                              <div>
                                <label className="block text-[10px] font-extrabold text-slate-450 uppercase mb-1">জমি ও ভবন অবচয় হার (%)</label>
                                <input
                                  type="number"
                                  value={depRateBuilding}
                                  onChange={(e) => setDepRateBuilding(e.target.value)}
                                  className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-slate-800 font-mono font-bold focus:outline-none focus:border-indigo-500"
                                />
                              </div>
                              <div>
                                <label className="block text-[10px] font-extrabold text-slate-450 uppercase mb-1">আসবাবপত্র অবচয় হার (%)</label>
                                <input
                                  type="number"
                                  value={depRateFurniture}
                                  onChange={(e) => setDepRateFurniture(e.target.value)}
                                  className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-slate-800 font-mono font-bold focus:outline-none focus:border-indigo-500"
                                />
                              </div>
                              <div>
                                <label className="block text-[10px] font-extrabold text-slate-450 uppercase mb-1">কম্পিউটার/আইটি অবচয় হার (%)</label>
                                <input
                                  type="number"
                                  value={depRateComputer}
                                  onChange={(e) => setDepRateComputer(e.target.value)}
                                  className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-slate-800 font-mono font-bold focus:outline-none focus:border-indigo-500"
                                />
                              </div>
                              <div>
                                <label className="block text-[10px] font-extrabold text-slate-450 uppercase mb-1">যানবাহন অবচয় হার (%)</label>
                                <input
                                  type="number"
                                  value={depRateVehicle}
                                  onChange={(e) => setDepRateVehicle(e.target.value)}
                                  className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-slate-800 font-mono font-bold focus:outline-none focus:border-indigo-500"
                                />
                              </div>
                            </div>

                            {/* Depreciation calculation table */}
                            {(() => {
                              const assets = [
                                { id: 'land_building', name: 'জমি ও ভবন (Land & Building)', code: '1301', balance: coaBalances.land_building || 0, rate: Number(depRateBuilding) || 0 },
                                { id: 'furniture', name: 'অফিস আসবাবপত্র ও ফিক্সচার (Furniture & Fixture)', code: '1302', balance: coaBalances.furniture || 0, rate: Number(depRateFurniture) || 0 },
                                { id: 'computer_it', name: 'কম্পিউটার ও আইটি সরঞ্জাম (Computer & IT)', code: '1303', balance: coaBalances.computer_it || 0, rate: Number(depRateComputer) || 0 },
                                { id: 'vehicles', name: 'যানবাহন/মোটরসাইকেল (Vehicles)', code: '1304', balance: coaBalances.vehicles || 0, rate: Number(depRateVehicle) || 0 }
                              ];

                              const totalInitial = assets.reduce((sum, a) => sum + a.balance, 0);
                              
                              const calculatedAssets = assets.map(a => {
                                const factor = depPeriod === 'monthly' ? (12 * 100) : 100;
                                const depAmt = Math.round(a.balance * (a.rate / factor));
                                const finalVal = Math.max(0, a.balance - depAmt);
                                return { ...a, depAmt, finalVal };
                              });

                              const totalDepAmt = calculatedAssets.reduce((sum, a) => sum + a.depAmt, 0);
                              const totalFinalVal = calculatedAssets.reduce((sum, a) => sum + a.finalVal, 0);

                              const handlePostDepreciation = () => {
                                if (totalDepAmt <= 0) {
                                  alert('অবচয়যোগ্য কোনো সম্পদ বা পরিমাণ পাওয়া যায়নি।');
                                  return;
                                }

                                if (!confirm(`আপনি কি নির্বাচিত ${calculatedAssets.filter(a => a.depAmt > 0).length}টি স্থায়ী সম্পদের সর্বমোট ৳${totalDepAmt} টাকার অবচয় এন্ট্রি পোস্টিং করতে চান? এটি সাধারণ ডেবিট-ক্রেডিট হিসাব হালনাগাদ করবে।`)) {
                                  return;
                                }

                                const newVouchers: any[] = [];
                                calculatedAssets.forEach(a => {
                                  if (a.depAmt <= 0) return;
                                  
                                  newVouchers.push({
                                    id: `DEP-${Date.now().toString().slice(-4)}-${a.code}`,
                                    type: 'expense',
                                    category: 'স্থায়ী সম্পদের অবচয় খরচ',
                                    amount: a.depAmt,
                                    note: `${a.name.split(' (')[0]} এর অবচয় অবলোপন (হার: ${a.rate}%, সময়কাল: ${depPeriod === 'monthly' ? 'মাসিক' : 'বাৎসরিক'})`,
                                    date: workingDay,
                                    addDate: workingDay,
                                    debitAcc: 'depreciation_expense',
                                    creditAcc: a.id,
                                    paymentMode: 'cash'
                                  });
                                });

                                setTransactions(prev => [...newVouchers, ...prev]);
                                setAlertMsg({ type: 'success', text: `${newVouchers.length}টি স্থায়ী সম্পদের অবচয় এন্ট্রি সফলভাবে পোস্টিং করা হয়েছে।` });
                              };

                              return (
                                <div className="space-y-4">
                                  <div className="overflow-x-auto border border-slate-100 rounded-xl">
                                    <table className="w-full border-collapse text-left text-xs font-sans">
                                      <thead>
                                        <tr className="bg-slate-50 text-slate-500 border-b border-slate-100">
                                          <th className="p-3 font-bold">সম্পদ কোড</th>
                                          <th className="p-3 font-bold">সম্পদের নাম</th>
                                          <th className="p-3 text-right font-bold">বর্তমান বুক ভ্যালু (পূরবর্তী উদ্বৃত্ত)</th>
                                          <th className="p-3 text-center font-bold">অবচয় হার (%)</th>
                                          <th className="p-3 text-right font-bold">অবচয় পরিমাণ ({depPeriod === 'monthly' ? 'মাসিক' : 'বাৎসরিক'})</th>
                                          <th className="p-3 text-right font-bold">অবচয় পরবর্তী বুক ভ্যালু</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-slate-100 font-bold text-slate-750">
                                        {calculatedAssets.map(a => (
                                          <tr key={a.id} className="hover:bg-slate-50/50">
                                            <td className="p-3 font-mono font-bold text-slate-500">{a.code}</td>
                                            <td className="p-3 font-black text-slate-800">{a.name}</td>
                                            <td className="p-3 text-right font-mono text-slate-900">৳{a.balance.toLocaleString('bn-BD')}</td>
                                            <td className="p-3 text-center font-mono text-indigo-700 font-black">{a.rate}%</td>
                                            <td className="p-3 text-right font-mono text-rose-600 font-black">৳{a.depAmt.toLocaleString('bn-BD')}</td>
                                            <td className="p-3 text-right font-mono text-emerald-700 font-black">৳{a.finalVal.toLocaleString('bn-BD')}</td>
                                          </tr>
                                        ))}
                                        <tr className="bg-slate-50/50 font-bold text-slate-900 border-t border-slate-200">
                                          <td colSpan={2} className="p-3 text-right font-extrabold">সর্বমোট (Total):</td>
                                          <td className="p-3 text-right font-mono font-black">৳{totalInitial.toLocaleString('bn-BD')}</td>
                                          <td className="p-3"></td>
                                          <td className="p-3 text-right font-mono font-black text-rose-750">৳{totalDepAmt.toLocaleString('bn-BD')}</td>
                                          <td className="p-3 text-right font-mono font-black text-emerald-800">৳{totalFinalVal.toLocaleString('bn-BD')}</td>
                                        </tr>
                                      </tbody>
                                    </table>
                                  </div>

                                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pt-2">
                                    <p className="text-[10px] text-slate-400 font-semibold">
                                      * অবচয় পোস্টিং দিলে ডেবিট হবে <strong className="text-slate-600">স্থায়ী সম্পদের অবচয় খরচ (কোড: ৫৩০১)</strong> এবং ক্রেডিট হবে সংশ্লিষ্ট সম্পদ হিসাব খতিয়ান।
                                    </p>
                                    <button
                                      type="button"
                                      onClick={handlePostDepreciation}
                                      disabled={totalDepAmt <= 0}
                                      className={`px-4 py-2 rounded-xl text-xs font-bold text-white transition-all cursor-pointer shadow-xs ${
                                        totalDepAmt > 0 ? 'bg-indigo-650 hover:bg-indigo-750' : 'bg-slate-300 text-slate-500 cursor-not-allowed'
                                      }`}
                                    >
                                      স্বয়ংক্রিয় অবচয় পোস্টিং করুন (Post Depreciation)
                                    </button>
                                  </div>
                                </div>
                              );
                            })()}
                          </div>

                          {/* Depreciation posting history */}
                          <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4 shadow-3xs">
                            <div className="border-b border-slate-100 pb-3">
                              <h5 className="font-extrabold text-slate-800 text-xs sm:text-sm">📋 অবচয় পোস্টিং এর ইতিহাস (Depreciation Vouchers History)</h5>
                              <p className="text-[10px] text-slate-400 font-semibold mt-0.5">শাখার পূর্বে সম্পন্নকৃত অবচয় ডাবল-এন্ট্রি জাবেদা সমূহের তালিকা</p>
                            </div>
                            {(() => {
                              const depVouchers = transactions.filter(t => t.debitAcc === 'depreciation_expense');
                              if (depVouchers.length === 0) {
                                return (
                                  <div className="text-center py-8 text-slate-400 font-sans">
                                    <ClipboardList className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                                    <strong className="text-xs font-bold block text-slate-500">কোনো অবচয় ভাউচার পাওয়া হয়নি!</strong>
                                    <p className="text-[10px] mt-0.5">এখনো কোনো স্থায়ী সম্পদের অবচয় ডেবিট-ক্রেডিট পোস্টিং করা হয়নি।</p>
                                  </div>
                                );
                              }
                              return (
                                <div className="overflow-x-auto border border-slate-100 rounded-xl">
                                  <table className="w-full border-collapse text-xs font-sans text-left">
                                    <thead>
                                      <tr className="bg-slate-50 text-slate-500 border-b border-slate-100 font-bold">
                                        <th className="p-3">তারিখ</th>
                                        <th className="p-3">ভাউচার আইডি</th>
                                        <th className="p-3 text-center">ডেবিট অ্যাকাউন্ট (DR)</th>
                                        <th className="p-3 text-center">ক্রেডিট অ্যাকাউন্ট (CR)</th>
                                        <th className="p-3 text-right">অবচয় অবলোপন পরিমাণ</th>
                                        <th className="p-3 pl-6">বর্ণনা</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 text-slate-700 font-bold">
                                      {depVouchers.map(v => (
                                        <tr key={v.id} className="hover:bg-slate-50/40">
                                          <td className="p-3 font-mono font-bold text-slate-500">{v.date}</td>
                                          <td className="p-3"><span className="font-mono text-[10px] bg-slate-100 px-2 py-0.5 rounded-md text-slate-650 font-extrabold">{v.id}</span></td>
                                          <td className="p-3 text-center font-bold text-rose-700">৫৩০১ (অবচয় খরচ)</td>
                                          <td className="p-3 text-center font-bold text-slate-600">
                                            {v.creditAcc === 'furniture' ? '১৩০২ (আসবাবপত্র)' : 
                                             v.creditAcc === 'computer_it' ? '১৩০৩ (কম্পিউটার/আইটি)' : 
                                             v.creditAcc === 'vehicles' ? '১৩০৪ (যানবাহন)' : 
                                             v.creditAcc === 'land_building' ? '১৩০১ (জমি ও ভবন)' : v.creditAcc}
                                          </td>
                                          <td className="p-3 text-right font-mono font-black text-rose-600">৳{v.amount.toLocaleString('bn-BD')}</td>
                                          <td className="p-3 pl-6 text-slate-500 font-semibold">{v.note}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              );
                            })()}
                          </div>
                        </div>
                      )}

                      {accountSubTab === 'llpf' && (
                        <div className="space-y-6 animate-in fade-in duration-100 font-sans">
                          {/* Top stats comparisons */}
                          {(() => {
                            const holidays = JSON.parse(localStorage.getItem(`tanzil_holidays_${org.id}`) || '[]');
                            const branchGroups = JSON.parse(localStorage.getItem(`tanzil_groups_${org.id}`) || '[]');
                            const refDate = workingDay || new Date().toISOString().split('T')[0];

                            // Current actual reserve in ledger
                            const ledgerLLPFReserve = coaBalances.llpf || 0;

                            const parseBengaliOrEnglishFloat = (val: string | null, fallback: number): number => {
                              if (!val) return fallback;
                              const englishDigits = val.replace(/[০-৯]/g, d => '০১২৩৪৫৬৭৮৯'.indexOf(d).toString());
                              const parsed = parseFloat(englishDigits);
                              return isNaN(parsed) ? fallback : parsed;
                            };

                            const rawLlpStandardRate = parseBengaliOrEnglishFloat(llpStandardRate, 1);
                            const rawLlpSubStandardRate = parseBengaliOrEnglishFloat(llpSubStandardRate, 5);
                            const rawLlpDoubtfulRate = parseBengaliOrEnglishFloat(llpDoubtfulRate, 50);
                            const rawLlpBadRate = parseBengaliOrEnglishFloat(llpBadRate, 100);

                            let standardOutstanding = 0;
                            let subStandardOutstanding = 0;
                            let doubtfulOutstanding = 0;
                            let badOutstanding = 0;

                            let standardCount = 0;
                            let subStandardCount = 0;
                            let doubtfulCount = 0;
                            let badCount = 0;

                            const classifiedList: any[] = [];

                            groupMembers.filter((m: any) => (m.plOutstanding ?? 0) > 0).forEach((m: any) => {
                              const outstanding = m.plOutstanding ?? 0;
                              const loanStatus = calculateLoanOverdueAndSchedule(m, transactions, refDate, holidays, branchGroups);
                              const daysOverdue = loanStatus.daysOverdue ?? 0;
                              const overdueAmount = loanStatus.overdueAmount;

                              let classLabel = "🟢 নিয়মিত (Standard)";
                              let classStyle = "bg-emerald-50 text-emerald-800 border-emerald-100";
                              let provRate = rawLlpStandardRate;

                              if (overdueAmount <= 0 || daysOverdue === 0) {
                                standardOutstanding += outstanding;
                                standardCount++;
                                provRate = rawLlpStandardRate;
                              } else if (daysOverdue <= 90) {
                                subStandardOutstanding += outstanding;
                                subStandardCount++;
                                classLabel = `🟡 সাব-স্ট্যান্ডার্ড (${daysOverdue} দিন)`;
                                classStyle = "bg-amber-50 text-amber-850 border-amber-200";
                                provRate = rawLlpSubStandardRate;
                              } else if (daysOverdue <= 365) {
                                doubtfulOutstanding += outstanding;
                                doubtfulCount++;
                                classLabel = `🟠 সন্দেহজনক (${daysOverdue} দিন)`;
                                classStyle = "bg-orange-50 text-orange-850 border-orange-200";
                                provRate = rawLlpDoubtfulRate;
                              } else {
                                badOutstanding += outstanding;
                                badCount++;
                                classLabel = `🔴 মন্দ / কু-ঋণ (${daysOverdue} দিন)`;
                                classStyle = "bg-rose-50 text-rose-850 border-rose-200";
                                provRate = rawLlpBadRate;
                              }

                              const reqProvForMember = Math.round(outstanding * (provRate / 100));

                              classifiedList.push({
                                member: m,
                                outstanding,
                                overdueAmount,
                                daysOverdue,
                                classLabel,
                                classStyle,
                                provRate,
                                reqProv: reqProvForMember
                              });
                            });

                            const reqStandard = Math.round(standardOutstanding * (rawLlpStandardRate / 100));
                            const reqSubStandard = Math.round(subStandardOutstanding * (rawLlpSubStandardRate / 100));
                            const reqDoubtful = Math.round(doubtfulOutstanding * (rawLlpDoubtfulRate / 100));
                            const reqBad = Math.round(badOutstanding * (rawLlpBadRate / 100));
                            const totalRequiredProvision = reqStandard + reqSubStandard + reqDoubtful + reqBad;
                            const totalOutstandingPl = standardOutstanding + subStandardOutstanding + doubtfulOutstanding + badOutstanding;
                            const shortfall = Math.max(0, totalRequiredProvision - ledgerLLPFReserve);

                            const handlePostProvision = () => {
                              const amtToPost = Number(llpManualAmount);
                              if (isNaN(amtToPost) || amtToPost <= 0) {
                                alert('দয়া করে সঠিক ম্যানুয়াল প্রভিশন পরিমাণ (৳) ইনপুট করুন।');
                                return;
                              }

                              if (!confirm(`আপনি কি খেলাপি ঋণের সঞ্চিতি (LLPF) ফান্ডে সর্বমোট ৳${amtToPost} টাকার প্রভিশন জাবেদা পোস্টিং করতে চান? এটি ডেবিট করবে কুঋণ অবলোপন খরচ এবং ক্রেডিট করবে খেলাপি ঋণের সঞ্চিতি ফান্ড।`)) {
                                return;
                              }

                              const newVoucher = {
                                id: `LLP-${Date.now().toString().slice(-5)}`,
                                type: 'expense',
                                category: 'খেলাপি ঋণের সঞ্চিতি (LLPF)',
                                amount: amtToPost,
                                note: `খেলাপি ঋণের সঞ্চিতি (LLPF) ম্যানুয়াল প্রভিশন পোস্টিং (প্রয়োজনীয়: ৳${totalRequiredProvision}, বর্তমান জের: ৳${ledgerLLPFReserve})`,
                                date: workingDay,
                                addDate: workingDay,
                                debitAcc: 'bad_debt',
                                creditAcc: 'llpf',
                                paymentMode: 'cash'
                              };

                              setTransactions(prev => [newVoucher, ...prev]);
                              setLlpManualAmount('');
                              setAlertMsg({ type: 'success', text: `LLPF সঞ্চিতি প্রভিশন ভাউচার (${newVoucher.id}) সফলভাবে পোস্টিং করা হয়েছে।` });
                            };

                            return (
                              <div className="space-y-6">
                                {/* Dashboard KPI cards comparing required vs current reserve */}
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                  <div className="bg-white border border-slate-200 rounded-2xl p-4 flex items-center justify-between shadow-3xs">
                                    <div className="space-y-1">
                                      <span className="text-[10px] text-slate-400 font-extrabold uppercase">প্রয়োজনীয় সঞ্চিতি (Required LLP)</span>
                                      <h3 className="text-lg font-black text-slate-800 font-mono">৳{totalRequiredProvision.toLocaleString('bn-BD')}</h3>
                                      <span className="text-[9.5px] text-slate-400 font-medium block">ঋণের খেলাপি স্থিতি ভিত্তিক সঞ্চিতির যোগফল</span>
                                    </div>
                                    <div className="p-3 bg-indigo-50 text-indigo-700 rounded-xl">
                                      <Percent className="w-5 h-5" />
                                    </div>
                                  </div>

                                  <div className="bg-white border border-slate-200 rounded-2xl p-4 flex items-center justify-between shadow-3xs">
                                    <div className="space-y-1">
                                      <span className="text-[10px] text-slate-400 font-extrabold uppercase">বর্তমান LLPF ফান্ড জের (Ledger Balance)</span>
                                      <h3 className="text-lg font-black text-indigo-700 font-mono">৳{ledgerLLPFReserve.toLocaleString('bn-BD')}</h3>
                                      <span className="text-[9.5px] text-slate-400 font-medium block">খতিয়ান কোড ২৩০১ এর বর্তমান উদ্বৃত্ত</span>
                                    </div>
                                    <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
                                      <Coins className="w-5 h-5" />
                                    </div>
                                  </div>

                                  <div className={`border rounded-2xl p-4 flex items-center justify-between shadow-3xs ${shortfall > 0 ? 'bg-rose-50/50 border-rose-250' : 'bg-emerald-50/50 border-emerald-250'}`}>
                                    <div className="space-y-1">
                                      <span className="text-[10px] font-extrabold uppercase text-slate-400">ঘাটতি বা উদ্বৃত্ত (Reserve Status)</span>
                                      {shortfall > 0 ? (
                                        <>
                                          <h3 className="text-lg font-black text-rose-700 font-mono">৳{shortfall.toLocaleString('bn-BD')} (ঘাটতি)</h3>
                                          <span className="text-[9.5px] text-rose-500 font-bold block">নতুন প্রভিশন পোস্টিং দেওয়া আবশ্যক</span>
                                        </>
                                      ) : (
                                        <>
                                          <h3 className="text-lg font-black text-emerald-800 font-mono">৳{(ledgerLLPFReserve - totalRequiredProvision).toLocaleString('bn-BD')} (উদ্বৃত্ত)</h3>
                                          <span className="text-[9.5px] text-emerald-600 font-bold block">ফান্ডে পর্যাপ্ত সঞ্চিতি তহবিল রয়েছে</span>
                                        </>
                                      )}
                                    </div>
                                    <div className={`p-3 rounded-xl ${shortfall > 0 ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'}`}>
                                      <TrendingDown className="w-5 h-5" />
                                    </div>
                                  </div>
                                </div>

                                {/* Classifications Settings & Calculations Table */}
                                <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4 shadow-3xs">
                                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-100 pb-3">
                                    <div>
                                      <h5 className="font-extrabold text-slate-800 text-xs sm:text-sm">⚙️ খেলাপি শ্রেণীভিত্তিক ঋণ ও সঞ্চিতির হার</h5>
                                      <p className="text-[10px] text-slate-400 font-semibold mt-0.5">MRA নীতিমালা অনুযায়ী বিভিন্ন শ্রেণীর সঞ্চিতি হার পরিবর্তন ও হিসাব করুন</p>
                                    </div>
                                  </div>

                                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-xl">
                                    <div>
                                      <label className="block text-[10px] font-extrabold text-slate-450 uppercase mb-1">নিয়মিত সঞ্চিতি হার (%)</label>
                                      <input
                                        type="number"
                                        value={llpStandardRate}
                                        onChange={(e) => setLlpStandardRate(e.target.value)}
                                        className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-slate-800 font-mono font-bold focus:outline-none focus:border-indigo-500"
                                      />
                                    </div>
                                    <div>
                                      <label className="block text-[10px] font-extrabold text-slate-450 uppercase mb-1">সাব-স্ট্যান্ডার্ড হার (%)</label>
                                      <input
                                        type="number"
                                        value={llpSubStandardRate}
                                        onChange={(e) => setLlpSubStandardRate(e.target.value)}
                                        className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-slate-800 font-mono font-bold focus:outline-none focus:border-indigo-500"
                                      />
                                    </div>
                                    <div>
                                      <label className="block text-[10px] font-extrabold text-slate-450 uppercase mb-1">সন্দেহজনক হার (%)</label>
                                      <input
                                        type="number"
                                        value={llpDoubtfulRate}
                                        onChange={(e) => setLlpDoubtfulRate(e.target.value)}
                                        className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-slate-800 font-mono font-bold focus:outline-none focus:border-indigo-500"
                                      />
                                    </div>
                                    <div>
                                      <label className="block text-[10px] font-extrabold text-slate-450 uppercase mb-1">মন্দ / কুঋণ সঞ্চিতি হার (%)</label>
                                      <input
                                        type="number"
                                        value={llpBadRate}
                                        onChange={(e) => setLlpBadRate(e.target.value)}
                                        className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-slate-800 font-mono font-bold focus:outline-none focus:border-indigo-500"
                                      />
                                    </div>
                                  </div>

                                  <div className="overflow-x-auto border border-slate-100 rounded-xl">
                                    <table className="w-full border-collapse text-left text-xs font-sans">
                                      <thead>
                                        <tr className="bg-slate-50 text-slate-500 border-b border-slate-100">
                                          <th className="p-3 font-bold">ঋণ শ্রেণীবিভাগ (Loan Classification)</th>
                                          <th className="p-3 text-center font-bold">সদস্য সংখ্যা</th>
                                          <th className="p-3 text-right font-bold">মোট ঋণ স্থিতি (Outstanding)</th>
                                          <th className="p-3 text-center font-bold">প্রভিশন হার (%)</th>
                                          <th className="p-3 text-right font-bold font-extrabold">প্রয়োজনীয় সঞ্চিতি (Required Prov.)</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-slate-100 font-bold text-slate-750">
                                        <tr>
                                          <td className="p-3 text-emerald-850 flex items-center gap-1.5">🟢 নিয়মিত (Standard) <span className="text-[10px] text-slate-400 font-semibold">(বকেয়াহীন বা ১-৩০ দিন)</span></td>
                                          <td className="p-3 text-center font-mono font-bold">{standardCount} জন</td>
                                          <td className="p-3 text-right font-mono text-slate-900">৳{standardOutstanding.toLocaleString('bn-BD')}</td>
                                          <td className="p-3 text-center font-mono text-indigo-700 font-black">{rawLlpStandardRate}%</td>
                                          <td className="p-3 text-right font-mono text-indigo-900 font-black">৳{reqStandard.toLocaleString('bn-BD')}</td>
                                        </tr>
                                        <tr>
                                          <td className="p-3 text-amber-850 flex items-center gap-1.5">🟡 সাব-স্ট্যান্ডার্ড (Sub-Standard) <span className="text-[10px] text-slate-400 font-semibold">(৩১-৯০ দিন বকেয়া)</span></td>
                                          <td className="p-3 text-center font-mono font-bold">{subStandardCount} জন</td>
                                          <td className="p-3 text-right font-mono text-slate-900">৳{subStandardOutstanding.toLocaleString('bn-BD')}</td>
                                          <td className="p-3 text-center font-mono text-indigo-700 font-black">{rawLlpSubStandardRate}%</td>
                                          <td className="p-3 text-right font-mono text-indigo-900 font-black">৳{reqSubStandard.toLocaleString('bn-BD')}</td>
                                        </tr>
                                        <tr>
                                          <td className="p-3 text-orange-850 flex items-center gap-1.5">🟠 সন্দেহজনক (Doubtful) <span className="text-[10px] text-slate-400 font-semibold">(৯১-৩৬৫ দিন বকেয়া)</span></td>
                                          <td className="p-3 text-center font-mono font-bold">{doubtfulCount} জন</td>
                                          <td className="p-3 text-right font-mono text-slate-900">৳{doubtfulOutstanding.toLocaleString('bn-BD')}</td>
                                          <td className="p-3 text-center font-mono text-indigo-700 font-black">{rawLlpDoubtfulRate}%</td>
                                          <td className="p-3 text-right font-mono text-indigo-900 font-black">৳{reqDoubtful.toLocaleString('bn-BD')}</td>
                                        </tr>
                                        <tr>
                                          <td className="p-3 text-rose-850 flex items-center gap-1.5">🔴 মন্দ / কুঋণ (Bad & Loss) <span className="text-[10px] text-slate-400 font-semibold">(৩৬৫+ দিন বকেয়া)</span></td>
                                          <td className="p-3 text-center font-mono font-bold">{badCount} জন</td>
                                          <td className="p-3 text-right font-mono text-slate-900">৳{badOutstanding.toLocaleString('bn-BD')}</td>
                                          <td className="p-3 text-center font-mono text-indigo-700 font-black">{rawLlpBadRate}%</td>
                                          <td className="p-3 text-right font-mono text-indigo-900 font-black">৳{reqBad.toLocaleString('bn-BD')}</td>
                                        </tr>
                                        <tr className="bg-slate-50/50 font-bold text-slate-900 border-t border-slate-200">
                                          <td className="p-3 text-right font-extrabold">সর্বমোট (Total Pl Outstanding):</td>
                                          <td className="p-3 text-center font-mono font-black">{(standardCount + subStandardCount + doubtfulCount + badCount)} জন</td>
                                          <td className="p-3 text-right font-mono font-black">৳{totalOutstandingPl.toLocaleString('bn-BD')}</td>
                                          <td className="p-3"></td>
                                          <td className="p-3 text-right font-mono font-black text-indigo-950">৳{totalRequiredProvision.toLocaleString('bn-BD')}</td>
                                        </tr>
                                      </tbody>
                                    </table>
                                  </div>

                                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                                    <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
                                      <div className="space-y-1">
                                        <label className="block text-xs font-black text-slate-700">
                                          ✍️ ম্যানুয়াল প্রভিশন পোস্টিং পরিমাণ (টাকা):
                                        </label>
                                        <p className="text-[10px] text-slate-450 font-semibold">
                                          গণনাকৃত প্রয়োজনীয় সঞ্চিতি: <strong className="text-slate-600">৳{totalRequiredProvision.toLocaleString('bn-BD')}</strong> (ঘাটতি: <strong className="text-slate-600">৳{shortfall.toLocaleString('bn-BD')}</strong>)। আপনি যেকোনো কাস্টম পরিমাণ টাইপ করতে পারেন।
                                        </p>
                                      </div>
                                      <div className="flex items-center gap-2 w-full md:w-auto">
                                        <input
                                          type="number"
                                          placeholder="উদাঃ ৫০০০"
                                          value={llpManualAmount}
                                          onChange={(e) => setLlpManualAmount(e.target.value)}
                                          className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-slate-800 font-mono font-bold focus:outline-none focus:border-indigo-500 text-xs w-full md:w-40"
                                        />
                                        <button
                                          type="button"
                                          onClick={() => setLlpManualAmount(shortfall > 0 ? shortfall.toString() : totalRequiredProvision.toString())}
                                          className="px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-[10px] font-bold transition-all cursor-pointer border border-indigo-100 whitespace-nowrap"
                                          title="স্বয়ংক্রিয় গণনাকৃত পরিমাণ ইনপুট করুন"
                                        >
                                          অটো-ফিল করুন
                                        </button>
                                      </div>
                                    </div>

                                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pt-2 border-t border-slate-200/60">
                                      <p className="text-[10px] text-slate-400 font-semibold">
                                        * প্রভিশন পোস্টিং দিলে ডেবিট হবে <strong className="text-slate-600">কুঋণ অবলোপন খরচ (কোড: ৫৩০২)</strong> এবং ক্রেডিট হবে <strong className="text-slate-600">খেলাপি ঋণের সঞ্চিতি (LLPF) (কোড: ২৩০১)</strong>।
                                      </p>
                                      <button
                                        type="button"
                                        onClick={handlePostProvision}
                                        disabled={!llpManualAmount || Number(llpManualAmount) <= 0}
                                        className={`px-4 py-2 rounded-xl text-xs font-bold text-white transition-all cursor-pointer shadow-xs ${
                                          (llpManualAmount && Number(llpManualAmount) > 0) ? 'bg-indigo-650 hover:bg-indigo-750' : 'bg-slate-300 text-slate-500 cursor-not-allowed'
                                        }`}
                                      >
                                        প্রভিশন পোস্টিং দিন (Post Manual LLPF)
                                      </button>
                                    </div>
                                  </div>
                                </div>

                                {/* Overdue Members Detailed List */}
                                <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4 shadow-3xs">
                                  <div className="border-b border-slate-100 pb-3">
                                    <h5 className="font-extrabold text-slate-800 text-xs sm:text-sm">📋 বকেয়া ও খেলাপি সদস্যদের প্রভিশন বিবরণী (Overdue Members Provision Details)</h5>
                                    <p className="text-[10px] text-slate-400 font-semibold mt-0.5">সকল সদস্য যাদের বকেয়া রয়েছে এবং তাদের বিপরীতে সংরক্ষিত সঞ্চিতি হিসাব</p>
                                  </div>
                                  {classifiedList.filter(item => item.daysOverdue > 0).length === 0 ? (
                                    <div className="text-center py-8 text-slate-400 font-sans">
                                      <ClipboardList className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                                      <strong className="text-xs font-bold block text-slate-500">কোনো খেলাপি বা বকেয়া সদস্য নেই!</strong>
                                      <p className="text-[10px] mt-0.5">শাখার সকল সদস্যের ঋণের কিস্তি সম্পূর্ণ আদায় ও নিয়মিত রয়েছে।</p>
                                    </div>
                                  ) : (
                                    <div className="overflow-x-auto border border-slate-100 rounded-xl">
                                      <table className="w-full border-collapse text-xs font-sans text-left">
                                        <thead>
                                          <tr className="bg-slate-50 text-slate-500 border-b border-slate-100 font-bold">
                                            <th className="p-3">সদস্য কোড ও নাম</th>
                                            <th className="p-3">শ্রেণীবিভাগ</th>
                                            <th className="p-3 text-right">ঋণ স্থিতি (Pl Outstanding)</th>
                                            <th className="p-3 text-right">বকেয়া কিস্তি পরিমাণ</th>
                                            <th className="p-3 text-center">খেলাপি দিন (Overdue Days)</th>
                                            <th className="p-3 text-right">প্রয়োজনীয় সঞ্চিতি পরিমাণ</th>
                                          </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 text-slate-700 font-bold">
                                          {classifiedList.filter(item => item.daysOverdue > 0).map(item => (
                                            <tr key={item.member.id} className="hover:bg-slate-50/40">
                                              <td className="p-3">
                                                <div className="font-black text-slate-800">{item.member.name}</div>
                                                <div className="text-[10px] text-slate-400 font-mono font-bold">{item.member.memberId || item.member.id}</div>
                                              </td>
                                              <td className="p-3">
                                                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black border ${item.classStyle}`}>
                                                  {item.classLabel}
                                                </span>
                                              </td>
                                              <td className="p-3 text-right font-mono font-black text-slate-900">৳{item.outstanding.toLocaleString('bn-BD')}</td>
                                              <td className="p-3 text-right font-mono font-black text-rose-600">৳{item.overdueAmount.toLocaleString('bn-BD')}</td>
                                              <td className="p-3 text-center font-mono text-slate-500 font-extrabold">{item.daysOverdue} দিন</td>
                                              <td className="p-3 text-right font-mono font-black text-indigo-700">৳{item.reqProv.toLocaleString('bn-BD')}</td>
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    </div>
                                  )}
                                </div>

                                {/* LLPF Posting History */}
                                <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4 shadow-3xs">
                                  <div className="border-b border-slate-100 pb-3">
                                    <h5 className="font-extrabold text-slate-800 text-xs sm:text-sm">📋 LLPF সঞ্চিতি পোস্টিং ইতিহাস (Provision Vouchers History)</h5>
                                    <p className="text-[10px] text-slate-400 font-semibold mt-0.5">পূর্বে সম্পন্নকৃত খেলাপি ঋণ সঞ্চিতি সংক্রান্ত জাবেদা সমূহের তালিকা</p>
                                  </div>
                                  {(() => {
                                    const llpVouchers = transactions.filter(t => t.creditAcc === 'llpf' || t.debitAcc === 'llpf');
                                    if (llpVouchers.length === 0) {
                                      return (
                                        <div className="text-center py-8 text-slate-400 font-sans">
                                          <ClipboardList className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                                          <strong className="text-xs font-bold block text-slate-500">কোনো সঞ্চিতি ভাউচার পাওয়া যায়নি!</strong>
                                          <p className="text-[10px] mt-0.5">এখনো কোনো খেলাপি ঋণের সঞ্চিতি (LLPF) প্রভিশন জাবেদা পোস্টিং করা হয়নি।</p>
                                        </div>
                                      );
                                    }
                                    return (
                                      <div className="overflow-x-auto border border-slate-100 rounded-xl">
                                        <table className="w-full border-collapse text-xs font-sans text-left">
                                          <thead>
                                            <tr className="bg-slate-50 text-slate-500 border-b border-slate-100 font-bold">
                                              <th className="p-3">তারিখ</th>
                                              <th className="p-3">ভাউচার আইডি</th>
                                              <th className="p-3 text-center">ডেবিট অ্যাকাউন্ট (DR)</th>
                                              <th className="p-3 text-center">ক্রেডিট অ্যাকাউন্ট (CR)</th>
                                              <th className="p-3 text-right">পোস্টিং পরিমাণ (Posted Amt)</th>
                                              <th className="p-3 pl-6">বর্ণনা</th>
                                            </tr>
                                          </thead>
                                          <tbody className="divide-y divide-slate-100 text-slate-700 font-bold">
                                            {llpVouchers.map(v => (
                                              <tr key={v.id} className="hover:bg-slate-50/40">
                                                <td className="p-3 font-mono font-bold text-slate-500">{v.date}</td>
                                                <td className="p-3"><span className="font-mono text-[10px] bg-slate-100 px-2 py-0.5 rounded-md text-slate-650 font-extrabold">{v.id}</span></td>
                                                <td className="p-3 text-center font-bold text-rose-700">{v.debitAcc === 'bad_debt' ? '৫৩০২ (কুঋণ খরচ)' : v.debitAcc}</td>
                                                <td className="p-3 text-center font-bold text-emerald-700">{v.creditAcc === 'llpf' ? '২৩০১ (LLPF সঞ্চিতি)' : v.creditAcc}</td>
                                                <td className="p-3 text-right font-mono font-black text-indigo-750">৳{v.amount.toLocaleString('bn-BD')}</td>
                                                <td className="p-3 pl-6 text-slate-500 font-semibold">{v.note}</td>
                                              </tr>
                                            ))}
                                          </tbody>
                                        </table>
                                      </div>
                                    );
                                  })()}
                                </div>
                              </div>
                            );
                          })()}
                        </div>
                      )}

                </div>
              </div>
            )}
            </>
          )}

          {/* -------------------- DYNAMIC RENDER END -------------------- */}

        </div>
      </main>
      </div>

        
      {isStaffModalOpen && (
        <div id="bm_modal_hrm_staff" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70">
          <div className="bg-white p-6 rounded-2xl w-full max-w-sm shadow-2xl relative">
            <h3 className="text-base font-extrabold text-slate-800 mb-4 flex items-center gap-1.5">
              <Users size={18} className="text-emerald-600" />
              {isStaffEditMode ? 'কর্মী তথ্য সম্পাদন করুন' : 'নতুন কর্মকর্তা বা মাঠ কর্মী সংযোজন'}
            </h3>

            <form onSubmit={handleSaveStaff} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">কর্মকর্তা / কর্মীর নাম *</label>
                <input 
                  type="text" 
                  placeholder="যেমন: জনাব আবদুর রহমান" 
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs sm:text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  value={staffNameInput}
                  onChange={(e) => setStaffNameInput(e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">রেজিস্টার্ড মোবাইল নম্বর *</label>
                <input 
                  type="tel" 
                  placeholder="যেমন: 01712xxxxxx" 
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs sm:text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500" 
                  value={staffPhoneInput}
                  onChange={(e) => setStaffPhoneInput(e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">পদবি / Designation *</label>
                <select
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs sm:text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  value={staffDesignationInput}
                  onChange={(e) => setStaffDesignationInput(e.target.value)}
                >
                  <option value="মাঠ কর্মী">মাঠ কর্মী (Field Officer - FO)</option>
                  <option value="এলাকা কর্মকর্তা">এলাকা কর্মকর্তা (AO)</option>
                  <option value="শাখা ব্যবস্থাপক">শাখা ব্যবস্থাপক (BM)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">যোগদানের তারিখ *</label>
                <input 
                  type="date" 
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs sm:text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500" 
                  value={staffJoiningDateInput}
                  onChange={(e) => setStaffJoiningDateInput(e.target.value)}
                  required
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button 
                  type="button" 
                  onClick={() => setIsStaffModalOpen(false)} 
                  className="flex-1 py-2 bg-slate-200 rounded-xl text-xs font-bold text-slate-600"
                >
                  বাতিল
                </button>
                <button 
                  type="submit" 
                  className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs shadow-sm shadow-emerald-500/10"
                >
                  {isStaffEditMode ? 'হালনাগাদ করুন' : 'নিশ্চিত করুন'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================== GRANT LEAVE MODAL ==================== */}
      {isLeaveModalOpen && leaveStaffTarget && (
        <div id="bm_modal_hrm_leave" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70">
          <div className="bg-white p-6 rounded-2xl w-full max-w-sm shadow-2xl">
            <div className="flex items-start gap-3 mb-4">
              <div className="p-2 bg-amber-50 text-amber-600 rounded-lg shrink-0">
                <Calendar size={18} />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-slate-800">অফিসিয়াল ছুটি প্রদান এবং গ্রুপ স্থানান্তর</h3>
                <p className="text-[10px] text-slate-400 font-medium">কর্মী: {leaveStaffTarget.name} ({leaveStaffTarget.designation})</p>
              </div>
            </div>

            <div className="mb-4 p-2.5 bg-yellow-50 border border-yellow-250 text-yellow-805 rounded-xl text-[10px] text-amber-800 font-semibold leading-relaxed">
              ⚠️ সতর্কবার্তা: কর্মী ছুটিতে যাওয়ার মধ্যবর্তী সময়ে তার অধীনে থাকা দল/গ্রুপ সমূহকে সচল রাখতে স্বয়ংক্রিয়ভাবে সিস্টেমের স্ট্যান্ডবাই "ILO" অফিসারের দায়িত্বে স্থানান্তর করা হবে!
            </div>

            <form onSubmit={handleGrantLeave} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">ছুটির কারণ / খসড়া মন্তব্য *</label>
                <input 
                  type="text" 
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none" 
                  value={leaveReason}
                  onChange={(e) => setLeaveReason(e.target.value)}
                  placeholder="যেমন: গুরুতর অসুস্থতা, বিবাহ জনিত ছুটি"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">ছুটির শুরু *</label>
                  <input 
                    type="date" 
                    className="w-full px-2 py-1.5 border border-slate-200 rounded-xl text-xs focus:outline-none" 
                    value={leaveStart}
                    onChange={(e) => setLeaveStart(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">ছুটির সমাপ্তি *</label>
                  <input 
                    type="date" 
                    className="w-full px-2 py-1.5 border border-slate-200 rounded-xl text-xs focus:outline-none" 
                    value={leaveEnd}
                    onChange={(e) => setLeaveEnd(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button 
                  type="button" 
                  onClick={() => { setIsLeaveModalOpen(false); setLeaveStaffTarget(null); }} 
                  className="flex-1 py-2 bg-slate-200 rounded-xl text-xs font-bold text-slate-605"
                >
                  বাতিল
                </button>
                <button 
                  type="submit" 
                  className="flex-1 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black rounded-xl text-xs"
                >
                  ছুটি ও গ্রুপ বদলি মঞ্জুর
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================== ACCOUNTS NEW TRANSACTION VOUCHER MODAL ==================== */}
      {isTxModalOpen && (
        <div id="bm_modal_tx_vou" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70">
          <div className="bg-white p-6 rounded-2xl w-full max-w-sm shadow-2xl">
            <h3 className="text-base font-extrabold text-slate-800 mb-4 flex items-center gap-1.5">
              <CreditCard size={18} className="text-emerald-600" />
              নতুন দৈনিক লেনদেন ভাউচার
            </h3>

            <form onSubmit={handleSaveTransaction} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">লেনদেন ধরন</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => { setTxType('income'); setTxCategory('ভর্তিকরণ ফি'); }}
                    className={`py-1 rounded-xl text-xs font-bold border transition ${
                      txType === 'income' ? 'bg-emerald-50 text-emerald-700 border-emerald-305' : 'bg-slate-50 text-slate-600 border-transparent'
                    }`}
                  >
                    আয় (Income)
                  </button>
                  <button
                    type="button"
                    onClick={() => { setTxType('expense'); setTxCategory('অফিস ভাড়া'); }}
                    className={`py-1 rounded-xl text-xs font-bold border transition ${
                      txType === 'expense' ? 'bg-rose-50 text-rose-700 border-rose-305' : 'bg-slate-50 text-slate-600 border-transparent'
                    }`}
                  >
                    ব্যয় (Expense)
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">খাত / বিবরণী *</label>
                {txType === 'income' ? (
                  <select 
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none"
                    value={txCategory}
                    onChange={(e) => setTxCategory(e.target.value)}
                  >
                    <option value="ভর্তিকরণ ফি">ভর্তিকরণ ফি (Admission Fee)</option>
                    <option value="ঋণ বই ও ফর্ম বিক্রয়">ঋণ বই ও ফর্ম বিক্রয়</option>
                    <option value="ঋণ প্রসেসিং ফি">ঋণ প্রসেসিং ফি</option>
                    <option value="টাকা উত্তোলন সার্ভিস চার্জ">টাকা উত্তোলন চার্জ</option>
                  </select>
                ) : (
                  <select 
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none"
                    value={txCategory}
                    onChange={(e) => setTxCategory(e.target.value)}
                  >
                    <option value="অফিস ভাড়া">অফিস ভাড়া</option>
                    <option value="বিদ্যুৎ বিল">বিদ্যুৎ ও ইণ্টারনেট বিল</option>
                    <option value="স্টেশনারি ও যাতায়াত">স্টেশনারি ও যাতায়াত ব্যয়</option>
                    <option value="মনোরঞ্জন ও অন্যান্য">মনোরঞ্জন ও অন্যান্য খরচ</option>
                  </select>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">লেনদেনের তারিখ (Transaction Date) *</label>
                <input 
                  type="date" 
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none font-bold"
                  value={isSimulated ? singleTxDate : workingDay}
                  onChange={(e) => setSingleTxDate(e.target.value)}
                  disabled={!isSimulated}
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-505 mb-1">টাকার পরিমাণ (টাকায়) *</label>
                <input 
                  type="text" 
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none"
                  value={txAmount}
                  onChange={(e) => setTxAmount(e.target.value)}
                  placeholder="যেমন: 500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">লেনদেন মেথড (Payment Method) *</label>
                <select
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none font-bold text-slate-800"
                  value={txPaymentMode}
                  onChange={(e) => setTxPaymentMode(e.target.value as 'cash' | 'bank')}
                  required
                >
                  <option value="cash">💵 ক্যাশ (Cash)</option>
                  <option value="bank">🏦 ব্যাংক (Bank)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">অতিরিক্ত নোট / মন্তব্য</label>
                <input 
                  type="text" 
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none"
                  value={txNote}
                  onChange={(e) => setTxNote(e.target.value)}
                  placeholder="সংক্ষিপ্ত বিবরণ"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setIsTxModalOpen(false)} className="flex-1 py-2 bg-slate-200 rounded-xl text-xs font-bold">বাতিল</button>
                <button type="submit" className="flex-1 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold">সংরক্ষণ করুন</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================== REGISTER NEW BANK ACCOUNT MODAL ==================== */}
      {isBankModalOpen && (
        <div id="bm_modal_add_bank" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70">
          <div className="bg-white p-6 rounded-2xl w-full max-w-sm shadow-2xl animate-in zoom-in-95 duration-150">
            <h3 className="text-base font-extrabold text-slate-800 mb-4 flex items-center gap-1.5">
              <Building size={18} className="text-emerald-600" />
              নতুন ব্যাংক হিসাব যুক্ত করুন
            </h3>

            <form onSubmit={handleAddBankAccount} className="space-y-4 text-xs font-sans">
              <div>
                <label className="block text-slate-500 font-bold mb-1">ব্যাংকের নাম *</label>
                <input
                  type="text"
                  value={bankNameInput}
                  onChange={(e) => setBankNameInput(e.target.value)}
                  placeholder="যেমন: ডাচ-বাংলা ব্যাংক পিএলসি"
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-500 font-bold mb-1">হিসাব নাম্বার (Account No) *</label>
                <input
                  type="text"
                  value={bankAccountNoInput}
                  onChange={(e) => setBankAccountNoInput(e.target.value)}
                  placeholder="যেমন: DBBL-110293..."
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl font-mono"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-500 font-bold mb-1">শাখার নাম (Branch Name)</label>
                <input
                  type="text"
                  value={bankBranchInput}
                  onChange={(e) => setBankBranchInput(e.target.value)}
                  placeholder="যেমন: মতিঝিল শাখা"
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl"
                />
              </div>

              <div>
                <label className="block text-slate-500 font-bold mb-1">হিসাবের ধরন (Account Type) *</label>
                <select
                  value={bankTypeInput}
                  onChange={(e) => setBankTypeInput(e.target.value as any)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white select-none focus:outline-none"
                >
                  <option value="চলতি (Current)">চলতি (Current)</option>
                  <option value="সঞ্চয়ী (Savings)">সঞ্চয়ী (Savings)</option>
                  <option value="এসএনডি (SND)">এসএনডি (SND)</option>
                  <option value="এফডিআর (FDR)">এফডিআর (FDR)</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-500 font-bold mb-1">প্রারম্ভিক ব্যালেন্স (BDT) *</label>
                <input
                  type="number"
                  value={bankInitialBalanceInput}
                  onChange={(e) => setBankInitialBalanceInput(e.target.value)}
                  placeholder="যেমন: 500000"
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl font-mono"
                  required
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsBankModalOpen(false)}
                  className="flex-1 py-2 bg-slate-200 hover:bg-slate-300 rounded-xl font-bold cursor-pointer transition-colors"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold cursor-pointer transition-colors"
                >
                  সংরক্ষণ করুন
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Change BM/Staff Password */}
      {isChangePasswordModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 animate-in fade-in duration-100">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden border border-slate-100 animate-in zoom-in-95 duration-150">
            <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200/80 flex justify-between items-center">
              <h3 className="font-bold text-slate-800 text-xs sm:text-sm flex items-center gap-1.5">
                <Key size={16} className="text-emerald-600" /> শাখা পাসওয়ার্ড পরিবর্তন
              </h3>
              <button 
                type="button"
                onClick={() => setIsChangePasswordModalOpen(false)} 
                className="text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>
            
            <form onSubmit={handleBMChangePassword} className="p-5 space-y-4">
              
              {passwordChangeSuccess ? (
                <div className="p-4 bg-emerald-50 border border-emerald-100 text-emerald-800 rounded-xl text-center text-xs font-bold space-y-1">
                  <p>{passwordChangeSuccess}</p>
                </div>
              ) : (
                <>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 mb-1">পুরাতন পাসওয়ার্ড *</label>
                      <input 
                        type="password" 
                        className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:outline-none font-bold"
                        placeholder="পুরাতন পাসওয়ার্ড লিখুন"
                        value={oldPasswordVal} 
                        onChange={(e) => setOldPasswordVal(e.target.value)} 
                        required
                      />
                    </div>
                    
                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 mb-1">নতুন পাসওয়ার্ড *</label>
                      <input 
                        type="password" 
                        className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:outline-none font-bold"
                        placeholder="নতুন পাসওয়ার্ড লিখুন"
                        value={newPasswordVal} 
                        onChange={(e) => setNewPasswordVal(e.target.value)} 
                        required
                      />
                    </div>
                    
                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 mb-1">পাসওয়ার্ড নিশ্চিত করুন *</label>
                      <input 
                        type="password" 
                        className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:outline-none font-bold"
                        placeholder="পুনরায় পাসওয়ার্ড লিখুন"
                        value={confirmPasswordVal} 
                        onChange={(e) => setConfirmPasswordVal(e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  <div className="flex gap-2.5 pt-2">
                    <button 
                      type="button" 
                      onClick={() => setIsChangePasswordModalOpen(false)}
                      className="flex-1 py-1.5 text-xs font-bold text-slate-600 bg-slate-100 rounded-xl hover:bg-slate-200 cursor-pointer"
                    >
                      বাতিল
                    </button>
                    <button 
                      type="submit"
                      className="flex-1 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl cursor-pointer"
                    >
                      পরিবর্তন নিশ্চিত করুন
                    </button>
                  </div>
                </>
              )}
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Change Working Date & Day Close */}
      {isWorkingDayModalOpen && (() => {
        const autoNextDay = getCalculatedNextWorkingDay(workingDay, holidays);
        const currentBnDate = new Date(workingDay + 'T00:00:00').toLocaleDateString('bn-BD', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
        const nextBnDate = new Date(autoNextDay + 'T00:00:00').toLocaleDateString('bn-BD', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 animate-in fade-in duration-100">
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 animate-in zoom-in-95 duration-150 space-y-4">
              <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                <h3 className="font-extrabold text-slate-800 text-sm flex items-center gap-2">
                  <Clock size={18} className="text-emerald-600" />
                  <span>কর্মদিবস ব্যবস্থাপনা (Working Day Management)</span>
                </h3>
                <button onClick={() => setIsWorkingDayModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer">
                  <X size={18} />
                </button>
              </div>

              {/* Automatic Day Close Card (Primary Feature) */}
              <div className="bg-emerald-50/80 border border-emerald-200 rounded-2xl p-4 space-y-3">
                <div className="flex items-center gap-2 text-emerald-800 font-extrabold text-xs">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  <span>স্বয়ংক্রিয় ডে ক্লোজ ও স্থানান্তর</span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-white/80 p-2.5 rounded-xl border border-emerald-100">
                    <p className="text-[10px] font-bold text-slate-500">বর্তমান কর্মদিবস:</p>
                    <p className="font-mono font-black text-slate-800 text-xs mt-0.5">{workingDay}</p>
                    <p className="text-[10px] text-slate-500 font-medium">{currentBnDate.split(',')[0]}</p>
                  </div>
                  <div className="bg-emerald-600/10 p-2.5 rounded-xl border border-emerald-300/50">
                    <p className="text-[10px] font-bold text-emerald-700">পরবর্তী কর্মদিবস:</p>
                    <p className="font-mono font-black text-emerald-900 text-xs mt-0.5">{autoNextDay}</p>
                    <p className="text-[10px] text-emerald-700 font-medium">{nextBnDate.split(',')[0]}</p>
                  </div>
                </div>

                <p className="text-[10px] text-slate-500 leading-relaxed">
                  * ঘোষিত ছুটি ও সাপ্তাহিক বন্ধের দিনগুলো স্বয়ংক্রিয়ভাবে এড়িয়ে পরবর্তী সঠিক কর্মদিবস হিসাব করা হয়েছে।
                </p>

                <button 
                  type="button" 
                  onClick={() => { setIsWorkingDayModalOpen(false); handleCloseDay(); }}
                  className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white rounded-xl text-xs font-black flex items-center justify-center gap-2 shadow-sm transition duration-150 cursor-pointer"
                >
                  <Lock size={15} />
                  <span>ডে ক্লোজ করে স্বয়ংক্রিয়ভাবে স্থানান্তর করুন ({autoNextDay})</span>
                </button>
              </div>

              {/* Manual Date Override (Secondary Feature) */}
              <div className="pt-2 border-t border-slate-100">
                <details className="group">
                  <summary className="text-xs font-bold text-slate-500 hover:text-slate-800 cursor-pointer flex items-center justify-between py-1">
                    <span>বিশেষ প্রয়োজনে ম্যানুয়ালি তারিখ নির্বাচন করুন (Manual Override)</span>
                    <span className="text-[10px] text-slate-400 group-open:rotate-180 transition-transform">▼</span>
                  </summary>
                  
                  <form onSubmit={handleUpdateWorkingDay} className="mt-3 space-y-3 bg-slate-50 p-3 rounded-xl border border-slate-200/80">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">কাস্টম তারিখ নির্বাচন করুন</label>
                      <input 
                        type="date" 
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold focus:ring-2 focus:ring-emerald-500 focus:outline-none" 
                        value={workingDayInput} 
                        onChange={(e) => setWorkingDayInput(e.target.value)}
                        required
                      />
                    </div>

                    <div className="flex gap-2">
                      <button type="button" onClick={() => setIsWorkingDayModalOpen(false)} className="flex-1 py-1.5 bg-slate-200 hover:bg-slate-300 rounded-xl text-xs font-bold text-slate-700 cursor-pointer">বাতিল</button>
                      <button type="submit" className="flex-1 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold cursor-pointer transition">তারিখ সেভ করুন</button>
                    </div>
                  </form>
                </details>
              </div>
            </div>
          </div>
        );
      })()}

      {/* MODAL: Declare New Holiday */}
      {isHolidayModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 animate-in fade-in duration-100 text-left">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden border border-slate-100 animate-in zoom-in-95 duration-150">
            <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200/80 flex justify-between items-center">
              <h3 className="font-bold text-slate-800 text-xs sm:text-sm flex items-center gap-1.5">
                <Calendar size={16} className="text-emerald-600" /> নতুন ছুটি ঘোষণা (Declare Holiday)
              </h3>
              <button type="button" onClick={() => setIsHolidayModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer">
                <X size={18} />
              </button>
            </div>
            
            <form onSubmit={handleAddHoliday} className="p-5 space-y-4">
              
              {/* Holiday type selection radio segment */}
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">ছুটির ধরণ</label>
                <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setHolidayType('direct')}
                    className={`py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                      holidayType === 'direct' ? 'bg-white text-slate-800 shadow-xs' : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    সরাসরি বিশেষ ছুটি
                  </button>
                  <button
                    type="button"
                    onClick={() => setHolidayType('general')}
                    className={`py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                      holidayType === 'general' ? 'bg-white text-slate-800 shadow-xs' : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    সাধারণ / সাপ্তাহিক
                  </button>
                </div>
              </div>

              {/* Holiday Reason */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">ছুটির নাম বা কারণ *</label>
                <input 
                  type="text" 
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-1 focus:ring-emerald-500 focus:outline-none placeholder:text-slate-400 font-semibold" 
                  value={holidayName} 
                  onChange={(e) => setHolidayName(e.target.value)}
                  placeholder={holidayType === 'direct' ? 'যেমন: স্বাধীনতা দিবস, শবে বরাত ইত্যাদি' : 'যেমন: সাপ্তাহিক শুক্রবার ছুটি'}
                  required
                />
              </div>

              {/* Specific Date input if HolidayType === 'direct' */}
              {holidayType === 'direct' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">ছুটির নির্দিষ্ট তারিখ *</label>
                  <input 
                    type="date" 
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-1 focus:ring-emerald-500 focus:outline-none font-bold" 
                    value={holidayDate} 
                    onChange={(e) => setHolidayDate(e.target.value)}
                    required
                  />
                </div>
              )}

              {/* Day of Week select dropdown if HolidayType === 'general' */}
              {holidayType === 'general' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">স্থায়ী সাপ্তাহিক সচল দিন *</label>
                  <select
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-1 focus:ring-emerald-500 focus:outline-none font-semibold cursor-pointer"
                    value={holidayDayOfWeek}
                    onChange={(e) => setHolidayDayOfWeek(e.target.value)}
                    required
                  >
                    <option value="শুক্রবার">শুক্রবার (Friday)</option>
                    <option value="শনিবার">শনিবার (Saturday)</option>
                    <option value="রবিবার">রবিবার (Sunday)</option>
                    <option value="সোমবার">সোমবার (Monday)</option>
                    <option value="মঙ্গলবার">মঙ্গলবার (Tuesday)</option>
                    <option value="বুধবার">বুধবার (Wednesday)</option>
                    <option value="বৃহস্পতিবার">বৃহস্পতিবার (Thursday)</option>
                  </select>
                </div>
              )}

              <div className="flex gap-2.5 pt-2">
                <button 
                  type="button" 
                  onClick={() => setIsHolidayModalOpen(false)}
                  className="flex-1 py-1.5 text-xs font-bold text-slate-600 bg-slate-100 rounded-xl hover:bg-slate-200 cursor-pointer"
                >
                  বাতিল
                </button>
                <button 
                  type="submit"
                  className="flex-1 py-1.5 text-xs font-bold text-white bg-emerald-600 rounded-xl hover:bg-emerald-700 transition cursor-pointer"
                >
                  ছুটি ঘোষণা করুন
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Custom Confirmation Modal */}
      {confirmModal && confirmModal.isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/70 animate-in fade-in duration-100 text-left">
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full overflow-hidden border border-slate-100 p-5 space-y-4">
            <h4 className="font-extrabold text-slate-900 text-sm flex items-center gap-1.5">
              ⚠️ {confirmModal.title}
            </h4>
            <p className="text-xs text-slate-600 font-semibold leading-relaxed">
              {confirmModal.message}
            </p>
            <div className="flex gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setConfirmModal(null)}
                className="flex-1 py-2 text-xs font-bold text-slate-600 bg-slate-100 rounded-xl hover:bg-slate-200 cursor-pointer"
              >
                বাতিল (Cancel)
              </button>
              <button
                type="button"
                onClick={confirmModal.onConfirm}
                className="flex-1 py-2 text-xs font-bold text-white bg-emerald-600 rounded-xl hover:bg-emerald-700 transition cursor-pointer"
              >
                হ্যাঁ, নিশ্চিত (Confirm)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Alert Modal */}
      {alertModal && alertModal.isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/70 animate-in fade-in duration-100 text-left">
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full overflow-hidden border border-slate-100 p-5 space-y-4">
            <h4 className="font-extrabold text-slate-900 text-sm flex items-center gap-1.5">
              📢 {alertModal.title}
            </h4>
            <p className="text-xs text-slate-600 font-semibold leading-relaxed">
              {alertModal.message}
            </p>
            <div className="flex pt-1.5">
              <button
                type="button"
                onClick={() => setAlertModal(null)}
                className="w-full py-2 text-xs font-bold text-white bg-emerald-600 rounded-xl hover:bg-emerald-700 transition cursor-pointer"
              >
                ঠিক আছে (OK)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Savings Statement Modal */}
      {statementModalAccount && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/70 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200 flex flex-col max-h-[85vh]">
            <div className="p-4 bg-blue-600 text-white flex justify-between items-center">
              <h4 className="font-bold text-sm">Transaction History {statementModalAccount.memberName}/{statementModalAccount.accountNo}</h4>
              <button onClick={() => setStatementModalAccount(null)} className="text-white hover:text-blue-200">✕</button>
            </div>
            <div className="flex-1 overflow-y-auto p-0">
              <table className="w-full text-xs text-left border-collapse">
                <thead className="bg-slate-100 sticky top-0">
                  <tr>
                    <th className="p-2 border-b">Date</th>
                    <th className="p-2 border-b">Amount</th>
                    <th className="p-2 border-b">Type</th>
                    <th className="p-2 border-b">Process</th>
                  </tr>
                </thead>
                <tbody>
                  {statementModalAccount.transactions?.map((tx: any, idx: number) => (
                    <tr key={idx} className="border-b hover:bg-slate-50">
                      <td className="p-2">{tx.date}</td>
                      <td className="p-2 text-blue-600 font-mono font-bold">{tx.amount}</td>
                      <td className="p-2">{tx.type}</td>
                      <td className="p-2">{tx.process}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="p-4 bg-slate-50 border-t flex justify-end">
                <button onClick={() => setStatementModalAccount(null)} className="px-4 py-2 bg-slate-800 text-white rounded-lg text-xs font-bold">DONE</button>
            </div>
          </div>
        </div>
      )}

      {/* Batch Defaulter Settlement Modal */}
      {isBatchDefaulterModalOpen && (
        <div className="fixed inset-0 z-[120] bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-5xl w-full max-h-[92vh] flex flex-col overflow-hidden text-left">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-rose-700 via-rose-600 to-amber-600 text-white p-4 sm:p-5 flex justify-between items-center shadow-sm">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-white/15 rounded-2xl backdrop-blur-md">
                  <Zap className="w-6 h-6 text-amber-300" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base sm:text-lg tracking-tight">
                    মেয়াদ উত্তীর্ণ সদস্যদের অটো সঞ্চয় হতে ঋণ সমন্বয়
                  </h3>
                  <p className="text-[11px] text-rose-100 font-medium mt-0.5">
                    শাখার মেয়াদ উত্তীর্ণ / খেলাপি সদস্যদের সঞ্চয় (GS - ১০টাকা সংরক্ষিত, LTS, CBS) ও শেয়ার হতে বকেয়া ঋণ পর্যায়ক্রমিক অটো সমন্বয়
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsBatchDefaulterModalOpen(false)}
                className="p-1.5 rounded-full hover:bg-white/20 text-white transition-colors cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Summary Grid */}
            <div className="p-4 bg-slate-50 border-b border-slate-200 grid grid-cols-2 sm:grid-cols-4 gap-3 shrink-0">
              <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-3xs">
                <span className="text-[10px] font-bold text-slate-500 uppercase block">মেয়াদ উত্তীর্ণ সদস্য</span>
                <span className="text-base font-black text-slate-800 font-mono">
                  {batchTotals.selectedCount} / {batchTotals.totalDefaulters} জন
                </span>
                <span className="text-[9px] text-slate-400 font-bold block mt-0.5">
                  (সিলেক্টেড: {batchTotals.selectedCount} জন)
                </span>
              </div>

              <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-3xs">
                <span className="text-[10px] font-bold text-rose-600 uppercase block">সিলেক্টেড বকেয়া ঋণ</span>
                <span className="text-base font-black text-rose-700 font-mono">৳ {batchTotals.totalOutstanding.toLocaleString('bn-BD')}</span>
              </div>

              <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-3xs">
                <span className="text-[10px] font-bold text-emerald-600 uppercase block">সঞ্চয় হতে মোট সমন্বয়</span>
                <span className="text-base font-black text-emerald-700 font-mono">৳ {batchTotals.totalOverallAdjusted.toLocaleString('bn-BD')}</span>
              </div>

              <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-3xs">
                <span className="text-[10px] font-bold text-amber-600 uppercase block">অবশিষ্ট বকেয়া ঋণ</span>
                <span className="text-base font-black text-amber-700 font-mono">
                  ৳ {batchTotals.totalRemainingLoan.toLocaleString('bn-BD')}
                </span>
                <span className="text-[9px] text-emerald-600 font-bold block mt-0.5">
                  ({batchTotals.fullySettledCount} জন সম্পূর্ণ পরিশোধিত)
                </span>
              </div>
            </div>

            {/* Table Search & Filter Bar */}
            <div className="p-3 bg-white border-b border-slate-100 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shrink-0">
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="মেয়াদ উত্তীর্ণ সদস্যের নাম, কোড বা গ্রুপ দিয়ে খুঁজুন..."
                  className="w-full pl-9 pr-3 py-1.5 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-rose-500 font-medium"
                  value={batchSearchQuery}
                  onChange={(e) => setBatchSearchQuery(e.target.value)}
                />
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const allIds = batchAdjustmentPreviews.map(p => p.member.id);
                    if (selectedMemberIds.length === allIds.length) {
                      setSelectedMemberIds([]);
                    } else {
                      setSelectedMemberIds(allIds);
                    }
                  }}
                  className="px-3 py-1.5 text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition cursor-pointer"
                >
                  {selectedMemberIds.length === batchAdjustmentPreviews.length ? 'সকল আনসিলেক্ট করুন' : 'সব সিলেক্ট করুন'}
                </button>
                <div className="text-[11px] font-bold text-slate-500 hidden md:block">
                  পর্যায়ক্রম: <span className="text-rose-700 font-extrabold">GS (১০টাকা সংরক্ষিত) ➔ LTS ➔ CBS ➔ Share</span>
                </div>
              </div>
            </div>

            {/* Scrollable Members List Table */}
            <div className="flex-1 overflow-y-auto p-3 sm:p-4">
              {batchAdjustmentPreviews.length === 0 ? (
                <div className="py-12 text-center text-slate-400 font-bold text-xs space-y-2">
                  <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto opacity-80" />
                  <p>শাখায় বর্তমানে কোনো মেয়াদ উত্তীর্ণ বা খেলাপি ঋণগ্রহীতা সদস্য নেই!</p>
                </div>
              ) : (
                <div className="overflow-x-auto border border-slate-200 rounded-2xl">
                  <table className="w-full text-xs text-left border-collapse">
                    <thead className="bg-slate-100 text-slate-700 font-extrabold uppercase text-[10px] sticky top-0 border-b border-slate-200">
                      <tr>
                        <th className="p-2.5 text-center w-10">
                          <input
                            type="checkbox"
                            className="w-4 h-4 rounded border-slate-300 text-rose-600 focus:ring-rose-500 cursor-pointer"
                            checked={
                              batchAdjustmentPreviews.length > 0 &&
                              batchAdjustmentPreviews
                                .filter(p => {
                                  if (!batchSearchQuery.trim()) return true;
                                  const q = batchSearchQuery.toLowerCase();
                                  return (
                                    p.member.name?.toLowerCase().includes(q) ||
                                    (p.member.memberId || p.member.id)?.toLowerCase().includes(q) ||
                                    p.member.groupName?.toLowerCase().includes(q)
                                  );
                                })
                                .every(p => selectedMemberSet.has(p.member.id))
                            }
                            onChange={(e) => {
                              const filteredIds = batchAdjustmentPreviews
                                .filter(p => {
                                  if (!batchSearchQuery.trim()) return true;
                                  const q = batchSearchQuery.toLowerCase();
                                  return (
                                    p.member.name?.toLowerCase().includes(q) ||
                                    (p.member.memberId || p.member.id)?.toLowerCase().includes(q) ||
                                    p.member.groupName?.toLowerCase().includes(q)
                                  );
                                })
                                .map(p => p.member.id);

                              if (e.target.checked) {
                                setSelectedMemberIds(prev => Array.from(new Set([...prev, ...filteredIds])));
                              } else {
                                setSelectedMemberIds(prev => prev.filter(id => !filteredIds.includes(id)));
                              }
                            }}
                          />
                        </th>
                        <th className="p-2.5">মেয়াদ উত্তীর্ণ সদস্য ও কোড</th>
                        <th className="p-2.5">গ্রুপ / সমিতি</th>
                        <th className="p-2.5 text-right">বকেয়া ঋণ</th>
                        <th className="p-2.5 text-right text-emerald-700">GS সমন্বয়</th>
                        <th className="p-2.5 text-right text-emerald-700">LTS সমন্বয়</th>
                        <th className="p-2.5 text-right text-emerald-700">CBS সমন্বয়</th>
                        <th className="p-2.5 text-right text-emerald-700">শেয়ার সমন্বয়</th>
                        <th className="p-2.5 text-right text-blue-700">মোট সমন্বয়</th>
                        <th className="p-2.5 text-right">অবশিষ্ট ঋণ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium">
                      {batchAdjustmentPreviews
                        .filter(p => {
                          if (!batchSearchQuery.trim()) return true;
                          const q = batchSearchQuery.toLowerCase();
                          return (
                            p.member.name?.toLowerCase().includes(q) ||
                            (p.member.memberId || p.member.id)?.toLowerCase().includes(q) ||
                            p.member.groupName?.toLowerCase().includes(q)
                          );
                        })
                        .map((p, idx) => {
                          const isSelected = selectedMemberSet.has(p.member.id);
                          return (
                            <tr
                              key={idx}
                              className={`transition-colors cursor-pointer ${
                                isSelected ? 'bg-rose-50/40 hover:bg-rose-50/70' : 'bg-slate-50/40 hover:bg-slate-100 opacity-60'
                              }`}
                              onClick={() => toggleSelectMember(p.member.id)}
                            >
                              <td className="p-2.5 text-center" onClick={(e) => e.stopPropagation()}>
                                <input
                                  type="checkbox"
                                  className="w-4 h-4 rounded border-slate-300 text-rose-600 focus:ring-rose-500 cursor-pointer"
                                  checked={isSelected}
                                  onChange={() => toggleSelectMember(p.member.id)}
                                />
                              </td>
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
                              <td className="p-2.5 text-slate-600 font-semibold">{p.member.groupName || 'শাখা গ্রুপ'}</td>
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
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Modal Action Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row justify-between items-center gap-3 shrink-0">
              <div className="text-[11px] text-slate-500 font-semibold">
                * সিলেক্টকৃত সকল সদস্যদের সঞ্চয় ও শেয়ার হ্রাস পেয়ে লোন খতিয়ানে অটো পোস্টিং হবে।
              </div>
              <div className="flex items-center gap-2.5 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => setIsBatchDefaulterModalOpen(false)}
                  className="px-4 py-2 text-xs font-extrabold text-slate-600 bg-slate-200 hover:bg-slate-300 rounded-xl transition cursor-pointer"
                >
                  বাতিল করুন
                </button>
                <button
                  type="button"
                  disabled={batchTotals.selectedCount === 0 || batchTotals.totalOverallAdjusted === 0}
                  onClick={executeBatchDefaulterAdjustment}
                  className="px-5 py-2.5 text-xs font-black text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl shadow-md hover:shadow-lg transition flex items-center justify-center gap-2 cursor-pointer active:scale-95"
                >
                  <Zap size={14} />
                  নির্বাচিত সদস্যদের (মোট {batchTotals.selectedCount} জন) অটো সঞ্চয় হতে ঋণ সমন্বয় সম্পন্ন করুন
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
