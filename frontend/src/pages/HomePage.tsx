import React, { useState, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useSettingsStore } from '../stores/settingsStore';
import { useResearchStore } from '../stores/researchStore';
import { useReportStore } from '../stores/reportStore';
import { apiClient } from '../api/client';
import { GuidedTour } from '../components/GuidedTour';
import type { ResearchTier } from '../types';

/* Suggested topics */

interface SuggestedTopic {
  label: string;
  category: 'APT Groups' | 'Supply Chain' | 'Ransomware' | 'Vulnerabilities';
  icon: string;
}

const SUGGESTED_TOPICS: SuggestedTopic[] = [
  { label: 'SHADOW-EARTH-053 China-aligned Exchange and IIS N-day intrusions against Asian governments and Poland using Godzilla and ShadowPad', category: 'APT Groups', icon: '🕵️' },
  { label: 'GLITTER CARP and SEQUIN CARP phishing ICIJ journalists and Uyghur, Tibetan, Taiwanese, and Hong Kong activists', category: 'APT Groups', icon: '🕵️' },
  { label: 'OilRig APT34 Iranian protest lure chain hiding config in Google Drive PNGs and using Telegram Bot API C2', category: 'APT Groups', icon: '🕵️' },
  { label: 'UNC6692 email bombing and Teams help-desk impersonation deploying Snowbelt, Snowglaze, and Snowbasin', category: 'APT Groups', icon: '🕵️' },
  { label: 'Mini Shai-Hulud SAP CAP npm compromise hitting mbt 1.2.48 and @cap-js db-service, postgres, and sqlite packages', category: 'Supply Chain', icon: '🔗' },
  { label: 'PyTorch Lightning PyPI 2.6.2 and 2.6.3 compromise running credential stealer on import with GitHub repo poisoning', category: 'Supply Chain', icon: '🔗' },
  { label: 'Mini Shai-Hulud intercom-client 7.0.4 and intercom/intercom-php 5.0.2 compromise via stolen publishing flow', category: 'Supply Chain', icon: '🔗' },
  { label: 'VECT 2.0 RaaS Windows Linux ESXi locker acting as a wiper after nonce bug with TeamPCP and BreachForums affiliate push', category: 'Ransomware', icon: '💀' },
  { label: 'The Gentlemen RaaS scaling past 320 claimed victims using SystemBC, Cobalt Strike, Mimikatz, and GPO deployment', category: 'Ransomware', icon: '💀' },
  { label: 'Storm-1175 exploiting ConnectWise ScreenConnect CVE-2024-1708 and CVE-2024-1709 to deploy Medusa ransomware', category: 'Ransomware', icon: '💀' },
  { label: 'CVE-2026-41940 cPanel & WHM and WP2 auth bypass via CRLF session injection added to CISA KEV', category: 'Vulnerabilities', icon: '🐛' },
  { label: 'CVE-2026-31431 Linux kernel Copy Fail algif_aead LPE to root added to CISA KEV for active exploitation', category: 'Vulnerabilities', icon: '🐛' },
  { label: 'CVE-2026-32202 Windows Shell zero-click NTLM hash leak from incomplete CVE-2026-21510 patch under active exploitation', category: 'Vulnerabilities', icon: '🐛' },
  { label: 'CVE-2026-3844 Breeze Cache WordPress unauthenticated file upload dropping PHP webshells when local Gravatars are enabled', category: 'Vulnerabilities', icon: '🐛' },
];

const CATEGORIES = ['APT Groups', 'Supply Chain', 'Ransomware', 'Vulnerabilities'] as const;

const CATEGORY_COLORS: Record<string, string> = {
  'APT Groups': 'border-red-500/30 bg-red-500/5 hover:border-red-400/50 text-red-300',
  'Supply Chain': 'border-amber-500/30 bg-amber-500/5 hover:border-amber-400/50 text-amber-300',
  'Ransomware': 'border-purple-500/30 bg-purple-500/5 hover:border-purple-400/50 text-purple-300',
  'Vulnerabilities': 'border-cyan-500/30 bg-cyan-500/5 hover:border-cyan-400/50 text-cyan-300',
};

