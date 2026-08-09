import React, { useState, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useSettingsStore } from '../stores/settingsStore';
import { useReportStore } from '../stores/reportStore';
import { useGuidedTour } from '../components/GuidedTour';
import type { ResearchTier, TLPLevel, ApiKeys } from '../types';

/* ── Constants ──────────────────────────────────────────────────────────── */

const TIERS: { value: ResearchTier; label: string; color: string }[] = [
  { value: 'FREE', label: 'Free', color: 'border-green-500/40 bg-green-500/10 text-green-400' },
  { value: 'STANDARD', label: 'Standard', color: 'border-blue-500/40 bg-blue-500/10 text-blue-400' },
  { value: 'DEEP', label: 'Deep Research', color: 'border-purple-500/40 bg-purple-500/10 text-purple-400' },
];

const TLP_OPTIONS: { value: TLPLevel; label: string; color: string; bgColor: string }[] = [
  { value: 'TLP:CLEAR', label: 'TLP:CLEAR', color: 'text-white', bgColor: 'bg-white/10 border-white/20' },
  { value: 'TLP:GREEN', label: 'TLP:GREEN', color: 'text-green-400', bgColor: 'bg-green-500/10 border-green-500/20' },
  { value: 'TLP:AMBER', label: 'TLP:AMBER', color: 'text-amber-400', bgColor: 'bg-amber-500/10 border-amber-500/20' },
  { value: 'TLP:AMBER+STRICT', label: 'TLP:AMBER+STRICT', color: 'text-orange-400', bgColor: 'bg-orange-500/10 border-orange-500/20' },
  { value: 'TLP:RED', label: 'TLP:RED', color: 'text-red-400', bgColor: 'bg-red-500/10 border-red-500/20' },
];

interface ApiKeyConfig {
  key: keyof ApiKeys;
  label: string;
  icon: string;
  placeholder: string;
  pattern: RegExp;
  patternHint: string;
  unlocks: string;
  color: string;
}

const API_KEY_CONFIGS: ApiKeyConfig[] = [
  {
    key: 'perplexity',
    label: 'Perplexity (optional)',
    icon: '🔍',
    placeholder: 'pplx-...',
    pattern: /^pplx-[a-zA-Z0-9_-]{8,}$/,
    patternHint: 'Should start with "pplx-" followed by 8+ characters',
    unlocks: 'Use your own key instead of the shared instance',
    color: 'border-blue-500/30',
  },
];

const REPORT_SECTIONS = [
  { id: 'bluf', label: 'BLUF (Bottom Line Up Front)', required: true },
  { id: 'threat-actor-profile', label: 'Threat Actor Profile' },
  { id: 'campaign-overview', label: 'Campaign Overview' },
  { id: 'ttps', label: 'Tactics, Techniques & Procedures' },
  { id: 'iocs', label: 'Indicators of Compromise' },
  { id: 'victimology', label: 'Victimology' },
  { id: 'timeline', label: 'Timeline' },
  { id: 'attribution', label: 'Attribution Analysis' },
  { id: 'remediation', label: 'Remediation Guidance' },
  { id: 'sources', label: 'Sources & Bibliography' },
];

