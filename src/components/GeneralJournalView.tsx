import React, { useState, useMemo, useRef, useEffect } from 'react';
import { COA_TREE } from '../lib/coa';
import { formatDDMMYYYY } from '../lib/dateUtils';
import { 
  BookOpen, 
  Search, 
  Calendar, 
  ChevronDown, 
  ChevronUp,
  PlusCircle,
  CheckCircle2,
  XCircle
} from 'lucide-react';

interface JournalEntryLine {
  accountCode: string;
  accountName: string;
  accountEnName: string;
  isDebit: boolean;
  amount: number;
}

interface JournalPost {
  id: string;
  date: string;
  note: string;
  type: string;
  paymentMode: 'cash' | 'bank';
  lines: JournalEntryLine[];
}

interface GeneralJournalViewProps {
  transactions: any[];
  bankAccounts?: any[];
  workingDay?: string;
  onAddTransactions?: (newTxs: any[]) => void;
  onDeleteTransaction?: (id: string) => void;
  onUpdateTransaction?: (id: string, updatedTx: any) => void;
  voucherDate: string;
  setVoucherDate: (date: string) => void;
}

interface GroupedAccountSelectorProps {
  label: string;
  selectedId: string;
  onSelect: (id: string) => void;
  accounts: Array<{ id: string; code: string; name: string; enName: string; groupName: string }>;
  colorTheme: 'emerald' | 'rose';
}

