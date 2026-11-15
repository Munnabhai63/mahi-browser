import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  Shield,
  Zap,
  Activity,
  RefreshCw,
  Cpu,
  Globe,
  Radio,
  Palette,
  Volume2,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Sparkles,
  ArrowRight,
  Monitor,
  Clock,
} from 'lucide-react';
import { useProfileStore } from '../stores/useProfileStore.js';
import { useToastStore } from '../stores/useToastStore.js';
import { ProfileAuditReport, DiagnosticCheck, DiagnosticStatus } from '../../10_CONFIG/shared/types/diagnostics.js';

export const Diagnostics: React.FC = () => {
  const { profiles, fetchProfiles } = useProfileStore();
  const { showToast } = useToastStore();
  const [selectedProfileId, setSelectedProfileId] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [fixing, setFixing] = useState<boolean>(false);
  const [report, setReport] = useState<ProfileAuditReport | null>(null);
  const [filterCategory, setFilterCategory] = useState<string>('ALL');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');

  useEffect(() => {
    fetchProfiles();
  }, [fetchProfiles]);

  useEffect(() => {
    if (profiles.length > 0 && !selectedProfileId) {
      setSelectedProfileId(profiles[0].id);
    }
  }, [profiles, selectedProfileId]);

  useEffect(() => {
    if (selectedProfileId) {
      runAudit(selectedProfileId);
    }
  }, [selectedProfileId]);

  const runAudit = async (profileId: string) => {
    setLoading(true);
    try {
      if (window.mahiAPI?.diagnosticsAudit) {
        const res = await window.mahiAPI.diagnosticsAudit(profileId);
        setReport(res);
      }
    } catch (err: any) {
      console.error('Audit failed:', err);
      showToast({
        type: 'error',
        title: 'Audit Failed',
        message: err?.message || 'Could not complete profile diagnostics audit.',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAutoFix = async () => {
    if (!selectedProfileId) return;
    setFixing(true);
    try {
      if (window.mahiAPI?.diagnosticsAutoFix) {
        const res = await window.mahiAPI.diagnosticsAutoFix(selectedProfileId);
        setReport(res);
        await fetchProfiles();
        showToast({
          type: 'success',
          title: 'Diagnostics Auto-Fix Complete',
          message: 'Profile configuration discrepancies resolved.',
        });
      }
    } catch (err: any) {
      console.error('Auto fix failed:', err);
      showToast({
        type: 'error',
        title: 'Auto-Fix Failed',
        message: err?.message || 'Could not resolve diagnostic issues.',
      });
    } finally {
      setFixing(false);
    }
  };

  const filteredChecks = (report?.checks || []).filter((c) => {
    const matchCat = filterCategory === 'ALL' || c.category === filterCategory;
    const matchStatus = filterStatus === 'ALL' || c.status === filterStatus;
    return matchCat && matchStatus;
  });

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'NETWORK':
        return <Globe className="w-4 h-4 text-teal-400" />;
      case 'CANVAS':
        return <Palette className="w-4 h-4 text-emerald-400" />;
      case 'WEBGL':
        return <Radio className="w-4 h-4 text-indigo-400" />;
      case 'AUDIO':
        return <Volume2 className="w-4 h-4 text-amber-400" />;
      case 'HARDWARE':
        return <Cpu className="w-4 h-4 text-cyan-400" />;
      case 'LOCALE':
        return <Globe className="w-4 h-4 text-teal-300" />;
      default:
        return <Activity className="w-4 h-4 text-teal-400" />;
    }
  };

  const getStatusBadge = (status: DiagnosticStatus) => {
    switch (status) {
      case 'PASS':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shadow-sm">
            <CheckCircle2 className="w-3.5 h-3.5" /> PASS
          </span>
        );
      case 'WARN':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 shadow-sm">
            <AlertTriangle className="w-3.5 h-3.5" /> WARNING
          </span>
        );
      case 'FAIL':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 shadow-sm">
            <XCircle className="w-3.5 h-3.5" /> LEAK RISK
          </span>
        );
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6 overflow-y-auto h-full custom-scrollbar font-sans">
      {/* Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-500/10 text-teal-600 dark:text-teal-400 flex items-center justify-center">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold text-slate-900 dark:text-white">
                  Stealth & Fingerprint Diagnostics
                </h1>
                <span className="px-2 py-0.5 text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-md">
                  Anti-Bot Auditor
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Real-time vulnerability analysis benchmarked against Pixelscan, CreepJS, Cloudflare & Datadome
              </p>
            </div>
          </div>
        </div>

        {/* Profile Selector & Control Actions */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <select
            value={selectedProfileId}
            onChange={(e) => setSelectedProfileId(e.target.value)}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-800 dark:text-slate-100 focus:outline-none focus:border-teal-500 shadow-xs"
          >
            {profiles.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>

          <button
            onClick={() => selectedProfileId && runAudit(selectedProfileId)}
            disabled={loading || !selectedProfileId}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 transition-all shadow-xs disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-teal-500 ${loading ? 'animate-spin' : ''}`} />
            <span>Re-Audit</span>
          </button>

          <button
            onClick={handleAutoFix}
            disabled={fixing || !selectedProfileId || report?.overallScore === 100}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-xs font-bold text-white shadow-sm shadow-teal-600/20 active:scale-95 transition-all disabled:opacity-50"
          >
            <Zap className={`w-3.5 h-3.5 ${fixing ? 'animate-bounce' : ''}`} />
            <span>{fixing ? 'Optimizing...' : 'Auto-Fix Stealth (100%)'}</span>
          </button>
        </div>
      </div>

      {/* Main Score & Grade Hero Section */}
      {report && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Radial Stealth Score Gauge */}
          <div className="lg:col-span-1 p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden flex flex-col justify-between">
            <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-br from-teal-500/10 to-transparent rounded-full blur-2xl pointer-events-none" />

            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Stealth Trust Score
              </span>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                {report.checks.length} Vectors Tested
              </span>
            </div>

            <div className="my-6 flex items-center justify-center">
              <div className="relative flex items-center justify-center">
                <svg className="w-44 h-44 transform -rotate-90">
                  <circle
                    cx="88"
                    cy="88"
                    r="74"
                    stroke="currentColor"
                    strokeWidth="12"
                    className="text-slate-100 dark:text-slate-800"
                    fill="transparent"
                  />
                  <circle
                    cx="88"
                    cy="88"
                    r="74"
                    stroke="currentColor"
                    strokeWidth="12"
                    strokeDasharray={2 * Math.PI * 74}
                    strokeDashoffset={2 * Math.PI * 74 * (1 - report.overallScore / 100)}
                    strokeLinecap="round"
                    className={
                      report.overallScore >= 90
                        ? 'text-teal-500 transition-all duration-1000'
                        : report.overallScore >= 70
                        ? 'text-amber-500 transition-all duration-1000'
                        : 'text-rose-500 transition-all duration-1000'
                    }
                    fill="transparent"
                  />
                </svg>
                <div className="absolute flex flex-col items-center">
                  <span className="text-4xl font-black text-slate-900 dark:text-white tracking-tight">
                    {report.overallScore}%
                  </span>
                  <span
                    className={`text-xs font-black uppercase tracking-widest mt-1 px-2.5 py-0.5 rounded-full ${
                      report.overallScore >= 90
                        ? 'bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-500/20'
                        : report.overallScore >= 70
                        ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                        : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
                    }`}
                  >
                    {report.stealthGrade}
                  </span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2.5 text-center pt-4 border-t border-slate-100 dark:border-slate-800/80">
              <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                <div className="text-xl font-black text-emerald-500">{report.passedCount}</div>
                <div className="text-[10px] uppercase font-bold text-emerald-600 dark:text-emerald-400">Passed</div>
              </div>
              <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20">
                <div className="text-xl font-black text-amber-500">{report.warnCount}</div>
                <div className="text-[10px] uppercase font-bold text-amber-600 dark:text-amber-400">Warnings</div>
              </div>
              <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20">
                <div className="text-xl font-black text-rose-500">{report.failCount}</div>
                <div className="text-[10px] uppercase font-bold text-rose-600 dark:text-rose-400">Leaks</div>
              </div>
            </div>
          </div>

          {/* Detailed Diagnosis Evaluation Panel */}
          <div className="lg:col-span-2 p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-3 mb-3">
                {report.overallScore >= 90 ? (
                  <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-500">
                    <ShieldCheck className="w-6 h-6" />
                  </div>
                ) : report.overallScore >= 70 ? (
                  <div className="p-2 rounded-xl bg-amber-500/10 text-amber-500">
                    <AlertTriangle className="w-6 h-6" />
                  </div>
                ) : (
                  <div className="p-2 rounded-xl bg-rose-500/10 text-rose-500">
                    <ShieldAlert className="w-6 h-6" />
                  </div>
                )}
                <div>
                  <h3 className="text-lg font-black text-slate-900 dark:text-white">
                    {report.overallScore >= 90
                      ? 'Ultra-Stealth Shield Active'
                      : report.overallScore >= 70
                      ? 'Moderate Stealth Inconsistencies Detected'
                      : 'Critical Anti-Bot Leak Vulnerabilities'}
                  </h3>
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    Profile: <strong className="text-teal-600 dark:text-teal-400 font-bold">{report.profileName}</strong>
                  </span>
                </div>
              </div>

              <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed mt-3">
                {report.overallScore >= 90
                  ? 'All hardware parameters, canvas entropy noise, discrete WebGL masking tables, and WebRTC candidate filters are 100% compliant with enterprise anti-detect standards.'
                  : report.overallScore >= 70
                  ? 'Your profile is moderately protected, but some parameters (like WebGL renderer or CPU cores) could trigger elevated bot-friction on strict targets like Cloudflare, Datadome, or Google.'
                  : 'Critical fingerprint leaks detected. Click "Auto-Fix Stealth" to automatically realign all anti-detect parameters and achieve full 100% stealth protection.'}
              </p>
            </div>

            <div className="mt-6 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span>
                  Audited at <strong className="text-slate-700 dark:text-slate-200 font-semibold">{new Date(report.auditedAt).toLocaleTimeString()}</strong>
                </span>
              </div>

              {report.overallScore < 100 && (
                <button
                  onClick={handleAutoFix}
                  disabled={fixing}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs shadow-sm transition-all shrink-0 active:scale-95"
                >
                  <span>Apply 1-Click Fix</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Filter Tabs & Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
        {/* Category Filters */}
        <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-x-auto">
          {['ALL', 'NETWORK', 'CANVAS', 'WEBGL', 'AUDIO', 'HARDWARE', 'LOCALE'].map((cat) => (
            <button
              key={cat}
              onClick={() => setFilterCategory(cat)}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                filterCategory === cat
                  ? 'bg-slate-200/80 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-semibold shadow-xs'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {cat === 'ALL' ? 'All' : cat.charAt(0) + cat.slice(1).toLowerCase()}
            </button>
          ))}
        </div>

        {/* Status Filters */}
        <div className="flex items-center gap-1">
          {['ALL', 'FAIL', 'WARN', 'PASS'].map((st) => (
            <button
              key={st}
              onClick={() => setFilterStatus(st)}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                filterStatus === st
                  ? 'bg-slate-200/80 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-semibold shadow-xs'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-850'
              }`}
            >
              {st === 'ALL' ? 'All Status' : st}
            </button>
          ))}
        </div>
      </div>

      {/* Detailed Check Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredChecks.map((check) => (
          <div
            key={check.id}
            className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-teal-500/40 transition-all shadow-sm flex flex-col justify-between gap-4 group"
          >
            <div>
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700/60 group-hover:scale-105 transition-transform">
                    {getCategoryIcon(check.category)}
                  </div>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white">{check.name}</h4>
                </div>
                {getStatusBadge(check.status)}
              </div>

              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed mt-2">
                {check.description}
              </p>
            </div>

            <div className="space-y-2 pt-3 border-t border-slate-100 dark:border-slate-800/80">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400 font-medium">Detected Config:</span>
                <span className="font-mono text-teal-600 dark:text-teal-400 font-bold truncate max-w-[250px]">
                  {check.actualValue}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400 font-medium">Anti-Bot Benchmark:</span>
                <span className="font-mono text-slate-500 dark:text-slate-400 font-semibold truncate max-w-[250px]">
                  {check.expectedValue}
                </span>
              </div>

              {check.recommendation && (
                <div className="mt-2.5 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-700 dark:text-amber-300 font-medium flex items-start gap-2.5">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-500" />
                  <span>{check.recommendation}</span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
