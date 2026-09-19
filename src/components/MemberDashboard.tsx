/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  User, CreditCard, DollarSign, BookOpen, LogOut, FileText, 
  ShieldCheck, Phone, MapPin, Calendar, Clock, Lock, CheckCircle2, 
  Send, RefreshCw, Printer, ChevronRight, Award, Key, Sparkles
} from 'lucide-react';
import { Organization, Member } from '../types';
import { TanzilLogo } from './TanzilLogo';
import { MemberPassbook } from './MemberPassbook';

interface MemberDashboardProps {
  org: Organization;
  member: Member;
  onLogout: () => void;
}

export default function MemberDashboard({ org, member: initialMember, onLogout }: MemberDashboardProps) {
  const [member, setMember] = useState<Member>(initialMember);
  const [activeTab, setActiveTab] = useState<'overview' | 'passbook' | 'loans' | 'apply' | 'documents' | 'password'>('overview');
  
  // Member's transactions & accounts state
  const [transactions, setTransactions] = useState<any[]>([]);
  const [cbsAccounts, setCbsAccounts] = useState<any[]>([]);
  const [ltsAccounts, setLtsAccounts] = useState<any[]>([]);
  const [savingsAccounts, setSavingsAccounts] = useState<any[]>([]);

  // Loan application form
  const [loanAppAmount, setLoanAppAmount] = useState('');
  const [loanAppPurpose, setLoanAppPurpose] = useState('');
  const [loanAppType, setLoanAppType] = useState('ক্ষুদ্র ব্যবসা ঋণ');
  const [loanAppSuccess, setLoanAppSuccess] = useState(false);

  // Password change form
  const [currentPass, setCurrentPass] = useState('');
  const [newPass, setNewPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [passMsg, setPassMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Load fresh member data & transactions on mount
  useEffect(() => {
    // 1. Reload member profile
    const savedMembersStr = localStorage.getItem(`tanzil_group_members_${org.id}`);
    if (savedMembersStr) {
      try {
        const memberList: Member[] = JSON.parse(savedMembersStr);
        const fresh = memberList.find(m => m.id === member.id || m.memberId === member.memberId);
        if (fresh) {
          setMember(fresh);
        }
      } catch (e) {
        console.error("Error refreshing member data:", e);
      }
    }

    // 2. Load member's transactions across branches
    const branchTxs: any[] = [];
    const savedBranches = localStorage.getItem(`tanzil_branches_${org.id}`);
    const branches = savedBranches ? JSON.parse(savedBranches) : [];

    // Search transactions in branch transaction storages
    branches.forEach((b: any) => {
      const bTxsStr = localStorage.getItem(`tanzil_bm_tx_${org.id}_${b.id}`);
      if (bTxsStr) {
        try {
          const list = JSON.parse(bTxsStr);
          const mList = list.filter((t: any) => 
            t.memberId === member.id || 
            t.memberId === member.memberId ||
            t.memberCode === member.memberId ||
            t.memberName === member.name
          );
          branchTxs.push(...mList);
        } catch (err) {
          console.error(err);
        }
      }
    });

    // Also check global member transactions
    const genTxs = JSON.parse(localStorage.getItem(`tanzil_tx_${org.id}_member_${member.id}`) || '[]');
    const mergedTxs = [...branchTxs, ...genTxs];
    
    // Sort by date descending
    mergedTxs.sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());
    
    // De-duplicate by ID
    const uniqueTxs = mergedTxs.filter((v, idx, a) => a.findIndex(t => t.id === v.id) === idx);
    setTransactions(uniqueTxs);

    // 3. Load savings/CBS/LTS accounts
    const cbsList = JSON.parse(localStorage.getItem(`tanzil_cbs_accounts_${org.id}`) || '[]');
    const ltsList = JSON.parse(localStorage.getItem(`tanzil_lts_accounts_${org.id}`) || '[]');
    const savList = JSON.parse(localStorage.getItem(`tanzil_savings_accounts_${org.id}`) || '[]');

    setCbsAccounts(cbsList.filter((a: any) => a.memberId === member.id || a.memberId === member.memberId));
    setLtsAccounts(ltsList.filter((a: any) => a.memberId === member.id || a.memberId === member.memberId));
    setSavingsAccounts(savList.filter((a: any) => a.memberId === member.id || a.memberId === member.memberId));

  }, [org.id, member.id, member.memberId]);

  // Handle password update
  const handleChangePassword = (e: React.FormEvent) => {
    e.preventDefault();
    setPassMsg(null);

    const savedPass = localStorage.getItem('tanzil_session_password') || member.phone || '123456';
    if (currentPass !== savedPass && currentPass !== (member.phone || '123456')) {
      setPassMsg({ type: 'error', text: 'বর্তমান পাসওয়ার্ড সঠিক নয়!' });
      return;
    }

    if (newPass.length < 4) {
      setPassMsg({ type: 'error', text: 'নতুন পাসওয়ার্ড অন্তত ৪ অক্ষরের হতে হবে!' });
      return;
    }

    if (newPass !== confirmPass) {
      setPassMsg({ type: 'error', text: 'নতুন পাসওয়ার্ড ও কনফার্ম পাসওয়ার্ড মিলছে না!' });
      return;
    }

    // Update in localStorage group members
    const savedMembersStr = localStorage.getItem(`tanzil_group_members_${org.id}`);
    if (savedMembersStr) {
      try {
        const memberList: Member[] = JSON.parse(savedMembersStr);
        const updatedList = memberList.map(m => {
          if (m.id === member.id || m.memberId === member.memberId) {
            return { ...m, password: newPass };
          }
          return m;
        });
        localStorage.setItem(`tanzil_group_members_${org.id}`, JSON.stringify(updatedList));
        localStorage.setItem('tanzil_session_password', newPass);
        
        setMember(prev => ({ ...prev, password: newPass }));
        setPassMsg({ type: 'success', text: 'পাসওয়ার্ড সফলভাবে পরিবর্তন করা হয়েছে!' });
        setCurrentPass('');
        setNewPass('');
        setConfirmPass('');
      } catch (err) {
        setPassMsg({ type: 'error', text: 'পাসওয়ার্ড আপডেট করতে ব্যর্থ হয়েছে।' });
      }
    }
  };

  // Handle Loan Proposal submit from member
  const handleApplyLoan = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(loanAppAmount);
    if (!amt || amt <= 0) {
      alert('সঠিক ঋণের পরিমাণ লিখুন');
      return;
    }

    const newProposal = {
      id: `prop-mb-${Date.now()}`,
      orgId: org.id,
      memberId: member.id,
      memberCode: member.memberId,
      memberName: member.name,
      amount: amt,
      purpose: loanAppPurpose || 'সদস্য পোর্টাল থেকে আবেদন',
      loanType: loanAppType,
      status: 'pending',
      date: new Date().toISOString().split('T')[0],
      source: 'member_portal'
    };

    const existingProps = JSON.parse(localStorage.getItem(`tanzil_loan_proposals_${org.id}`) || '[]');
    localStorage.setItem(`tanzil_loan_proposals_${org.id}`, JSON.stringify([newProposal, ...existingProps]));

    setLoanAppSuccess(true);
    setLoanAppAmount('');
    setLoanAppPurpose('');
  };

  // Calculations
  const sharePrice = Number(localStorage.getItem(`tanzil_share_price_${org.id}`)) || 10;
  const shareCount = Number((member as any).shareCount) || 1;
  const shareVal = Number((member as any).shareBalance) || (shareCount * sharePrice);

  const gsBal = Number(member.gsBalance) || Number(member.savingsBalance) || 0;
  const cbsBal = Number(member.cbsBalance) || cbsAccounts.reduce((acc, a) => acc + (Number(a.balance) || 0), 0);
  const ltsBal = Number(member.ltsBalance) || ltsAccounts.reduce((acc, a) => acc + (Number(a.balance) || 0), 0);
  const totalSavings = gsBal + cbsBal + ltsBal;

  const loanOutstanding = Number((member as any).plOutstanding) || Math.max(0, (member.loanAmount || 0) - (member.paidAmount || 0));

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans">
      
      {/* Top Bar / হেডার */}
      <header className="bg-slate-900 text-white shadow-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <TanzilLogo size={36} iconMode={true} />
            <div>
              <h1 className="text-sm sm:text-base font-black text-white tracking-tight flex items-center gap-2">
                {org.name}
                <span className="bg-blue-600/90 text-white text-[10px] px-2 py-0.5 rounded-full font-bold">
                  সদস্য পোর্টাল
                </span>
              </h1>
              <p className="text-[11px] text-slate-400 font-medium">
                স্বাগতম, <span className="text-amber-400 font-bold">{member.name}</span> (আইডি: {member.memberId || 'M1001'})
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onLogout}
              className="bg-rose-600/90 hover:bg-rose-700 text-white px-3 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 shadow-sm active:scale-95 cursor-pointer"
            >
              <LogOut size={14} />
              <span>লগআউট</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 flex-1 w-full space-y-6">
        
        {/* Profile Greeting Banner */}
        <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-indigo-900 rounded-3xl p-6 text-white shadow-xl relative overflow-hidden">
          <div className="absolute -right-8 -bottom-8 opacity-10 pointer-events-none">
            <Award size={220} />
          </div>

          <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-amber-400 font-black text-2xl shadow-inner shrink-0">
                {member.name ? member.name.charAt(0) : 'M'}
              </div>

              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white">{member.name}</h2>
                  <span className="bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 text-[11px] px-2.5 py-0.5 rounded-full font-bold flex items-center gap-1">
                    <CheckCircle2 size={12} />
                    সক্রিয় সদস্য
                  </span>
                </div>

                <div className="flex items-center gap-4 text-xs text-slate-300 font-medium flex-wrap">
                  <span className="flex items-center gap-1">
                    <User size={13} className="text-blue-400" />
                    আইডি: <strong className="text-white font-mono">{member.memberId || 'N/A'}</strong>
                  </span>
                  <span className="flex items-center gap-1">
                    <Phone size={13} className="text-emerald-400" />
                    ফোন: <strong className="text-white font-mono">{member.phone || 'N/A'}</strong>
                  </span>
                  <span className="flex items-center gap-1">
                    <Calendar size={13} className="text-amber-400" />
                    যোগদান: <strong className="text-white">{member.addDate || 'N/A'}</strong>
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-white/10 backdrop-blur-md border border-white/15 rounded-2xl p-3 px-5 text-right space-y-0.5 min-w-[180px]">
              <div className="text-[10px] text-slate-300 font-bold uppercase tracking-wider">মোট নিট আমানত (জমা)</div>
              <div className="text-2xl font-black text-amber-400 font-mono">
                ৳{(totalSavings + shareVal).toLocaleString('bn-BD')}
              </div>
              <div className="text-[10px] text-slate-300">শেয়ার + সঞ্চয় ব্যালেন্স</div>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 border-b border-slate-200 overflow-x-auto pb-1 scrollbar-none">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-4 py-2.5 rounded-xl text-xs font-black transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
              activeTab === 'overview'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                : 'bg-white text-slate-600 hover:bg-slate-200/60 border border-slate-200'
            }`}
          >
            <DollarSign size={15} />
            আর্থিক সংক্ষিপ্ত বিবরণ
          </button>

          <button
            onClick={() => setActiveTab('passbook')}
            className={`px-4 py-2.5 rounded-xl text-xs font-black transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
              activeTab === 'passbook'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                : 'bg-white text-slate-600 hover:bg-slate-200/60 border border-slate-200'
            }`}
          >
            <BookOpen size={15} />
            ডিজিটাল পাসবুক ও স্টেটমেন্ট
          </button>

          <button
            onClick={() => setActiveTab('apply')}
            className={`px-4 py-2.5 rounded-xl text-xs font-black transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
              activeTab === 'apply'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                : 'bg-white text-slate-600 hover:bg-slate-200/60 border border-slate-200'
            }`}
          >
            <Send size={15} />
            ঋণ আবেদন (Loan Request)
          </button>

          <button
            onClick={() => setActiveTab('password')}
            className={`px-4 py-2.5 rounded-xl text-xs font-black transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
              activeTab === 'password'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                : 'bg-white text-slate-600 hover:bg-slate-200/60 border border-slate-200'
            }`}
          >
            <Key size={15} />
            পাসওয়ার্ড পরিবর্তন
          </button>
        </div>

        {/* TAB 1: OVERVIEW */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            
            {/* Quick Stat Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              
              {/* Card 1: Share Capital */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-2 hover:shadow-md transition-shadow">
                <div className="flex justify-between items-center text-slate-500 text-xs font-bold">
                  <span>শেয়ার মূলধন (Shares)</span>
                  <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
                    <CreditCard size={18} />
                  </div>
                </div>
                <div className="text-2xl font-black text-slate-900 font-mono">
                  ৳{shareVal.toLocaleString('bn-BD')}
                </div>
                <div className="text-[11px] font-bold text-emerald-700 bg-emerald-50 inline-block px-2 py-0.5 rounded-lg border border-emerald-100">
                  মোট শেয়ার: {shareCount} টি (৳{sharePrice}/টি)
                </div>
              </div>

              {/* Card 2: General Savings */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-2 hover:shadow-md transition-shadow">
                <div className="flex justify-between items-center text-slate-500 text-xs font-bold">
                  <span>সাধারণ সঞ্চয় (GS Balance)</span>
                  <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                    <DollarSign size={18} />
                  </div>
                </div>
                <div className="text-2xl font-black text-blue-700 font-mono">
                  ৳{gsBal.toLocaleString('bn-BD')}
                </div>
                <div className="text-[11px] font-bold text-blue-700 bg-blue-50 inline-block px-2 py-0.5 rounded-lg border border-blue-100">
                  সাপ্তাহিক/মাসিক সাধারণ আমানত
                </div>
              </div>

              {/* Card 3: Special Savings (CBS/LTS) */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-2 hover:shadow-md transition-shadow">
                <div className="flex justify-between items-center text-slate-500 text-xs font-bold">
                  <span>বিশেষ সঞ্চয় (CBS / LTS)</span>
                  <div className="p-2 bg-purple-50 text-purple-600 rounded-xl">
                    <BookOpen size={18} />
                  </div>
                </div>
                <div className="text-2xl font-black text-purple-700 font-mono">
                  ৳{(cbsBal + ltsBal).toLocaleString('bn-BD')}
                </div>
                <div className="text-[11px] font-bold text-purple-700 bg-purple-50 inline-block px-2 py-0.5 rounded-lg border border-purple-100">
                  CBS: ৳{cbsBal.toLocaleString('bn-BD')} | LTS: ৳{ltsBal.toLocaleString('bn-BD')}
                </div>
              </div>

              {/* Card 4: Loan Outstanding */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-2 hover:shadow-md transition-shadow">
                <div className="flex justify-between items-center text-slate-500 text-xs font-bold">
                  <span>চলতি মোট ঋণ বকেয়া</span>
                  <div className="p-2 bg-rose-50 text-rose-600 rounded-xl">
                    <CreditCard size={18} />
                  </div>
                </div>
                <div className="text-2xl font-black text-rose-700 font-mono">
                  ৳{loanOutstanding.toLocaleString('bn-BD')}
                </div>
                <div className="text-[11px] font-bold text-rose-700 bg-rose-50 inline-block px-2 py-0.5 rounded-lg border border-rose-100">
                  {loanOutstanding > 0 ? `মূল ঋণ: ৳${(member.loanAmount || 0).toLocaleString('bn-BD')}` : 'বর্তমানে কোনো ঋণ বকেয়া নেই'}
                </div>
              </div>

            </div>

            {/* Savings & Loan Details Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              
              {/* Left Column: Account Summary List */}
              <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4 shadow-xs">
                <h3 className="font-extrabold text-slate-800 text-sm border-b border-slate-100 pb-3 flex items-center gap-2">
                  <BookOpen className="text-blue-600" size={16} />
                  আমার সঞ্চয় ও আমানত হিসাব তালিকা
                </h3>

                <div className="space-y-3">
                  
                  {/* General Savings Account */}
                  <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 flex justify-between items-center">
                    <div>
                      <div className="font-bold text-xs text-slate-800">সাধারণ সঞ্চয় হিসাব (General Savings)</div>
                      <div className="text-[11px] text-slate-500 font-mono">অ্যাকাউন্ট নং: GS-{member.memberId || '101'}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-black text-sm text-blue-700 font-mono">৳{gsBal.toLocaleString('bn-BD')}</div>
                      <div className="text-[10px] text-emerald-600 font-bold">সচল (Active)</div>
                    </div>
                  </div>

                  {/* Share Capital Account */}
                  <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 flex justify-between items-center">
                    <div>
                      <div className="font-bold text-xs text-slate-800">শেয়ার অ্যাকাউন্ট (Share Capital)</div>
                      <div className="text-[11px] text-slate-500 font-mono">শেয়ার সংখ্যা: {shareCount} টি</div>
                    </div>
                    <div className="text-right">
                      <div className="font-black text-sm text-emerald-700 font-mono">৳{shareVal.toLocaleString('bn-BD')}</div>
                      <div className="text-[10px] text-emerald-600 font-bold">সংরক্ষিত মূলধন</div>
                    </div>
                  </div>

                  {/* CBS Accounts */}
                  {cbsAccounts.map((acc, idx) => (
                    <div key={idx} className="p-3.5 bg-purple-50/50 rounded-xl border border-purple-100 flex justify-between items-center">
                      <div>
                        <div className="font-bold text-xs text-purple-900">ডিপিআর / মেয়াদী সঞ্চয় (CBS)</div>
                        <div className="text-[11px] text-purple-700 font-mono">অ্যাকাউন্ট: {acc.accountNo || `CBS-${idx+1}`}</div>
                      </div>
                      <div className="text-right">
                        <div className="font-black text-sm text-purple-800 font-mono">৳{(Number(acc.balance) || 0).toLocaleString('bn-BD')}</div>
                        <div className="text-[10px] text-purple-600 font-bold">মাসে ৳{acc.monthlyDeposit || 500}</div>
                      </div>
                    </div>
                  ))}

                  {/* LTS Accounts */}
                  {ltsAccounts.map((acc, idx) => (
                    <div key={idx} className="p-3.5 bg-amber-50/50 rounded-xl border border-amber-100 flex justify-between items-center">
                      <div>
                        <div className="font-bold text-xs text-amber-900">দীর্ঘমেয়াদী ডিপিএস (LTS)</div>
                        <div className="text-[11px] text-amber-700 font-mono">অ্যাকাউন্ট: {acc.accountNo || `LTS-${idx+1}`}</div>
                      </div>
                      <div className="text-right">
                        <div className="font-black text-sm text-amber-800 font-mono">৳{(Number(acc.balance) || 0).toLocaleString('bn-BD')}</div>
                        <div className="text-[10px] text-amber-600 font-bold">মেয়াদ: {acc.termYears || 5} বছর</div>
                      </div>
                    </div>
                  ))}

                </div>
              </div>

              {/* Right Column: Loan Information */}
              <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4 shadow-xs">
                <h3 className="font-extrabold text-slate-800 text-sm border-b border-slate-100 pb-3 flex items-center gap-2">
                  <CreditCard className="text-rose-600" size={16} />
                  চলতি ঋণ ও কিস্তি বিবরণী
                </h3>

                {loanOutstanding > 0 ? (
                  <div className="space-y-4">
                    <div className="p-4 bg-rose-50/60 rounded-2xl border border-rose-100 space-y-2">
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-bold text-rose-900">মঞ্জুরীকৃত মোট ঋণ:</span>
                        <span className="font-black text-slate-900 font-mono">৳{(member.loanAmount || 0).toLocaleString('bn-BD')}</span>
                      </div>
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-bold text-rose-900">পরিশোধিত মোট পরিমাণ:</span>
                        <span className="font-black text-emerald-700 font-mono">৳{(member.paidAmount || 0).toLocaleString('bn-BD')}</span>
                      </div>
                      <div className="flex justify-between items-center text-xs pt-2 border-t border-rose-200/60">
                        <span className="font-black text-rose-950 text-sm">অবশিষ্ট আসল বকেয়া:</span>
                        <span className="font-black text-rose-700 text-base font-mono">৳{loanOutstanding.toLocaleString('bn-BD')}</span>
                      </div>
                    </div>

                    <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-1 text-xs">
                      <div className="flex justify-between">
                        <span className="text-slate-500 font-bold">প্রতি কিস্তির পরিমাণ:</span>
                        <span className="font-black text-slate-800 font-mono">৳{(member as any).plInstallment || Math.round((member.loanAmount || 0) / 46)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500 font-bold">কিস্তি পরিশোধের ধরণ:</span>
                        <span className="font-bold text-slate-800">সাপ্তাহিক (Weekly)</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="py-8 text-center space-y-2">
                    <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                      <CheckCircle2 size={24} />
                    </div>
                    <div className="font-bold text-xs text-slate-800">আপনার বর্তমানে কোনো বকেয়া ঋণ নেই!</div>
                    <p className="text-[11px] text-slate-500">প্রয়োজনে ঋণ আবেদনের ট্যাব থেকে নতুন ঋণের জন্য আবেদন করতে পারেন।</p>
                  </div>
                )}
              </div>

            </div>

            {/* Recent Transactions Preview */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4 shadow-xs">
              <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                <h3 className="font-extrabold text-slate-800 text-sm flex items-center gap-2">
                  <Clock className="text-blue-600" size={16} />
                  সর্বশেষ লেনদেনসমূহ (Recent Activity)
                </h3>
                <button
                  onClick={() => setActiveTab('passbook')}
                  className="text-xs font-bold text-blue-600 hover:underline flex items-center gap-1"
                >
                  সবগুলো দেখুন <ChevronRight size={14} />
                </button>
              </div>

              {transactions.length === 0 ? (
                <div className="py-6 text-center text-xs text-slate-400 font-bold">
                  কোনো সাম্প্রতিক লেনদেন পাওয়া যায়নি।
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left text-slate-700">
                    <thead className="bg-slate-50 text-slate-600 uppercase text-[10px] font-extrabold">
                      <tr>
                        <th className="p-2.5">তারিখ</th>
                        <th className="p-2.5">বিবরণ / খাত</th>
                        <th className="p-2.5 text-right">জমা (৳)</th>
                        <th className="p-2.5 text-right">উত্তোলন/পরিশোধ (৳)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium">
                      {transactions.slice(0, 5).map((tx, idx) => {
                        const isDeposit = tx.type === 'savings_deposit' || tx.deposit > 0 || tx.amount > 0;
                        return (
                          <tr key={idx} className="hover:bg-slate-50/80">
                            <td className="p-2.5 font-mono text-slate-500">{tx.date || 'N/A'}</td>
                            <td className="p-2.5 font-bold text-slate-800">{tx.note || tx.type || 'আদায়/জমা'}</td>
                            <td className="p-2.5 text-right font-mono font-bold text-emerald-700">
                              {isDeposit ? `৳${(tx.amount || tx.deposit || 0).toLocaleString('bn-BD')}` : '-'}
                            </td>
                            <td className="p-2.5 text-right font-mono font-bold text-rose-700">
                              {!isDeposit ? `৳${(tx.amount || tx.withdraw || 0).toLocaleString('bn-BD')}` : '-'}
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

        {/* TAB 2: DIGITAL PASSBOOK */}
        {activeTab === 'passbook' && (
          <div className="space-y-4">
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
              <MemberPassbook txs={transactions} />
            </div>
          </div>
        )}

        {/* TAB 3: APPLY FOR LOAN */}
        {activeTab === 'apply' && (
          <div className="bg-white rounded-2xl border border-slate-200 p-6 max-w-xl mx-auto shadow-sm space-y-4">
            <h3 className="font-extrabold text-slate-800 text-sm border-b border-slate-100 pb-3 flex items-center gap-2">
              <Send className="text-blue-600" size={16} />
              নতুন ঋণ বা আমানত স্কিমের জন্য আবেদন করুন
            </h3>

            {loanAppSuccess ? (
              <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl text-center space-y-2">
                <CheckCircle2 size={32} className="text-emerald-600 mx-auto" />
                <div className="font-black text-sm">আপনার ঋণের আবেদন সফলভাবে জমা নেওয়া হয়েছে!</div>
                <p className="text-xs text-emerald-700">শাখা ব্যবস্থাপক ও ফিল্ড অফিসার যাচাই-বাছাইপূর্বক আপনার প্রস্তাবটি পর্যালোচনা করবেন।</p>
                <button
                  onClick={() => setLoanAppSuccess(false)}
                  className="mt-2 px-4 py-1.5 bg-emerald-600 text-white rounded-xl text-xs font-bold"
                >
                  নতুন আবেদন তৈরি করুন
                </button>
              </div>
            ) : (
              <form onSubmit={handleApplyLoan} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">প্রার্থিত ঋণের পরিমাণ (টাকা) *</label>
                  <input
                    type="number"
                    min="1000"
                    step="1000"
                    placeholder="যেমন: ৫০,০০০"
                    value={loanAppAmount}
                    onChange={(e) => setLoanAppAmount(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm font-bold font-mono outline-none focus:border-blue-600"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">ঋণের প্রোডাক্ট/টাইপ</label>
                  <select
                    value={loanAppType}
                    onChange={(e) => setLoanAppType(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:border-blue-600"
                  >
                    <option value="ক্ষুদ্র ব্যবসা ঋণ">ক্ষুদ্র ব্যবসা ঋণ (Microbusiness Loan)</option>
                    <option value="কৃষি ও গবাদিপশু ঋণ">কৃষি ও গবাদিপশু ঋণ (Agri Loan)</option>
                    <option value="জরুরি ঋণ">জরুরি স্বাস্থ্য/শিক্ষা ঋণ (Emergency Loan)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">ঋণ ব্যবহারের উদ্দেশ্য/নোট</label>
                  <textarea
                    rows={3}
                    placeholder="যেমন: দোকানে নতুন মালামাল ক্রয় অথবা গাভী পালন..."
                    value={loanAppPurpose}
                    onChange={(e) => setLoanAppPurpose(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:border-blue-600"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-black text-xs rounded-xl shadow-md cursor-pointer transition-all active:scale-95 flex items-center justify-center gap-2"
                >
                  <Send size={15} />
                  <span>আবেদন জমা দিন</span>
                </button>
              </form>
            )}
          </div>
        )}

        {/* TAB 4: CHANGE PASSWORD */}
        {activeTab === 'password' && (
          <div className="bg-white rounded-2xl border border-slate-200 p-6 max-w-md mx-auto shadow-sm space-y-4">
            <h3 className="font-extrabold text-slate-800 text-sm border-b border-slate-100 pb-3 flex items-center gap-2">
              <Lock className="text-blue-600" size={16} />
              পাসওয়ার্ড পরিবর্তন করুন
            </h3>

            {passMsg && (
              <div className={`p-3 rounded-xl text-xs font-bold ${
                passMsg.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'
              }`}>
                {passMsg.text}
              </div>
            )}

            <form onSubmit={handleChangePassword} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">বর্তমান পাসওয়ার্ড (বা ফোন নম্বর)</label>
                <input
                  type="password"
                  value={currentPass}
                  onChange={(e) => setCurrentPass(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:border-blue-600"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">নতুন পাসওয়ার্ড</label>
                <input
                  type="password"
                  value={newPass}
                  onChange={(e) => setNewPass(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:border-blue-600"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">নতুন পাসওয়ার্ড পুনরায় লিখুন</label>
                <input
                  type="password"
                  value={confirmPass}
                  onChange={(e) => setConfirmPass(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:border-blue-600"
                  required
                />
              </div>

              <button
                type="submit"
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-black text-xs rounded-xl shadow-md cursor-pointer transition-all active:scale-95"
              >
                পাসওয়ার্ড আপডেট করুন
              </button>
            </form>
          </div>
        )}

      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-3 text-center text-[11px] text-slate-400 font-medium">
        {org.name} - সদস্য ডিজিটাল সেবা ও পাসবুক সিস্টেম | Tanzil Microcredit Portal
      </footer>
    </div>
  );
}
