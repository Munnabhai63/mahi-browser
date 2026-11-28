import { create } from 'zustand';
import type {
  AutomationWorkflow,
  WorkflowExecutionLog,
  RunWorkflowDTO,
  RunWorkflowBatchDTO,
  RpaTemplate,
} from '../../10_CONFIG/shared/types/automation.js';
import { useToastStore } from './useToastStore.js';

interface AutomationState {
  workflows: AutomationWorkflow[];
  templates: RpaTemplate[];
  loading: boolean;
  selectedWorkflow: AutomationWorkflow | null;
  executionLogs: WorkflowExecutionLog[];
  isRunning: boolean;
  activeExecutionLog: WorkflowExecutionLog | null;
  fetchWorkflows: () => Promise<void>;
  fetchTemplates: () => Promise<void>;
  fetchLogs: (workflowId?: string) => Promise<void>;
  setSelectedWorkflow: (workflow: AutomationWorkflow | null) => void;
  saveWorkflow: (workflow: Partial<AutomationWorkflow>) => Promise<AutomationWorkflow | null>;
  deleteWorkflow: (id: string) => Promise<boolean>;
  runWorkflow: (dto: RunWorkflowDTO) => Promise<WorkflowExecutionLog | null>;
  runWorkflowBatch: (dto: RunWorkflowBatchDTO) => Promise<WorkflowExecutionLog[]>;
}


export const useAutomationStore = create<AutomationState>((set, get) => ({
  workflows: [],
  templates: [],
  loading: false,
  selectedWorkflow: null,
  executionLogs: [],
  isRunning: false,
  activeExecutionLog: null,

  fetchWorkflows: async () => {
    set({ loading: true });
    try {
      if (window.mahiAPI) {
        const workflows = await window.mahiAPI.getWorkflows();
        set({ workflows });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      useToastStore.getState().showToast({
        type: 'error',
        title: 'Failed to load workflows',
        message: msg,
      });
    } finally {
      set({ loading: false });
    }
  },

  fetchTemplates: async () => {
    try {
      if (window.mahiAPI?.getAutomationTemplates) {
        const templates = await window.mahiAPI.getAutomationTemplates();
        set({ templates: Array.isArray(templates) ? templates : [] });
      }
    } catch (err) {
      console.error('Failed to fetch automation templates:', err);
    }
  },


  fetchLogs: async (workflowId) => {
    try {
      if (window.mahiAPI) {
        const executionLogs = await window.mahiAPI.getWorkflowLogs(workflowId);
        set({ executionLogs });
      }
    } catch (err: unknown) {
      console.debug('[useAutomationStore] workflow log fetch failed', err);
    }
  },

  setSelectedWorkflow: (selectedWorkflow) => set({ selectedWorkflow }),

  saveWorkflow: async (wf) => {
    try {
      const saved = await window.mahiAPI.saveWorkflow(wf);
      useToastStore.getState().showToast({
        type: 'success',
        title: 'Workflow Saved',
        message: `Workflow "${saved.name}" saved successfully.`,
      });
      await get().fetchWorkflows();
      return saved;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      useToastStore.getState().showToast({
        type: 'error',
        title: 'Failed to save workflow',
        message: msg,
      });
      return null;
    }
  },

  deleteWorkflow: async (id) => {
    try {
      const ok = await window.mahiAPI.deleteWorkflow(id);
      if (ok) {
        useToastStore.getState().showToast({
          type: 'info',
          title: 'Workflow Deleted',
          message: 'Workflow removed.',
        });
        await get().fetchWorkflows();
      }
      return ok;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      useToastStore.getState().showToast({
        type: 'error',
        title: 'Failed to delete workflow',
        message: msg,
      });
      return false;
    }
  },

  runWorkflow: async (dto) => {
    set({ isRunning: true });
    useToastStore.getState().showToast({
      type: 'info',
      title: 'Workflow Running',
      message: 'Executing automation steps in profile context...',
    });

    try {
      const result = await window.mahiAPI.runWorkflow(dto);
      set({ isRunning: false, activeExecutionLog: result });
      if (result.status === 'SUCCESS') {
        useToastStore.getState().showToast({
          type: 'success',
          title: 'Workflow Completed',
          message: `Finished in ${result.totalDurationMs}ms`,
        });
      } else {
        useToastStore.getState().showToast({
          type: 'error',
          title: 'Workflow Failed',
          message: 'One or more steps failed during execution.',
        });
      }
      await get().fetchLogs();
      return result;
    } catch (err: unknown) {
      set({ isRunning: false });
      const msg = err instanceof Error ? err.message : String(err);
      useToastStore.getState().showToast({
        type: 'error',
        title: 'Automation Execution Error',
        message: msg,
      });
      return null;
    }
  },

  runWorkflowBatch: async (dto) => {
    set({ isRunning: true });
    useToastStore.getState().showToast({
      type: 'info',
      title: 'Batch Workflow Started',
      message: `Running workflow across ${dto.profileIds.length} profiles...`,
    });

    try {
      const results = await window.mahiAPI.runWorkflowBatch(dto);
      set({ isRunning: false });
      const successCount = results.filter((r) => r.status === 'SUCCESS').length;
      useToastStore.getState().showToast({
        type: successCount > 0 ? 'success' : 'error',
        title: 'Batch Workflow Finished',
        message: `${successCount} of ${dto.profileIds.length} profile executions completed successfully.`,
      });
      await get().fetchLogs();
      return results;
    } catch (err: unknown) {
      set({ isRunning: false });
      const msg = err instanceof Error ? err.message : String(err);
      useToastStore.getState().showToast({
        type: 'error',
        title: 'Batch Execution Error',
        message: msg,
      });
      return [];
    }
  },
}));

