import type React from 'react';
import { useEffect, useState } from 'react';
import {
  PlaySquare,
  Plus,
  Play,
  Trash2,
  Edit2,
  Clock,
  CheckCircle2,
  AlertCircle,
  Image as ImageIcon,
  Users,
  Layers,
} from 'lucide-react';
import { useAutomationStore } from '../stores/useAutomationStore.js';
import { useProfileStore } from '../stores/useProfileStore.js';
import type { AutomationWorkflow, RpaTemplate } from '../../10_CONFIG/shared/types/automation.js';
import { ConfirmModal } from '../components/ConfirmModal.js';
import type { NavigationPage } from '../components/Sidebar.js';
import { RPA_TEMPLATES } from '../../10_CONFIG/shared/constants/automation-templates.js';

interface AutomationListProps {
  onNavigate: (page: NavigationPage) => void;
}

export const AutomationListPage: React.FC<AutomationListProps> = ({ onNavigate }) => {
  const {
    workflows,
    fetchWorkflows,
    setSelectedWorkflow,
    deleteWorkflow,
    runWorkflow,
    runWorkflowBatch,
    isRunning,
    activeExecutionLog,
    executionLogs,
    fetchLogs,
    saveWorkflow,
  } = useAutomationStore();

  const { profiles, fetchProfiles } = useProfileStore();

  const [selectedProfileForRun, setSelectedProfileForRun] = useState<Record<string, string>>({});
  const [deleteTarget, setDeleteTarget] = useState<AutomationWorkflow | null>(null);
  const [selectedScreenshot, setSelectedScreenshot] = useState<string | null>(null);
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);

  // Batch Run Modal State
  const [batchTargetWorkflow, setBatchTargetWorkflow] = useState<AutomationWorkflow | null>(null);
  const [batchSelectedProfileIds, setBatchSelectedProfileIds] = useState<string[]>([]);
  const [batchDelayMs, setBatchDelayMs] = useState(1500);

  useEffect(() => {
    fetchWorkflows();
    fetchProfiles();
    fetchLogs();
  }, [fetchWorkflows, fetchProfiles, fetchLogs]);

  const handleRun = async (wf: AutomationWorkflow) => {
    const profileId = selectedProfileForRun[wf.id] || wf.defaultProfileId || profiles[0]?.id;
    if (!profileId) return;

    await runWorkflow({
      workflowId: wf.id,
      profileId,
    });
  };

  const handleExecuteBatchRun = async () => {
    if (!batchTargetWorkflow || batchSelectedProfileIds.length === 0) return;

    const targetWf = batchTargetWorkflow;
    const targetIds = [...batchSelectedProfileIds];
    setBatchTargetWorkflow(null);
    setBatchSelectedProfileIds([]);

    await runWorkflowBatch({
      workflowId: targetWf.id,
      profileIds: targetIds,
      delayMs: batchDelayMs,
    });
  };

  const handleEdit = (wf: AutomationWorkflow) => {
    setSelectedWorkflow(wf);
    onNavigate('workflow-builder');
  };

  const handleCreateNew = () => {
    setSelectedWorkflow(null);
    onNavigate('workflow-builder');
  };

  const handleInstallTemplate = async (tpl: RpaTemplate) => {
    const newWorkflow = await saveWorkflow({
      name: tpl.name,
      description: tpl.description,
      steps: tpl.steps.map((s, idx) => ({
        ...s,
        id: Math.random().toString(36).substring(2, 9),
        order: idx,
      })),
    });
    setIsTemplateModalOpen(false);
    if (newWorkflow) {
      setSelectedWorkflow(newWorkflow);
      onNavigate('workflow-builder');
    }
  };

  return (
    <div className="p-8 space-y-6 max-w-7xl mx-auto h-full flex flex-col justify-between overflow-y-auto custom-scrollbar font-sans">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center space-x-2.5">
            <h1 className="text-base font-bold text-slate-900 dark:text-white">
              Automation Workflows
            </h1>
            <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
              Playwright RPA Engine
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Automate browser tasks across isolated profiles with visual steps and screenshot telemetry
          </p>
        </div>

        <div className="flex items-center space-x-2.5">
          <button type="button"
            onClick={() => setIsTemplateModalOpen(true)}
            className="px-3.5 py-1.5 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs rounded-xl shadow-xs flex items-center space-x-1.5 active:scale-95 transition-all"
          >
            <Layers className="w-3.5 h-3.5 text-teal-500" />
            <span>Pre-Built Templates</span>
          </button>

          <button type="button"
            onClick={handleCreateNew}
            className="px-3.5 py-1.5 bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs rounded-xl shadow-sm shadow-teal-600/20 flex items-center space-x-1.5 active:scale-95 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>New Workflow</span>
          </button>
        </div>
      </div>

      {/* Main Grid: Workflows List + Execution Results */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1">
        {/* Workflows Column (2 cols) */}
        <div className="lg:col-span-2 space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Saved Automation Workflows
          </h3>

          {workflows.length === 0 ? (
            <div className="p-12 text-center border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-2xl space-y-3 shadow-xs">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center mx-auto mb-2">
                <PlaySquare className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                No Workflows Created Yet
              </h4>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                Build visual step-by-step automation sequences or load one of our ready-to-use pre-built RPA templates.
              </p>
              <div className="flex items-center justify-center space-x-2.5 pt-2">
                <button type="button"
                  onClick={() => setIsTemplateModalOpen(true)}
                  className="px-3.5 py-1.5 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-xl shadow-xs transition"
                >
                  Load Pre-Built Template
                </button>
                <button type="button"
                  onClick={handleCreateNew}
                  className="px-3.5 py-1.5 bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold rounded-xl shadow-sm transition"
                >
                  Create Custom Workflow
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-2.5">
              {workflows.map((wf) => {
                const targetProfileId = selectedProfileForRun[wf.id] || wf.defaultProfileId || profiles[0]?.id;

                return (
                  <div
                    key={wf.id}
                    className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4 hover:border-teal-500/40 transition-all"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2">
                        <h4 className="font-semibold text-slate-800 dark:text-slate-100 text-xs">
                          {wf.name}
                        </h4>
                        <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-500">
                          {wf.steps.length} Steps
                        </span>
                      </div>
                      {wf.description && (
                        <p className="text-[11px] text-slate-400">{wf.description}</p>
                      )}

                      <div className="flex flex-wrap gap-1 pt-1">
                        {wf.steps.map((s, idx) => (
                          <span
                            key={s.id}
                            className="px-1.5 py-0.5 rounded bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-[10px] font-mono text-slate-600 dark:text-slate-400"
                          >
                            {idx + 1}. {s.type}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="flex items-center space-x-2 pt-2 md:pt-0 border-t md:border-t-0 border-slate-100 dark:border-slate-800">
                      <select
                        value={targetProfileId}
                        onChange={(e) =>
                          setSelectedProfileForRun({
                            ...selectedProfileForRun,
                            [wf.id]: e.target.value,
                          })
                        }
                        className="px-2.5 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300"
                      >
                        {profiles.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </select>

                      <button type="button"
                        onClick={() => handleRun(wf)}
                        disabled={isRunning}
                        className="px-3 py-1.5 bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-xs flex items-center space-x-1 active:scale-95 transition-all"
                        title="Run on selected profile"
                      >
                        <Play className="w-3 h-3 fill-current" />
                        <span>Run</span>
                      </button>

                      <button type="button"
                        onClick={() => {
                          setBatchTargetWorkflow(wf);
                          setBatchSelectedProfileIds(profiles.slice(0, 3).map((p) => p.id));
                        }}
                        disabled={isRunning}
                        className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-xl shadow-xs flex items-center space-x-1 active:scale-95 transition-all"
                        title="Batch Run across multiple profiles"
                      >
                        <Users className="w-3 h-3 text-cyan-400" />
                        <span>Batch</span>
                      </button>

                      <button type="button"
                        onClick={() => handleEdit(wf)}
                        className="p-1.5 text-slate-400 hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800"
                        title="Edit in Visual Studio"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>

                      <button type="button"
                        onClick={() => setDeleteTarget(wf)}
                        className="p-1.5 text-slate-400 hover:text-rose-500 rounded-xl hover:bg-rose-500/10"
                        title="Delete Workflow"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Live Execution Output Column (1 col) */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">
              Execution Output
            </h3>
            {isRunning && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-teal-500/10 text-teal-500 border border-teal-500/20 animate-pulse">
                Running...
              </span>
            )}
          </div>

          {!activeExecutionLog && executionLogs.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-xs">
              Select a workflow and click <strong>Run</strong> or <strong>Batch</strong> to view live execution logs and screenshot evidence.
            </div>
          ) : (
            <div className="space-y-4">
              {activeExecutionLog && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs pb-2 border-b border-slate-100 dark:border-slate-800">
                    <span className="font-bold text-slate-800 dark:text-slate-200">
                      Live Result:
                    </span>
                    <span
                      className={`font-bold px-2 py-0.5 rounded-full text-[10px] ${
                        activeExecutionLog.status === 'SUCCESS'
                          ? 'bg-emerald-500/10 text-emerald-500'
                          : 'bg-rose-500/10 text-rose-500'
                      }`}
                    >
                      {activeExecutionLog.status} ({activeExecutionLog.totalDurationMs}ms)
                    </span>
                  </div>

                  <div className="space-y-2 max-h-[380px] overflow-y-auto custom-scrollbar pr-1">
                    {activeExecutionLog.stepLogs.map((step) => (
                      <div
                        key={`${step.stepId}-${step.stepType}-${step.timestamp ?? step.durationMs}`}
                        className={`p-3 rounded-xl border text-xs space-y-1 ${
                          step.status === 'SUCCESS'
                            ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-500/20'
                            : 'bg-rose-50/50 dark:bg-rose-950/20 border-rose-500/20'
                        }`}
                      >
                        <div className="flex items-center justify-between font-bold">
                          <div className="flex items-center space-x-1.5">
                            {step.status === 'SUCCESS' ? (
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                            ) : (
                              <AlertCircle className="w-3.5 h-3.5 text-rose-500" />
                            )}
                            <span className="font-mono text-[11px]">{step.stepType}</span>
                          </div>
                          <span className="text-[10px] text-slate-400 font-normal">
                            {step.durationMs}ms
                          </span>
                        </div>

                        {step.output && (
                          <div className="text-[11px] text-slate-600 dark:text-slate-300">
                            {step.output}
                          </div>
                        )}
                        {step.error && (
                          <div className="text-[11px] text-rose-500 font-mono">
                            {step.error}
                          </div>
                        )}

                        {step.screenshotBase64 && (
                          <button type="button"
                            onClick={() =>
                              setSelectedScreenshot(`data:image/jpeg;base64,${step.screenshotBase64}`)
                            }
                            className="text-[10px] text-teal-600 dark:text-teal-400 font-bold flex items-center space-x-1 pt-1 underline"
                          >
                            <ImageIcon className="w-3 h-3" />
                            <span>View Captured Screenshot</span>
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Pre-Built Templates Modal */}
      {isTemplateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="p-6">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-xl bg-teal-500/10 text-teal-600 dark:text-teal-400 flex items-center justify-center">
                    <Layers className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">
                      Pre-Built RPA Templates
                    </h3>
                    <p className="text-xs text-slate-400">
                      1-Click install production-ready automation workflows
                    </p>
                  </div>
                </div>
                <button type="button"
                  onClick={() => setIsTemplateModalOpen(false)}
                  className="text-slate-400 hover:text-slate-200 text-sm font-bold p-1.5"
                >
                  ✕
                </button>
              </div>

              <div className="py-4 space-y-3 max-h-[420px] overflow-y-auto custom-scrollbar">
                {RPA_TEMPLATES.map((tpl) => (
                  <div
                    key={tpl.id}
                    className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 hover:border-teal-500/40 transition-all flex items-start justify-between space-x-4"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-xs text-slate-800 dark:text-slate-100">
                          {tpl.name}
                        </span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-500/20">
                          {tpl.category}
                        </span>
                        <span className="text-[10px] text-slate-400 flex items-center">
                          <Clock className="w-3 h-3 text-slate-400 mr-1 inline" />
                          <span>{tpl.estimatedDuration}</span>
                        </span>
                      </div>
                      <p className="text-xs text-slate-400">{tpl.description}</p>
                      <div className="text-[11px] font-mono text-teal-600 dark:text-teal-400 pt-1">
                        {tpl.steps.length} Steps: {tpl.steps.map((s) => s.type).join(' ➔ ')}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleInstallTemplate(tpl)}
                      className="px-3.5 py-1.5 bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs rounded-xl shadow-xs flex items-center space-x-1.5 active:scale-95 transition-all flex-shrink-0"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Install & Edit</span>
                    </button>
                  </div>
                ))}
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end">
                <button
                  type="button"
                  onClick={() => setIsTemplateModalOpen(false)}
                  className="px-4 py-2 text-slate-400 hover:text-slate-200 font-semibold text-xs"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Batch Run Modal */}
      {batchTargetWorkflow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="p-6">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-xl bg-teal-500/10 text-teal-600 dark:text-teal-400 flex items-center justify-center">
                    <Users className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">
                      Batch Run: {batchTargetWorkflow.name}
                    </h3>
                    <p className="text-xs text-slate-400">
                      Execute this workflow across multiple selected profiles
                    </p>
                  </div>
                </div>
                <button type="button"
                  onClick={() => setBatchTargetWorkflow(null)}
                  className="text-slate-400 hover:text-slate-200 text-sm font-bold p-1.5"
                >
                  ✕
                </button>
              </div>

              <div className="py-4 space-y-4">
                <div>
                  <label htmlFor="field-001" className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-2">
                    Select Profiles ({batchSelectedProfileIds.length} chosen)
                  </label>
                  <div className="max-h-44 overflow-y-auto space-y-1.5 custom-scrollbar border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 bg-slate-50 dark:bg-slate-950">
                    {profiles.map((p) => {
                      const isSelected = batchSelectedProfileIds.includes(p.id);
                      return (
                        <button type="button"
                          key={p.id}

                          onClick={() => {
                            if (isSelected) {
                              setBatchSelectedProfileIds(batchSelectedProfileIds.filter((id) => id !== p.id));
                            } else {
                              setBatchSelectedProfileIds([...batchSelectedProfileIds, p.id]);
                            }
                          }}
                          className={`w-full p-2 rounded-lg text-left text-xs flex items-center justify-between transition-all ${
                            isSelected
                              ? 'bg-teal-500/10 text-teal-600 dark:text-teal-400 font-bold border border-teal-500/30'
                              : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                          }`}
                        >
                          <div className="flex items-center space-x-2">
                            <span>{p.name}</span>
                            <span className="text-[10px] text-slate-400">({p.folder || 'General'})</span>
                          </div>
                          {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-teal-500" />}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label htmlFor="field-002" className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
                    Stagger Delay between Profiles
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { label: '500ms', value: 500 },
                      { label: '1.5s (Safe)', value: 1500 },
                      { label: '3.0s', value: 3000 },
                    ].map((d) => (
                      <button type="button"
                        key={d.value}

                        onClick={() => setBatchDelayMs(d.value)}
                        className={`p-2 rounded-xl text-xs font-bold border transition-all ${
                          batchDelayMs === d.value
                            ? 'border-teal-500 bg-teal-500/10 text-teal-600 dark:text-teal-400 border-2'
                            : 'border-slate-200 dark:border-slate-800 text-slate-500'
                        }`}
                      >
                        {d.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setBatchTargetWorkflow(null)}
                  className="px-4 py-2 text-slate-400 hover:text-slate-200 font-semibold text-xs"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleExecuteBatchRun}
                  disabled={batchSelectedProfileIds.length === 0}
                  className="px-4 py-2 bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-sm active:scale-95 transition-all flex items-center space-x-1.5"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Execute on {batchSelectedProfileIds.length} Profiles</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Screenshot Preview Modal */}
      {selectedScreenshot && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150">
          <button
            type="button"
            aria-label="Close screenshot preview"
            onClick={() => setSelectedScreenshot(null)}
            className="absolute inset-0 w-full h-full cursor-default"
          />
          <div className="relative z-10 max-w-4xl max-h-[85vh] overflow-hidden rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl p-2">
            <img
              src={selectedScreenshot}
              alt="Execution Screenshot"
              className="w-full h-auto rounded-xl object-contain max-h-[80vh]"
            />
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={deleteTarget !== null}
        title="Delete Workflow"
        message={`Are you sure you want to delete "${deleteTarget?.name}"?`}
        confirmLabel="Delete"
        isDestructive
        onConfirm={async () => {
          if (deleteTarget) {
            await deleteWorkflow(deleteTarget.id);
            setDeleteTarget(null);
          }
        }}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
};
