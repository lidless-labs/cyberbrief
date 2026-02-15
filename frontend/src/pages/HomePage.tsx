import React, { useState, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useSettingsStore } from '../stores/settingsStore';
import { useResearchStore } from '../stores/researchStore';
import { useReportStore } from '../stores/reportStore';
import { apiClient } from '../api/client';
import { GuidedTour } from '../components/GuidedTour';
import type { ResearchTier } from '../types';

/* ── Suggested Topics ───────────────────────────────────────────────────── */

interface SuggestedTopic {
  label: string;
  category: 'APT Groups' | 'Supply Chain' | 'Ransomware' | 'Vulnerabilities';
  icon: string;
}

const SUGGESTED_TOPICS: SuggestedTopic[] = [
  { label: 'Volt Typhoon', category: 'APT Groups', icon: '🕵️' },
  { label: 'Salt Typhoon Telecom Attacks', category: 'APT Groups', icon: '🕵️' },
  { label: 'Lazarus Group Crypto Heists', category: 'APT Groups', icon: '🕵️' },
  { label: 'Midnight Blizzard (APT29)', category: 'APT Groups', icon: '🕵️' },
  { label: '0APT Ransomware Group 2026', category: 'Ransomware', icon: '💀' },
  { label: 'LockBit 4.0 Resurgence', category: 'Ransomware', icon: '💀' },
  { label: 'Ransomware Healthcare 2026', category: 'Ransomware', icon: '💀' },
  { label: 'Medusa Ransomware', category: 'Ransomware', icon: '💀' },
  { label: 'Microsoft Feb 2026 Zero-Days', category: 'Vulnerabilities', icon: '🐛' },
  { label: 'CVE-2026-21527 Exchange RCE', category: 'Vulnerabilities', icon: '🐛' },
  { label: 'Ivanti Connect Secure 2026', category: 'Vulnerabilities', icon: '🐛' },
  { label: 'AI-Powered Phishing Campaigns', category: 'Supply Chain', icon: '🔗' },
  { label: 'Supply Chain APT Targeting Telecom', category: 'Supply Chain', icon: '🔗' },
  { label: 'Deepfake Social Engineering 2026', category: 'Supply Chain', icon: '🔗' },
];

const CATEGORIES = ['APT Groups', 'Supply Chain', 'Ransomware', 'Vulnerabilities'] as const;

const CATEGORY_COLORS: Record<string, string> = {
  'APT Groups': 'border-red-500/30 bg-red-500/5 hover:border-red-400/50 text-red-300',
  'Supply Chain': 'border-amber-500/30 bg-amber-500/5 hover:border-amber-400/50 text-amber-300',
  'Ransomware': 'border-purple-500/30 bg-purple-500/5 hover:border-purple-400/50 text-purple-300',
  'Vulnerabilities': 'border-cyan-500/30 bg-cyan-500/5 hover:border-cyan-400/50 text-cyan-300',
};

/* ── Tier definitions ───────────────────────────────────────────────────── */

const TIER_INFO: {
  tier: ResearchTier;
  name: string;
  description: string;
  features: string[];
  icon: string;
  colorBorder: string;
  colorBg: string;
  colorRing: string;
  colorText: string;
  colorGlow: string;
  requiresKey?: string;
}[] = [
  {
    tier: 'STANDARD',
    name: 'Standard',
    description: 'Enhanced research depth',
    features: ['Perplexity Sonar', 'Multi-source correlation', 'ATT&CK mapping', 'Confidence scoring'],
    icon: '🔑',
    colorBorder: 'border-blue-500/40',
    colorBg: 'bg-blue-500/5',
    colorRing: 'ring-blue-500/40',
    colorText: 'text-blue-400',
    colorGlow: 'shadow-blue-500/10',
  },
  {
    tier: 'DEEP',
    name: 'Deep Research',
    description: 'Comprehensive analysis',
    features: ['Perplexity Deep Research', 'Full threat actor profiling', 'Timeline reconstruction', 'Strategic assessment'],
    icon: '🔬',
    colorBorder: 'border-purple-500/40',
    colorBg: 'bg-purple-500/5',
    colorRing: 'ring-purple-500/40',
    colorText: 'text-purple-400',
    colorGlow: 'shadow-purple-500/10',
  },
];

const TIER_BADGE: Record<ResearchTier, string> = {
  FREE: 'bg-green-500/15 text-green-400 border-green-500/25',
  STANDARD: 'bg-blue-500/15 text-blue-400 border-blue-500/25',
  DEEP: 'bg-purple-500/15 text-purple-400 border-purple-500/25',
};

