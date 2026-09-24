/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { parseBanglaFloat } from '../utils/numberHelper';
import { 
  DollarSign, 
  ArrowLeft, 
  User, 
  Layers, 
  PiggyBank, 
  ShieldCheck, 
  AlertTriangle 
} from 'lucide-react';

interface AddSavingsAccountFormProps {
  onBack: () => void;
  branchGroups: any[];
  groupMembers: any[];
  savingsAccounts: any[];
  defaultGroupId?: string;
  onSuccess: (updatedAccount: any, updatedMembers: any[]) => void;
  org: any;
  workingDay?: string;
}

export const AddSavingsAccountForm: React.FC<AddSavingsAccountFormProps> = ({
  onBack,
  branchGroups,
  groupMembers,
  savingsAccounts,
  defaultGroupId = '',
  onSuccess,
  org,
  workingDay
}) => {
  const [selectedGroupId, setSelectedGroupId] = useState(defaultGroupId);
  const [selectedMemberId, setSelectedMemberId] = useState('');
  const [accountType, setAccountType] = useState<'GS' | 'FDR'>('GS');
  const [initialDeposit, setInitialDeposit] = useState('৫০০');
  const [fdrTerm, setFdrTerm] = useState('১২'); // Durations in months
  const [fdrInterestRate, setFdrInterestRate] = useState('১০'); // % Annual
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Read admission fee and rates from organization configurations
  const admissionFeeStr = org ? localStorage.getItem(`tanzil_sav_admission_fee_${org.id}`) || '১০০' : '১০০';
  const gsProfitRateStr = org ? localStorage.getItem(`tanzil_sav_profit_gs_${org.id}`) || '৬' : '৬';
  const fdrProfitConfigRateStr = org ? localStorage.getItem(`tanzil_sav_profit_fdr_${org.id}`) || '১০' : '১০';

  // Filter active members in group
  const activeMembersInGroup = groupMembers.filter(
    (m) => m.groupId === selectedGroupId && (m.status === 'active' || !m.status)
  );

  const selectedMember = activeMembersInGroup.find((m) => m.id === selectedMemberId);

  // Sync selected group from default prop
  useEffect(() => {
    if (defaultGroupId) {
      setSelectedGroupId(defaultGroupId);
    }
  }, [defaultGroupId]);

  // Sync configured FDR rate when account type / component mounts
  useEffect(() => {
    if (accountType === 'GS') {
      setInitialDeposit('৫০০');
    } else {
      setInitialDeposit('১০০০০');
      setFdrInterestRate(fdrProfitConfigRateStr);
    }
  }, [accountType, fdrProfitConfigRateStr]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!selectedGroupId) {
      setErrorMsg('দয়া করে প্রথমে একটি সমিতি / গ্রুপ নির্বাচন করুন!');
      return;
    }
    if (!selectedMemberId || !selectedMember) {
      setErrorMsg('দয়া করে হিসাব খোলার জন্য একজন সচল সদস্য নির্বাচন করুন!');
      return;
    }

    const depositAmount = Number(initialDeposit) || 0;
    if (depositAmount < 0) {
      setErrorMsg('প্রারম্ভিক জমার পরিমাণ শূন্য বা তার বেশি হতে হবে!');
      return;
    }

    if (accountType === 'GS') {
      // General Savings Limit Validation: strictly maximum 1 active GS account per member
      const hasExistingGS = savingsAccounts.some(
        (acc) => acc.memberId === selectedMemberId && acc.type === 'GS' && acc.status === 'active'
      );
      if (hasExistingGS) {
        setErrorMsg('এই সদস্যের ইতিমধ্যে একটি সাধারণ সঞ্চয় (GS) হিসাব খোলা রয়েছে! সদস্য প্রতি শুধুমাত্র ১টি সাধারণ সঞ্চয় হিসাব সক্রিয় থাকতে পারে।');
        return;
      }
    }

    // Generate Account Details
    const accountNo = `SAV-${accountType}-${Date.now().toString().slice(-6)}`;
    const newAccount = {
      id: `acc-sav-${Date.now()}`,
      accountNo,
      memberId: selectedMemberId,
      memberName: selectedMember.name,
      memberCode: selectedMember.memberId,
      groupId: selectedGroupId,
      groupName: branchGroups.find((g) => g.id === selectedGroupId)?.name || '',
      type: accountType,
      initialDeposit: depositAmount,
      balance: depositAmount,
      interestRate: accountType === 'FDR' ? parseBanglaFloat(fdrInterestRate) : parseBanglaFloat(gsProfitRateStr) || 0,
      termMonths: accountType === 'FDR' ? parseBanglaFloat(fdrTerm) : null,
      admissionFee: parseBanglaFloat(admissionFeeStr) || 0,
      date: workingDay || new Date().toISOString().split('T')[0],
      status: 'active'
    };

    // Update Member's running balance properties in state
    const updatedMembers = groupMembers.map((m) => {
      if (m.id === selectedMemberId) {
        if (accountType === 'GS') {
          const currentGS = m.gsBalance || 0;
          const currentTotal = m.savingsBalance || 0;
          return {
            ...m,
            gsBalance: currentGS + depositAmount,
            savingsBalance: currentTotal + depositAmount
          };
        } else {
          // FDR
          const currentFDR = m.fdrBalance || 0;
          return {
            ...m,
            fdrBalance: currentFDR + depositAmount
          };
        }
      }
      return m;
    });

    onSuccess(newAccount, updatedMembers);
  };

  return (
    <div className="bg-[#f4f6f9] text-slate-800 animate-in fade-in duration-300 rounded-3xl overflow-hidden border border-slate-300 max-w-lg mx-auto shadow-2xl">
      {/* HEADER SECTION */}
      <div className="bg-amber-600 text-white px-5 py-4 flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          className="p-1 -ml-1 rounded-full hover:bg-white/10 active:scale-90 transition-all cursor-pointer flex items-center justify-center"
        >
          <ArrowLeft className="w-5 h-5 text-white" />
        </button>
        <div className="text-center">
          <h2 className="font-black text-sm sm:text-base tracking-wide flex items-center gap-1.5 justify-center">
            <DollarSign className="w-4 h-4" />
            সঞ্চয় হিসাব খুলুন (Open Savings)
          </h2>
          <p className="text-[10px] text-sky-100/90 font-medium mt-0.5">জিএস (GS) ও এফডিআর (FDR) হিসাব খোলার স্ক্রিন</p>
        </div>
        <div className="w-7"></div>
      </div>

      <form onSubmit={handleSubmit} className="p-4 sm:p-5 space-y-4 font-sans leading-relaxed text-xs">
        {errorMsg && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-[11px] font-bold flex items-start gap-2 animate-in fade-in">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* SYSTEM CONFIGURATION INSIGHTS MATCHING THE CENTRAL SETTINGS */}
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2.5">
          <ShieldCheck className="w-4.5 h-4.5 text-amber-700 shrink-0 mt-0.5" />
          <div>
            <h4 className="font-extrabold text-amber-700 text-[11px] mb-0.5">অর্গানাইজেশন পলিসি সেটিংস (Active Config Rules):</h4>
            <ul className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-[10px] text-slate-600 font-bold">
              <li>• ভর্তি ফি: <span className="text-amber-850 font-mono">৳{admissionFeeStr}</span></li>
              <li>• সাধারণ সঞ্চয় মুনাফা: <span className="text-amber-850 font-mono">{gsProfitRateStr}%</span></li>
              <li>• প্রস্তাবিত এফডিআর মুনাফা: <span className="text-amber-850 font-mono">{fdrProfitConfigRateStr}%</span></li>
            </ul>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-3.5">
          <h3 className="text-amber-700 font-extrabold flex items-center gap-1.5 border-b border-slate-100 pb-2 mb-2 text-xs">
            <PiggyBank className="w-4 h-4" />
            সদস্য ও হিসাবের ধরন নির্বাচন করুন
          </h3>

          {/* Group Selector */}
          <div>
            <label className="block text-slate-500 font-black mb-1">সমিতি / গ্রুপ নির্বাচন করুন *</label>
            <select
              value={selectedGroupId}
              onChange={(e) => {
                setSelectedGroupId(e.target.value);
                setSelectedMemberId('');
              }}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-amber-500"
              required
            >
              <option value="">-- সমিতি নির্বাচন করুন --</option>
              {branchGroups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name} ({g.code})
                </option>
              ))}
            </select>
          </div>

          {/* Member Selection */}
          <div>
            <label className="block text-slate-500 font-black mb-1">সদস্য নির্বাচন করুন *</label>
            <select
              value={selectedMemberId}
              onChange={(e) => setSelectedMemberId(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-amber-500"
              disabled={!selectedGroupId}
              required
            >
              <option value="">-- সদস্য নির্বাচন করুন --</option>
              {activeMembersInGroup.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} ({m.memberId})
                </option>
              ))}
            </select>
          </div>

          {/* Choice of Saving Type */}
          <div>
            <label className="block text-slate-500 font-black mb-1.5">সঞ্চয় হিসাবের ধরন *</label>
            <div className="flex gap-4">
              <label className="flex-1 flex items-center justify-between border rounded-xl p-2.5 cursor-pointer font-black text-xs transition border-slate-250 bg-slate-50 hover:bg-amber-50/20">
                <div className="flex items-center gap-1.5">
                  <input
                    type="radio"
                    name="accountType"
                    checked={accountType === 'GS'}
                    onChange={() => setAccountType('GS')}
                    className="w-4 h-4 text-amber-600 focus:ring-amber-500"
                  />
                  <span>সাধারণ সঞ্চয় (GS)</span>
                </div>
                <span className="text-[10px] bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded font-mono">সীমা: ১টি</span>
              </label>

              <label className="flex-1 flex items-center justify-between border rounded-xl p-2.5 cursor-pointer font-black text-xs transition border-slate-250 bg-slate-50 hover:bg-amber-50/20">
                <div className="flex items-center gap-1.5">
                  <input
                    type="radio"
                    name="accountType"
                    checked={accountType === 'FDR'}
                    onChange={() => setAccountType('FDR')}
                    className="w-4 h-4 text-amber-600 focus:ring-amber-500"
                  />
                  <span>স্থায়ী আমানত (FDR)</span>
                </div>
                <span className="text-[10px] bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded font-mono">একাধিক</span>
              </label>
            </div>
          </div>
        </div>

        {/* Dynamic configurations based on Type */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-3.5">
          <h3 className="text-amber-700 font-extrabold flex items-center gap-1.5 border-b border-slate-100 pb-2 mb-2 text-xs">
            <ShieldCheck className="w-4 h-4" />
            হিসাবের বিবরণ ও জমার বিবরণী
          </h3>

          {accountType === 'FDR' && (
            <div className="grid grid-cols-2 gap-3 pb-2 animate-in slide-in-from-top-1">
              <div>
                <label className="block text-slate-500 font-black mb-1">এফডিআর মেয়াদ (FDR Period) *</label>
                <select
                  value={fdrTerm}
                  onChange={(e) => setFdrTerm(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-amber-500"
                >
                  <option value="৬">৬ মাস (6 Months)</option>
                  <option value="১২">১২ মাস (1 Year)</option>
                  <option value="২৪">২৪ মাস (2 Years)</option>
                  <option value="৩৬">৩৬ মাস (3 Years)</option>
                  <option value="৬০">৬০ মাস (5 Years)</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-500 font-black mb-1">বার্ষিক লভ্যাংশ হার (%), % Annual *</label>
                <input
                  type="number"
                  value={fdrInterestRate}
                  onChange={(e) => setFdrInterestRate(e.target.value)}
                  placeholder="যেমন: ১০"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  required
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-slate-500 font-black mb-1">
              {accountType === 'GS' ? 'প্রারম্ভিক জমা (৳) *' : 'এফডিআর জমার পরিমাণ (৳) *'}
            </label>
            <input
              type="number"
              placeholder={accountType === 'GS' ? 'যেমন: ৫০০' : 'যেমন: ৪০০০'}
              value={initialDeposit}
              onChange={(e) => setInitialDeposit(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg font-bold text-slate-850 focus:outline-none focus:ring-1 focus:ring-amber-500 text-sm"
              required
            />
          </div>
        </div>

        <button
          type="submit"
          className="w-full bg-amber-600 hover:bg-amber-700 text-white font-black py-2.5 rounded-xl cursor-pointer shadow-lg active:scale-98 transition text-xs sm:text-sm"
        >
          {accountType === 'GS' ? 'জিপি সাধারণ সঞ্চয় হিসাব অ্যাক্টিভ করুন' : 'নতুন এফডিআর হিসাব নিশ্চিত করুন'}
        </button>
      </form>
    </div>
  );
};
