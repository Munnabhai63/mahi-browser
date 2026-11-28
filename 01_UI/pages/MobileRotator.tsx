import React, { useEffect, useState, useCallback } from 'react';
import {
  Smartphone,
  RefreshCw,
  Globe,
  Radio,
  Zap,
  CheckCircle2,
  AlertTriangle,
  Wifi,
  Clock,
  Sliders,
  Link,
  RotateCw,
  ShieldCheck,
  Activity,
  Download,
  Trash2,
  XCircle,
} from 'lucide-react';
import { useToastStore } from '../stores/useToastStore.js';

interface PublicIpInfo {
  ip: string;
  country?: string;
  countryCode?: string;
  city?: string;
  isp?: string;
  error?: string;
}

interface AdbDeviceItem {
  id: string;
  model: string;
  product?: string;
  status: 'device' | 'offline' | 'unauthorized';
}

interface AdbEnvironmentStatus {
  installed: boolean;
  adbPath: string | null;
  source: 'env' | 'custom' | 'bundled' | 'managed' | 'sdk' | 'path' | 'missing';
  managedInstallDir: string;
  platform: string;
  downloadUrl: string;
  version?: string;
  error?: string;
}

interface MobileRotationHistoryEntry {
  id: string;
  timestamp: string;
  method: 'adb' | 'webhook';
  oldIp: string;
  newIp: string;
  ipChanged: boolean;
  durationMs: number;
  status: 'SUCCESS' | 'NO_CHANGE' | 'COOLDOWN_SKIPPED' | 'FAILED';
  triggerSource: 'manual' | 'profile-start';
  profileId?: string;
  deviceId?: string;
  strategy?: string;
  message?: string;
}

