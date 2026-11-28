/**
 * MAHI Browser — Shared Automation & RPA Types
 * Phase 8 Production Platform Architecture
 */

export type AutomationStepType =
  // Core Navigation & Input
  | 'OPEN_URL'
  | 'SEARCH'
  | 'CLICK'
  | 'FILL'
  | 'KEYPRESS'
  | 'SCROLL'
  | 'WAIT'
  | 'WAIT_FOR_SELECTOR'
  | 'RANDOM_SLEEP'
  | 'HOVER'
  // Data Extraction & Assertion
  | 'EXTRACT_TITLE'
  | 'EXTRACT_TEXT'
  | 'ASSERT_ELEMENT'
  | 'SCREENSHOT'
  | 'NAVIGATE'
  // Logic & Flow Control (Declarative, No Arbitrary Eval)
  | 'SET_VARIABLE'
  | 'CONDITION_IF'
  | 'LOOP'
  // Humanized & Utility
  | 'SOLVE_CAPTCHA'
  | 'EMAIL'
  | 'VPN'
  | 'CLOSE_BROWSER'
  // Legacy / Disabled (Blocked at runtime for safety)
  | 'EVALUATE_JS'
  | 'CUSTOM_ACTION';

export type VariableType = 'string' | 'number' | 'boolean' | 'url' | 'secret';

export interface WorkflowVariable {
  name: string;
  type: VariableType;
  defaultValue?: string | number | boolean;
  currentValue?: string | number | boolean;
  description?: string;
  isSecret?: boolean;
}

export type ConditionOperator =
  | 'SELECTOR_EXISTS'
  | 'SELECTOR_NOT_EXISTS'
  | 'TEXT_CONTAINS'
  | 'TEXT_NOT_CONTAINS'
  | 'URL_MATCHES'
  | 'VARIABLE_EQUALS'
  | 'VARIABLE_NOT_EQUALS'
  | 'PREVIOUS_STEP_SUCCEEDED';

export interface StepCondition {
  operator: ConditionOperator;
  target?: string; // selector, URL pattern, or variable name
  expectedValue?: string;
  elseAction?: 'SKIP' | 'STOP' | 'GOTO_STEP';
  elseTargetStepOrder?: number;
}

export interface StepLoopConfig {
  loopType: 'COUNT' | 'ITEMS' | 'RETRY_UNTIL';
  maxIterations: number; // Strictly bounded: max 100
  itemsListVariable?: string; // name of variable containing list of items
  retryCondition?: StepCondition;
  iterationDelayMs?: number;
}

export interface AutomationStep {
  id: string;
  order: number;
  type: AutomationStepType;
  label?: string;
  target?: string;
  value?: string;
  timeoutMs?: number;
  continueOnError?: boolean;
  // Phase 8 Reliability Additions
  retryCount?: number;
  retryDelayMs?: number;
  condition?: StepCondition;
  loopConfig?: StepLoopConfig;
  outputVariableName?: string;
  isSecret?: boolean;
  humanize?: boolean;
}

export type WorkflowExecutionStatus =
  | 'QUEUED'
  | 'STARTING'
  | 'RUNNING'
  | 'PAUSED'
  | 'RETRYING'
  | 'SUCCEEDED'
  | 'SUCCESS'
  | 'FAILED'
  | 'CANCELLED'
  | 'TIMED_OUT';

export interface WorkflowExecutionPolicy {
  maxExecutionTimeMs: number;
  defaultStepTimeoutMs: number;
  stopOnError: boolean;
  captureScreenshots: boolean;
  screenshotRetentionDays: number;
  concurrencyLimit: number;
}

