import type React from 'react';
import { useState, useEffect } from 'react';
import {
  Trash2,
  ArrowUp,
  ArrowDown,
  Save,
  ArrowLeft,
  Globe2,
  MousePointer,
  Type,
  Clock,
  Camera,
  FileText,
  Compass,
  XCircle,
  Search as SearchIcon,
  Copy,
  Sliders,
  Code2,
  Keyboard,
  ShieldCheck,
  Layers,
} from 'lucide-react';
import { useAutomationStore } from '../stores/useAutomationStore.js';
import { useProfileStore } from '../stores/useProfileStore.js';
import type { AutomationStep, AutomationStepType, RpaTemplate } from '../../10_CONFIG/shared/types/automation.js';
import type { NavigationPage } from '../components/Sidebar.js';
import { RPA_TEMPLATES } from '../../10_CONFIG/shared/constants/automation-templates.js';

interface WorkflowBuilderProps {
  onNavigate: (page: NavigationPage) => void;
}

const WAIT_PRESETS = [
  { label: '2 Seconds', value: '2000' },
  { label: '5 Seconds', value: '5000' },
  { label: '15 Seconds', value: '15000' },
  { label: '30 Seconds', value: '30000' },
  { label: '1 Minute', value: '60000' },
  { label: 'Custom', value: 'custom' },
];

