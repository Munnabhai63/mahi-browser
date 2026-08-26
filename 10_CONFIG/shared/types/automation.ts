export type AutomationStepType =
  | 'OPEN_URL'
  | 'SEARCH'
  | 'CLICK'
  | 'FILL'
  | 'KEYPRESS'
  | 'SCROLL'
  | 'WAIT'
  | 'RANDOM_SLEEP'
  | 'SOLVE_CAPTCHA'
  | 'EVALUATE_JS'
  | 'SCREENSHOT'
  | 'EXTRACT_TITLE'
  | 'EXTRACT_TEXT'
  | 'NAVIGATE'
  | 'EMAIL'
  | 'VPN'
  | 'CUSTOM_ACTION'
  | 'CLOSE_BROWSER';

export interface AutomationStep {
  id: string;
  order: number;
  type: AutomationStepType;
  label?: string;
  target?: string; // CSS selector, XPath, URL, Search Engine, Key Name, Scroll Direction, Email, VPN Name, or Custom Instruction
  value?: string; // Text to fill, duration, search query, JS code, key name, scroll pixels/target, or custom script
  timeoutMs?: number;
  continueOnError?: boolean;
}

export interface AutomationWorkflow {
  id: string;
  name: string;
  description: string;
  steps: AutomationStep[];
  defaultProfileId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowExecutionLog {
  id: string;
  workflowId: string;
  profileId: string;
  status: 'SUCCESS' | 'FAILED' | 'RUNNING';
  stepLogs: {
    stepId: string;
    stepType: AutomationStepType;
    status: 'SUCCESS' | 'FAILED' | 'SKIPPED';
    durationMs: number;
    output?: string;
    screenshotBase64?: string;
    error?: string;
  }[];
  startedAt: string;
  completedAt?: string;
  totalDurationMs?: number;
}

export interface RunWorkflowDTO {
  workflowId: string;
  profileId: string;
}

export interface RunWorkflowBatchDTO {
  workflowId: string;
  profileIds: string[];
  delayMs?: number;
}

export interface RpaTemplate {
  id: string;
  name: string;
  category: 'Social' | 'Search' | 'E-Commerce' | 'Auditing' | 'General';
  description: string;
  icon: string;
  estimatedDuration: string;
  steps: Omit<AutomationStep, 'id' | 'order'>[];
}

