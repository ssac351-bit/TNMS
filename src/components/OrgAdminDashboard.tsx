/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  Building, 
  UserCheck, 
  Users, 
  LogOut, 
  Plus, 
  Search, 
  Trash2, 
  Phone, 
  MapPin, 
  Calendar, 
  X,
  Settings,
  Save,
  Sliders,
  Shield,
  Eye,
  EyeOff,
  Globe,
  RefreshCw,
  Mail,
  FileText,
  Lock,
  Key,
  Clock,
  Info,
  Check,
  Pencil,
  Edit2,
  Layers,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Upload,
  CheckCircle,
  Coins
} from 'lucide-react';
import { Organization, Staff, Branch, Holiday, Group, LoanProductConfig } from '../types';
import SyncStatusHub from './SyncStatusHub';
import ReportViews from './ReportViews';
import { getDefaultHolidays } from '../utils/holidayHelper';
import BranchManagerDashboard from './BranchManagerDashboard';
import { TanzilLogo } from './TanzilLogo';
import { OrgLogo } from './OrgLogo';
import { registerDeletedId } from '../lib/deletedIds';
import { MasterRollView } from './MasterRollView';
import { UnifiedReportsPanel } from './UnifiedReportsPanel';
import { logAuditEvent } from '../utils/auditLogger';
import { AuditLogView } from './AuditLogView';

interface OrgAdminDashboardProps {
  org: Organization;
  onLogout: () => void;
  onUpdateOrg?: (updatedOrg: Organization) => void;
}

type ActiveTab = 'home' | 'branches' | 'staff' | 'config' | 'loan-scheme-config' | 'reports' | 'holidays' | 'operations' | 'master-roll' | 'audit-logs';