function GroupedAccountSelector({ label, selectedId, onSelect, accounts, colorTheme }: GroupedAccountSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedAcc = accounts.find(a => a.id === selectedId);

  const grouped = useMemo(() => {
    const res: Record<string, typeof accounts> = {};
    accounts.forEach(acc => {
      if (!res[acc.groupName]) res[acc.groupName] = [];
      res[acc.groupName].push(acc);
    });
    return res;
  }, [accounts]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent | TouchEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, []);

  return (
    <div className="relative" ref={containerRef}>
      <label className="block text-[10px] font-extrabold text-slate-500 uppercase mb-1 flex items-center gap-1 font-sans">
        <span className={`w-2 h-2 rounded-full inline-block ${colorTheme === 'emerald' ? 'bg-emerald-500' : 'bg-rose-500'}`}></span>
        {label}
      </label>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full text-left text-xs px-3 py-2.5 border border-slate-200 rounded-xl bg-white hover:bg-slate-50 transition-colors font-bold text-slate-800 flex items-center justify-between shadow-sm min-h-[44px]"
      >
        <span className="truncate">
          {selectedAcc ? `${selectedAcc.code} - ${selectedAcc.name}` : 'নির্বাচন করুন...'}
        </span>
        <ChevronDown size={14} className="text-slate-400 shrink-0 ml-1" />
      </button>

      {isOpen && (
        <div className="absolute z-50 left-0 right-0 mt-1.5 p-2 bg-white border border-slate-200 rounded-xl shadow-lg max-h-[280px] overflow-y-auto space-y-1 font-sans">
          {Object.keys(grouped).map(groupName => (
            <div key={groupName} className="border border-slate-100 rounded-lg overflow-hidden">
              <button
                type="button"
                onClick={() => setExpandedGroup(prev => prev === groupName ? null : groupName)}
                className="w-full text-left px-3 py-2 text-xs font-bold bg-slate-50 hover:bg-slate-100 text-slate-700 flex items-center justify-between"
              >
                {groupName}
                {expandedGroup === groupName ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              </button>
              {expandedGroup === groupName && (
                <div className="p-1 bg-white">
                  {grouped[groupName].map(acc => (
                    <button
                      key={acc.id}
                      type="button"
                      onClick={() => { onSelect(acc.id); setIsOpen(false); }}
                      className={`w-full text-left px-3 py-2 text-xs rounded ${acc.id === selectedId ? 'bg-blue-600 text-white' : 'hover:bg-slate-100'}`}
                    >
                      {acc.name} ({acc.code})
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export const GeneralJournalView: React.FC<GeneralJournalViewProps> = ({
  transactions = [],
  bankAccounts = [],
  workingDay = '',
  onAddTransactions,
  onUpdateTransaction,
  voucherDate,
  setVoucherDate
}) => {
  const [isPostingFormOpen, setIsPostingFormOpen] = useState(false);
  const [voucherNote, setVoucherNote] = useState('');
  const [voucherAmount, setVoucherAmount] = useState('');
  
  const postableAccounts = useMemo(() => {
    const list = [{ id: 'cash', code: '1101', name: 'হাতে নগদ টাকা', enName: 'Cash', groupName: 'নগদ তহবিল' }];
    COA_TREE.forEach(group => {
      group.accounts.forEach(acc => {
        if (!acc.isSummary) list.push({ id: acc.id, code: acc.code, name: acc.name, enName: acc.enName, groupName: group.name });
      });
    });
    return list;
  }, []);

  const [debitAccountId, setDebitAccountId] = useState(postableAccounts[0]?.id || 'cash');
  const [creditAccountId, setCreditAccountId] = useState(postableAccounts[1]?.id || 'cash');

  // Sub-selection states for specific registered bank accounts
  const [selectedDebitBankId, setSelectedDebitBankId] = useState('');
  const [selectedCreditBankId, setSelectedCreditBankId] = useState('');

  // Filter bank options based on the chosen Chart of Account head
  const debitBankOptions = useMemo(() => {
    if (debitAccountId === 'current_ac') {
      return bankAccounts.filter(b => b.accountType.includes('Current') || b.accountType.includes('চলতি') || b.accountType.includes('SND') || b.accountType.includes('এসএনডি'));
    }
    if (debitAccountId === 'savings_ac') {
      return bankAccounts.filter(b => b.accountType.includes('Savings') || b.accountType.includes('সঞ্চয়ী'));
    }
    if (debitAccountId === 'fdr') {
      return bankAccounts.filter(b => b.accountType.includes('FDR') || b.accountType.includes('এফডিআর'));
    }
    return [];
  }, [debitAccountId, bankAccounts]);

  const creditBankOptions = useMemo(() => {
    if (creditAccountId === 'current_ac') {
      return bankAccounts.filter(b => b.accountType.includes('Current') || b.accountType.includes('চলতি') || b.accountType.includes('SND') || b.accountType.includes('এসএনডি'));
    }
    if (creditAccountId === 'savings_ac') {
      return bankAccounts.filter(b => b.accountType.includes('Savings') || b.accountType.includes('সঞ্চয়ী'));
    }
    if (creditAccountId === 'fdr') {
      return bankAccounts.filter(b => b.accountType.includes('FDR') || b.accountType.includes('এফডিআর'));
    }
    return [];
  }, [creditAccountId, bankAccounts]);

  // Synchronize dynamic default selections
  useEffect(() => {
    if (debitBankOptions.length > 0) {
      setSelectedDebitBankId(debitBankOptions[0].id);
    } else {
      setSelectedDebitBankId('');
    }
  }, [debitBankOptions]);

  useEffect(() => {
    if (creditBankOptions.length > 0) {
      setSelectedCreditBankId(creditBankOptions[0].id);
    } else {
      setSelectedCreditBankId('');
    }
  }, [creditBankOptions]);

  const getAccountLabel = (accId: string) => {
    if (accId === 'cash') return '💵 হাতে নগদ (Cash)';
    if (accId?.startsWith('bank')) {
      const b = bankAccounts.find(bank => bank.id === accId);
      return b ? `🏦 ${b.bankName} [A/C: ${b.accountNo}]` : '🏦 ব্যাংক হিসাব';
    }
    const coaAcc = postableAccounts.find(a => a.id === accId);
    return coaAcc ? coaAcc.name : accId;
  };

  const handlePostVoucher = () => {
    if (!voucherAmount || !voucherNote.trim()) {
      alert('সঠিক তথ্য প্রদান করুন!');
      return;
    }

    // Determine final debit and credit accounts
    const finalDebit = debitBankOptions.length > 0 ? selectedDebitBankId : debitAccountId;
    const finalCredit = creditBankOptions.length > 0 ? selectedCreditBankId : creditAccountId;

    if (!finalDebit || !finalCredit || finalDebit === finalCredit) {
      alert('ডেবিট এবং ক্রেডিট অ্যাকাউন্ট ভিন্ন হতে হবে এবং সঠিক ব্যাংক হিসাব নির্বাচন করতে হবে!');
      return;
    }

    const newTx = {
      id: `JV-${Date.now()}`,
      type: 'manual_journal',
      amount: Number(voucherAmount),
      note: voucherNote,
      addDate: voucherDate,
      debitAcc: finalDebit,
      creditAcc: finalCredit,
    };
    if (onAddTransactions) onAddTransactions([newTx]);
    setIsPostingFormOpen(false);
    setVoucherAmount('');
    setVoucherNote('');
    alert('সফলভাবে পোস্ট করা হয়েছে!');
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-slate-200">
        <h3 className="font-black text-slate-800 text-sm">জেনারেল জার্নাল</h3>
        <button onClick={() => setIsPostingFormOpen(!isPostingFormOpen)} className="px-4 py-2 bg-blue-600 text-white text-xs font-bold rounded-xl flex items-center gap-2">
          <PlusCircle size={14} /> নতুন এন্ট্রি
        </button>
      </div>

      {isPostingFormOpen && (
        <div className="bg-white border border-blue-200 rounded-2xl p-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <GroupedAccountSelector label="ডেবিট (Dr) *" selectedId={debitAccountId} onSelect={setDebitAccountId} accounts={postableAccounts} colorTheme="emerald" />
            <GroupedAccountSelector label="ক্রেডিট (Cr) *" selectedId={creditAccountId} onSelect={setCreditAccountId} accounts={postableAccounts} colorTheme="rose" />
          </div>

          {/* Dynamic Bank Account Sub-Selection */}
          <div className="grid grid-cols-2 gap-4">
            {debitBankOptions.length > 0 ? (
              <div className="animate-in slide-in-from-top-1 duration-150">
                <label className="block text-[10px] font-extrabold text-blue-600 uppercase mb-1 font-sans">
                  নির্দিষ্ট ডেবিট ব্যাংক হিসাব (Debit Bank Account) *
                </label>
                <select
                  value={selectedDebitBankId}
                  onChange={(e) => setSelectedDebitBankId(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-blue-200 rounded-xl bg-blue-50/20 font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 min-h-[40px] cursor-pointer"
                >
                  {debitBankOptions.map(b => (
                    <option key={b.id} value={b.id}>
                      {b.bankName} [A/C: {b.accountNo}]
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              ['current_ac', 'savings_ac', 'fdr'].includes(debitAccountId) && (
                <div className="text-[10px] font-bold text-rose-600 bg-rose-50 border border-rose-100 p-2.5 rounded-xl col-span-1">
                  ⚠️ এই ধরণের কোনো ব্যাংক হিসাব নিবন্ধিত নেই! প্রথমে ব্যাংক হিসাব যোগ করুন।
                </div>
              )
            )}

            {creditBankOptions.length > 0 ? (
              <div className="animate-in slide-in-from-top-1 duration-150">
                <label className="block text-[10px] font-extrabold text-blue-600 uppercase mb-1 font-sans">
                  নির্দিষ্ট ক্রেডিট ব্যাংক হিসাব (Credit Bank Account) *
                </label>
                <select
                  value={selectedCreditBankId}
                  onChange={(e) => setSelectedCreditBankId(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-blue-200 rounded-xl bg-blue-50/20 font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 min-h-[40px] cursor-pointer"
                >
                  {creditBankOptions.map(b => (
                    <option key={b.id} value={b.id}>
                      {b.bankName} [A/C: {b.accountNo}]
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              ['current_ac', 'savings_ac', 'fdr'].includes(creditAccountId) && (
                <div className="text-[10px] font-bold text-rose-600 bg-rose-50 border border-rose-100 p-2.5 rounded-xl col-span-1">
                  ⚠️ এই ধরণের কোনো ব্যাংক হিসাব নিবন্ধিত নেই! প্রথমে ব্যাংক হিসাব যোগ করুন।
                </div>
              )
            )}
          </div>

          <input type="number" placeholder="টাকা (Amount)" className="w-full p-2 border rounded-lg text-xs font-bold" value={voucherAmount} onChange={(e) => setVoucherAmount(e.target.value)} />
          <input type="text" placeholder="বিবরণ" className="w-full p-2 border rounded-lg text-xs font-semibold" value={voucherNote} onChange={(e) => setVoucherNote(e.target.value)} />
          <input type="date" className="w-full p-2 border rounded-lg text-xs font-bold" value={voucherDate} onChange={(e) => setVoucherDate(e.target.value)} />
          <button onClick={handlePostVoucher} className="w-full py-2.5 bg-blue-600 text-white text-xs font-bold rounded-xl hover:bg-blue-700 transition shadow-sm">পোস্ট করুন</button>
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-slate-50 text-slate-600 font-bold border-b text-left">
              <th className="p-3">তারিখ</th>
              <th className="p-3">বিবরণ</th>
              <th className="p-3 text-right">ডেবিট (Debit Account)</th>
              <th className="p-3 text-right">ক্রেডিট (Credit Account)</th>
            </tr>
          </thead>
          <tbody>
            {transactions.filter(t => t.type === 'manual_journal').map(tx => (
              <tr key={tx.id} className="border-b font-semibold text-slate-700">
                <td className="p-3">{formatDDMMYYYY(tx.addDate || tx.date)}</td>
                <td className="p-3 font-medium text-slate-600">{tx.note}</td>
                <td className="p-3 text-right text-emerald-700 font-bold">
                  <div className="text-[11px]">{getAccountLabel(tx.debitAcc)}</div>
                  <div className="text-[10px] font-mono text-slate-400">৳{tx.amount.toLocaleString('bn-BD')}</div>
                </td>
                <td className="p-3 text-right text-rose-700 font-bold">
                  <div className="text-[11px]">{getAccountLabel(tx.creditAcc)}</div>
                  <div className="text-[10px] font-mono text-slate-400">৳{tx.amount.toLocaleString('bn-BD')}</div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