export const SettingsPage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const {
    defaultTier, defaultTlp, apiKeys, enabledSections,
    setDefaultTier, setDefaultTlp, setApiKey, removeApiKey,
    setEnabledSections, reset: resetSettings,
  } = useSettingsStore();

  const { clearHistory } = useReportStore();
  const { startTour } = useGuidedTour();

  const [keyInputs, setKeyInputs] = useState<Record<string, string>>({});
  const [keyValidation, setKeyValidation] = useState<Record<string, 'valid' | 'invalid' | null>>({});
  const [clearConfirm, setClearConfirm] = useState(false);

  const basePath = '';

  const handleTestKey = useCallback((config: ApiKeyConfig) => {
    const value = keyInputs[config.key]?.trim();
    if (!value) {
      setKeyValidation((prev) => ({ ...prev, [config.key]: 'invalid' }));
      return;
    }
    const isValid = config.pattern.test(value);
    setKeyValidation((prev) => ({ ...prev, [config.key]: isValid ? 'valid' : 'invalid' }));
  }, [keyInputs]);

  const handleSaveKey = useCallback((config: ApiKeyConfig) => {
    const value = keyInputs[config.key]?.trim();
    if (value) {
      setApiKey(config.key, value);
      setKeyInputs((prev) => ({ ...prev, [config.key]: '' }));
      setKeyValidation((prev) => ({ ...prev, [config.key]: null }));
    }
  }, [keyInputs, setApiKey]);

  const toggleSection = useCallback((sectionId: string) => {
    if (enabledSections.includes(sectionId)) {
      setEnabledSections(enabledSections.filter((s) => s !== sectionId));
    } else {
      setEnabledSections([...enabledSections, sectionId]);
    }
  }, [enabledSections, setEnabledSections]);

  const handleClearAll = useCallback(() => {
    resetSettings();
    clearHistory();
    setClearConfirm(false);
  }, [resetSettings, clearHistory]);

  const handleTakeTour = useCallback(() => {
    // Navigate to home first so the tour elements are visible
    localStorage.removeItem('cyberbrief-tour-complete');
    navigate(`${basePath}/home`);
    // Small delay to let the page render
    setTimeout(() => {
      startTour();
    }, 500);
  }, [basePath, navigate, startTour]);

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-100 mb-8">⚙️ Settings</h1>

      {/* ── Guided Tour ─────────────────────────────────────────────── */}
      <div className="glass-panel p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-200 mb-2">🎓 Guided Tour</h2>
        <p className="text-xs text-gray-500 mb-4">
          New to CyberBRIEF? Take the interactive tour to learn how to use the platform.
        </p>
        <button
          onClick={handleTakeTour}
          className="px-4 py-2 text-sm rounded-lg bg-cyber-500/20 text-cyber-400 border border-cyber-500/30 hover:bg-cyber-500/30 font-medium transition-colors"
        >
          🚀 Take Tour
        </button>
      </div>

      {/* ── API Keys (BYOK) ─────────────────────────────────────────── */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold text-gray-200 mb-2">🔑 API Keys (BYOK)</h2>
        <p className="text-xs text-gray-500 mb-4">
          Bring your own API keys to unlock higher research tiers. Keys are stored in your browser&apos;s localStorage and included in requests to the CyberBRIEF backend when used; the backend receives them and forwards them to your selected API providers. CyberBRIEF is not intended to persist keys server-side, but a hosted operator may access them in transit through normal logging, monitoring, or security boundaries. If you do not trust the operator, self-host CyberBRIEF or avoid entering keys here.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {API_KEY_CONFIGS.map((config) => {
            const existing = apiKeys[config.key];
            const validation = keyValidation[config.key];

            return (
              <div key={config.key} className={`glass-panel p-5 border-l-4 ${config.color}`}>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xl">{config.icon}</span>
                  <h3 className="font-semibold text-gray-200">{config.label}</h3>
                </div>
                <p className="text-[10px] text-gray-500 mb-3">
                  Unlocks: <span className="text-gray-400">{config.unlocks}</span>
                </p>

                {existing ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-gray-800/50 px-3 py-2 rounded text-xs font-mono text-gray-400 truncate">
                        {existing.substring(0, 8)}{'•'.repeat(16)}
                      </div>
                      <span className="text-green-400 text-xs font-medium">✓ Saved</span>
                    </div>
                    <button
                      onClick={() => removeApiKey(config.key)}
                      className="px-3 py-1.5 text-xs text-red-400 bg-red-500/10 rounded hover:bg-red-500/20 transition-colors w-full"
                    >Remove Key</button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <input
                      type="password"
                      value={keyInputs[config.key] ?? ''}
                      onChange={(e) => {
                        setKeyInputs((prev) => ({ ...prev, [config.key]: e.target.value }));
                        setKeyValidation((prev) => ({ ...prev, [config.key]: null }));
                      }}
                      placeholder={config.placeholder}
                      className={`w-full bg-gray-800/50 border rounded px-3 py-2 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-cyber-500/50 ${
                        validation === 'invalid' ? 'border-red-500/50' : validation === 'valid' ? 'border-green-500/50' : 'border-gray-700'
                      }`}
                    />
                    {validation === 'invalid' && (
                      <p className="text-[10px] text-red-400">{config.patternHint}</p>
                    )}
                    {validation === 'valid' && (
                      <p className="text-[10px] text-green-400">✓ Format looks valid</p>
                    )}
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleTestKey(config)}
                        disabled={!keyInputs[config.key]?.trim()}
                        className="flex-1 px-3 py-1.5 text-xs bg-gray-800 text-gray-400 rounded hover:bg-gray-700 disabled:opacity-40 transition-colors"
                      >Test Format</button>
                      <button
                        onClick={() => handleSaveKey(config)}
                        disabled={!keyInputs[config.key]?.trim()}
                        className="flex-1 px-3 py-1.5 text-xs bg-cyber-500/20 text-cyber-400 rounded hover:bg-cyber-500/30 disabled:opacity-40 transition-colors"
                      >Save</button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Default Tier ────────────────────────────────────────────── */}
      <div className="glass-panel p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-200 mb-4">Default Research Tier</h2>
        <div className="flex gap-3">
          {TIERS.filter((t) => t.value !== 'DEEP' || (apiKeys.perplexity && apiKeys.perplexity.length > 0)).map((t) => (
            <button
              key={t.value}
              onClick={() => setDefaultTier(t.value)}
              className={`px-4 py-2 rounded-lg text-sm font-medium border-2 transition-all ${
                defaultTier === t.value
                  ? t.color
                  : 'border-gray-800 bg-gray-900/30 text-gray-500 hover:border-gray-700'
              }`}
            >{t.label}</button>
          ))}
        </div>
        <p className="text-xs text-gray-500 mt-2">Deep Research is available when you provide your own Perplexity API key above.</p>
      </div>

      {/* ── Default TLP ─────────────────────────────────────────────── */}
      <div className="glass-panel p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-200 mb-4">Default TLP Level</h2>
        <div className="flex flex-wrap gap-2">
          {TLP_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setDefaultTlp(opt.value)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ${
                defaultTlp === opt.value
                  ? `${opt.color} ${opt.bgColor} border-2`
                  : 'bg-gray-800 text-gray-500 border-gray-700 hover:border-gray-600'
              }`}
            >{opt.label}</button>
          ))}
        </div>
      </div>

      {/* ── Report Sections ─────────────────────────────────────────── */}
      <div className="glass-panel p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-200 mb-2">Report Template</h2>
        <p className="text-xs text-gray-500 mb-4">Choose which sections to include in generated reports.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {REPORT_SECTIONS.map((section) => (
            <label
              key={section.id}
              className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                enabledSections.includes(section.id)
                  ? 'border-cyber-500/30 bg-cyber-500/5'
                  : 'border-gray-800 bg-gray-900/30 hover:border-gray-700'
              } ${section.required ? 'opacity-75' : ''}`}
            >
              <input
                type="checkbox"
                checked={enabledSections.includes(section.id)}
                onChange={() => !section.required && toggleSection(section.id)}
                disabled={section.required}
                className="rounded border-gray-600 bg-gray-800 text-cyber-500 focus:ring-cyber-500/50"
              />
              <span className="text-sm text-gray-300">{section.label}</span>
              {section.required && <span className="text-[9px] text-gray-600 ml-auto">Required</span>}
            </label>
          ))}
        </div>
      </div>

      {/* ── Clear All Data ──────────────────────────────────────────── */}
      <div className="glass-panel p-6">
        <h2 className="text-lg font-semibold text-gray-200 mb-2">🗑️ Clear All Data</h2>
        <p className="text-xs text-gray-500 mb-4">
          Permanently delete all reports, settings, and API keys from local storage. This cannot be undone.
        </p>
        {clearConfirm ? (
          <div className="flex items-center gap-3">
            <span className="text-sm text-red-400">Are you sure? This deletes everything.</span>
            <button
              onClick={handleClearAll}
              className="px-4 py-2 text-sm rounded-lg bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 font-medium transition-colors"
            >Yes, Clear Everything</button>
            <button
              onClick={() => setClearConfirm(false)}
              className="px-4 py-2 text-sm rounded-lg bg-gray-800 text-gray-400 hover:text-gray-200 transition-colors"
            >Cancel</button>
          </div>
        ) : (
          <button
            onClick={() => setClearConfirm(true)}
            className="px-4 py-2 text-sm rounded-lg bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-colors"
          >Clear All Data</button>
        )}
      </div>
    </div>
  );
};
