import React, { useState, useMemo, useEffect } from 'react';
import { Organization, Staff, Group, Branch } from '../types';
import { registerDeletedId } from '../lib/deletedIds';
import { formatDDMMYYYY } from '../lib/dateUtils';
import { 
  Search, 
  Calendar, 
  FileText, 
  Trash2, 
  Edit2, 
  X, 
  Check, 
  Filter, 
  TrendingUp, 
  User, 
  Users,
  Coins,
  FileSpreadsheet
} from 'lucide-react';

interface MasterRollViewProps {
  org: Organization;
  staffList: Staff[];
  branchesList: Branch[];
  loanProposals?: any[];
  setLoanProposals?: React.Dispatch<React.SetStateAction<any[]>>;
  groupMembers: any[];
  setGroupMembers: React.Dispatch<React.SetStateAction<any[]>>;
  forceBranchId?: string;
}

export function MasterRollView({ 
  org, 
  staffList, 
  branchesList,
  loanProposals: propsLoanProposals,
  setLoanProposals: propsSetLoanProposals,
  groupMembers,
  setGroupMembers,
  forceBranchId
}: MasterRollViewProps) {
  
  // Local states if props are not passed (e.g. inside Org Admin Dashboard)
  const [localProposals, setLocalProposals] = useState<any[]>(() => {
    const saved = localStorage.getItem(`tanzil_loan_proposals_${org.id}`);
    return saved ? JSON.parse(saved) : [];
  });

  // Determine active proposals list and state mutator
  const activeProposals = propsLoanProposals !== undefined ? propsLoanProposals : localProposals;
  
  const updateProposalsState = (updatedList: any[]) => {
    localStorage.setItem(`tanzil_loan_proposals_${org.id}`, JSON.stringify(updatedList));
    if (propsSetLoanProposals) {
      propsSetLoanProposals(updatedList);
    } else {
      setLocalProposals(updatedList);
    }
  };

  const [groups, setGroups] = useState<Group[]>(() => {
    const saved = localStorage.getItem(`tanzil_groups_${org.id}`);
    return saved ? JSON.parse(saved) : [];
  });

  // Filtered staff list based on forceBranchId
  const displayStaffList = useMemo(() => {
    if (forceBranchId) {
      return staffList.filter(s => s.branchId === forceBranchId);
    }
    return staffList;
  }, [staffList, forceBranchId]);

  // Filtered groups based on forceBranchId
  const displayGroups = useMemo(() => {
    if (forceBranchId) {
      return groups.filter(g => g.branchId === forceBranchId);
    }
    return groups;
  }, [groups, forceBranchId]);

  // Advanced Filtering States
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedStaffId, setSelectedStaffId] = useState('all');
  const [selectedGroupId, setSelectedGroupId] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Editing States
  const [editingProposal, setEditingProposal] = useState<any | null>(null);
  const [editDate, setEditDate] = useState('');
  const [editAmount, setEditAmount] = useState('');
  const [editTotalPayable, setEditTotalPayable] = useState('');
  const [editInstallmentAmount, setEditInstallmentAmount] = useState('');
  const [editPurpose, setEditPurpose] = useState('');
  const [editSuccessMsg, setEditSuccessMsg] = useState('');

  // Auto reload when local storage values change (realtime safety)
  useEffect(() => {
    const handleStorageChange = () => {
      if (propsLoanProposals === undefined) {
        const saved = localStorage.getItem(`tanzil_loan_proposals_${org.id}`);
        if (saved) setLocalProposals(JSON.parse(saved));
      }
      const savedGroups = localStorage.getItem(`tanzil_groups_${org.id}`);
      if (savedGroups) setGroups(JSON.parse(savedGroups));
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [org.id, propsLoanProposals]);

  // Derived filter logic
  const filteredDisbursements = useMemo(() => {
    let list = activeProposals.filter((p: any) => p.status === 'disbursed');

    if (forceBranchId) {
      list = list.filter((p: any) => p.branchId === forceBranchId);
    }

    if (startDate) {
      list = list.filter((p: any) => p.disbursedDate >= startDate);
    }
    if (endDate) {
      list = list.filter((p: any) => p.disbursedDate <= endDate);
    }
    if (selectedStaffId !== 'all') {
      list = list.filter((p: any) => p.staffId === selectedStaffId || p.createdBy === selectedStaffId);
    }
    if (selectedGroupId !== 'all') {
      list = list.filter((p: any) => p.groupId === selectedGroupId);
    }
    if (searchTerm.trim() !== '') {
      const term = searchTerm.toLowerCase();
      list = list.filter((p: any) => 
        (p.memberName && p.memberName.toLowerCase().includes(term)) ||
        (p.memberCode && p.memberCode.toLowerCase().includes(term)) ||
        (p.memberId && p.memberId.toLowerCase().includes(term)) ||
        (p.purpose && p.purpose.toLowerCase().includes(term))
      );
    }

    return list;
  }, [activeProposals, startDate, endDate, selectedStaffId, selectedGroupId, searchTerm, forceBranchId]);

  // Aggregate stats
  const stats = useMemo(() => {
    const totalAmount = filteredDisbursements.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
    const totalPayable = filteredDisbursements.reduce((sum, p) => sum + (Number(p.totalPayable) || 0), 0);
    const count = filteredDisbursements.length;

    return { totalAmount, totalPayable, count };
  }, [filteredDisbursements]);

  // Delete handler
  const handleDelete = (id: string, memberName: string, memberId: string) => {
    const proposal = activeProposals.find((p: any) => p.id === id);
    if (window.confirm(`আপনি কি নিশ্চিত যে আপনি "${memberName}" এর বিতরণকৃত ঋণটি ডিলিট করতে চান? এটি সদস্যের প্রোফাইল থেকেও মুছে ফেলা হবে।`)) {
      const updated = activeProposals.filter((p: any) => p.id !== id);
      updateProposalsState(updated);
      registerDeletedId(org.id, id);
      
      // Sync with members
      const updatedMembers = groupMembers.map((m: any) => {
        const isMatch = m.id === memberId || 
                        m.memberId === memberId || 
                        (proposal && (m.id === proposal.memberId || m.memberId === proposal.memberId || m.memberId === proposal.memberCode));
        if (isMatch) {
          return {
            ...m,
            // Fully remove/clear outstanding loan fields on the member's profile
            loanAmount: 0,
            payableAmount: 0,
            plOutstanding: 0,
            plInstallment: 0,
            paidAmount: 0
          };
        }
        return m;
      });
      setGroupMembers(updatedMembers);
      localStorage.setItem(`tanzil_group_members_${org.id}`, JSON.stringify(updatedMembers));
      alert('সফলভাবে ডিলিট করা হয়েছে।');
    }
  };

  // Open Edit Modal
  const openEditModal = (proposal: any) => {
    setEditingProposal(proposal);
    setEditDate(proposal.disbursedDate || '');
    setEditAmount(proposal.amount || '');
    setEditTotalPayable(proposal.totalPayable || '');
    setEditInstallmentAmount(proposal.installmentAmount || '');
    setEditPurpose(proposal.purpose || '');
    setEditSuccessMsg('');
  };

  // Save changes
  const handleSaveChanges = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProposal) return;

    const amt = Number(editAmount);
    const pay = Number(editTotalPayable);
    const inst = Number(editInstallmentAmount);

    if (isNaN(amt) || amt <= 0) {
      alert('দয়া করে সঠিক ঋণের পরিমাণ ইনপুট দিন!');
      return;
    }

    const updated = activeProposals.map((p: any) => {
      if (p.id === editingProposal.id) {
        return {
          ...p,
          disbursedDate: editDate,
          amount: amt,
          proposedAmount: amt,
          totalPayable: pay,
          installmentAmount: inst,
          purpose: editPurpose
        };
      }
      return p;
    });

    updateProposalsState(updated);
    setEditSuccessMsg('ঋণের তথ্য সফলভাবে হালনাগাদ করা হয়েছে!');
    setTimeout(() => {
      setEditingProposal(null);
    }, 1200);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      
      {/* Header and Summary stats card */}
      <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4 border-b border-slate-100 pb-5">
        <div>
          <h2 className="text-lg font-extrabold text-slate-800 tracking-tight flex items-center gap-2">
            <FileSpreadsheet size={22} className="text-indigo-600" />
            মাস্টার রোল তদারকি প্যানেল (Master Roll Oversight)
          </h2>
          <p className="text-[11px] text-slate-500 font-semibold font-sans mt-0.5">
            সংগঠনের বিতরণকৃত সকল ঋণের হিসাব এক নজরে পর্যবেক্ষণ, ফিল্টারিং, পরিবর্তন ও নিয়ন্ত্রণ করুন।
          </p>
        </div>

        {/* Statistical metrics */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-indigo-50/70 border border-indigo-100 px-4 py-2 rounded-xl text-center">
            <span className="block text-[9px] text-indigo-700 font-extrabold uppercase tracking-wider">মোট ঋণ পরিমাণ</span>
            <strong className="text-base font-black text-indigo-900 font-sans">
              ৳{stats.totalAmount.toLocaleString('bn-BD')}
            </strong>
          </div>
          <div className="bg-emerald-50/70 border border-emerald-100 px-4 py-2 rounded-xl text-center">
            <span className="block text-[9px] text-emerald-700 font-extrabold uppercase tracking-wider">মোট আদায়যোগ্য</span>
            <strong className="text-base font-black text-emerald-950 font-sans">
              ৳{stats.totalPayable.toLocaleString('bn-BD')}
            </strong>
          </div>
          <div className="bg-slate-50/70 border border-slate-200 px-4 py-2 rounded-xl text-center">
            <span className="block text-[9px] text-slate-600 font-extrabold uppercase tracking-wider">মোট সংখ্যা</span>
            <strong className="text-base font-black text-slate-800 font-sans">
              {stats.count.toLocaleString('bn-BD')} টি
            </strong>
          </div>
        </div>
      </div>

      {/* FILTER PANEL */}
      <div className="bg-slate-50 p-4 border border-slate-200 rounded-2xl space-y-3.5">
        <div className="flex items-center gap-1.5 text-xs font-black text-slate-700">
          <Filter size={14} className="text-indigo-600" />
          <span>সার্চ ও অ্যাডভান্সড ফিল্টার টুলস</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
          
          {/* SEARCH BAR */}
          <div className="relative">
            <span className="absolute left-3 top-2.5 text-slate-400">
              <Search size={14} />
            </span>
            <input 
              type="text"
              placeholder="সদস্য নাম বা কোড খুঁজুন..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-white pl-9 pr-3 py-2 border border-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl text-xs font-bold transition-all focus:outline-none"
            />
          </div>

          {/* DATE FROM */}
          <div className="relative">
            <span className="absolute left-3 top-2.5 text-slate-400 pointer-events-none">
              <Calendar size={13} />
            </span>
            <input 
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full bg-white pl-9 pr-3 py-2 border border-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl text-xs font-medium focus:outline-none"
              title="শুরুর তারিখ"
            />
          </div>

          {/* DATE TO */}
          <div className="relative">
            <span className="absolute left-3 top-2.5 text-slate-400 pointer-events-none">
              <Calendar size={13} />
            </span>
            <input 
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full bg-white pl-9 pr-3 py-2 border border-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl text-xs font-medium focus:outline-none"
              title="শেষের তারিখ"
            />
          </div>

          {/* STAFF SELECT */}
          <div className="relative">
            <span className="absolute left-3 top-2.5 text-slate-400 pointer-events-none">
              <User size={13} />
            </span>
            <select
              value={selectedStaffId}
              onChange={(e) => setSelectedStaffId(e.target.value)}
              className="w-full bg-white pl-9 pr-3 py-2 border border-slate-200 focus:border-indigo-500 focus:outline-none rounded-xl text-xs font-bold"
            >
              <option value="all">সব কর্মী (Default)</option>
              {displayStaffList.map(s => (
                <option key={s.id} value={s.id || s.staffId}>
                  {s.name} ({s.designation})
                </option>
              ))}
            </select>
          </div>

          {/* GROUP SELECT */}
          <div className="relative">
            <span className="absolute left-3 top-2.5 text-slate-400 pointer-events-none">
              <Users size={13} />
            </span>
            <select
              value={selectedGroupId}
              onChange={(e) => setSelectedGroupId(e.target.value)}
              className="w-full bg-white pl-9 pr-3 py-2 border border-slate-200 focus:border-indigo-500 focus:outline-none rounded-xl text-xs font-bold"
            >
              <option value="all">সব গ্রুপ / সমিতি (Default)</option>
              {displayGroups.map(g => (
                <option key={g.id} value={g.id}>
                  {g.name} ({g.day || 'সমিতি'})
                </option>
              ))}
            </select>
          </div>

        </div>

        {/* Clear filters shortcut */}
        {(startDate || endDate || selectedStaffId !== 'all' || selectedGroupId !== 'all' || searchTerm) && (
          <div className="flex justify-end">
            <button 
              onClick={() => {
                setStartDate('');
                setEndDate('');
                setSelectedStaffId('all');
                setSelectedGroupId('all');
                setSearchTerm('');
              }}
              className="text-[10px] text-amber-700 bg-amber-100 hover:bg-amber-200 font-bold px-3 py-1 rounded-lg transition-colors cursor-pointer border-0"
            >
              রিসেট ফিল্টার
            </button>
          </div>
        )}
      </div>

      {/* DISBURSEMENTS LIST TABLE */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold text-[11px] font-sans">
                <th className="p-3.5 text-center">ক্রমিক</th>
                <th className="p-3.5">বিতরণের তারিখ</th>
                <th className="p-3.5">সদস্য ও আইডি কোড</th>
                <th className="p-3.5">সমিতি/গ্রুপ</th>
                <th className="p-3.5">প্রধান ঋণ পরিমাণ</th>
                <th className="p-3.5">ভোগ্য পরিমাণ (Payable)</th>
                <th className="p-3.5">কিস্তির পরিমাণ</th>
                <th className="p-3.5">উদ্দেশ্য</th>
                <th className="p-3.5 text-center">অ্যাকশন</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredDisbursements.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-12 text-center text-slate-400">
                    <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3 animate-pulse" />
                    <strong className="text-xs font-black block">কোনো বিতরণকৃত ঋণ রেকর্ড পাওয়া যায়নি!</strong>
                    <p className="text-[10px] text-slate-400 mt-1">ফিল্টারের মান পরিবর্তন করে চেষ্টা করুন অথবা ঋণ বিতরণ কার্যক্রম সম্পন্ন করুন।</p>
                  </td>
                </tr>
              ) : (
                filteredDisbursements.map((p: any, idx: number) => {
                  const grp = groups.find(g => g.id === p.groupId);
                  return (
                    <tr key={p.id} className="hover:bg-slate-50/80 transition-colors text-slate-700 text-xs font-semibold">
                      <td className="p-3.5 text-center text-slate-400 font-mono">
                        {(idx + 1).toLocaleString('bn-BD')}
                      </td>
                      <td className="p-3.5 font-bold text-slate-800 font-mono">
                        {p.disbursedDate || p.expectedDisburseDate ? formatDDMMYYYY(p.disbursedDate || p.expectedDisburseDate) : 'N/A'}
                      </td>
                      <td className="p-3.5">
                        <div className="font-extrabold text-[#2f6ce5]">{p.memberName}</div>
                        <div className="text-[10px] text-slate-400 font-mono mt-0.5">আইডি: {p.memberCode || p.memberId || 'N/A'}</div>
                      </td>
                      <td className="p-3.5">
                        <div className="font-bold text-slate-800">{grp ? grp.name : (p.groupName || 'N/A')}</div>
                        <div className="text-[10px] text-slate-400 mt-0.5">{grp ? `${grp.day} বার` : 'N/A'}</div>
                      </td>
                      <td className="p-3.5 font-extrabold font-mono text-slate-900">
                        ৳{(Number(p.amount) || 0).toLocaleString('bn-BD')}
                      </td>
                      <td className="p-3.5 font-extrabold font-mono text-emerald-800 bg-emerald-50/20">
                        ৳{(Number(p.totalPayable) || 0).toLocaleString('bn-BD')}
                      </td>
                      <td className="p-3.5 font-extrabold font-mono text-slate-700">
                        ৳{(Number(p.installmentAmount) || 0).toLocaleString('bn-BD')}
                      </td>
                      <td className="p-3.5 max-w-[140px] truncate text-slate-500 font-medium" title={p.purpose}>
                        {p.purpose || 'সাধারণ লোন'}
                      </td>
                      <td className="p-3.5 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button 
                            onClick={() => openEditModal(p)}
                            className="p-1 px-1.5 rounded-lg text-blue-600 hover:text-blue-800 hover:bg-blue-50 transition-colors cursor-pointer border-0"
                            title="ঋণের তথ্য সংশোধন করুন"
                          >
                            <Edit2 size={13} />
                          </button>
                          <button 
                            onClick={() => handleDelete(p.id, p.memberName, p.memberId)}
                            className="p-1 px-1.5 rounded-lg text-rose-600 hover:text-rose-800 hover:bg-rose-50 transition-colors cursor-pointer border-0"
                            title="ডিলিট করুন"
                          >
                            <Trash2 size={13} />
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

      {/* EDIT MODAL / POPUP DIALOG */}
      {editingProposal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-250">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-lg w-full overflow-hidden animate-in zoom-in-95 duration-200">
            
            {/* Modal Header */}
            <div className="bg-indigo-900 px-6 py-4.5 text-white flex justify-between items-center">
              <div>
                <h3 className="text-sm sm:text-base font-extrabold flex items-center gap-1.5 leading-tight">
                  <Edit2 size={16} />
                  <span>ঋণ বিতরণ তথ্য সংশোধন</span>
                </h3>
                <p className="text-[10px] text-white/70 block mt-0.5">সদস্য: {editingProposal.memberName}</p>
              </div>
              <button 
                onClick={() => setEditingProposal(null)}
                className="text-white/80 hover:text-white hover:bg-white/10 rounded-full p-1.5 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Form body */}
            <form onSubmit={handleSaveChanges} className="p-6 space-y-4">
              
              {editSuccessMsg && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-bold text-center animate-bounce">
                  {editSuccessMsg}
                </div>
              )}

              {/* Disbursement Date */}
              <div>
                <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-500 mb-1">বিতরণকৃত ঋণের তারিখ</label>
                <input 
                  type="date"
                  value={editDate}
                  onChange={(e) => setEditDate(e.target.value)}
                  className="w-full px-3.5 py-2 border border-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl text-xs font-bold focus:outline-none"
                  required
                />
              </div>

              {/* Grid 1: Principal Amount & Total Payable */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-500 mb-1">ঋণের পরিমাণ (প্রধান ৳)</label>
                  <input 
                    type="number"
                    value={editAmount}
                    onChange={(e) => setEditAmount(e.target.value)}
                    className="w-full px-3.5 py-2 border border-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl text-xs font-bold focus:outline-none font-mono"
                    placeholder="৳0.00"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-500 mb-1">মোট আদায়যোগ্য (৳)</label>
                  <input 
                    type="number"
                    value={editTotalPayable}
                    onChange={(e) => setEditTotalPayable(e.target.value)}
                    className="w-full px-3.5 py-2 border border-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl text-xs font-bold focus:outline-none font-mono"
                    placeholder="৳0.00"
                    required
                  />
                </div>
              </div>

              {/* Grid 2: Installment Amount & Purpose */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-500 mb-1">কিস্তির পরিমাণ (৳)</label>
                  <input 
                    type="number"
                    value={editInstallmentAmount}
                    onChange={(e) => setEditInstallmentAmount(e.target.value)}
                    className="w-full px-3.5 py-2 border border-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl text-xs font-bold focus:outline-none font-mono"
                    placeholder="৳0.00"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-500 mb-1">ঋণের উদ্দেশ্য</label>
                  <input 
                    type="text"
                    value={editPurpose}
                    onChange={(e) => setEditPurpose(e.target.value)}
                    className="w-full px-3.5 py-2 border border-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl text-xs font-bold focus:outline-none"
                    placeholder="যেমনঃ ব্যবসা সম্প্রসারণ"
                  />
                </div>
              </div>

              {/* Action Buttons footer */}
              <div className="flex justify-end pt-3 border-t border-slate-100 gap-2.5">
                <button
                  type="button"
                  onClick={() => setEditingProposal(null)}
                  className="px-4.5 py-2 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl text-xs font-black cursor-pointer"
                >
                  বাতিল করুন
                </button>
                <button
                  type="submit"
                  className="flex items-center gap-1.5 px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black shadow-md transition-all cursor-pointer"
                >
                  <Check size={14} />
                  <span>সংরক্ষণ করুন</span>
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

    </div>
  );
}