export default function OrgAdminDashboard({ org, onLogout, onUpdateOrg }: OrgAdminDashboardProps) {
  const [activeTab, setActiveTab] = useState<ActiveTab>('home');
  const [selectedReportType, setSelectedReportType] = useState<string>('loan_calc');

  // Simulation of other user panels
  const [selectedSimulationStaff, setSelectedSimulationStaff] = useState<Staff | null>(null);
  const [selectedSimBranchId, setSelectedSimBranchId] = useState('');
  const [selectedSimStaffId, setSelectedSimStaffId] = useState('');

  // Load branches and staff list from localStorage based on org.id
  const [branchesList, setBranchesList] = useState<Branch[]>(() => {
    const saved = localStorage.getItem(`tanzil_branches_${org.id}`);
    return saved ? JSON.parse(saved) : [];
  });

  const hasAutoRestoredRef = useRef(false);

  // Automatically restore from cloud if local data is missing
  useEffect(() => {
    async function autoRestore() {
      if (hasAutoRestoredRef.current) return;
      if (branchesList.length === 0) {
        hasAutoRestoredRef.current = true;
        try {
          const { getDocs, collection, query, where } = await import('firebase/firestore');
          const { db } = await import('../lib/firebase');
          
          const syncDataCol = collection(db, 'SyncData');
          const q = query(syncDataCol, where('orgId', '==', org.id));
          const querySnapshot = await getDocs(q);
          
          if (!querySnapshot.empty) {
            console.log(`AutoRestore merging ${querySnapshot.size} Cloud SyncData documents for organization ${org.name}...`);
            
            let globalDeletedIds: string[] = [];
            querySnapshot.docs.forEach(docSnap => {
              const data = docSnap.data();
              if (data.deletedIds && Array.isArray(data.deletedIds)) {
                data.deletedIds.forEach((id: string) => {
                  if (!globalDeletedIds.includes(id)) {
                    globalDeletedIds.push(id);
                  }
                });
              }
            });

            localStorage.setItem(`tanzil_deleted_ids_${org.id}`, JSON.stringify(globalDeletedIds));

            let mergedBranches: any[] = [];
            let mergedStaff: any[] = [];
            let mergedGroups: any[] = [];
            let mergedMembers: any[] = [];
            let mergedLoanProposals: any[] = [];
            let mergedSavings: any[] = [];
            let mergedCbs: any[] = [];
            let mergedLts: any[] = [];
            let mergedHolidays: any[] = [];
            let mergedTransactions: Record<string, any[]> = {};
            let mergedPolicies: Record<string, any> = {};
            let latestWorkingDay = '';
            let latestUpdatedTime = 0;

            querySnapshot.docs.forEach(docSnap => {
              const data = docSnap.data();
              const updatedTime = data.lastUpdated ? new Date(data.lastUpdated).getTime() : 0;
              
              if (updatedTime > latestUpdatedTime) {
                latestUpdatedTime = updatedTime;
                if (data.workingDay) latestWorkingDay = data.workingDay;
              }

              if (data.branches && Array.isArray(data.branches)) {
                data.branches.forEach((item: any) => {
                  if (globalDeletedIds.includes(String(item.id))) return;
                  if (!mergedBranches.some(x => x.id === item.id)) {
                    mergedBranches.push(item);
                  }
                });
              }

              if (data.staff && Array.isArray(data.staff)) {
                data.staff.forEach((item: any) => {
                  if (globalDeletedIds.includes(String(item.id)) || (item.staffId && globalDeletedIds.includes(String(item.staffId)))) return;
                  if (!mergedStaff.some(x => x.id === item.id || (x.staffId && x.staffId === item.staffId))) {
                    mergedStaff.push(item);
                  }
                });
              }

              if (data.groups && Array.isArray(data.groups)) {
                data.groups.forEach((item: any) => {
                  if (globalDeletedIds.includes(String(item.id))) return;
                  if (!mergedGroups.some(x => x.id === item.id)) {
                    mergedGroups.push(item);
                  }
                });
              }

              if (data.members && Array.isArray(data.members)) {
                data.members.forEach((item: any) => {
                  if (globalDeletedIds.includes(String(item.id)) || (item.memberId && globalDeletedIds.includes(String(item.memberId)))) return;
                  if (!mergedMembers.some(x => x.id === item.id)) {
                    mergedMembers.push(item);
                  }
                });
              }

              if (data.loanProposals && Array.isArray(data.loanProposals)) {
                data.loanProposals.forEach((item: any) => {
                  if (globalDeletedIds.includes(String(item.id))) return;
                  if (!mergedLoanProposals.some(x => x.id === item.id)) {
                    mergedLoanProposals.push(item);
                  }
                });
              }

              if (data.savings && Array.isArray(data.savings)) {
                data.savings.forEach((item: any) => {
                  if (globalDeletedIds.includes(String(item.id))) return;
                  if (!mergedSavings.some(x => x.id === item.id)) {
                    mergedSavings.push(item);
                  }
                });
              }

              if (data.cbs && Array.isArray(data.cbs)) {
                data.cbs.forEach((item: any) => {
                  if (globalDeletedIds.includes(String(item.id))) return;
                  if (!mergedCbs.some(x => x.id === item.id)) {
                    mergedCbs.push(item);
                  }
                });
              }

              if (data.lts && Array.isArray(data.lts)) {
                data.lts.forEach((item: any) => {
                  if (globalDeletedIds.includes(String(item.id))) return;
                  if (!mergedLts.some(x => x.id === item.id)) {
                    mergedLts.push(item);
                  }
                });
              }

              if (data.holidays && Array.isArray(data.holidays)) {
                data.holidays.forEach((item: any) => {
                  if (globalDeletedIds.includes(String(item.id))) return;
                  if (!mergedHolidays.some(x => x.id === item.id || x.date === item.date)) {
                    mergedHolidays.push(item);
                  }
                });
              }

              if (data.transactions) {
                Object.entries(data.transactions).forEach(([bId, list]) => {
                  if (Array.isArray(list)) {
                    if (!mergedTransactions[bId]) mergedTransactions[bId] = [];
                    list.forEach((tx: any) => {
                      if (globalDeletedIds.includes(String(tx.id))) return;
                      if (!mergedTransactions[bId].some(x => x.id === tx.id)) {
                        mergedTransactions[bId].push(tx);
                      }
                    });
                  }
                });
              }

              if (data.policies) {
                Object.entries(data.policies).forEach(([k, val]) => {
                  if (val !== null && val !== undefined && val !== '') {
                    mergedPolicies[k] = val;
                  }
                });
              }
            });

            if (mergedBranches.length > 0) localStorage.setItem(`tanzil_branches_${org.id}`, JSON.stringify(mergedBranches));
            if (mergedStaff.length > 0) localStorage.setItem(`tanzil_staff_${org.id}`, JSON.stringify(mergedStaff));
            if (mergedGroups.length > 0) localStorage.setItem(`tanzil_groups_${org.id}`, JSON.stringify(mergedGroups));
            if (mergedMembers.length > 0) localStorage.setItem(`tanzil_group_members_${org.id}`, JSON.stringify(mergedMembers));
            if (mergedLoanProposals.length > 0) localStorage.setItem(`tanzil_loan_proposals_${org.id}`, JSON.stringify(mergedLoanProposals));
            if (mergedSavings.length > 0) localStorage.setItem(`tanzil_savings_accounts_${org.id}`, JSON.stringify(mergedSavings));
            if (mergedCbs.length > 0) localStorage.setItem(`tanzil_cbs_accounts_${org.id}`, JSON.stringify(mergedCbs));
            if (mergedLts.length > 0) localStorage.setItem(`tanzil_lts_accounts_${org.id}`, JSON.stringify(mergedLts));
            if (mergedHolidays.length > 0) localStorage.setItem(`tanzil_holidays_${org.id}`, JSON.stringify(mergedHolidays));
            
            if (latestWorkingDay) {
              localStorage.setItem(`tanzil_admin_working_day_${org.id}`, latestWorkingDay);
              mergedBranches.forEach((b: any) => {
                localStorage.setItem(`tanzil_working_day_${org.id}_branch_${b.id}`, latestWorkingDay);
              });
            }

            Object.entries(mergedTransactions).forEach(([bId, list]) => {
              localStorage.setItem(`tanzil_bm_tx_${org.id}_${bId}`, JSON.stringify(list));
            });

            Object.entries(mergedPolicies).forEach(([k, val]) => {
              localStorage.setItem(`tanzil_${k}_${org.id}`, String(val));
            });
            
            // Seamlessly update React state without disruptive window reload loops
            if (mergedBranches.length > 0) {
              setBranchesList(mergedBranches);
            }
            window.dispatchEvent(new Event('storage'));
            window.dispatchEvent(new CustomEvent('tanzil_data_synced'));
          }
        } catch (e: any) {
          if (e?.message?.includes('offline') || !navigator.onLine) {
            console.warn("Auto restore is deferred because the client is offline.");
          } else {
            console.error("Auto restore failed", e);
          }
        }
      }
    }
    autoRestore();
  }, [org.id]);

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

  const [groupMembers, setGroupMembers] = useState<any[]>(() => {
    const saved = localStorage.getItem(`tanzil_group_members_${org.id}`);
    return saved ? JSON.parse(saved) : [];
  });

  // Save states back to localStorage
  useEffect(() => {
    localStorage.setItem(`tanzil_branches_${org.id}`, JSON.stringify(branchesList));
  }, [branchesList, org.id]);

  useEffect(() => {
    localStorage.setItem(`tanzil_staff_${org.id}`, JSON.stringify(staffList));
  }, [staffList, org.id]);

  useEffect(() => {
    localStorage.setItem(`tanzil_group_members_${org.id}`, JSON.stringify(groupMembers));
  }, [groupMembers, org.id]);

  // Load holidays list from localStorage based on org.id
  const [holidaysList, setHolidaysList] = useState<Holiday[]>(() => {
    const saved = localStorage.getItem(`tanzil_holidays_${org.id}`);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      } catch (e) {
        console.error("Error parsing holidays", e);
      }
    }
    const defaultHolidays = getDefaultHolidays(org.id);
    localStorage.setItem(`tanzil_holidays_${org.id}`, JSON.stringify(defaultHolidays));
    return defaultHolidays;
  });

  useEffect(() => {
    localStorage.setItem(`tanzil_holidays_${org.id}`, JSON.stringify(holidaysList));
  }, [holidaysList, org.id]);

  // Custom sub-tab for Configuration Panel
  const [configSubTab, setConfigSubTab] = useState<'general' | 'loan-scheme' | 'share-policy'>('general');

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

  // Holiday Modal & Form States
  const [isHolidayModalOpen, setIsHolidayModalOpen] = useState(false);
  const [editingHolidayId, setEditingHolidayId] = useState<string | null>(null);
  const [holidayType, setHolidayType] = useState<'direct' | 'general'>('direct');
  const [holidayName, setHolidayName] = useState('');
  const [holidayDate, setHolidayDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [holidayDayOfWeek, setHolidayDayOfWeek] = useState('শুক্রবার');

  const replaceNumbersWithBN = (num: number | string) => {
    const numbers: { [key: string]: string } = {
      '0': '০', '1': '১', '2': '২', '3': '৩', '4': '৪', '5': '৫', '6': '৬', '7': '৭', '8': '৮', '9': '৯'
    };
    return num.toString().split('').map(x => numbers[x] || x).join('');
  };

  // Working day state & dialogs
  const [workingDay, setWorkingDay] = useState(() => {
    return localStorage.getItem(`tanzil_admin_working_day_${org.id}`) || 
           localStorage.getItem(`tanzil_working_day_${org.id}`) || 
           new Date().toISOString().split('T')[0];
  });
  const [isWorkingDayModalOpen, setIsWorkingDayModalOpen] = useState(false);
  const [workingDayInput, setWorkingDayInput] = useState(workingDay);

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

  // Topbar Action Change Password dialogs
  const [isChangePasswordModalOpen, setIsChangePasswordModalOpen] = useState(false);
  const [oldPasswordVal, setOldPasswordVal] = useState('');
  const [newPasswordVal, setNewPasswordVal] = useState('');
  const [confirmPasswordVal, setConfirmPasswordVal] = useState('');
  const [passwordChangeSuccess, setPasswordChangeSuccess] = useState('');

  // Search filter query state
  const [searchTerm, setSearchTerm] = useState('');
  const [holidayYearFilter, setHolidayYearFilter] = useState('all');
  const [holidaySearchQuery, setHolidaySearchQuery] = useState('');
  const [holidayViewMode, setHolidayViewMode] = useState<'calendar' | 'list'>('calendar');
  const [currentCalendarYear, setCurrentCalendarYear] = useState(2026);
  const [currentCalendarMonth, setCurrentCalendarMonth] = useState(5); // June is 5 (0-indexed)

  // Modal & Form States for Branches (Manager state is removed, automatically resolved from staff list)
  const [isBranchModalOpen, setIsBranchModalOpen] = useState(false);
  const [isRestoreBranchModalOpen, setIsRestoreBranchModalOpen] = useState(false);
  const [isBranchEditMode, setIsBranchEditMode] = useState(false);
  const [editingBranchId, setEditingBranchId] = useState<string | null>(null);
  const [branchName, setBranchName] = useState('');
  const [branchCode, setBranchCode] = useState('');
  const [branchPhone, setBranchPhone] = useState('');
  const [branchAddress, setBranchAddress] = useState('');
  const [branchDate, setBranchDate] = useState(() => new Date().toISOString().split('T')[0]);

  // Modal & Form States for Staff (Added working branch and branch joining date)
  const [isStaffModalOpen, setIsStaffModalOpen] = useState(false);
  const [isStaffEditMode, setIsStaffEditMode] = useState(false);
  const [editingStaffId, setEditingStaffId] = useState<string | null>(null);
  const [staffName, setStaffName] = useState('');
  const [staffPhone, setStaffPhone] = useState('');
  const [staffDesignation, setStaffDesignation] = useState('মাঠ কর্মী');
  const [staffDate, setStaffDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [staffBranchId, setStaffBranchId] = useState('');
  const [staffBranchJoiningDate, setStaffBranchJoiningDate] = useState(() => new Date().toISOString().split('T')[0]);

  // Configuration values (Loaded and synchronized to localStorage)
  const [orgName, setOrgName] = useState(org.name);
  const [orgAddress, setOrgAddress] = useState(org.address);
  const [orgPassword, setOrgPassword] = useState(org.adminPassword);
  
  const [minSavings, setMinSavings] = useState(() => localStorage.getItem(`tanzil_min_savings_${org.id}`) || '৫০');
  const [savingsInterest, setSavingsInterest] = useState(() => localStorage.getItem(`tanzil_savings_interest_${org.id}`) || '৮');
  const [maxLoanLimit, setMaxLoanLimit] = useState(() => localStorage.getItem(`tanzil_max_loan_${org.id}`) || '১০০০০০');
  const [withdrawalFee, setWithdrawalFee] = useState(() => localStorage.getItem(`tanzil_withdrawal_fee_${org.id}`) || '২');

  // --- Configuration Section 1: General Info ---
  const [orgPhone, setOrgPhone] = useState(() => localStorage.getItem(`tanzil_phone_${org.id}`) || '01712345678');
  const [orgEmail, setOrgEmail] = useState(() => localStorage.getItem(`tanzil_email_${org.id}`) || 'info@tanzilcredit.org');
  const [orgWebsite, setOrgWebsite] = useState(() => localStorage.getItem(`tanzil_website_${org.id}`) || 'www.tanzilcredit.org');
  const [orgTradeLicense, setOrgTradeLicense] = useState(() => localStorage.getItem(`tanzil_trade_license_${org.id}`) || 'TR-72849/2026');
  const [orgLogoStyle, setOrgLogoStyle] = useState(() => localStorage.getItem(`tanzil_logo_style_${org.id}`) || 'shield'); // icon style preset
  const [orgLogoUrl, setOrgLogoUrl] = useState(() => localStorage.getItem(`tanzil_logo_url_${org.id}`) || ''); // custom base64/url if provided

  // --- Configuration Section 2: Loan Settings ---
  const [loanDefaultInterest, setLoanDefaultInterest] = useState(() => localStorage.getItem(`tanzil_loan_interest_${org.id}`) || '১২');
  const [loanInterestType, setLoanInterestType] = useState(() => localStorage.getItem(`tanzil_loan_interest_type_${org.id}`) || 'Declining'); // Flat / Declining
  const [loanMinAmount, setLoanMinAmount] = useState(() => localStorage.getItem(`tanzil_loan_min_${org.id}`) || '৫০০০');
  const [loanMaxAmount, setLoanMaxAmount] = useState(() => localStorage.getItem(`tanzil_loan_max_${org.id}`) || '১০০০০০');
  const [loanDuration, setLoanDuration] = useState(() => localStorage.getItem(`tanzil_loan_duration_${org.id}`) || '৪৫ সপ্তাহ');
  const [loanGracePeriod, setLoanGracePeriod] = useState(() => localStorage.getItem(`tanzil_loan_grace_${org.id}`) || '২ সপ্তাহ');
  const [loanLateFee, setLoanLateFee] = useState(() => localStorage.getItem(`tanzil_loan_late_fee_${org.id}`) || '৫০');
  const [loanProcessingFee, setLoanProcessingFee] = useState(() => localStorage.getItem(`tanzil_loan_processing_fee_${org.id}`) || '০');

  // --- Configuration Section 3: Installment Settings ---
  const [instWeeklyActive, setInstWeeklyActive] = useState(() => localStorage.getItem(`tanzil_inst_weekly_${org.id}`) !== 'false'); // boolean
  const [instMonthlyActive, setInstMonthlyActive] = useState(() => localStorage.getItem(`tanzil_inst_monthly_${org.id}`) !== 'false'); // boolean
  const [instTermActive, setInstTermActive] = useState(() => {
    const term = localStorage.getItem(`tanzil_inst_term_active_${org.id}`);
    if (term !== null) return term === 'true';
    return localStorage.getItem(`tanzil_inst_biweekly_${org.id}`) === 'true';
  }); // boolean
  const [instCollectionDay, setInstCollectionDay] = useState(() => localStorage.getItem(`tanzil_inst_day_${org.id}`) || 'সমিতির বার ভিত্তিক');
  const [instAutoGeneration, setInstAutoGeneration] = useState(() => localStorage.getItem(`tanzil_inst_auto_${org.id}`) !== 'false'); // boolean
  const [instRoundingRule, setInstRoundingRule] = useState(() => localStorage.getItem(`tanzil_inst_rounding_${org.id}`) || 'Nearest 10');

  // --- Configuration Section 4: Savings Settings & Multi-type configuration ---
  const [savingsType, setSavingsType] = useState(() => localStorage.getItem(`tanzil_sav_type_${org.id}`) || 'Regular');
  const [savingsMinDeposit, setSavingsMinDeposit] = useState(() => localStorage.getItem(`tanzil_sav_min_dep_${org.id}`) || '১০০');
  const [savingsMinBalance, setSavingsMinBalance] = useState(() => localStorage.getItem(`tanzil_sav_min_bal_${org.id}`) || '৫০');
  // 4 types of savings profit rates
  const [savProfitGS, setSavProfitGS] = useState(() => localStorage.getItem(`tanzil_sav_profit_gs_${org.id}`) || '৬');
  const [savProfitCBS, setSavProfitCBS] = useState(() => localStorage.getItem(`tanzil_sav_profit_cbs_${org.id}`) || '৮.৫');
  const [savProfitLTS, setSavProfitLTS] = useState(() => localStorage.getItem(`tanzil_sav_profit_lts_${org.id}`) || '১২');
  const [savProfitFDR, setSavProfitFDR] = useState(() => localStorage.getItem(`tanzil_sav_profit_fdr_${org.id}`) || '১২');
  const [savFdrPayoutType, setSavFdrPayoutType] = useState(() => localStorage.getItem(`tanzil_sav_fdr_payout_${org.id}`) || 'মাসিক'); // FDR interest payment fixed type to monthly

  const [savingsAdmissionFee, setSavingsAdmissionFee] = useState(() => localStorage.getItem(`tanzil_sav_admission_fee_${org.id}`) || '১০০');
  const [savingsPassbookFee, setSavingsPassbookFee] = useState(() => localStorage.getItem(`tanzil_sav_passbook_fee_${org.id}`) || '১০');
  const [savingsWelfareFee, setSavingsWelfareFee] = useState(() => localStorage.getItem(`tanzil_sav_welfare_fee_${org.id}`) || '২০');
  // Cooperative Share Capital settings
  const [sharePriceConfig, setSharePriceConfig] = useState(() => localStorage.getItem(`tanzil_share_price_${org.id}`) || '১০');
  const [minShareCountConfig, setMinShareCountConfig] = useState(() => localStorage.getItem(`tanzil_min_shares_${org.id}`) || '১');
  const [maxShareCountConfig, setMaxShareCountConfig] = useState(() => localStorage.getItem(`tanzil_max_shares_${org.id}`) || '১০০');
  const [dividendRateConfig, setDividendRateConfig] = useState(() => localStorage.getItem(`tanzil_dividend_rate_${org.id}`) || '১০');
  const [dividendPayoutMethodConfig, setDividendPayoutMethodConfig] = useState(() => localStorage.getItem(`tanzil_dividend_payout_${org.id}`) || 'সরাসরি সাধারণ সঞ্চয়ে (GS) জমা');
  const [shareRefundPolicyConfig, setShareRefundPolicyConfig] = useState(() => localStorage.getItem(`tanzil_share_refund_${org.id}`) || 'সদস্যপদ অবসান বা পদত্যাগে ফেরতযোগ্য');

  // Loan Insurance fields (বিতরণকৃত আসলের % এবং যৌথ/একক বীমা)
  const [loanInsurancePercent, setLoanInsurancePercent] = useState(() => localStorage.getItem(`tanzil_loan_ins_percent_${org.id}`) || '১');
  const [loanInsuranceType, setLoanInsuranceType] = useState(() => localStorage.getItem(`tanzil_loan_ins_type_${org.id}`) || 'যৌথ বীমা');

  // Mandatory Savings as % of loan principal, running during loan tenure
  const [mandatorySavingsPercent, setMandatorySavingsPercent] = useState(() => localStorage.getItem(`tanzil_mandatory_sav_percent_${org.id}`) || '৫');

  // LLP (Loan Loss Provision - খেলাপি ঋণ সঞ্চিতি) settings
  const [llpStandard, setLlpStandard] = useState(() => localStorage.getItem(`tanzil_llp_standard_${org.id}`) || '১');
  const [llpSubStandard, setLlpSubStandard] = useState(() => localStorage.getItem(`tanzil_llp_substandard_${org.id}`) || '৫');
  const [llpDoubtful, setLlpDoubtful] = useState(() => localStorage.getItem(`tanzil_llp_doubtful_${org.id}`) || '৫০');
  const [llpBad, setLlpBad] = useState(() => localStorage.getItem(`tanzil_llp_bad_${org.id}`) || '১০০');

  // Policy Effective Date state
  const [policyEffectiveDate, setPolicyEffectiveDate] = useState(() => localStorage.getItem(`tanzil_policy_effective_date_${org.id}`) || '2026-06-14');

  const [configSuccessMsg, setConfigSuccessMsg] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // --- Loan Scheme Product Configs States ---
  const [productConfigs, setProductConfigs] = useState<LoanProductConfig[]>(() => {
    const key = `tanzil_loan_product_configs_${org.id}`;
    const saved = localStorage.getItem(key);
    let configs: LoanProductConfig[] = [];
    if (saved) {
      try {
        configs = JSON.parse(saved);
      } catch (e) {
        console.error(e);
      }
    }
    
    // Default to clean unified products if empty or if containing legacy duplicates
    if (!configs || configs.length === 0 || configs.some(c => c.name.includes('- ১২ মাস'))) {
      configs = [
        { id: 'lp-prathomik', name: 'প্রাথমিক ঋণ (General Loan)', durationMonths: 12, installmentsCount: 45, serviceChargeRate: 0.24, type: 'সাপ্তাহিক', allowedTypes: ['সাপ্তাহিক', 'মাসিক', 'মেয়াদি'], allowedTerms: [3, 6, 12, 18, 24] },
        { id: 'lp-jagoron', name: 'জাগরণ ঋণ (Microenterprise Loan)', durationMonths: 12, installmentsCount: 45, serviceChargeRate: 0.24, type: 'সাপ্তাহিক', allowedTypes: ['সাপ্তাহিক', 'মাসিক', 'মেয়াদি'], allowedTerms: [3, 6, 12, 18, 24] },
        { id: 'lp-agrosor', name: 'অগ্রসর ঋণ (Enterprise Loan)', durationMonths: 12, installmentsCount: 12, serviceChargeRate: 0.24, type: 'মাসিক', allowedTypes: ['সাপ্তাহিক', 'মাসিক', 'মেয়াদি'], allowedTerms: [3, 6, 12, 18, 24] },
        { id: 'lp-buniad', name: 'বুনিয়াদ ঋণ (Ultra Poor Loan)', durationMonths: 12, installmentsCount: 45, serviceChargeRate: 0.20, type: 'সাপ্তাহিক', allowedTypes: ['সাপ্তাহিক', 'মাসিক', 'মেয়াদি'], allowedTerms: [3, 6, 12, 18, 24] },
        { id: 'lp-krishi', name: 'কৃষি ও খামার ঋণ (Agriculture Loan)', durationMonths: 6, installmentsCount: 6, serviceChargeRate: 0.18, type: 'মেয়াদি', allowedTypes: ['সাপ্তাহিক', 'মাসিক', 'মেয়াদি'], allowedTerms: [3, 6, 12, 18, 24], collectServiceChargeMonthly: true }
      ];
      localStorage.setItem(key, JSON.stringify(configs));
    }

    return configs;
  });

  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [newProdName, setNewProdName] = useState('');
  const [newProdType, setNewProdType] = useState<'সাপ্তাহিক' | 'মাসিক' | 'মেয়াদি'>('সাপ্তাহিক');
  const [newProdDuration, setNewProdDuration] = useState('12');
  const [newProdInstallments, setNewProdInstallments] = useState('45');
  const [newProdRate, setNewProdRate] = useState('15');
  const [newProdCollectSCMonthly, setNewProdCollectSCMonthly] = useState(false);

  // Automatically update duration & installments based on product type change
  useEffect(() => {
    if (newProdType === 'মেয়াদি') {
      if (newProdDuration !== '3' && newProdDuration !== '6' && newProdDuration !== '9' && newProdDuration !== '12') {
        setNewProdDuration('6');
      }
      setNewProdInstallments(newProdCollectSCMonthly ? newProdDuration : '1');
    } else {
      if (newProdDuration !== '12' && newProdDuration !== '18' && newProdDuration !== '24') {
        setNewProdDuration('12');
      }
      const durationVal = Number(newProdDuration) || 12;
      if (newProdType === 'সাপ্তাহিক') {
        if (durationVal === 12) setNewProdInstallments('45');
        else if (durationVal === 18) setNewProdInstallments('68');
        else if (durationVal === 24) setNewProdInstallments('90');
      } else if (newProdType === 'মাসিক') {
        setNewProdInstallments(String(durationVal));
      }
    }
  }, [newProdType, newProdDuration, newProdCollectSCMonthly]);

  // --- Loan Disbursement Sandbox States ---
  const [dispMemberName, setDispMemberName] = useState('');
  const [dispMemberPhone, setDispMemberPhone] = useState('');
  const [dispMemberGender, setDispMemberGender] = useState<'female' | 'male'>('female');
  const [dispInsuranceType, setDispInsuranceType] = useState<'যৌথ বীমা' | 'একক বীমা'>(() => {
    const savedType = localStorage.getItem(`tanzil_loan_ins_type_${org.id}`);
    if (savedType === 'একক বীমা' || savedType === 'যৌথ বীমা') return savedType as 'একক বীমা' | 'যৌথ বীমা';
    return 'যৌথ বীমা';
  });
  const [dispBranchId, setDispBranchId] = useState('');
  const [dispAmount, setDispAmount] = useState('20000');
  const [dispInterestRate, setDispInterestRate] = useState(() => localStorage.getItem(`tanzil_loan_interest_${org.id}`) || '12');
  const [dispIntervalType, setDispIntervalType] = useState<'weekly' | 'monthly' | 'term'>('weekly');
  const [dispTenure, setDispTenure] = useState('1.0'); // 1.0, 1.5, 2.0 (years)
  const [dispTermTenure, setDispTermTenure] = useState('3_months'); // 3_months, 6_months
  const [dispInsPolicy, setDispInsPolicy] = useState('policy_a'); // policy_a, policy_b, etc
  const [isDisbursedSuccess, setIsDisbursedSuccess] = useState(false);
  const [lastDisbursedSummary, setLastDisbursedSummary] = useState<any>(null);

  const handleEditBranchClick = (branch: Branch) => {
    setEditingBranchId(branch.id);
    setBranchName(branch.name);
    setBranchCode(branch.code);
    setBranchPhone(branch.phone);
    setBranchAddress(branch.address);
    setBranchDate(branch.addDate);
    setIsBranchEditMode(true);
    setIsBranchModalOpen(true);
  };

  const handleToggleBranchStatus = (id: string) => {
    setBranchesList(prev => prev.map(b => {
      if (b.id === id) {
        const nextStatus = b.status === 'closed' ? 'active' : 'closed';
        logAuditEvent(org.id, org.adminId, "প্রধান এডমিন", "org_admin", "শাখার স্থিতি পরিবর্তন", `শাখা: ${b.name} (কোড: ${b.code}) এর স্ট্যাটাস '${nextStatus === 'active' ? 'সচল' : 'বন্ধ'}' করা হয়েছে।`, "branch", b.code);
        return { ...b, status: nextStatus };
      }
      return b;
    }));
  };

  // Handlers for Branch
  const handleAddBranch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!branchName || !branchCode || !branchPhone || !branchAddress) {
      alert('দয়া করে সর্ম্পূর্ণ তথ্য পূরণ করুন');
      return;
    }

    if (isBranchEditMode && editingBranchId) {
      setBranchesList(prev => prev.map(b => b.id === editingBranchId ? {
        ...b,
        name: branchName,
        code: branchCode,
        phone: branchPhone,
        address: branchAddress,
        addDate: branchDate
      } : b));
      logAuditEvent(org.id, org.adminId, "প্রধান এডমিন", "org_admin", "শাখার তথ্য সংশোধন", `শাখা: ${branchName} (কোড: ${branchCode}) এর তথ্য সংশোধন করা হয়েছে।`, "branch", branchCode);
    } else {
      const newBranch: Branch = {
        id: Date.now().toString(),
        orgId: org.id,
        name: branchName,
        code: branchCode,
        manager: '', // Will be automatically mapped dynamically
        phone: branchPhone,
        address: branchAddress,
        addDate: branchDate,
        status: 'active'
      };
      setBranchesList([...branchesList, newBranch]);
      logAuditEvent(org.id, org.adminId, "প্রধান এডমিন", "org_admin", "নতুন শাখা সংযোজন", `শাখা: ${branchName} (কোড: ${branchCode}) যুক্ত করা হয়েছে।`, "branch", branchCode);
    }
    
    // Reset Branch States
    setBranchName('');
    setBranchCode('');
    setBranchPhone('');
    setBranchAddress('');
    setIsBranchEditMode(false);
    setEditingBranchId(null);
    setIsBranchModalOpen(false);
  };

  const handleDeleteBranch = (id: string, name: string) => {
    if (confirm(`আপনি কি নিশ্চিত যে "${name}" শাখাটি ডিলিট করতে চান?`)) {
      const targetBranch = branchesList.find(b => b.id === id);
      setBranchesList(branchesList.filter(b => b.id !== id));
      registerDeletedId(org.id, id);
      // Also unassign staff assigned to this deleted branch
      setStaffList(prev => prev.map(s => s.branchId === id ? { ...s, branchId: undefined, branchJoiningDate: undefined } : s));
      logAuditEvent(org.id, org.adminId, "প্রধান এডমিন", "org_admin", "শাখা অপসারণ", `শাখা: ${name} (কোড: ${targetBranch?.code || 'N/A'}) মুছে ফেলা হয়েছে।`, "branch", targetBranch?.code);
    }
  };

  // Handlers for Staff
  const handleEditStaffClick = (staff: Staff) => {
    setEditingStaffId(staff.id);
    setStaffName(staff.name);
    setStaffPhone(staff.phone);
    setStaffDesignation(staff.designation);
    setStaffDate(staff.joiningDate);
    setStaffBranchId(staff.branchId || '');
    setStaffBranchJoiningDate(staff.branchJoiningDate || new Date().toISOString().split('T')[0]);
    setIsStaffEditMode(true);
    setIsStaffModalOpen(true);
  };

  const handleAddStaff = (e: React.FormEvent) => {
    e.preventDefault();
    if (!staffName || !staffPhone) {
      alert('দয়া করে সর্ম্পূর্ণ তথ্য পূরণ করুন');
      return;
    }

    if (isStaffEditMode && editingStaffId) {
      setStaffList(prev => prev.map(s => s.id === editingStaffId ? {
        ...s,
        name: staffName,
        phone: staffPhone,
        designation: staffDesignation,
        joiningDate: staffDate,
        branchId: staffBranchId || undefined,
        branchJoiningDate: staffBranchId ? staffBranchJoiningDate : undefined
      } : s));
      logAuditEvent(org.id, org.adminId, "প্রধান এডমিন", "org_admin", "কর্মকর্তার তথ্য সংশোধন", `কর্মকর্তা: ${staffName} (পদবী: ${staffDesignation}) এর তথ্য সংশোধন করা হয়েছে।`, "staff");
    } else {
      let autoStaffId = '';
      let currentNum = 9;
      do {
        autoStaffId = currentNum.toString().padStart(3, '0');
        currentNum++;
      } while (staffList.some(s => s.staffId === autoStaffId));
      const autoPassword = '1234';

      const newStaff: Staff = {
        id: Date.now().toString(),
        orgId: org.id,
        name: staffName,
        phone: staffPhone,
        designation: staffDesignation,
        joiningDate: staffDate,
        branchId: staffBranchId || undefined,
        branchJoiningDate: staffBranchId ? staffBranchJoiningDate : undefined,
        staffId: autoStaffId,
        password: autoPassword
      };
      setStaffList([...staffList, newStaff]);
      logAuditEvent(org.id, org.adminId, "প্রধান এডমিন", "org_admin", "নতুন কর্মকর্তা নিবন্ধন", `নতুন কর্মকর্তা: ${staffName} (পদবী: ${staffDesignation}, আইডি: ${autoStaffId}) নিবন্ধন করা হয়েছে।`, "staff");
    }
    
    // Reset Staff States
    setStaffName('');
    setStaffPhone('');
    setStaffDesignation('মাঠ কর্মী');
    setStaffBranchId('');
    setStaffBranchJoiningDate(new Date().toISOString().split('T')[0]);
    setIsStaffEditMode(false);
    setEditingStaffId(null);
    setIsStaffModalOpen(false);
  };

  const handleDeleteStaff = (id: string, name: string) => {
    const targetStaff = staffList.find(s => s.id === id);
    if (!targetStaff) return;
    if (targetStaff.staffId?.startsWith('ILO')) {
      alert('সিস্টেম ও ব্যাকআপ এও "ILO" অ্যাকাউন্ট কে ডিলিট করা যাবে না!');
      return;
    }

    // Load groupList to see if this staff is assigned to any groups
    const groupsSaved = localStorage.getItem(`tanzil_groups_${org.id}`);
    const groups: Group[] = groupsSaved ? JSON.parse(groupsSaved) : [];
    
    // Find groups assigned to this staff member (checking both ID and staffId/UID)
    const assignedGroups = groups.filter(g => g.assignedStaffId === targetStaff.id || g.assignedStaffId === targetStaff.staffId);
    
    let confirmMsg = `আপনি কি নিশ্চিত যে "${name}" কর্মকর্তাকে বাদ দিতে চান?`;
    if (assignedGroups.length > 0) {
      confirmMsg = `কর্মী "${name}" বর্তমানে ${assignedGroups.length} টি গ্রুপ/সমিতির দায়িত্বে আছেন (যেমন: ${assignedGroups.map(g => g.name).join(', ')})।\n\nডিলিট করার পর তার দায়ীত্বাধীন গ্রুপগুলো স্বয়ংক্রিয়ভাবে সংশ্লিষ্ট শাখার ডিফল্ট ব্যাকআপ কর্মকর্তা (ILO) অ্যাকাউন্টে স্থানান্তরিত হবে যাতে মাঠ কার্যক্রমে বিঘ্ন না ঘটে।\n\nআপনি কি নিশ্চিতভাবে তাকে ডিলিট করতে চান?`;
    }

    if (confirm(confirmMsg)) {
      if (assignedGroups.length > 0) {
        const updatedGroups = groups.map(g => {
          if (g.assignedStaffId === targetStaff.id || g.assignedStaffId === targetStaff.staffId) {
            const groupBranch = branchesList.find(b => b.id === g.branchId);
            const branchCode = groupBranch?.code || 'HO';
            return {
              ...g,
              assignedStaffId: `ILO-${branchCode}`
            };
          }
          return g;
        });
        localStorage.setItem(`tanzil_groups_${org.id}`, JSON.stringify(updatedGroups));
      }
      const newStaffList = staffList.filter(s => s.id !== id);
      setStaffList(newStaffList);
      registerDeletedId(org.id, id);
      if (targetStaff.staffId) {
        registerDeletedId(org.id, targetStaff.staffId);
      }
      localStorage.setItem(`tanzil_staff_${org.id}`, JSON.stringify(newStaffList));
      logAuditEvent(org.id, org.adminId, "প্রধান এডমিন", "org_admin", "কর্মকর্তা অপসারণ", `কর্মকর্তা: ${name} (পদবী: ${targetStaff.designation}, আইডি: ${targetStaff.staffId || 'N/A'}) কে সিস্টেম থেকে অপসারণ করা হয়েছে।`, "staff");
    }
  };

  const handleAddHoliday = (e: React.FormEvent) => {
    e.preventDefault();
    if (!holidayName.trim()) {
      alert('দয়া করে ছুটির কারণ বা বিবরণ লিখুন।');
      return;
    }

    if (editingHolidayId) {
      setHolidaysList(prev => prev.map(h => {
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
      }));
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
      setHolidaysList(prev => [newHoliday, ...prev]);
    }

    setHolidayName('');
    setIsHolidayModalOpen(false);
  };

  const handleEditHoliday = (holiday: Holiday) => {
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
    showConfirm(`আপনি কি নিশ্চিতভাবে "${name}" ছুটিটি তালিকা থেকে ডিলিট করতে চান?`, () => {
      setHolidaysList(prev => prev.filter(h => h.id !== id));
      registerDeletedId(org.id, id);
    });
  };


  // Search filter implementation (Dynamic manager retrieval and filter)
  const filteredBranches = branchesList.filter(b => {
    const autoManager = staffList.find(s => s.branchId === b.id && s.designation === 'শাখা ব্যবস্থাপক')?.name || '(ব্যবস্থাপক অনির্ধারিত)';
    return (
      b.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      b.code.toLowerCase().includes(searchTerm.toLowerCase()) || 
      autoManager.toLowerCase().includes(searchTerm.toLowerCase()) || 
      b.phone.includes(searchTerm) ||
      b.address.toLowerCase().includes(searchTerm.toLowerCase())
    );
  });

  const filteredStaff = staffList.filter(s => {
    const assignedBranchName = branchesList.find(b => b.id === s.branchId)?.name || 'প্রধান কার্যালয় / অনিযুক্ত';
    return (
      s.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      s.phone.includes(searchTerm) || 
      s.designation.toLowerCase().includes(searchTerm.toLowerCase()) ||
      assignedBranchName.toLowerCase().includes(searchTerm.toLowerCase())
    );
  });

  const handleSaveConfig = (e: React.FormEvent) => {
    e.preventDefault();
    if (!orgName || !orgAddress || !orgPassword) {
      alert('দয়া করে সর্ম্পূর্ণ তথ্য পূরণ করুন');
      return;
    }
    if (onUpdateOrg) {
      onUpdateOrg({
        ...org,
        name: orgName,
        address: orgAddress,
        adminPassword: orgPassword
      });
    }
    
    // Legacy settings sync
    localStorage.setItem(`tanzil_min_savings_${org.id}`, savingsMinDeposit);
    localStorage.setItem(`tanzil_savings_interest_${org.id}`, savProfitGS); // using GS interest rate as legacy backfill
    localStorage.setItem(`tanzil_max_loan_${org.id}`, loanMaxAmount);
    localStorage.setItem(`tanzil_withdrawal_fee_${org.id}`, withdrawalFee);

    // General settings
    localStorage.setItem(`tanzil_phone_${org.id}`, orgPhone);
    localStorage.setItem(`tanzil_email_${org.id}`, orgEmail);
    localStorage.setItem(`tanzil_website_${org.id}`, orgWebsite);
    localStorage.setItem(`tanzil_trade_license_${org.id}`, orgTradeLicense);
    localStorage.setItem(`tanzil_logo_style_${org.id}`, orgLogoStyle);
    localStorage.setItem(`tanzil_logo_url_${org.id}`, orgLogoUrl);

    // Loan settings
    localStorage.setItem(`tanzil_loan_interest_${org.id}`, loanDefaultInterest);
    localStorage.setItem(`tanzil_loan_interest_type_${org.id}`, loanInterestType);
    localStorage.setItem(`tanzil_loan_min_${org.id}`, loanMinAmount);
    localStorage.setItem(`tanzil_loan_max_${org.id}`, loanMaxAmount);
    localStorage.setItem(`tanzil_loan_duration_${org.id}`, loanDuration);
    localStorage.setItem(`tanzil_loan_grace_${org.id}`, loanGracePeriod);
    localStorage.setItem(`tanzil_loan_late_fee_${org.id}`, loanLateFee);
    localStorage.setItem(`tanzil_loan_processing_fee_${org.id}`, loanProcessingFee);

    // Installment settings
    localStorage.setItem(`tanzil_inst_weekly_${org.id}`, String(instWeeklyActive));
    localStorage.setItem(`tanzil_inst_monthly_${org.id}`, String(instMonthlyActive));
    localStorage.setItem(`tanzil_inst_term_active_${org.id}`, String(instTermActive));
    localStorage.setItem(`tanzil_inst_biweekly_${org.id}`, String(instTermActive));
    localStorage.setItem(`tanzil_inst_day_${org.id}`, instCollectionDay);
    localStorage.setItem(`tanzil_inst_auto_${org.id}`, String(instAutoGeneration));
    localStorage.setItem(`tanzil_inst_rounding_${org.id}`, instRoundingRule);

    // Savings settings
    localStorage.setItem(`tanzil_sav_type_${org.id}`, savingsType);
    localStorage.setItem(`tanzil_sav_min_dep_${org.id}`, savingsMinDeposit);
    localStorage.setItem(`tanzil_sav_min_bal_${org.id}`, savingsMinBalance);
    localStorage.setItem(`tanzil_sav_profit_gs_${org.id}`, savProfitGS);
    localStorage.setItem(`tanzil_sav_profit_cbs_${org.id}`, savProfitCBS);
    localStorage.setItem(`tanzil_sav_profit_lts_${org.id}`, savProfitLTS);
    localStorage.setItem(`tanzil_sav_profit_fdr_${org.id}`, savProfitFDR);
    localStorage.setItem(`tanzil_sav_fdr_payout_${org.id}`, savFdrPayoutType);
    localStorage.setItem(`tanzil_sav_admission_fee_${org.id}`, savingsAdmissionFee);
    localStorage.setItem(`tanzil_sav_passbook_fee_${org.id}`, savingsPassbookFee);
    localStorage.setItem(`tanzil_sav_welfare_fee_${org.id}`, savingsWelfareFee);
    localStorage.setItem(`tanzil_share_price_${org.id}`, sharePriceConfig);
    localStorage.setItem(`tanzil_min_shares_${org.id}`, minShareCountConfig);
    localStorage.setItem(`tanzil_max_shares_${org.id}`, maxShareCountConfig);
    localStorage.setItem(`tanzil_dividend_rate_${org.id}`, dividendRateConfig);
    localStorage.setItem(`tanzil_dividend_payout_${org.id}`, dividendPayoutMethodConfig);
    localStorage.setItem(`tanzil_share_refund_${org.id}`, shareRefundPolicyConfig);

    // Loan Insurance settings
    localStorage.setItem(`tanzil_loan_ins_percent_${org.id}`, loanInsurancePercent);
    localStorage.setItem(`tanzil_loan_ins_type_${org.id}`, loanInsuranceType);

    // Mandatory Savings settings
    localStorage.setItem(`tanzil_mandatory_sav_percent_${org.id}`, mandatorySavingsPercent);

    // LLP (Loan Loss Provision) settings
    localStorage.setItem(`tanzil_llp_standard_${org.id}`, llpStandard);
    localStorage.setItem(`tanzil_llp_substandard_${org.id}`, llpSubStandard);
    localStorage.setItem(`tanzil_llp_doubtful_${org.id}`, llpDoubtful);
    localStorage.setItem(`tanzil_llp_bad_${org.id}`, llpBad);

    // Policy Effective Date settings
    localStorage.setItem(`tanzil_policy_effective_date_${org.id}`, policyEffectiveDate);

    alert('কনফিগারেশন সফলভাবে সংরক্ষণ করা হয়েছে!');
    setConfigSuccessMsg('কনফিগারেশন সফলভাবে সংরক্ষণ করা হয়েছে!');
    setTimeout(() => {
      setConfigSuccessMsg('');
    }, 4000);
  };

  // Dedicated Save Handler for Cooperative Share Capital & Dividend Policy
  const handleSaveShareConfig = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem(`tanzil_share_price_${org.id}`, sharePriceConfig);
    localStorage.setItem(`tanzil_min_shares_${org.id}`, minShareCountConfig);
    localStorage.setItem(`tanzil_max_shares_${org.id}`, maxShareCountConfig);
    localStorage.setItem(`tanzil_dividend_rate_${org.id}`, dividendRateConfig);
    localStorage.setItem(`tanzil_dividend_payout_${org.id}`, dividendPayoutMethodConfig);
    localStorage.setItem(`tanzil_share_refund_${org.id}`, shareRefundPolicyConfig);

    alert('সমবায় শেয়ার মূলধন ও লভ্যাংশ পলিসি কনফিগারেশন সফলভাবে সংরক্ষণ করা হয়েছে!');
    setConfigSuccessMsg('সমবায় শেয়ার মূলধন ও লভ্যাংশ পলিসি কনফিগারেশন সফলভাবে সংরক্ষণ করা হয়েছে!');
    setTimeout(() => {
      setConfigSuccessMsg('');
    }, 4000);
  };

  // --- Loan Category & product configuration handlers ---
  const handleSaveProductConfig = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProdName.trim()) {
      alert('দয়া করে প্রোডাক্ট ক্যাটাগরির নাম দিন!');
      return;
    }

    const ratePct = Number(newProdRate) || 0;
    let updated: LoanProductConfig[] = [];

    if (editingProductId) {
      updated = productConfigs.map((p) => {
        if (p.id === editingProductId) {
          return {
            ...p,
            name: newProdName.trim(),
            durationMonths: Number(newProdDuration) || 12,
            installmentsCount: Number(newProdInstallments) || 45,
            serviceChargeRate: ratePct / 100,
            type: newProdType,
            collectServiceChargeMonthly: newProdType === 'মেয়াদি' ? newProdCollectSCMonthly : false
          };
        }
        return p;
      });
      setEditingProductId(null);
    } else {
      const newProduct: LoanProductConfig = {
        id: `lp-custom-${Date.now()}`,
        name: newProdName.trim(),
        durationMonths: Number(newProdDuration) || 12,
        installmentsCount: Number(newProdInstallments) || 45,
        serviceChargeRate: ratePct / 100,
        type: newProdType,
        collectServiceChargeMonthly: newProdType === 'মেয়াদি' ? newProdCollectSCMonthly : false
      };
      updated = [...productConfigs, newProduct];
    }

    setProductConfigs(updated);
    localStorage.setItem(`tanzil_loan_product_configs_${org.id}`, JSON.stringify(updated));

    // Reset fields
    setNewProdName('');
    setNewProdType('সাপ্তাহিক');
    setNewProdDuration('12');
    setNewProdRate('15');
    setNewProdCollectSCMonthly(false);
    
    alert('লোন প্রোডাক্ট কনফিগারেশন সফলভাবে সংরক্ষণ করা হয়েছে!');
    setConfigSuccessMsg('লোন প্রোডাক্ট কনফিগারেশন সফলভাবে সংরক্ষণ করা হয়েছে!');
    setTimeout(() => {
      setConfigSuccessMsg('');
    }, 3000);
  };

  const handleEditProductConfig = (cfg: LoanProductConfig) => {
    setEditingProductId(cfg.id);
    setNewProdName(cfg.name);
    setNewProdType(cfg.type);
    setNewProdDuration(String(cfg.durationMonths));
    setNewProdInstallments(String(cfg.installmentsCount));
    setNewProdRate(String(Math.round(cfg.serviceChargeRate * 100)));
    setNewProdCollectSCMonthly(cfg.collectServiceChargeMonthly || false);
  };

  const handleDeleteProductConfig = (idToDelete: string) => {
    if (productConfigs.length <= 1) {
      alert('সিস্টেমে নূন্যতম একটি লোন প্রোডাক্ট অবশ্যই থাকতে হবে!');
      return;
    }
    if (window.confirm('নিশ্চিত আপনি কি এই লোন প্রোডাক্টটি মুছে ফেলতে চান?')) {
      const filtered = productConfigs.filter((p) => p.id !== idToDelete);
      setProductConfigs(filtered);
      localStorage.setItem(`tanzil_loan_product_configs_${org.id}`, JSON.stringify(filtered));
      
      setConfigSuccessMsg('লোন প্রোডাক্টটি সফলভাবে মুছে ফেলা হয়েছে!');
      setTimeout(() => setConfigSuccessMsg(''), 3000);
    }
  };

  const handleResetProductConfigsToDefault = () => {
    if (window.confirm('নিশ্চিত আপনি কি সকল লোন প্রোডাক্ট কনফিগারেশন ডিফল্ট অবস্থায় ফিরিয়ে নিতে চান?')) {
      const defaults: LoanProductConfig[] = [
        { id: 'lp-jagoron-weekly', name: 'জাগরণ (সাপ্তাহিক)', durationMonths: 12, installmentsCount: 45, serviceChargeRate: 0.15, type: 'সাপ্তাহিক' },
        { id: 'lp-jagoron-monthly', name: 'জাগরণ (মাসিক)', durationMonths: 12, installmentsCount: 12, serviceChargeRate: 0.15, type: 'মাসিক' },
        { id: 'lp-buniad-weekly', name: 'বুনিয়াদ (সাপ্তাহিক)', durationMonths: 12, installmentsCount: 45, serviceChargeRate: 0.15, type: 'সাপ্তাহিক' },
        { id: 'lp-sufolon-term-3m', name: 'সুফলা (৩ মাস মেয়াদি)', durationMonths: 3, installmentsCount: 3, serviceChargeRate: 0.08, type: 'মেয়াদি', collectServiceChargeMonthly: true },
        { id: 'lp-sufolon-term-6m', name: 'সুফলা (৬ মাস মেয়াদি)', durationMonths: 6, installmentsCount: 6, serviceChargeRate: 0.12, type: 'মেয়াদি', collectServiceChargeMonthly: true }
      ];
      setProductConfigs(defaults);
      localStorage.setItem(`tanzil_loan_product_configs_${org.id}`, JSON.stringify(defaults));
      
      setConfigSuccessMsg('লোন প্রোডাক্ট স্কিম ডিফল্ট অবস্থায় ফিরিয়ে নেওয়া হয়েছে!');
      setTimeout(() => setConfigSuccessMsg(''), 3000);
    }
  };

  const handleSaveLoanSettings = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Loan settings
    localStorage.setItem(`tanzil_loan_interest_${org.id}`, loanDefaultInterest);
    localStorage.setItem(`tanzil_loan_interest_type_${org.id}`, loanInterestType);
    localStorage.setItem(`tanzil_loan_min_${org.id}`, loanMinAmount);
    localStorage.setItem(`tanzil_loan_max_${org.id}`, loanMaxAmount);
    localStorage.setItem(`tanzil_loan_duration_${org.id}`, loanDuration);
    localStorage.setItem(`tanzil_loan_grace_${org.id}`, loanGracePeriod);
    localStorage.setItem(`tanzil_loan_late_fee_${org.id}`, loanLateFee);
    localStorage.setItem(`tanzil_loan_processing_fee_${org.id}`, loanProcessingFee);

    // Installment settings
    localStorage.setItem(`tanzil_inst_weekly_${org.id}`, String(instWeeklyActive));
    localStorage.setItem(`tanzil_inst_monthly_${org.id}`, String(instMonthlyActive));
    localStorage.setItem(`tanzil_inst_term_active_${org.id}`, String(instTermActive));
    localStorage.setItem(`tanzil_inst_biweekly_${org.id}`, String(instTermActive));
    localStorage.setItem(`tanzil_inst_day_${org.id}`, instCollectionDay);
    localStorage.setItem(`tanzil_inst_auto_${org.id}`, String(instAutoGeneration));
    localStorage.setItem(`tanzil_inst_rounding_${org.id}`, instRoundingRule);

    // Loan Insurance settings
    localStorage.setItem(`tanzil_loan_ins_percent_${org.id}`, loanInsurancePercent);
    localStorage.setItem(`tanzil_loan_ins_type_${org.id}`, loanInsuranceType);

    // Mandatory Savings settings
    localStorage.setItem(`tanzil_mandatory_sav_percent_${org.id}`, mandatorySavingsPercent);

    // Policy Effective Date settings
    localStorage.setItem(`tanzil_policy_effective_date_${org.id}`, policyEffectiveDate);

    alert('লোন পলিসি ও স্কিম কনফিগারেশন সফলভাবে সংরক্ষণ করা হয়েছে!');
    setConfigSuccessMsg('লোন পলিসি ও স্কিম কনফিগারেশন সফলভাবে সংরক্ষণ করা হয়েছে!');
    setTimeout(() => {
      setConfigSuccessMsg('');
    }, 4000);
  };

  if (selectedSimulationStaff) {
    return (
      <BranchManagerDashboard
        org={org}
        staff={selectedSimulationStaff}
        onLogout={() => setSelectedSimulationStaff(null)}
        isSimulated={true}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      
      {/* Redesigned Large Responsive Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-slate-900 border-b border-slate-800 text-slate-100 shadow-xl">
        <div className="max-w-7xl mx-auto px-4 py-2 sm:py-2.5 flex flex-col gap-2">
          
          {/* Row 1: Brand & Organization Info */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
            <div className="flex items-center gap-3">
              <TanzilLogo size={36} className="bg-slate-900 rounded-full border border-slate-700/50 p-0.5 hover:scale-105 transition-transform" />
              <span className="text-base sm:text-lg font-black tracking-wide bg-gradient-to-r from-blue-400 via-indigo-200 to-white bg-clip-text text-transparent">
                তানজিল মাইক্রোক্রেডিট সফটওয়্যার (এডমিন)
              </span>
              <span className="hidden sm:inline-block px-2 py-0.5 bg-indigo-500/10 border border-indigo-500/20 text-[10px] text-indigo-300 font-bold rounded-md">
                প্রধান কার্যালয়
              </span>
            </div>
            
            <div className="flex items-center gap-3 self-stretch sm:self-auto justify-between sm:justify-end">
              <div className="flex items-center gap-1.5 bg-slate-800 border border-slate-700/80 px-2.5 py-1 rounded-lg text-xs">
                <OrgLogo orgId={org.id} size={16} logoStyle={orgLogoStyle} logoUrl={orgLogoUrl} className="rounded-sm" />
                <span className="font-bold text-slate-200">প্রতিষ্ঠান: {org.name}</span>
              </div>
              <SyncStatusHub org={org} userId={org.adminId} userName="প্রধান এডমিন" role="org_admin" />
            </div>
          </div>

          {/* Row 2: Branch Name, Code, Working Date, User Credentials & Action Buttons */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 border-t border-slate-800/80 pt-2 text-xs text-slate-300">
            {/* Left side: Branch, Code & Working Date */}
            <div className="flex flex-wrap items-center gap-2 sm:gap-4">
              <div className="flex items-center gap-1.5 bg-slate-800/60 border border-slate-700/50 px-2.5 py-1 rounded-lg">
                <span className="font-medium text-slate-400">শাখা:</span>
                <span className="font-bold text-slate-200">প্রধান কার্যালয়</span>
                <span className="text-slate-600">|</span>
                <span className="font-medium text-slate-400">কোড:</span>
                <span className="font-mono font-bold text-blue-400">HQ</span>
              </div>

              {/* Working Date Button */}
              <button 
                type="button"
                onClick={() => {
                  setWorkingDayInput(workingDay);
                  setIsWorkingDayModalOpen(true);
                }}
                className="flex items-center gap-1.5 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 font-bold px-2.5 py-1 rounded-lg transition-all cursor-pointer"
                title="কর্মদিবস পরিবর্তন করতে এখানে ক্লিক করুন"
              >
                <Clock size={12} className="text-amber-400" />
                <span>তারিখ:</span>
                <span className="font-mono font-black">{workingDay}</span>
              </button>
            </div>

            {/* Right side: User, ID, Password Change & Logout Buttons */}
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              <div className="flex items-center gap-2 bg-slate-800/60 border border-slate-700/50 px-2.5 py-1 rounded-lg">
                <span className="text-slate-400">ব্যবহারকারী:</span>
                <span className="font-bold text-slate-100">প্রধান এডমিন</span>
                <span className="text-slate-600">|</span>
                <span className="text-slate-400 font-mono">আইডি: {org.adminId}</span>
              </div>

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
                title="পাসওয়ার্ড পরিবর্তন করুন"
              >
                <Key size={11} />
                <span>পাসওয়ার্ড পরিবর্তন</span>
              </button>

              {/* Logout Button */}
              <button 
                type="button"
                onClick={onLogout}
                className="flex items-center gap-1 px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold transition-all cursor-pointer"
                title="লগআউট"
              >
                <LogOut size={11} />
                <span>লগআউট</span>
              </button>
            </div>
          </div>

        </div>
      </header>

      {/* Main Body Grid Container with content area only */}
      <div className="flex-1 max-w-7xl w-full mx-auto flex flex-col pt-[155px] md:pt-[105px] min-h-0 bg-white shadow-md border-x border-slate-200">

        {/* Content Container */}
        <main className="flex-1 p-4 sm:p-6 overflow-y-auto">
          
          {/* CENTRAL HOME LAUNCHER MENU */}
          {activeTab === 'home' && (
            <div className="space-y-6 animate-in fade-in duration-205">
              {/* ACTION GRID MODULES */}
              <div>
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-wider mb-3.5">সেন্ট্রাল মডিউল ও অপশনসমূহ</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  
                  {/* CARD 1: BRANCH LIST */}
                  <button
                    onClick={() => setActiveTab('branches')}
                    className="p-5 bg-white hover:bg-slate-50 border border-slate-200 hover:border-blue-500 rounded-2xl shadow-3xs text-left transition duration-200 cursor-pointer group flex flex-col justify-between min-h-[160px]"
                  >
                    <div>
                      <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
                        <Building size={20} />
                      </div>
                      <h4 className="font-extrabold text-slate-800 text-sm font-sans">শাখা তালিকা ও ব্যবস্থাপন</h4>
                      <p className="text-[11px] text-slate-450 mt-1 font-medium leading-relaxed font-sans">নতুন শাখা নিবন্ধন, শাখা কোড এডিট এবং সকল শাখার অবস্থান ট্র্যাকিং।</p>
                    </div>
                    <span className="text-[10px] text-[#2f6ce5] font-black block mt-3 underline group-hover:text-blue-705">শাখা পরিচালনা করুন →</span>
                  </button>

                  {/* CARD 2: STAFF LIST */}
                  <button
                    onClick={() => setActiveTab('staff')}
                    className="p-5 bg-white hover:bg-slate-50 border border-slate-200 hover:border-emerald-500 rounded-2xl shadow-3xs text-left transition duration-200 cursor-pointer group flex flex-col justify-between min-h-[160px]"
                  >
                    <div>
                      <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
                        <UserCheck size={20} />
                      </div>
                      <h4 className="font-extrabold text-slate-800 text-sm font-sans">এইচআরএম ও কেন্দ্রীয় কর্মকর্তা</h4>
                      <p className="text-[11px] text-slate-450 mt-1 font-medium leading-relaxed font-sans">প্রতিষ্ঠানের সকল কর্মকর্তা নিবন্ধন, রোল নির্ধারণ এবং ইউজার ক্রেডেনশিয়াল ব্যবস্থাপনা।</p>
                    </div>
                    <span className="text-[10px] text-emerald-600 font-extrabold block mt-3 underline group-hover:text-emerald-705">এইচআরএম প্রবেশ →</span>
                  </button>

                  {/* CARD 3: CONFIGURATION */}
                  <button
                    onClick={() => setActiveTab('config')}
                    className="p-5 bg-white hover:bg-slate-50 border border-slate-200 hover:border-indigo-500 rounded-2xl shadow-3xs text-left transition duration-200 cursor-pointer group flex flex-col justify-between min-h-[160px]"
                  >
                    <div>
                      <div className="w-10 h-10 bg-indigo-50 text-indigo-700 rounded-xl flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
                        <Settings size={20} />
                      </div>
                      <h4 className="font-extrabold text-slate-800 text-sm font-sans">গ্লোবাল ঋণ ও স্কিম কনফিগার</h4>
                      <p className="text-[11px] text-slate-450 mt-1 font-medium leading-relaxed font-sans">ইনস্টলমেন্ট টাইপ, সুদের হার নির্ধারণ, চার্জ এবং ঋণ স্কিম সংজ্ঞায়িতকরণ।</p>
                    </div>
                    <span className="text-[10px] text-indigo-600 font-extrabold block mt-3 underline group-hover:text-indigo-705 font-sans">সেটিংস কনফিগার →</span>
                  </button>

                  {/* CARD 4: REPORTS */}
                  <button
                    onClick={() => setActiveTab('reports')}
                    className="p-5 bg-white hover:bg-slate-50 border border-slate-200 hover:border-amber-500 rounded-2xl shadow-3xs text-left transition duration-200 cursor-pointer group flex flex-col justify-between min-h-[160px]"
                  >
                    <div>
                      <div className="w-10 h-10 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
                        <FileText size={20} />
                      </div>
                      <h4 className="font-extrabold text-slate-800 text-sm font-sans">পোর্টফোলিও ও সংগ্রহ রিপোর্টস</h4>
                      <p className="text-[11px] text-slate-450 mt-1 font-medium leading-relaxed font-sans">আদায় খতিয়ান, খেলাপি ঋণের চার্ট এবং কেন্দ্রীয় কালেকশন পরিসংখ্যান রিপোর্ট।</p>
                    </div>
                    <span className="text-[10px] text-amber-600 font-extrabold block mt-3 underline group-hover:text-amber-705 font-sans">রিপোর্টস ভিউয়ার →</span>
                  </button>

                  {/* CARD 5: HOLIDAYS */}
                  <button
                    onClick={() => setActiveTab('holidays')}
                    className="p-5 bg-white hover:bg-slate-50 border border-slate-200 hover:border-rose-500 rounded-2xl shadow-3xs text-left transition duration-200 cursor-pointer group flex flex-col justify-between min-h-[160px]"
                  >
                    <div>
                      <div className="w-10 h-10 bg-rose-50 text-rose-600 rounded-xl flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
                        <Calendar size={20} />
                      </div>
                      <h4 className="font-extrabold text-slate-800 text-sm font-sans">ছুটি তালিকা ও কাজের ক্যালেন্ডার</h4>
                      <p className="text-[11px] text-slate-450 mt-1 font-medium leading-relaxed font-sans">সকল শাখার উপর প্রযোজ্য সাপ্তাহিক ও অন্যান্য সাধারণ ছুটির দিন সংযোজন।</p>
                    </div>
                    <span className="text-[10px] text-rose-600 font-extrabold block mt-3 underline group-hover:text-rose-705 font-sans">ছুটি ড্যাশবোর্ড →</span>
                  </button>

                  {/* CARD 6: OPERATIONS */}
                  <button
                    onClick={() => setActiveTab('operations')}
                    className="p-5 bg-gradient-to-br from-[#1e3a8a]/5 to-indigo-500/5 hover:from-[#1e3a8a]/10 hover:to-indigo-500/10 border border-indigo-200 hover:border-indigo-500 rounded-2xl shadow-3xs text-left transition duration-200 cursor-pointer group flex flex-col justify-between min-h-[160px]"
                  >
                    <div>
                      <div className="w-10 h-10 bg-[#e0f2fe] text-blue-800 rounded-xl flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
                        <Layers size={20} />
                      </div>
                      <h4 className="font-extrabold text-slate-800 text-sm font-sans">সুপার রিয়েলটাইম ওভাররাইড</h4>
                      <p className="text-[11px] text-indigo-900/80 mt-1 font-medium leading-relaxed font-sans">সিস্টেম তারিখ পরিবর্তন, সপ ডিলিট অ্যাকশন এবং রিয়েল-টাইম ডাটা অভাররাইট।</p>
                    </div>
                    <span className="text-[10px] text-indigo-700 font-extrabold block mt-3 underline group-hover:text-indigo-805 font-sans">ওভাররাইড অ্যাকশনে যান →</span>
                  </button>

                  {/* CARD 7: MASTER ROLL */}
                  <button
                    onClick={() => setActiveTab('master-roll')}
                    className="p-5 bg-white hover:bg-slate-50 border border-slate-200 hover:border-teal-500 rounded-2xl shadow-3xs text-left transition duration-200 cursor-pointer group flex flex-col justify-between min-h-[160px]"
                  >
                    <div>
                      <div className="w-10 h-10 bg-teal-50 text-teal-700 rounded-xl flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
                        <FileText size={20} />
                      </div>
                      <h4 className="font-extrabold text-slate-800 text-sm font-sans">সেন্ট্রাল মাস্টার রোল</h4>
                      <p className="text-[11px] text-slate-450 mt-1 font-medium leading-relaxed font-sans">শাখাভিত্তিক সম্মিলিত মাস্টার রোল লেজার সীট এবং কালেকশন সিগনেচার শিট।</p>
                    </div>
                    <span className="text-[10px] text-teal-600 font-extrabold block mt-3 underline group-hover:text-teal-750 font-sans">মাস্টার রোল শিট →</span>
                  </button>

                  {/* CARD 8: AUDIT LOGS */}
                  <button
                    onClick={() => setActiveTab('audit-logs')}
                    className="p-5 bg-white hover:bg-slate-50 border border-slate-200 hover:border-amber-500 rounded-2xl shadow-3xs text-left transition duration-200 cursor-pointer group flex flex-col justify-between min-h-[160px]"
                  >
                    <div>
                      <div className="w-10 h-10 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
                        <Shield size={20} />
                      </div>
                      <h4 className="font-extrabold text-slate-800 text-sm font-sans">সিস্টেম অডিট ও কার্যকলাপ ট্র্যাকিং</h4>
                      <p className="text-[11px] text-slate-450 mt-1 font-medium leading-relaxed font-sans">শাখা এবং কর্মকর্তাদের সকল কার্যক্রমের লাইভ ট্র্যাকিং এবং নোটিফিকেশন অডিট হিস্ট্রি।</p>
                    </div>
                    <span className="text-[10px] text-amber-600 font-extrabold block mt-3 underline group-hover:text-amber-705 font-sans">অ্যাক্টিভিটি ট্র্যাকার দেখুন →</span>
                  </button>

                </div>
              </div>

            </div>
          )}

          {/* VIEW 1: Branch Management / শাখা তালিকা */}
          {activeTab === 'branches' && (
            <div className="space-y-5">
              
              {/* Back button */}
              <div className="pb-1.5">
                <button
                  onClick={() => setActiveTab('home')}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold hover:text-slate-900 rounded-lg text-[10.5px] border border-slate-200 cursor-pointer transition shadow-3xs"
                >
                  <ChevronLeft size={13} />
                  <span>← প্রধান এডমিন কন্ট্রোলে ফিরুন</span>
                </button>
              </div>
              
              <div className="flex justify-between items-center flex-wrap gap-3 border-b border-slate-100 pb-4">
                <div>
                  <h3 className="text-lg font-bold text-slate-800 font-sans tracking-tight">নিবন্ধিত শাখা অফিসসমূহ (Branch List)</h3>
                  <p className="text-xs text-slate-400">এই লিমিটেডের আওতাধীন সকল সচল ও বন্ধ শাখা অফিসের বিবরণী।</p>
                </div>

                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2 text-slate-400" size={14} />
                    <input 
                      type="text" 
                      placeholder="শাখা খুঁজুন..."
                      className="pl-8 pr-3 py-1.5 border border-slate-200 rounded-lg text-xs w-44 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>
                  
                  <button 
                    onClick={() => {
                      setIsBranchEditMode(false);
                      setEditingBranchId(null);
                      setBranchName('');
                      setBranchCode('');
                      setBranchPhone('');
                      setBranchAddress('');
                      setBranchDate(new Date().toISOString().split('T')[0]);
                      setIsBranchModalOpen(true);
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg transition-colors shadow-xs cursor-pointer"
                  >
                    <Plus size={14} />
                    <span>নতুন শাখা যুক্ত করুন</span>
                  </button>
                </div>
              </div>

              {/* Branch list in a table layout (লিস্ট আকারে) */}
              {filteredBranches.length === 0 ? (
                <div className="bg-slate-50 rounded-2xl border border-dashed border-slate-200 p-12 text-center">
                  <Building className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                  <p className="text-slate-500 text-sm font-medium">কোনো শাখা অফিস ডাটাবেসে পাওয়া যায় নি।</p>
                  <p className="text-slate-400 text-xs mt-1 font-semibold">নতুন শাখা অফিস যুক্ত করতে "নতুন শাখা যুক্ত করুন" বাটনে ক্লিক করুন।</p>
                </div>
              ) : (
                <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                          <th className="px-4 py-3 text-center w-36">ইডিট/ডিলিট/বন্ধ (বামপাশে)</th>
                          <th className="px-4 py-3">শাখার নাম ও কোড</th>
                          <th className="px-4 py-3">শাখা ব্যবস্থাপক</th>
                          <th className="px-4 py-3">ঠিকানা</th>
                          <th className="px-4 py-3">মোবাইল নম্বর</th>
                          <th className="px-4 py-3">প্রতিষ্ঠার তারিখ</th>
                          <th className="px-4 py-3 text-right">অবস্থা (Status)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                        {filteredBranches.map((branch) => {
                          const currentManager = staffList.find(s => s.branchId === branch.id && s.designation === 'শাখা ব্যবস্থাপক');
                          const isClosed = branch.status === 'closed';
                          return (
                            <tr key={branch.id} className={`hover:bg-slate-50/75 transition-colors ${isClosed ? 'opacity-70 bg-slate-50/40 text-slate-500' : ''}`}>
                              {/* actions column - placement left (বামপাশে) as requested */}
                              <td className="px-4 py-3 whitespace-nowrap text-center">
                                <div className="flex items-center justify-center gap-1">
                                  {/* User Portal Entrance */}
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const manager = staffList.find(s => s.branchId === branch.id && s.designation === 'শাখা ব্যবস্থাপক');
                                      const simulatedStaff = manager || staffList.find(s => s.branchId === branch.id) || {
                                        id: `sim-staff-${branch.id}`,
                                        orgId: org.id,
                                        name: `অস্থায়ী শাখা ব্যবস্থাপক (${branch.name})`,
                                        phone: branch.phone || '01712345678',
                                        designation: 'শাখা ব্যবস্থাপক',
                                        joiningDate: branch.addDate || new Date().toISOString().split('T')[0],
                                        branchId: branch.id,
                                        branchJoiningDate: branch.addDate || new Date().toISOString().split('T')[0],
                                        staffId: `ILO-${branch.code}`,
                                        password: '1234'
                                      };
                                      setSelectedSimulationStaff(simulatedStaff);
                                    }}
                                    className="p-1 px-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-750 border border-indigo-100 rounded-lg transition-all font-bold text-[10px] flex items-center gap-0.5 cursor-pointer"
                                    title="শাখাটির ইউজার প্যানেল প্রবেশ করুন"
                                  >
                                    <Layers size={11} />
                                    <span>ইউজার পোর্টাল</span>
                                  </button>
                                  {/* Edit button */}
                                  <button
                                    onClick={() => handleEditBranchClick(branch)}
                                    className="p-1 px-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg transition-all font-bold text-[10px] flex items-center gap-0.5 cursor-pointer border border-blue-100"
                                    title="শাখা সংশোধন করুন"
                                  >
                                    <Pencil size={11} />
                                    <span>ইডিট</span>
                                  </button>

                                  {/* Close/Deactivate toggler */}
                                  <button
                                    onClick={() => handleToggleBranchStatus(branch.id)}
                                    className={`p-1 px-1.5 rounded-lg transition-all font-bold text-[10px] flex items-center gap-0.5 cursor-pointer border ${
                                      isClosed 
                                        ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border-emerald-100' 
                                        : 'bg-amber-50 text-amber-700 hover:bg-amber-100 border-amber-100'
                                    }`}
                                    title={isClosed ? "শাখা সচল করুন" : "শাখা বন্ধ করুন"}
                                  >
                                    {isClosed ? <Check size={11} /> : <X size={11} />}
                                    <span>{isClosed ? 'সচল' : 'বন্ধ'}</span>
                                  </button>

                                  {/* Delete button */}
                                  <button
                                    onClick={() => handleDeleteBranch(branch.id, branch.name)}
                                    className="p-1 px-1.5 bg-rose-50 text-rose-600 hover:bg-rose-100 rounded-lg transition-all font-bold text-[10px] flex items-center gap-0.5 cursor-pointer border border-rose-100"
                                    title="শাখা ডিলিট করুন"
                                  >
                                    <Trash2 size={11} />
                                    <span>ডিলিট</span>
                                  </button>
                                </div>
                              </td>

                              {/* Branch details right next to actions */}
                              <td className="px-4 py-3 whitespace-nowrap">
                                <div className="flex items-center gap-2">
                                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${isClosed ? 'bg-slate-100 text-slate-400' : 'bg-blue-50 text-blue-600'}`}>
                                    <Building size={14} />
                                  </div>
                                  <div>
                                    <h4 className={`font-bold text-slate-800 text-sm ${isClosed ? 'line-through text-slate-400' : ''}`}>
                                      {branch.name}
                                    </h4>
                                    <span className="bg-slate-105 text-slate-600 text-[9px] px-1 rounded font-mono font-bold">
                                      কোড: {branch.code}
                                    </span>
                                  </div>
                                </div>
                              </td>

                              {/* Manager */}
                              <td className="px-4 py-3 whitespace-nowrap">
                                {currentManager ? (
                                  <span className="bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-lg text-[11px] font-bold">
                                    {currentManager.name}
                                  </span>
                                ) : (
                                  <span className="text-slate-400 italic text-[11px]">নিযুক্ত নয় (অটো সিলেক্ট)</span>
                                )}
                              </td>

                              {/* Address */}
                              <td className="px-4 py-3 max-w-[180px] truncate text-slate-600 font-medium" title={branch.address}>
                                {branch.address}
                              </td>

                              {/* Phone */}
                              <td className="px-4 py-3 whitespace-nowrap font-mono text-slate-600 font-medium">
                                {branch.phone}
                              </td>

                              {/* Joining Date */}
                              <td className="px-4 py-3 whitespace-nowrap font-mono text-slate-500">
                                {branch.addDate}
                              </td>

                              {/* Status Info */}
                              <td className="px-4 py-3 whitespace-nowrap text-right">
                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                  isClosed 
                                    ? 'bg-rose-50 text-rose-600 border border-rose-100' 
                                    : 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                                }`}>
                                  <span className={`w-1.5 h-1.5 rounded-full ${isClosed ? 'bg-rose-500 animate-pulse' : 'bg-emerald-500'}`}></span>
                                  {isClosed ? 'বন্ধ (Closed)' : 'সচল (Active)'}
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

              {/* Branch Modal Form */}
              {isBranchModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70">
                  <div className="bg-white rounded-xl shadow-xl max-w-md w-full overflow-hidden border border-slate-100 animate-in fade-in zoom-in-95 duration-150">
                    <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
                      <h3 className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
                        <Building size={16} className="text-blue-600" /> 
                        {isBranchEditMode ? 'শাখা অফিস তথ্য সংশোধন (Edit)' : 'নতুন শাখা অফিস নিবন্ধন'}
                      </h3>
                      <button onClick={() => setIsBranchModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-0.5">
                        <X size={18} />
                      </button>
                    </div>
                    
                    <form onSubmit={handleAddBranch} className="p-5 space-y-3.5">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-semibold text-slate-500 mb-1">শাখার নাম *</label>
                          <input 
                            type="text" 
                            className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-bold" 
                            value={branchName} 
                            onChange={(e) => setBranchName(e.target.value)}
                            placeholder="যেমন, মিরপুর শাখা"
                            required
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-slate-500 mb-1">শাখা কোড *</label>
                          <input 
                            type="text" 
                            className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-mono font-bold" 
                            value={branchCode} 
                            onChange={(e) => setBranchCode(e.target.value)}
                            placeholder="যেমন, MIR-01"
                            required
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-500 mb-1">যোগাযোগ ফোন *</label>
                        <input 
                          type="tel" 
                          className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-bold" 
                          value={branchPhone} 
                          onChange={(e) => setBranchPhone(e.target.value)}
                          placeholder="01XXXXXXXXX"
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-500 mb-1">শাখার ঠিকানা *</label>
                        <input 
                          type="text" 
                          className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-bold" 
                          value={branchAddress} 
                          onChange={(e) => setBranchAddress(e.target.value)}
                          placeholder="পূর্ণ ঠিকানা লিখুন"
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-500 mb-1">প্রতিষ্ঠার তারিখ</label>
                        <input 
                          type="date" 
                          className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-bold" 
                          value={branchDate} 
                          onChange={(e) => setBranchDate(e.target.value)}
                          required
                        />
                      </div>

                      <div className="flex gap-2.5 pt-3">
                        <button 
                          type="button" 
                          onClick={() => setIsBranchModalOpen(false)}
                          className="flex-1 py-1.5 text-xs font-bold text-slate-600 bg-slate-100 rounded-lg cursor-pointer"
                        >
                          বাতিল
                        </button>
                        <button 
                          type="submit"
                          className="flex-1 py-1.5 text-xs font-bold text-white bg-blue-600 rounded-lg hover:bg-blue-700 cursor-pointer"
                        >
                          {isBranchEditMode ? 'সংশোধন নিশ্চিত করুন' : 'নিশ্চিত করুন'}
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}

            </div>
          )}
          {/* VIEW 2: Staff Management / কর্মকর্তা / কর্মী তালিকা */}
          {activeTab === 'staff' && (
            <div className="space-y-5 animate-in fade-in duration-100">
              
              {/* Back button */}
              <div className="pb-1.5">
                <button
                  onClick={() => setActiveTab('home')}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold hover:text-slate-900 rounded-lg text-[10.5px] border border-slate-200 cursor-pointer transition shadow-3xs"
                >
                  <ChevronLeft size={13} />
                  <span>← প্রধান এডমিন কন্ট্রোলে ফিরুন</span>
                </button>
              </div>
              
              <div className="flex justify-between items-center flex-wrap gap-3 border-b border-slate-100 pb-4">
                <div>
                  <h3 className="text-lg font-bold text-slate-800">কর্মকর্তা ও মাঠ কর্মী তালিকা</h3>
                  <p className="text-xs text-slate-400">আপনার প্রতিষ্ঠানে নিয়োজিত সকল কর্মকর্তা ও মাঠ কর্মীদের ডাটাবেস।</p>
                </div>

                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2 text-slate-400" size={14} />
                    <input 
                      type="text" 
                      placeholder="কর্মী খুঁজুন..."
                      className="pl-8 pr-3 py-1.5 border border-slate-200 rounded-lg text-xs w-44 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>
                  
                  <button 
                    onClick={() => {
                      setIsStaffEditMode(false);
                      setEditingStaffId(null);
                      setStaffName('');
                      setStaffPhone('');
                      setStaffDesignation('মাঠ কর্মী');
                      setStaffBranchId('');
                      setStaffBranchJoiningDate(new Date().toISOString().split('T')[0]);
                      setIsStaffModalOpen(true);
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg transition-colors shadow-xs cursor-pointer"
                  >
                    <Plus size={14} />
                    <span>নতুন কর্মী যুক্ত করুন</span>
                  </button>
                </div>
              </div>

              {/* Staff List Table layout */}
              {filteredStaff.length === 0 ? (
                <div className="bg-slate-50 rounded-2xl border border-dashed border-slate-200 p-12 text-center">
                  <UserCheck className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                  <p className="text-slate-500 text-sm font-medium">কোনো কর্মকর্তা বা কর্মীর তথ্য পাওয়া যায়নি।</p>
                  <p className="text-slate-400 text-xs mt-1">নতুন কোনো কর্মকর্তা যুক্ত করতে "নতুন কর্মী যুক্ত করুন" বাটনে ক্লিক করুন।</p>
                </div>
              ) : (
                <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200">
                          <th className="py-3 px-4 text-xs font-bold text-slate-500 text-[11px] uppercase tracking-wider">নাম ও পদবী</th>
                          <th className="py-3 px-4 text-xs font-bold text-slate-500 text-[11px] uppercase tracking-wider">লগইন ক্রেডেনশিয়াল</th>
                          <th className="py-3 px-4 text-xs font-bold text-slate-500 text-[11px] uppercase tracking-wider">স্থলাভিষিক্ত শাখা</th>
                          <th className="py-3 px-4 text-xs font-bold text-slate-500 text-[11px] uppercase tracking-wider">যোগযোগ ও যোগদান</th>
                          <th className="py-3 px-4 text-xs font-bold text-slate-500 text-[11px] uppercase tracking-wider text-right">কার্যক্রম (Actions)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredStaff.map((staff) => {
                          const assignedBranch = branchesList.find(b => b.id === staff.branchId);
                          return (
                            <tr key={staff.id} className="hover:bg-slate-50/50 transition-colors">
                              <td className="py-3.5 px-4">
                                <div className="flex items-center gap-3">
                                  <div className="w-9 h-9 bg-blue-50 text-blue-700 rounded-full flex items-center justify-center shrink-0 font-extrabold text-xs">
                                    {staff.name.charAt(0)}
                                  </div>
                                  <div>
                                    <h4 className="font-bold text-slate-800 text-xs sm:text-sm">{staff.name}</h4>
                                    <span className="inline-block px-2 py-0.5 bg-slate-100 text-slate-600 font-bold rounded text-[9px] mt-0.5">
                                      {staff.designation}
                                    </span>
                                  </div>
                                </div>
                              </td>
                              
                              <td className="py-3.5 px-4">
                                {(staff.staffId || staff.password) && (
                                  <div className="space-y-1 text-slate-600 font-mono text-[10px] bg-slate-50 p-2 rounded-lg border border-slate-100 inline-block min-w-[160px]">
                                    <div className="flex justify-between gap-3">
                                      <span className="text-slate-400">আইডি (UID):</span>
                                      <span className="font-bold text-blue-700 select-all">{staff.staffId}</span>
                                    </div>
                                    <div className="flex justify-between gap-3">
                                      <span className="text-slate-400">পাসওয়ার্ড:</span>
                                      <span className="font-bold text-slate-700 select-all">{staff.password}</span>
                                    </div>
                                  </div>
                                )}
                              </td>

                              <td className="py-3.5 px-4">
                                {assignedBranch ? (
                                  <div>
                                    <span className="inline-block text-blue-700 font-bold bg-blue-50 px-2 py-0.5 rounded text-[10px]">
                                      {assignedBranch.name}
                                    </span>
                                    {staff.branchJoiningDate && (
                                      <p className="text-[9px] text-slate-400 mt-0.5 font-mono">
                                        যোগদান: {staff.branchJoiningDate}
                                      </p>
                                    )}
                                  </div>
                                ) : (
                                  <span className="inline-block text-slate-500 bg-slate-100 px-2 py-0.5 rounded text-[10px]">
                                    প্রধান কার্যালয় / অনিযুক্ত
                                  </span>
                                )}
                              </td>

                              <td className="py-3.5 px-4 text-xs text-slate-600">
                                <div className="space-y-0.5">
                                  <p className="flex items-center gap-1 font-mono text-[11px]">
                                    <Phone size={11} className="text-slate-400" /> {staff.phone}
                                  </p>
                                  <p className="flex items-center gap-1 text-[10px] text-slate-400">
                                    <Calendar size={11} /> যোগদান: {staff.joiningDate}
                                  </p>
                                </div>
                              </td>

                              <td className="py-3.5 px-4 text-right">
                                <div className="flex items-center justify-end gap-2">
                                  {/* User Portal Entrance */}
                                  <button
                                    type="button"
                                    onClick={() => setSelectedSimulationStaff(staff)}
                                    className="px-2 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-100 rounded-lg text-[10px] font-extrabold flex items-center gap-1 transition-colors cursor-pointer"
                                    title={`${staff.name} হিসেবে ইউজার প্যানেলে সরাসরি প্রবেশ`}
                                  >
                                    <Layers size={11} />
                                    <span>লগইন প্যানেল</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setStaffList(prev => prev.map(s => s.id === staff.id ? { ...s, password: '1234' } : s));
                                      alert(`${staff.name} এর পাসওয়ার্ড রিসেট করা হয়েছে। (নতুন পাসওয়ার্ড: 1234)`);
                                    }}
                                    className="px-2 py-1 bg-red-50 hover:bg-red-100 text-red-700 border border-red-100 rounded-lg text-[10px] font-extrabold flex items-center gap-1 transition-colors cursor-pointer"
                                    title={`${staff.name} এর পাসওয়ার্ড রিসেট করুন`}
                                  >
                                    <RefreshCw size={11} /> রিসেট
                                  </button>
                                  {/* Edit button */}
                                  <button
                                    onClick={() => handleEditStaffClick(staff)}
                                    className="p-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                                    title="কর্মী তথ্য সংশোধন"
                                  >
                                    <Pencil size={13} />
                                  </button>

                                  {/* Delete button */}
                                  {!staff.staffId?.startsWith('ILO') && (
                                    <button
                                      onClick={() => handleDeleteStaff(staff.id, staff.name)}
                                      className="p-1.5 text-rose-500 hover:text-rose-750 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                      title="কর্মী বাদ দিন"
                                    >
                                      <Trash2 size={13} />
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Staff Edit / Add Modal */}
              {isStaffModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 animate-in fade-in duration-100">
                  <div className="bg-white rounded-xl shadow-xl max-w-sm w-full overflow-hidden border border-slate-100 animate-in zoom-in-95 duration-150">
                    <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
                      <h3 className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
                        <UserCheck size={16} className="text-blue-600" /> 
                        <span>{isStaffEditMode ? 'কর্মী তথ্য সম্পাদন করুন' : 'নতুন কর্মকর্তা বা কর্মী যুক্ত করুন'}</span>
                      </h3>
                      <button onClick={() => setIsStaffModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer">
                        <X size={18} />
                      </button>
                    </div>
                    
                    <form onSubmit={handleAddStaff} className="p-5 space-y-3.5">
                      <div>
                        <label className="block text-xs font-semibold text-slate-500 mb-1">কর্মকর্তা / কর্মীর নাম *</label>
                        <input 
                          type="text" 
                          className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs" 
                          value={staffName} 
                          onChange={(e) => setStaffName(e.target.value)}
                          placeholder="যেমন, মো: আরিফুল রহমান"
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-500 mb-1">মোবাইল ফোন নম্বর *</label>
                        <input 
                          type="tel" 
                          className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-mono font-bold" 
                          value={staffPhone} 
                          onChange={(e) => setStaffPhone(e.target.value)}
                          placeholder="01XXXXXXXXX"
                          required
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-semibold text-slate-500 mb-1">পদবী</label>
                          <select 
                            className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs bg-white font-medium"
                            value={staffDesignation}
                            onChange={(e) => setStaffDesignation(e.target.value)}
                          >
                            <option value="মাঠ কর্মী">মাঠ কর্মী</option>
                            <option value="শাখা ব্যবস্থাপক">শাখা ব্যবস্থাপক</option>
                            <option value="সহকারী ব্যবস্থাপক">সহকারী ব্যবস্থাপক</option>
                            <option value="কো-অর্ডিনেটর">কো-অর্ডিনেটর</option>
                            <option value="অন্যান্য কর্মকর্তা">অন্যান্য কর্মকর্তা</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-slate-500 mb-1">যোগদানের তারিখ</label>
                          <input 
                            type="date" 
                            className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-mono font-bold" 
                            value={staffDate} 
                            onChange={(e) => setStaffDate(e.target.value)}
                            required
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-semibold text-slate-500 mb-1">কর্মরত শাখা (Branch)</label>
                          <select 
                            className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs bg-white font-medium"
                            value={staffBranchId}
                            onChange={(e) => setStaffBranchId(e.target.value)}
                          >
                            <option value="">প্রধান কার্যালয় / অনিযুক্ত</option>
                            {branchesList.map(b => (
                              <option key={b.id} value={b.id}>{b.name}</option>
                            ))}
                          </select>
                        </div>

                        {staffBranchId && (
                          <div>
                            <label className="block text-xs font-semibold text-slate-500 mb-1">ব্রাঞ্চে যোগদানের তারিখ</label>
                            <input 
                              type="date" 
                              className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-mono font-bold" 
                              value={staffBranchJoiningDate} 
                              onChange={(e) => setStaffBranchJoiningDate(e.target.value)}
                              required
                            />
                          </div>
                        )}
                      </div>

                      <div className="flex gap-2.5 pt-3">
                        <button 
                          type="button" 
                          onClick={() => setIsStaffModalOpen(false)}
                          className="flex-1 py-1.5 text-xs font-bold text-slate-600 bg-slate-100 rounded-lg cursor-pointer"
                        >
                          বাতিল
                        </button>
                        <button 
                          type="submit"
                          className="flex-1 py-1.5 text-xs font-bold text-white bg-blue-600 rounded-lg hover:bg-blue-700 cursor-pointer"
                        >
                          {isStaffEditMode ? 'হালনাগাদ (Update)' : 'সংরক্ষণ করুন'}
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}

            </div>
          )}

          {/* VIEW 3: Configuration Panel / কনফিগারেশন */}
          {activeTab === 'config' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              
              {/* Back button */}
              <div className="pb-1">
                <button
                  onClick={() => setActiveTab('home')}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold hover:text-slate-900 rounded-lg text-[10.5px] border border-slate-200 cursor-pointer transition shadow-3xs"
                >
                  <ChevronLeft size={13} />
                  <span>← প্রধান এডমিন কন্ট্রোলে ফিরুন</span>
                </button>
              </div>
              <div className="border-b border-slate-100 pb-4">
                <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                  <Settings className="text-blue-600" size={20} />
                  <span>প্রতিষ্ঠান কনফিগারেশন প্যানেল</span>
                </h3>
                <p className="text-xs text-slate-400">আপনার প্রতিষ্ঠানের প্রোফাইল, লোগো স্টাইল এবং এমআরএ (MRA) সহায়িকা মোতাবেক সঞ্চয় ও ঋণ নীতি নির্ধারণ করুন।</p>
              </div>

              {/* Elegant Sub-tabs inside Configuration panel */}
              <div className="flex border-b border-slate-200 gap-1.5 sm:gap-2 mb-4 select-none overflow-x-auto no-scrollbar pb-0.5">
                <button
                  type="button"
                  onClick={() => setConfigSubTab('general')}
                  className={`px-3 sm:px-4 py-2 text-xs font-bold border-b-2 whitespace-nowrap transition-all cursor-pointer ${
                    configSubTab === 'general'
                      ? 'border-blue-600 text-blue-600 font-extrabold'
                      : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
                  }`}
                >
                  ১. সাধারণ ও পলিসি সেটিংস
                </button>
                <button
                  type="button"
                  onClick={() => setConfigSubTab('loan-scheme')}
                  className={`px-3 sm:px-4 py-2 text-xs font-bold border-b-2 whitespace-nowrap transition-all cursor-pointer ${
                    configSubTab === 'loan-scheme'
                      ? 'border-blue-600 text-blue-600 font-extrabold'
                      : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
                  }`}
                >
                  ২. লোন প্রোডাক্ট ও স্কিম সেটিংস
                </button>
                <button
                  type="button"
                  onClick={() => setConfigSubTab('share-policy')}
                  className={`px-3 sm:px-4 py-2 text-xs font-bold border-b-2 whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
                    configSubTab === 'share-policy'
                      ? 'border-emerald-600 text-emerald-700 font-extrabold bg-emerald-50/70 rounded-t-lg'
                      : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
                  }`}
                >
                  <Coins size={13} className={configSubTab === 'share-policy' ? 'text-emerald-600' : 'text-slate-400'} />
                  <span>৩. শেয়ার মূলধন ও লভ্যাংশ সেটিংস ({sharePriceConfig}৳)</span>
                </button>
              </div>

              {configSubTab === 'general' && (
                <div className="space-y-6 animate-in fade-in duration-200">
                  {configSuccessMsg && (
                    <div id="config-success-toast" className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-bold animate-in fade-in slide-in-from-top-2 duration-200 flex items-center gap-2">
                      <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping"></div>
                      <span>{configSuccessMsg}</span>
                    </div>
                  )}

                  <form onSubmit={handleSaveConfig} className="space-y-6">
                <div className="grid gap-6 md:grid-cols-2">
                  
                  {/* --- SECTION 1: GENERAL INFO (সাধারণ তথ্য) --- */}
                  <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
                    <h4 className="text-[12px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5 border-b border-slate-100 pb-2.5">
                      <Shield size={14} className="text-blue-600" /> ১. সাধারণ ও লোগো সেটিংস
                    </h4>

                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[10px] sm:text-xs font-bold text-slate-600 mb-1">প্রতিষ্ঠানের নাম</label>
                          <input 
                            type="text"
                            className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-medium focus:ring-1 focus:ring-blue-500 focus:outline-none"
                            value={orgName}
                            onChange={(e) => setOrgName(e.target.value)}
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] sm:text-xs font-bold text-slate-600 mb-1">লোগো থিম / স্টাইল</label>
                          <select 
                            className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-medium focus:ring-1 focus:ring-blue-500 focus:outline-none bg-white"
                            value={orgLogoStyle}
                            onChange={(e) => setOrgLogoStyle(e.target.value)}
                          >
                            <option value="shield">🛡️ সুরক্ষাকবচ (Shield)</option>
                            <option value="building">🏢 কর্পোরেট ভবন (Building)</option>
                            <option value="globe">🌐 আন্তর্জাতিক / গোলক (Globe)</option>
                            <option value="filetext">📄 রিপোর্টিং নথি (FileText)</option>
                            <option value="sliders">🎚️ কন্ট্রোল নব (Sliders)</option>
                          </select>
                        </div>
                      </div>

                      {/* Custom Logo Upload & Preview Container */}
                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/60 space-y-2.5">
                        <span className="block text-[10px] sm:text-xs font-bold text-slate-600">কাস্টম লোগো আপলোড (ঐচ্ছিক)</span>
                        <div className="flex items-center gap-4">
                          <OrgLogo 
                            orgId={org.id} 
                            size={44} 
                            logoStyle={orgLogoStyle} 
                            logoUrl={orgLogoUrl} 
                            className="shadow-3xs border border-slate-200" 
                          />
                          <div className="flex-1 min-w-0">
                            <input 
                              type="file" 
                              id="org-logo-upload-input"
                              accept="image/*"
                              className="hidden" 
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  // Limit file size to 1.5MB for localStorage safety
                                  if (file.size > 1500 * 1024) {
                                    alert('ফাইলের সাইজ অনেক বড় (সর্বোচ্চ ১.৫ মেগাবাইট অনুমোদিত)। অনুগ্রহ করে ছোট সাইজের ছবি আপলোড করুন।');
                                    return;
                                  }
                                  const reader = new FileReader();
                                  reader.onloadend = () => {
                                    setOrgLogoUrl(reader.result as string);
                                  };
                                  reader.readAsDataURL(file);
                                }
                              }}
                            />
                            <div className="flex flex-wrap gap-2">
                              <label 
                                htmlFor="org-logo-upload-input"
                                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[10px] sm:text-xs font-bold transition-all cursor-pointer inline-flex items-center gap-1.5 shadow-3xs"
                              >
                                <Upload size={12} />
                                লোগো নির্বাচন করুন
                              </label>
                              {orgLogoUrl && (
                                <button
                                  type="button"
                                  onClick={() => setOrgLogoUrl('')}
                                  className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 rounded-lg text-[10px] sm:text-xs font-bold transition-all cursor-pointer inline-flex items-center gap-1"
                                >
                                  <X size={12} />
                                  মুছে ফেলুন
                                </button>
                              )}
                            </div>
                            <p className="text-[10px] text-slate-400 mt-1">PNG, JPG বা WEBP ফরম্যাটের ছবি আপলোড করুন।</p>
                          </div>
                        </div>
                      </div>

                      <div>
                        <label className="block text-[10px] sm:text-xs font-bold text-slate-600 mb-1">ঠিকানা (বিস্তারিত)</label>
                        <input 
                          type="text"
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-medium focus:ring-1 focus:ring-blue-500 focus:outline-none"
                          value={orgAddress}
                          onChange={(e) => setOrgAddress(e.target.value)}
                          required
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[10px] sm:text-xs font-bold text-slate-600 mb-1">ফোন নম্বর</label>
                          <input 
                            type="text"
                            className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-medium focus:ring-1 focus:ring-blue-500 focus:outline-none"
                            value={orgPhone}
                            onChange={(e) => setOrgPhone(e.target.value)}
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] sm:text-xs font-bold text-slate-600 mb-1">ইমেইল ঠিকানা</label>
                          <input 
                            type="email"
                            className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-medium focus:ring-1 focus:ring-blue-500 focus:outline-none"
                            value={orgEmail}
                            onChange={(e) => setOrgEmail(e.target.value)}
                            required
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[10px] sm:text-xs font-bold text-slate-600 mb-1">ওয়েবসাইট ইউআরএল</label>
                          <input 
                            type="text"
                            className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-mono focus:ring-1 focus:ring-blue-500 focus:outline-none"
                            value={orgWebsite}
                            onChange={(e) => setOrgWebsite(e.target.value)}
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] sm:text-xs font-bold text-slate-600 mb-1">ট্রেড লাইসেন্স / রেজি নম্বর</label>
                          <input 
                            type="text"
                            className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-bold font-mono focus:ring-1 focus:ring-blue-500 focus:outline-none"
                            value={orgTradeLicense}
                            onChange={(e) => setOrgTradeLicense(e.target.value)}
                            required
                          />
                        </div>
                      </div>

                      <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 flex justify-between items-center text-xs">
                        <div>
                          <p className="font-bold text-slate-700">অ্যাডমিন পাসওয়ার্ড পরিবর্তন</p>
                          <p className="text-[10px] text-slate-400 mt-0.5">টপবারের পাসওয়ার্ড পরিবর্তন বাটন ব্যবহার করুন।</p>
                        </div>
                        <span className="font-mono bg-slate-200 px-2 py-0.5 rounded text-[10px] font-bold">ক্রিপ্ট-লক</span>
                      </div>
                    </div>
                  </div>



                  {/* --- SECTION 4: SAVINGS CONFIGURATION (সঞ্চয় কনফিগারেশন) --- */}
                  <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
                    <h4 className="text-[12px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5 border-b border-slate-100 pb-2.5">
                      <Users size={14} className="text-amber-600" /> ৪. চার ধরণের সাধারণ সঞ্চয় পলিসি ও সদস্য ভর্তি সেটিংস
                    </h4>

                    <div className="space-y-4">
                      {/* Notice about Savings Withdraw Limits */}
                      <div className="p-3 bg-blue-50/50 border border-blue-105 rounded-xl text-[11px] text-blue-800 flex items-start gap-2">
                        <Info size={14} className="text-blue-500 shrink-0 mt-0.5" />
                        <div>
                          <strong>সঞ্চয় উত্তোলন প্রবিধান:</strong> তানজিল মাইক্রোক্রেডিট সিস্টেমে <strong>সঞ্চয় উত্তোলনের কোনো সীমা থাকবে না</strong> (সদস্যরা যেকোনো সময় তাদের সঞ্চয় থেকে উত্তোলন করতে পারবেন)।
                        </div>
                      </div>

                      {/* 4 Types of Savings Dividends */}
                      <div className="bg-slate-50 p-4 rounded-xl border border-slate-150 space-y-3">
                        <h5 className="text-[11px] font-extrabold text-slate-700 uppercase tracking-widest">চার ধরনের সঞ্চয় ও লভ্যাংশ হার (%)</h5>
                        
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                          <div>
                            <label className="block text-[10px] font-bold text-slate-600 mb-1">সাধারণ সঞ্চয় (GS)</label>
                            <div className="relative">
                              <span className="absolute right-2 top-1.5 text-[10px] text-slate-400 font-bold">%</span>
                              <input 
                                type="text"
                                className="w-full pl-2 pr-5 py-1.5 border border-slate-200 rounded-lg text-xs font-mono font-bold text-center"
                                value={savProfitGS}
                                onChange={(e) => setSavProfitGS(e.target.value)}
                                required
                              />
                            </div>
                          </div>

                          <div>
                            <label className="block text-[10px] font-bold text-slate-600 mb-1">মূলধন সঞ্চয় (CBS)</label>
                            <div className="relative">
                              <span className="absolute right-2 top-1.5 text-[10px] text-slate-400 font-bold">%</span>
                              <input 
                                type="text"
                                className="w-full pl-2 pr-5 py-1.5 border border-slate-200 rounded-lg text-xs font-mono font-bold text-center"
                                value={savProfitCBS}
                                onChange={(e) => setSavProfitCBS(e.target.value)}
                                required
                              />
                            </div>
                          </div>

                          <div>
                            <label className="block text-[10px] font-bold text-slate-600 mb-1">দীর্ঘমেয়াদী সঞ্চয় (LTS)</label>
                            <div className="relative">
                              <span className="absolute right-2 top-1.5 text-[10px] text-slate-400 font-bold">%</span>
                              <input 
                                type="text"
                                className="w-full pl-2 pr-5 py-1.5 border border-slate-200 rounded-lg text-xs font-mono font-bold text-center"
                                value={savProfitLTS}
                                onChange={(e) => setSavProfitLTS(e.target.value)}
                                required
                              />
                            </div>
                          </div>

                          <div>
                            <label className="block text-[10px] font-bold text-slate-600 mb-1">ফিক্সড ডিপোজিট (FDR)</label>
                            <div className="relative">
                              <span className="absolute right-2 top-1.5 text-[10px] text-slate-400 font-bold">%</span>
                              <input 
                                type="text"
                                className="w-full pl-2 pr-5 py-1.5 border border-slate-200 rounded-lg text-xs font-mono font-bold text-center"
                                value={savProfitFDR}
                                onChange={(e) => setSavProfitFDR(e.target.value)}
                                required
                              />
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white p-2.5 rounded-lg border border-slate-200 text-[11px] gap-2 mt-2">
                          <span className="font-semibold text-slate-600">Fixed Deposit (F FDR) এর লভ্যাংশ প্রদানের ধরন:</span>
                          <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-800 font-bold rounded-full text-[10px]">
                            {savFdrPayoutType} (фиксированный)
                          </span>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[10px] sm:text-xs font-bold text-slate-600 mb-1">সর্বনিম্ন সঞ্চয় জমা (৳)</label>
                          <div className="relative">
                            <span className="absolute left-3 top-1.5 text-xs text-slate-400 font-bold font-mono">৳</span>
                            <input 
                              type="text"
                              className="w-full pl-7 pr-3 py-1.5 border border-slate-200 rounded-lg text-xs font-bold focus:ring-1 focus:ring-blue-500 focus:outline-none"
                              value={savingsMinDeposit}
                              onChange={(e) => setSavingsMinDeposit(e.target.value)}
                              required
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-[10px] sm:text-xs font-bold text-slate-600 mb-1">সদস্যের ন্যূনতম ব্যালেন্স (৳)</label>
                          <div className="relative">
                            <span className="absolute left-3 top-1.5 text-xs text-slate-400 font-bold font-mono">৳</span>
                            <input 
                              type="text"
                              className="w-full pl-7 pr-3 py-1.5 border border-slate-200 rounded-lg text-xs font-bold focus:ring-1 focus:ring-blue-500 focus:outline-none"
                              value={savingsMinBalance}
                              onChange={(e) => setSavingsMinBalance(e.target.value)}
                              required
                            />
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <label className="block text-[10px] sm:text-xs font-bold text-slate-600 mb-1">সদস্য ভর্তি ফি</label>
                          <div className="relative">
                            <span className="absolute left-3 top-1.5 text-xs text-slate-400 font-bold font-mono">৳</span>
                            <input 
                              type="text"
                              className="w-full pl-7 pr-3 py-1.5 border border-slate-200 rounded-lg text-xs font-bold focus:ring-1 focus:ring-blue-500 focus:outline-none"
                              value={savingsAdmissionFee}
                              onChange={(e) => setSavingsAdmissionFee(e.target.value)}
                              required
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-[10px] sm:text-xs font-bold text-slate-600 mb-1">পাসবই ও ফর্ম ফি</label>
                          <div className="relative">
                            <span className="absolute left-3 top-1.5 text-xs text-slate-400 font-bold font-mono">৳</span>
                            <input 
                              type="text"
                              className="w-full pl-7 pr-3 py-1.5 border border-slate-200 rounded-lg text-xs font-bold focus:ring-1 focus:ring-blue-500 focus:outline-none"
                              value={savingsPassbookFee}
                              onChange={(e) => setSavingsPassbookFee(e.target.value)}
                              required
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-[10px] sm:text-xs font-bold text-slate-600 mb-1">সদস্য কল্যাণ তহবিল চাঁদা</label>
                          <div className="relative">
                            <span className="absolute left-3 top-1.5 text-xs text-slate-400 font-bold font-mono">৳</span>
                            <input 
                              type="text"
                              className="w-full pl-7 pr-3 py-1.5 border border-slate-200 rounded-lg text-xs font-bold focus:ring-1 focus:ring-blue-500 focus:outline-none"
                              value={savingsWelfareFee}
                              onChange={(e) => setSavingsWelfareFee(e.target.value)}
                              required
                            />
                          </div>
                        </div>
                      </div>

                      {/* Cooperative Share Capital Configuration */}
                      <div className="bg-emerald-50/60 p-3.5 rounded-xl border border-emerald-200/80 space-y-2.5">
                        <div className="flex items-center justify-between">
                          <h5 className="text-[11px] font-extrabold text-emerald-900 flex items-center gap-1.5">
                            <CheckCircle size={13} className="text-emerald-600" />
                            সমবায় শেয়ার মূলধন কনফিগারেশন (Cooperative Share Settings)
                          </h5>
                          <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100/70 px-2 py-0.5 rounded-full border border-emerald-200">
                            সদস্য ভর্তিতে প্রযোজ্য
                          </span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[10px] sm:text-xs font-bold text-slate-700 mb-1">
                              প্রতি শেয়ারের মূল্য (Share Face Value) *
                            </label>
                            <div className="relative">
                              <span className="absolute left-3 top-1.5 text-xs text-slate-400 font-bold font-mono">৳</span>
                              <input 
                                type="text"
                                className="w-full pl-7 pr-3 py-1.5 border border-emerald-300 rounded-lg text-xs font-bold focus:ring-1 focus:ring-emerald-500 focus:outline-none bg-white"
                                value={sharePriceConfig}
                                onChange={(e) => setSharePriceConfig(e.target.value)}
                                placeholder="১০"
                                required
                              />
                            </div>
                            <span className="text-[10px] text-slate-500 mt-1 block">
                              যেমন: ১০ টাকা বা ১০০ টাকা (ভর্তি ফর্মে অটোমেটিক এই দর বসবে)
                            </span>
                          </div>

                          <div>
                            <label className="block text-[10px] sm:text-xs font-bold text-slate-700 mb-1">
                              ভর্তির সময় সর্বনিম্ন শেয়ার সংখ্যা *
                            </label>
                            <div className="relative">
                              <input 
                                type="text"
                                className="w-full px-3 py-1.5 border border-emerald-300 rounded-lg text-xs font-bold focus:ring-1 focus:ring-emerald-500 focus:outline-none bg-white"
                                value={minShareCountConfig}
                                onChange={(e) => setMinShareCountConfig(e.target.value)}
                                placeholder="১"
                                required
                              />
                            </div>
                            <span className="text-[10px] text-slate-500 mt-1 block">
                              সদস্য ভর্তিতে ন্যূনতম ১ টি শেয়ার ক্রয় বাধ্যতামূলক
                            </span>
                          </div>
                        </div>
                      </div>

                    </div>
                  </div>

                </div>

                <div className="flex justify-end pt-3 border-t border-slate-100 gap-3">
                  <button 
                    type="button"
                    onClick={() => {
                      setOldPasswordVal('');
                      setNewPasswordVal('');
                      setConfirmPasswordVal('');
                      setPasswordChangeSuccess('');
                      setIsChangePasswordModalOpen(true);
                    }}
                    className="flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-all shadow-md cursor-pointer"
                  >
                    <Key size={14} />
                    <span>পাসওয়ার্ড পরিবর্তন করুন</span>
                  </button>
                  <button 
                    type="submit"
                    className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-blue-500/10 cursor-pointer"
                  >
                    <Save size={14} />
                    <span>কনফিগারেশন সংরক্ষণ করুন</span>
                  </button>
                </div>
              </form>
            </div>
          )}

          {configSubTab === 'loan-scheme' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className="border-b border-slate-100 pb-4">
                <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                  <Sliders className="text-indigo-600" size={20} />
                  <span>লোন ক্যাটাগরি, প্রোডাক্ট স্কিম ও পলিসি কনফিগারেশন প্যানেল</span>
                </h3>
                <p className="text-xs text-slate-400">নতুন লোন প্রোডাক্ট স্কিম যুক্ত বা সংশোধন করুন এবং সামগ্রিক ঋণ অনুমোদন সীমা ও কিস্তি আদায় পলিসি নির্ধারণ করুন।</p>
              </div>

              {configSuccessMsg && (
                <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-bold animate-in fade-in slide-in-from-top-2 duration-200 flex items-center gap-2">
                  <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping"></div>
                  <span>{configSuccessMsg}</span>
                </div>
              )}

              <div className="grid gap-6 lg:grid-cols-12 items-start">
                
                {/* Product Schemes list and creator */}
                <div className="lg:col-span-12 xl:col-span-5 space-y-6">
                  <div className="bg-white p-5 border border-slate-200 rounded-2xl shadow-xs space-y-4">
                    <h4 className="text-[12px] font-bold uppercase tracking-wider text-indigo-900 border-b border-slate-100 pb-2.5 flex items-center justify-between">
                      <span>১. লোন প্রোডাক্ট স্কিম জেনারেটর</span>
                      <button 
                        type="button"
                        onClick={handleResetProductConfigsToDefault}
                        className="text-[10px] px-2.5 py-1 rounded bg-slate-100 text-slate-600 hover:bg-slate-200 flex items-center gap-1 transition-all cursor-pointer font-bold border-0"
                      >
                        <RotateCcw size={10} /> ডিফল্ট রিসেট
                      </button>
                    </h4>

                    {/* Form to Create/Edit Scheme */}
                    <form onSubmit={handleSaveProductConfig} className="space-y-3.5 bg-slate-50/70 p-4 rounded-xl border border-slate-100">
                      <div className="text-[11px] font-extrabold text-indigo-950 uppercase mb-1">
                        {editingProductId ? '🛠️ লোন প্রোডাক্ট স্কিম পরিবর্তন' : '➕ নতুন লোন প্রোডাক্ট স্কিম ফরম'}
                      </div>
                      
                      <div>
                        <label className="block text-[10px] font-bold text-slate-600 mb-1">ক্যাটাগরি/প্রোডাক্টের নাম *</label>
                        <input 
                          type="text"
                          className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
                          placeholder="যেমন: অগ্রসর (সাপ্তাহিক)"
                          value={newProdName}
                          onChange={(e) => setNewProdName(e.target.value)}
                          required
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-600 mb-1">কিস্তির প্রকারভেদ</label>
                          <select 
                            className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
                            value={newProdType}
                            onChange={(e) => {
                              const val = e.target.value as any;
                              setNewProdType(val);
                              if (val === 'মেয়াদি') {
                                setNewProdCollectSCMonthly(true);
                              }
                            }}
                          >
                            <option value="সাপ্তাহিক">সাপ্তাহিক</option>
                            <option value="মাসিক">মাসিক</option>
                            <option value="মেয়াদি">মেয়াদি</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-600 mb-1">সার্ভিস চার্জের হার (%) *</label>
                          <div className="relative">
                            <span className="absolute right-3 top-1.5 text-xs text-slate-400 font-bold">%</span>
                            <input 
                              type="number"
                              min="0"
                              max="100"
                              step="0.1"
                              className="w-full pl-3 pr-7 py-1.5 border border-slate-200 rounded-lg text-xs font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
                              value={newProdRate}
                              onChange={(e) => setNewProdRate(e.target.value)}
                              required
                            />
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-600 mb-1">মেয়াদ (মাস) *</label>
                          {newProdType === 'মেয়াদি' ? (
                            <select 
                              className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
                              value={newProdDuration}
                              onChange={(e) => setNewProdDuration(e.target.value)}
                            >
                              <option value="3">৩ মাস</option>
                              <option value="6">৬ মাস</option>
                              <option value="9">৯ মাস</option>
                              <option value="12">১২ মাস</option>
                            </select>
                          ) : (
                            <select 
                              className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
                              value={newProdDuration}
                              onChange={(e) => setNewProdDuration(e.target.value)}
                            >
                              <option value="12">১২ মাস</option>
                              <option value="18">১৮ মাস</option>
                              <option value="24">২৪ মাস</option>
                            </select>
                          )}
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-600 mb-1">কিস্তির সংখ্যা</label>
                          <input 
                            type="text"
                            disabled
                            className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-bold bg-slate-100 text-slate-500"
                            value={newProdInstallments}
                          />
                        </div>
                      </div>

                      {newProdType === 'মেয়াদি' && (
                        <div className="p-2.5 bg-indigo-50/50 border border-indigo-100 rounded-xl mb-1.5 text-left animate-in fade-in duration-200">
                          <label className="flex items-center gap-2 cursor-pointer select-none">
                            <input 
                              type="checkbox"
                              checked={newProdCollectSCMonthly}
                              onChange={(e) => {
                                setNewProdCollectSCMonthly(e.target.checked);
                                if (e.target.checked) {
                                  setNewProdInstallments(newProdDuration);
                                } else {
                                  setNewProdInstallments('1');
                                }
                              }}
                              className="rounded border-indigo-300 text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                            />
                            <div>
                              <span className="text-[11px] font-black text-indigo-900 block font-sans">মেয়াদি ঋণে মাসিক সার্ভিস চার্জ আদায়</span>
                              <span className="text-[9px] font-medium text-indigo-700 block mt-0.5">মাসিক কিস্তিতে শুধুমাত্র সার্ভিস চার্জ আদায় করা হবে।</span>
                            </div>
                          </label>
                        </div>
                      )}

                      <div className="flex gap-2 pt-1 font-sans">
                        <button 
                          type="submit"
                          className="flex-1 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg cursor-pointer transition-all text-center flex items-center justify-center gap-1 border-0"
                        >
                          {editingProductId ? <Save size={13} /> : <Plus size={13} />}
                          <span>{editingProductId ? 'স্কিম পরিবর্তন করুন' : 'নতুন স্কিম যুক্ত করুন'}</span>
                        </button>
                        {editingProductId && (
                          <button 
                            type="button"
                            onClick={() => {
                              setEditingProductId(null);
                              setNewProdName('');
                              setNewProdType('সাপ্তাহিক');
                              setNewProdDuration('12');
                              setNewProdRate('15');
                            }}
                            className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold rounded-lg cursor-pointer transition-all border-0"
                          >
                            বাতিল
                          </button>
                        )}
                      </div>
                    </form>

                    {/* Table of active schemes */}
                    <div className="space-y-2">
                      <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">চলতি সক্রিয় ক্যাটাগরি ও স্কিমসমূহ:</div>
                      <div className="grid gap-2">
                        {productConfigs.map((cfg) => (
                          <div key={cfg.id} className="p-3 bg-white border border-slate-150 rounded-xl hover:shadow-xs transition-all flex justify-between items-center text-xs">
                            <div className="space-y-1">
                              <p className="font-extrabold text-slate-800 flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full"></span>
                                <span>{cfg.name}</span>
                              </p>
                              <div className="flex items-center gap-2 text-[10px] text-slate-400 font-semibold">
                                <span>প্রকার: {cfg.type}</span>
                                <span>•</span>
                                <span>মেয়াদ: {cfg.durationMonths} মাস ({cfg.installmentsCount} কিস্তি)</span>
                                <span>•</span>
                                <span className="text-indigo-655 font-bold bg-indigo-50 px-1.5 py-0.5 rounded">চার্জ: {Math.round(cfg.serviceChargeRate * 100)}%</span>
                              </div>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <button 
                                type="button"
                                onClick={() => handleEditProductConfig(cfg)}
                                className="p-1 px-2.5 bg-slate-100 hover:bg-indigo-50 text-slate-600 hover:text-indigo-600 rounded text-[10px] font-bold cursor-pointer flex items-center gap-0.5 border-0"
                              >
                                <Pencil size={10} /> এডিট
                              </button>
                              <button 
                                type="button"
                                onClick={() => handleDeleteProductConfig(cfg.id)}
                                className="p-1 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded cursor-pointer border-0"
                                title="মুছে ফেলুন"
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Form to configure loan & collection policies */}
                <form onSubmit={handleSaveLoanSettings} className="lg:col-span-12 xl:col-span-7 space-y-6">
                  
                  {/* --- SECTION 2: LOAN CONFIGURATION --- */}
                  <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
                    <h4 className="text-[12px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5 border-b border-slate-100 pb-2.5">
                      <Sliders size={14} className="text-indigo-600" /> ২. ঋণ অনুমোদন ও ডিফল্ট সুদ নীতিমালা
                    </h4>

                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[10px] sm:text-xs font-bold text-slate-600 mb-1">ডিফল্ট সুদের হার (%)</label>
                          <div className="relative bg-white">
                            <span className="absolute right-3 top-1.5 text-xs text-slate-400 font-bold">%</span>
                            <input 
                              type="text"
                              className="w-full pl-3 pr-7 py-1.5 border border-slate-200 rounded-lg text-xs font-bold focus:ring-1 focus:ring-blue-500 focus:outline-none bg-white font-mono"
                              value={loanDefaultInterest}
                              onChange={(e) => setLoanDefaultInterest(e.target.value)}
                              required
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-[10px] sm:text-xs font-bold text-slate-600 mb-1">সুদের হিসাব পদ্ধতি</label>
                          <select 
                            className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-medium focus:ring-1 focus:ring-indigo-500 focus:outline-none bg-slate-100 font-sans cursor-not-allowed"
                            value="Declining"
                            disabled={true}
                          >
                            <option value="Declining">ক্রমহ্রাসমান পদ্ধতি (Reducing Balance / Declining Only)</option>
                          </select>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[10px] sm:text-xs font-bold text-slate-600 mb-1">সর্বনিম্ন ঋণ অনুমোদন সীমা</label>
                          <div className="relative bg-white">
                            <span className="absolute left-3 top-1.5 text-xs text-slate-400 font-bold font-mono">৳</span>
                            <input 
                              type="text"
                              className="w-full pl-7 pr-3 py-1.5 border border-slate-200 rounded-lg text-xs font-bold focus:ring-1 focus:ring-blue-500 focus:outline-none bg-white font-mono"
                              value={loanMinAmount}
                              onChange={(e) => setLoanMinAmount(e.target.value)}
                              required
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-[10px] sm:text-xs font-bold text-slate-600 mb-1">সর্বোচ্চ ঋণ অনুমোদন সীমা</label>
                          <div className="relative bg-white">
                            <span className="absolute left-3 top-1.5 text-xs text-slate-400 font-bold font-mono">৳</span>
                            <input 
                              type="text"
                              className="w-full pl-7 pr-3 py-1.5 border border-slate-200 rounded-lg text-xs font-bold focus:ring-1 focus:ring-blue-500 focus:outline-none bg-white font-mono"
                              value={loanMaxAmount}
                              onChange={(e) => setLoanMaxAmount(e.target.value)}
                              required
                            />
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[10px] sm:text-xs font-bold text-slate-600 mb-1">ঋণের মেয়াদ / কিস্তি সংখ্যা</label>
                          <input 
                            type="text"
                            placeholder="যেমন: ৪৫ সপ্তাহ"
                            className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-medium focus:ring-1 focus:ring-indigo-500 focus:outline-none bg-white font-sans"
                            value={loanDuration}
                            onChange={(e) => setLoanDuration(e.target.value)}
                            required
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] sm:text-xs font-bold text-slate-600 mb-1">গ্রেস পিরিয়ড (Grace Period)</label>
                          <input 
                            type="text"
                            placeholder="যেমন: ২ সপ্তাহ"
                            className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-medium focus:ring-1 focus:ring-indigo-500 focus:outline-none bg-white font-sans"
                            value={loanGracePeriod}
                            onChange={(e) => setLoanGracePeriod(e.target.value)}
                            required
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[10px] sm:text-xs font-bold text-slate-600 mb-1">বিলম্ব জরিমানা (Late Fee)</label>
                          <div className="relative bg-white">
                            <span className="absolute left-3 top-1.5 text-xs text-slate-400 font-bold font-mono">৳</span>
                            <input 
                              type="text"
                              className="w-full pl-7 pr-3 py-1.5 border border-slate-250 rounded-lg text-xs font-bold focus:ring-1 focus:ring-blue-500 focus:outline-none bg-white font-mono"
                              value={loanLateFee}
                              onChange={(e) => setLoanLateFee(e.target.value)}
                              required
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-[10px] sm:text-xs font-bold text-slate-600 mb-1">ঋণ প্রসেসিং বা ফরম ফি</label>
                          <div className="relative bg-white">
                            <span className="absolute left-3 top-1.5 text-xs text-slate-400 font-bold font-mono">৳</span>
                            <input 
                              type="text"
                              className="w-full pl-7 pr-3 py-1.5 border border-slate-200 rounded-lg text-xs font-bold focus:ring-1 focus:ring-blue-500 focus:outline-none bg-white font-mono"
                              value={loanProcessingFee}
                              onChange={(e) => setLoanProcessingFee(e.target.value)}
                              required
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* --- SECTION 3: INSTALLMENT CONFIGURATION --- */}
                  <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
                    <h4 className="text-[12px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5 border-b border-slate-100 pb-2.5">
                      <Calendar size={14} className="text-emerald-600" /> ৩. কিস্তি গ্রহণ ও আদায় সময়সূচী সেটিংস
                    </h4>

                    <div className="space-y-4">
                      <div>
                        <label className="block text-[10px] sm:text-xs font-bold text-slate-600 mb-2">সমর্থিত কিস্তির প্রকারভেদ সমূহ</label>
                        <div className="flex flex-wrap gap-4 p-3 bg-slate-50 border border-slate-150 rounded-xl">
                          <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-705 font-sans">
                            <input 
                              type="checkbox"
                              className="w-4 h-4 text-indigo-650 text-blue-600 focus:ring-0 border-slate-300 rounded cursor-pointer"
                              checked={instWeeklyActive}
                              onChange={(e) => setInstWeeklyActive(e.target.checked)}
                            />
                            <span>সাপ্তাহিক কিস্তি</span>
                          </label>

                          <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-705 font-sans">
                            <input 
                              type="checkbox"
                              className="w-4 h-4 text-indigo-655 text-blue-600 focus:ring-0 border-slate-300 rounded cursor-pointer"
                              checked={instMonthlyActive}
                              onChange={(e) => setInstMonthlyActive(e.target.checked)}
                            />
                            <span>মাসিক কিস্তি</span>
                          </label>

                          <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-705 font-sans">
                            <input 
                              type="checkbox"
                              className="w-4 h-4 text-indigo-650 text-blue-600 focus:ring-0 border-slate-300 rounded cursor-pointer"
                              checked={instTermActive}
                              onChange={(e) => setInstTermActive(e.target.checked)}
                            />
                            <span>মেয়াদি কিস্তি</span>
                          </label>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3 font-sans">
                        <div>
                          <label className="block text-[10px] sm:text-xs font-bold text-slate-600 mb-1">ডিফল্ট কিস্তির দিন</label>
                          <select 
                            className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-medium focus:ring-1 focus:ring-indigo-500 focus:outline-none bg-white"
                            value={instCollectionDay}
                            onChange={(e) => setInstCollectionDay(e.target.value)}
                          >
                            <option value="সমিতির বার ভিত্তিক">সমিতির বার ভিত্তিক (বার ভিত্তিক কিস্তি)</option>
                            <option value="রবিবার">রবিবার (Sunday)</option>
                            <option value="সোমবার">সোমবার (Monday)</option>
                            <option value="মঙ্গলবার">মঙ্গলবার (Tuesday)</option>
                            <option value="বুধবার">বুধবার (Wednesday)</option>
                            <option value="বৃহস্পতিবার">বৃহস্পতিবার (Thursday)</option>
                            <option value="শুক্রবার">শুক্রবার (Friday)</option>
                            <option value="শনিবার">শনিবার (Saturday)</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-[10px] sm:text-xs font-bold text-slate-600 mb-1">কিস্তি দশমিক রাউন্ডিং নিয়ম</label>
                          <select 
                            className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-medium focus:ring-1 focus:ring-indigo-500 focus:outline-none bg-white"
                            value={instRoundingRule}
                            onChange={(e) => setInstRoundingRule(e.target.value)}
                          >
                            <option value="Nearest 1">নিকটবর্তী ৳১ (যেমন: ৳৪৫১.৪ → ৳৪৫১)</option>
                            <option value="Nearest 5">নিকটবর্তী ৳৫ (যেমন: ৳৪৫৩ → ৳৪৫৫)</option>
                            <option value="Nearest 10">নিকটবর্তী ৳১০ (যেমন: ৳৪৫২ → ৳৪৫০)</option>
                            <option value="None">কোনো রাউন্ডিং নেই</option>
                          </select>
                        </div>
                      </div>

                      <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 flex justify-between items-center text-xs">
                        <div>
                          <p className="font-bold text-slate-700/95">স্বয়ংক্রিয় (Auto) কিস্তি জেনারেশন</p>
                          <p className="text-[10px] text-slate-400 mt-0.5">মঞ্জুরির পর অটো পরিশোধ সময়সূচী জেনারেট করুন।</p>
                        </div>
                        <input 
                          type="checkbox"
                          className="w-4 h-4 text-indigo-650 focus:ring-0 border-slate-300 rounded cursor-pointer"
                          checked={instAutoGeneration}
                          onChange={(e) => setInstAutoGeneration(e.target.checked)}
                        />
                      </div>
                    </div>
                  </div>

                  {/* --- LOAN INSURANCE & MANDATORY SAVINGS POLICY --- */}
                  <div className="bg-amber-50/50 p-5 rounded-2xl border border-amber-200 space-y-4">
                    <h4 className="text-[12px] font-bold uppercase tracking-wider text-amber-900 border-b border-amber-100 pb-2.5 flex items-center gap-1.5">
                      <Shield size={14} className="text-amber-700" /> ৪. ঋণবীমা তহবিল ও বাধ্যতামূলক সঞ্চয় পলিসি
                    </h4>
                    
                    <div className="space-y-4 font-sans">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-605 mb-1 text-amber-950">ঋণবীমা তহবিল যৌথ নির্ধারণ (% হিসেবে)</label>
                          <div className="relative bg-white font-mono">
                            <span className="absolute right-3 top-1.5 text-xs text-slate-400 font-bold">%</span>
                            <input 
                              type="text"
                              className="w-full pl-3 pr-8 py-1.5 border border-slate-200 rounded-lg text-xs font-bold bg-white"
                              value={loanInsurancePercent}
                              onChange={(e) => setLoanInsurancePercent(e.target.value)}
                              placeholder="যেমন: ১০"
                              required
                            />
                          </div>
                          <span className="text-[9px] text-amber-800 mt-1 block font-sans">যৌথ আসলের ওপর হিসাব করে নগদ প্রিমিয়াম হিসেবে আদায় হবে।</span>
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-slate-605 mb-1 text-amber-950">বীমার ধরণ</label>
                          <select 
                            className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-bold bg-white"
                            value={loanInsuranceType}
                            onChange={(e) => setLoanInsuranceType(e.target.value)}
                          >
                            <option value="যৌথ বীমা">যৌথ বীমা</option>
                            <option value="একক বীমা">একক বীমা</option>
                          </select>
                          <span className="text-[9px] text-amber-800 mt-1 block">যৌথ/একক বীমা পলিসি ধরণ</span>
                        </div>
                      </div>

                      <div className="border-t border-amber-200/60 pt-3">
                        <label className="block text-[10px] font-bold text-slate-605 mb-1 text-amber-950">বাধ্যতামূলক সঞ্চয় (ঋণের আসলের %)</label>
                        <div className="relative bg-white font-mono">
                          <span className="absolute right-3 top-1.5 text-xs text-slate-400 font-bold">%</span>
                          <input 
                            type="text"
                            className="w-full pl-3 pr-8 py-1.5 border border-slate-200 rounded-lg text-xs font-bold bg-white"
                            value={mandatorySavingsPercent}
                            onChange={(e) => setMandatorySavingsPercent(e.target.value)}
                            placeholder="যেমন: ৫"
                            required
                          />
                        </div>
                        <span className="text-[9px] text-amber-800 mt-1 block font-sans">যা ঋণ চলাকালীন বাধ্যতামূলকভাবে সদস্যের জমা থাকতে হবে</span>
                      </div>
                    </div>
                  </div>

                  {/* --- LLP (LOAN LOSS PROVISION) SETTINGS --- */}
                  <div className="bg-indigo-50/40 p-5 rounded-2xl border border-indigo-200 space-y-4">
                    <h4 className="text-[12px] font-bold uppercase tracking-wider text-indigo-900 border-b border-indigo-100 pb-2.5 flex items-center gap-1.5 select-none">
                      <Shield size={14} className="text-indigo-750" /> ৫. খেলাপি ঋণ সঞ্চিতি পলিসি (Loan Loss Provision - LLP Settings)
                    </h4>
                    
                    <div className="space-y-4 font-sans text-xs">
                      <p className="text-slate-600 text-[10px] leading-relaxed">
                        ঋণের প্রকারভেদ এবং বকেয়া মেয়াদের শ্রেণীকরণ অনুযায়ী খেলাপি ঋণের বিপরীতে সঞ্চিতি তহবিল (LLPF) সংরক্ষণের জন্য বার্ষিক শতকরা হার নিচে কনফিগার করুন।
                      </p>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-700 mb-1">১. নিয়মিত ঋণ সঞ্চিতি হার (Standard Provision Rate)</label>
                          <div className="relative bg-white font-mono">
                            <span className="absolute right-3 top-1.5 text-xs text-slate-400 font-bold">%</span>
                            <input 
                              type="text"
                              className="w-full pl-3 pr-8 py-1.5 border border-slate-200 rounded-lg text-xs font-bold bg-white text-slate-800"
                              value={llpStandard}
                              onChange={(e) => setLlpStandard(e.target.value)}
                              placeholder="যেমন: ১"
                              required
                            />
                          </div>
                          <span className="text-[9px] text-slate-450 mt-1 block">বকেয়াহীন নিয়মিত ঋণের বাধ্যতামূলক সঞ্চিতি হার</span>
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-slate-700 mb-1">২. সাব-স্ট্যান্ডার্ড ঋণ সঞ্চিতি হার (Sub-Standard Rate)</label>
                          <div className="relative bg-white font-mono">
                            <span className="absolute right-3 top-1.5 text-xs text-slate-400 font-bold">%</span>
                            <input 
                              type="text"
                              className="w-full pl-3 pr-8 py-1.5 border border-slate-200 rounded-lg text-xs font-bold bg-white text-slate-800"
                              value={llpSubStandard}
                              onChange={(e) => setLlpSubStandard(e.target.value)}
                              placeholder="যেমন: ৫"
                              required
                            />
                          </div>
                          <span className="text-[9px] text-slate-450 mt-1 block">১ থেকে ৯০ দিন পর্যন্ত বকেয়া ঋণের সঞ্চিতি হার</span>
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-slate-700 mb-1">৩. সন্দেহজনক ঋণ সঞ্চিতি হার (Doubtful Provision Rate)</label>
                          <div className="relative bg-white font-mono">
                            <span className="absolute right-3 top-1.5 text-xs text-slate-400 font-bold">%</span>
                            <input 
                              type="text"
                              className="w-full pl-3 pr-8 py-1.5 border border-slate-200 rounded-lg text-xs font-bold bg-white text-slate-800"
                              value={llpDoubtful}
                              onChange={(e) => setLlpDoubtful(e.target.value)}
                              placeholder="যেমন: ৫০"
                              required
                            />
                          </div>
                          <span className="text-[9px] text-slate-450 mt-1 block">৯১ থেকে ৩৬৫ দিন পর্যন্ত বকেয়া ঋণের সঞ্চিতি হার</span>
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-slate-700 mb-1">৪. মন্দ বা কু-ঋণ সঞ্চিতি হার (Bad/Loss Provision Rate)</label>
                          <div className="relative bg-white font-mono">
                            <span className="absolute right-3 top-1.5 text-xs text-slate-400 font-bold">%</span>
                            <input 
                              type="text"
                              className="w-full pl-3 pr-8 py-1.5 border border-slate-200 rounded-lg text-xs font-bold bg-white text-slate-800"
                              value={llpBad}
                              onChange={(e) => setLlpBad(e.target.value)}
                              placeholder="যেমন: ১০০"
                              required
                            />
                          </div>
                          <span className="text-[9px] text-slate-450 mt-1 block">৩৬৫ দিনের অধিক বকেয়া ঋণের সঞ্চিতি হার (১০০% বাঞ্চনীয়)</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* --- POLICY EFFECTIVE DATE SECTION --- */}
                  <div className="bg-amber-50/50 p-5 rounded-2xl border-2 border-amber-200 space-y-3">
                    <h5 className="text-[12px] font-bold uppercase tracking-wider text-amber-800 flex items-center gap-1.5 border-b border-amber-200 pb-2.5">
                      <Calendar size={14} className="text-amber-700" /> পলিসি কার্যকারিতার সময়সীমা (Policy Timeline Settings)
                    </h5>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                      <div>
                        <label className="block text-xs font-bold text-amber-900 mb-1">কার্যকরের তারিখ *</label>
                        <input 
                          type="date"
                          className="w-full px-3 py-2 border border-amber-300 rounded-lg text-xs font-bold font-mono focus:ring-1 focus:ring-amber-500 focus:outline-none bg-white text-slate-800"
                          value={policyEffectiveDate}
                          onChange={(e) => setPolicyEffectiveDate(e.target.value)}
                          required
                        />
                        <p className="text-[10px] text-amber-705 mt-1 font-sans">আদায় হার এবং নীতি মাঠ পর্যায়ে সচল অবস্থায় কার্যকর হওয়ার তারিখ।</p>
                      </div>
                      <div className="p-3 bg-white/70 border border-amber-100 rounded-xl">
                        <p className="text-[10px] text-slate-600 leading-relaxed font-sans">
                          আজকের কর্মদিবস যদি এই <strong>কার্যকরের তারিখের</strong> সমান বা তার চেয়ে বেশি হয়, তবেই নতুন সেটিংস কার্যকর হবে। অন্যথায় পূর্ববর্তী সেটিংস বলবৎ থাকবে।
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end pt-3 border-t border-slate-100 gap-3">
                    <button 
                      type="submit"
                      className="flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-indigo-500/10 cursor-pointer border-0"
                    >
                      <Save size={14} />
                      <span>লোন পলিসি ও স্কিম ক্যাটাগরি সংরক্ষণ করুন</span>
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* TAB 3: COOPERATIVE SHARE CAPITAL & DIVIDEND POLICY PANEL */}
          {configSubTab === 'share-policy' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className="border-b border-slate-100 pb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                  <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                    <Coins className="text-emerald-600" size={20} />
                    <span>সমবায় শেয়ার মূলধন ও লভ্যাংশ পলিসি কনফিগারেশন</span>
                  </h3>
                  <p className="text-xs text-slate-400">
                    আপনার সমবায় সমিতির প্রতি শেয়ারের মূল্য (যেমন: ১০ টাকা), ভর্তিতে ন্যূনতম শেয়ার সংখ্যা, লভ্যাংশ বণ্টন নীতি ও প্রত্যাহারের নিয়মাবলী নির্ধারণ করুন।
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-xs font-bold flex items-center gap-1.5">
                    <CheckCircle size={13} className="text-emerald-600" />
                    <span>বর্তমান দর: ৳{sharePriceConfig} / শেয়ার</span>
                  </span>
                </div>
              </div>

              {configSuccessMsg && (
                <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-bold animate-in fade-in slide-in-from-top-2 duration-200 flex items-center gap-2">
                  <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping"></div>
                  <span>{configSuccessMsg}</span>
                </div>
              )}

              <form onSubmit={handleSaveShareConfig} className="space-y-6">
                <div className="grid gap-6 md:grid-cols-2">
                  
                  {/* Card 1: Share Face Value and Purchase Limits */}
                  <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
                    <h4 className="text-[12px] font-bold uppercase tracking-wider text-emerald-900 flex items-center gap-1.5 border-b border-slate-100 pb-2.5">
                      <Coins size={14} className="text-emerald-600" /> ১. শেয়ার মূল্য ও ক্রয় সীমা সেটিংস
                    </h4>

                    <div className="space-y-4">
                      {/* Share Price */}
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="block text-xs font-bold text-slate-700">
                            প্রতি শেয়ারের অভিহিত মূল্য (Share Face Value) *
                          </label>
                          <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                            বর্তমান দর: {sharePriceConfig} টাকা
                          </span>
                        </div>
                        <div className="relative">
                          <span className="absolute left-3 top-2 text-sm text-slate-400 font-bold font-mono">৳</span>
                          <input 
                            type="text"
                            className="w-full pl-8 pr-3 py-2 border-2 border-emerald-300 rounded-xl text-sm font-bold text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-emerald-50/20"
                            value={sharePriceConfig}
                            onChange={(e) => setSharePriceConfig(e.target.value)}
                            placeholder="১০"
                            required
                          />
                        </div>
                        
                        {/* Quick Presets */}
                        <div className="flex items-center gap-2 mt-2">
                          <span className="text-[10px] text-slate-400 font-bold">দ্রুত সেট করুন:</span>
                          {[
                            { label: '১০ টাকা', val: '১০' },
                            { label: '২০ টাকা', val: '২০' },
                            { label: '৫০ টাকা', val: '৫০' },
                            { label: '১০০ টাকা', val: '১০০' }
                          ].map((item) => (
                            <button
                              key={item.val}
                              type="button"
                              onClick={() => setSharePriceConfig(item.val)}
                              className={`px-2 py-0.5 rounded text-[10px] font-bold border transition cursor-pointer ${
                                sharePriceConfig === item.val
                                  ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                                  : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-emerald-50 hover:text-emerald-700'
                              }`}
                            >
                              {item.label}
                            </button>
                          ))}
                        </div>
                        <span className="text-[10px] text-slate-500 mt-1.5 block leading-relaxed">
                          💡 নতুন সদস্য ভর্তি হওয়ার সময় এবং শেয়ার রেজিস্টারে স্বয়ংক্রিয়ভাবে প্রতি শেয়ারের এই দর কার্যকরী হবে।
                        </span>
                      </div>

                      {/* Minimum Shares on Admission */}
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          সদস্য ভর্তির সময় ন্যূনতম শেয়ার সংখ্যা *
                        </label>
                        <div className="relative">
                          <input 
                            type="text"
                            className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:ring-1 focus:ring-emerald-500 focus:outline-none bg-white"
                            value={minShareCountConfig}
                            onChange={(e) => setMinShareCountConfig(e.target.value)}
                            placeholder="১"
                            required
                          />
                        </div>
                        <span className="text-[10px] text-slate-400 mt-1 block">
                          সমিতিতে সদস্যপদ গ্রহণের সময় ন্যূনতম ১টি শেয়ার ক্রয় বাধ্যতামূলক (মোট প্রাথমিক শেয়ার জমা: ৳{((Number(minShareCountConfig) || 1) * (Number(sharePriceConfig) || 10))})।
                        </span>
                      </div>

                      {/* Maximum Share Limit */}
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          একক সদস্যের সর্বোচ্চ শেয়ার ধারণ সীমা (টি)
                        </label>
                        <div className="relative">
                          <input 
                            type="text"
                            className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:ring-1 focus:ring-emerald-500 focus:outline-none bg-white"
                            value={maxShareCountConfig}
                            onChange={(e) => setMaxShareCountConfig(e.target.value)}
                            placeholder="১০০"
                          />
                        </div>
                        <span className="text-[10px] text-slate-400 mt-1 block">
                          সমবায় আইন মোতাবেক কোনো একক সদস্য মোট মূলধনের ২০% বা নির্দিষ্ট সংখ্যার অধিক শেয়ার কিনতে পারবেন না।
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Card 2: Dividend Distribution and Surrender Policy */}
                  <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
                    <h4 className="text-[12px] font-bold uppercase tracking-wider text-emerald-900 flex items-center gap-1.5 border-b border-slate-100 pb-2.5">
                      <Shield size={14} className="text-emerald-600" /> ২. লভ্যাংশ বণ্টন ও প্রত্যাহার নীতি
                    </h4>

                    <div className="space-y-4">
                      {/* Dividend Rate */}
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          বাৎসরিক / মাসিক লভ্যাংশের প্রাক্কলিত হার (%) *
                        </label>
                        <div className="relative">
                          <input 
                            type="text"
                            className="w-full pl-3 pr-8 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:ring-1 focus:ring-emerald-500 focus:outline-none bg-white"
                            value={dividendRateConfig}
                            onChange={(e) => setDividendRateConfig(e.target.value)}
                            placeholder="১০"
                            required
                          />
                          <span className="absolute right-3 top-2 text-xs text-slate-400 font-bold">%</span>
                        </div>
                        <span className="text-[10px] text-slate-400 mt-1 block">
                          অর্থবছর শেষে অর্জিত নিট মুনাফা থেকে সাধারণ বার্ষিক সভায় (AGM) অনুমোদিত এই শতকরা হারে শেয়ার লভ্যাংশ বণ্টন হবে।
                        </span>
                      </div>

                      {/* Dividend Payout Method */}
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          লভ্যাংশ ক্রেডিট / স্থানান্তরের মাধ্যম *
                        </label>
                        <select 
                          className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:ring-1 focus:ring-emerald-500 focus:outline-none bg-white"
                          value={dividendPayoutMethodConfig}
                          onChange={(e) => setDividendPayoutMethodConfig(e.target.value)}
                        >
                          <option value="সরাসরি সাধারণ সঞ্চয়ে (GS) জমা">সরাসরি সাধারণ সঞ্চয়ে (GS) জমা (অটো ডিপোজিট)</option>
                          <option value="নগদ ভাউচারে (Cash Voucher) উত্তোলন">নগদ ভাউচারে (Cash Voucher) সরাসরি উত্তোলন</option>
                          <option value="অতিরিক্ত শেয়ারে পুনঃবিনিয়োগ (Re-invest)">লভ্যাংশ দিয়ে নতুন শেয়ার ক্রয় (পুনঃবিনিয়োগ)</option>
                        </select>
                        <span className="text-[10px] text-slate-400 mt-1 block">
                          লভ্যাংশ ঘোষিত হলে সদস্যের হিসাবে কীভাবে ক্রেডিট হবে তা নির্বাচন করুন।
                        </span>
                      </div>

                      {/* Share Surrender & Refund Policy */}
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          শেয়ার ফেরত / প্রত্যাহার নীতি (Share Refund Rule) *
                        </label>
                        <select 
                          className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:ring-1 focus:ring-emerald-500 focus:outline-none bg-white"
                          value={shareRefundPolicyConfig}
                          onChange={(e) => setShareRefundPolicyConfig(e.target.value)}
                        >
                          <option value="সদস্যপদ অবসান বা পদত্যাগে ফেরতযোগ্য">সদস্যপদ অবসান বা পদত্যাগে সম্পূর্ণ ফেরতযোগ্য</option>
                          <option value="কমপক্ষে ১ বছর নিয়মিত সদস্য থাকার পর ফেরতযোগ্য">কমপক্ষে ১ বছর নিয়মিত সদস্য থাকার পর ফেরতযোগ্য</option>
                          <option value="ম্যানেজিং কমিটির অনুমোদন সাপেক্ষে যেকোনো সময় প্রত্যাহারযোগ্য">ম্যানেজিং কমিটির অনুমোদন সাপেক্ষে যেকোনো সময় প্রত্যাহারযোগ্য</option>
                        </select>
                        <span className="text-[10px] text-slate-400 mt-1 block">
                          সদস্যের সদস্যপদ প্রত্যাহারকালে শেয়ারের জমাকৃত মূলধন ফেরত দেওয়ার নিয়ম।
                        </span>
                      </div>
                    </div>
                  </div>

                </div>

                {/* Card 3: Live Calculation Preview */}
                <div className="bg-emerald-50/70 border border-emerald-200 rounded-2xl p-5 space-y-3">
                  <div className="flex items-center justify-between border-b border-emerald-200/80 pb-2">
                    <h5 className="text-xs font-extrabold text-emerald-950 flex items-center gap-1.5">
                      <CheckCircle size={14} className="text-emerald-600" />
                      বর্তমান শেয়ার নীতি লাইভ প্রাক্কলন (Live Calculation Simulation)
                    </h5>
                    <span className="text-[10px] font-bold text-emerald-700 bg-white px-2 py-0.5 rounded-full border border-emerald-200 shadow-3xs">
                      প্রতি শেয়ার = ৳{Number(sharePriceConfig) || 10}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2.5 pt-1">
                    <div className="bg-white p-3 rounded-xl border border-emerald-100 shadow-3xs text-center">
                      <span className="text-[9px] text-slate-400 font-bold block uppercase">১টি শেয়ার</span>
                      <span className="text-sm font-black text-emerald-700 font-mono">৳{Number(sharePriceConfig) || 10}</span>
                    </div>
                    <div className="bg-white p-3 rounded-xl border border-emerald-100 shadow-3xs text-center">
                      <span className="text-[9px] text-slate-400 font-bold block uppercase">ভর্তিতে জমা</span>
                      <span className="text-sm font-black text-emerald-700 font-mono">৳{((Number(minShareCountConfig) || 1) * (Number(sharePriceConfig) || 10)).toLocaleString('en-IN')}</span>
                    </div>
                    <div className="bg-white p-3 rounded-xl border border-emerald-100 shadow-3xs text-center">
                      <span className="text-[9px] text-slate-400 font-bold block uppercase">১০টি শেয়ার</span>
                      <span className="text-sm font-black text-emerald-700 font-mono">৳{(10 * (Number(sharePriceConfig) || 10)).toLocaleString('en-IN')}</span>
                    </div>
                    <div className="bg-white p-3 rounded-xl border border-emerald-100 shadow-3xs text-center">
                      <span className="text-[9px] text-slate-400 font-bold block uppercase">৫০টি শেয়ার</span>
                      <span className="text-sm font-black text-emerald-700 font-mono">৳{(50 * (Number(sharePriceConfig) || 10)).toLocaleString('en-IN')}</span>
                    </div>
                    <div className="bg-white p-3 rounded-xl border border-emerald-100 shadow-3xs text-center">
                      <span className="text-[9px] text-slate-400 font-bold block uppercase">১০০টি শেয়ার</span>
                      <span className="text-sm font-black text-emerald-700 font-mono">৳{(100 * (Number(sharePriceConfig) || 10)).toLocaleString('en-IN')}</span>
                    </div>
                    <div className="bg-white p-3 rounded-xl border border-emerald-100 shadow-3xs text-center">
                      <span className="text-[9px] text-slate-400 font-bold block uppercase">১০০ শেয়ারে লভ্যাংশ</span>
                      <span className="text-sm font-black text-indigo-700 font-mono">৳{Math.round(((100 * (Number(sharePriceConfig) || 10)) * (Number(dividendRateConfig) || 10)) / 100).toLocaleString('en-IN')}</span>
                    </div>
                  </div>
                </div>

                {/* Submit Action */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between pt-3 border-t border-slate-100 gap-3">
                  <span className="text-xs text-slate-500 font-medium">
                    * এই সেটিং সংরক্ষণের সাথে সাথে সমগ্র সংস্থার সদস্য ভর্তি ফর্ম ও শেয়ার রেজিস্টারে সক্রিয় হবে।
                  </span>
                  <div className="flex items-center gap-2">
                    <button 
                      type="submit"
                      className="flex items-center justify-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-emerald-500/10 cursor-pointer border-0 w-full sm:w-auto"
                    >
                      <Save size={14} />
                      <span>শেয়ার পলিসি কনফিগারেশন সংরক্ষণ করুন</span>
                    </button>
                  </div>
                </div>
              </form>
            </div>
          )}
        </div>
      )}

          {/* VIEW 4: Reports / রিপোর্ট প্যানেল */}
          {activeTab === 'reports' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              
              {/* Back button */}
              <div className="pb-1">
                <button
                  onClick={() => setActiveTab('home')}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold hover:text-slate-900 rounded-lg text-[10.5px] border border-slate-200 cursor-pointer transition shadow-3xs"
                >
                  <ChevronLeft size={13} />
                  <span>← প্রধান এডমিন কন্ট্রোলে ফিরুন</span>
                </button>
              </div>
              
              {/* Report Header Card with Dropdown and Print Actions */}
              <div className="bg-indigo-900 bg-gradient-to-r from-blue-700 via-indigo-800 to-indigo-900 rounded-2xl p-5 text-white shadow-lg flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                  <h3 className="text-lg font-extrabold flex items-center gap-2 tracking-tight">
                    <FileText className="text-emerald-350" size={22} />
                    <span>তানজিল প্রতিবেদন ও রিপোর্ট প্যানেল</span>
                  </h3>
                  <p className="text-[11px] text-indigo-100 mt-1">
                    আজকের অফিসিয়াল কর্মদিবসের সকল আর্থিক স্কিম, শাখা বিবরণী, কর্মী ডাটাবেজ এবং নীতিমালা বিবরণী রিপোর্ট ডাউনলোড বা প্রিন্ট করুন।
                  </p>
                </div>
                <div className="bg-white/10 px-3.5 py-1.5 rounded-xl border border-white/15 text-right shrink-0">
                  <span className="text-[9px] text-white/70 uppercase tracking-widest font-bold block">অফিসিয়াল কর্মদিবস:</span>
                  <span className="font-mono text-xs font-black text-amber-300">{workingDay}</span>
                </div>
              </div>

              {/* DROPDOWN SELECTOR - User Request Specific */}
              <div className="bg-slate-50 p-4 border border-slate-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-0.5">
                  <label htmlFor="report-dropdown" className="block text-[11px] font-black text-slate-550 uppercase tracking-widest">
                    রিপোর্ট ক্যাটাগরি ড্রপডাউন (Select Active Report Sheet)
                  </label>
                  <p className="text-[10px] text-slate-400 font-medium">নিচের ড্রপডাউন থেকে আপনার পছন্দসই রিপোর্ট পৃষ্ঠা নির্বাচন করুন</p>
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <select
                    id="report-dropdown"
                    value={selectedReportType}
                    onChange={(e) => setSelectedReportType(e.target.value)}
                    className="w-full sm:w-64 px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-700 min-w-[240px] focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-xs cursor-pointer"
                  >
                    <option value="loan_calc">১. ঋণের কিস্তি হিসাব ও বিতরণ এস্টিমেটর (Loan Calculator)</option>
                    <option value="branches">২. রেজিস্টার্ড শাখা অফিস বিবরণী রিপোর্ট (Branches)</option>
                    <option value="staff">৩. কর্মকর্তা ও কর্মী বিস্তারিত তালিকা রিপোর্ট (Staff List)</option>
                    <option value="holidays">৪. ঘোষিত ছুটির ক্যালেন্ডার বিবরণী (Holidays)</option>
                    <option value="policies">৫. প্রাতিষ্ঠানিক ক্ষুদ্রঋণ ও সঞ্চয় নীতিমালা বিবরণী</option>
                    <option value="operational_reports">৬. তারিখ ভিত্তিক সমন্বিত লেনদেন রিপোর্ট (Operational Reports)</option>
                  </select>
                  <button
                    onClick={() => {
                      window.print();
                    }}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs rounded-xl shadow-xs transition-all flex items-center gap-1 cursor-pointer whitespace-nowrap"
                  >
                    <span>প্রিন্ট</span>
                  </button>
                </div>
              </div>

              {/* Depending on report type, show specific section */}
              {selectedReportType === 'operational_reports' ? (
                <UnifiedReportsPanel
                  org={org}
                  workingDay={workingDay}
                  onBack={() => setActiveTab('home')}
                />
              ) : selectedReportType === 'loan_calc' ? (
                /* RENDER EXISTING CALCULATOR SECTION */
                <div className="space-y-6">
                  <div className="border-b border-slate-100 pb-3 flex justify-between items-center">
                    <div>
                      <h4 className="font-extrabold text-slate-800 text-sm">১. মেম্বারশিপ ইন্টারেক্টিভ ক্যাস ক্যালকুলেশন (Disbursement Sandbox)</h4>
                      <p className="text-[10px] text-slate-400">বীমা পদ্ধতি, ক্যালকুলেশন পলিসি এবং এস্টিমেটে বিতরণ প্রক্রিয়া পর্যবেক্ষণ করুন</p>
                    </div>
                    {isDisbursedSuccess && (
                      <button 
                        onClick={() => {
                          setIsDisbursedSuccess(false);
                          setLastDisbursedSummary(null);
                        }}
                        className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-bold rounded-lg transition-colors cursor-pointer"
                      >
                        নতুন হিসাব করুন
                      </button>
                    )}
                  </div>

                  {isDisbursedSuccess && lastDisbursedSummary ? (
                /* Success Voucher Receipt Panel */
                <div className="bg-emerald-50/40 border border-emerald-200 rounded-2xl p-6 space-y-5 animate-in zoom-in-95 duration-200">
                  <div className="flex justify-between items-start border-b border-emerald-200/60 pb-4">
                    <div className="flex gap-3">
                      <div className="w-12 h-12 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center font-extrabold text-lg">
                        ✓
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-800 text-sm">ঋণ বিতরণ সফলভাবে সম্পন্ন হয়েছে!</h4>
                        <p className="text-xs text-slate-500 font-mono mt-0.5">রসিদ নম্বর: TXN-{lastDisbursedSummary.txnId}</p>
                      </div>
                    </div>
                    <span className="bg-emerald-100 text-emerald-800 text-[10px] px-2.5 py-1 rounded-full font-bold">
                      বিতরণকৃত (Disbursed)
                    </span>
                  </div>

                  <div className="grid gap-5 md:grid-cols-2">
                    <div className="space-y-3 bg-white p-4 rounded-xl border border-emerald-100">
                      <h5 className="text-[11px] font-bold text-emerald-900 border-b border-emerald-50 pb-2">গ্রাহক ও শাখা বিবরণী</h5>
                      <div className="space-y-1.5 text-xs text-slate-600">
                        <p className="flex justify-between"><span className="text-slate-400">সদস্যের নাম:</span> <strong className="text-slate-800">{lastDisbursedSummary.memberName}</strong></p>
                        <p className="flex justify-between"><span className="text-slate-400">সদস্যের লিঙ্গ (Gender):</span> <strong className="text-slate-800">{lastDisbursedSummary.memberGender === 'female' ? 'মহিলা (Female)' : 'পুরুষ (Male)'}</strong></p>
                        <p className="flex justify-between"><span className="text-slate-400">মোবাইল নম্বর:</span> <strong className="font-mono text-slate-800">{lastDisbursedSummary.memberPhone}</strong></p>
                        <p className="flex justify-between"><span className="text-slate-400">বিতরণকারী শাখা:</span> <strong className="text-slate-800">{lastDisbursedSummary.branchName}</strong></p>
                        <p className="flex justify-between"><span className="text-slate-400">বিতরণের তারিখ:</span> <strong className="font-mono text-slate-800">{workingDay}</strong></p>
                      </div>
                    </div>

                    <div className="space-y-3 bg-white p-4 rounded-xl border border-emerald-100">
                      <h5 className="text-[11px] font-bold text-emerald-900 border-b border-emerald-50 pb-2">অর্থ ও কিস্তি বিবরণী</h5>
                      <div className="space-y-1.5 text-xs text-slate-600">
                        <p className="flex justify-between"><span className="text-slate-400">ঋণের আসল (Principal):</span> <strong className="text-slate-800 font-mono">৳{parseFloat(lastDisbursedSummary.principal).toLocaleString('bn-BD')}</strong></p>
                        <p className="flex justify-between"><span className="text-slate-400">মোট ধার্যকৃত সুদ ({lastDisbursedSummary.interestRate}%):</span> <strong className="text-slate-800 font-mono">৳{parseFloat(lastDisbursedSummary.interestAmount).toLocaleString('bn-BD')}</strong></p>
                        <p className="flex justify-between border-t border-slate-100 pt-1.5 font-bold text-slate-800"><span className="text-slate-500">মোট প্রদেয় (Payable):</span> <span className="font-mono text-blue-700">৳{parseFloat(lastDisbursedSummary.totalPayable).toLocaleString('bn-BD')}</span></p>
                        <p className="flex justify-between"><span className="text-slate-400">কিস্তির ধরন ও মেয়াদ:</span> <strong className="text-indigo-700">{lastDisbursedSummary.intervalLabel} ({lastDisbursedSummary.tenureLabel})</strong></p>
                        <p className="flex justify-between"><span className="text-slate-400">মোট কিস্তি সংখ্যা:</span> <strong className="font-mono text-slate-800">{lastDisbursedSummary.installmentCount} টি</strong></p>
                        <p className="flex justify-between text-amber-900 bg-amber-50 p-1.5 rounded font-bold"><span className="text-[11px]">প্রতি কিস্তির পরিমাণ (EMI):</span> <span className="font-mono">৳{parseFloat(lastDisbursedSummary.installmentAmount).toLocaleString('bn-BD')}</span></p>
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="bg-amber-50/50 p-4 rounded-xl border border-amber-100 text-xs space-y-2">
                      <h5 className="text-[11px] font-bold text-amber-900 flex items-center gap-1">
                        <span className="inline-block w-1.5 h-1.5 bg-amber-600 rounded-full"></span>
                        ঋণবীমা তথ্য ও নির্বাচিত পলিসি
                      </h5>
                      <div className="space-y-1.5 text-slate-600">
                        <p className="flex justify-between"><span className="text-slate-500">বীমা পদ্ধতি:</span> <strong>{lastDisbursedSummary.insuranceType}</strong></p>
                        <p className="flex justify-between"><span className="text-slate-500">নির্বাচিত পলিসি ও প্রিমিয়াম:</span> <strong className="text-amber-900">{lastDisbursedSummary.insuranceLabel}</strong></p>
                        <p className="flex justify-between font-bold border-t border-amber-200/60 pt-1"><span className="text-slate-500">প্রিমিয়াম আদায় (নগদ):</span> <span className="text-amber-950 font-mono">৳{parseFloat(lastDisbursedSummary.insurancePremium).toLocaleString('bn-BD')}</span></p>
                      </div>
                    </div>

                    <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100 text-xs space-y-2">
                      <h5 className="text-[11px] font-bold text-blue-900 flex items-center gap-1">
                        <span className="inline-block w-1.5 h-1.5 bg-blue-600 rounded-full"></span>
                        বাধ্যতামূলক সঞ্চয় বিবরণ
                      </h5>
                      <div className="space-y-1.5 text-slate-600">
                        <p className="flex justify-between"><span className="text-slate-500">বাধ্যতামূলক সঞ্চয় শতকরা হার:</span> <strong className="font-mono">{mandatorySavingsPercent}%</strong></p>
                        <p className="flex justify-between font-bold border-t border-blue-200/60 pt-1"><span className="text-slate-500">প্রয়োজনীয় ন্যূনতম সঞ্চয় স্থিতি:</span> <span className="text-blue-950 font-mono">৳{parseFloat(lastDisbursedSummary.mandatorySavings).toLocaleString('bn-BD')}</span></p>
                      </div>
                    </div>
                  </div>

                  {/* Generated Installments list for success audit */}
                  <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
                    <div className="bg-slate-50 px-4 py-2.5 border-b border-slate-200 flex justify-between items-center">
                      <h5 className="font-bold text-slate-700 text-xs">স্বয়ংক্রিয় কিস্তি পরিশোধের সময়সূচী ও আদায় রোডম্যাপ</h5>
                      <span className="text-[10px] text-slate-400 font-mono">প্রথম আদায় আরম্ভ হবে ১ সপ্তাহ/মাস গ্রেস পিরিয়ড পর</span>
                    </div>
                    <div className="max-h-72 overflow-y-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-100 border-b border-slate-200 text-slate-500 text-[10px] font-bold uppercase">
                            <th className="py-2 px-3">কিস্তি নং</th>
                            <th className="py-2 px-3">ঋণ পরিশোধের সম্ভব্য তারিখ</th>
                            <th className="py-2 px-3 text-right">আসল পরিশোধ</th>
                            <th className="py-2 px-3 text-right">সুদ পরিশোধ</th>
                            <th className="py-2 px-3 text-right">কিস্তির পরিমাণ</th>
                            <th className="py-2 px-3 text-right">অবশিষ্ট আসল</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-slate-600 text-xs">
                          {Array.from({ length: lastDisbursedSummary.installmentCount }).map((_, idx) => {
                            const instNo = idx + 1;
                            const instAmt = Math.round(lastDisbursedSummary.installmentAmount);
                            const totalPrin = parseFloat(lastDisbursedSummary.principal);
                            const totalInterest = parseFloat(lastDisbursedSummary.interestAmount);
                            const instCount = lastDisbursedSummary.installmentCount;
                            
                            const principalPerInst = Math.round(totalPrin / instCount);
                            const interestPerInst = instAmt - principalPerInst;
                            const balance = Math.max(0, totalPrin - (principalPerInst * instNo));

                            // Generate date
                            let dateStr = '';
                            if (lastDisbursedSummary.intervalType === 'weekly') {
                              const samityDayNum = 0; // Default to Sunday (0) in admin sandbox, as requested by the user
                              const firstInstDate = new Date(workingDay);
                              firstInstDate.setDate(firstInstDate.getDate() + 14);
                              const currentDayNum = firstInstDate.getDay();
                              const daysToAdd = (samityDayNum - currentDayNum + 7) % 7;
                              firstInstDate.setDate(firstInstDate.getDate() + daysToAdd);
                              
                              const tDate = new Date(firstInstDate);
                              tDate.setDate(tDate.getDate() + (idx * 7));
                              dateStr = tDate.toISOString().split('T')[0];
                            } else {
                              const tDate = new Date(workingDay);
                              const intervalDays = lastDisbursedSummary.intervalType === 'weekly' ? 7 : lastDisbursedSummary.intervalType === 'monthly' ? 30 : lastDisbursedSummary.intervalType === 'term' ? (lastDisbursedSummary.tenureLabel.includes('৩') ? 30 : 30) : 30;
                              tDate.setDate(tDate.getDate() + ((idx + 1) * intervalDays)); // include grace period
                              dateStr = tDate.toISOString().split('T')[0];
                            }

                            return (
                              <tr key={idx} className="hover:bg-slate-50/60 font-medium">
                                <td className="py-2 px-3 text-slate-400 font-mono">#{String(instNo).padStart(2, '0')}</td>
                                <td className="py-2 px-3 font-mono">{dateStr}</td>
                                <td className="py-2 px-3 text-right font-mono text-slate-600">৳{principalPerInst}</td>
                                <td className="py-2 px-3 text-right font-mono text-amber-700">৳{interestPerInst}</td>
                                <td className="py-2 px-3 text-right font-mono text-slate-900 font-bold bg-amber-50/20">৳{instAmt}</td>
                                <td className="py-2 px-3 text-right font-mono text-slate-400">৳{balance}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="flex gap-3 justify-end pt-2">
                    <button 
                      onClick={() => window.print()}
                      className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer"
                    >
                      রসিদ ও সূচী প্রিন্ট করুন
                    </button>
                    <button 
                      onClick={() => {
                        setIsDisbursedSuccess(false);
                        setLastDisbursedSummary(null);
                      }}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer"
                    >
                      আরেকটি ঋণ বিতরণ করুন
                    </button>
                  </div>
                </div>
              ) : (
                /* Primary Interactive Disbursement & Dynamic Calculator Sandbox Form */
                <div className="grid gap-6 md:grid-cols-12 items-start">
                  
                  {/* INPUT CONFIGURATOR - col-span-7 */}
                  <div className="md:col-span-7 space-y-4">
                    <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
                      
                      <div className="flex items-center gap-2 border-b border-slate-100 pb-2.5">
                        <Users size={16} className="text-blue-600" />
                        <h4 className="font-bold text-slate-800 text-xs sm:text-sm">১. সদস্য ও সাধারণ তথ্য এন্ট্রি</h4>
                      </div>

                      <div className="grid gap-4 sm:grid-cols-2">
                        <div>
                          <label className="block text-xs font-bold text-slate-600 mb-1">সদস্যের নাম *</label>
                          <input 
                            type="text" 
                            className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold focus:ring-1 focus:ring-blue-500 focus:outline-none"
                            value={dispMemberName} 
                            onChange={(e) => setDispMemberName(e.target.value)}
                            placeholder="সদস্যের পূর্ণ নাম দিন"
                            required
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-slate-600 mb-1">সদস্যের লিঙ্গ (Gender) *</label>
                          <div className="flex gap-4 items-center h-9">
                            <label className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-700 cursor-pointer">
                              <input 
                                type="radio" 
                                name="memberGender" 
                                value="female"
                                checked={dispMemberGender === 'female'}
                                onChange={() => {
                                  setDispMemberGender('female');
                                  setDispInsuranceType('যৌথ বীমা');
                                }}
                                className="w-4 h-4 text-blue-600 focus:ring-0 cursor-pointer"
                              />
                              মহিলা (যৌথ বীমা ডিফল্ট)
                            </label>
                            <label className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-700 cursor-pointer">
                              <input 
                                type="radio" 
                                name="memberGender" 
                                value="male"
                                checked={dispMemberGender === 'male'}
                                onChange={() => {
                                  setDispMemberGender('male');
                                  setDispInsuranceType('একক বীমা');
                                }}
                                className="w-4 h-4 text-blue-600 focus:ring-0 cursor-pointer"
                              />
                              পুরুষ (একক বীমা ডিফল্ট)
                            </label>
                          </div>
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-slate-600 mb-1">মোবাইল ফোন নম্বর *</label>
                          <input 
                            type="tel" 
                            className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-bold font-mono focus:ring-1 focus:ring-blue-500 focus:outline-none"
                            value={dispMemberPhone} 
                            onChange={(e) => setDispMemberPhone(e.target.value)}
                            placeholder="01XXXXXXXXX"
                            required
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-slate-600 mb-1">বিতরণকারী শাখা (Branch)</label>
                          <select 
                            className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs bg-white font-semibold focus:ring-1 focus:ring-blue-500 focus:outline-none"
                            value={dispBranchId}
                            onChange={(e) => setDispBranchId(e.target.value)}
                          >
                            <option value="">প্রধান কার্যালয়</option>
                            {branchesList.map(b => (
                              <option key={b.id} value={b.id}>{b.name}</option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-slate-600 mb-1">সুদের বার্ষিক হার (%) *</label>
                          <div className="relative">
                            <span className="absolute right-3 top-1.5 text-xs text-slate-400 font-bold font-mono">%</span>
                            <input 
                              type="number" 
                              className="w-full pl-3 pr-8 py-1.5 border border-slate-200 rounded-lg text-xs font-bold font-mono focus:ring-1 focus:ring-blue-500 focus:outline-none"
                              value={dispInterestRate}
                              onChange={(e) => setDispInterestRate(e.target.value)}
                              required
                            />
                          </div>
                        </div>
                      </div>

                    </div>

                    <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
                      
                      <div className="flex items-center gap-2 border-b border-slate-100 pb-2.5">
                        <Sliders size={16} className="text-blue-600" />
                        <h4 className="font-bold text-slate-800 text-xs sm:text-sm">২. কিস্তি প্রকারভেদ ও মেয়াদ সেটিংস</h4>
                      </div>

                      <div className="space-y-4">
                        
                        {/* Installment types selection based on organization capability */}
                        <div>
                          <label className="block text-xs font-bold text-slate-600 mb-1.5">কিস্তির প্রকারভেদ নির্বাচন করুন</label>
                          <div className="grid grid-cols-3 gap-2.5">
                            {instWeeklyActive && (
                              <label className={`flex flex-col items-center justify-center p-3 border-2 rounded-xl cursor-pointer transition text-center space-y-1 ${
                                dispIntervalType === 'weekly' 
                                  ? 'border-blue-600 bg-blue-50/50 text-blue-700' 
                                  : 'border-slate-200 hover:border-slate-350 bg-slate-50 text-slate-600'
                              }`}>
                                <input 
                                  type="radio" 
                                  name="intervalType" 
                                  className="sr-only" 
                                  checked={dispIntervalType === 'weekly'} 
                                  onChange={() => {
                                    setDispIntervalType('weekly');
                                    setDispTenure('1.0');
                                  }} 
                                />
                                <span className="font-bold text-xs">সাপ্তাহিক কিস্তি</span>
                                <span className="text-[9px] text-slate-400">১ বছর থেকে ২ বছর মেয়াদ</span>
                              </label>
                            )}

                            {instMonthlyActive && (
                              <label className={`flex flex-col items-center justify-center p-3 border-2 rounded-xl cursor-pointer transition text-center space-y-1 ${
                                dispIntervalType === 'monthly' 
                                  ? 'border-blue-600 bg-blue-50/50 text-blue-700' 
                                  : 'border-slate-200 hover:border-slate-350 bg-slate-50 text-slate-600'
                              }`}>
                                <input 
                                  type="radio" 
                                  name="intervalType" 
                                  className="sr-only" 
                                  checked={dispIntervalType === 'monthly'} 
                                  onChange={() => {
                                    setDispIntervalType('monthly');
                                    setDispTenure('1.0');
                                  }} 
                                />
                                <span className="font-bold text-xs">মাসিক কিস্তি</span>
                                <span className="text-[9px] text-slate-400">১ বছর থেকে ২ বছর মেয়াদ</span>
                              </label>
                            )}

                            {instTermActive && (
                              <label className={`flex flex-col items-center justify-center p-3 border-2 rounded-xl cursor-pointer transition text-center space-y-1 ${
                                dispIntervalType === 'term' 
                                  ? 'border-blue-600 bg-blue-50/50 text-blue-700' 
                                  : 'border-slate-200 hover:border-slate-350 bg-slate-50 text-slate-600'
                              }`}>
                                <input 
                                  type="radio" 
                                  name="intervalType" 
                                  className="sr-only" 
                                  checked={dispIntervalType === 'term'} 
                                  onChange={() => {
                                    setDispIntervalType('term');
                                  }} 
                                />
                                <span className="font-bold text-xs text-indigo-700">মেয়াদি কিস্তি</span>
                                <span className="text-[9px] text-slate-400">৩ মাস থেকে ৬ মাস মেয়াদ</span>
                              </label>
                            )}

                            {!instWeeklyActive && !instMonthlyActive && !instTermActive && (
                              <div className="col-span-3 text-center p-4 bg-amber-50 rounded-xl border border-dashed border-amber-200 text-xs text-amber-800">
                                * কনফিগারেশন প্যানেল থেকে অন্তত যেকোনো একটি কিস্তির প্রকারভেদ (সাপ্তাহিক, মাসিক বা মেয়াদি কিস্তি) অনুমোদন করুন।
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Tenure and automatic installment count calculation */}
                        <div className="grid gap-4 sm:grid-cols-2">
                          {/* 1. If Weekly or Monthly (১ বছর / ১২ মাস, ১.৫ বছর বা ১৮ মাস, ২ বছর বা ২৪ মাস) */}
                          {(dispIntervalType === 'weekly' || dispIntervalType === 'monthly') && (
                            <div>
                              <label className="block text-xs font-bold text-slate-600 mb-1">ঋণের মেয়াদ / কিস্তির সময়সীমা</label>
                              <select 
                                className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs bg-white font-semibold focus:ring-1 focus:ring-blue-500 focus:outline-none"
                                value={dispTenure}
                                onChange={(e) => setDispTenure(e.target.value)}
                              >
                                <option value="1.0">১ বছর বা ১২ মাস</option>
                                <option value="1.5">১.৫ বছর বা ১৮ মাস</option>
                                <option value="2.0">২ বছর বা ২৪ মাস</option>
                              </select>
                            </div>
                          )}

                          {/* 2. If Term (৩ মাস, ৬ মাস) */}
                          {dispIntervalType === 'term' && (
                            <div>
                              <label className="block text-xs font-bold text-slate-600 mb-1">ঋণের মেয়াদ (মেয়াদি কিস্তিতে)</label>
                              <select 
                                className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs bg-white font-semibold focus:ring-1 focus:ring-blue-500 focus:outline-none"
                                value={dispTermTenure}
                                onChange={(e) => setDispTermTenure(e.target.value)}
                              >
                                <option value="3_months">৩ মাস</option>
                                <option value="6_months">৬ মাস</option>
                              </select>
                            </div>
                          )}

                          {/* Dynamic Automated Installment Count box */}
                          <div>
                            <label className="block text-xs font-bold text-slate-600 mb-1">মোট কিস্তির সংখ্যা (স্বয়ংক্রিয় হিসাব)</label>
                            <input 
                              type="text" 
                              className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-bold font-mono bg-slate-50 text-blue-800 cursor-not-allowed border-dashed"
                              readOnly
                              disabled
                              value={
                                dispIntervalType === 'weekly' 
                                  ? (dispTenure === '1.0' ? '৪৫ টি কিস্তি (১ বছর)' : dispTenure === '1.5' ? '৬৮ টি কিস্তি (১.৫ বছর)' : '৯০ টি কিস্তি (২ বছর)')
                                  : dispIntervalType === 'monthly'
                                    ? (dispTenure === '1.0' ? '১২ টি কিস্তি (১ বছর)' : dispTenure === '1.5' ? '১৮ টি কিস্তি (১.৫ বছর)' : '২৪ টি কিস্তি (২ বছর)')
                                    : (dispTermTenure === '3_months' ? '৩ টি কিস্তি (৩ মাস)' : '৬ টি কিস্তি (৬ মাস)')
                              }
                            />
                          </div>
                        </div>

                      </div>

                    </div>

                    {/* INSURANCE POLICY SELECTOR */}
                    <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
                      
                      <div className="flex items-center gap-2 border-b border-slate-100 pb-2.5">
                        <Shield size={16} className="text-amber-600" />
                        <h4 className="font-bold text-slate-800 text-xs sm:text-sm text-slate-850">
                          ৩. ঋণবীমা তহবিল পলিসি নির্বাচন
                        </h4>
                      </div>

                      {/* Interactive toggle for Insurance type right here! */}
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 mb-1.5 uppercase">মনোনীত বীমা পলিসি পদ্ধতি</label>
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => setDispInsuranceType('যৌথ বীমা')}
                            className={`py-2 px-3 text-xs font-bold rounded-xl border transition-all cursor-pointer ${
                              dispInsuranceType === 'যৌথ বীমা'
                                ? 'bg-amber-600 text-white border-amber-600 shadow-sm'
                                : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                            }`}
                          >
                            যৌথ বীমা ({loanInsurancePercent}%)
                          </button>
                          <button
                            type="button"
                            onClick={() => setDispInsuranceType('একক বীমা')}
                            className={`py-2 px-3 text-xs font-bold rounded-xl border transition-all cursor-pointer ${
                              dispInsuranceType === 'একক বীমা'
                                ? 'bg-amber-600 text-white border-amber-600 shadow-sm'
                                : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                            }`}
                          >
                            একক বীমা (০.৫% প্রিমিয়াম)
                          </button>
                        </div>
                      </div>

                      {dispInsuranceType === 'একক বীমা' ? (
                        <div className="space-y-3 bg-amber-50/20 p-4 rounded-xl border border-amber-100">
                          <p className="text-xs text-amber-900 leading-relaxed font-semibold">
                            ⚠️ বর্তমানে <strong>"একক বীমা"</strong> পদ্ধতি নির্বাচিত বা সচল রয়েছে। একক বীমার জন্য আলাদা বীমা পলিসি ড্রপডাউন দেওয়া হলো। পছন্দনীয় একটি পলিসি নির্বাচন করুন:
                          </p>
                          
                          <div>
                            <label className="block text-xs font-bold text-amber-950 mb-1">আলাদা একক বীমা পলিসি সমূহ *</label>
                            <select 
                              className="w-full px-3 py-1.5 border-2 border-amber-200 rounded-lg text-xs bg-white font-extrabold focus:ring-1 focus:ring-amber-500 focus:outline-none"
                              value={dispInsPolicy}
                              onChange={(e) => setDispInsPolicy(e.target.value)}
                            >
                              <option value="policy_a">বীমা পলিসি ক - ০.৫% প্রিমিয়াম (Standard Single)</option>
                              <option value="policy_b">বীমা পলিসি খ - ১.০% প্রিমিয়াম (Silver Premium Single)</option>
                              <option value="policy_c">বীমা পলিসি গ - ১.৫% প্রিমিয়াম (Gold Deluxe Single)</option>
                              <option value="policy_d">বীমা পলিসি ঘ - ২.০% প্রিমিয়াম (Gold Deluxe Double Single)</option>
                            </select>
                            <span className="text-[10px] text-amber-800 block mt-1.5">
                              * ঋন বিতরণের সময় গ্রাহকের সুবিধার্থে আলাদা পলিসি বাছাই করতে পারবেন। নির্বাচিত প্রিমিয়াম আসলের ওপর প্রযোজ্য হবে।
                            </span>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-3 bg-blue-50/20 p-4 rounded-xl border border-blue-100">
                          <p className="text-xs text-slate-600 leading-relaxed">
                            ✓ বর্তমানে <strong>"যৌথ বীমা"</strong> পদ্ধতি নির্বাচিত বা সচল রয়েছে।
                          </p>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <span className="block text-[10px] text-slate-400">বীমার ধরণ:</span>
                              <strong className="text-xs text-slate-800">যৌথ ঋণবীমা</strong>
                            </div>
                            <div>
                              <span className="block text-[10px] text-slate-400">নির্ধারিত প্রিমিয়াম রেট:</span>
                              <strong className="text-xs font-mono text-blue-700 bg-blue-50 px-2 py-0.5 rounded">{loanInsurancePercent}% (আসলের)</strong>
                            </div>
                          </div>
                          <span className="text-[9px] text-slate-400 block border-t border-slate-100/50 pt-1.5">
                            * যৌথ বীমার প্রিমিয়াম শতকরা হার কনফিগারেশন প্যানেলে ৩ নম্বর বিভাগে পরিবর্তনযোগ্য।
                          </span>
                        </div>
                      )}

                    </div>

                  </div>

                  {/* DYNAMIC CALCULATION OUTPUT - col-span-5 */}
                  <div className="md:col-span-5 space-y-4">
                    
                    <div className="bg-slate-900 text-slate-200 p-5 rounded-3xl border border-slate-850 shadow-lg space-y-5">
                      
                      <div className="border-b border-slate-800 pb-3">
                        <span className="text-[10px] font-bold text-blue-400 uppercase tracking-widest block mb-0.5">রিয়াল-টাইম হিসাব এস্টিমেট</span>
                        <h4 className="text-base font-extrabold text-white flex items-center gap-1.5">
                          ৳ ঋণ আসলের পরিমাণ (Principal)
                        </h4>
                        
                        <div className="relative mt-2">
                          <span className="absolute left-3 top-2.5 text-lg font-bold text-slate-400 font-mono">৳</span>
                          <input 
                            type="number" 
                            className="w-full pl-8 pr-3 py-2 bg-slate-800/80 border border-slate-700 text-white rounded-xl text-lg font-extrabold focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
                            value={dispAmount}
                            onChange={(e) => setDispAmount(e.target.value)}
                            min="1000"
                            placeholder="যেমন: ২০০০০"
                            required
                          />
                        </div>
                        <span className="text-[9px] text-slate-400 mt-1.5 block">
                          সীমা: ৳{parseFloat(loanMinAmount).toLocaleString('bn-BD')} থেকে ৳{parseFloat(loanMaxAmount).toLocaleString('bn-BD')}
                        </span>
                      </div>

                      {/* Display calculations list */}
                      {(() => {
                        const amount = Math.abs(parseFloat(dispAmount || '0'));
                        const interestRate = parseFloat(dispInterestRate || '12');
                        
                        // Calculate proportional interest factor
                        let yearsFactor = 1.0;
                        let count = 52;
                        let intervalLabel = 'সাপ্তাহিক';
                        let tenureLabel = '১ বছর';

                        if (dispIntervalType === 'weekly') {
                          intervalLabel = 'সাপ্তাহিক';
                          if (dispTenure === '1.0') {
                            yearsFactor = 1.0;
                            count = 45;
                            tenureLabel = '১ বছর';
                          } else if (dispTenure === '1.5') {
                            yearsFactor = 1.5;
                            count = 68;
                            tenureLabel = '১.৫ বছর';
                          } else {
                            yearsFactor = 2.0;
                            count = 90;
                            tenureLabel = '২ বছর';
                          }
                        } else if (dispIntervalType === 'monthly') {
                          intervalLabel = 'মাসিক';
                          if (dispTenure === '1.0') {
                            yearsFactor = 1.0;
                            count = 12;
                            tenureLabel = '১ বছর বা ১২ মাস';
                          } else if (dispTenure === '1.5') {
                            yearsFactor = 1.5;
                            count = 18;
                            tenureLabel = '১.৫ বছর বা ১৮ মাস';
                          } else {
                            yearsFactor = 2.0;
                            count = 24;
                            tenureLabel = '২ বছর বা ২৪ মাস';
                          }
                        } else if (dispIntervalType === 'term') {
                          intervalLabel = 'মেয়াদি কিস্তি';
                          if (dispTermTenure === '3_months') {
                            yearsFactor = 3 / 12;
                            count = 3;
                            tenureLabel = '৩ মাস মেয়াদ';
                          } else {
                            yearsFactor = 6 / 12;
                            count = 6;
                            tenureLabel = '৬ মাস মেয়াদ';
                          }
                        }

                        const intAmount = amount * (interestRate / 100) * yearsFactor;
                        const totalPayable = amount + intAmount;
                        
                        let roundedEMI = 0;
                        if (dispIntervalType === 'term') {
                            roundedEMI = intAmount / count; // Only service charge
                        } else {
                            const originalEMI = count > 0 ? totalPayable / count : 0;
                            
                            // Rounding rules based on org settings
                            if (instRoundingRule === 'Nearest 10') {
                              roundedEMI = Math.round(originalEMI / 10) * 10;
                            } else if (instRoundingRule === 'Always Up') {
                              roundedEMI = Math.ceil(originalEMI);
                            } else {
                              roundedEMI = Math.round(originalEMI);
                            }
                        }

                        // Insurance Calculation based on User input & Gender defaults (Single = 0.5%, Joint = 10%)
                        let insRate = 10.0;
                        let insLabel = "";
                        if (dispInsuranceType === 'যৌথ বীমা') {
                          const cleanPercent = (loanInsurancePercent || '১০').replace(/[০-৯]/g, d => '০১২৩৪৫৬৭৮৯'.indexOf(d).toString());
                          const parsedRate = parseFloat(cleanPercent);
                          insRate = isNaN(parsedRate) || parsedRate <= 0 ? 10.0 : parsedRate;
                          insLabel = `যৌথ বীমা (${insRate}% প্রিমিয়াম)`;
                        } else {
                          insRate = 0.5;
                          insLabel = `একক বীমা (${insRate}% প্রিমিয়াম)`;
                        }
                        const insPremium = amount * (insRate / 100);

                        // Mandatory Savings
                        const mandatorySavRate = parseFloat(mandatorySavingsPercent || '5');
                        const mandatorySavAmt = amount * (mandatorySavRate / 100);

                        const handleTriggerDisbursement = () => {
                          if (amount <= 0 || isNaN(amount)) {
                            alert('দয়া করে সঠিক ঋণের আসল পরিমাণ প্রদান করুন।');
                            return;
                          }
                          if (amount < parseFloat(loanMinAmount) || amount > parseFloat(loanMaxAmount)) {
                            alert(`ঋণের আসল অবশ্যই সর্বনিম্ন ৳${parseFloat(loanMinAmount).toLocaleString('bn-BD')} এবং সর্বোচ্চ ৳${parseFloat(loanMaxAmount).toLocaleString('bn-BD')} এর মধ্যে হতে হবে।`);
                            return;
                          }

                          const txnId = Math.floor(100000 + Math.random() * 900000);
                          const chosenBranch = branchesList.find(b => b.id === dispBranchId);
                          const disSummaryObj = {
                            txnId,
                            memberName: dispMemberName,
                            memberPhone: dispMemberPhone,
                            memberGender: dispMemberGender,
                            branchName: chosenBranch ? chosenBranch.name : 'প্রধান কার্যালয় / সাধারণ',
                            principal: amount,
                            interestRate,
                            interestAmount: intAmount,
                            totalPayable,
                            installmentCount: count,
                            installmentAmount: roundedEMI,
                            intervalType: dispIntervalType,
                            intervalLabel,
                            tenureLabel,
                            insurancePremium: insPremium,
                            insuranceLabel: insLabel,
                            insuranceType: dispInsuranceType,
                            mandatorySavings: mandatorySavAmt
                          };

                          setLastDisbursedSummary(disSummaryObj);
                          setIsDisbursedSuccess(true);
                        };

                        return (
                          <div className="space-y-4">
                            
                            <div className="space-y-2 bg-slate-800/40 p-4 rounded-2xl border border-slate-800/60 text-xs text-slate-300">
                              <div className="flex justify-between items-center pb-2 border-b border-slate-800/60 font-medium">
                                <span>কিস্তি প্রকারভেদ ও মেয়াদ:</span>
                                <strong className="text-blue-400 font-semibold">{intervalLabel} ({tenureLabel})</strong>
                              </div>

                              <div className="flex justify-between items-center py-1">
                                <span>মোট হিসাবকৃত সুদ ({interestRate}%):</span>
                                <strong className="font-mono text-white">৳{Math.round(intAmount).toLocaleString('bn-BD')}</strong>
                              </div>

                              <div className="flex justify-between items-center py-1">
                                <span>মোট প্রদেয় ঋণ (সুদসহ):</span>
                                <strong className="font-mono text-white">৳{Math.round(totalPayable).toLocaleString('bn-BD')}</strong>
                              </div>

                              <div className="flex justify-between items-center py-1">
                                <span>কিস্তির সংখ্যা:</span>
                                <strong className="font-mono text-white">{count} টি কিস্তি</strong>
                              </div>

                              <div className="flex justify-between items-center py-1.5 border-t border-slate-850 text-slate-400">
                                <span>বীমা প্রিমিয়াম পরিশোধ ({insRate}%):</span>
                                <strong className="font-mono text-amber-400">৳{Math.round(insPremium).toLocaleString('bn-BD')}</strong>
                              </div>

                              <div className="flex justify-between items-center py-1 text-slate-400">
                                <span>বাধ্যতামূলক সঞ্চয় ({mandatorySavRate}%):</span>
                                <strong className="font-mono text-indigo-400">৳{Math.round(mandatorySavAmt).toLocaleString('bn-BD')}</strong>
                              </div>
                            </div>

                            {/* EMI Card Banner */}
                            <div className="bg-amber-500 text-slate-950 p-4 rounded-2xl border border-amber-400 text-center space-y-1">
                              <span className="text-[10px] uppercase font-extrabold tracking-wider opacity-80 block">আদায়যোগ্য প্রতি কিস্তির পরিমাণ</span>
                              <div className="text-2xl font-black font-mono tracking-tight leading-none">
                                ৳{Math.round(roundedEMI).toLocaleString('bn-BD')}
                              </div>
                              <span className="text-[9px] font-bold block opacity-75">
                                (* রাউন্ডিং নিয়ম: {instRoundingRule} অনুযায়ী হিসাবকৃত)
                              </span>
                            </div>

                            {/* Action Button */}
                            <button 
                              type="button"
                              onClick={handleTriggerDisbursement}
                              className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-black text-xs rounded-xl transition shadow-lg shadow-blue-500/20 active:scale-95 cursor-pointer flex items-center justify-center gap-2 uppercase tracking-wider"
                            >
                              <Check size={16} />
                              <span>ঋণ বিতরণ নিশ্চিত করুন (Disburse Loan)</span>
                            </button>

                          </div>
                        );
                      })()}

                    </div>

                  </div>

                </div>
                  )}
                </div>
              ) : (
                /* RENDER ADVANCED PRINTABLE REPORTS */
                <ReportViews
                  selectedReportType={selectedReportType}
                  branchesList={branchesList}
                  staffList={staffList}
                  holidaysList={holidaysList}
                  workingDay={workingDay}
                  orgName={orgName}
                  orgAddress={orgAddress}
                  orgTradeLicense={orgTradeLicense}
                  orgPhone={orgPhone}
                  orgEmail={orgEmail}
                  savingsAdmissionFee={savingsAdmissionFee}
                  savingsWelfareFee={savingsWelfareFee}
                  savingsMinBalance={savingsMinBalance}
                  savProfitGS={savProfitGS}
                  savProfitCBS={savProfitCBS}
                  savProfitLTS={savProfitLTS}
                  savProfitFDR={savProfitFDR}
                  savFdrPayoutType={savFdrPayoutType}
                  loanDefaultInterest={loanDefaultInterest}
                  loanInterestType={loanInterestType}
                  loanMinAmount={loanMinAmount}
                  loanMaxAmount={loanMaxAmount}
                  loanDuration={loanDuration}
                  loanGracePeriod={loanGracePeriod}
                  loanLateFee={loanLateFee}
                  loanProcessingFee={loanProcessingFee}
                  loanInsurancePercent={loanInsurancePercent}
                  loanInsuranceType={loanInsuranceType}
                  mandatorySavingsPercent={mandatorySavingsPercent}
                  instRoundingRule={instRoundingRule}
                />
              )}

            </div>
          )}

          {/* VIEW 5: Holiday Update / holiday_update_panel_placeholder */}
          {activeTab === 'holidays' && (
            <div className="space-y-6 animate-in fade-in duration-100">
              
              {/* Back button */}
              <div className="pb-1">
                <button
                  onClick={() => setActiveTab('home')}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold hover:text-slate-900 rounded-lg text-[10.5px] border border-slate-200 cursor-pointer transition shadow-3xs"
                >
                  <ChevronLeft size={13} />
                  <span>← প্রধান এডমিন কন্ট্রোলে ফিরুন</span>
                </button>
              </div>
              
              {/* Top Bar inside View */}
              <div className="flex justify-between items-center flex-wrap gap-4 border-b border-slate-100 pb-4">
                <div>
                  <h2 className="text-lg font-extrabold text-slate-800 tracking-tight flex items-center gap-2">
                    <Calendar size={20} className="text-blue-600" />
                    বছরের ছুটি হালনাগাদ ও ঘোষণা প্যানেল
                  </h2>
                  <p className="text-[11px] text-slate-500 font-semibold font-sans">
                    সংগঠনের আওতায় সরাসরি বিশেষ সরকারি ছুটি এবং নিয়মিত/সাধারণ ছুটির দিনসমূহ এক নজরে তদারকি করুন।
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
                    className="px-4.5 py-2.5 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-extrabold text-xs rounded-xl flex items-center gap-1.5 transition duration-150 shadow-xs cursor-pointer text-center"
                  >
                    <Plus size={15} />
                    <span>নতুন ছুটি ঘোষণা</span>
                  </button>
                </div>
              </div>

              {/* Informative Guidance Callout about Pre-defined Government Holidays */}
              <div className="bg-amber-50/70 border border-amber-200 rounded-2xl p-4 flex gap-3 text-xs text-amber-900 leading-relaxed max-w-4xl">
                <Info size={18} className="text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-extrabold text-amber-950 mb-1">ক্যালেন্ডারে সরকারি ছুটির নির্দেশিকা ও পরামর্শ:</h4>
                  <p className="mb-1">
                    ১. <strong>স্বয়ংক্রিয় সরকারি ছুটিসমূহ:</strong> এই সিস্টেমে ২০২৬, ২০২৭ এবং ২০২৮ সালের সমস্ত প্রধান প্রধান সরকারি ও জাতীয় ছুটিসমূহ (যেমন: শহিদ দিবস, স্বাধীনতা দিবস, পহেলা বৈশাখ, ঈদ-উল-ফিতর, ঈদ-উল-আজহা ইত্যাদি) ইতোমধ্যে <strong>প্রাক-ঘোষিত (Pre-configured)</strong> রয়েছে।
                  </p>
                  <p className="mb-1">
                    ২. <strong>চলতি মাসের অবস্থা:</strong> বর্তমান সিস্টেম কাজের তারিখ অনুযায়ী এখন <strong>জুন ২০২৬</strong> চলতেছে। জুন ২০২৬ মাসে সাপ্তাহিক ছুটি (শুক্রবার) ব্যতীত কোনো বিশেষ জাতীয় সরকারি ছুটির দিন নেই। তাই জুন মাসের ক্যালেন্ডারে কোনো বাড়তি লাল চিহ্নিত দিন দেখা যাচ্ছে না।
                  </p>
                  <p>
                    ৩. <strong>পরীক্ষা করুন:</strong> পূর্ববর্তী বা পরবর্তী মাস যেমন—<strong>ফেব্রুয়ারি ২০২৬, মার্চ ২০২৬ বা মে ২০২৬</strong>-এ নেভিগেট করে দেখুন, ক্যালেন্ডার স্বয়ংক্রিয়ভাবে উক্ত প্রধান প্রধান সরকারি ছুটির দিনগুলোকে লাল রঙে প্রদর্শন করছে।
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
                    <p className="text-[10px] text-slate-400 font-bold block">২০২৬ সালের ছুটি</p>
                    <h5 className="text-base font-black text-slate-800">{holidaysList.filter(h => h.type === 'direct' && h.date?.startsWith('2026')).length} টি</h5>
                  </div>
                </div>

                <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-4 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center font-bold">
                    <Calendar size={18} />
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-400 font-bold block">২০২৭ সালের ছুটি</p>
                    <h5 className="text-base font-black text-slate-800">{holidaysList.filter(h => h.type === 'direct' && h.date?.startsWith('2027')).length} টি</h5>
                  </div>
                </div>

                <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-4 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-fuchsia-50 text-fuchsia-600 flex items-center justify-center font-bold">
                    <Calendar size={18} />
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-400 font-bold block">২০২৮ সালের ছুটি</p>
                    <h5 className="text-base font-black text-slate-800">{holidaysList.filter(h => h.type === 'direct' && h.date?.startsWith('2028')).length} টি</h5>
                  </div>
                </div>

                <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-4 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center font-bold">
                    <Clock size={18} />
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-400 font-bold block">সাপ্তাহিক নিয়মিত ছুটি</p>
                    <h5 className="text-base font-black text-slate-800">{holidaysList.filter(h => h.type === 'general').length} দিন</h5>
                  </div>
                </div>
              </div>

              {/* View Mode Toggle Switch */}
              <div className="flex gap-2 bg-slate-100 p-1.5 rounded-2xl w-fit border border-slate-200">
                <button
                  type="button"
                  onClick={() => setHolidayViewMode('calendar')}
                  className={`px-4 py-2 font-bold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer transition ${
                    holidayViewMode === 'calendar'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-800'
                  }`}
                >
                  <Calendar size={14} />
                  <span>📅 ছুটির ক্যালেন্ডার ভিউ</span>
                </button>
                <button
                  type="button"
                  onClick={() => setHolidayViewMode('list')}
                  className={`px-4 py-2 font-bold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer transition ${
                    holidayViewMode === 'list'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-800'
                  }`}
                >
                  <Search size={14} />
                  <span>📋 ছুটির তালিকা ও অনুসন্ধান</span>
                </button>
              </div>

              {holidayViewMode === 'calendar' ? (
                <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 animate-in fade-in duration-200">
                  {/* Left Section: Graphical Calendar Component */}
                  <div className="xl:col-span-2 bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 space-y-4">
                    
                    {/* Month Year Navigator & Quick Picks */}
                    <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-50 border border-slate-150 p-3 rounded-2xl">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            if (currentCalendarMonth === 0) {
                              setCurrentCalendarMonth(11);
                              setCurrentCalendarYear(prev => Math.max(2026, prev - 1));
                            } else {
                              setCurrentCalendarMonth(prev => prev - 1);
                            }
                          }}
                          className="p-1.5 hover:bg-slate-200 active:scale-90 text-slate-700 rounded-lg transition duration-150 cursor-pointer"
                          title="পূর্ববর্তী মাস"
                        >
                          <ChevronLeft size={16} />
                        </button>
                        
                        <span className="font-extrabold text-sm text-slate-800 tracking-tight min-w-[140px] text-center font-sans">
                          {['জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন', 'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর'][currentCalendarMonth]} - {replaceNumbersWithBN(currentCalendarYear)}
                        </span>

                        <button
                          type="button"
                          onClick={() => {
                            if (currentCalendarMonth === 11) {
                              setCurrentCalendarMonth(0);
                              setCurrentCalendarYear(prev => Math.min(2028, prev + 1));
                            } else {
                              setCurrentCalendarMonth(prev => prev + 1);
                            }
                          }}
                          className="p-1.5 hover:bg-slate-200 active:scale-90 text-slate-700 rounded-lg transition duration-150 cursor-pointer"
                          title="পরবর্তী মাস"
                        >
                          <ChevronRight size={16} />
                        </button>
                      </div>

                      {/* Dropdown Selectors */}
                      <div className="flex items-center gap-2">
                        <select
                          value={currentCalendarMonth}
                          onChange={(e) => setCurrentCalendarMonth(parseInt(e.target.value, 10))}
                          className="px-2.5 py-1.5 border border-slate-200 rounded-xl text-xs bg-white font-semibold text-slate-800 focus:outline-blue-600 cursor-pointer"
                        >
                          {['জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন', 'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর'].map((name, idx) => (
                            <option key={idx} value={idx}>{name}</option>
                          ))}
                        </select>

                        <select
                          value={currentCalendarYear}
                          onChange={(e) => setCurrentCalendarYear(parseInt(e.target.value, 10))}
                          className="px-2.5 py-1.5 border border-slate-200 rounded-xl text-xs bg-white font-semibold text-slate-800 focus:outline-blue-600 cursor-pointer"
                        >
                          <option value={2026}>২০২৬ সাল</option>
                          <option value={2027}>২০২৭ সাল</option>
                          <option value={2028}>২০২৮ সাল</option>
                        </select>
                      </div>
                    </div>

                    {/* Weekday Labels Grid */}
                    <div className="grid grid-cols-7 gap-2 text-center text-[11px] font-black text-slate-500 font-sans">
                      {['শনি', 'রবি', 'সোম', 'মঙ্গল', 'বুধ', 'বৃহস্পতি', 'শুক্র'].map((day, i) => (
                        <div key={i} className="py-2 bg-slate-50/70 border border-slate-100 rounded-lg">
                          {day}
                        </div>
                      ))}
                    </div>

                    {/* Day Grid representation */}
                    <div className="grid grid-cols-7 gap-2">
                      {(() => {
                        const daysInMonth = new Date(currentCalendarYear, currentCalendarMonth + 1, 0).getDate();
                        const firstDayIndex = new Date(currentCalendarYear, currentCalendarMonth, 1).getDay(); // 0 is Sun, 6 is Sat
                        const startOffset = (firstDayIndex + 1) % 7; // Align to Saturday as day 0
                        const cells = [];

                        // Render offset cells
                        for (let i = 0; i < startOffset; i++) {
                          cells.push(
                            <div key={`empty-${i}`} className="min-h-[85px] bg-slate-50/30 border border-dashed border-slate-100 rounded-xl"></div>
                          );
                        }

                        // Render actual day cells
                        for (let d = 1; d <= daysInMonth; d++) {
                          const dateStr = `${currentCalendarYear}-${(currentCalendarMonth + 1).toString().padStart(2, '0')}-${d.toString().padStart(2, '0')}`;
                          
                          // Look for Direct holiday
                          const directH = holidaysList.find(h => h.type === 'direct' && h.date === dateStr);
                          
                          // Look for General periodic holiday
                          const dayNum = new Date(currentCalendarYear, currentCalendarMonth, d).getDay();
                          const bnWeekDay = ['রবিবার', 'সোমবার', 'মঙ্গলবার', 'বুধবার', 'বৃহস্পতিবার', 'শুক্রবার', 'শনিবার'][dayNum];
                          const generalH = holidaysList.find(h => h.type === 'general' && h.dayOfWeek === bnWeekDay);
                          
                          const hasH = !!directH || !!generalH;
                          const hName = directH ? directH.name : (generalH ? generalH.name : '');
                          const isToday = currentCalendarYear === 2026 && currentCalendarMonth === 5 && d === 13;

                          cells.push(
                            <div
                              key={`day-${d}`}
                              onClick={() => {
                                if (directH) {
                                  handleEditHoliday(directH);
                                } else if (generalH) {
                                  handleEditHoliday(generalH);
                                } else {
                                  setEditingHolidayId(null);
                                  setHolidayType('direct');
                                  setHolidayName('');
                                  setHolidayDate(dateStr);
                                  setIsHolidayModalOpen(true);
                                }
                              }}
                              className={`min-h-[90px] p-2 border rounded-2xl cursor-pointer transition-all flex flex-col justify-between group relative select-none ${
                                isToday
                                  ? 'bg-blue-50/50 border-blue-500 ring-2 ring-blue-500/20'
                                  : hasH
                                    ? directH
                                      ? 'bg-red-50/50 border-red-200 hover:bg-rose-100/40'
                                      : 'bg-indigo-50/40 border-indigo-100 hover:bg-indigo-100/40'
                                    : 'bg-white border-slate-150 hover:bg-slate-50'
                              }`}
                            >
                              <div className="flex justify-between items-start">
                                <span className={`text-[11px] font-black font-sans leading-none ${isToday ? 'text-blue-700 bg-blue-100 px-1.5 py-0.5 rounded-md' : hasH ? 'text-red-600' : 'text-slate-800'}`}>
                                  {replaceNumbersWithBN(d)}
                                </span>
                                {isToday && (
                                  <span className="text-[7px] bg-blue-600 font-extrabold text-white px-1 rounded-sm leading-tight">TODAY</span>
                                )}
                              </div>

                              {hName && (
                                <div className="mt-1 space-y-0.5 max-w-full">
                                  <span className={`text-[9.5px] font-black block truncate leading-tight ${directH ? 'text-rose-700 font-bold bg-rose-100/50 px-1 py-0.5 rounded' : 'text-indigo-800 bg-indigo-50/60 px-1 py-0.5 rounded'}`}>
                                    🎈 {hName}
                                  </span>
                                  <span className="text-[8px] text-slate-400 block font-semibold leading-tight font-sans">
                                    {directH ? 'ঘোষিত সরকারী ছুটি' : 'সাপ্তাহিক ছুটি'}
                                  </span>
                                </div>
                              )}

                              <div className="absolute inset-0 bg-slate-900/[0.02] opacity-0 group-hover:opacity-100 rounded-2xl flex items-center justify-center transition duration-150">
                                <span className="text-[8.5px] font-black text-slate-800 bg-white/95 shadow-md border border-slate-200/85 px-2 py-1 rounded-lg">
                                  {hasH ? '🔔 সম্পাদনা' : '➕ ছুটি ঘোষণা'}
                                </span>
                              </div>
                            </div>
                          );
                        }
                        return cells;
                      })()}
                    </div>

                  </div>

                  {/* Right Section: Details panel & Quick guideline */}
                  <div className="space-y-6">
                    {/* 1. Month specific schedule list */}
                    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 space-y-3">
                      <div className="flex items-center gap-2 border-b border-slate-100 pb-2.5">
                        <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600 font-bold">
                          <Calendar size={15} />
                        </div>
                        <div>
                          <h4 className="font-extrabold text-slate-800 text-xs">
                            {['জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন', 'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর'][currentCalendarMonth]} মাসের ছুটির তালিকা
                          </h4>
                          <p className="text-[9.5px] text-slate-400 font-bold font-sans">এই নির্দিষ্ট মাসে ঘোষিত প্রাক-নির্ধারিত ছুটির দিনসমূহ</p>
                        </div>
                      </div>

                      <div className="space-y-1.5 max-h-[200px] overflow-y-auto pr-1">
                        {(() => {
                          const monthStr = (currentCalendarMonth + 1).toString().padStart(2, '0');
                          const yearStr = currentCalendarYear.toString();
                          const activeDaysH = holidaysList.filter(h => h.type === 'direct' && h.date?.startsWith(`${yearStr}-${monthStr}`));
                          
                          if (activeDaysH.length === 0) {
                            return (
                              <div className="py-6 text-center text-slate-400 italic text-[11px] font-bold">
                                এই মাসে কোনো নির্দিষ্ট সরকারি বা বিশেষ ছুটি ঘোষিত নেই।
                              </div>
                            );
                          }

                          return activeDaysH.map(h => (
                            <div key={h.id} className="p-2.5 bg-slate-50 border border-slate-200/60 rounded-xl hover:bg-slate-100/50 flex items-center justify-between gap-2.5 group transition">
                              <div className="space-y-0.5">
                                <p className="text-slate-800 text-[11px] font-black">{h.name}</p>
                                <p className="text-[9px] text-indigo-700 font-semibold flex items-center gap-1 font-sans">
                                  📅 {h.date}
                                </p>
                              </div>
                              <div className="flex items-center gap-1 transition duration-150">
                                <button
                                  type="button"
                                  onClick={() => handleEditHoliday(h)}
                                  className="p-1 text-slate-500 hover:text-blue-600 rounded-lg cursor-pointer"
                                >
                                  <Edit2 size={11} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteHoliday(h.id, h.name)}
                                  className="p-1 text-rose-500 hover:text-rose-700 rounded-lg cursor-pointer"
                                >
                                  <X size={11} />
                                </button>
                              </div>
                            </div>
                          ));
                        })()}
                      </div>
                    </div>

                    {/* 2. Quick user guideline panel */}
                    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 space-y-3">
                      <div className="flex items-center gap-2 border-b border-slate-100 pb-2.5">
                        <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600 font-bold">
                          <Info size={15} />
                        </div>
                        <div>
                          <h4 className="font-extrabold text-slate-800 text-xs">ছুটি ও ক্যালেন্ডার গাইডলাইন</h4>
                          <p className="text-[9.5px] text-slate-400 font-bold font-sans">সমন্বয় প্যানেল সাহায্যকারী</p>
                        </div>
                      </div>

                      <div className="text-[11px] text-slate-600 space-y-2 font-bold font-sans leading-relaxed">
                        <div className="flex gap-2">
                          <span className="text-emerald-500">•</span>
                          <span><strong>ছুটি ঘোষণা:</strong> ক্যালেন্ডার গ্রিডের যেকোনো খালি তারিখে ক্লিক করে সরাসরি বিশেষ বা সরকারি ছুটি ঘোষণা করতে পারেন।</span>
                        </div>
                        <div className="flex gap-2">
                          <span className="text-emerald-500">•</span>
                          <span><strong>কার্যকারিতা:</strong> ছুটির দিনে শাখা ব্যবস্থাপক বা কর্মীরা কোনো ধরনের নিয়মিত লোন বিতরণ বা কিস্তি কালেকশন শিডিউল করতে পারবে না।</span>
                        </div>
                        <div className="flex gap-2">
                          <span className="text-emerald-500">•</span>
                          <span><strong>সাপ্তাহিক বন্ধ:</strong> প্রতি সপ্তাহের 'শুক্রবার' ও 'শনিবার' (যদি আপনার রুলসে থাকে) স্বয়ংক্রিয় বন্ধের দিন হিসেবে কার্যকর হয়।</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  {/* Filters and Search Bar */}
                  <div className="bg-white rounded-2xl border border-slate-200/85 p-4 flex flex-wrap gap-4 items-center justify-between shadow-xs">
                    {/* Year Select Tabs */}
                    <div className="flex gap-1 bg-slate-100 p-1.5 rounded-xl">
                      {['all', '2026', '2027', '2028'].map((year) => {
                        const lable = year === 'all' ? 'সকল বছর' : year + ' সাল';
                        return (
                          <button
                            key={year}
                            type="button"
                            onClick={() => setHolidayYearFilter(year)}
                            className={`px-3 py-1.5 rounded-lg font-bold text-xs cursor-pointer transition ${
                              holidayYearFilter === year 
                                ? 'bg-blue-600 text-white shadow-xs' 
                                : 'text-slate-600 hover:text-slate-800 hover:bg-slate-200/60'
                            }`}
                          >
                            {lable}
                          </button>
                        );
                      })}
                    </div>

                    {/* Search Bar */}
                    <div className="relative w-full sm:w-72">
                      <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400 pointer-events-none">
                        <Search size={14} />
                      </span>
                      <input
                        type="text"
                        value={holidaySearchQuery}
                        onChange={(e) => setHolidaySearchQuery(e.target.value)}
                        placeholder="ছুটির নাম বা কারণ খুঁজুন..."
                        className="w-full pl-9 pr-4 py-1.5 border border-slate-200 rounded-xl text-xs bg-slate-5 font-semibold text-slate-700 placeholder:text-slate-400 focus:outline-blue-600"
                      />
                      {holidaySearchQuery && (
                        <button 
                          type="button"
                          onClick={() => setHolidaySearchQuery('')} 
                          className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600"
                        >
                          <X size={12} />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Main Contents Grid */}
                  <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                    
                    {/* Panel 1: Direct public holidays (At a glance grouped by month) */}
                    <div className="xl:col-span-2 bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 space-y-4">
                      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600">
                            <Calendar size={16} />
                          </div>
                          <div>
                            <h4 className="font-extrabold text-slate-800 text-sm">ঘোষিত নির্দিষ্ট সরকারি ছুটির দিনসমূহ (Direct Holidays)</h4>
                            <p className="text-[10px] text-slate-400">ছুটি সহজে তদারকির জন্য নিচে মাস ভিত্তিক সাজানো তালিকায় দেখানো হলো</p>
                          </div>
                        </div>
                      </div>

                      {/* Month group view helper */}
                      {(() => {
                        const monthsBN = [
                          { value: 1, name: 'জানুয়ারি' },
                          { value: 2, name: 'ফেব্রুয়ারি' },
                          { value: 3, name: 'মার্চ' },
                          { value: 4, name: 'এপ্রিল' },
                          { value: 5, name: 'মে' },
                          { value: 6, name: 'জুন' },
                          { value: 7, name: 'জুলাই' },
                          { value: 8, name: 'আগস্ট' },
                          { value: 9, name: 'সেপ্টেম্বর' },
                          { value: 10, name: 'অক্টোবর' },
                          { value: 11, name: 'নভেম্বর' },
                          { value: 12, name: 'ডিসেম্বর' },
                        ];

                        const filteredHolidays = holidaysList.filter(h => {
                          if (h.type !== 'direct') return false;
                          if (holidaySearchQuery) {
                            const q = holidaySearchQuery.toLowerCase();
                            if (!h.name.toLowerCase().includes(q) && !(h.date && h.date.includes(q))) return false;
                          }
                          if (holidayYearFilter !== 'all' && h.date) {
                            if (!h.date.startsWith(holidayYearFilter)) return false;
                          }
                          return true;
                        });

                        if (filteredHolidays.length === 0) {
                          return (
                            <div className="py-16 text-center text-slate-405 border-2 border-dashed border-slate-100 rounded-2xl">
                              <Calendar size={32} className="mx-auto text-slate-300 mb-2.5 stroke-1" />
                              <p className="text-xs font-bold text-slate-500">কোনো নির্দিষ্ট ছুটি সচল বা খুঁজে পাওয়া যায়নি।</p>
                              <p className="text-[10px] text-slate-400 mt-1">প্যাটার্ন বা সার্চ ফিল্ড পরিবর্তন করে পুনরায় চেষ্টা করুন।</p>
                            </div>
                          );
                        }

                        // Group by year, then month
                        const years = holidayYearFilter === 'all' ? ['2026', '2027', '2028'] : [holidayYearFilter];

                        return (
                          <div className="space-y-6 max-h-[600px] overflow-y-auto pr-1">
                            {years.map(yr => {
                              const yrHolidays = filteredHolidays.filter(h => h.date?.startsWith(yr));
                              if (yrHolidays.length === 0) return null;

                              return (
                                <div key={yr} className="space-y-3.5">
                                  <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-100">
                                    <span className="font-black text-xs text-blue-700 bg-blue-50 px-2 py-0.5 rounded-lg">{yr}</span>
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">বছরের নির্ধারিত ছুটির ক্যালেন্ডার</span>
                                  </div>

                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                                    {monthsBN.map(m => {
                                      const mHolidays = yrHolidays.filter(h => {
                                        if (!h.date) return false;
                                        const monthPart = parseInt(h.date.split('-')[1], 10);
                                        return monthPart === m.value;
                                      });

                                      if (mHolidays.length === 0) return null;

                                      return (
                                        <div key={m.value} className="bg-slate-50/40 rounded-xl p-3 border border-slate-150/50 space-y-2">
                                          <h5 className="text-xs font-black text-slate-700 border-b border-slate-150/50 pb-1.5 flex justify-between items-center font-sans">
                                            <span>📅 {m.name}</span>
                                            <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">
                                              {mHolidays.length} টি
                                            </span>
                                          </h5>

                                          <div className="space-y-1.5">
                                            {mHolidays.map(h => (
                                              <div key={h.id} className="p-2 bg-white rounded-lg border border-slate-100 shadow-3xs flex items-center justify-between text-xs font-bold group font-sans">
                                                <div className="space-y-0.5">
                                                  <p className="text-slate-800 text-[11px] leading-tight font-extrabold">{h.name}</p>
                                                  <p className="text-[9px] text-indigo-700 font-semibold flex items-center gap-1">
                                                    <span>📅 {h.date}</span>
                                                    <span className="text-slate-350">•</span>
                                                    <span className="font-mono text-[8.5px] text-slate-400">ID: {h.id}</span>
                                                  </p>
                                                </div>

                                                {/* Action triggers */}
                                                <div className="flex items-center gap-1 transition duration-150 shrink-0 select-none">
                                                  <button
                                                    type="button"
                                                    onClick={() => handleEditHoliday(h)}
                                                    className="p-1 hover:bg-slate-100 text-slate-500 hover:text-blue-600 rounded-lg cursor-pointer"
                                                    title="সম্পাদনা করুন"
                                                  >
                                                    <Edit2 size={11} />
                                                  </button>
                                                  <button
                                                    type="button"
                                                    onClick={() => handleDeleteHoliday(h.id, h.name)}
                                                    className="p-1 hover:bg-rose-50 text-rose-500 hover:text-rose-700 rounded-lg cursor-pointer"
                                                    title="বাতিল করুন"
                                                  >
                                                    <X size={11} />
                                                  </button>
                                                </div>
                                              </div>
                                            ))}
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

                    {/* Panel 2: General/weekly holidays */}
                    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 space-y-4 h-fit">
                      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600">
                            <Clock size={16} />
                          </div>
                          <div>
                            <h4 className="font-extrabold text-slate-800 text-sm">নিয়মিত সাপ্তাহিক ছুটিসমূহ (Weekly Holidays)</h4>
                            <p className="text-[10px] text-slate-400 font-semibold font-sans">প্রতি সপ্তাহের সাধারণ কর্মবিরতি</p>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
                        {holidaysList.filter(h => h.type === 'general').length === 0 ? (
                          <div className="py-12 text-center text-slate-400 border-2 border-dashed border-slate-100 rounded-2xl font-sans">
                            <Clock size={28} className="mx-auto text-slate-300 mb-2.5 stroke-1" />
                            <p className="text-xs font-semibold">কোনো সাধারণ বা সাপ্তাহিক ছুটি ঘোষিত নেই।</p>
                            <p className="text-[10px] text-slate-400 mt-1">যেমন: শুক্রবার স্থায়ী সাপ্তাহিক ছুটি সংরক্ষণ করুন।</p>
                          </div>
                        ) : (
                          holidaysList.filter(h => h.type === 'general').map((holiday) => (
                            <div 
                              key={holiday.id} 
                              className="p-3 bg-slate-50 border border-slate-205/50 rounded-xl hover:bg-slate-100/50 transition flex items-center justify-between gap-3 group font-sans font-semibold text-xs"
                            >
                              <div className="space-y-1">
                                <div className="flex items-center gap-1.5 font-bold text-slate-800 text-xs">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                  <span>{holiday.name}</span>
                                </div>
                                <p className="font-extrabold text-emerald-700 text-[10px] bg-emerald-50 px-2 py-0.5 rounded-md inline-block">
                                  প্রতি সপ্তাহের: <span className="underline">{holiday.dayOfWeek}</span>
                                </p>
                                <p className="text-[8.5px] text-slate-400 block pt-0.5 font-mono">
                                  আইডি: {holiday.id} • ঘোষিত: {new Date(holiday.addDate || '').toLocaleDateString('bn-BD')}
                                </p>
                              </div>
                              
                              <div className="flex items-center gap-1 transition duration-150">
                                <button
                                  type="button"
                                  onClick={() => handleEditHoliday(holiday)}
                                  className="p-1 hover:bg-slate-200 text-slate-500 hover:text-blue-600 rounded-lg cursor-pointer"
                                  title="সম্পাদনা করুন"
                                >
                                  <Edit2 size={11} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteHoliday(holiday.id, holiday.name)}
                                  className="p-1 hover:bg-rose-100 text-rose-600 rounded-lg cursor-pointer"
                                  title="Holiday বাতিল করুন"
                                >
                                  <Trash2 size={11} />
                                </button>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                  </div>
                </>
              )}

            </div>
          )}

          {/* VIEW 6: Operations / অপারেশন প্যানেল */}
          {activeTab === 'operations' && (
            <div className="space-y-6 animate-in fade-in duration-100">
              
              {/* Back button */}
              <div className="pb-1">
                <button
                  onClick={() => setActiveTab('home')}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold hover:text-slate-900 rounded-lg text-[10.5px] border border-slate-200 cursor-pointer transition shadow-3xs"
                >
                  <ChevronLeft size={13} />
                  <span>← প্রধান এডমিন কন্ট্রোলে ফিরুন</span>
                </button>
              </div>
              
              {/* Top Bar */}
              <div className="border-b border-slate-100 pb-4 flex flex-col sm:flex-row justify-between sm:items-center gap-3">
                <div>
                  <h2 className="text-lg font-extrabold text-slate-800 tracking-tight flex items-center gap-2">
                    <Layers size={20} className="text-indigo-600 animate-pulse" />
                    মাঠ ও শাখা স্তরের সকল ইউজার প্যানেল ইন্টিগ্রেশন
                  </h2>
                  <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                    সরাসরি যেকোনো শাখা ব্যবস্থাপক (BM) বা মাঠ কর্মকর্তা (Field Staff) হিসেবে লগইন ছাড়া ইন্টারফেস অ্যাক্সেস ও কার্য সম্পাদন।
                  </p>
                </div>
              </div>

              {/* Highlight Note */}
              <div className="bg-indigo-50/50 rounded-2xl border border-indigo-150 p-5 leading-relaxed text-xs text-indigo-900 shadow-xs flex items-start gap-3">
                <Info size={18} className="text-indigo-600 shrink-0 mt-0.5 animate-bounce" />
                <div className="space-y-1">
                  <span className="font-extrabold text-sm block">এডমিন পরিচালনা নির্দেশিকা (Admin Operations Policy):</span>
                  <p className="text-[11.5px] text-indigo-950/80 leading-relaxed">
                    সুপার ওভাররাইড ক্ষমতার মাধ্যমে আপনি যেকোনো শাখা বা মাঠ কর্মী প্যানেলে প্রবেশ করতে পারেন। যেকোনো শাখা বা কর্মী প্যানেলে থাকাকালীন নতুন সদস্য ভর্তি, সঞ্চয় আদায়, ঋণ প্রস্তাব প্রসেস বা ডিল বিতরণ করা হলে তা সরাসরি এই এডমিন ডেটাবেইসের সাথে রিয়েল-টাইমে সেভ হবে। কাজ শেষে উপরে লাল রঙের <strong className="text-rose-700">"অ্যাডমিন ড্যাশবোর্ডে ফিরে যান"</strong> বাটনে ক্লিক করলেই এডমিন পোর্টালে ফেরত আসবেন।
                  </p>
                </div>
              </div>

              {/* Main Interactive Panel selector */}
              <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
                <div className="p-4.5 bg-slate-50 border-b border-slate-100">
                  <h3 className="font-extrabold text-xs text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                    <Sliders size={14} className="text-slate-400" /> যেকোনো ইউজার ইন্টারফেস দ্রুত চালু করুন
                  </h3>
                </div>

                <div className="p-5.5 space-y-5">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5.5">
                    
                    {/* Column 1: Select Branch */}
                    <div className="space-y-1.5">
                      <label className="block text-xs font-bold text-slate-600 flex items-center gap-1">
                        <Building size={13} className="text-blue-500" />
                        ১. শাখা অফিস নির্বাচন করুন (Select Office Branch)
                      </label>
                      <select
                        id="simulation-branch-dropdown"
                        value={selectedSimBranchId}
                        onChange={(e) => {
                          const branchId = e.target.value;
                          setSelectedSimBranchId(branchId);
                          
                          // Auto select first staff of this branch, or ILO
                          const branchStaff = staffList.filter(s => s.branchId === branchId);
                          if (branchStaff.length > 0) {
                            setSelectedSimStaffId(branchStaff[0].id);
                          } else {
                            setSelectedSimStaffId('new_liaison');
                          }
                        }}
                        className="w-full px-4 py-2.5 bg-white border border-slate-250 rounded-xl text-xs font-bold font-sans text-slate-800 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                      >
                        <option value="">-- শাখা অফিস সিলেক্ট করুন --</option>
                        {branchesList.map(b => (
                          <option key={b.id} value={b.id}>
                            {b.name} (কোড: {b.code}) — {staffList.filter(s => s.branchId === b.id).length} জন কর্মী
                          </option>
                        ))}
                      </select>
                      <p className="text-[10px] text-slate-400">শাখার সকল সদস্য, দল ও লোন প্রোডাক্ট এর তালিকা স্বয়ংক্রিয়ভাবে লোড হবে।</p>
                    </div>

                    {/* Column 2: Select Operator Staff */}
                    <div className="space-y-1.5">
                      <label className="block text-xs font-bold text-slate-600 flex items-center gap-1">
                        <UserCheck size={13} className="text-emerald-500" />
                        ২. অপারেটর বা কর্মী অ্যাকাউন্ট সিলেক্ট করুন (Select Worker Profile)
                      </label>
                      <select
                        id="simulation-staff-dropdown"
                        value={selectedSimStaffId}
                        onChange={(e) => setSelectedSimStaffId(e.target.value)}
                        disabled={!selectedSimBranchId}
                        className="w-full px-4 py-2.5 bg-white border border-slate-250 rounded-xl text-xs font-bold font-sans text-slate-800 focus:ring-1 focus:ring-indigo-500 focus:outline-none disabled:bg-slate-50 disabled:text-slate-400 disabled:border-slate-200"
                      >
                        {!selectedSimBranchId ? (
                          <option value="">প্রথমে একটি শাখা নির্বাচন করুন</option>
                        ) : (
                          <>
                            {staffList.filter(s => s.branchId === selectedSimBranchId).map(s => (
                              <option key={s.id} value={s.id}>
                                {s.name} ({s.designation}) [আইডি: {s.staffId}]
                              </option>
                            ))}
                            <option value="new_liaison">
                              + ইন্টারন্যাশনাল লিয়াজোঁ অফিসার (ILO) হিসেবে চালান
                            </option>
                          </>
                        )}
                      </select>
                      <p className="text-[10px] text-slate-400">মাঠ কর্মী বা ব্যবস্থাপকের ভূমিকা অনুযায়ী ইন্টারফেস লোড হবে।</p>
                    </div>

                  </div>

                  <div className="pt-3.5 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-50/50 p-4 rounded-xl">
                    <div className="text-[10.5px] text-slate-500">
                      🏢 নির্বাচিত শাখা কোড: <span className="font-mono font-bold text-slate-800">{branchesList.find(b => b.id === selectedSimBranchId)?.code || 'N/A'}</span> 
                      <span className="mx-2">•</span> 
                      🕒 ওয়ার্কিং দিন: <span className="font-mono font-bold text-slate-800">{workingDay}</span>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        if (!selectedSimBranchId) {
                          alert('দয়া করে একটি শাখা নির্বাচন করুন!');
                          return;
                        }
                        const branch = branchesList.find(b => b.id === selectedSimBranchId);
                        if (!branch) return;

                        let staffToLaunch: Staff | undefined;
                        if (selectedSimStaffId === 'new_liaison') {
                          staffToLaunch = {
                            id: `ilo-branch-${branch.id}`,
                            orgId: org.id,
                            name: `ইন্টারন্যাশনাল লিয়াজোঁ অফিসার (${branch.name})`,
                            phone: branch.phone || '01712345678',
                            designation: 'মাঠ কর্মী',
                            joiningDate: new Date().toISOString().split('T')[0],
                            branchId: branch.id,
                            branchJoiningDate: new Date().toISOString().split('T')[0],
                            staffId: `ILO-${branch.code}`,
                            password: '1234'
                          };
                        } else {
                          staffToLaunch = staffList.find(s => s.id === selectedSimStaffId);
                        }

                        if (!staffToLaunch) {
                          // Fallback to auto-created manager
                          staffToLaunch = {
                            id: `sim-staff-${branch.id}`,
                            orgId: org.id,
                            name: `অস্থায়ী শাখা ব্যবস্থাপক (${branch.name})`,
                            phone: branch.phone || '01712345678',
                            designation: 'শাখা ব্যবস্থাপক',
                            joiningDate: branch.addDate || new Date().toISOString().split('T')[0],
                            branchId: branch.id,
                            branchJoiningDate: branch.addDate || new Date().toISOString().split('T')[0],
                            staffId: `ILO-${branch.code}`,
                            password: '1234'
                          };
                        }

                        setSelectedSimulationStaff(staffToLaunch);
                      }}
                      disabled={!selectedSimBranchId}
                      className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs rounded-xl flex items-center justify-center gap-2 cursor-pointer transition shadow-xs hover:shadow-md disabled:bg-slate-100 disabled:text-slate-400 disabled:border-slate-200"
                    >
                      <Layers size={14} className="text-white" />
                      <span>নির্বাচিত ইউজার পোর্টাল প্যানেল চালু করুন</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Quick Jump Grid cards */}
              <div className="space-y-3">
                <h3 className="font-extrabold text-slate-800 text-xs tracking-tight">সরাসরি কাজ শুরুর কুইক-লিংক সমূহ:</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {branchesList.map(branch => {
                    const manager = staffList.find(s => s.branchId === branch.id && s.designation === 'শাখা ব্যবস্থাপক');
                    return (
                      <div 
                        key={branch.id} 
                        className="bg-white rounded-xl border border-slate-200 p-4 hover:border-slate-350 transition flex items-center justify-between gap-3 shadow-xs"
                      >
                        <div className="space-y-1">
                          <h4 className="font-extrabold text-slate-800 text-xs">{branch.name}</h4>
                          <p className="text-[10px] text-slate-400 leading-snug">কোড: {branch.code} • ম্যানেজার: {manager ? manager.name : '(নিযুক্ত নয়)'}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            const simulatedStaff = manager || staffList.find(s => s.branchId === branch.id) || {
                              id: `sim-staff-${branch.id}`,
                              orgId: org.id,
                              name: `অস্থায়ী শাখা ব্যবস্থাপক (${branch.name})`,
                              phone: branch.phone || '01712345678',
                              designation: 'শাখা ব্যবস্থাপক',
                              joiningDate: branch.addDate || new Date().toISOString().split('T')[0],
                              branchId: branch.id,
                              branchJoiningDate: branch.addDate || new Date().toISOString().split('T')[0],
                              staffId: `ILO-${branch.code}`,
                              password: '1234'
                            };
                            setSelectedSimulationStaff(simulatedStaff);
                          }}
                          className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-extrabold text-[10px] rounded-lg border border-indigo-150 transition cursor-pointer shrink-0"
                        >
                          প্যানেল খুলুন
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

            </div>
          )}

          {activeTab === 'master-roll' && (
            <div className="space-y-4">
              {/* Back button */}
              <div className="pb-1">
                <button
                  onClick={() => setActiveTab('home')}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold hover:text-slate-900 rounded-lg text-[10.5px] border border-slate-200 cursor-pointer transition shadow-3xs"
                >
                  <ChevronLeft size={13} />
                  <span>← প্রধান এডমিন কন্ট্রোলে ফিরুন</span>
                </button>
              </div>
              <MasterRollView 
                org={org} 
                staffList={staffList} 
                branchesList={branchesList} 
                groupMembers={groupMembers}
                setGroupMembers={setGroupMembers}
              />
            </div>
          )}

          {activeTab === 'audit-logs' && (
            <AuditLogView org={org} onBack={() => setActiveTab('home')} />
          )}

        </main>
      </div>

      {/* --- POPUPS & SECONDARY DIALOG MODALS --- */}
      
      {/* MODAL: Working Day Modification */}
      {isWorkingDayModalOpen && (() => {
        const autoNextDay = getCalculatedNextWorkingDay(workingDay, holidaysList);
        const currentBnDate = new Date(workingDay + 'T00:00:00').toLocaleDateString('bn-BD', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
        const nextBnDate = new Date(autoNextDay + 'T00:00:00').toLocaleDateString('bn-BD', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 animate-in fade-in duration-100">
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-100 animate-in zoom-in-95 duration-150 p-6 space-y-4">
              <div className="pb-2 border-b border-slate-100 flex justify-between items-center">
                <h3 className="font-extrabold text-slate-800 text-sm flex items-center gap-2">
                  <Clock size={18} className="text-blue-600" />
                  <span>কর্মদিবস ব্যবস্থাপনা (Working Day Management)</span>
                </h3>
                <button onClick={() => setIsWorkingDayModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer">
                  <X size={18} />
                </button>
              </div>

              {/* Automatic Next Day Transfer Section (Primary) */}
              <div className="bg-blue-50/80 border border-blue-200 rounded-2xl p-4 space-y-3">
                <div className="flex items-center gap-2 text-blue-800 font-extrabold text-xs">
                  <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
                  <span>স্বয়ংক্রিয় ডে ক্লোজ ও স্থানান্তর</span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-white/80 p-2.5 rounded-xl border border-blue-100">
                    <p className="text-[10px] font-bold text-slate-500">বর্তমান কর্মদিবস:</p>
                    <p className="font-mono font-black text-slate-800 text-xs mt-0.5">{workingDay}</p>
                    <p className="text-[10px] text-slate-500 font-medium">{currentBnDate.split(',')[0]}</p>
                  </div>
                  <div className="bg-blue-600/10 p-2.5 rounded-xl border border-blue-300/50">
                    <p className="text-[10px] font-bold text-blue-700">পরবর্তী কর্মদিবস:</p>
                    <p className="font-mono font-black text-blue-900 text-xs mt-0.5">{autoNextDay}</p>
                    <p className="text-[10px] text-blue-700 font-medium">{nextBnDate.split(',')[0]}</p>
                  </div>
                </div>

                <p className="text-[10px] text-slate-500 leading-relaxed">
                  * ঘোষিত ছুটি ও সাপ্তাহিক বন্ধের দিনগুলো স্বয়ংক্রিয়ভাবে এড়িয়ে পরবর্তী সঠিক কর্মদিবস হিসাব করা হয়েছে।
                </p>

                <button
                  type="button"
                  onClick={() => {
                    if (!window.confirm(`${workingDay} এই দিনটি ক্লোজ করে পরবর্তী কর্মদিবস ${autoNextDay}-এ স্থানান্তর করতে চান?`)) return;

                    setWorkingDay(autoNextDay);
                    setWorkingDayInput(autoNextDay);
                    localStorage.setItem(`tanzil_admin_working_day_${org.id}`, autoNextDay);
                    localStorage.setItem(`tanzil_working_day_${org.id}`, autoNextDay);

                    const branches = JSON.parse(localStorage.getItem(`tanzil_branches_${org.id}`) || '[]');
                    branches.forEach((b: any) => {
                      localStorage.setItem(`tanzil_working_day_${org.id}_branch_${b.id}`, autoNextDay);
                      localStorage.setItem(`tanzil_working_day_${org.id}_branch_${b.id}_simulated`, autoNextDay);
                    });

                    window.dispatchEvent(new Event('storage'));
                    setIsWorkingDayModalOpen(false);
                    alert(`অফিসিয়াল কর্মদিবস ${workingDay} সফলভাবে ক্লোজ করে পরবর্তী কর্মদিবস ${autoNextDay}-এ স্থানান্তর করা হয়েছে!`);
                  }}
                  className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white text-xs font-black rounded-xl transition cursor-pointer flex items-center justify-center gap-2 shadow-sm"
                >
                  <Clock size={15} />
                  <span>ডে ক্লোজ করে স্বয়ংক্রিয়ভাবে স্থানান্তর করুন ({autoNextDay})</span>
                </button>
              </div>

              {/* Manual Date Input Section (Secondary) */}
              <div className="pt-2 border-t border-slate-100">
                <details className="group">
                  <summary className="text-xs font-bold text-slate-500 hover:text-slate-800 cursor-pointer flex items-center justify-between py-1">
                    <span>বিশেষ প্রয়োজনে ম্যানুয়ালি তারিখ পরিবর্তন করুন (Manual Override)</span>
                    <span className="text-[10px] text-slate-400 group-open:rotate-180 transition-transform">▼</span>
                  </summary>

                  <form onSubmit={(e) => {
                    e.preventDefault();
                    if (workingDayInput) {
                      setWorkingDay(workingDayInput);
                      localStorage.setItem(`tanzil_admin_working_day_${org.id}`, workingDayInput);
                      localStorage.setItem(`tanzil_working_day_${org.id}`, workingDayInput);
                      
                      // Sync to all branches
                      const branches = JSON.parse(localStorage.getItem(`tanzil_branches_${org.id}`) || '[]');
                      branches.forEach((b: any) => {
                        localStorage.setItem(`tanzil_working_day_${org.id}_branch_${b.id}`, workingDayInput);
                        localStorage.setItem(`tanzil_working_day_${org.id}_branch_${b.id}_simulated`, workingDayInput);
                      });

                      window.dispatchEvent(new Event('storage'));
                      setIsWorkingDayModalOpen(false);
                      alert('কর্মদিবস সফলভাবে পরিবর্তন করা হয়েছে এবং সকল শাখায় আপডেট করা হয়েছে!');
                    }
                  }} className="mt-3 space-y-3 bg-slate-50 p-3 rounded-xl border border-slate-200/80">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">কাস্টম তারিখ নির্বাচন করুন</label>
                      <input 
                        type="date" 
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold focus:ring-2 focus:ring-blue-500 focus:outline-none" 
                        value={workingDayInput} 
                        onChange={(e) => setWorkingDayInput(e.target.value)}
                        required
                      />
                    </div>

                    <div className="flex gap-2">
                      <button type="button" onClick={() => setIsWorkingDayModalOpen(false)} className="flex-1 py-1.5 text-xs font-bold text-slate-600 bg-slate-200 rounded-xl hover:bg-slate-300 cursor-pointer">
                        বাতিল
                      </button>
                      <button type="submit" className="flex-1 py-1.5 text-xs font-bold text-white bg-blue-600 rounded-xl hover:bg-blue-700 transition cursor-pointer">
                        পরিবর্তন করুন
                      </button>
                    </div>
                  </form>
                </details>
              </div>
            </div>
          </div>
        );
      })()}

      {/* MODAL: Change Admin Password */}
      {isChangePasswordModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 animate-in fade-in duration-100">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden border border-slate-100 animate-in zoom-in-95 duration-150">
            <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200/80 flex justify-between items-center">
              <h3 className="font-bold text-slate-800 text-xs sm:text-sm flex items-center gap-1.5">
                <Key size={16} className="text-indigo-600" /> প্রাতিষ্ঠানিক পাসওয়ার্ড পরিবর্তন
              </h3>
              <button onClick={() => setIsChangePasswordModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-0.5">
                <X size={18} />
              </button>
            </div>
            
            <form onSubmit={(e) => {
              e.preventDefault();
              if (oldPasswordVal !== orgPassword) {
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
              
              // Save
              setOrgPassword(newPasswordVal);
              if (onUpdateOrg) {
                onUpdateOrg({
                  ...org,
                  adminPassword: newPasswordVal
                });
              }
              
              setPasswordChangeSuccess('পাসওয়ার্ড সফলভাবে পরিবর্তন করা হয়েছে!');
              setTimeout(() => {
                setPasswordChangeSuccess('');
                setIsChangePasswordModalOpen(false);
              }, 2000);
            }} className="p-5 space-y-4">
              
              {passwordChangeSuccess ? (
                <div className="p-4 bg-emerald-50 border border-emerald-100 text-emerald-800 rounded-xl text-center text-xs font-bold space-y-1">
                  <p>{passwordChangeSuccess}</p>
                </div>
              ) : (
                <>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">পুরাতন পাসওয়ার্ড</label>
                      <input 
                        type="password" 
                        placeholder="পুরাতন পাসওয়ার্ড দিন"
                        className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-sm font-mono tracking-wide focus:ring-1 focus:ring-blue-500 focus:outline-none" 
                        value={oldPasswordVal} 
                        onChange={(e) => setOldPasswordVal(e.target.value)}
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">নতুন পাসওয়ার্ড</label>
                      <input 
                        type="password" 
                        placeholder="নতুন পাসওয়ার্ড দিন"
                        className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-sm font-mono tracking-wide focus:ring-1 focus:ring-blue-500 focus:outline-none" 
                        value={newPasswordVal} 
                        onChange={(e) => setNewPasswordVal(e.target.value)}
                        required
                        minLength={4}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">নতুন পাসওয়ার্ড নিশ্চিত করুন</label>
                      <input 
                        type="password" 
                        placeholder="পাসওয়ার্ড নিশ্চিত করুন"
                        className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-sm font-mono tracking-wide focus:ring-1 focus:ring-blue-500 focus:outline-none" 
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
                      className="flex-1 py-1.5 text-xs font-bold text-slate-600 bg-slate-100 rounded-xl hover:bg-slate-250"
                    >
                      বাতিল
                    </button>
                    <button 
                      type="submit"
                      className="flex-1 py-1.5 text-xs font-bold text-white bg-indigo-600 rounded-xl hover:bg-indigo-750"
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

      {/* MODAL: Declare New Holiday */}
      {isHolidayModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 animate-in fade-in duration-100">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden border border-slate-100 animate-in zoom-in-95 duration-150">
            <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200/80 flex justify-between items-center">
              <h3 className="font-bold text-slate-800 text-xs sm:text-sm flex items-center gap-1.5">
                <Calendar size={16} className="text-blue-600" /> নতুন ছুটি ঘোষণা (Declare Holiday)
              </h3>
              <button onClick={() => setIsHolidayModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-0.5">
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
                    className={`py-1.5 text-xs font-bold rounded-lg transition-all ${
                      holidayType === 'direct' ? 'bg-white text-slate-800 shadow-xs' : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    সরাসরি বিশেষ ছুটি
                  </button>
                  <button
                    type="button"
                    onClick={() => setHolidayType('general')}
                    className={`py-1.5 text-xs font-bold rounded-lg transition-all ${
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
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-1 focus:ring-blue-500 focus:outline-none placeholder:text-slate-405" 
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
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-1 focus:ring-blue-500 focus:outline-none" 
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
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-1 focus:ring-blue-500 focus:outline-none"
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
                  className="flex-1 py-1.5 text-xs font-bold text-slate-600 bg-slate-100 rounded-xl hover:bg-slate-200"
                >
                  বাতিল
                </button>
                <button 
                  type="submit"
                  className="flex-1 py-1.5 text-xs font-bold text-white bg-blue-600 rounded-xl hover:bg-blue-700 transition"
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
                className="flex-1 py-2 text-xs font-bold text-white bg-blue-600 rounded-xl hover:bg-blue-700 transition cursor-pointer"
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
                className="w-full py-2 text-xs font-bold text-white bg-blue-600 rounded-xl hover:bg-blue-700 transition cursor-pointer"
              >
                ঠিক আছে (OK)
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