/* Tier definitions */

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
    <div className="briefing-desk-home">
      <GuidedTour />

      <section className="grid gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(360px,0.95fr)]">
        <div className="desk-card p-8 md:p-10" data-tour="topic-input">
          <p className="desk-kicker mb-8"><span /> Editorial intelligence room</p>
          <h1 className="max-w-3xl text-[3.4rem] leading-[0.98] md:text-[5rem]">
            Read the threat landscape before it moves.
          </h1>
          <p className="mt-4 max-w-2xl text-lg leading-7" style={{ color: 'var(--desk-muted)' }}>
            CyberBRIEF turns focused questions, source bundles, and saved watchlists into analyst-ready BLUF reports with source context, indicators, confidence, and ATT&CK mapping.
          </p>

          <div className="mt-8 rounded-[20px] border p-3" style={{ borderColor: 'var(--desk-border)', background: 'rgba(255,255,255,0.5)' }}>
            <div className="flex flex-col gap-3 md:flex-row">
              <div className="flex min-h-[54px] flex-1 items-center gap-3 rounded-2xl px-3">
                <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-sm font-bold" style={{ backgroundColor: '#e2e1dc', color: 'var(--desk-blue)' }}>Q</span>
                <input
                  type="text"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Try APT44 Sandworm, W3LL phishing, or Apache ActiveMQ..."
                  disabled={isLoading}
                  className="w-full border-0 bg-transparent px-0 py-3 text-base outline-none placeholder:text-gray-500 focus:ring-0 disabled:opacity-50"
                />
                {topic.length > 0 && !isLoading && (
                  <button onClick={() => setTopic('')} className="rounded-full px-2 py-1 text-sm" style={{ color: 'var(--desk-muted)' }}>Clear</button>
                )}
              </div>
              <button
                onClick={inputMode === 'sources' ? handleSourceResearch : handleResearch}
                disabled={!canSubmit}
                className="rounded-2xl px-6 py-4 text-base font-black tracking-wide text-white transition-all disabled:cursor-not-allowed disabled:opacity-40 cyber-glow"
                style={{ background: 'linear-gradient(135deg, var(--desk-accent), var(--desk-blue))' }}
                data-tour="generate-button"
              >
                {isLoading ? (progressMessage || 'Preparing brief...') : 'Prepare brief'}
              </button>
            </div>
          </div>

          <div className="mt-7 grid gap-3 sm:grid-cols-3">
            <div className="desk-stat">
              <span>Reporting cadence</span>
              <strong>14 briefs today</strong>
            </div>
            <div className="desk-stat">
              <span>Median confidence</span>
              <strong>82 percent</strong>
            </div>
            <div className="desk-stat">
              <span>Open investigations</span>
              <strong>{history.length || 6} dossiers</strong>
            </div>
          </div>
        </div>

        <aside className="desk-card p-6 md:p-8">
          <div className="mb-7 flex items-start justify-between gap-4">
            <div>
              <p className="desk-kicker mb-2"><span /> Situational board</p>
              <h2 className="text-3xl leading-none md:text-4xl">Signals by region and source class</h2>
            </div>
            <span className="rounded-xl border px-3 py-2 text-[10px] font-bold uppercase tracking-[0.16em]" style={{ borderColor: '#d8b8b8', color: 'var(--desk-accent-dark)', backgroundColor: '#f4e8e3' }}>
              Updated 05:40Z
            </span>
          </div>

          <div className="signal-map relative mb-5 h-64 overflow-hidden rounded-[22px] border" style={{ borderColor: 'var(--desk-border)' }}>
            <div className="signal-dot left-[26%] top-[29%]" style={{ '--dot': 'var(--desk-accent)' } as React.CSSProperties}><span>EU clinics</span></div>
            <div className="signal-dot left-[66%] top-[38%]" style={{ '--dot': '#2f7a96' } as React.CSSProperties}><span>npm supply chain</span></div>
            <div className="signal-dot left-[50%] top-[63%]" style={{ '--dot': 'var(--desk-green)' } as React.CSSProperties}><span>cloud identity</span></div>
          </div>

          <div className="rounded-[20px] border p-5" style={{ borderColor: 'var(--desk-border)', backgroundColor: 'rgba(255,255,255,0.42)' }}>
            <div className="flex items-center gap-4">
              <div className="risk-ring">
                <span>72</span>
              </div>
              <div>
                <p className="desk-label">Threat level</p>
                <p className="mt-2 leading-6" style={{ color: 'var(--desk-muted)' }}>
                  Medium high. Ransomware tradecraft and credential theft are active, while vulnerability exploitation is rising inside the 10 hour disclosure window.
                </p>
              </div>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            {['Vendor reports', 'Threat feeds', 'OSINT', 'ATT&CK mapping', 'User documents'].map((label) => (
              <span key={label} className="rounded-full border px-3 py-2 text-xs" style={{ borderColor: 'var(--desk-border)', color: 'var(--desk-muted)', backgroundColor: 'rgba(255,255,255,0.46)' }}>
                {label}
              </span>
            ))}
          </div>
        </aside>
      </section>

      <section className="mt-9 grid gap-5 lg:grid-cols-[minmax(260px,0.9fr)_minmax(0,1.2fr)_minmax(260px,0.9fr)]">
        <div>
          <p className="desk-kicker mb-2"><span /> Three step desk flow</p>
          <h2 className="text-3xl">From question to brief without the noise</h2>
        </div>
        <p className="lg:col-span-2 lg:max-w-2xl lg:justify-self-end" style={{ color: 'var(--desk-muted)' }}>
          The interface keeps the old product rhythm but trades the hacker dashboard for publication grade triage, provenance, and concise analyst handoff.
        </p>
      </section>

      <section className="mt-4 grid gap-4 md:grid-cols-3">
        {[
          ['1', 'Frame the question', 'Start with a topic, campaign, CVE, source bundle, or saved watchlist. Filters keep scope visible before research begins.'],
          ['2', 'Weigh the sources', 'CyberBRIEF groups similar claims, labels confidence, and separates primary references from repeated commentary.'],
          ['3', 'Publish the BLUF', 'Export a concise brief with executive summary, indicators, source notes, affected sectors, and ATT&CK technique context.'],
        ].map(([step, title, body]) => (
          <div key={step} className="desk-card p-6">
            <span className="flex h-9 w-9 items-center justify-center rounded-full text-sm font-black text-white" style={{ backgroundColor: 'var(--desk-blue)' }}>{step}</span>
            <h3 className="mt-7 text-2xl">{title}</h3>
            <p className="mt-4 leading-6" style={{ color: 'var(--desk-muted)' }}>{body}</p>
          </div>
        ))}
      </section>

      <section className="mt-5 grid gap-4 lg:grid-cols-[310px_minmax(0,1fr)_330px]">
        <div className="desk-card p-5">
          <p className="desk-label mb-4">Triage filters</p>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setActiveCategory(null)} className={`desk-pill ${activeCategory === null ? 'is-active' : ''}`}>All reporting</button>
            {CATEGORIES.map((cat) => (
              <button key={cat} onClick={() => setActiveCategory(activeCategory === cat ? null : cat)} className={`desk-pill ${activeCategory === cat ? 'is-active' : ''}`}>
                {cat}
              </button>
            ))}
          </div>

          <div className="mt-8" data-tour="tier-selector">
            <p className="desk-label mb-3">Research mode</p>
            <div className="space-y-2">
              {TIER_INFO.filter((info) => info.tier !== 'DEEP' || hasApiKey('perplexity')).map((info) => {
                const isLocked = info.requiresKey && !hasApiKey(info.requiresKey as keyof typeof apiKeys);
                const isSelected = selectedTier === info.tier;
                return (
                  <button
                    key={info.tier}
                    onClick={() => !isLocked && setSelectedTier(info.tier)}
                    disabled={isLoading || !!isLocked}
                    className={`w-full rounded-2xl border p-4 text-left transition-all disabled:cursor-not-allowed disabled:opacity-50 ${isSelected ? 'shadow-sm' : ''}`}
                    style={{ borderColor: isSelected ? 'var(--desk-accent)' : 'var(--desk-border)', backgroundColor: isSelected ? 'rgba(155,47,66,0.08)' : 'rgba(255,255,255,0.36)' }}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <strong>{info.name}</strong>
                      <span className={`text-[10px] rounded-full border px-2 py-1 ${TIER_BADGE[info.tier]}`}>{info.tier}</span>
                    </div>
                    <p className="mt-2 text-sm" style={{ color: 'var(--desk-muted)' }}>{info.description}</p>
                  </button>
                );
              })}
            </div>
            <button onClick={() => navigate('/settings')} className="mt-3 text-sm font-semibold" style={{ color: 'var(--desk-accent)' }}>
              Manage API keys
            </button>
          </div>
        </div>

        <div className="desk-card overflow-hidden">
          <div className="flex flex-col gap-3 border-b p-5 md:flex-row md:items-center md:justify-between" style={{ borderColor: 'var(--desk-border)' }}>
            <div>
              <p className="desk-label">Chronological report stream</p>
              <h2 className="mt-1 text-3xl">Latest intelligence packets</h2>
            </div>
            <div className="inline-flex rounded-full border p-1" style={{ borderColor: 'var(--desk-border)', backgroundColor: 'rgba(255,255,255,0.4)' }}>
              <button onClick={() => setInputMode('search')} className={`desk-toggle ${inputMode === 'search' ? 'is-active' : ''}`}>Readable</button>
              <button onClick={() => setInputMode('sources')} className={`desk-toggle ${inputMode === 'sources' ? 'is-active' : ''}`}>Sources</button>
            </div>
          </div>

          {inputMode === 'search' ? (
            <div className="divide-y" style={{ borderColor: 'var(--desk-border)' }}>
              {filteredTopics.slice(0, 8).map((t, index) => (
                <button
                  key={t.label}
                  onClick={() => setTopic(t.label)}
                  disabled={isLoading}
                  className="grid w-full grid-cols-[72px_minmax(0,1fr)] gap-4 px-6 py-4 text-left transition-colors hover:bg-white/40 disabled:opacity-50"
                >
                  <span className="text-[11px] font-bold uppercase tracking-[0.16em]" style={{ color: 'var(--desk-muted)' }}>05:{32 + index}Z</span>
                  <span>
                    <span className="block text-lg leading-6">{t.label}</span>
                    <span className="mt-1 block text-xs font-bold uppercase tracking-[0.14em]" style={{ color: 'var(--desk-accent)' }}>{t.category}</span>
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <div className="space-y-4 p-5">
              <div>
                <label className="desk-label mb-2 block">Source URLs, one per line</label>
                <textarea
                  value={sourceUrls}
                  onChange={(e) => setSourceUrls(e.target.value)}
                  placeholder={"https://example.com/threat-report\nhttps://blog.security.org/apt-analysis"}
                  disabled={isLoading}
                  rows={3}
                  className="w-full rounded-2xl border px-4 py-3 text-sm outline-none disabled:opacity-50"
                />
              </div>
              <div>
                <label className="desk-label mb-2 block">Raw text or report content</label>
                <textarea
                  value={sourceText}
                  onChange={(e) => setSourceText(e.target.value)}
                  placeholder="Paste threat report text, IOC lists, advisory content..."
                  disabled={isLoading}
                  rows={4}
                  className="w-full rounded-2xl border px-4 py-3 text-sm outline-none disabled:opacity-50"
                />
              </div>
              <div>
                <label className="desk-label mb-2 block">Upload files</label>
                <div className="flex flex-wrap items-center gap-3">
                  <label className="cursor-pointer rounded-full border px-4 py-2 text-sm font-semibold" style={{ borderColor: 'var(--desk-border)', color: 'var(--desk-blue)' }}>
                    Choose files
                    <input type="file" accept=".pdf,.txt,.md,.csv" multiple onChange={handleFileUpload} className="hidden" disabled={isLoading} />
                  </label>
                  {sourceFiles.map((f, i) => (
                    <span key={i} className="inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs" style={{ borderColor: 'var(--desk-border)' }}>
                      {f.name}
                      <button onClick={() => setSourceFiles((prev) => prev.filter((_, j) => j !== i))} style={{ color: 'var(--desk-accent)' }}>Remove</button>
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="desk-card overflow-hidden" style={{ background: 'linear-gradient(145deg, #182431, #3b2036)' }}>
            <div className="p-6 text-white">
              <p className="desk-label mb-5 text-white/50">Brief assembly</p>
              <h2 className="text-3xl text-white">Build a field ready BLUF</h2>
              <p className="mt-4 leading-6 text-white/70">Keep the result compact. Lead with the answer, retain source provenance, and preserve confidence levels.</p>
            </div>
            <div className="border-t border-white/10 p-5">
              {isLoading && (
                <>
                  <div className="h-2 overflow-hidden rounded-full bg-white/15">
                    <div className="h-full rounded-full bg-white transition-all duration-500" style={{ width: `${progress}%` }} />
                  </div>
                  <p className="mt-3 text-sm text-white/70">{progressMessage}</p>
                </>
              )}
              {error && <div className="rounded-xl border border-red-300/40 bg-red-500/10 p-3 text-sm text-red-100">{error}</div>}
              {!isLoading && !error && <p className="text-sm text-white/60">Waiting for a question or source packet.</p>}
            </div>
          </div>

          {history.length > 0 && (
            <div className="desk-card p-5">
              <p className="desk-label mb-4">Recent briefs</p>
              <div className="space-y-2">
                {history.slice(0, 4).map((report) => (
                  <button key={report.id} onClick={() => { setCurrentReport(report); navigate(`${basePath}/report/${report.id}`); }} className="w-full rounded-2xl border p-3 text-left transition-colors hover:bg-white/40" style={{ borderColor: 'var(--desk-border)' }}>
                    <span className="block truncate font-semibold">{report.topic}</span>
                    <span className="mt-1 block text-xs" style={{ color: 'var(--desk-muted)' }}>
                      {new Date(report.createdAt).toLocaleDateString()} | {report.iocs?.length ?? 0} IOCs | {report.attackMapping?.length ?? 0} techniques
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
};
