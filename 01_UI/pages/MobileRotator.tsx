import React, { useState, useEffect } from 'react';
import {
  Smartphone,
  RotateCw,
  Globe,
  Radio,
  Sliders,
  CheckCircle,
  AlertTriangle,
  RefreshCw,
  Zap,
  Clock,
  Shield,
  Activity,
} from 'lucide-react';
import { useToastStore } from '../stores/useToastStore.js';

interface AdbDevice {
  id: string;
  model: string;
  status: string;
}

interface IpInfo {
  ip: string;
  country?: string;
  city?: string;
  isp?: string;
}

interface RotationHistoryItem {
  id: string;
  timestamp: string;
  oldIp: string;
  newIp: string;
  isp?: string;
  durationMs: number;
  success: boolean;
}

export const MobileRotator: React.FC = () => {
  const { showToast } = useToastStore();

  const [currentIpInfo, setCurrentIpInfo] = useState<IpInfo | null>(null);
  const [isLoadingIp, setIsLoadingIp] = useState(false);

  // Rotator Config
  const [method, setMethod] = useState<'adb' | 'webhook'>('adb');
  const [selectedDevice, setSelectedDevice] = useState<string>('');
  const [devices, setDevices] = useState<AdbDevice[]>([]);
  const [airplaneDelay, setAirplaneDelay] = useState<number>(2500);
  const [webhookUrl, setWebhookUrl] = useState<string>('');
  const [webhookMethod, setWebhookMethod] = useState<'GET' | 'POST'>('GET');
  const [autoRotateOnStart, setAutoRotateOnStart] = useState(false);

  // Action State
  const [isRotating, setIsRotating] = useState(false);
  const [rotationHistory, setRotationHistory] = useState<RotationHistoryItem[]>([]);

  useEffect(() => {
    loadIpInfo();
    loadDevices();
    loadConfig();
  }, []);

  const loadIpInfo = async () => {
    setIsLoadingIp(true);
    try {
      if (window.mahiAPI) {
        const info = await window.mahiAPI.mobileRotatorCheckIp();
        setCurrentIpInfo(info);
      }
    } catch {
      setCurrentIpInfo({ ip: 'Unavailable' });
    } finally {
      setIsLoadingIp(false);
    }
  };

  const loadDevices = async () => {
    try {
      if (window.mahiAPI) {
        const devList = await window.mahiAPI.mobileRotatorGetDevices();
        setDevices(devList || []);
        if (devList && devList.length > 0 && !selectedDevice) {
          setSelectedDevice(devList[0].id);
        }
      }
    } catch {}
  };

  const loadConfig = async () => {
    try {
      if (window.mahiAPI) {
        const config = await window.mahiAPI.mobileRotatorGetConfig();
        if (config) {
          setMethod(config.method || 'adb');
          setSelectedDevice(config.adbDeviceId || '');
          setAirplaneDelay(config.airplaneDelayMs || 2500);
          setWebhookUrl(config.webhookUrl || '');
          setWebhookMethod(config.webhookMethod || 'GET');
          setAutoRotateOnStart(Boolean(config.autoRotateOnProfileStart));
        }
      }
    } catch {}
  };

  const handleSaveConfig = async () => {
    try {
      if (window.mahiAPI) {
        await window.mahiAPI.mobileRotatorSaveConfig({
          method,
          adbDeviceId: selectedDevice,
          airplaneDelayMs: airplaneDelay,
          webhookUrl,
          webhookMethod,
          autoRotateOnProfileStart: autoRotateOnStart,
        });
        showToast({
          type: 'success',
          title: 'Settings Saved',
          message: 'Mobile IP Rotator configuration updated successfully.',
        });
      }
    } catch (err: any) {
      showToast({
        type: 'error',
        title: 'Save Failed',
        message: err.message || 'Could not save settings',
      });
    }
  };

  const handleRotateNow = async () => {
    if (isRotating) return;
    setIsRotating(true);

    showToast({
      type: 'info',
      title: 'Rotating Mobile IP...',
      message: method === 'adb' ? 'Toggling Airplane Mode via USB...' : 'Triggering 4G Dongle rotation...',
    });

    try {
      if (window.mahiAPI) {
        const res = await window.mahiAPI.mobileRotatorRotate({
          method,
          adbDeviceId: selectedDevice,
          airplaneDelayMs: airplaneDelay,
          webhookUrl,
          webhookMethod,
        });

        setCurrentIpInfo({
          ip: res.newIp,
          isp: res.isp,
          country: res.country,
          city: res.city,
        });

        const historyItem: RotationHistoryItem = {
          id: String(Date.now()),
          timestamp: new Date().toLocaleTimeString(),
          oldIp: res.oldIp,
          newIp: res.newIp,
          isp: res.isp,
          durationMs: res.durationMs,
          success: res.success,
        };

        setRotationHistory((prev) => [historyItem, ...prev.slice(0, 19)]);

        showToast({
          type: 'success',
          title: 'Mobile IP Rotated',
          message: `${res.oldIp} ➔ ${res.newIp} (${res.isp || 'Mobile Network'}) in ${Math.round(res.durationMs / 1000)}s`,
        });
      }
    } catch (err: any) {
      showToast({
        type: 'error',
        title: 'Rotation Error',
        message: err.message || 'Failed to rotate IP. Check USB/Dongle connection.',
      });
    } finally {
      setIsRotating(false);
    }
  };

  return (
    <div className="h-full flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 overflow-y-auto font-sans">
      {/* Header */}
      <div className="px-8 py-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 sticky top-0 z-10 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-teal-500/10 text-teal-600 dark:text-teal-400 flex items-center justify-center">
            <Smartphone className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-base font-bold text-slate-800 dark:text-slate-100">
                Mobile 4G/5G IP Rotator
              </h1>
              <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                Residential Dynamic IP
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Rotate residential mobile IPs via Android USB Tethering & 4G Dongles
            </p>
          </div>
        </div>

        <button
          onClick={handleRotateNow}
          disabled={isRotating}
          className="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white font-bold rounded-xl shadow-sm active:scale-95 transition-all flex items-center space-x-1.5 text-xs"
        >
          <RotateCw className={`w-3.5 h-3.5 ${isRotating ? 'animate-spin' : ''}`} />
          <span>{isRotating ? 'Rotating Mobile IP...' : 'Rotate IP Now'}</span>
        </button>
      </div>

      {/* Main Content Grid */}
      <div className="p-8 max-w-6xl w-full mx-auto space-y-6">
        {/* Live IP Intelligence Card */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase tracking-wider">
              <span>Public IP Address</span>
              <Globe className="w-4 h-4 text-teal-500" />
            </div>
            <div className="my-2">
              <span className="text-lg font-mono font-bold text-teal-600 dark:text-teal-400">
                {isLoadingIp ? 'Checking...' : currentIpInfo?.ip || '127.0.0.1'}
              </span>
            </div>
            <button
              onClick={loadIpInfo}
              className="text-[11px] text-slate-400 hover:text-teal-500 font-semibold flex items-center space-x-1"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Refresh IP</span>
            </button>
          </div>

          <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase tracking-wider">
              <span>ISP / Mobile Carrier</span>
              <Radio className="w-4 h-4 text-emerald-500" />
            </div>
            <div className="my-2">
              <span className="text-xs font-bold text-slate-800 dark:text-slate-100 line-clamp-1">
                {currentIpInfo?.isp || 'Reliance Jio / Mobile Carrier'}
              </span>
            </div>
            <span className="text-[11px] text-emerald-500 font-semibold flex items-center space-x-1">
              <CheckCircle className="w-3 h-3" />
              <span>100% Residential Trust Score</span>
            </span>
          </div>

          <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase tracking-wider">
              <span>Location</span>
              <Activity className="w-4 h-4 text-indigo-500" />
            </div>
            <div className="my-2">
              <span className="text-xs font-bold text-slate-800 dark:text-slate-100">
                {currentIpInfo?.city ? `${currentIpInfo.city}, ` : ''}{currentIpInfo?.country || 'India'}
              </span>
            </div>
            <span className="text-[11px] text-slate-400">Zero Blacklist / Clean IP</span>
          </div>

          <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase tracking-wider">
              <span>Rotation Engine</span>
              <Zap className="w-4 h-4 text-teal-500" />
            </div>
            <div className="my-2">
              <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                {method === 'adb' ? 'USB ADB Mode' : '4G Dongle Webhook'}
              </span>
            </div>
            <span className="text-[11px] text-teal-600 dark:text-teal-400 font-medium">
              ~2.5s Instant IP Switch
            </span>
          </div>
        </div>

        {/* Configuration Box */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-6">
          <div className="flex items-center space-x-2 border-b border-slate-200 dark:border-slate-800 pb-4">
            <Sliders className="w-4 h-4 text-teal-500" />
            <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100">
              Rotator Configuration
            </h2>
          </div>

          {/* Mode Selection */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <button
              type="button"
              onClick={() => setMethod('adb')}
              className={`p-4 rounded-2xl border text-left transition-all flex items-start space-x-3 ${
                method === 'adb'
                  ? 'border-teal-500 bg-teal-500/5 dark:bg-teal-500/10 border-2 font-bold'
                  : 'border-slate-200 dark:border-slate-800 opacity-60 hover:opacity-100'
              }`}
            >
              <Smartphone className="w-5 h-5 text-teal-500 shrink-0 mt-0.5" />
              <div>
                <span className="text-xs font-bold text-slate-800 dark:text-slate-100">
                  Android USB ADB (Tethering)
                </span>
                <p className="text-[11px] text-slate-400 mt-1 font-normal">
                  Connect your phone via USB with USB Debugging enabled. Toggles Airplane mode in 2 seconds.
                </p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setMethod('webhook')}
              className={`p-4 rounded-2xl border text-left transition-all flex items-start space-x-3 ${
                method === 'webhook'
                  ? 'border-teal-500 bg-teal-500/5 dark:bg-teal-500/10 border-2 font-bold'
                  : 'border-slate-200 dark:border-slate-800 opacity-60 hover:opacity-100'
              }`}
            >
              <Radio className="w-5 h-5 text-teal-500 shrink-0 mt-0.5" />
              <div>
                <span className="text-xs font-bold text-slate-800 dark:text-slate-100">
                  4G/5G Dongle / Webhook URL
                </span>
                <p className="text-[11px] text-slate-400 mt-1 font-normal">
                  Trigger rotation URL for Huawei, ZTE dongles, iProxy.online, or local Android companion apps.
                </p>
              </div>
            </button>
          </div>

          {/* Method Specific Settings */}
          {method === 'adb' ? (
            <div className="p-4 bg-slate-50 dark:bg-slate-950/60 rounded-2xl space-y-4 border border-slate-200 dark:border-slate-800 text-xs">
              <div className="flex items-center justify-between">
                <label className="font-bold text-slate-700 dark:text-slate-300">
                  Connected Android Device
                </label>
                <button
                  type="button"
                  onClick={loadDevices}
                  className="text-[11px] text-teal-600 dark:text-teal-400 hover:underline flex items-center space-x-1"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Refresh Devices</span>
                </button>
              </div>

              {devices.length > 0 ? (
                <select
                  value={selectedDevice}
                  onChange={(e) => setSelectedDevice(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-medium"
                >
                  {devices.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.model} ({d.id}) — [{d.status}]
                    </option>
                  ))}
                </select>
              ) : (
                <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-600 dark:text-amber-400 flex items-center space-x-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>
                    No ADB device detected. Connect your phone via USB and enable <strong>USB Debugging</strong> in Developer Options.
                  </span>
                </div>
              )}

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300">
                  Airplane Mode Delay (ms)
                </label>
                <div className="flex items-center space-x-3 mt-1.5">
                  <input
                    type="range"
                    min="1500"
                    max="6000"
                    step="500"
                    value={airplaneDelay}
                    onChange={(e) => setAirplaneDelay(Number(e.target.value))}
                    className="w-48 accent-teal-500"
                  />
                  <span className="font-mono font-bold text-teal-600 dark:text-teal-400">
                    {airplaneDelay} ms ({airplaneDelay / 1000}s)
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-4 bg-slate-50 dark:bg-slate-950/60 rounded-2xl space-y-4 border border-slate-200 dark:border-slate-800 text-xs">
              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300">
                  Rotation Webhook URL
                </label>
                <input
                  type="text"
                  placeholder="e.g. http://192.168.8.1/html/reboot.html or https://api.iproxy.online/..."
                  value={webhookUrl}
                  onChange={(e) => setWebhookUrl(e.target.value)}
                  className="w-full mt-1.5 px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-mono text-xs"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300">
                  HTTP Method
                </label>
                <div className="flex items-center space-x-4 mt-1.5">
                  <label className="flex items-center space-x-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="webhookMethod"
                      checked={webhookMethod === 'GET'}
                      onChange={() => setWebhookMethod('GET')}
                      className="accent-teal-500"
                    />
                    <span>GET</span>
                  </label>
                  <label className="flex items-center space-x-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="webhookMethod"
                      checked={webhookMethod === 'POST'}
                      onChange={() => setWebhookMethod('POST')}
                      className="accent-teal-500"
                    />
                    <span>POST</span>
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* Auto Rotation Toggle */}
          <div className="flex items-center justify-between pt-2">
            <label className="flex items-center space-x-2.5 cursor-pointer text-xs font-semibold text-slate-700 dark:text-slate-300">
              <input
                type="checkbox"
                checked={autoRotateOnStart}
                onChange={(e) => setAutoRotateOnStart(e.target.checked)}
                className="w-4 h-4 rounded text-teal-600 accent-teal-500"
              />
              <span>Auto-rotate mobile IP every time a profile is launched</span>
            </label>

            <button
              type="button"
              onClick={handleSaveConfig}
              className="px-5 py-2 bg-slate-800 hover:bg-slate-700 dark:bg-slate-700 dark:hover:bg-slate-600 text-white font-bold rounded-xl text-xs transition-all shadow-sm"
            >
              Save Configuration
            </button>
          </div>
        </div>

        {/* Rotation History Log */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
            <div className="flex items-center space-x-2">
              <Clock className="w-4 h-4 text-teal-500" />
              <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                Recent Rotation Log
              </h2>
            </div>
            {rotationHistory.length > 0 && (
              <button
                onClick={() => setRotationHistory([])}
                className="text-[11px] text-slate-400 hover:text-rose-500"
              >
                Clear Log
              </button>
            )}
          </div>

          {rotationHistory.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-400">
              No rotations performed in this session yet. Click <strong>"Rotate IP Now"</strong> to test.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="text-slate-400 border-b border-slate-200 dark:border-slate-800">
                    <th className="py-2.5 px-3">Time</th>
                    <th className="py-2.5 px-3">Previous IP</th>
                    <th className="py-2.5 px-3">New Rotated IP</th>
                    <th className="py-2.5 px-3">ISP</th>
                    <th className="py-2.5 px-3">Duration</th>
                    <th className="py-2.5 px-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-mono">
                  {rotationHistory.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="py-2.5 px-3 text-slate-400 font-sans">{item.timestamp}</td>
                      <td className="py-2.5 px-3 text-slate-500">{item.oldIp}</td>
                      <td className="py-2.5 px-3 text-emerald-600 dark:text-emerald-400 font-bold">
                        {item.newIp}
                      </td>
                      <td className="py-2.5 px-3 text-slate-700 dark:text-slate-300 font-sans">
                        {item.isp || 'Mobile Network'}
                      </td>
                      <td className="py-2.5 px-3 text-slate-400 font-sans">
                        {Math.round(item.durationMs / 1000)}s
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-500 font-sans">
                          SUCCESS
                        </span>
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
