import React, { useState, useEffect, useCallback } from 'react';
import {
  Play,
  Square,
  Clock,
  Layers,
  History,
  Calendar,
  Sparkles,
  RefreshCw,
  Plus,
  AlertCircle,
  CheckCircle2,
  Trash2,
  ChevronRight,
  ShieldCheck,
  FileText,
  ExternalLink,
} from 'lucide-react';
import { api } from '../api/api-client.js';
import { TeamWorkspace } from '../../../10_CONFIG/shared/types/workspace.js';
import { WebProfileItem } from './ProfilesPage.js';

interface AutomationPageProps {
  currentWorkspace: TeamWorkspace | null;
  profiles: WebProfileItem[];
  recordAudit?: (eventType: string, targetResource: string, summary: string, status?: 'SUCCESS' | 'FAILURE' | 'DENIED') => void;
}

export const AutomationPage: React.FC<AutomationPageProps> = ({
  currentWorkspace,
  profiles,
  recordAudit,
}) => {
  const [activeTab, setActiveTab] = useState<'workflows' | 'history' | 'schedules' | 'templates'>('workflows');
  const [isLoading, setIsLoading] = useState(false);
  const [workflows, setWorkflows] = useState<any[]>([]);
  const [runs, setRuns] = useState<any[]>([]);
  const [schedules, setSchedules] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);

  // Selected workflow & logs view modal
  const [selectedWorkflow, setSelectedWorkflow] = useState<any | null>(null);
  const [selectedRunLogs, setSelectedRunLogs] = useState<any | null>(null);
  const [isRunModalOpen, setIsRunModalOpen] = useState(false);
  const [selectedRunProfileId, setSelectedRunProfileId] = useState<string>('');
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const showToast = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 4000);
  };

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [wfRes, runsRes, schedRes, tplRes] = await Promise.all([
        api.listWorkflows(currentWorkspace?.id),
        api.getWorkflowRuns(),
        api.listSchedules(currentWorkspace?.id),
        api.getAutomationTemplates(),
      ]);

      if (wfRes.success && wfRes.data) setWorkflows(wfRes.data);
      if (runsRes.success && runsRes.data) setRuns(runsRes.data);
      if (schedRes.success && schedRes.data) setSchedules(schedRes.data);
      if (tplRes.success && tplRes.data) setTemplates(tplRes.data);
    } catch {
      showToast('error', 'Failed to fetch automation data');
    } finally {
      setIsLoading(false);
    }
  }, [currentWorkspace]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleStartRun = async (workflow: any) => {
    setSelectedWorkflow(workflow);
    if (profiles.length > 0) {
      setSelectedRunProfileId(profiles[0].id);
    }
    setIsRunModalOpen(true);
  };

  const executeRun = async () => {
    if (!selectedWorkflow || !selectedRunProfileId) return;

    try {
      const res = await api.runWorkflow(selectedWorkflow.id, selectedRunProfileId);
      if (res.success) {
        showToast('success', `Workflow queued (Run ID: ${res.data?.runId})`);
        recordAudit?.('WORKFLOW_TRIGGERED', selectedWorkflow.name, `Queued execution for profile ${selectedRunProfileId}`);
        setIsRunModalOpen(false);
        loadData();
      } else {
        showToast('error', res.error?.message || 'Failed to trigger workflow');
      }
    } catch {
      showToast('error', 'Network error triggering workflow');
    }
  };

  const handleStopRun = async (runId: string) => {
    try {
      const res = await api.stopWorkflowRun(runId);
      if (res.success) {
        showToast('success', `Run ${runId} stopped`);
        recordAudit?.('WORKFLOW_STOPPED', runId, 'Workflow execution stopped by user');
        loadData();
      } else {
        showToast('error', res.error?.message || 'Failed to stop run');
      }
    } catch {
      showToast('error', 'Network error stopping run');
    }
  };

  const handleViewLogs = async (runId: string) => {
    try {
      const res = await api.getWorkflowRunLogs(runId);
      if (res.success && res.data) {
        setSelectedRunLogs({ runId, logs: res.data });
      }
    } catch {
      showToast('error', 'Could not load step execution logs');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2.5">
            <Sparkles className="w-6 h-6 text-indigo-500" />
            Automation & RPA Studio
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Visual workflows, session preparation, multi-profile runs, and scheduled automation.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => loadData()}
            disabled={isLoading}
            className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {notification && (
        <div
          className={`p-3.5 rounded-xl border flex items-center gap-2.5 text-xs ${
            notification.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-500/20 text-emerald-600 dark:text-emerald-400'
              : 'bg-rose-50 dark:bg-rose-950/30 border-rose-500/20 text-rose-600 dark:text-rose-400'
          }`}
        >
          {notification.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          {notification.message}
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 gap-6 text-sm">
        <button
          onClick={() => setActiveTab('workflows')}
          className={`pb-3 font-semibold transition border-b-2 flex items-center gap-2 ${
            activeTab === 'workflows'
              ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
          }`}
        >
          <Layers className="w-4 h-4" />
          Workflows ({workflows.length})
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`pb-3 font-semibold transition border-b-2 flex items-center gap-2 ${
            activeTab === 'history'
              ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
          }`}
        >
          <History className="w-4 h-4" />
          Run History ({runs.length})
        </button>
        <button
          onClick={() => setActiveTab('schedules')}
          className={`pb-3 font-semibold transition border-b-2 flex items-center gap-2 ${
            activeTab === 'schedules'
              ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
          }`}
        >
          <Calendar className="w-4 h-4" />
          Schedules ({schedules.length})
        </button>
        <button
          onClick={() => setActiveTab('templates')}
          className={`pb-3 font-semibold transition border-b-2 flex items-center gap-2 ${
            activeTab === 'templates'
              ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
          }`}
        >
          <Sparkles className="w-4 h-4" />
          Templates ({templates.length})
        </button>
      </div>

      {/* Tab: Workflows */}
      {activeTab === 'workflows' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {workflows.map((wf) => (
            <div
              key={wf.id}
              className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl flex flex-col justify-between hover:border-slate-300 dark:hover:border-slate-700 transition space-y-4"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-900 dark:text-white text-base">
                    {wf.name}
                  </span>
                  <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-[10px] font-mono text-slate-600 dark:text-slate-400 rounded-md">
                    v{wf.version || 1}
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2">
                  {wf.description || 'No description provided'}
                </p>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  <span className="px-2 py-0.5 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 text-[10px] font-medium rounded-full">
                    {wf.steps?.length || 0} Steps
                  </span>
                  {wf.variables?.length > 0 && (
                    <span className="px-2 py-0.5 bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 text-[10px] font-medium rounded-full">
                      {wf.variables.length} Variables
                    </span>
                  )}
                  {wf.tags?.map((t: string) => (
                    <span key={t} className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-[10px] font-medium rounded-full">
                      {t}
                    </span>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  onClick={() => handleStartRun(wf)}
                  className="flex-1 flex items-center justify-center gap-2 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl shadow-sm transition"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  Run Workflow
                </button>
              </div>
            </div>
          ))}

          {workflows.length === 0 && (
            <div className="col-span-full py-12 text-center text-slate-400 dark:text-slate-500 text-xs">
              No automation workflows found. Create workflows using the visual builder in the desktop app.
            </div>
          )}
        </div>
      )}

      {/* Tab: Run History */}
      {activeTab === 'history' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 font-semibold border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="px-4 py-3">Run ID</th>
                  <th className="px-4 py-3">Workflow</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Duration</th>
                  <th className="px-4 py-3">Summary</th>
                  <th className="px-4 py-3">Started</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {runs.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20">
                    <td className="px-4 py-3 font-mono text-[11px] text-slate-500">{r.id.substring(0, 12)}...</td>
                    <td className="px-4 py-3 font-semibold text-slate-900 dark:text-white">{r.workflowId}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          r.status === 'SUCCESS' || r.status === 'SUCCEEDED'
                            ? 'bg-emerald-500/10 text-emerald-500'
                            : r.status === 'RUNNING'
                            ? 'bg-indigo-500/10 text-indigo-500 animate-pulse'
                            : 'bg-rose-500/10 text-rose-500'
                        }`}
                      >
                        {r.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-500">{r.durationMs ? `${r.durationMs}ms` : '—'}</td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-400 max-w-xs truncate">{r.summary || 'Completed'}</td>
                    <td className="px-4 py-3 text-slate-500">{new Date(r.startedAt).toLocaleString()}</td>
                    <td className="px-4 py-3 text-right space-x-2">
                      <button
                        onClick={() => handleViewLogs(r.id)}
                        className="px-2 py-1 text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
                      >
                        Logs
                      </button>
                      {r.status === 'RUNNING' && (
                        <button
                          onClick={() => handleStopRun(r.id)}
                          className="px-2 py-1 text-xs text-rose-600 hover:underline"
                        >
                          Stop
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {runs.length === 0 && (
                  <tr>
                    <td colSpan={7} className="text-center py-8 text-slate-400">
                      No execution logs recorded yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab: Schedules */}
      {activeTab === 'schedules' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 font-semibold border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="px-4 py-3">Schedule ID</th>
                  <th className="px-4 py-3">Workflow</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Next Run</th>
                  <th className="px-4 py-3">Timezone</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {schedules.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20">
                    <td className="px-4 py-3 font-mono text-[11px] text-slate-500">{s.id.substring(0, 10)}...</td>
                    <td className="px-4 py-3 font-semibold text-slate-900 dark:text-white">{s.workflowId}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-[10px] font-medium rounded-full">
                        {s.scheduleType}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          s.status === 'ACTIVE'
                            ? 'bg-emerald-500/10 text-emerald-500'
                            : s.status === 'WAITING_FOR_DEVICE'
                            ? 'bg-amber-500/10 text-amber-500'
                            : 'bg-slate-500/10 text-slate-500'
                        }`}
                      >
                        {s.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                      {s.nextRunAt ? new Date(s.nextRunAt).toLocaleString() : '—'}
                    </td>
                    <td className="px-4 py-3 text-slate-500">{s.timezone}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={async () => {
                          await api.deleteSchedule(s.id);
                          loadData();
                        }}
                        className="p-1 hover:text-rose-500 text-slate-400 transition"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
                {schedules.length === 0 && (
                  <tr>
                    <td colSpan={7} className="text-center py-8 text-slate-400">
                      No active automation schedules configured.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab: Templates */}
      {activeTab === 'templates' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map((tpl) => (
            <div
              key={tpl.id}
              className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl flex flex-col justify-between hover:border-slate-300 dark:hover:border-slate-700 transition space-y-3"
            >
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-900 dark:text-white text-sm">
                    {tpl.name}
                  </span>
                  <span className="px-2 py-0.5 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 text-[10px] font-medium rounded-full">
                    {tpl.category}
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {tpl.description}
                </p>
                <div className="pt-2 text-[11px] text-slate-400">
                  {tpl.siteCount || tpl.sites?.length || 0} Target Websites
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Run Trigger Modal */}
      {isRunModalOpen && selectedWorkflow && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4 shadow-xl">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Play className="w-4 h-4 text-indigo-500 fill-current" />
              Launch Automation
            </h3>
            <p className="text-xs text-slate-500">
              Running workflow <strong className="text-slate-700 dark:text-slate-300">"{selectedWorkflow.name}"</strong>
            </p>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                Select Profile
              </label>
              <select
                value={selectedRunProfileId}
                onChange={(e) => setSelectedRunProfileId(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs"
              >
                {profiles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.id.substring(0, 8)}...)
                  </option>
                ))}
              </select>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setIsRunModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition"
              >
                Cancel
              </button>
              <button
                onClick={executeRun}
                className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-sm transition"
              >
                Start Execution
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Logs View Modal */}
      {selectedRunLogs && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4 shadow-xl max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <FileText className="w-4 h-4 text-indigo-500" />
                Step Execution Logs ({selectedRunLogs.runId.substring(0, 12)})
              </h3>
              <button
                onClick={() => setSelectedRunLogs(null)}
                className="text-xs text-slate-400 hover:text-slate-600"
              >
                Close
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {Array.isArray(selectedRunLogs.logs) && selectedRunLogs.logs.map((log: any, idx: number) => (
                <div
                  key={idx}
                  className="p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs space-y-1"
                >
                  <div className="flex items-center justify-between font-mono text-[11px]">
                    <span className="font-bold text-indigo-600 dark:text-indigo-400">
                      Step #{idx + 1}: {log.stepType}
                    </span>
                    <span className="text-slate-400">{log.durationMs || 0}ms</span>
                  </div>
                  {log.output && (
                    <p className="text-slate-700 dark:text-slate-300 font-mono text-[11px] bg-white dark:bg-slate-900 p-2 rounded-lg border border-slate-100 dark:border-slate-800">
                      {log.output}
                    </p>
                  )}
                  {log.error && (
                    <p className="text-rose-600 dark:text-rose-400 text-[11px] font-mono">
                      Error: {log.error}
                    </p>
                  )}
                </div>
              ))}
              {(!selectedRunLogs.logs || selectedRunLogs.logs.length === 0) && (
                <div className="text-center py-8 text-slate-400 text-xs">No logs recorded for this run.</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