export const HomePage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [topic, setTopic] = useState('');
  const [selectedTier, setSelectedTier] = useState<ResearchTier>(() => {
    const saved = useSettingsStore.getState().defaultTier;
    // Don't allow DEEP without BYOK key
    if (saved === 'DEEP' && !useSettingsStore.getState().apiKeys.perplexity) return 'STANDARD';
    return saved;
  });
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const apiKeys = useSettingsStore((s) => s.apiKeys);
  const hasApiKey = useSettingsStore((s) => s.hasApiKey);
  const { phase, progress, progressMessage, error, rateLimit } = useResearchStore();
  const {
    setPhase, setProgress, setError, setCurrentBundle,
    decrementRateLimit, reset: resetResearch,
  } = useResearchStore();
  const { setCurrentReport, addToHistory, history } = useReportStore();

  const isLoading = phase !== 'idle' && phase !== 'complete' && phase !== 'error';

  const canSubmit =
    topic.trim().length > 0 &&
    !isLoading;

  const basePath = '';

  const handleResearch = useCallback(async () => {
    if (!canSubmit) return;
    resetResearch();
    setPhase('searching', 'Searching for threat intelligence...');
    try {
      setProgress(10, 'Initiating search queries...');
      const bundle = await apiClient.research({ topic: topic.trim(), tier: selectedTier, apiKeys });
      setCurrentBundle(bundle);
      setProgress(50, 'Search complete. Synthesizing intelligence...');
      setPhase('generating', 'Generating intelligence report...');
      setProgress(60, 'Structuring report sections...');
      const report = await apiClient.generateReport({ bundle });
      setProgress(90, 'Finalizing report...');
      setCurrentReport(report);
      addToHistory(report);
      if (selectedTier === 'FREE') decrementRateLimit();
      setPhase('complete', 'Report ready!');
      setProgress(100, 'Report generated successfully.');
      navigate(`${basePath}/report/${report.id}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An unexpected error occurred';
      setError(message);
    }
  }, [canSubmit, topic, selectedTier, apiKeys, basePath, navigate, resetResearch, setPhase, setProgress, setCurrentBundle, setCurrentReport, addToHistory, decrementRateLimit, setError]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey && canSubmit) {
      e.preventDefault();
      handleResearch();
    }
  };

  const filteredTopics = activeCategory
    ? SUGGESTED_TOPICS.filter((t) => t.category === activeCategory)
    : SUGGESTED_TOPICS;

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      {/* Guided Tour (auto-starts on first visit) */}
      <GuidedTour />

      {/* Hero */}
      <div className="text-center mb-10">
        <h1 className="text-4xl font-bold tracking-tight mb-3">
          <span className="text-cyber-500">Cyber</span>
          <span className="text-gray-100">BRIEF</span>
        </h1>
        <p className="text-gray-400 text-lg">Automated cyber threat intelligence research &amp; reporting</p>
      </div>

      {/* Search Input */}
      <div className="glass-panel p-6 mb-6" data-tour="topic-input">
        <div className="relative">
          <input
            type="text"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Enter a threat topic... (e.g., APT44 Sandworm)"
            disabled={isLoading}
            className="w-full bg-gray-800/50 border border-gray-700 rounded-lg px-4 py-4 text-lg text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyber-500/50 focus:border-cyber-500 disabled:opacity-50 transition-all"
          />
          {topic.length > 0 && !isLoading && (
            <button onClick={() => setTopic('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors">✕</button>
          )}
        </div>

        {/* Category Filter Tabs */}
        <div className="flex flex-wrap gap-2 mt-4 mb-3">
          <button
            onClick={() => setActiveCategory(null)}
            className={`px-3 py-1 text-xs font-medium rounded-full border transition-all ${activeCategory === null ? 'border-cyber-500/40 bg-cyber-500/10 text-cyber-400' : 'border-gray-700 bg-gray-800/50 text-gray-500 hover:text-gray-300'}`}
          >All</button>
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(activeCategory === cat ? null : cat)}
              className={`px-3 py-1 text-xs font-medium rounded-full border transition-all ${activeCategory === cat ? 'border-cyber-500/40 bg-cyber-500/10 text-cyber-400' : 'border-gray-700 bg-gray-800/50 text-gray-500 hover:text-gray-300'}`}
            >{cat}</button>
          ))}
        </div>

        {/* Suggested Topic Chips */}
        <div className="flex flex-wrap gap-2">
          {filteredTopics.map((t) => (
            <button
              key={t.label}
              onClick={() => setTopic(t.label)}
              disabled={isLoading}
              className={`px-3 py-1.5 text-sm rounded-full border transition-all disabled:opacity-50 flex items-center gap-1.5 ${CATEGORY_COLORS[t.category]}`}
            >
              <span className="text-xs">{t.icon}</span>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tier Selector Cards — Deep Research only shown with BYOK Perplexity key */}
      <div className="flex flex-wrap justify-center gap-4 mb-6 max-w-2xl mx-auto" data-tour="tier-selector">
        {TIER_INFO.filter((info) => info.tier !== 'DEEP' || hasApiKey('perplexity')).map((info) => {
          const isLocked = info.requiresKey && !hasApiKey(info.requiresKey as keyof typeof apiKeys);
          const isSelected = selectedTier === info.tier;
          return (
            <button
              key={info.tier}
              onClick={() => !isLocked && setSelectedTier(info.tier)}
              disabled={isLoading || !!isLocked}
              className={`relative p-5 rounded-xl border-2 text-left transition-all w-full max-w-sm ${isSelected ? `${info.colorBorder} ${info.colorBg} ring-2 ring-offset-2 ring-offset-gray-950 ${info.colorRing} shadow-lg ${info.colorGlow}` : 'border-gray-800 bg-gray-900/30 hover:border-gray-700'} ${isLocked ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
            >
              <div className="flex items-center gap-2 mb-2">
                <span className="text-2xl">{isLocked ? '🔒' : info.icon}</span>
                <h3 className={`font-bold text-lg ${isSelected ? info.colorText : 'text-gray-100'}`}>{info.name}</h3>
              </div>
              <p className="text-xs text-gray-400 mb-3">{info.description}</p>
              <ul className="space-y-1">
                {info.features.map((feat) => (
                  <li key={feat} className="text-xs text-gray-500 flex items-center gap-1.5">
                    <span className={`text-[10px] ${isSelected ? info.colorText : 'text-gray-600'}`}>✓</span>
                    {feat}
                  </li>
                ))}
              </ul>
              {isLocked && (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-950/70 rounded-xl backdrop-blur-[1px]">
                  <div className="text-center">
                    <span className="text-2xl block mb-1">🔒</span>
                    <button
                      onClick={(e) => { e.stopPropagation(); navigate(`${basePath}/settings`); }}
                      className="text-xs text-cyber-400 hover:text-cyber-300 underline"
                    >Add API key in Settings</button>
                  </div>
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Rate limit handled server-side */}

      {/* Generate Button + Progress */}
      <div className="text-center mb-8" data-tour="generate-button">
        <button onClick={handleResearch} disabled={!canSubmit}
          className="px-8 py-3 rounded-lg bg-cyber-500 hover:bg-cyber-600 text-white font-semibold text-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed cyber-glow">
          {isLoading ? (
            <span className="flex items-center gap-2">
              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              {progressMessage || 'Researching...'}
            </span>
          ) : 'Generate Report'}
        </button>
        {isLoading && (
          <div className="mt-4 max-w-md mx-auto">
            <div className="w-full bg-gray-800 rounded-full h-2">
              <div className="bg-cyber-500 h-2 rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
            </div>
            <p className="text-xs text-gray-500 mt-2">{progressMessage}</p>
          </div>
        )}
        {error && <div className="mt-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm max-w-md mx-auto">{error}</div>}
      </div>

      {/* Recent Reports */}
      {history.length > 0 && (
        <div className="glass-panel p-6">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Recent Reports</h2>
          <div className="space-y-2">
            {history.slice(0, 5).map((report) => (
              <button key={report.id} onClick={() => { setCurrentReport(report); navigate(`${basePath}/report/${report.id}`); }}
                className="w-full flex items-center justify-between p-3 rounded-md bg-gray-800/30 hover:bg-gray-800/50 transition-colors text-left group">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-200 group-hover:text-cyber-400 transition-colors truncate">{report.topic}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${TIER_BADGE[report.tier]}`}>{report.tier}</span>
                  </div>
                  <span className="text-xs text-gray-500">
                    {new Date(report.createdAt).toLocaleDateString()} · {report.iocs?.length ?? 0} IOCs · {report.attackMapping?.length ?? 0} techniques
                  </span>
                </div>
                <span className="text-gray-600 group-hover:text-gray-400 transition-colors ml-2">→</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