export const WorkflowBuilderPage: React.FC<WorkflowBuilderProps> = ({ onNavigate }) => {
  const { selectedWorkflow, saveWorkflow } = useAutomationStore();
  const { profiles } = useProfileStore();

  const [name, setName] = useState('New Automation Workflow');
  const [description, setDescription] = useState('');
  const [defaultProfileId, setDefaultProfileId] = useState(profiles[0]?.id || '');
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [steps, setSteps] = useState<AutomationStep[]>([
    {
      id: Math.random().toString(36).substring(2, 9),
      order: 0,
      type: 'OPEN_URL',
      label: 'Open Target Page',
      target: 'https://www.google.com',
      value: '',
      timeoutMs: 15000,
    },
  ]);

  useEffect(() => {
    if (selectedWorkflow) {
      setName(selectedWorkflow.name);
      setDescription(selectedWorkflow.description || '');
      setDefaultProfileId(selectedWorkflow.defaultProfileId || profiles[0]?.id || '');
      setSteps([...selectedWorkflow.steps]);
    }
  }, [selectedWorkflow, profiles]);

  const handleAddStep = (type: AutomationStepType) => {
    let target = '';
    let value = '';

    if (type === 'OPEN_URL') {
      target = 'https://www.google.com';
    } else if (type === 'SEARCH') {
      target = 'Google';
      value = 'latest tech news 2026';
    } else if (type === 'KEYPRESS') {
      value = 'Enter';
    } else if (type === 'SCROLL') {
      value = '600';
    } else if (type === 'WAIT') {
      value = '5000';
    } else if (type === 'RANDOM_SLEEP') {
      value = '1500-3500';
    } else if (type === 'SOLVE_CAPTCHA') {
      target = 'auto';
    } else if (type === 'EVALUATE_JS') {
      value = 'return document.title;';
    } else if (type === 'EMAIL') {
      target = 'user@example.com';
      value = 'Login';
    } else if (type === 'VPN') {
      target = 'ExpressVPN';
      value = 'Connect VPN';
    } else if (type === 'CUSTOM_ACTION') {
      target = 'Custom Step Description';
      value = '';
    }

    const newStep: AutomationStep = {
      id: Math.random().toString(36).substring(2, 9),
      order: steps.length,
      type,
      label: `Execute ${type.replace(/_/g, ' ')}`,
      target,
      value,
      timeoutMs: 15000,
    };

    setSteps([...steps, newStep]);
  };

  const handleDuplicateStep = (index: number) => {
    const original = steps[index];
    const duplicated: AutomationStep = {
      ...JSON.parse(JSON.stringify(original)),
      id: Math.random().toString(36).substring(2, 9),
      label: `${original.label || original.type} (Copy)`,
    };
    const newSteps = [...steps];
    newSteps.splice(index + 1, 0, duplicated);
    newSteps.forEach((s, idx) => { s.order = idx; });
    setSteps(newSteps);
  };

  const handleUpdateStep = (index: number, updates: Partial<AutomationStep>) => {
    const newSteps = [...steps];
    newSteps[index] = { ...newSteps[index], ...updates };
    setSteps(newSteps);
  };

  const handleDeleteStep = (index: number) => {
    const newSteps = steps.filter((_, idx) => idx !== index);
    newSteps.forEach((s, idx) => { s.order = idx; });
    setSteps(newSteps);
  };

  const handleMoveStep = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= steps.length) return;

    const newSteps = [...steps];
    const temp = newSteps[index];
    newSteps[index] = newSteps[targetIndex];
    newSteps[targetIndex] = temp;
    newSteps.forEach((s, idx) => { s.order = idx; });
    setSteps(newSteps);
  };

  const handleLoadTemplate = (template: RpaTemplate) => {
    setName(template.name);
    setDescription(template.description);
    const loadedSteps: AutomationStep[] = template.steps.map((s, idx) => ({
      ...s,
      id: Math.random().toString(36).substring(2, 9),
      order: idx,
    }));
    setSteps(loadedSteps);
    setIsTemplateModalOpen(false);
  };

  const handleSave = async () => {
    if (!name.trim()) return;

    await saveWorkflow({
      id: selectedWorkflow?.id,
      name,
      description,
      defaultProfileId: defaultProfileId || undefined,
      steps,
    });

    onNavigate('automation');
  };

  return (
    <div className="flex-1 flex flex-col h-screen overflow-hidden bg-slate-50 dark:bg-slate-950 font-sans">
      {/* Top Header */}
      <div className="h-16 px-6 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center space-x-3">
          <button type="button"
            onClick={() => onNavigate('automation')}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="w-10 h-10 rounded-xl bg-teal-500/10 text-teal-600 dark:text-teal-400 flex items-center justify-center">
            <Sliders className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-base font-bold text-slate-900 dark:text-white">
                {selectedWorkflow ? 'Edit RPA Workflow' : 'Visual Workflow Studio'}
              </h1>
              <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                Visual Flow Designer
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Build multi-step browser tasks with zero code
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2.5">
          <button
            type="button"
            onClick={() => setIsTemplateModalOpen(true)}
            className="px-3.5 py-1.5 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs rounded-xl shadow-xs flex items-center space-x-1.5 active:scale-95 transition-all"
          >
            <Layers className="w-3.5 h-3.5 text-teal-500" />
            <span>Load Template</span>
          </button>

          <button type="button"
            onClick={handleSave}
            className="px-3.5 py-1.5 bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs rounded-xl shadow-sm shadow-teal-600/20 flex items-center space-x-1.5 active:scale-95 transition-all"
          >
            <Save className="w-4 h-4" />
            <span>Save Workflow</span>
          </button>
        </div>
      </div>

      {/* Main Studio Body */}
      <div className="flex-1 overflow-y-auto p-6 max-w-4xl mx-auto w-full space-y-6 custom-scrollbar">
        {/* Workflow Configuration Card */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="field-001" className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                Workflow Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Google Search & Organic Clicker"
                className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold text-slate-800 dark:text-slate-100 focus:outline-none focus:border-teal-500"
              />
            </div>
            <div>
              <label htmlFor="field-002" className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                Default Target Profile
              </label>
              <select
                value={defaultProfileId}
                onChange={(e) => setDefaultProfileId(e.target.value)}
                className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold text-slate-800 dark:text-slate-100 focus:outline-none focus:border-teal-500"
              >
                <option value="">-- Choose Profile (Optional) --</option>
                {profiles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.folder})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="field-003" className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
              Description / Notes
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What does this automated workflow do?"
              className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:border-teal-500"
            />
          </div>
        </div>

        {/* Visual Step Pipeline */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Execution Sequence ({steps.length} Steps)
            </span>
          </div>

          {/* START Node */}
          <div className="p-3 bg-teal-500/10 border border-teal-500/30 rounded-xl text-center text-xs font-bold text-teal-600 dark:text-teal-400 flex items-center justify-center space-x-2">
            <div className="w-2 h-2 rounded-full bg-teal-500 animate-ping" />
            <span>▶ INITIALIZE ISOLATED BROWSER SESSION</span>
          </div>

          {/* Step Nodes */}
          {steps.map((step, idx) => (
            <div
              key={step.id}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm hover:border-teal-500/40 transition-all space-y-3"
            >
              {/* Step Card Header */}
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800/80 pb-2.5">
                <div className="flex items-center space-x-2.5">
                  <span className="w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center text-xs font-bold">
                    {idx + 1}
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-teal-500/10 text-teal-600 dark:text-teal-400 font-mono text-[11px] font-bold">
                    {step.type}
                  </span>
                  <input
                    type="text"
                    value={step.label || ''}
                    onChange={(e) => handleUpdateStep(idx, { label: e.target.value })}
                    placeholder="Step label..."
                    className="bg-transparent border-b border-transparent hover:border-slate-300 dark:hover:border-slate-700 text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:border-teal-500 px-1 py-0.5"
                  />
                </div>

                <div className="flex items-center space-x-1">
                  <label htmlFor="field-004" className="flex items-center space-x-1 mr-2 text-[10px] text-slate-400 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={Boolean(step.continueOnError)}
                      onChange={(e) => handleUpdateStep(idx, { continueOnError: e.target.checked })}
                      className="rounded border-slate-300 dark:border-slate-700 text-teal-600"
                    />
                    <span>Ignore Failure</span>
                  </label>

                  <button
                    type="button"
                    onClick={() => handleDuplicateStep(idx)}
                    className="p-1.5 text-slate-400 hover:text-teal-400 rounded-lg transition-colors"
                    title="Duplicate Step"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleMoveStep(idx, 'up')}
                    disabled={idx === 0}
                    className="p-1.5 text-slate-400 hover:text-slate-200 disabled:opacity-30 rounded-lg transition-colors"
                  >
                    <ArrowUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleMoveStep(idx, 'down')}
                    disabled={idx === steps.length - 1}
                    className="p-1.5 text-slate-400 hover:text-slate-200 disabled:opacity-30 rounded-lg transition-colors"
                  >
                    <ArrowDown className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteStep(idx)}
                    className="p-1.5 text-slate-400 hover:text-rose-500 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Step Field Inputs */}
              <div className="space-y-3 pt-1">
                {/* 1. OPEN_URL */}
                {step.type === 'OPEN_URL' && (
                  <div>
                    <label htmlFor="field-005" className="block text-[11px] font-semibold text-slate-400 mb-1">
                      Target Web URL
                    </label>
                    <input
                      type="text"
                      value={step.target || ''}
                      onChange={(e) => handleUpdateStep(idx, { target: e.target.value })}
                      placeholder="https://example.com"
                      className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg font-mono text-xs text-slate-800 dark:text-slate-100"
                    />
                  </div>
                )}

                {/* 2. SEARCH */}
                {step.type === 'SEARCH' && (
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label htmlFor="field-006" className="block text-[11px] font-semibold text-slate-400 mb-1">
                        Search Engine
                      </label>
                      <select
                        value={step.target || 'Google'}
                        onChange={(e) => handleUpdateStep(idx, { target: e.target.value })}
                        className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs"
                      >
                        <option value="Google">Google</option>
                        <option value="Bing">Bing</option>
                        <option value="DuckDuckGo">DuckDuckGo</option>
                        <option value="Yahoo">Yahoo</option>
                      </select>
                    </div>
                    <div className="col-span-2">
                      <label htmlFor="field-007" className="block text-[11px] font-semibold text-slate-400 mb-1">
                        Keyword / Query
                      </label>
                      <input
                        type="text"
                        value={step.value || ''}
                        onChange={(e) => handleUpdateStep(idx, { value: e.target.value })}
                        placeholder="Search phrase..."
                        className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs"
                      />
                    </div>
                  </div>
                )}

                {/* 3. CLICK & FILL */}
                {(step.type === 'CLICK' || step.type === 'FILL') && (
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <label htmlFor="field-008" className="block text-[11px] font-semibold text-slate-400 mb-1">
                        CSS / XPath Selector
                      </label>
                      <input
                        type="text"
                        value={step.target || ''}
                        onChange={(e) => handleUpdateStep(idx, { target: e.target.value })}
                        placeholder='e.g. #submit-btn or input[name="q"]'
                        className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg font-mono text-xs"
                      />
                    </div>
                    {step.type === 'FILL' && (
                      <div>
                        <label htmlFor="field-009" className="block text-[11px] font-semibold text-slate-400 mb-1">
                          Text to Fill
                        </label>
                        <input
                          type="text"
                          value={step.value || ''}
                          onChange={(e) => handleUpdateStep(idx, { value: e.target.value })}
                          placeholder="Text to type..."
                          className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs"
                        />
                      </div>
                    )}
                  </div>
                )}

                {/* 4. KEYPRESS */}
                {step.type === 'KEYPRESS' && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label htmlFor="field-010" className="block text-[11px] font-semibold text-slate-400 mb-1">
                        Key to Press
                      </label>
                      <select
                        value={step.value || 'Enter'}
                        onChange={(e) => handleUpdateStep(idx, { value: e.target.value })}
                        className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-semibold"
                      >
                        <option value="Enter">Enter ↵</option>
                        <option value="Tab">Tab ⇥</option>
                        <option value="Escape">Escape (Esc)</option>
                        <option value="ArrowDown">Arrow Down ↓</option>
                        <option value="ArrowUp">Arrow Up ↑</option>
                        <option value="Space">Spacebar</option>
                        <option value="Backspace">Backspace</option>
                      </select>
                    </div>
                    <div>
                      <label htmlFor="field-011" className="block text-[11px] font-semibold text-slate-400 mb-1">
                        Optional Target Selector
                      </label>
                      <input
                        type="text"
                        value={step.target || ''}
                        onChange={(e) => handleUpdateStep(idx, { target: e.target.value })}
                        placeholder="Leave empty for active focus"
                        className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg font-mono text-xs"
                      />
                    </div>
                  </div>
                )}

                {/* 5. SCROLL */}
                {step.type === 'SCROLL' && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label htmlFor="field-012" className="block text-[11px] font-semibold text-slate-400 mb-1">
                        Scroll Target / Distance
                      </label>
                      <input
                        type="text"
                        value={step.value || '500'}
                        onChange={(e) => handleUpdateStep(idx, { value: e.target.value })}
                        placeholder="e.g. 600, bottom, top"
                        className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg font-mono text-xs"
                      />
                    </div>
                    <div className="flex items-end space-x-2">
                      {['500', '1000', 'bottom', 'top'].map((preset) => (
                        <button type="button"
                          key={preset}
                          onClick={() => handleUpdateStep(idx, { value: preset })}
                          className="px-2.5 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-teal-500/10 rounded-lg text-[11px] font-semibold text-slate-600 dark:text-slate-300"
                        >
                          {preset}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* 6. RANDOM_SLEEP */}
                {step.type === 'RANDOM_SLEEP' && (
                  <div>
                    <label htmlFor="field-013" className="block text-[11px] font-semibold text-slate-400 mb-1">
                      Human Random Sleep Range (Min-Max Milliseconds)
                    </label>
                    <input
                      type="text"
                      value={step.value || '1500-3500'}
                      onChange={(e) => handleUpdateStep(idx, { value: e.target.value })}
                      placeholder="e.g. 1500-3500 or 2000-5000"
                      className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg font-mono text-xs"
                    />
                  </div>
                )}

                {/* 7. EVALUATE_JS */}
                {step.type === 'EVALUATE_JS' && (
                  <div>
                    <label htmlFor="field-014" className="block text-[11px] font-semibold text-slate-400 mb-1">
                      JavaScript Code to Evaluate
                    </label>
                    <textarea
                      rows={2}
                      value={step.value || ''}
                      onChange={(e) => handleUpdateStep(idx, { value: e.target.value })}
                      placeholder="return document.querySelector('h1').innerText;"
                      className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg font-mono text-xs"
                    />
                  </div>
                )}

                {/* 8. WAIT */}
                {step.type === 'WAIT' && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label htmlFor="field-015" className="block text-[11px] font-semibold text-slate-400 mb-1">
                        Wait Duration (ms)
                      </label>
                      <input
                        type="text"
                        value={step.value || '5000'}
                        onChange={(e) => handleUpdateStep(idx, { value: e.target.value })}
                        placeholder="e.g. 5000 (5s)"
                        className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg font-mono text-xs"
                      />
                    </div>
                    <div className="flex items-end space-x-1.5">
                      {WAIT_PRESETS.slice(0, 4).map((wp) => (
                        <button type="button"
                          key={wp.value}
                          onClick={() => handleUpdateStep(idx, { value: wp.value })}
                          className="px-2 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-teal-500/10 rounded-lg text-[10px] font-bold"
                        >
                          {wp.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}

          {/* END Node */}
          <div className="p-3 bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-center text-xs font-bold text-slate-500">
            ⏹ END OF WORKFLOW EXECUTION
          </div>
        </div>

        {/* Add Step Tool Palette */}
        <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-3">
          <div className="text-xs font-bold text-slate-700 dark:text-slate-300">
            + Add Action Step
          </div>
          <div className="flex flex-wrap gap-2">
            {[
              { type: 'OPEN_URL' as AutomationStepType, label: 'Open URL', icon: Globe2 },
              { type: 'SEARCH' as AutomationStepType, label: 'Search Engine', icon: SearchIcon },
              { type: 'CLICK' as AutomationStepType, label: 'Click Selector', icon: MousePointer },
              { type: 'FILL' as AutomationStepType, label: 'Fill Input', icon: Type },
              { type: 'KEYPRESS' as AutomationStepType, label: 'Key Press', icon: Keyboard },
              { type: 'SCROLL' as AutomationStepType, label: 'Scroll Page', icon: ArrowDown },
              { type: 'RANDOM_SLEEP' as AutomationStepType, label: 'Human Sleep', icon: Clock },
              { type: 'WAIT' as AutomationStepType, label: 'Fixed Wait', icon: Clock },
              { type: 'SOLVE_CAPTCHA' as AutomationStepType, label: 'Solve Captcha', icon: ShieldCheck },
              { type: 'EVALUATE_JS' as AutomationStepType, label: 'Execute JS', icon: Code2 },
              { type: 'SCREENSHOT' as AutomationStepType, label: 'Screenshot', icon: Camera },
              { type: 'EXTRACT_TITLE' as AutomationStepType, label: 'Extract Title', icon: FileText },
              { type: 'NAVIGATE' as AutomationStepType, label: 'Back / Reload', icon: Compass },
              { type: 'CLOSE_BROWSER' as AutomationStepType, label: 'Close Session', icon: XCircle },
            ].map((tool) => {
              const Icon = tool.icon;
              return (
                <button type="button"
                  key={tool.type}
                  onClick={() => handleAddStep(tool.type)}
                  className="px-3 py-1.5 bg-slate-50 dark:bg-slate-950 hover:bg-teal-500/10 border border-slate-200 dark:border-slate-800 hover:border-teal-500/30 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center space-x-1.5 transition-colors shadow-xs active:scale-95"
                >
                  <Icon className="w-3.5 h-3.5 text-teal-500" />
                  <span>{tool.label}</span>
                </button>
              );
            })}
          </div>
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
                      1-Click load ready-to-run automation pipelines
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
                      onClick={() => handleLoadTemplate(tpl)}
                      className="px-3.5 py-1.5 bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs rounded-xl shadow-xs flex items-center space-x-1.5 active:scale-95 transition-all flex-shrink-0"
                    >
                      <span>Load Template</span>
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
    </div>
  );
};
