/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { parseBanglaFloat, convertBanglaToEnglishNumber } from '../utils/numberHelper';
import { 
  UserPlus, 
  ArrowLeft, 
  ShieldCheck, 
  Building, 
  User, 
  FileText, 
  MapPin, 
  CheckCircle,
  AlertCircle
} from 'lucide-react';

interface MemberAdmissionFormProps {
  onBack: () => void;
  branchGroups: any[];
  staff: any;
  org: any;
  defaultGroupId: string;
  existingMembersCount: number;
  onSuccess: (newMember: any) => void;
  workingDay?: string;
}

export const MemberAdmissionForm: React.FC<MemberAdmissionFormProps> = ({
  onBack,
  branchGroups,
  staff,
  org,
  defaultGroupId,
  existingMembersCount,
  onSuccess,
  workingDay
}) => {
  // Current active group for pre-filling
  const initialGroupId = defaultGroupId || (branchGroups.length > 0 ? branchGroups[0].id : '');
  
  // 1. Personal Information (ব্যক্তিগত তথ্য)
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [fatherHusbandName, setFatherHusbandName] = useState('');
  const [motherName, setMotherName] = useState('');
  const [dob, setDob] = useState(() => {
    // default birthdate for ~25 years old
    const date = new Date();
    date.setFullYear(date.getFullYear() - 25);
    return date.toISOString().split('T')[0];
  });
  const [gender, setGender] = useState('মহিলা'); // Most ASA NGO members are female (মহিলা)
  const [nid, setNid] = useState('');
  const [religion, setReligion] = useState('ইসলাম');
  const [education, setEducation] = useState('প্রাথমিক');

  // 2. Address Details (ঠিকানা)
  const [village, setVillage] = useState('');
  const [postOffice, setPostOffice] = useState('');
  const [upazila, setUpazila] = useState('');
  const [district, setDistrict] = useState('');

  // 3. Socio-Economic & Nominee Info (আর্থ-সামাজিক ও নমিনি তথ্য)
  const [nomineeName, setNomineeName] = useState('');
  const [nomineeRelation, setNomineeRelation] = useState('');
  const [nomineeNid, setNomineeNid] = useState('');
  const [profession, setProfession] = useState('গৃহিণী');
  const [guardianProfession, setGuardianProfession] = useState('কৃষি / দিনমজুর');

  // 4. Group & Savings Information (সমিতি ও সঞ্চয় তথ্য)
  const [groupId, setGroupId] = useState(initialGroupId);
  const [admissionDate, setAdmissionDate] = useState(() => workingDay || new Date().toISOString().split('T')[0]);
  const [admissionFee, setAdmissionFee] = useState(() => {
    const rawVal = org ? localStorage.getItem(`tanzil_sav_admission_fee_${org.id}`) || '১০০' : '১০০';
    return convertBanglaToEnglishNumber(rawVal);
  });
  const [passbookFee, setPassbookFee] = useState(() => {
    const rawVal = org ? localStorage.getItem(`tanzil_sav_passbook_fee_${org.id}`) || '১০' : '১০';
    return convertBanglaToEnglishNumber(rawVal);
  });
  // Cooperative Bylaws: Share Capital Admission Requirement
  const [shareCount, setShareCount] = useState(() => {
    const rawMin = org ? localStorage.getItem(`tanzil_min_shares_${org.id}`) || '১' : '১';
    return convertBanglaToEnglishNumber(rawMin) || '1';
  });
  const [sharePrice, setSharePrice] = useState(() => {
    const rawVal = org ? localStorage.getItem(`tanzil_share_price_${org.id}`) || '১০' : '১০';
    return convertBanglaToEnglishNumber(rawVal);
  });

  // Sync admissionDate with workingDay when it changes
  useEffect(() => {
    if (workingDay) {
      setAdmissionDate(workingDay);
    }
  }, [workingDay]);

  // Sync admission and passbook fees as well as share config automatically when org changes
  useEffect(() => {
    if (org) {
      const rawAd = localStorage.getItem(`tanzil_sav_admission_fee_${org.id}`) || '১০০';
      setAdmissionFee(convertBanglaToEnglishNumber(rawAd));
      const rawPass = localStorage.getItem(`tanzil_sav_passbook_fee_${org.id}`) || '১০';
      setPassbookFee(convertBanglaToEnglishNumber(rawPass));
      const rawSharePrice = localStorage.getItem(`tanzil_share_price_${org.id}`) || '১০';
      setSharePrice(convertBanglaToEnglishNumber(rawSharePrice));
      const rawMinShares = localStorage.getItem(`tanzil_min_shares_${org.id}`) || '১';
      setShareCount(convertBanglaToEnglishNumber(rawMinShares) || '1');
    }
  }, [org]);

  // 5. ASA NGO style Active/Inactive Status (সদস্যের স্ট্যাটাস)
  const [memberStatus, setMemberStatus] = useState<'active' | 'inactive'>('active');
  const [inactiveReason, setInactiveReason] = useState('ভর্তি বাতিল');

  // Load selected group's village automatically
  useEffect(() => {
    const selectedGroup = branchGroups.find(g => g.id === groupId);
    if (selectedGroup && selectedGroup.village) {
      setVillage(selectedGroup.village);
    }
  }, [groupId, branchGroups]);

  const [formError, setFormError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    // Role permission check: BM cannot perform member admission
    const isBM = staff?.designation === 'শাখা ব্যবস্থাপক' || staff?.designation === 'Branch Manager' || staff?.designation === 'BM';
    if (isBM) {
      setFormError('শাখা ব্যবস্থাপক (BM) কোনো সদস্য ভর্তি করতে পারবেন না। এটি মাঠ কর্মীর (Field Officer) দায়িত্ব।');
      return;
    }

    // Form Valdiation
    if (!name.trim()) return setFormError('সদস্যের নাম আবশ্যক!');
    if (!phone.trim() || phone.trim().length !== 11) return setFormError('সঠিক ১১ ডিজিটের মোবাইল নম্বর দিন!');
    if (!fatherHusbandName.trim()) return setFormError('পিতা বা স্বামীর নাম আবশ্যক!');
    if (!nid.trim() || nid.trim().length < 10) return setFormError('সঠিক NID বা জন্ম নিবন্ধন নম্বর প্রদান করুন (১০-১৭ ডিজিট)!');
    if (!groupId) return setFormError('একটি সমিতি বা গ্রুপ সিলেক্ট করুন!');

    const selectedGroup = branchGroups.find(g => g.id === groupId);
    const groupCode = selectedGroup ? selectedGroup.code : 'GRP';

    // Auto generate Sequential Code
    const seqNo = existingMembersCount + 1;
    const autoMemberId = `MEM-${groupCode}-${String(seqNo).padStart(3, '0')}`;

    const newMember = {
      id: `mem-${Date.now()}`,
      memberId: autoMemberId,
      orgId: org.id,
      branchId: staff.branchId || 'default-branch',
      groupId: groupId,
      name: name.trim(),
      phone: phone.trim(),
      fatherHusbandName: fatherHusbandName.trim(),
      motherName: motherName.trim(),
      dob: dob,
      gender: gender,
      nid: nid.trim(),
      religion: religion,
      education: education,
      village: village.trim(),
      postOffice: postOffice.trim(),
      upazila: upazila.trim(),
      district: district.trim(),
      nomineeName: nomineeName.trim(),
      nomineeRelation: nomineeRelation.trim(),
      nomineeNid: nomineeNid.trim(),
      profession: profession,
      guardianProfession: guardianProfession,
      admissionDate: admissionDate || new Date().toISOString().split('T')[0],
      admissionFee: parseBanglaFloat(admissionFee) || 0,
      passbookFee: parseBanglaFloat(passbookFee) || 0,
      shareCount: parseBanglaFloat(shareCount) || 1,
      shareValue: parseBanglaFloat(sharePrice) || 100,
      shareBalance: (parseBanglaFloat(shareCount) || 1) * (parseBanglaFloat(sharePrice) || 100),
      savingsBalance: 0,
      gsBalance: 0,
      loanAmount: 0,
      payableAmount: 0,
      paidAmount: 0,
      status: memberStatus, // 'active' or 'inactive'
      inactiveReason: memberStatus === 'inactive' ? inactiveReason : '',
      addDate: admissionDate || new Date().toISOString().split('T')[0],
      address: `${village.trim()}, ${postOffice.trim()}, ${upazila.trim()}, ${district.trim()}`
    };

    onSuccess(newMember);
  };

  return (
    <div className="bg-[#f4f6f9] text-slate-800 animate-in fade-in duration-300 rounded-3xl overflow-hidden border border-slate-300 max-w-lg mx-auto shadow-2xl">
      {/* HEADER SECTION */}
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
            <UserPlus className="w-4 h-4" />
            সদস্য ভর্তি ফরম (Full KYC)
          </h2>
          <p className="text-[10px] text-sky-100/90 font-medium mt-0.5">সদস্যের সচল/নিষ্ক্রিয় স্ট্যাটাস নিয়ন্ত্রণ</p>
        </div>
        <div className="w-7"></div> {/* Spacer for balancing */}
      </div>

      <form onSubmit={handleSubmit} className="p-4 sm:p-5 space-y-6 max-h-[75vh] overflow-y-auto font-sans leading-relaxed text-xs">
        
        {formError && (
          <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-xl flex items-center gap-2 font-bold animate-pulse">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
            <span>{formError}</span>
          </div>
        )}

        {/* SECTION 1: PERSONAL INFORMATION */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-3.5">
          <h3 className="text-indigo-600 font-extrabold flex items-center gap-1.5 border-b border-indigo-50 pb-2 mb-2 text-xs">
            <User className="w-4 h-4" />
            ব্যক্তিগত তথ্য (Personal Profile)
          </h3>

          <div className="grid grid-cols-2 gap-3.5">
            <div className="col-span-2">
              <label className="block text-slate-500 font-black mb-1">সদস্যের পূর্ণ নাম *</label>
              <input
                type="text"
                placeholder="যেমন: মোসাঃ মরিয়ম খাতুন"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-1 focus:ring-indigo-500 focus:outline-none font-bold text-slate-800"
                required
              />
            </div>

            <div>
              <label className="block text-slate-500 font-black mb-1">মোবাইল নম্বর *</label>
              <input
                type="text"
                maxLength={11}
                placeholder="১১ ডিজিট মোবাইল"
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-1 focus:ring-indigo-500 focus:outline-none font-bold text-slate-800"
                required
              />
            </div>

            <div>
              <label className="block text-slate-500 font-black mb-1">জাতীয় পরিচয় নম্বর (NID) *</label>
              <input
                type="text"
                placeholder="১০-১৭ ডিজিট NID"
                value={nid}
                onChange={(e) => setNid(e.target.value.replace(/\D/g, ''))}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-1 focus:ring-indigo-500 focus:outline-none font-bold text-slate-800"
                required
              />
            </div>

            <div>
              <label className="block text-slate-500 font-black mb-1">পিতা বা স্বামীর নাম *</label>
              <input
                type="text"
                placeholder="যেমন: মোঃ আবুল কালাম"
                value={fatherHusbandName}
                onChange={(e) => setFatherHusbandName(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-1 focus:ring-indigo-500 focus:outline-none font-bold text-slate-800"
                required
              />
            </div>

            <div>
              <label className="block text-slate-500 font-black mb-1">মাতার নাম</label>
              <input
                type="text"
                placeholder="যেমন: রাহিমা বেগম"
                value={motherName}
                onChange={(e) => setMotherName(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-1 focus:ring-indigo-500 focus:outline-none font-bold text-slate-800"
              />
            </div>

            <div>
              <label className="block text-slate-500 font-black mb-1">জন্ম তারিখ (Birth Date) *</label>
              <input
                type="date"
                value={dob}
                onChange={(e) => setDob(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-1 focus:ring-indigo-500 focus:outline-none font-bold text-slate-800"
                required
              />
            </div>

            <div>
              <label className="block text-slate-500 font-black mb-1">লিঙ্গ (Gender) *</label>
              <select
                value={gender}
                onChange={(e) => setGender(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 font-bold"
              >
                <option value="মহিলা">মহিলা (Female)</option>
                <option value="পুরুষ">পুরুষ (Male)</option>
                <option value="অন্যান্য">অন্যান্য (Other)</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-500 font-black mb-1">ধর্ম (Religion) *</label>
              <select
                value={religion}
                onChange={(e) => setReligion(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 font-bold"
              >
                <option value="ইসলাম">ইসলাম</option>
                <option value="হিন্দু">হিন্দু</option>
                <option value="খ্রিস্টান">খ্রিস্টান</option>
                <option value="বৌদ্ধ">বৌদ্ধ</option>
                <option value="অন্যান্য">অন্যান্য</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-500 font-black mb-1">শিক্ষাগত যোগ্যতা *</label>
              <select
                value={education}
                onChange={(e) => setEducation(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 font-bold"
              >
                <option value="প্রাথমিক">প্রাথমিক</option>
                <option value="৮ম শ্রেণী">৮ম শ্রেণী</option>
                <option value="স্বাক্ষরজ্ঞানসম্পন্ন">স্বাক্ষরজ্ঞানসম্পন্ন</option>
                <option value="এসএসসি">এসএসসি (SSC)</option>
                <option value="এইচএসসি">এইচএসসি (HSC)</option>
                <option value="স্নাতক+">স্নাতক/ডিগ্রী+</option>
              </select>
            </div>
          </div>
        </div>

        {/* SECTION 2: ADRESS DETAILS */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-3.5">
          <h3 className="text-[#2f6ce5] font-extrabold flex items-center gap-1.5 border-b border-blue-50 pb-2 mb-2 text-xs">
            <MapPin className="w-4 h-4" />
            ঠিকানা বিবরণ (Address Profile)
          </h3>

          <div className="grid grid-cols-2 gap-3.5">
            <div>
              <label className="block text-slate-500 font-black mb-1">গ্রাম / পাড়া / মহল্লা *</label>
              <input
                type="text"
                placeholder="যেমন: চাঁদপুর মধ্যপাড়া"
                value={village}
                onChange={(e) => setVillage(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-1 focus:ring-indigo-500 focus:outline-none font-bold text-slate-800"
                required
              />
            </div>

            <div>
              <label className="block text-slate-500 font-black mb-1">ডাকঘর (Post Office)</label>
              <input
                type="text"
                placeholder="যেমন: রাজাগঞ্জ"
                value={postOffice}
                onChange={(e) => setPostOffice(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-1 focus:ring-indigo-500 focus:outline-none font-bold text-slate-800"
              />
            </div>

            <div>
              <label className="block text-slate-500 font-black mb-1">থানা / উপজেলা</label>
              <input
                type="text"
                placeholder="যেমন: সিরাজগঞ্জ সদর"
                value={upazila}
                onChange={(e) => setUpazila(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-1 focus:ring-indigo-500 focus:outline-none font-bold text-slate-800"
              />
            </div>

            <div>
              <label className="block text-slate-500 font-black mb-1">জেলা</label>
              <input
                type="text"
                placeholder="যেমন: সিরাজগঞ্জ"
                value={district}
                onChange={(e) => setDistrict(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-1 focus:ring-indigo-500 focus:outline-none font-bold text-slate-800"
              />
            </div>
          </div>
        </div>

        {/* SECTION 3: SOCIO-ECONOMIC & NOMINEE */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-3.5">
          <h3 className="text-teal-600 font-extrabold flex items-center gap-1.5 border-b border-teal-50 pb-2 mb-2 text-xs">
            <ShieldCheck className="w-4 h-4" />
            আর্থ-সামাজিক ও নমিনী বিবরণ (Nominee Detail)
          </h3>

          <div className="grid grid-cols-2 gap-3.5">
            <div>
              <label className="block text-slate-500 font-black mb-1">পেশা (সদস্যের)</label>
              <input
                type="text"
                placeholder="যেমন: গৃহিণী"
                value={profession}
                onChange={(e) => setProfession(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-1 focus:ring-indigo-500 focus:outline-none font-bold text-slate-800"
              />
            </div>

            <div>
              <label className="block text-slate-500 font-black mb-1">অভিভাবকের পেশা</label>
              <input
                type="text"
                placeholder="যেমন: রিকশাচালক, দিনমজুর"
                value={guardianProfession}
                onChange={(e) => setGuardianProfession(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-1 focus:ring-indigo-500 focus:outline-none font-bold text-slate-800"
              />
            </div>

            <div className="col-span-2">
              <label className="block text-slate-500 font-black mb-1">নমিনির পূর্ণ নাম</label>
              <input
                type="text"
                placeholder="যেমন: মোঃ সাজ্জাদ হোসেন"
                value={nomineeName}
                onChange={(e) => setNomineeName(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-1 focus:ring-indigo-500 focus:outline-none font-bold text-slate-800"
              />
            </div>

            <div>
              <label className="block text-slate-500 font-black mb-1">নমিনির সাথে সম্পর্ক</label>
              <input
                type="text"
                placeholder="যেমন: বড় ছেলে / স্বামী"
                value={nomineeRelation}
                onChange={(e) => setNomineeRelation(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-1 focus:ring-indigo-500 focus:outline-none font-bold text-slate-800"
              />
            </div>

            <div>
              <label className="block text-slate-500 font-black mb-1">নমিনির NID / জন্ম নিবন্ধন নং</label>
              <input
                type="text"
                placeholder="নমিনী NID নং"
                value={nomineeNid}
                onChange={(e) => setNomineeNid(e.target.value.replace(/\D/g, ''))}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-1 focus:ring-indigo-500 focus:outline-none font-bold text-slate-800"
              />
            </div>
          </div>
        </div>

        {/* SECTION 4: GROUP ASSIGNMENT & FEES */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-3.5">
          <h3 className="text-amber-600 font-extrabold flex items-center gap-1.5 border-b border-amber-50 pb-2 mb-2 text-xs">
            <Building className="w-4 h-4" />
            সমিতিভুক্ত বিবরণ ও প্রাথমিক জমা (Samity & Fees)
          </h3>

          <div className="grid grid-cols-2 gap-3.5">
            <div className="col-span-2">
              <label className="block text-slate-500 font-black mb-1">সমিতি / গ্রুপ নির্বাচন করুন *</label>
              <select
                value={groupId}
                onChange={(e) => setGroupId(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 font-bold"
                required
              >
                <option value="">-- সমিতি সিলেক্ট করুন --</option>
                {branchGroups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name} ({g.code}) - {g.meetingDay || 'শনিবার'}
                  </option>
                ))}
              </select>
            </div>

            <div className="col-span-2">
              <label className="block text-slate-500 font-black mb-1">ভর্তির তারিখ *</label>
              <input
                type="date"
                value={admissionDate}
                onChange={(e) => setAdmissionDate(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-1 focus:ring-indigo-500 focus:outline-none font-bold text-slate-800"
                required
              />
            </div>

            <div>
              <label className="block text-slate-500 font-black mb-1">ভর্তি ফি (Admission Fee)</label>
              <input
                type="text"
                value={admissionFee}
                onChange={(e) => setAdmissionFee(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-1 focus:ring-indigo-500 focus:outline-none font-bold text-slate-800 bg-slate-50"
              />
              <span className="text-[10px] text-emerald-600 font-bold block mt-1">⚙️ কনফিগারেশন থেকে অটো লোডকৃত</span>
            </div>

            <div>
              <label className="block text-slate-500 font-black mb-1">পাসবই ও ফর্ম ফি</label>
              <input
                type="text"
                value={passbookFee}
                onChange={(e) => setPassbookFee(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-1 focus:ring-indigo-500 focus:outline-none font-bold text-slate-800 bg-slate-50"
              />
              <span className="text-[10px] text-emerald-600 font-bold block mt-1">⚙️ কনফিগারেশন থেকে অটো লোডকৃত</span>
            </div>

            {/* Share Capital Requirement (Cooperative Bylaws) */}
            <div className="col-span-2 pt-2 border-t border-slate-100">
              <label className="block text-emerald-800 font-black mb-1.5 flex items-center justify-between text-xs">
                <span>🤝 সমবায় শেয়ার ক্রয় (সর্বনিম্ন ১ শেয়ার ক্রয় আবশ্যক) *</span>
                <span className="text-[10px] text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">সমবায় আইন অনুযায়ী</span>
              </label>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 mb-0.5">শেয়ার সংখ্যা</label>
                  <input
                    type="number"
                    min="1"
                    value={shareCount}
                    onChange={(e) => setShareCount(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-lg font-bold text-slate-800 text-xs text-center"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 mb-0.5">প্রতি শেয়ার মূল্য (৳)</label>
                  <input
                    type="text"
                    value={sharePrice}
                    onChange={(e) => setSharePrice(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-lg font-bold text-slate-800 text-xs text-center bg-slate-50"
                    readOnly
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 mb-0.5">মোট শেয়ার মূলধন (৳)</label>
                  <div className="w-full px-3 py-1.5 bg-emerald-50 border border-emerald-200 rounded-lg font-black text-emerald-800 text-xs text-center font-mono">
                    ৳{((parseBanglaFloat(shareCount) || 1) * (parseBanglaFloat(sharePrice) || 100)).toLocaleString('bn-BD')}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* SECTION 5: ACTIVE/INACTIVE STATUS */}
        <div className="bg-white p-4 rounded-xl border border-slate-205 shadow-2xs space-y-3.5">
          <h3 className="text-emerald-600 font-extrabold flex items-center gap-1.5 border-b border-emerald-50 pb-2 mb-2 text-xs">
            <CheckCircle className="w-4 h-4 text-emerald-500" />
            সদস্য স্ট্যাটাস বিন্যাস (NGO Status Controls)
          </h3>

          <div className="space-y-4">
            <div>
              <label className="block text-slate-500 font-black mb-1.5">সদস্যের স্থিতি (Admission Status) *</label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="memberStatusOpt"
                    checked={memberStatus === 'active'}
                    onChange={() => setMemberStatus('active')}
                    className="w-4 h-4 text-emerald-600 border-slate-300 focus:ring-emerald-500 focus:ring-1"
                  />
                  <span className="font-extrabold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-lg">
                    সচল (Active) - দৈনিক/সাপ্তাহিক কার্যাবলী সচল থাকবে
                  </span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="memberStatusOpt"
                    checked={memberStatus === 'inactive'}
                    onChange={() => setMemberStatus('inactive')}
                    className="w-4 h-4 text-rose-600 border-slate-300 focus:ring-rose-500 focus:ring-1"
                  />
                  <span className="font-extrabold text-rose-700 bg-rose-50 border border-rose-200 px-3 py-1 rounded-lg">
                    নিষ্ক্রিয় (Inactive)
                  </span>
                </label>
              </div>
            </div>

            {memberStatus === 'inactive' && (
              <div className="bg-rose-50/50 p-3 rounded-xl border border-rose-100 animate-in slide-in-from-top-2 duration-200">
                <label className="block text-rose-900 font-bold mb-1">নিষ্ক্রিয়করণের কারণ (Reason) *</label>
                <select
                  value={inactiveReason}
                  onChange={(e) => setInactiveReason(e.target.value)}
                  className="w-full px-3 py-2 border border-rose-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-rose-500 font-extrabold text-rose-800"
                >
                  <option value="ভর্তি বাতিল">ভর্তি বাতিল (Admission Cancelled)</option>
                  <option value="ঋণ পরিশোধ পরবর্তী নিষ্ক্রিয়">ঋণ পরিশোধ পরবর্তী নিষ্ক্রিয় (Inactive after Loan Paid)</option>
                  <option value="স্বেচ্ছায় পদত্যাগ">স্বেচ্ছায় পদত্যাগ (Voluntary Resignation)</option>
                  <option value="স্থানান্তরিত">১০০% ক্যাশ আউট / স্থানান্তরিত (Withdrawn/Transferred)</option>
                  <option value="অন্যান্য সাময়িক অসচলতা">অন্যান্য সাময়িক অসচলতা (Other Suspensions)</option>
                </select>
              </div>
            )}
          </div>
        </div>

        {/* ACTIONS */}
        <div className="flex gap-3 pt-3">
          <button
            type="button"
            onClick={onBack}
            className="flex-1 py-3 bg-slate-200 hover:bg-slate-300 rounded-xl text-slate-700 font-bold text-xs"
          >
            বাতিল
          </button>
          <button
            type="submit"
            className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs shadow-sm flex items-center justify-center gap-1.5"
          >
            <CheckCircle className="w-4 h-4" />
            সদস্য ভর্তি সম্পন্ন করুন
          </button>
        </div>

      </form>
    </div>
  );
};
