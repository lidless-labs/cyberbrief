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
  { label: 'RU-APT-ChainReaver-L GitHub Supply Chain', category: 'APT Groups', icon: '🕵️' },
  { label: 'HoneyMyte CoolClient Backdoor Campaign', category: 'APT Groups', icon: '🕵️' },
  { label: 'UAT-9686 Cisco SEG Exploitation', category: 'APT Groups', icon: '🕵️' },
  { label: 'Violet Typhoon eScan Supply Chain', category: 'APT Groups', icon: '🕵️' },
  { label: 'NightSpire Extortion Campaign', category: 'Ransomware', icon: '💀' },
  { label: 'Qilin Rust-Based Ecosystem', category: 'Ransomware', icon: '💀' },
  { label: 'LockBit Double-Extortion Attacks', category: 'Ransomware', icon: '💀' },
  { label: 'Notepad++ Trojanized Updates', category: 'Supply Chain', icon: '🔗' },
  { label: 'eScan Antivirus Compromise', category: 'Supply Chain', icon: '🔗' },
  { label: 'Open-Source Package Poisoning', category: 'Supply Chain', icon: '🔗' },
  { label: 'Malicious Browser Extensions', category: 'Supply Chain', icon: '🔗' },
  { label: 'CVE-2026-21510 SmartScreen Bypass', category: 'Vulnerabilities', icon: '🐛' },
  { label: 'CVE-2026-2441 Chrome RCE', category: 'Vulnerabilities', icon: '🐛' },
  { label: 'CVE-2026-20841 Notepad RCE', category: 'Vulnerabilities', icon: '🐛' },
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
  const [inputMode, setInputMode] = useState<'search' | 'sources'>('search');
  const [sourceUrls, setSourceUrls] = useState('');
  const [sourceText, setSourceText] = useState('');
  const [sourceFiles, setSourceFiles] = useState<{ name: string; data: string }[]>([]);

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

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      if (file.type === 'application/pdf') {
        reader.onload = () => {
          const base64 = (reader.result as string).split(',')[1];
          setSourceFiles((prev) => [...prev, { name: file.name, data: base64 }]);
        };
        reader.readAsDataURL(file);
      } else {
        reader.onload = () => {
          setSourceFiles((prev) => [...prev, { name: file.name, data: reader.result as string }]);
        };
        reader.readAsText(file);
      }
    });
    e.target.value = '';
  };

  const handleSourceResearch = useCallback(async () => {
    if (!topic.trim()) return;
    const sources: { type: string; value: string; label?: string }[] = [];

    // Parse URLs (one per line)
    sourceUrls.split('\n').forEach((u) => {
      const url = u.trim();
      if (url && (url.startsWith('http://') || url.startsWith('https://'))) {
        sources.push({ type: 'url', value: url });
      }
    });

    // Raw text
    if (sourceText.trim()) {
      sources.push({ type: 'text', value: sourceText.trim(), label: 'Pasted text' });
    }

    // Files
    sourceFiles.forEach((f) => {
      const isPdf = f.name.toLowerCase().endsWith('.pdf');
      sources.push({ type: isPdf ? 'pdf' : 'text', value: f.data, label: f.name });
    });

    if (sources.length === 0) {
      useResearchStore.getState().setError('Add at least one source (URL, text, or file).');
      return;
    }

    resetResearch();
    setPhase('searching', 'Processing your sources...');
    try {
      setProgress(10, 'Uploading sources...');
      const bundle = await apiClient.researchFromSources({ topic: topic.trim(), sources, apiKeys: apiKeys as Record<string, string> });
      setCurrentBundle(bundle);
      setProgress(50, 'Sources processed. Generating report...');
      setPhase('generating', 'Generating intelligence report...');
      setProgress(60, 'Structuring report sections...');
      const report = await apiClient.generateReport({ bundle });
      setProgress(90, 'Finalizing report...');
      setCurrentReport(report);
      addToHistory(report);
      setPhase('complete', 'Report ready!');
      setProgress(100, 'Report generated successfully.');
      navigate(`${basePath}/report/${report.id}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An unexpected error occurred';
      setError(message);
    }
  }, [topic, sourceUrls, sourceText, sourceFiles, apiKeys, basePath, navigate, resetResearch, setPhase, setProgress, setCurrentBundle, setCurrentReport, addToHistory, setError]);

  const filteredTopics = activeCategory
    ? SUGGESTED_TOPICS.filter((t) => t.category === activeCategory)
    : SUGGESTED_TOPICS;

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      {/* Guided Tour (auto-starts on first visit) */}
      <GuidedTour />

      {/* Hero */}
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold tracking-tight mb-3">
          <span className="text-cyber-500">Cyber</span>
          <span className="text-gray-100">BRIEF</span>
        </h1>
        <p className="text-gray-400 text-lg mb-6">Automated cyber threat intelligence research &amp; reporting</p>

        {/* How It Works */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-3xl mx-auto mb-2">
          <div className="p-4 rounded-xl border border-gray-800 bg-gray-900/30">
            <div className="text-2xl mb-2">🔍</div>
            <h3 className="text-sm font-semibold text-gray-200 mb-1">1. Choose a Topic</h3>
            <p className="text-xs text-gray-500">Pick a suggested threat or type your own. Or upload your own documents and URLs for custom analysis.</p>
          </div>
          <div className="p-4 rounded-xl border border-gray-800 bg-gray-900/30">
            <div className="text-2xl mb-2">⚡</div>
            <h3 className="text-sm font-semibold text-gray-200 mb-1">2. AI Researches</h3>
            <p className="text-xs text-gray-500">Multi-source AI pulls from threat feeds, maps ATT&CK techniques, and extracts IOCs automatically.</p>
          </div>
          <div className="p-4 rounded-xl border border-gray-800 bg-gray-900/30">
            <div className="text-2xl mb-2">📋</div>
            <h3 className="text-sm font-semibold text-gray-200 mb-1">3. Get Your BLUF</h3>
            <p className="text-xs text-gray-500">Receive a structured intelligence brief with executive summary, IOC table, and ATT&CK mapping.</p>
          </div>
        </div>

        {/* Quick links */}
        <div className="flex items-center justify-center gap-4 text-xs text-gray-500">
          <button onClick={() => navigate('/settings')} className="hover:text-cyber-400 transition-colors flex items-center gap-1">
            🔑 <span className="underline">Add your API keys</span>
          </button>
          <span className="text-gray-700">|</span>
          <button onClick={() => navigate('/docs')} className="hover:text-cyber-400 transition-colors flex items-center gap-1">
            📖 <span className="underline">Documentation</span>
          </button>
        </div>
      </div>

      {/* Mode Tabs */}
      <div className="flex justify-center gap-1 mb-4 p-1 bg-gray-900/50 rounded-lg max-w-xs mx-auto">
        <button
          onClick={() => setInputMode('search')}
          className={`flex-1 px-4 py-2 text-sm font-medium rounded-md transition-all ${inputMode === 'search' ? 'bg-cyber-500/20 text-cyber-400 border border-cyber-500/30' : 'text-gray-500 hover:text-gray-300'}`}
        >🔍 Search</button>
        <button
          onClick={() => setInputMode('sources')}
          className={`flex-1 px-4 py-2 text-sm font-medium rounded-md transition-all ${inputMode === 'sources' ? 'bg-cyber-500/20 text-cyber-400 border border-cyber-500/30' : 'text-gray-500 hover:text-gray-300'}`}
        >📄 Your Sources</button>
      </div>

      {/* Topic Input (shared by both modes) */}
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

        {inputMode === 'search' && (
          <>
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
          </>
        )}

        {inputMode === 'sources' && (
          <div className="mt-4 space-y-4">
            <p className="text-xs text-gray-500">
              Provide your own source material. CyberBRIEF will analyze it and generate a structured intelligence report with ATT&CK mapping and IOC extraction.
            </p>

            {/* URL Input */}
            <div>
              <label className="block text-xs text-gray-400 mb-1 font-medium">Source URLs (one per line)</label>
              <textarea
                value={sourceUrls}
                onChange={(e) => setSourceUrls(e.target.value)}
                placeholder={"https://example.com/threat-report\nhttps://blog.security.org/apt-analysis"}
                disabled={isLoading}
                rows={3}
                className="w-full bg-gray-800/50 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-cyber-500/50 focus:border-cyber-500 disabled:opacity-50 resize-none font-mono"
              />
            </div>

            {/* Text Paste */}
            <div>
              <label className="block text-xs text-gray-400 mb-1 font-medium">Paste raw text or report content</label>
              <textarea
                value={sourceText}
                onChange={(e) => setSourceText(e.target.value)}
                placeholder="Paste threat report text, IOC lists, advisory content..."
                disabled={isLoading}
                rows={4}
                className="w-full bg-gray-800/50 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-cyber-500/50 focus:border-cyber-500 disabled:opacity-50 resize-none"
              />
            </div>

            {/* File Upload */}
            <div>
              <label className="block text-xs text-gray-400 mb-1 font-medium">Upload files (PDF, TXT, MD)</label>
              <div className="flex items-center gap-3">
                <label className="px-4 py-2 text-xs font-medium rounded-lg border border-gray-700 bg-gray-800/50 text-gray-400 hover:text-gray-200 hover:border-gray-600 cursor-pointer transition-all">
                  Choose Files
                  <input
                    type="file"
                    accept=".pdf,.txt,.md,.csv"
                    multiple
                    onChange={handleFileUpload}
                    className="hidden"
                    disabled={isLoading}
                  />
                </label>
                {sourceFiles.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {sourceFiles.map((f, i) => (
                      <span key={i} className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-md bg-gray-800 border border-gray-700 text-gray-300">
                        📎 {f.name}
                        <button onClick={() => setSourceFiles((prev) => prev.filter((_, j) => j !== i))} className="text-gray-500 hover:text-red-400 ml-1">✕</button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="p-3 rounded-lg bg-blue-500/5 border border-blue-500/20 text-xs text-blue-300/80">
              <strong>Tip:</strong> Sources are processed server-side. URLs are fetched and parsed, text is analyzed directly, and PDFs are extracted for content. Up to 20 sources per request.
            </div>
          </div>
        )}
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
              className={`relative p-5 rounded-xl border-2 text-center transition-all w-full max-w-sm ${isSelected ? `${info.colorBorder} ${info.colorBg} ring-2 ring-offset-2 ring-offset-gray-950 ${info.colorRing} shadow-lg ${info.colorGlow}` : 'border-gray-800 bg-gray-900/30 hover:border-gray-700'} ${isLocked ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
            >
              <div className="flex items-center justify-center gap-2 mb-2">
                <span className="text-2xl">{isLocked ? '🔒' : info.icon}</span>
                <h3 className={`font-bold text-lg ${isSelected ? info.colorText : 'text-gray-100'}`}>{info.name}</h3>
              </div>
              <p className="text-xs text-gray-400 mb-3">{info.description}</p>
              <ul className="space-y-1 inline-block text-left">
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
        <button onClick={inputMode === 'sources' ? handleSourceResearch : handleResearch} disabled={!canSubmit}
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
