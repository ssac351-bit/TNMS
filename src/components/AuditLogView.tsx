/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  ShieldAlert, 
  Activity, 
  Search, 
  Filter, 
  Download, 
  RefreshCw, 
  Trash2, 
  AlertCircle, 
  CheckCircle, 
  Clock, 
  User, 
  MapPin, 
  Settings, 
  Coins, 
  ChevronLeft,
  Calendar,
  Layers,
  Inbox
} from 'lucide-react';
import { Organization } from '../types';
import { AuditLog, SystemNotification } from '../utils/auditLogger';

interface AuditLogViewProps {
  org: Organization;
  onBack: () => void;
}

export const AuditLogView: React.FC<AuditLogViewProps> = ({ org, onBack }) => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [notifications, setNotifications] = useState<SystemNotification[]>([]);
  const [activeTab, setActiveTab] = useState<'trail' | 'notifications'>('trail');
  
  // Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [severityFilter, setSeverityFilter] = useState<string>('all'); // info, success, warning, error
  const [branchFilter, setBranchFilter] = useState<string>('all');

  const logsKey = `tanzil_audit_logs_${org.id}`;
  const notifKey = `tanzil_notifications_${org.id}`;

  const loadData = () => {
    try {
      const storedLogs = JSON.parse(localStorage.getItem(logsKey) || '[]');
      const storedNotifs = JSON.parse(localStorage.getItem(notifKey) || '[]');
      setLogs(storedLogs);
      setNotifications(storedNotifs);
    } catch (e) {
      console.error('Error loading audit log data:', e);
    }
  };

  useEffect(() => {
    loadData();
    
    // Listen for storage changes
    const handleStorageChange = () => loadData();
    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('tanzil_audit_log_added', handleStorageChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('tanzil_audit_log_added', handleStorageChange);
    };
  }, [org.id]);

  const handleClearLogs = () => {
    if (window.confirm('আপনি কি নিশ্চিতভাবে সকল অডিট লগ এবং অ্যাক্টিভিটি হিস্ট্রি মুছে ফেলতে চান? এটি নিরাপত্তা ট্র্যাকিং এর জন্য রিকমেন্ডেড নয়।')) {
      localStorage.removeItem(logsKey);
      localStorage.removeItem(notifKey);
      setLogs([]);
      setNotifications([]);
      // Log this clear action as the first new log!
      try {
        const timestamp = new Date().toISOString();
        const clearLog: AuditLog = {
          id: `log_${Date.now()}`,
          timestamp,
          userId: org.adminId,
          userName: 'প্রধান এডমিন',
          role: 'org_admin',
          action: 'সিস্টেম অডিট লগ পরিষ্কার করা হয়েছে',
          details: 'নিরাপত্তা কনসোল থেকে সকল পূর্ববর্তী অ্যাক্টিভিটি এবং অডিট লগ ডাটা মুছে ফেলা হয়েছে।',
          category: 'system'
        };
        localStorage.setItem(logsKey, JSON.stringify([clearLog]));
        setLogs([clearLog]);
      } catch (err) {
        console.error(err);
      }
    }
  };

  const handleMarkAllNotifsRead = () => {
    const updated = notifications.map(n => ({ ...n, isRead: true }));
    localStorage.setItem(notifKey, JSON.stringify(updated));
    setNotifications(updated);
  };

  const exportToJson = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify({ logs, notifications }, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    const cleanOrg = (org.name || 'প্রতিষ্ঠান')
      .replace(/tanzil|software|app/gi, '')
      .trim()
      .replace(/[\/\\?%*:|"<>]/g, '_')
      .replace(/\s+/g, '_') || 'প্রতিষ্ঠান';
    downloadAnchor.setAttribute("download", `${cleanOrg}_অডিট_লগ_${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  // Get distinct branches and roles for filters
  const uniqueBranches = Array.from(new Set(logs.map(l => l.branchCode).filter(Boolean))) as string[];
  const uniqueRoles = Array.from(new Set(logs.map(l => l.role).filter(Boolean))) as string[];

  // Format date helper in Bengali
  const formatDateTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleString('bn-BD', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
      });
    } catch {
      return isoString;
    }
  };

  // Filter logs
  const filteredLogs = logs.filter(log => {
    const matchesSearch = 
      log.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.details.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.userName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.userId.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesCategory = categoryFilter === 'all' || log.category === categoryFilter;
    const matchesRole = roleFilter === 'all' || log.role === roleFilter;
    const matchesBranch = branchFilter === 'all' || log.branchCode === branchFilter;

    return matchesSearch && matchesCategory && matchesRole && matchesBranch;
  });

  // Filter notifications
  const filteredNotifications = notifications.filter(notif => {
    const matchesSearch = 
      notif.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      notif.message.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesSeverity = severityFilter === 'all' || notif.type === severityFilter;
    const matchesBranch = branchFilter === 'all' || notif.branchCode === branchFilter;

    return matchesSearch && matchesSeverity && matchesBranch;
  });

  // Category translations and styling
  const getCategoryDetails = (category: string) => {
    switch (category) {
      case 'branch':
        return { label: 'শাখা পরিচালনা', color: 'bg-blue-50 text-blue-700 border-blue-100' };
      case 'staff':
        return { label: 'কর্মকর্তা/কর্মী', color: 'bg-teal-50 text-teal-700 border-teal-100' };
      case 'member':
        return { label: 'সদস্য ব্যবস্থাপনা', color: 'bg-indigo-50 text-indigo-700 border-indigo-100' };
      case 'samity':
        return { label: 'সমিতি/গ্রুপ', color: 'bg-purple-50 text-purple-700 border-purple-100' };
      case 'loan':
        return { label: 'ঋণ মডিউল', color: 'bg-emerald-50 text-emerald-700 border-emerald-100' };
      case 'savings':
        return { label: 'সঞ্চয় হিসাব', color: 'bg-cyan-50 text-cyan-700 border-cyan-100' };
      case 'dps':
        return { label: 'ডিপিএস স্কিম', color: 'bg-violet-50 text-violet-700 border-violet-100' };
      case 'fdr':
        return { label: 'এফডিআর স্কিম', color: 'bg-amber-50 text-amber-700 border-amber-100' };
      case 'config':
        return { label: 'পলিসি সেটিংস', color: 'bg-rose-50 text-rose-700 border-rose-100' };
      case 'system':
        return { label: 'সিস্টেম অ্যাকশন', color: 'bg-slate-100 text-slate-800 border-slate-200' };
      default:
        return { label: category, color: 'bg-slate-50 text-slate-600 border-slate-100' };
    }
  };

  // Role translating helper
  const translateRole = (role: string) => {
    switch (role) {
      case 'org_admin': return 'প্রধান এডমিন';
      case 'branch_manager': return 'শাখা ব্যবস্থাপক';
      case 'staff': return 'মাঠ কর্মী / অফিসার';
      case 'super_admin': return 'সুপার এডমিন';
      default: return role;
    }
  };

  // Today stats counts
  const todayStr = new Date().toISOString().split('T')[0];
  const todayLogsCount = logs.filter(l => l.timestamp.startsWith(todayStr)).length;
  const warningLogsCount = notifications.filter(n => n.type === 'warning').length;
  const unreadNotifsCount = notifications.filter(n => !n.isRead).length;

  return (
    <div className="space-y-6 animate-in fade-in duration-200 font-sans">
      
      {/* Navigation Header / ব্যাক বাটন */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold hover:text-slate-900 rounded-lg text-xs border border-slate-200 cursor-pointer transition shadow-3xs"
        >
          <ChevronLeft size={14} />
          <span>← ড্যাশবোর্ডে ফিরুন</span>
        </button>

        <div className="flex items-center gap-2">
          <button
            onClick={loadData}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg border border-slate-200 shadow-3xs transition-colors cursor-pointer"
            title="নতুন তথ্য লোড করুন"
          >
            <RefreshCw size={13} className="text-slate-500 animate-hover-spin" />
            <span>রিফ্রেশ</span>
          </button>
          
          <button
            onClick={exportToJson}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-semibold rounded-lg border border-indigo-100 shadow-3xs transition-colors cursor-pointer"
            title="অডিট লগ এক্সপোর্ট"
          >
            <Download size={13} />
            <span>ডাউনলোড লগ</span>
          </button>

          <button
            onClick={handleClearLogs}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-semibold rounded-lg border border-rose-100 shadow-3xs transition-colors cursor-pointer"
            title="ক্লিয়ার অডিট লগ"
          >
            <Trash2 size={13} />
            <span>লগ মুছুন</span>
          </button>
        </div>
      </div>

      {/* Main Stats Header */}
      <div className="bg-slate-900 text-white rounded-2xl p-6 relative overflow-hidden shadow-md">
        <div className="absolute right-0 bottom-0 opacity-10 transform translate-x-6 translate-y-6">
          <Activity size={220} className="text-slate-400" />
        </div>
        
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <div className="flex items-center gap-2.5 mb-2">
              <div className="p-2 bg-amber-500 text-slate-950 rounded-xl">
                <ShieldAlert size={22} />
              </div>
              <h2 className="text-xl font-black font-sans tracking-tight">সিস্টেম অডিট এবং লাইভ সিকিউরিটি ট্র্যাকার</h2>
            </div>
            <p className="text-slate-400 text-xs font-medium leading-relaxed max-w-2xl font-sans">
              এই মডিউলটি আপনার এনজিও প্রতিষ্ঠানের সকল শাখা, সমিতি, লোন অনুমোদন, সঞ্চয় ও কর্মকর্তা স্তরের প্রতিটি পরিবর্তনের বিস্তারিত লগ ট্র্যাক করে। এটি ডেটা দুর্নীতি প্রতিরোধে রিয়েল-টাইম কাজ পর্যবেক্ষণ করতে সাহায্য করে।
            </p>
          </div>

          <div className="flex gap-4 self-stretch md:self-auto bg-white/5 p-3 rounded-xl border border-white/10">
            <div className="px-3 py-1 text-center border-r border-white/10">
              <span className="block text-[10px] text-slate-400 font-bold">মোট অডিট রেকর্ড</span>
              <span className="text-lg font-black text-amber-400">{logs.length.toLocaleString('bn-BD')}</span>
            </div>
            <div className="px-3 py-1 text-center border-r border-white/10">
              <span className="block text-[10px] text-slate-400 font-bold">আজকের কার্যকলাপ</span>
              <span className="text-lg font-black text-emerald-400">{todayLogsCount.toLocaleString('bn-BD')}</span>
            </div>
            <div className="px-3 py-1 text-center">
              <span className="block text-[10px] text-slate-400 font-bold">সিস্টেম অ্যালার্টস</span>
              <span className="text-lg font-black text-rose-400">{warningLogsCount.toLocaleString('bn-BD')}</span>
            </div>
          </div>
        </div>
      </div>

      {/* TABS SELECTOR */}
      <div className="flex border-b border-slate-200">
        <button
          onClick={() => { setActiveTab('trail'); setSearchQuery(''); }}
          className={`px-5 py-3 text-xs font-black transition-colors border-b-2 flex items-center gap-2 cursor-pointer ${
            activeTab === 'trail' 
              ? 'border-indigo-600 text-indigo-700 bg-indigo-50/20' 
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Activity size={15} />
          <span>রিয়েল-টাইম অডিট ট্রেইল ({filteredLogs.length})</span>
        </button>

        <button
          onClick={() => { setActiveTab('notifications'); setSearchQuery(''); }}
          className={`px-5 py-3 text-xs font-black transition-colors border-b-2 flex items-center gap-2 cursor-pointer relative ${
            activeTab === 'notifications' 
              ? 'border-rose-600 text-rose-700 bg-rose-50/20' 
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <ShieldAlert size={15} />
          <span>গুরুত্বপূর্ণ নোটিফিকেশন ও অ্যালার্টস ({filteredNotifications.length})</span>
          {unreadNotifsCount > 0 && (
            <span className="absolute top-1.5 right-1 px-1.5 py-0.5 text-[8.5px] font-bold text-white bg-rose-600 rounded-full animate-bounce">
              {unreadNotifsCount}
            </span>
          )}
        </button>
      </div>

      {/* FILTER CONTROL BOARD */}
      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
        <div className="flex items-center gap-2 text-slate-700 text-xs font-bold mb-1">
          <Filter size={14} className="text-indigo-600" />
          <span>সার্চ ও অ্যাডভান্সড ফিল্টারস</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          {/* Text Search */}
          <div className="relative md:col-span-2">
            <Search className="absolute left-2.5 top-2.5 text-slate-400" size={14} />
            <input
              type="text"
              placeholder={activeTab === 'trail' ? "অ্যাকশন, ইউজার আইডি বা বিবরণ খুঁজুন..." : "নোটিফিকেশন বা বার্তা খুঁজুন..."}
              className="w-full pl-8 pr-3 py-2 bg-white border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* Branch filter */}
          <div>
            <select
              className="w-full px-2 py-2 bg-white border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
              value={branchFilter}
              onChange={(e) => setBranchFilter(e.target.value)}
            >
              <option value="all">🏢 সকল শাখা (All Branches)</option>
              {uniqueBranches.map(code => (
                <option key={code} value={code}>শাখা কোড: {code}</option>
              ))}
            </select>
          </div>

          {/* Conditional filter based on Tab */}
          {activeTab === 'trail' ? (
            <div>
              <select
                className="w-full px-2 py-2 bg-white border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
              >
                <option value="all">📂 সকল ক্যাটাগরি (All Categories)</option>
                <option value="branch">🏢 শাখা পরিচালনা</option>
                <option value="staff">👤 কর্মকর্তা ও কর্মী</option>
                <option value="member">👥 সদস্য ব্যবস্থাপনা</option>
                <option value="samity">🏘️ সমিতি ও গ্রুপ</option>
                <option value="loan">💰 ঋণ মডিউল</option>
                <option value="savings">💳 সঞ্চয় হিসাব</option>
                <option value="dps">📈 ডিপিএস স্কিম</option>
                <option value="fdr">💎 এফডিআর স্কিম</option>
                <option value="config">⚙️ পলিসি সেটিংস</option>
                <option value="system">💻 সিস্টেম অ্যাকশন</option>
              </select>
            </div>
          ) : (
            <div>
              <select
                className="w-full px-2 py-2 bg-white border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                value={severityFilter}
                onChange={(e) => setSeverityFilter(e.target.value)}
              >
                <option value="all">⚠️ সকল অ্যালার্ট টাইপ (All Types)</option>
                <option value="info">ℹ️ সাধারণ তথ্য (Info)</option>
                <option value="success">✅ সফল কার্যক্রম (Success)</option>
                <option value="warning">🚨 গুরুতর সতর্কবার্তা (Warning)</option>
              </select>
            </div>
          )}
        </div>

        {activeTab === 'trail' && uniqueRoles.length > 0 && (
          <div className="flex gap-2 items-center flex-wrap pt-1">
            <span className="text-[10px] text-slate-400 font-extrabold uppercase">ইউজার রোল ফিল্টার:</span>
            <button
              onClick={() => setRoleFilter('all')}
              className={`px-2.5 py-0.5 text-[10px] rounded-full font-bold transition-colors ${
                roleFilter === 'all' 
                  ? 'bg-indigo-600 text-white' 
                  : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
              }`}
            >
              সকল রোল
            </button>
            {uniqueRoles.map(role => (
              <button
                key={role}
                onClick={() => setRoleFilter(role)}
                className={`px-2.5 py-0.5 text-[10px] rounded-full font-bold transition-colors ${
                  roleFilter === role 
                    ? 'bg-indigo-600 text-white' 
                    : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                }`}
              >
                {translateRole(role)}
              </button>
            ))}
          </div>
        )}

        {activeTab === 'notifications' && notifications.length > 0 && (
          <div className="flex justify-between items-center pt-1 border-t border-slate-200">
            <span className="text-[10px] text-slate-400 font-semibold">সরাসরি অ্যাকশন:</span>
            <button
              onClick={handleMarkAllNotifsRead}
              className="text-[10px] text-indigo-600 hover:text-indigo-800 font-extrabold underline flex items-center gap-1 cursor-pointer"
            >
              <CheckCircle size={10} />
              <span>সকল নোটিফিকেশন পড়া হয়েছে বলে চিহ্নিত করুন</span>
            </button>
          </div>
        )}
      </div>

      {/* VIEW SECTION */}
      {activeTab === 'trail' ? (
        /* AUDIT TRAIL TABLE OR EMPTY LIST */
        filteredLogs.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-3xs">
            <Inbox className="mx-auto text-slate-300 mb-3" size={40} />
            <h4 className="font-bold text-slate-700 mb-1">কোনো অডিট রেকর্ড পাওয়া যায়নি</h4>
            <p className="text-slate-400 text-xs">আপনার নির্বাচিত ফিল্টার বা ক্যাটাগরির জন্য কোনো রেকর্ড বর্তমান হিস্ট্রিতে নেই।</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-3xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase">
                    <th className="px-5 py-3">সময় ও তারিখ</th>
                    <th className="px-4 py-3">ব্যবহারকারী</th>
                    <th className="px-4 py-3">ক্যাটাগরি</th>
                    <th className="px-4 py-3">কার্যকলাপ (Action)</th>
                    <th className="px-5 py-3">বিস্তারিত বিবরণী (Details)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs text-slate-600">
                  {filteredLogs.map((log) => {
                    const cat = getCategoryDetails(log.category);
                    return (
                      <tr key={log.id} className="hover:bg-slate-50/50 transition-colors">
                        {/* Time stamp */}
                        <td className="px-5 py-3.5 whitespace-nowrap text-[10px] text-slate-450 font-medium">
                          <div className="flex items-center gap-1.5">
                            <Clock size={12} className="text-slate-400" />
                            <span>{formatDateTime(log.timestamp)}</span>
                          </div>
                        </td>

                        {/* User Details */}
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center shrink-0 font-bold text-[10.5px]">
                              {log.userName.charAt(0)}
                            </div>
                            <div>
                              <p className="font-bold text-slate-850 text-[11.5px] leading-tight">{log.userName}</p>
                              <p className="text-[9.5px] text-slate-400 font-mono leading-none mt-0.5">
                                {translateRole(log.role)} ({log.userId})
                              </p>
                              {log.branchCode && (
                                <span className="inline-flex items-center gap-0.5 bg-slate-100 text-slate-600 text-[8.5px] px-1 rounded font-bold mt-1 font-mono">
                                  <MapPin size={8} /> {log.branchCode}
                                </span>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Category Badge */}
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          <span className={`inline-block px-2.5 py-0.5 text-[10px] font-bold rounded-full border ${cat.color}`}>
                            {cat.label}
                          </span>
                        </td>

                        {/* Action Title */}
                        <td className="px-4 py-3.5 font-bold text-slate-800 text-[12.5px] min-w-[150px]">
                          {log.action}
                        </td>

                        {/* Action Details */}
                        <td className="px-5 py-3.5 text-slate-500 leading-relaxed max-w-sm sm:max-w-md">
                          <p className="text-[11.5px]">{log.details}</p>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )
      ) : (
        /* SYSTEM ALERTS & NOTIFICATIONS */
        filteredNotifications.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-3xs">
            <CheckCircle className="mx-auto text-emerald-400 mb-3" size={40} />
            <h4 className="font-bold text-slate-700 mb-1">কোনো সতর্কবার্তা নেই</h4>
            <p className="text-slate-400 text-xs">আপনার সিস্টেম বর্তমানে শান্ত ও নিরাপদ। কোনো অপঠিত অ্যালার্ট নেই।</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredNotifications.map((notif) => {
              const typeStyles = 
                notif.type === 'warning' ? 'bg-rose-50 border-rose-200 text-rose-800' :
                notif.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' :
                'bg-blue-50 border-blue-200 text-blue-800';

              const icon = 
                notif.type === 'warning' ? <ShieldAlert className="text-rose-600 shrink-0 mt-0.5" size={18} /> :
                notif.type === 'success' ? <CheckCircle className="text-emerald-600 shrink-0 mt-0.5" size={18} /> :
                <AlertCircle className="text-blue-600 shrink-0 mt-0.5" size={18} />;

              return (
                <div 
                  key={notif.id} 
                  className={`p-4 border rounded-xl flex gap-3 shadow-3xs transition-opacity duration-200 ${typeStyles} ${
                    notif.isRead ? 'opacity-70 hover:opacity-100' : 'relative ring-1 ring-inset ring-amber-400/20'
                  }`}
                >
                  {/* Status dot */}
                  {!notif.isRead && (
                    <span className="absolute top-3 right-3 w-2 h-2 bg-indigo-600 rounded-full"></span>
                  )}

                  {icon}

                  <div className="space-y-1 w-full">
                    <div className="flex justify-between items-center flex-wrap gap-x-3">
                      <h4 className="font-extrabold text-sm text-slate-850 font-sans tracking-tight">{notif.title}</h4>
                      <span className="text-[9.5px] font-mono text-slate-400 flex items-center gap-1">
                        <Calendar size={10} />
                        {formatDateTime(notif.timestamp)}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed font-sans">{notif.message}</p>
                    {notif.branchCode && (
                      <span className="inline-flex items-center gap-0.5 bg-slate-200/60 text-slate-650 text-[9px] px-1.5 py-0.5 rounded font-mono font-bold mt-1.5">
                        <MapPin size={9} /> শাখা কোড: {notif.branchCode}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}
    </div>
  );
};
