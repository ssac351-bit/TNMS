import React, { useState, useEffect } from 'react';
import { Group, Member, Organization, Staff } from '../types';
import { Calendar, User, ArrowLeft, CheckCircle2, Wallet, Info, AlertTriangle, ShieldAlert } from 'lucide-react';

interface LoanDisburseViewProps {
  onBack: () => void;
  branchGroups: Group[];
  groupMembers: Member[];
  workingDay: string;
  org: Organization;
  staff: Staff;
  defaultGroupId?: string;
  onSuccess: (updatedMembersList: Member[], txDetails: any) => void;
  isReadOnly?: boolean;
}

export function LoanDisburseView({
  onBack,
  branchGroups,
  groupMembers,
  workingDay,
  org,
  staff,
  defaultGroupId = '',
  onSuccess,
  isReadOnly = false
}: LoanDisburseViewProps) {
  const [selectedGroupId, setSelectedGroupId] = useState(defaultGroupId);
  const [selectedProposalId, setSelectedProposalId] = useState('');
  const [disburseSource, setDisburseSource] = useState('ক্যাশ (Cash)');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Load insurance configs to calculate premium
  const loanInsurancePercent = localStorage.getItem(`tanzil_loan_ins_percent_${org.id}`) || '১';
  const loanInsuranceType = localStorage.getItem(`tanzil_loan_ins_type_${org.id}`) || 'যৌথ বীমা';

  // Load approved proposals belonging to the organization and branch
  const [proposals, setProposals] = useState<any[]>(() => {
    const saved = localStorage.getItem(`tanzil_loan_proposals_${org.id}`);
    return saved ? JSON.parse(saved) : [];
  });

  // Filter approved proposals that belong to this group
  const approvedProposalsInGroup = proposals.filter(
    (p: any) => p.groupId === selectedGroupId && p.status === 'approved'
  );

  const selectedProposal = approvedProposalsInGroup.find((p) => p.id === selectedProposalId);

  // Calculate Insurance info dynamically based on current selected proposal
  let insRate = 10.0;
  let insLabel = "";
  if (loanInsuranceType === 'যৌথ বীমা') {
    const cleanPercent = (loanInsurancePercent || '১০').replace(/[০-৯]/g, d => '০১২৩৪৫৬৭৮৯'.indexOf(d).toString());
    const parsedRate = parseFloat(cleanPercent);
    insRate = isNaN(parsedRate) || parsedRate <= 0 ? 10.0 : parsedRate;
    insLabel = `যৌথ বীমা (${insRate}% প্রিমিয়াম)`;
  } else {
    insRate = 0.5;
    insLabel = `একক বীমা (${insRate}% প্রিমিয়াম)`;
  }
  const insPremium = selectedProposal ? (selectedProposal.amount * (insRate / 100)) : 0;

  // Sync default group id
  useEffect(() => {
    if (defaultGroupId) {
      setSelectedGroupId(defaultGroupId);
    }
  }, [defaultGroupId]);

  const handleDisburseSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isReadOnly) {
      alert('শাখা ব্যবস্থাপক (BM) হিসেবে ঋণ বিতরণ কার্যক্রমে তথ্য পরিবর্তন বা বিতরণ সম্পন্ন করতে পারবেন না। এটি রিড-অনলি মোডে রয়েছে।');
      return;
    }
    setErrorMsg(null);

    if (!selectedGroupId) {
      setErrorMsg('দয়া করে প্রথমে সমিতি / গ্রুপ নির্বাচন করুন!');
      return;
    }
    if (!selectedProposalId || !selectedProposal) {
      setErrorMsg('ঋণ প্রদানের জন্য কোনো অনুমোদিত লোন প্রপোজাল নির্বাচন করা হয়নি!');
      return;
    }

    // Find the member record to apply the loan to
    const targetMember = groupMembers.find((m) => m.id === selectedProposal.memberId);
    if (!targetMember) {
      setErrorMsg('দুঃখিত, এই লোন প্রপোজালের বিপরীতে সংশ্লিষ্ট সদস্যের অ্যাকাউন্ট পাওয়া যায়নি!');
      return;
    }

    // Perform check if the member already has active outstanding loan
    if ((targetMember as any).plOutstanding && (targetMember as any).plOutstanding > 0) {
      setErrorMsg(`এই সদস্যের পূর্বের লোন এখনো অনাদায়ী রয়েছে (${(targetMember as any).plOutstanding} টাকা)। নতুন ঋণ বিতরণের পূর্বে পূর্ববর্তী ঋণ পরিশোধ করতে হবে!`);
      return;
    }

    // Prepare updated member object with full financial ledger details
    const updatedMember: Member = {
      ...targetMember,
      loanAmount: (targetMember.loanAmount || 0) + selectedProposal.amount,
      payableAmount: (targetMember.payableAmount || 0) + selectedProposal.totalPayable,
      paidAmount: targetMember.paidAmount || 0,
      // Ledger balance properties re-used matching MemberTransactionView
      // Adding plOutstanding sets the outstanding loan balance with service charge
      plOutstanding: selectedProposal.totalPayable, 
      plInstallment: selectedProposal.installmentAmount,
    } as any;

    // Save updated group member list
    const updatedMembersList = groupMembers.map((m) =>
      m.id === targetMember.id ? updatedMember : m
    );

    // Save updated proposal status to 'disbursed'
    const updatedProposals = proposals.map((p) =>
      p.id === selectedProposal.id
        ? { ...p, status: 'disbursed', disbursedDate: workingDay, insurancePremium: insPremium, insuranceLabel: insLabel, insuranceType: loanInsuranceType }
        : p
    );
    localStorage.setItem(`tanzil_loan_proposals_${org.id}`, JSON.stringify(updatedProposals));

    // Prepare the transaction log payload for BM dashboard to update state and database
    const txSummary = {
      memberId: targetMember.memberId,
      memberName: targetMember.name,
      groupName: selectedProposal.groupName,
      date: workingDay,
      netAmount: selectedProposal.amount,
      collections: { pl: 0, gs: 0, cbs: 0, lts: 0 },
      withdrawals: { gs: 0, cbs: 0 },
      isDisbursement: true,
      proposalDetail: selectedProposal,
      source: disburseSource,
      insurancePremium: insPremium,
      insuranceLabel: insLabel,
      insuranceType: loanInsuranceType
    };

    onSuccess(updatedMembersList, txSummary);
  };

  return (
    <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-4 sm:p-6 max-w-2xl mx-auto">
      {/* View Header */}
      <div className="flex justify-between items-center border-b border-slate-100 pb-3 mb-5">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg">
            <CheckCircle2 className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <h3 className="font-extrabold text-slate-800 text-sm sm:text-base">সদস্য ঋণ বিতরণ করুন (Loan Disbursal)</h3>
            <p className="text-[10px] text-slate-400 font-medium">অনুমোদিত লোন প্রপোজাল নির্বাচন করে বিতরণ সম্পন্ন করুন</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onBack}
          className="text-xs text-slate-500 hover:text-slate-700 font-bold flex items-center gap-1 cursor-pointer bg-slate-50 hover:bg-slate-100 border border-slate-200 px-3 py-1.5 rounded-xl transition-all"
        >
          <ArrowLeft size={14} /> ফিরে যান
        </button>
      </div>

      <form onSubmit={handleDisburseSubmit} className="space-y-4">
        {isReadOnly && (
          <div className="p-3 bg-amber-50 border border-amber-200 text-amber-900 rounded-xl text-xs font-bold flex items-center justify-between shadow-2xs">
            <span className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              শাখা ব্যবস্থাপক (BM) - রিড-অনলি মোড (শুধু বিতরণ তথ্য পরিদর্শন)
            </span>
            <span className="bg-amber-200 text-amber-900 text-[10px] px-2 py-0.5 rounded font-black">রিড-অনলি</span>
          </div>
        )}

        {errorMsg && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs sm:text-xs font-bold flex items-start gap-2 animate-in fade-in">
            <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Group dropdown */}
          <div>
            <label className="block text-[11px] font-extrabold text-slate-500 uppercase mb-1">১. সমিতি / গ্রুপ নির্বাচন করুন *</label>
            <select
              value={selectedGroupId}
              onChange={(e) => {
                setSelectedGroupId(e.target.value);
                setSelectedProposalId('');
              }}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-250 hover:border-[#2f6ce5]/50 focus:border-[#2f6ce5] rounded-xl text-xs sm:text-xs font-bold focus:outline-none focus:ring-1 focus:ring-[#2f6ce5] bg-white transition-all cursor-pointer"
              required
            >
              <option value="">-- সমিতি নির্বাচন করুন --</option>
              {branchGroups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name} ({g.code}) — বৈঠক বার: {g.meetingDay || 'শনিবার'}
                </option>
              ))}
            </select>
          </div>

          {/* Approved Proposals dropdown */}
          <div>
            <label className="block text-[11px] font-extrabold text-slate-500 uppercase mb-1">২. অনুমোদিত ঋণ প্রস্তাব সমূহ *</label>
            <select
              value={selectedProposalId}
              onChange={(e) => setSelectedProposalId(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-250 hover:border-[#2f6ce5]/50 focus:border-[#2f6ce5] rounded-xl text-xs sm:text-xs font-bold focus:outline-none focus:ring-1 focus:ring-[#2f6ce5] bg-white transition-all cursor-pointer"
              disabled={!selectedGroupId}
              required
            >
              <option value="">-- অনুমোদিত প্রস্তাব সিলেক্ট করুন --</option>
              {approvedProposalsInGroup.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.memberName} ({p.memberIdText}) — পরিমাণ: {p.amount}৳
                </option>
              ))}
            </select>
            {!selectedGroupId && (
              <span className="text-[10px] text-amber-600 font-semibold mt-1 block">প্রথমে একটি সমিতি সিলেক্ট করুন।</span>
            )}
            {selectedGroupId && approvedProposalsInGroup.length === 0 && (
              <span className="text-[10px] text-amber-600 font-semibold mt-1 block">এই সমিতির কোনো প্রস্তাব শাখা ব্যবস্থাপক কর্তৃক অনুমোদিত নেই।</span>
            )}
          </div>
        </div>

        {/* Selected Approved Proposal Detail Card */}
        {selectedProposal && (
          <div className="bg-emerald-50/40 rounded-2xl border border-emerald-100 p-4 animate-in fade-in space-y-3">
            <h4 className="text-xs font-bold text-emerald-800 flex items-center gap-1.5 uppercase tracking-wide">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              লোন প্রস্তাবের অনুমোদিত বিবরণী (Approved Proposal Details)
            </h4>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-y-3 gap-x-6 text-xs text-slate-700">
              <div>
                <span className="text-slate-400 block font-semibold text-[10px]">ঋণ গ্রহণকারী</span>
                <span className="font-extrabold text-slate-800">{selectedProposal.memberName}</span>
              </div>
              <div>
                <span className="text-slate-400 block font-semibold text-[10px]">সদস্য আইডি</span>
                <span className="font-mono font-extrabold text-slate-800">{selectedProposal.memberIdText}</span>
              </div>
              <div>
                <span className="text-slate-400 block font-semibold text-[10px]">মোট অনুমোদিত আসল</span>
                <span className="font-mono font-extrabold text-emerald-700">{selectedProposal.amount} BDT</span>
              </div>
              <div>
                <span className="text-slate-400 block font-semibold text-[10px]">কিস্তি সংখ্যা</span>
                <span className="font-extrabold text-slate-805">{selectedProposal.installmentsCount} কিস্তি</span>
              </div>
              <div>
                <span className="text-slate-400 block font-semibold text-[10px]">কিস্তির পরিমাণ</span>
                <span className="font-mono font-extrabold text-amber-700">{selectedProposal.installmentAmount} BDT / কিস্তি</span>
              </div>
              <div>
                <span className="text-slate-400 block font-semibold text-[10px]">মোট পরিশোধযোগ্য লোন</span>
                <span className="font-mono font-extrabold text-slate-800">{selectedProposal.totalPayable} BDT</span>
              </div>
              <div>
                <span className="text-slate-400 block font-semibold text-[10px]">ঋণের খাত</span>
                <span className="font-extrabold text-indigo-750">{selectedProposal.purpose}</span>
              </div>
              <div>
                <span className="text-slate-400 block font-semibold text-[10px]">প্রস্তাবের তারিখ</span>
                <span className="font-mono font-extrabold text-slate-700">{selectedProposal.proposalDate}</span>
              </div>
              <div>
                <span className="text-slate-400 block font-semibold text-[10px]">অনুমোদনকারী ব্যবস্থাপক</span>
                <span className="font-extrabold text-emerald-600">{selectedProposal.createdBy}</span>
              </div>
            </div>

            {/* Insurance Policy details */}
            <div className="border-t border-dashed border-emerald-250/80 pt-3 mt-3">
              <h5 className="text-[11px] font-extrabold text-indigo-750 flex items-center gap-1.5 uppercase tracking-wider mb-2">
                🛡️ বীমা পলিসি বিবরণী (Insurance Policy Details)
              </h5>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-y-3 gap-x-6 text-xs text-slate-700">
                <div>
                  <span className="text-slate-400 block font-semibold text-[10px]">পলিসি ধরণ</span>
                  <span className="font-extrabold text-slate-800">{loanInsuranceType}</span>
                </div>
                <div>
                  <span className="text-slate-400 block font-semibold text-[10px]">প্রিমিয়াম শতকরা হার</span>
                  <span className="font-mono font-extrabold text-amber-700">{insRate}%</span>
                </div>
                <div>
                  <span className="text-slate-400 block font-semibold text-[10px]">প্রিমিয়াম আদায় (নগদ)</span>
                  <span className="font-mono font-black text-rose-700">৳{insPremium.toLocaleString('bn-BD')}</span>
                </div>
              </div>
              <p className="text-[10px] text-slate-500 font-bold mt-2">
                * ঋণ বিতরণের সময় এই বীমা পলিসির প্রিমিয়াম ৳{insPremium.toLocaleString('bn-BD')} নগদ আদায় হিসেবে জমা করা হবে।
              </p>
            </div>
            
            {selectedProposal.remarks && (
              <div className="border-t border-emerald-100/60 pt-2 mt-1 select-none">
                <span className="text-slate-400 font-semibold text-[10px] block">মন্তব্য:</span>
                <p className="text-[11px] text-slate-600 font-bold italic">{selectedProposal.remarks}</p>
              </div>
            )}
          </div>
        )}

        {/* Source of Disbursed Fund and Date */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Fund Source */}
          <div>
            <label className="block text-[11px] font-extrabold text-slate-500 uppercase mb-1">৩. পরিশোধের মাধ্যম / ফান্ড সোর্স</label>
            <select
              value={disburseSource}
              onChange={(e) => setDisburseSource(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-250 hover:border-[#2f6ce5]/50 focus:border-[#2f6ce5] rounded-xl text-xs sm:text-xs font-bold focus:outline-none focus:ring-1 focus:ring-[#2f6ce5] bg-white transition-all cursor-pointer"
            >
              <option value="ক্যাশ (Cash)">ক্যাশ ফান্ড (Branch Cash柜台)</option>
              <option value="ব্যাংক একাউন্ট (Bank)">সোনালী ব্যাংক লিমিটেড (SBL)</option>
              <option value="বিকাশ / নগদ (Mobile-Banking)">বিকাশ / নগদ ডিজিটাল ফান্ড (MFS)</option>
            </select>
          </div>

          {/* Date (ওর্য়াকি ডে অনুযায়ী হবে) */}
          <div>
            <label className="block text-[11px] font-extrabold text-slate-500 uppercase mb-1 flex items-center gap-1">
              ৪. বিতরণ সম্পন্ন করার তারিখ (ওর্য়াকি ডে)
              <Info className="w-3.5 h-3.5 text-emerald-600" title="সক্রিয় কর্মদিবস অনুযায়ী নির্ধারণ" />
            </label>
            <div className="flex items-center bg-slate-100 text-slate-600 border border-slate-200 rounded-xl px-3.5 py-2.5 font-bold select-none cursor-not-allowed">
              <Calendar className="w-4 h-4 text-emerald-600 mr-2" />
              <span className="text-xs font-mono">{workingDay}</span>
            </div>
          </div>
        </div>

        {/* Important notice block */}
        <div className="bg-amber-50 rounded-2xl border border-amber-200 p-4 space-y-1.5">
          <div className="flex items-center gap-1 text-xs font-extrabold text-amber-800">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>সতর্কতা ও ঘোষণা:</span>
          </div>
          <p className="text-[10px] sm:text-[11px] font-bold text-amber-700 leading-tight">
            ঋণ বিতরণ সেভ করা মাত্রই সদস্যের অ্যাকাউন্টে <strong>{selectedProposal?.amount || 0} টাকা</strong> আসল বকেয়া যুক্ত হবে এবং এটি আর বাতিল করা সম্ভব হবে না। দয়া করে ক্যাশ টাকা যথাযথভাবে ঋণ গ্রহীতার নিকট হস্তান্তর নিশ্চিতপূর্বক বাটনটি ক্লিক করুন।
          </p>
        </div>

        {/* Action buttons */}
        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={onBack}
            className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 rounded-2xl text-xs font-bold text-slate-600 transition-colors cursor-pointer"
          >
            বাতিল করুন
          </button>
          <button
            type="submit"
            disabled={!selectedProposal || isReadOnly}
            className={`flex-1 py-3 text-white font-extrabold rounded-2xl text-xs shadow-md transition-all flex items-center justify-center gap-1.5 ${
              isReadOnly
                ? 'bg-slate-300 text-slate-500 cursor-not-allowed border border-slate-300'
                : selectedProposal
                  ? 'bg-emerald-600 hover:bg-emerald-700 hover:shadow-lg cursor-pointer'
                  : 'bg-slate-300 border-slate-200 text-slate-400 cursor-not-allowed'
            }`}
          >
            <Wallet className="w-4 h-4" /> {isReadOnly ? 'বিতরণ নিশ্চিতকরণ নিষ্ক্রিয় (রিড-অনলি)' : 'ঋণ বিতরণ নিশ্চিত করুন'}
          </button>
        </div>
      </form>
    </div>
  );
}