export const MobileRotator: React.FC = () => {
  const { showToast } = useToastStore();

  const [currentIpInfo, setCurrentIpInfo] = useState<PublicIpInfo | null>(null);
  const [adbDevices, setAdbDevices] = useState<AdbDeviceItem[]>([]);
  const [adbStatus, setAdbStatus] = useState<AdbEnvironmentStatus | null>(null);
  const [isCheckingIp, setIsCheckingIp] = useState(false);
  const [isRefreshingDevices, setIsRefreshingDevices] = useState(false);
  const [isInstallingAdb, setIsInstallingAdb] = useState(false);
  const [isRotating, setIsRotating] = useState(false);
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);

  // Config state
  const [method, setMethod] = useState<'adb' | 'webhook'>('adb');
  const [selectedDevice, setSelectedDevice] = useState<string>('');
  const [airplaneDelay, setAirplaneDelay] = useState<number>(2500);
  const [webhookUrl, setWebhookUrl] = useState<string>('');
  const [webhookMethod, setWebhookMethod] = useState<'GET' | 'POST'>('GET');
  const [autoRotateOnStart, setAutoRotateOnStart] = useState<boolean>(false);
  const [minIntervalSeconds, setMinIntervalSeconds] = useState<number>(30);

  // Persisted history log
  const [rotationHistory, setRotationHistory] = useState<MobileRotationHistoryEntry[]>([]);

  const checkIp = useCallback(async () => {
    setIsCheckingIp(true);
    try {
      const info = await window.mahiAPI.mobileRotatorCheckIp();
      setCurrentIpInfo(info);
    } catch {
      setCurrentIpInfo({ ip: 'Unknown', error: 'Unable to reach public IP lookup providers.' });
    } finally {
      setIsCheckingIp(false);
    }
  }, []);

  const loadHistory = useCallback(async () => {
    try {
      const hist = await window.mahiAPI.mobileRotatorGetHistory();
      setRotationHistory(Array.isArray(hist) ? hist : []);
    } catch (err) {
      console.debug('[MobileRotator] rotation history fetch failed', err);
    }
  }, []);

  const refreshAdbAndDevices = useCallback(async (preferredDeviceId?: string) => {
    setIsRefreshingDevices(true);
    try {
      const [status, devices] = await Promise.all([
        window.mahiAPI.mobileRotatorGetAdbStatus(),
        window.mahiAPI.mobileRotatorGetDevices(),
      ]);
      setAdbStatus(status);
      const list: AdbDeviceItem[] = Array.isArray(devices) ? devices : [];
      setAdbDevices(list);

      const currentTarget = preferredDeviceId ?? selectedDevice;
      if (currentTarget && list.some((d) => d.id === currentTarget)) {
        setSelectedDevice(currentTarget);
      } else {
        const firstReady = list.find((d) => d.status === 'device') || list[0];
        if (firstReady) {
          setSelectedDevice(firstReady.id);
        }
      }
    } catch (err) {
      console.debug('[MobileRotator] ADB status/device refresh failed', err);
    } finally {
      setIsRefreshingDevices(false);
    }
  }, [selectedDevice]);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const cfg = await window.mahiAPI.mobileRotatorGetConfig();
        if (!active) return;
        if (cfg && typeof cfg === 'object') {
          if (cfg.method === 'adb' || cfg.method === 'webhook') setMethod(cfg.method);
          if (cfg.adbDeviceId) setSelectedDevice(cfg.adbDeviceId);
          if (typeof cfg.airplaneDelayMs === 'number') setAirplaneDelay(cfg.airplaneDelayMs);
          if (typeof cfg.webhookUrl === 'string') setWebhookUrl(cfg.webhookUrl);
          if (cfg.webhookMethod === 'GET' || cfg.webhookMethod === 'POST') setWebhookMethod(cfg.webhookMethod);
          if (typeof cfg.autoRotateOnProfileStart === 'boolean') setAutoRotateOnStart(cfg.autoRotateOnProfileStart);
          if (typeof cfg.minIntervalSeconds === 'number') setMinIntervalSeconds(cfg.minIntervalSeconds);
        }
        await Promise.all([
          checkIp(),
          loadHistory(),
          refreshAdbAndDevices(cfg?.adbDeviceId),
        ]);
      } catch {
        if (active) {
          await Promise.all([checkIp(), loadHistory(), refreshAdbAndDevices()]);
        }
      }
    })();
    return () => {
      active = false;
    };
  }, [checkIp, loadHistory, refreshAdbAndDevices]);

  const handleInstallAdb = async () => {
    setIsInstallingAdb(true);
    setLastError(null);
    try {
      const res = await window.mahiAPI.mobileRotatorInstallAdb();
      if (res?.success) {
        showToast({
          type: 'success',
          title: 'Android Platform Tools Installed',
          message: `${res.version || 'ADB'} ready at ${res.adbPath}`,
        });
        await refreshAdbAndDevices();
      } else {
        const msg = res?.error || 'Failed to download official Google ADB package.';
        setLastError(msg);
        showToast({ type: 'error', title: 'ADB Install Failed', message: msg });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'ADB installation error';
      setLastError(msg);
      showToast({ type: 'error', title: 'ADB Install Failed', message: msg });
    } finally {
      setIsInstallingAdb(false);
    }
  };

  const handleSaveConfig = async (overrides?: Partial<{
    method: 'adb' | 'webhook';
    adbDeviceId: string;
    airplaneDelayMs: number;
    webhookUrl: string;
    webhookMethod: 'GET' | 'POST';
    autoRotateOnProfileStart: boolean;
    minIntervalSeconds: number;
  }>) => {
    setIsSavingConfig(true);
    try {
      const payload = {
        method: overrides?.method ?? method,
        adbDeviceId: overrides?.adbDeviceId ?? (selectedDevice || undefined),
        airplaneDelayMs: overrides?.airplaneDelayMs ?? airplaneDelay,
        webhookUrl: overrides?.webhookUrl ?? webhookUrl.trim(),
        webhookMethod: overrides?.webhookMethod ?? webhookMethod,
        autoRotateOnProfileStart: overrides?.autoRotateOnProfileStart ?? autoRotateOnStart,
        minIntervalSeconds: overrides?.minIntervalSeconds ?? minIntervalSeconds,
      };
      const saved = await window.mahiAPI.mobileRotatorSaveConfig(payload);
      if (saved && typeof saved === 'object') {
        if (typeof saved.airplaneDelayMs === 'number') setAirplaneDelay(saved.airplaneDelayMs);
        if (typeof saved.minIntervalSeconds === 'number') setMinIntervalSeconds(saved.minIntervalSeconds);
      }
      showToast({
        type: 'success',
        title: 'Rotator Config Saved',
        message: 'Mobile rotation settings saved and active for profile launches.',
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save mobile rotator config';
      showToast({ type: 'error', title: 'Save Error', message: msg });
    } finally {
      setIsSavingConfig(false);
    }
  };

  const handleRotateNow = async () => {
    setIsRotating(true);
    setLastError(null);
    try {
      const res = await window.mahiAPI.mobileRotatorRotate({
        method,
        adbDeviceId: selectedDevice || undefined,
        airplaneDelayMs: airplaneDelay,
        webhookUrl: webhookUrl.trim(),
        webhookMethod,
      });

      if (res?.success) {
        setCurrentIpInfo({
          ip: res.newIp,
          isp: res.isp || currentIpInfo?.isp,
          country: res.country || currentIpInfo?.country,
          city: res.city || currentIpInfo?.city,
        });

        await loadHistory();

        if (res.ipChanged) {
          showToast({
            type: 'success',
            title: 'Mobile IP Rotated',
            message: `${res.oldIp} -> ${res.newIp} (${Math.round((res.durationMs || 0) / 1000)}s)`,
          });
        } else {
          const sameIpMsg =
            res.errorMessage ||
            `Signal executed, but public IP stayed ${res.newIp}. Make sure Windows uses your phone hotspot/USB network and not Wi-Fi.`;
          setLastError(sameIpMsg);
          showToast({
            type: 'warning',
            title: 'IP Did Not Change',
            message: sameIpMsg,
          });
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Mobile rotation failed';
      setLastError(msg);
      await loadHistory();
      showToast({ type: 'error', title: 'Rotation Failed', message: msg });
    } finally {
      setIsRotating(false);
    }
  };

  const handleClearHistory = async () => {
    await window.mahiAPI.mobileRotatorClearHistory();
    setRotationHistory([]);
    showToast({ type: 'info', title: 'Log Cleared', message: 'Rotation history cleared.' });
  };

  const authorizedDevices = adbDevices.filter((d) => d.status === 'device');
  const unauthorizedDevice = adbDevices.find((d) => d.status === 'unauthorized');
  const offlineDevice = adbDevices.find((d) => d.status === 'offline');

  const isIpUnavailable = !currentIpInfo?.ip || currentIpInfo.ip === 'Unknown';
  const locationText =
    currentIpInfo?.city && currentIpInfo?.country
      ? `${currentIpInfo.city}, ${currentIpInfo.country}`
      : currentIpInfo?.country || currentIpInfo?.city || 'Unavailable';

  return (
    <div className="h-full overflow-y-auto bg-[#f8fafc] text-slate-900 px-8 py-6">
      <div className="max-w-5xl mx-auto space-y-6 pb-12">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl">
              <Smartphone className="w-6 h-6 text-emerald-600" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-slate-900 tracking-tight">Mobile 4G/5G IP Rotator</h1>
                <span className="px-2 py-0.5 text-[10px] font-bold bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-md">
                  Android USB ADB &amp; Dongle Webhook
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Rotate cellular carrier IPs via USB Debugging (Airplane / Mobile Data cycle) or 4G/5G dongle webhook
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleRotateNow}
            disabled={isRotating}
            className="flex items-center justify-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl font-semibold text-sm shadow-sm transition-all cursor-pointer"
          >
            {isRotating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <RotateCw className="w-4 h-4" />}
            {isRotating ? 'Rotating IP...' : 'Rotate IP Now'}
          </button>
        </div>

        {/* Live Error / Diagnostic Alert */}
        {lastError && (
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div className="flex-1 text-xs text-amber-800">
              <span className="font-bold">Rotation Notice: </span>
              {lastError}
            </div>
            <button
              type="button"
              onClick={() => setLastError(null)}
              aria-label="Dismiss warning"
              className="text-amber-700 hover:text-amber-900 text-xs font-semibold cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Live IP Telemetry Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="p-5 bg-white border border-slate-200 rounded-2xl shadow-sm space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
              <span>PUBLIC IP ADDRESS</span>
              <Globe className="w-4 h-4 text-emerald-500" />
            </div>
            <div className="text-xl font-black text-emerald-700 font-mono tracking-tight">
              {isIpUnavailable ? 'Offline / Unknown' : currentIpInfo?.ip}
            </div>
            <button
              type="button"
              onClick={checkIp}
              disabled={isCheckingIp}
              className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 hover:text-emerald-600 transition-colors cursor-pointer"
            >
              <RefreshCw className={`w-3 h-3 ${isCheckingIp ? 'animate-spin' : ''}`} />
              {isCheckingIp ? 'Checking live IP...' : 'Refresh IP'}
            </button>
          </div>

          <div className="p-5 bg-white border border-slate-200 rounded-2xl shadow-sm space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
              <span>ISP / CARRIER (ASN)</span>
              <Radio className="w-4 h-4 text-sky-500" />
            </div>
            <div className="text-sm font-bold text-slate-900 line-clamp-2">
              {currentIpInfo?.isp || (isIpUnavailable ? 'Not reachable' : 'ISP not reported')}
            </div>
            <div className="text-[11px] text-slate-500 flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-slate-400" />
              {isIpUnavailable ? 'Check internet connection' : 'Reported by public IP lookup'}
            </div>
          </div>

          <div className="p-5 bg-white border border-slate-200 rounded-2xl shadow-sm space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
              <span>LOCATION</span>
              <Activity className="w-4 h-4 text-violet-500" />
            </div>
            <div className="text-sm font-bold text-slate-900">{locationText}</div>
            <div className="text-[11px] text-slate-500">
              {currentIpInfo?.countryCode ? `Country Code: ${currentIpInfo.countryCode}` : 'Geo lookup via public IP'}
            </div>
          </div>

          <div className="p-5 bg-white border border-slate-200 rounded-2xl shadow-sm space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
              <span>ROTATION ENGINE</span>
              <Zap className="w-4 h-4 text-amber-500" />
            </div>
            <div className="text-sm font-bold text-slate-900">
              {method === 'adb' ? 'USB ADB Mode' : 'HTTP Webhook Mode'}
            </div>
            <div className="text-[11px] text-slate-500 flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              {method === 'adb'
                ? adbStatus?.installed
                  ? `${authorizedDevices.length} authorized device${authorizedDevices.length === 1 ? '' : 's'}`
                  : 'ADB binary not installed'
                : webhookUrl.trim()
                  ? `Webhook ${webhookMethod} configured`
                  : 'Webhook URL missing'}
            </div>
          </div>
        </div>

        {/* Main Configuration Card */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Sliders className="w-4 h-4 text-slate-500" />
              Rotator Configuration
            </h2>
            {autoRotateOnStart && (
              <span className="px-2.5 py-1 text-[11px] font-semibold bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-lg">
                Auto-rotate on launch ON ({minIntervalSeconds}s cooldown)
              </span>
            )}
          </div>

          {/* Method Selection */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <button
              type="button"
              onClick={() => setMethod('adb')}
              className={`p-4 rounded-xl border-2 text-left transition-all cursor-pointer ${
                method === 'adb'
                  ? 'border-emerald-500 bg-emerald-50/40'
                  : 'border-slate-200 hover:border-slate-300 bg-white'
              }`}
            >
              <div className="flex items-center gap-2 font-bold text-slate-900 text-sm">
                <Smartphone className="w-4 h-4 text-emerald-600" />
                Android USB ADB (Tethering)
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Toggles Airplane Mode / Mobile Data on a USB-connected Android phone to obtain a fresh carrier IP.
              </p>
            </button>

            <button
              type="button"
              onClick={() => setMethod('webhook')}
              className={`p-4 rounded-xl border-2 text-left transition-all cursor-pointer ${
                method === 'webhook'
                  ? 'border-emerald-500 bg-emerald-50/40'
                  : 'border-slate-200 hover:border-slate-300 bg-white'
              }`}
            >
              <div className="flex items-center gap-2 font-bold text-slate-900 text-sm">
                <Wifi className="w-4 h-4 text-sky-600" />
                4G/5G Dongle / Webhook URL
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Calls a local or remote rotation URL (Huawei/ZTE dongle, iProxy.online, MobileProxy, or phone server).
              </p>
            </button>
          </div>

          {/* ADB Settings Panel */}
          {method === 'adb' && (
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <span className="text-xs font-bold text-slate-700">Connected Android Device</span>
                  {adbStatus?.installed && (
                    <p className="text-[11px] text-slate-500 mt-0.5 font-mono truncate max-w-md">
                      ADB ready ({adbStatus.source === 'bundled' ? 'bundled inside MAHI Browser' : adbStatus.source}):{' '}
                      {adbStatus.version || adbStatus.adbPath}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => refreshAdbAndDevices()}
                  disabled={isRefreshingDevices}
                  className="text-xs text-emerald-600 font-semibold hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <RefreshCw className={`w-3 h-3 ${isRefreshingDevices ? 'animate-spin' : ''}`} />
                  Refresh Devices
                </button>
              </div>

              {/* Missing ADB Binary Banner with 1-Click Installer */}
              {adbStatus && !adbStatus.installed ? (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg space-y-3">
                  <div className="flex items-start gap-2.5 text-xs text-amber-900">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold">ADB (Android Platform Tools) is not installed on this PC.</p>
                      <p className="text-amber-800 mt-0.5">
                        MAHI Browser checks PATH, Android SDK, and managed tools folders, but no <code className="font-mono">adb</code> binary was found.
                        Click below to download the official Google Platform Tools package (~12 MB) directly into MAHI&apos;s tools directory.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleInstallAdb}
                    disabled={isInstallingAdb}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-60 text-white rounded-lg text-xs font-semibold transition-all cursor-pointer"
                  >
                    {isInstallingAdb ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Download className="w-3.5 h-3.5" />
                    )}
                    {isInstallingAdb ? 'Downloading Official Google ADB...' : 'Install Official ADB Tools'}
                  </button>
                </div>
              ) : adbDevices.length === 0 ? (
                <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900 space-y-2">
                  <div className="flex items-center gap-2 font-bold">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>No Android phone detected yet — quick 3-step setup:</span>
                  </div>
                  <ol className="list-decimal list-inside space-y-1 text-amber-800 pl-1">
                    <li>
                      On your Android phone, open <strong>Settings → Developer Options → USB Debugging (ON)</strong> and plug in a USB data cable.
                    </li>
                    <li>
                      Set USB mode to <strong>File Transfer (MTP)</strong> and tap <strong>Allow USB debugging</strong> when prompted on your phone screen.
                    </li>
                    <li>
                      Turn on <strong>USB Tethering</strong> (or Hotspot) so Windows routes browser traffic through your SIM card&apos;s cellular IP.
                    </li>
                  </ol>
                </div>
              ) : (
                <div className="space-y-3">
                  {unauthorizedDevice && (
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                      <span>
                        Phone <code className="font-mono">{unauthorizedDevice.id}</code> is <strong>unauthorized</strong>.
                        Unlock your phone screen and tap <strong>Allow USB debugging</strong>, then click Refresh Devices.
                      </span>
                    </div>
                  )}
                  {offlineDevice && (
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                      <span>
                        Device <code className="font-mono">{offlineDevice.id}</code> is <strong>offline</strong>. Reconnect USB cable.
                      </span>
                    </div>
                  )}
                  <select
                    aria-label="Connected Android Device"
                    value={selectedDevice}
                    onChange={(e) => setSelectedDevice(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono text-slate-800 focus:outline-none focus:border-emerald-500"
                  >
                    {adbDevices.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.model} ({d.id}) - [{d.status.toUpperCase()}]
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="space-y-1.5">
                <label htmlFor="airplane-delay-range" className="text-xs font-bold text-slate-700 block">
                  Airplane / Radio Off Delay (ms)
                </label>
                <div className="flex items-center gap-3">
                  <input
                    id="airplane-delay-range"
                    type="range"
                    min="1000"
                    max="10000"
                    step="500"
                    value={airplaneDelay}
                    onChange={(e) => setAirplaneDelay(Number(e.target.value))}
                    className="w-48 accent-emerald-600 cursor-pointer"
                  />
                  <span className="text-xs font-mono font-bold text-slate-700">
                    {airplaneDelay} ms ({(airplaneDelay / 1000).toFixed(1)}s)
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Webhook Settings Panel */}
          {method === 'webhook' && (
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div className="md:col-span-3 space-y-1">
                  <label htmlFor="webhook-url-input" className="text-xs font-bold text-slate-700 block">
                    Rotation Webhook Endpoint URL
                  </label>
                  <div className="relative">
                    <Link className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      id="webhook-url-input"
                      type="text"
                      placeholder="https://iproxy.online/api/rotate?token=..."
                      value={webhookUrl}
                      onChange={(e) => setWebhookUrl(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-lg pl-9 pr-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <label htmlFor="webhook-method-select" className="text-xs font-bold text-slate-700 block">
                    HTTP Method
                  </label>
                  <select
                    id="webhook-method-select"
                    value={webhookMethod}
                    onChange={(e) => setWebhookMethod(e.target.value as 'GET' | 'POST')}
                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm font-semibold text-slate-800 focus:outline-none focus:border-emerald-500"
                  >
                    <option value="GET">GET</option>
                    <option value="POST">POST</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Auto-rotate Toggle, Cooldown & Save */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2 border-t border-slate-100">
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <label className="flex items-center gap-2.5 text-sm font-medium text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoRotateOnStart}
                  onChange={(e) => setAutoRotateOnStart(e.target.checked)}
                  className="w-4 h-4 rounded text-emerald-600 accent-emerald-600"
                />
                Auto-rotate mobile IP before launching a profile
              </label>

              <div className="flex items-center gap-2">
                <label htmlFor="min-cooldown-input" className="text-xs font-semibold text-slate-600">
                  Min Cooldown (s):
                </label>
                <input
                  id="min-cooldown-input"
                  type="number"
                  min={0}
                  max={3600}
                  value={minIntervalSeconds}
                  onChange={(e) => setMinIntervalSeconds(Math.max(0, Number(e.target.value) || 0))}
                  className="w-20 bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-xs font-mono font-semibold text-slate-800 focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <button
              type="button"
              onClick={() => handleSaveConfig()}
              disabled={isSavingConfig}
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-60 text-white rounded-xl text-xs font-semibold transition-all cursor-pointer"
            >
              {isSavingConfig ? 'Saving...' : 'Save Configuration'}
            </button>
          </div>
        </div>

        {/* Persisted Rotation History Log */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Clock className="w-4 h-4 text-slate-500" />
              Recent Rotation Log
            </h2>
            {rotationHistory.length > 0 && (
              <button
                type="button"
                onClick={handleClearHistory}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-rose-600 transition-colors cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Clear Log
              </button>
            )}
          </div>

          {rotationHistory.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-400">
              No rotations recorded yet. Click &quot;Rotate IP Now&quot; to test.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider">
                    <th className="pb-2">Time</th>
                    <th className="pb-2">Trigger</th>
                    <th className="pb-2">Method</th>
                    <th className="pb-2">Old IP -&gt; New IP</th>
                    <th className="pb-2">Duration</th>
                    <th className="pb-2">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rotationHistory.map((log) => (
                    <tr key={log.id} title={log.message || undefined} className="hover:bg-slate-50">
                      <td className="py-2.5 text-slate-600 font-mono whitespace-nowrap">
                        {new Date(log.timestamp).toLocaleTimeString()}
                      </td>
                      <td className="py-2.5 text-slate-600">
                        {log.triggerSource === 'profile-start' ? 'Auto (Profile Start)' : 'Manual'}
                      </td>
                      <td className="py-2.5 uppercase font-semibold text-slate-700">{log.method}</td>
                      <td className="py-2.5 font-mono text-slate-800 whitespace-nowrap">
                        <span className="text-slate-400">{log.oldIp}</span> -&gt;{' '}
                        <span className={log.ipChanged ? 'text-emerald-600 font-bold' : 'text-amber-700 font-semibold'}>
                          {log.newIp}
                        </span>
                      </td>
                      <td className="py-2.5 text-slate-600 font-mono whitespace-nowrap">
                        {(log.durationMs / 1000).toFixed(1)}s
                      </td>
                      <td className="py-2.5 whitespace-nowrap">
                        {log.status === 'SUCCESS' && (
                          <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold">
                            <CheckCircle2 className="w-3.5 h-3.5" /> IP Changed
                          </span>
                        )}
                        {log.status === 'NO_CHANGE' && (
                          <span className="inline-flex items-center gap-1 text-amber-700 font-semibold">
                            <AlertTriangle className="w-3.5 h-3.5" /> Same IP
                          </span>
                        )}
                        {log.status === 'COOLDOWN_SKIPPED' && (
                          <span className="inline-flex items-center gap-1 text-sky-700 font-semibold">
                            <Clock className="w-3.5 h-3.5" /> Cooldown Skipped
                          </span>
                        )}
                        {log.status === 'FAILED' && (
                          <span className="inline-flex items-center gap-1 text-rose-700 font-semibold">
                            <XCircle className="w-3.5 h-3.5" /> Failed
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
