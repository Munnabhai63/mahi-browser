import React, { useState } from 'react';
import {
  Key,
  Webhook,
  Plus,
  Trash2,
  RefreshCw,
  Send,
} from 'lucide-react';
import {
  RemoteApiKeyRecord,
  CreateRemoteApiKeyDTO,
  WebhookEndpointRecord,
  CreateWebhookEndpointDTO,
  WebhookDeliveryRecord,
} from '../../../10_CONFIG/shared/types/remote-api.js';
import { TeamWorkspace } from '../../../10_CONFIG/shared/types/workspace.js';
import { CreateApiKeyModal } from '../components/ApiKeyModal.js';
import { CreateWebhookModal } from '../components/WebhookModal.js';
import { ConfirmModal } from '../components/ConfirmModal.js';

interface DeveloperPageProps {
  apiKeys: RemoteApiKeyRecord[];
  webhooks: WebhookEndpointRecord[];
  deliveries: Record<string, WebhookDeliveryRecord[]>;
  workspaces: TeamWorkspace[];
  isLoading: boolean;
  onRefresh: () => void;
  onCreateApiKey: (dto: CreateRemoteApiKeyDTO) => Promise<{ secretKey: string; note: string }>;
  onRevokeApiKey: (id: string) => Promise<void>;
  onRotateApiKey: (id: string) => Promise<{ newSecretKey: string }>;
  onCreateWebhook: (dto: CreateWebhookEndpointDTO) => Promise<{ secret: string; url: string }>;
  onDeleteWebhook: (id: string) => Promise<void>;
  onTestWebhook: (id: string) => Promise<WebhookDeliveryRecord>;
  onRotateWebhookSecret: (id: string) => Promise<{ newSecret: string }>;
  onLoadDeliveries: (id: string) => Promise<void>;
}