export interface AutomationWorkflow {
  id: string;
  name: string;
  description: string;
  version: number;
  workspaceId?: string;
  defaultProfileId?: string;
  steps: AutomationStep[];
  variables: WorkflowVariable[];
  executionPolicy?: WorkflowExecutionPolicy;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowStepLog {
  stepId: string;
  stepType: AutomationStepType;
  status: 'SUCCESS' | 'FAILED' | 'SKIPPED' | 'RETRYING';
  durationMs: number;
  output?: string;
  screenshotBase64?: string;
  error?: string;
  retriesAttempted?: number;
  timestamp?: string;
}

export interface WorkflowExecutionLog {
  id: string;
  workflowId: string;
  workflowVersion?: number;
  profileId: string;
  workspaceId?: string;
  status: WorkflowExecutionStatus;
  stepLogs: WorkflowStepLog[];
  startedAt: string;
  completedAt?: string;
  totalDurationMs?: number;
  failedStepId?: string;
  retryCount?: number;
  summary?: string;
  variablesSnapshot?: Record<string, unknown>;
}

export interface RunWorkflowDTO {
  workflowId: string;
  profileId: string;
  initialVariables?: Record<string, string | number | boolean>;
  workspaceId?: string;
}

export interface RunWorkflowBatchDTO {
  workflowId: string;
  profileIds: string[];
  maxConcurrency?: number; // 1 to 5, default 2
  delayMs?: number;
  workspaceId?: string;
}

export interface AutomationSchedule {
  id: string;
  workflowId: string;
  profileId?: string;
  profileIds?: string[];
  workspaceId?: string;
  scheduleType: 'ONE_TIME' | 'HOURLY' | 'DAILY' | 'WEEKLY' | 'CRON';
  cronExpression?: string;
  timezone: string;
  nextRunAt?: string;
  lastRunAt?: string;
  status: 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'MISSED' | 'WAITING_FOR_DEVICE';
  createdAt: string;
  updatedAt: string;
}

export interface RpaTemplate {
  id: string;
  name: string;
  category: 'Social' | 'Search' | 'E-Commerce' | 'Auditing' | 'General' | 'Preparation';
  description: string;
  icon: string;
  estimatedDuration: string;
  isBuiltin?: boolean;
  workspaceId?: string;
  variables?: WorkflowVariable[];
  steps: Omit<AutomationStep, 'id' | 'order'>[];
}

export interface CookieWarmerProgress {
  profileId: string;
  totalSites: number;
  currentSiteIndex: number;
  currentSiteUrl: string;
  sitesVisited: number;
  sitesFailed: number;
  retriesCount: number;
  percent: number;
  status: 'STARTING' | 'WARMING' | 'PAUSED' | 'COMPLETED' | 'CANCELLED' | 'FAILED';
}

export interface CookieWarmProfileOptions {
  mode?: 'quick' | 'standard' | 'deep' | 'custom';
  customSiteCount?: number;
  customUrls?: string[];
  categories?: string[];
  delayBetweenSitesMs?: number;
  maxSiteRetries?: number;
  onProgress?: (progress: CookieWarmerProgress) => void;
  templateId?: string;
  workspaceId?: string;
}

export interface CookieWarmProfileResult {
  success: boolean;
  profileId: string;
  profileName: string;
  mode: string;
  visitedSitesCount: number;
  visitedUrls: string[];
  farmedCookiesCount: number;
  durationMs: number;
  completedAt: string;
  errorMessage?: string;
  retriesAttempted?: number;
}

export interface CookieWarmBulkProfilesResult {
  successCount: number;
  failureCount: number;
  results: CookieWarmProfileResult[];
}

export interface SynchronizerConfigState {
  syncClicks: boolean;
  syncTyping: boolean;
  syncScroll: boolean;
  syncNavigation: boolean;
  humanDelayMinMs: number;
  humanDelayMaxMs: number;
}

export interface SynchronizerStatusState {
  enabled: boolean;
  masterProfileId?: string | null;
  activeProfiles?: string[];
  config?: Partial<SynchronizerConfigState>;
  mirroredActionCount?: number;
  startedAt?: string | null;
}
