import React, { useState, useEffect } from 'react';
import {
  Users,
  Monitor,
  ShieldCheck,
  Clock,
  Ban,
  Plus,
  Search,
  Download,
  Copy,
  Check,
  Share2,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  ExternalLink,
  Laptop,
  Mail,
  Zap,
} from 'lucide-react';
import { useLicenseStore } from '../stores/useLicenseStore.js';
import { useToastStore } from '../stores/useToastStore.js';
import { LicenseRecord, CreateLicenseDTO } from '../../10_CONFIG/shared/types/license.js';
import { NavigationPage } from './Sidebar.js';

interface AdminFleetDashboardProps {
  onNavigate: (page: NavigationPage) => void;
}

export const AdminFleetDashboard: React.FC<AdminFleetDashboardProps> = ({ onNavigate }) => {
  const {
    adminLicenses,
    adminFetchLicenses,
    adminCreate,
    adminRevoke,
    adminExtend,
    adminLogin,
    isAdminAuthenticated,
    isLoading,
  } = useLicenseStore();

  const { showToast } = useToastStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [copiedKeyId, setCopiedKeyId] = useState<string | null>(null);

  // Quick Issue Student Modal
  const [isIssueModalOpen, setIsIssueModalOpen] = useState(false);
  const [studentName, setStudentName] = useState('');
  const [studentEmail, setStudentEmail] = useState('');
  const [duration, setDuration] = useState<'30_DAYS' | '90_DAYS' | '1_YEAR' | 'LIFETIME' | '7_DAYS' | '1_DAY'>('30_DAYS');
  const [maxDevices, setMaxDevices] = useState(1);
  const [notes, setNotes] = useState('');
  const [issuedKey, setIssuedKey] = useState<string | null>(null);

  // Auto-login with Master Key if not authenticated
  useEffect(() => {
    const initAdmin = async () => {
      if (!isAdminAuthenticated) {
        await adminLogin('MAHI_OWNER_AUTH_2026');
      }
      adminFetchLicenses();
    };
    initAdmin();
  }, [isAdminAuthenticated]);

  // Calculate Metrics
  const totalStudents = adminLicenses.length;
  const activeLicenses = adminLicenses.filter((l) => l.status === 'ACTIVE');
  const totalDevices = adminLicenses.reduce((acc, l) => acc + (l.activeDevicesCount || 0), 0);

  const expiringSoonCount = adminLicenses.filter((l) => {
    if (l.status !== 'ACTIVE' || !l.expiresAt) return false;
    const diffDays = (new Date(l.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
    return diffDays > 0 && diffDays <= 7;
  }).length;

  const revokedCount = adminLicenses.filter((l) => l.status === 'REVOKED').length;

  // Filtered Students
  const filteredStudents = adminLicenses.filter((lic) => {
    const matchesSearch =
      !searchQuery ||
      lic.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      lic.keyMasked.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (lic.accountId && lic.accountId.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (lic.notes && lic.notes.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesStatus =
      !statusFilter ||
      (statusFilter === 'EXPIRING_SOON'
        ? (() => {
            if (lic.status !== 'ACTIVE' || !lic.expiresAt) return false;
            const d = (new Date(lic.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
            return d > 0 && d <= 7;
          })()
        : lic.status === statusFilter);

    return matchesSearch && matchesStatus;
  });

  const handleCopyKey = (key: string, id: string) => {
    navigator.clipboard.writeText(key);
    setCopiedKeyId(id);
    showToast({ type: 'info', title: 'Copied', message: 'License key copied to clipboard' });
    setTimeout(() => setCopiedKeyId(null), 2000);
  };

  const handleCopyWhatsAppReceipt = (lic: LicenseRecord) => {
    const receipt = `👑 MAHI BROWSER PRO — STUDENT ACCESS RECEIPT
━━━━━━━━━━━━━━━━━━━━━━━━━━
🎓 Student / Client: ${lic.customerName}
📧 Registered ID: ${lic.accountId || 'Assigned Student'}
⏳ Validity: ${lic.durationType.replace('_', ' ')}
📅 Expiry: ${lic.expiresAt ? new Date(lic.expiresAt).toLocaleDateString() : 'Lifetime'}
🔑 License Key: ${lic.keyMasked}
💻 Authorized Devices: ${lic.maxDevices} PC(s)
━━━━━━━━━━━━━━━━━━━━━━━━━━
🚀 How to Activate on your PC:
1. Open MAHI BROWSER
2. Click "MAHI Pro License" in left sidebar
3. Paste key & click "Activate License"!`;

    navigator.clipboard.writeText(receipt);
    showToast({
      type: 'success',
      title: 'WhatsApp Receipt Copied',
      message: `Ready to send to ${lic.customerName}!`,
    });
  };

  const handleQuickExtend = async (lic: LicenseRecord, days = 30) => {
    const ok = await adminExtend({ licenseId: lic.id, additionalDays: days });
    if (ok) {
      showToast({
        type: 'success',
        title: 'Access Extended',
        message: `+${days} days added to ${lic.customerName}`,
      });
    }
  };

  const handleRevokeStudent = async (lic: LicenseRecord) => {
    if (!confirm(`Are you sure you want to REVOKE access for student "${lic.customerName}"? They will be locked out immediately.`)) return;
    const ok = await adminRevoke(lic.id, 'Revoked from Master Admin Dashboard');
    if (ok) {
      showToast({
        type: 'warning',
        title: 'Student Access Revoked',
        message: `${lic.customerName} has been locked out.`,
      });
    }
  };

  const handleIssueStudentKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentName.trim()) {
      showToast({ type: 'error', title: 'Validation', message: 'Student Name is required' });
      return;
    }

    try {
      const dto: CreateLicenseDTO = {
        customerName: studentName.trim(),
        accountId: studentEmail.trim() || undefined,
        durationType: duration,
        maxDevices: maxDevices || 1,
        notes: notes.trim() || undefined,
      };

      const res = await adminCreate(dto);
      if (res.success && res.rawLicenseKey) {
        setIssuedKey(res.rawLicenseKey);
        showToast({
          type: 'success',
          title: 'Student Key Issued',
          message: `License generated for ${dto.customerName}`,
        });
      }
    } catch (err: any) {
      showToast({
        type: 'error',
        title: 'Generation Failed',
        message: err?.message || 'Error creating student key',
      });
    }
  };

  const handleExportCSV = () => {
    if (adminLicenses.length === 0) {
      showToast({ type: 'warning', title: 'No Data', message: 'No student records to export' });
      return;
    }

    const headers = ['Customer Name', 'Account / Email', 'Key Masked', 'Status', 'Duration', 'Active Devices', 'Max Devices', 'Expiry Date', 'Created At'];
    const rows = adminLicenses.map((l) => [
      `"${l.customerName}"`,
      `"${l.accountId || ''}"`,
      `"${l.keyMasked}"`,
      `"${l.status}"`,
      `"${l.durationType}"`,
      l.activeDevicesCount || 0,
      l.maxDevices,
      `"${l.expiresAt || 'Lifetime'}"`,
      `"${l.createdAt}"`,
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `MAHI_Students_Fleet_Report_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showToast({
      type: 'success',
      title: 'Report Exported',
      message: 'Student fleet CSV file downloaded successfully!',
    });
  };

  return (
    <div className="space-y-6">
      {/* Master KPI Fleet Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3.5">
        <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-400">Total Students</span>
            <Users size={16} className="text-teal-500" />
          </div>
          <div className="text-2xl font-black text-slate-800 dark:text-white mt-1">{totalStudents}</div>
          <div className="text-[10px] text-slate-400 mt-0.5">Enrolled Clients</div>
        </div>

        <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-400">Live Machines</span>
            <Monitor size={16} className="text-indigo-500" />
          </div>
          <div className="text-2xl font-black text-indigo-500 mt-1">{totalDevices}</div>
          <div className="text-[10px] text-slate-400 mt-0.5">Bound PCs Online</div>
        </div>

        <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-400">Active Keys</span>
            <ShieldCheck size={16} className="text-emerald-500" />
          </div>
          <div className="text-2xl font-black text-emerald-500 mt-1">{activeLicenses.length}</div>
          <div className="text-[10px] text-slate-400 mt-0.5">Valid Subscriptions</div>
        </div>

        <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-400">Expiring Soon</span>
            <Clock size={16} className="text-amber-500" />
          </div>
          <div className="text-2xl font-black text-amber-500 mt-1">{expiringSoonCount}</div>
          <div className="text-[10px] text-slate-400 mt-0.5">Within 7 Days</div>
        </div>

        <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-400">Revoked / Locked</span>
            <Ban size={16} className="text-rose-500" />
          </div>
          <div className="text-2xl font-black text-rose-500 mt-1">{revokedCount}</div>
          <div className="text-[10px] text-slate-400 mt-0.5">Blocked Access</div>
        </div>
      </div>

      {/* Control Bar & Quick Actions */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Search & Filters */}
          <div className="flex items-center space-x-2 flex-1">
            <div className="relative flex-1 max-w-md">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search student name, Gmail, key, device..."
                className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold"
            >
              <option value="">All Statuses</option>
              <option value="ACTIVE">🟢 Active</option>
              <option value="EXPIRING_SOON">🟡 Expiring Soon (&le;7d)</option>
              <option value="EXPIRED">🔴 Expired</option>
              <option value="REVOKED">⛔ Revoked</option>
            </select>

            <button
              onClick={() => adminFetchLicenses()}
              disabled={isLoading}
              title="Refresh Fleet"
              className="p-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl text-slate-600 dark:text-slate-300 transition"
            >
              <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
            </button>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center space-x-2">
            <button
              onClick={handleExportCSV}
              className="px-3 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-semibold flex items-center space-x-1.5 transition"
            >
              <Download size={14} />
              <span>Export CSV</span>
            </button>

            <button
              onClick={() => {
                setIssuedKey(null);
                setStudentName('');
                setStudentEmail('');
                setNotes('');
                setIsIssueModalOpen(true);
              }}
              className="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white rounded-xl text-xs font-bold flex items-center space-x-1.5 shadow-sm shadow-teal-500/20 transition active:scale-95"
            >
              <Plus size={15} />
              <span>+ Issue Key to Student</span>
            </button>
          </div>
        </div>
      </div>

      {/* Live Student Tracking Directory Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-950/50">
          <div className="flex items-center space-x-2">
            <h3 className="text-xs font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wider">
              Student Fleet Live Directory
            </h3>
            <span className="px-2 py-0.5 rounded-full bg-teal-500/10 text-teal-600 dark:text-teal-400 text-[10px] font-bold">
              {filteredStudents.length} Students Tracked
            </span>
          </div>
          <span className="text-[11px] text-slate-400">
            Real-time Hardware & Remote Access Control
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 text-[11px] text-slate-400">
              <tr>
                <th className="py-3 px-4">Student / Client</th>
                <th className="py-3 px-4">License Key</th>
                <th className="py-3 px-4">Duration</th>
                <th className="py-3 px-4">Bound PCs</th>
                <th className="py-3 px-4">Expiry Date</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Remote Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-slate-400">
                    <Users className="w-8 h-8 mx-auto text-slate-500 mb-2 opacity-50" />
                    <p className="font-semibold">No students found matching your criteria</p>
                    <p className="text-[11px] mt-0.5">Click "+ Issue Key to Student" to enroll your first student.</p>
                  </td>
                </tr>
              ) : (
                filteredStudents.map((lic) => {
                  const daysRemaining = lic.expiresAt
                    ? Math.ceil((new Date(lic.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
                    : null;

                  return (
                    <tr key={lic.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition group">
                      {/* Student Info */}
                      <td className="py-3 px-4">
                        <div className="flex items-center space-x-2.5">
                          <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-teal-600 to-emerald-600 text-white font-bold flex items-center justify-center text-xs shrink-0">
                            {lic.customerName.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                              <span>{lic.customerName}</span>
                            </div>
                            <div className="text-[10px] text-slate-400 font-mono">
                              {lic.accountId || 'Standard Student'}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* License Key */}
                      <td className="py-3 px-4 font-mono">
                        <div className="flex items-center space-x-1.5">
                          <span className="font-bold text-teal-600 dark:text-teal-400 bg-teal-500/10 px-2 py-0.5 rounded-lg border border-teal-500/20">
                            {lic.keyMasked}
                          </span>
                          <button
                            onClick={() => handleCopyKey(lic.keyMasked, lic.id)}
                            title="Copy Masked Key"
                            className="p-1 hover:bg-slate-200 dark:hover:bg-slate-800 rounded text-slate-400 hover:text-slate-200 transition"
                          >
                            {copiedKeyId === lic.id ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
                          </button>
                        </div>
                      </td>

                      {/* Duration */}
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-semibold rounded-md text-[11px]">
                          {lic.durationType.replace('_', ' ')}
                        </span>
                      </td>

                      {/* Bound Devices */}
                      <td className="py-3 px-4">
                        <div className="flex items-center space-x-1 font-semibold text-slate-700 dark:text-slate-300">
                          <Laptop size={13} className="text-slate-400" />
                          <span>{lic.activeDevicesCount || 0} / {lic.maxDevices} PC</span>
                        </div>
                      </td>

                      {/* Expiry Date & Countdown */}
                      <td className="py-3 px-4">
                        {lic.expiresAt ? (
                          <div>
                            <div className="font-semibold text-slate-700 dark:text-slate-300">
                              {new Date(lic.expiresAt).toLocaleDateString()}
                            </div>
                            <div className="text-[10px]">
                              {daysRemaining !== null && daysRemaining > 7 ? (
                                <span className="text-emerald-500 font-bold">{daysRemaining} days left</span>
                              ) : daysRemaining !== null && daysRemaining > 0 ? (
                                <span className="text-amber-500 font-bold">⚠️ {daysRemaining} days left</span>
                              ) : (
                                <span className="text-rose-500 font-bold">Expired</span>
                              )}
                            </div>
                          </div>
                        ) : (
                          <span className="font-bold text-teal-400">Lifetime Access</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4">
                        {lic.status === 'ACTIVE' ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 flex items-center space-x-1 w-max">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            <span>ACTIVE</span>
                          </span>
                        ) : lic.status === 'EXPIRED' ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30 w-max block">
                            EXPIRED
                          </span>
                        ) : lic.status === 'REVOKED' ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/30 w-max block">
                            REVOKED
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-400 w-max block">
                            {lic.status}
                          </span>
                        )}
                      </td>

                      {/* Remote Actions */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end space-x-1.5">
                          {/* Copy WhatsApp Receipt */}
                          <button
                            onClick={() => handleCopyWhatsAppReceipt(lic)}
                            title="Copy WhatsApp Message for Student"
                            className="p-1.5 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 transition"
                          >
                            <Share2 size={13} />
                          </button>

                          {/* Quick Extend +30 Days */}
                          <button
                            onClick={() => handleQuickExtend(lic, 30)}
                            title="Extend +30 Days"
                            className="px-2 py-1 rounded-lg bg-teal-500/10 hover:bg-teal-500/20 text-teal-500 dark:text-teal-400 border border-teal-500/30 text-[11px] font-bold transition"
                          >
                            +30d
                          </button>

                          {/* Revoke Student */}
                          {lic.status !== 'REVOKED' ? (
                            <button
                              onClick={() => handleRevokeStudent(lic)}
                              title="Revoke / Ban Student"
                              className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 border border-rose-500/30 transition"
                            >
                              <Ban size={13} />
                            </button>
                          ) : (
                            <button
                              onClick={() => handleQuickExtend(lic, 30)}
                              title="Unban & Restore +30 Days"
                              className="px-2 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold"
                            >
                              Restore
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

      {/* Quick Issue Student Key Modal */}
      {isIssueModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-in fade-in duration-150">
          <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden text-slate-100 p-6 space-y-4">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Plus className="text-teal-400" size={18} />
              <span>Issue License to Student</span>
            </h3>

            {issuedKey ? (
              <div className="space-y-4 py-2">
                <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl text-center space-y-2">
                  <div className="text-xs text-emerald-400 font-bold flex items-center justify-center gap-1.5">
                    <CheckCircle2 size={16} />
                    <span>Key Generated Successfully!</span>
                  </div>
                  <div className="font-mono text-sm font-bold text-white select-all p-2 bg-slate-950 rounded-xl border border-slate-800">
                    {issuedKey}
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Share this 16-character key with student <strong>{studentName}</strong>.
                  </p>
                </div>

                <div className="flex flex-col gap-2">
                  <button
                    onClick={() => handleCopyKey(issuedKey, 'issued')}
                    className="w-full py-2.5 bg-teal-600 hover:bg-teal-500 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition shadow-lg shadow-teal-500/20"
                  >
                    <Copy size={14} />
                    <span>Copy Raw Key</span>
                  </button>

                  <button
                    onClick={() => {
                      const receipt = `👑 MAHI BROWSER PRO — STUDENT ACCESS RECEIPT
━━━━━━━━━━━━━━━━━━━━━━━━━━
🎓 Student: ${studentName}
📧 Registered ID: ${studentEmail || 'Student User'}
⏳ Plan Validity: ${duration.replace('_', ' ')}
🔑 License Key: ${issuedKey}
💻 Max PCs: ${maxDevices}
━━━━━━━━━━━━━━━━━━━━━━━━━━
🚀 How to Activate:
1. Open MAHI BROWSER
2. Click "MAHI Pro License" in sidebar
3. Paste key & click "Activate License"!`;
                      navigator.clipboard.writeText(receipt);
                      showToast({ type: 'success', title: 'Receipt Copied', message: 'WhatsApp message copied!' });
                    }}
                    className="w-full py-2.5 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition"
                  >
                    <Share2 size={14} />
                    <span>Copy WhatsApp Receipt</span>
                  </button>

                  <button
                    onClick={() => setIsIssueModalOpen(false)}
                    className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold"
                  >
                    Done & Close
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleIssueStudentKey} className="space-y-3.5 text-xs">
                <div>
                  <label className="block font-bold text-slate-300 mb-1">Student / Client Name *</label>
                  <input
                    type="text"
                    required
                    value={studentName}
                    onChange={(e) => setStudentName(e.target.value)}
                    placeholder="e.g. Rahul Sharma"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-300 mb-1">Student Gmail ID (Optional)</label>
                  <input
                    type="email"
                    value={studentEmail}
                    onChange={(e) => setStudentEmail(e.target.value)}
                    placeholder="rahul@gmail.com"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs font-mono"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-300 mb-1">Duration</label>
                    <select
                      value={duration}
                      onChange={(e) => setDuration(e.target.value as any)}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs font-semibold"
                    >
                      <option value="1_DAY">1 Day Trial</option>
                      <option value="7_DAYS">7 Days</option>
                      <option value="30_DAYS">30 Days (1 Month)</option>
                      <option value="90_DAYS">90 Days (3 Months)</option>
                      <option value="1_YEAR">1 Year</option>
                      <option value="LIFETIME">Lifetime</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-300 mb-1">Max Devices (PCs)</label>
                    <input
                      type="number"
                      min={1}
                      max={10}
                      value={maxDevices}
                      onChange={(e) => setMaxDevices(parseInt(e.target.value, 10) || 1)}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-slate-300 mb-1">Notes / Batch (Optional)</label>
                  <input
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="e.g. Batch 2026 / Paid via UPI"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs"
                  />
                </div>

                <div className="flex space-x-2 pt-2">
                  <button
                    type="submit"
                    className="flex-1 py-2.5 bg-teal-600 hover:bg-teal-500 text-white font-bold rounded-xl text-xs transition shadow-lg shadow-teal-500/20"
                  >
                    Generate & Issue Key
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsIssueModalOpen(false)}
                    className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