export const DeveloperPage: React.FC<DeveloperPageProps> = ({
  apiKeys,
  webhooks,
  deliveries,
  workspaces,
  isLoading,
  onRefresh,
  onCreateApiKey,
  onRevokeApiKey,
  onRotateApiKey,
  onCreateWebhook,
  onDeleteWebhook,
  onTestWebhook,
  onRotateWebhookSecret,
  onLoadDeliveries,
}) => {
  const [activeTab, setActiveTab] = useState<'KEYS' | 'WEBHOOKS' | 'DOCS'>('KEYS');

  // Modals state
  const [isCreateKeyOpen, setIsCreateKeyOpen] = useState(false);
  const [isCreateWebhookOpen, setIsCreateWebhookOpen] = useState(false);

  // Key operations
  const [revokingKey, setRevokingKey] = useState<RemoteApiKeyRecord | null>(null);
  const [isRevokingKeyPending, setIsRevokingKeyPending] = useState(false);

  // Webhook operations
  const [deletingWebhook, setDeletingWebhook] = useState<WebhookEndpointRecord | null>(null);
  const [isDeletingWebhookPending, setIsDeletingWebhookPending] = useState(false);
  const [testingWebhookId, setTestingWebhookId] = useState<string | null>(null);
  const [selectedWebhookDeliveries, setSelectedWebhookDeliveries] = useState<string | null>(null);

  const handleConfirmRevokeKey = async () => {
    if (!revokingKey) return;
    setIsRevokingKeyPending(true);
    try {
      await onRevokeApiKey(revokingKey.id);
      setRevokingKey(null);
    } finally {
      setIsRevokingKeyPending(false);
    }
  };

  const handleConfirmDeleteWebhook = async () => {
    if (!deletingWebhook) return;
    setIsDeletingWebhookPending(true);
    try {
      await onDeleteWebhook(deletingWebhook.id);
      setDeletingWebhook(null);
    } finally {
      setIsDeletingWebhookPending(false);
    }
  };

  const handleTestWebhook = async (id: string) => {
    setTestingWebhookId(id);
    try {
      await onTestWebhook(id);
      await onLoadDeliveries(id);
      setSelectedWebhookDeliveries(id);
    } finally {
      setTestingWebhookId(null);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">Developer API & Webhooks</h2>
          <p className="text-xs text-slate-400">
            Programmatic access to MAHI Remote Cloud API and HMAC-signed real-time webhooks
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            type="button"
            onClick={onRefresh}
            disabled={isLoading}
            className="p-2.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 rounded-xl transition-colors disabled:opacity-50"
            title="Refresh developer resources"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-teal-400' : ''}`} />
          </button>
          {activeTab === 'KEYS' && (
            <button
              type="button"
              onClick={() => setIsCreateKeyOpen(true)}
              className="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-teal-600/20 flex items-center space-x-2 transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>Create API Key</span>
            </button>
          )}
          {activeTab === 'WEBHOOKS' && (
            <button
              type="button"
              onClick={() => setIsCreateWebhookOpen(true)}
              className="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-teal-600/20 flex items-center space-x-2 transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>Add Webhook</span>
            </button>
          )}
        </div>
      </div>

      {/* Primary Card with Sub Tabs */}
      <div className="bg-[#0c1222] border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
        {/* Navigation Tabs */}
        <div className="p-4 border-b border-slate-800 flex items-center space-x-2">
          <button
            onClick={() => setActiveTab('KEYS')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              activeTab === 'KEYS'
                ? 'bg-teal-500/10 text-teal-400 border border-teal-500/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            API Keys ({apiKeys.length})
          </button>
          <button
            onClick={() => setActiveTab('WEBHOOKS')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              activeTab === 'WEBHOOKS'
                ? 'bg-teal-500/10 text-teal-400 border border-teal-500/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Outbound Webhooks ({webhooks.length})
          </button>
          <button
            onClick={() => setActiveTab('DOCS')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              activeTab === 'DOCS'
                ? 'bg-teal-500/10 text-teal-400 border border-teal-500/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            REST API Reference
          </button>
        </div>

        {/* =========================================================================
            TAB 1: API KEYS
        ========================================================================= */}
        {activeTab === 'KEYS' && (
          <div>
            {apiKeys.length === 0 ? (
              <div className="p-12 text-center space-y-3">
                <Key className="w-10 h-10 text-slate-600 mx-auto" />
                <div className="text-sm font-semibold text-slate-200">No API Keys Generated</div>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  Generate secure scoped API keys (`mahi_live_...`) to automate profile operations through external scripts or CI/CD pipelines.
                </p>
                <button
                  type="button"
                  onClick={() => setIsCreateKeyOpen(true)}
                  className="mt-2 px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold rounded-xl"
                >
                  Generate First API Key
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-slate-950/60 border-b border-slate-800 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                      <th className="py-3 px-4">Key Name & Prefix</th>
                      <th className="py-3 px-4">Scopes</th>
                      <th className="py-3 px-4">Workspace Binding</th>
                      <th className="py-3 px-4">Last Used</th>
                      <th className="py-3 px-4">Created</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {apiKeys.map((key) => (
                      <tr key={key.id} className="hover:bg-slate-900/40">
                        {/* Name & Prefix */}
                        <td className="py-3 px-4">
                          <div className="space-y-0.5">
                            <div className="font-bold text-slate-200">{key.name}</div>
                            <div className="font-mono text-[11px] text-teal-400 flex items-center space-x-1">
                              <span>{key.keyPrefix}••••••••</span>
                            </div>
                          </div>
                        </td>

                        {/* Scopes */}
                        <td className="py-3 px-4 max-w-xs">
                          <div className="flex flex-wrap gap-1">
                            {key.scopes.slice(0, 3).map((scope) => (
                              <span
                                key={scope}
                                className="px-1.5 py-0.5 bg-slate-900 text-slate-300 rounded text-[9px] border border-slate-800 font-mono"
                              >
                                {scope}
                              </span>
                            ))}
                            {key.scopes.length > 3 && (
                              <span className="px-1.5 py-0.5 bg-slate-900 text-slate-500 rounded text-[9px] border border-slate-800">
                                +{key.scopes.length - 3} more
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Workspace Context */}
                        <td className="py-3 px-4 text-slate-400 font-mono text-[11px]">
                          {key.workspaceId ? (
                            <span className="text-cyan-400">{key.workspaceId}</span>
                          ) : (
                            <span className="text-slate-500">Personal Scope</span>
                          )}
                        </td>

                        {/* Last Used */}
                        <td className="py-3 px-4 text-slate-400 text-[11px]">
                          {key.lastUsedAt ? new Date(key.lastUsedAt).toLocaleString() : 'Never'}
                        </td>

                        {/* Created */}
                        <td className="py-3 px-4 text-slate-500 font-mono text-[11px]">
                          {key.createdAt ? new Date(key.createdAt).toLocaleDateString() : 'Active'}
                        </td>

                        {/* Actions */}
                        <td className="py-3 px-4 text-right">
                          <button
                            type="button"
                            onClick={() => setRevokingKey(key)}
                            className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors"
                            title="Revoke API Key"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* =========================================================================
            TAB 2: OUTBOUND WEBHOOKS
        ========================================================================= */}
        {activeTab === 'WEBHOOKS' && (
          <div className="p-4 space-y-6">
            {webhooks.length === 0 ? (
              <div className="p-12 text-center space-y-3">
                <Webhook className="w-10 h-10 text-slate-600 mx-auto" />
                <div className="text-sm font-semibold text-slate-200">No Webhook Endpoints Configured</div>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  Add an HTTPS endpoint to receive asynchronous event webhooks signed with HMAC-SHA256 signatures.
                </p>
                <button
                  type="button"
                  onClick={() => setIsCreateWebhookOpen(true)}
                  className="mt-2 px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold rounded-xl"
                >
                  Add Webhook Endpoint
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-slate-950/60 border-b border-slate-800 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                        <th className="py-3 px-4">Endpoint URL</th>
                        <th className="py-3 px-4">Events</th>
                        <th className="py-3 px-4">Status</th>
                        <th className="py-3 px-4">Secret Reference</th>
                        <th className="py-3 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {webhooks.map((wh) => (
                        <tr key={wh.id} className="hover:bg-slate-900/40">
                          {/* URL */}
                          <td className="py-3 px-4">
                            <div className="font-mono text-slate-200 text-xs truncate max-w-md">
                              {wh.url}
                            </div>
                            {wh.description && (
                              <div className="text-[10px] text-slate-400">{wh.description}</div>
                            )}
                          </td>

                          {/* Events */}
                          <td className="py-3 px-4">
                            <div className="flex flex-wrap gap-1">
                              {wh.events.map((ev) => (
                                <span
                                  key={ev}
                                  className="px-1.5 py-0.5 bg-slate-900 text-teal-300 rounded text-[9px] border border-slate-800 font-mono"
                                >
                                  {ev}
                                </span>
                              ))}
                            </div>
                          </td>

                          {/* Status */}
                          <td className="py-3 px-4">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                wh.status === 'ACTIVE'
                                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                                  : 'bg-slate-800 text-slate-400'
                              }`}
                            >
                              {wh.status}
                            </span>
                          </td>

                          {/* Secret Prefix */}
                          <td className="py-3 px-4 font-mono text-[11px] text-slate-400">
                            whsec_••••••••
                          </td>

                          {/* Actions */}
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end space-x-1.5">
                              {/* Test webhook */}
                              <button
                                type="button"
                                onClick={() => handleTestWebhook(wh.id)}
                                disabled={testingWebhookId === wh.id}
                                className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold flex items-center space-x-1 transition-colors disabled:opacity-50"
                                title="Send test ping"
                              >
                                <Send className={`w-3 h-3 ${testingWebhookId === wh.id ? 'animate-spin' : ''}`} />
                                <span>Test</span>
                              </button>

                              {/* View Deliveries */}
                              <button
                                type="button"
                                onClick={async () => {
                                  await onLoadDeliveries(wh.id);
                                  setSelectedWebhookDeliveries(wh.id);
                                }}
                                className="px-2.5 py-1 bg-teal-500/10 hover:bg-teal-500/20 text-teal-400 rounded-lg text-xs font-semibold"
                              >
                                Logs
                              </button>

                              {/* Delete */}
                              <button
                                type="button"
                                onClick={() => setDeletingWebhook(wh)}
                                className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg"
                                title="Delete Webhook"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Delivery Logs Viewer if selected */}
                {selectedWebhookDeliveries && (
                  <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-slate-200">
                        Delivery History for Endpoint: {selectedWebhookDeliveries}
                      </h4>
                      <button
                        onClick={() => setSelectedWebhookDeliveries(null)}
                        className="text-xs text-slate-400 hover:text-slate-200"
                      >
                        Close Logs
                      </button>
                    </div>

                    {!deliveries[selectedWebhookDeliveries] ||
                    deliveries[selectedWebhookDeliveries].length === 0 ? (
                      <div className="text-xs text-slate-500 py-3 text-center">
                        No delivery events recorded yet. Trigger a test ping above.
                      </div>
                    ) : (
                      <div className="overflow-x-auto max-h-56">
                        <table className="w-full text-left text-xs">
                          <thead>
                            <tr className="text-[10px] text-slate-500 uppercase border-b border-slate-900">
                              <th className="py-1.5 px-2">Event</th>
                              <th className="py-1.5 px-2">Status</th>
                              <th className="py-1.5 px-2">Attempts</th>
                              <th className="py-1.5 px-2">Timestamp</th>
                              <th className="py-1.5 px-2">Request ID</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-900">
                            {deliveries[selectedWebhookDeliveries].map((d) => (
                              <tr key={d.id} className="font-mono text-[11px]">
                                <td className="py-2 px-2 text-slate-300">{d.eventType}</td>
                                <td className="py-2 px-2">
                                  <span
                                    className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                      d.statusCode && d.statusCode >= 200 && d.statusCode < 300
                                        ? 'bg-emerald-500/10 text-emerald-400'
                                        : 'bg-rose-500/10 text-rose-400'
                                    }`}
                                  >
                                    {d.statusCode || 'FAIL'} ({d.success ? 'DELIVERED' : 'FAILED'})
                                  </span>
                                </td>
                                <td className="py-2 px-2 text-slate-400">{d.attemptCount}</td>
                                <td className="py-2 px-2 text-slate-500">
                                  {d.deliveredAt ? new Date(d.deliveredAt).toLocaleTimeString() : '-'}
                                </td>
                                <td className="py-2 px-2 text-slate-500 text-[10px]">{d.eventId || '-'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* =========================================================================
            TAB 3: DOCUMENTATION OVERVIEW
        ========================================================================= */}
        {activeTab === 'DOCS' && (
          <div className="p-6 space-y-4 max-w-3xl">
            <h4 className="text-sm font-bold text-slate-200">Remote Cloud API REST Endpoints</h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              Authenticate all requests by including your secret API key in the <code className="text-teal-400 font-mono">X-API-Key</code> header or as a Bearer token.
            </p>

            <div className="space-y-2 font-mono text-xs">
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between">
                <span><strong className="text-emerald-400">GET</strong> /api/v1/remote/profiles</span>
                <span className="text-[10px] text-slate-500">List profiles with pagination and search</span>
              </div>
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between">
                <span><strong className="text-cyan-400">POST</strong> /api/v1/remote/profiles</span>
                <span className="text-[10px] text-slate-500">Create profile metadata with Idempotency-Key</span>
              </div>
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between">
                <span><strong className="text-amber-400">POST</strong> /api/v1/remote/profiles/:id/launch</span>
                <span className="text-[10px] text-slate-500">Run on connected desktop device</span>
              </div>
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between">
                <span><strong className="text-purple-400">POST</strong> /api/v1/remote/proxies/generate</span>
                <span className="text-[10px] text-slate-500">Allocate residential or mobile proxy</span>
              </div>
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between">
                <span><strong className="text-rose-400">POST</strong> /api/v1/remote/webhooks</span>
                <span className="text-[10px] text-slate-500">Register new outbound webhook subscriber</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      <CreateApiKeyModal
        isOpen={isCreateKeyOpen}
        workspaces={workspaces}
        onClose={() => setIsCreateKeyOpen(false)}
        onSubmit={onCreateApiKey}
      />

      <CreateWebhookModal
        isOpen={isCreateWebhookOpen}
        onClose={() => setIsCreateWebhookOpen(false)}
        onSubmit={onCreateWebhook}
      />

      {revokingKey && (
        <ConfirmModal
          isOpen={true}
          title={`Revoke API Key "${revokingKey.name}"?`}
          message="Any scripts or CI/CD pipelines using this key will immediately receive 401 Unauthorized responses. This action cannot be reversed."
          confirmLabel="Revoke Key"
          confirmVariant="danger"
          isPending={isRevokingKeyPending}
          onConfirm={handleConfirmRevokeKey}
          onCancel={() => setRevokingKey(null)}
        />
      )}

      {deletingWebhook && (
        <ConfirmModal
          isOpen={true}
          title="Delete Webhook Endpoint?"
          message={`Are you sure you want to delete the webhook destination "${deletingWebhook.url}"? Events will no longer be dispatched to this URL.`}
          confirmLabel="Delete Webhook"
          confirmVariant="danger"
          isPending={isDeletingWebhookPending}
          onConfirm={handleConfirmDeleteWebhook}
          onCancel={() => setDeletingWebhook(null)}
        />
      )}
    </div>
  );
};
