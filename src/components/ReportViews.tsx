/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Branch, Staff, Holiday } from '../types';
import { formatDDMMYYYY } from '../lib/dateUtils';

interface ReportViewsProps {
  selectedReportType: string;
  branchesList: Branch[];
  staffList: Staff[];
  holidaysList: Holiday[];
  workingDay: string;
  orgName: string;
  orgAddress: string;
  orgTradeLicense: string;
  orgPhone: string;
  orgEmail: string;
  savingsAdmissionFee: string;
  savingsWelfareFee: string;
  savingsMinBalance: string;
  savProfitGS: string;
  savProfitCBS: string;
  savProfitLTS: string;
  savProfitFDR: string;
  savFdrPayoutType: string;
  loanDefaultInterest: string;
  loanInterestType: string;
  loanMinAmount: string;
  loanMaxAmount: string;
  loanDuration: string;
  loanGracePeriod: string;
  loanLateFee: string;
  loanProcessingFee: string;
  loanInsurancePercent: string;
  loanInsuranceType: string;
  mandatorySavingsPercent: string;
  instRoundingRule: string;
}

export default function ReportViews({
  selectedReportType,
  branchesList,
  staffList,
  holidaysList,
  workingDay,
  orgName,
  orgAddress,
  orgTradeLicense,
  orgPhone,
  orgEmail,
  savingsAdmissionFee,
  savingsWelfareFee,
  savingsMinBalance,
  savProfitGS,
  savProfitCBS,
  savProfitLTS,
  savProfitFDR,
  savFdrPayoutType,
  loanDefaultInterest,
  loanInterestType,
  loanMinAmount,
  loanMaxAmount,
  loanDuration,
  loanGracePeriod,
  loanLateFee,
  loanProcessingFee,
  loanInsurancePercent,
  loanInsuranceType,
  mandatorySavingsPercent,
  instRoundingRule,
}: ReportViewsProps) {
  
  if (selectedReportType === 'branches') {
    return (
      <div id="branch-registry-report" className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-6 animate-in fade-in duration-200">
        <div className="flex justify-between items-center border-b border-slate-100 pb-4">
          <div>
            <h4 className="font-extrabold text-slate-800 text-sm">শাখা ভিত্তিক সামগ্রিক প্রতিবেদন (Registered Branch Report)</h4>
            <p className="text-[11px] text-slate-400">নিবন্ধিত সকল সচল ও বন্ধ শাখা সমূহের বিবরণী রিপোর্ট</p>
          </div>
          <span className="text-[10px] text-slate-400 font-mono italic">তানজিল মাইক্রোক্রেডিট সিস্টেম</span>
        </div>

        {/* Summary badging */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-blue-50/50 p-3 rounded-xl border border-blue-105 text-center">
            <span className="text-[10px] text-slate-450 font-bold uppercase block">মোট শাখা সংখ্যা</span>
            <strong className="text-lg font-bold text-blue-700 font-mono">{branchesList.length}</strong>
          </div>
          <div className="bg-emerald-50/50 p-3 rounded-xl border border-emerald-105 text-center">
            <span className="text-[10px] text-slate-450 font-bold uppercase block">সচল শাখা (Active)</span>
            <strong className="text-lg font-bold text-emerald-700 font-mono">
              {branchesList.filter(b => b.status !== 'closed').length}
            </strong>
          </div>
          <div className="bg-rose-50/50 p-3 rounded-xl border border-rose-105 text-center">
            <span className="text-[10px] text-slate-451 font-bold uppercase block">বন্ধ শাখা (Closed)</span>
            <strong className="text-lg font-bold text-rose-700 font-mono">
              {branchesList.filter(b => b.status === 'closed').length}
            </strong>
          </div>
        </div>

        {/* Branches Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-205 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                <th className="px-4 py-2">শাখা কোড</th>
                <th className="px-4 py-2">শাখার নাম</th>
                <th className="px-4 py-2">শাখা ব্যবস্থাপক</th>
                <th className="px-4 py-2">মোবাইল ফোন নম্বর</th>
                <th className="px-4 py-2">ঠিকানা</th>
                <th className="px-4 py-2">যোগদানের তারিখ</th>
                <th className="px-4 py-2 text-center">অবস্থা</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {branchesList.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-400 italic font-semibold">
                    কোনো শাখা অফিস রেজিস্টার করা নেই!
                  </td>
                </tr>
              ) : (
                branchesList.map(b => {
                  const manager = staffList.find(s => s.branchId === b.id && s.designation === 'শাখা ব্যবস্থাপক')?.name || 'নিযুক্ত নয়';
                  return (
                    <tr key={b.id} className="hover:bg-slate-50/50">
                      <td className="px-4 py-2.5 font-mono font-bold text-slate-900">{b.code}</td>
                      <td className="px-4 py-2.5 font-bold text-slate-800">{b.name}</td>
                      <td className="px-4 py-2.5 font-semibold text-emerald-800">{manager}</td>
                      <td className="px-4 py-2.5 font-mono">{b.phone}</td>
                      <td className="px-4 py-2.5 text-slate-500">{b.address}</td>
                      <td className="px-4 py-2.5 font-mono text-slate-500">{formatDDMMYYYY(b.addDate)}</td>
                      <td className="px-4 py-2.5 text-center">
                        <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                          b.status === 'closed' ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'
                        }`}>
                          {b.status === 'closed' ? 'বন্ধ' : 'সচল'}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Sigs */}
        <div className="pt-10 grid grid-cols-2 text-center text-[10px] font-bold text-slate-400 border-t border-dashed border-slate-150">
          <div>
            <div className="w-32 border-t border-slate-300 mx-auto pt-1 mt-4">শাখা নিরীক্ষক স্বাক্ষর</div>
          </div>
          <div>
            <div className="w-32 border-t border-slate-300 mx-auto pt-1 mt-4">হেড কো-অর্ডিনেটর স্বাক্ষর</div>
          </div>
        </div>
      </div>
    );
  }

  if (selectedReportType === 'staff') {
    return (
      <div id="staff-registry-report" className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-6 animate-in fade-in duration-200">
        <div className="flex justify-between items-center border-b border-slate-101 pb-4">
          <div>
            <h4 className="font-extrabold text-slate-800 text-sm">কর্মকর্তা ও কর্মী বিস্তারিত তালিকা (Staff Directory Report)</h4>
            <p className="text-[11px] text-slate-400">এমআরএ সংস্থায় কর্মরত সকল স্থায়ী কর্মকর্তা ও মাঠ কর্মীদের তথ্য</p>
          </div>
          <span className="text-[10px] text-slate-400 font-mono italic">তানজিল মাইক্রোক্রেডিট সিস্টেম</span>
        </div>

        {/* Staff summary */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-blue-50/50 p-3 rounded-xl border border-blue-105 text-center">
            <span className="text-[10px] text-slate-450 font-bold uppercase block">মোট কর্মী সংখ্যা</span>
            <strong className="text-lg font-bold text-blue-700 font-mono">{staffList.length}</strong>
          </div>
          <div className="bg-indigo-50/50 p-3 rounded-xl border border-indigo-105 text-center">
            <span className="text-[10px] text-slate-450 font-bold uppercase block">শাখা ব্যবস্থাপক</span>
            <strong className="text-lg font-bold text-indigo-700 font-mono">
              {staffList.filter(s => s.designation === 'শাখা ব্যবস্থাপক').length}
            </strong>
          </div>
          <div className="bg-emerald-50/50 p-3 rounded-xl border border-emerald-105 text-center">
            <span className="text-[10px] text-slate-451 font-bold uppercase block">মাঠ কর্মী</span>
            <strong className="text-lg font-bold text-emerald-700 font-mono">
              {staffList.filter(s => s.designation === 'মাঠ কর্মী').length}
            </strong>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-205 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                <th className="px-4 py-2">কর্মকর্তা আইডি</th>
                <th className="px-4 py-2">নাম</th>
                <th className="px-4 py-2">পদবী</th>
                <th className="px-4 py-2">মোবাইল ফোন</th>
                <th className="px-4 py-2">কর্মরত শাখা</th>
                <th className="px-4 py-2">সরাসরি যোগদানের তারিখ</th>
                <th className="px-4 py-2">শাখা যোগদানের তারিখ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-705">
              {staffList.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-400 italic font-semibold">
                    কোনো কর্মকর্তা ডাটাবেসে নিবন্ধিত নেই।
                  </td>
                </tr>
              ) : (
                staffList.map(s => {
                  const branchName = branchesList.find(b => b.id === s.branchId)?.name || 'প্রধান কার্যালয় / অনিযুক্ত';
                  return (
                    <tr key={s.id} className="hover:bg-slate-50/50">
                      <td className="px-4 py-2.5 font-mono font-bold text-indigo-600">{s.staffId || s.id}</td>
                      <td className="px-4 py-2.5 font-bold text-slate-800">{s.name}</td>
                      <td className="px-4 py-2.5">
                        <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                          s.designation === 'শাখা ব্যবস্থাপক' ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'
                        }`}>
                          {s.designation}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 font-mono">{s.phone}</td>
                      <td className="px-4 py-2.5 font-bold text-slate-600">{branchName}</td>
                      <td className="px-4 py-2.5 font-mono text-slate-500">{formatDDMMYYYY(s.joiningDate)}</td>
                      <td className="px-4 py-2.5 font-mono text-slate-500">{s.branchJoiningDate ? formatDDMMYYYY(s.branchJoiningDate) : '-'}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Sigs */}
        <div className="pt-10 grid grid-cols-2 text-center text-[10px] font-bold text-slate-400 border-t border-dashed border-slate-150">
          <div>
            <div className="w-32 border-t border-slate-300 mx-auto pt-1 mt-4">এইচআর ও সুপারভাইজার</div>
          </div>
          <div>
            <div className="w-32 border-t border-slate-300 mx-auto pt-1 mt-4">অ্যাডমিন সেক্রেটারি স্বাক্ষর</div>
          </div>
        </div>
      </div>
    );
  }

  if (selectedReportType === 'holidays') {
    return (
      <div id="holidays-schedule-report" className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-6 animate-in fade-in duration-200">
        <div className="flex justify-between items-center border-b border-slate-101 pb-4">
          <div>
            <h4 className="font-extrabold text-slate-800 text-sm">ছুটির ক্যালেন্ডার ও বর্ষপঞ্জি (Institution Holiday List)</h4>
            <p className="text-[11px] text-slate-400">অভিভুক্ত সকল সাপ্তাহিক এবং বিশেষ সাধারণ ছুটির দিনসমূহের বিশদ বিবরণী</p>
          </div>
          <span className="text-[10px] text-slate-400 font-mono italic">তানজিল মাইক্রোক্রেডিট সিস্টেম</span>
        </div>

        {/* holiday listings */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-center">
            <span className="text-[10px] text-slate-400 font-bold block">সরাসরি বিশেষ ছুটিসমূহ</span>
            <strong className="text-lg font-bold text-slate-800 font-mono">
              {holidaysList.filter(h => h.type === 'direct').length} টি
            </strong>
          </div>
          <div className="bg-emerald-50/50 p-3 rounded-xl border border-emerald-100 text-center">
            <span className="text-[10px] text-slate-400 font-bold block">স্থায়ী সাপ্তাহিক ছুটি সমূহ</span>
            <strong className="text-lg font-bold text-emerald-700 font-mono">
              {holidaysList.filter(h => h.type === 'general').length} টি
            </strong>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-205 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                <th className="px-4 py-2">ছুটির আইডি</th>
                <th className="px-4 py-2">ছুটির ধরণ</th>
                <th className="px-4 py-2">কারণ বা বিবরণ</th>
                <th className="px-4 py-2">নির্দিষ্ট তারিখ</th>
                <th className="px-4 py-2">সাপ্তাহিক বার</th>
                <th className="px-4 py-2">ঘোষণার তারিখ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-705">
              {holidaysList.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-400 italic font-semibold">
                    তালিকায় কোনো ছুটি এন্ট্রি করা নেই!
                  </td>
                </tr>
              ) : (
                holidaysList.map(h => (
                  <tr key={h.id} className="hover:bg-slate-50/50">
                    <td className="px-4 py-2.5 font-mono font-bold text-slate-700">{h.id}</td>
                    <td className="px-4 py-2.5">
                      <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                        h.type === 'direct' ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
                      }`}>
                        {h.type === 'direct' ? 'বিশেষ ছুটি' : 'সাপ্তাহিক কর্মবিরতি'}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 font-bold text-slate-800">{h.name}</td>
                    <td className="px-4 py-2.5 font-mono text-slate-650">{h.date ? formatDDMMYYYY(h.date) : '-'}</td>
                    <td className="px-4 py-2.5 font-bold text-emerald-700">{h.dayOfWeek || '-'}</td>
                    <td className="px-4 py-2.5 font-mono text-slate-500">{formatDDMMYYYY(h.addDate)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="pt-10 grid grid-cols-2 text-center text-[10px] font-bold text-slate-400 border-t border-dashed border-slate-150">
          <div>
            <div className="w-32 border-t border-slate-300 mx-auto pt-1 mt-4">এইচআর ম্যানেজার স্বাক্ষর</div>
          </div>
          <div>
            <div className="w-32 border-t border-slate-300 mx-auto pt-1 mt-4">অডিটর সাধারণ স্বাক্ষর</div>
          </div>
        </div>
      </div>
    );
  }

  if (selectedReportType === 'policies') {
    return (
      <div id="policies-summary-report" className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-6 animate-in fade-in duration-200">
        <div className="flex justify-between items-center border-b border-slate-101 pb-4">
          <div>
            <h4 className="font-extrabold text-slate-800 text-sm">প্রাতিষ্ঠানিক নীতিমালা ও মূল কনফিগারেশন বিবরণী</h4>
            <p className="text-[11px] text-slate-400">স্মার্ট এমআরএ এনজিও সংস্থায় কার্যকর ক্ষুদ্রঋণ, সঞ্চয় মুনাফা ও বিমা সংক্রান্ত গাইডলাইন</p>
          </div>
          <span className="text-[10px] text-slate-400 font-mono italic">তানজিল মাইক্রোক্রেডিট সিস্টেম</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-xs leading-relaxed">
          {/* Section 1 */}
          <div className="space-y-3 bg-slate-50/60 p-4 rounded-xl border border-slate-200">
            <h5 className="font-extrabold text-slate-900 border-b pb-1.5 text-[11px] uppercase tracking-wider flex items-center gap-1.5">
              <span className="w-2 h-2 bg-indigo-600 rounded-full inline-block"></span>
              ১. সঞ্চয় ব্যবস্থাপনা ও সাংগঠনিক আইন
            </h5>
            <div className="space-y-1.5 text-slate-600">
              <p className="flex justify-between"><span className="text-slate-450">প্রতিষ্ঠানের নাম:</span> <strong>{orgName}</strong></p>
              <p className="flex justify-between"><span className="text-slate-450">ঠিকানা :</span> <strong className="max-w-[200px] truncate">{orgAddress}</strong></p>
              <p className="flex justify-between"><span className="text-slate-455">ট্রেড লাইসেন্স :</span> <strong className="font-mono">{orgTradeLicense}</strong></p>
              <p className="flex justify-between"><span className="text-slate-450">ফোন :</span> <strong className="font-mono">{orgPhone}</strong></p>
              <p className="flex justify-between"><span className="text-slate-450">ইমেইল :</span> <strong className="font-mono">{orgEmail}</strong></p>
              <hr className="border-slate-200 my-1.5" />
              <p className="flex justify-between"><span className="text-slate-450">সদস্য ফরম বা নতুন ভর্তি ফি:</span> <strong>৳{savingsAdmissionFee}</strong></p>
              <p className="flex justify-between"><span className="text-slate-450">সদস্য কল্যাণ চাঁদা:</span> <strong>৳{savingsWelfareFee}</strong></p>
              <p className="flex justify-between"><span className="text-slate-455">ন্যূনতম সঞ্চয় ব্যালেন্স:</span> <strong>৳{savingsMinBalance}</strong></p>
              <p className="flex justify-between"><span className="text-slate-450">সাধারণ সঞ্চয় (GS) মুনাফা হার:</span> <strong className="font-mono">{savProfitGS}%</strong></p>
              <p className="flex justify-between"><span className="text-slate-450">মূলধন সঞ্চয় (CBS) মুনাফা হার:</span> <strong className="font-mono">{savProfitCBS}%</strong></p>
              <p className="flex justify-between"><span className="text-slate-450">দীর্ঘমেয়াদী সঞ্চয় (LTS) মুনাফা হার:</span> <strong className="font-mono">{savProfitLTS}%</strong></p>
              <p className="flex justify-between"><span className="text-slate-455">ফিক্সড ডিপোজিট (FDR) মুনাফা হার :</span> <strong className="font-mono">{savProfitFDR}% ({savFdrPayoutType})</strong></p>
            </div>
          </div>

          {/* Section 2 */}
          <div className="space-y-3 bg-slate-50/60 p-4 rounded-xl border border-slate-200">
            <h5 className="font-extrabold text-slate-900 border-b pb-1.5 text-[11px] uppercase tracking-wider flex items-center gap-1.5">
              <span className="w-2 h-2 bg-blue-600 rounded-full inline-block"></span>
              ২. ঋণ স্কিম ও অন্যান্য আর্থিক পলিসি
            </h5>
            <div className="space-y-1.5 text-slate-600">
              <p className="flex justify-between"><span className="text-slate-450">বার্ষিক ডিফল্ট সুদের হার:</span> <strong className="font-mono">{loanDefaultInterest}%</strong></p>
              <p className="flex justify-between"><span className="text-slate-450">সুদের হিসাব পদ্ধতি :</span> <strong>{loanInterestType}</strong></p>
              <p className="flex justify-between"><span className="text-slate-450">ঋণের আসল সীমা (সর্বনিম্ন):</span> <strong>৳{parseFloat(loanMinAmount).toLocaleString('bn-BD')}</strong></p>
              <p className="flex justify-between"><span className="text-slate-450">ঋণের আসল সীমা (সর্বোচ্চ):</span> <strong>৳{parseFloat(loanMaxAmount).toLocaleString('bn-BD')}</strong></p>
              <p className="flex justify-between"><span className="text-slate-450">ঋণের মেয়াদ:</span> <strong>{loanDuration}</strong></p>
              <p className="flex justify-between"><span className="text-slate-450">ঋণের গ্রেস পিরিয়ড:</span> <strong>{loanGracePeriod}</strong></p>
              <p className="flex justify-between"><span className="text-slate-450">বিলম্ব জরিমানা (Late Fee):</span> <strong>৳{loanLateFee}</strong></p>
              <p className="flex justify-between"><span className="text-slate-450">ঋণ প্রসেসিং ফরম ফি:</span> <strong>৳{loanProcessingFee}</strong></p>
              <hr className="border-slate-200 my-1.5" />
              <p className="flex justify-between"><span className="text-slate-450">বীমা প্রিমিয়াম শতকরা হার:</span> <strong className="font-mono">{loanInsurancePercent}%</strong></p>
              <p className="flex justify-between"><span className="text-slate-450">বীমা নির্ধারণ ডিফল্ট পলিসি:</span> <strong className="font-bold text-amber-800">{loanInsuranceType}</strong></p>
              <p className="flex justify-between"><span className="text-slate-450">বাধ্যতামূলক সঞ্চয় অনুপাত (আসল %):</span> <strong className="font-mono">{mandatorySavingsPercent}%</strong></p>
              <p className="flex justify-between"><span className="text-slate-450">কিস্তির রাউন্ডিং নিয়ম :</span> <strong className="font-semibold text-indigo-850">{instRoundingRule}</strong></p>
            </div>
          </div>
        </div>

        <div className="bg-blue-50/40 p-3.5 rounded-xl border border-blue-100 text-[10.5px] leading-relaxed text-blue-900 font-medium">
          ℹ️ <strong>মতামত :</strong> এই সামগ্রিক পলিসি বিবরণীটি এমআরএ বোর্ডের প্রধান নীতি সমূহের অনুকূলে তৈরি করা হয়েছে। এখানে প্রদর্শিত সকল প্যারামিটার রিয়েল-টাইম ডাটা ট্র্যাকিংয়ে সক্রিয় ভূমিকা পালন করছে।
        </div>

        <div className="pt-10 grid grid-cols-2 text-center text-[10px] font-bold text-slate-400 border-t border-dashed border-slate-150">
          <div>
            <div className="w-32 border-t border-slate-300 mx-auto pt-1 mt-4">অর্থ পরিচালক স্বাক্ষর</div>
          </div>
          <div>
            <div className="w-32 border-t border-slate-300 mx-auto pt-1 mt-4">ডিরেক্টর জেনারেল স্বাক্ষর</div>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
