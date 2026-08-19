import React, { useState, useCallback } from 'react';

/* ── Section Data ─────────────────────────────────────────────────────── */

interface DocSection {
  id: string;
  title: string;
  icon: string;
}

const SECTIONS: DocSection[] = [
  { id: 'overview', title: 'Overview', icon: '📖' },
  { id: 'getting-started', title: 'Getting Started', icon: '🚀' },
  { id: 'research-sources', title: 'Research Sources', icon: '🔍' },
  { id: 'report-format', title: 'Report Format (BLUF)', icon: '📄' },
  { id: 'attack-integration', title: 'ATT&CK Integration', icon: '🎯' },
  { id: 'keyboard-shortcuts', title: 'Keyboard Shortcuts', icon: '⌨️' },
  { id: 'faq', title: 'FAQ', icon: '❓' },
];

/* ── Component ────────────────────────────────────────────────────────── */

export const DocsPage: React.FC = () => {
  const [activeSection, setActiveSection] = useState('overview');

  const scrollToSection = useCallback((id: string) => {
    setActiveSection(id);
    const el = document.getElementById(`docs-${id}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, []);

  return (
    <div className="flex max-w-6xl mx-auto px-4 py-8 gap-6">
      {/* ── Sidebar TOC ────────────────────────────────────────────── */}
      <aside className="hidden lg:block w-52 flex-shrink-0">
        <nav className="sticky top-24 space-y-1">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
            Documentation
          </h3>
          {SECTIONS.map((section) => (
            <button
              key={section.id}
              onClick={() => scrollToSection(section.id)}
              className={`block w-full text-left text-sm px-3 py-1.5 rounded-md transition-all ${
                activeSection === section.id
                  ? 'text-cyber-400 bg-cyber-500/10 border-l-2 border-cyber-500'
                  : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800/30'
              }`}
            >
              <span className="mr-1.5">{section.icon}</span>
              {section.title}
            </button>
          ))}
        </nav>
      </aside>

      {/* ── Main Content ───────────────────────────────────────────── */}
      <div className="flex-1 max-w-3xl space-y-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-100 mb-2">
            📚 Documentation
          </h1>
          <p className="text-gray-500 text-sm">
            Everything you need to know about using CyberBRIEF.
          </p>
        </div>

        {/* ── Overview ─────────────────────────────────────────────── */}
        <section id="docs-overview" className="glass-panel p-6">
          <h2 className="text-lg font-semibold text-gray-200 mb-3 flex items-center gap-2">
            <span>📖</span> Overview
          </h2>
          <div className="space-y-3 text-sm text-gray-400 leading-relaxed">
            <p>
              <strong className="text-gray-200">CyberBRIEF</strong> is an
              AI-powered cyber threat intelligence research platform. Enter any
              threat topic — an APT group, vulnerability, ransomware family, or
              campaign — and CyberBRIEF will:
            </p>
            <ul className="list-disc list-inside space-y-1.5 pl-2">
              <li>
                Search multiple intelligence sources (Brave, Perplexity, Gemini)
              </li>
              <li>
                Synthesize findings into a{' '}
                <strong className="text-gray-300">BLUF-format</strong>{' '}
                intelligence report
              </li>
              <li>
                Extract <strong className="text-gray-300">IOCs</strong>{' '}
                (indicators of compromise) automatically
              </li>
              <li>
                Map observed techniques to the{' '}
                <strong className="text-gray-300">MITRE ATT&CK</strong>{' '}
                framework
              </li>
              <li>
                Generate properly formatted{' '}
                <strong className="text-gray-300">Chicago NB citations</strong>
              </li>
              <li>Export reports as HTML, Markdown, or ATT&CK Navigator layers</li>
            </ul>
            <p>
              CyberBRIEF follows the{' '}
              <strong className="text-gray-300">BYOK</strong> (Bring Your Own
              Key) model. API keys are stored in your browser&apos;s
              localStorage, included in requests to the CyberBRIEF backend when
              you run research, and forwarded to your selected API providers.
              CyberBRIEF is not intended to persist keys server-side, but a
              hosted operator and its logging, monitoring, and security
              boundaries may still access keys in transit. If you do not trust a
              hosted deployment, self-host CyberBRIEF or avoid entering keys in
              the browser.
            </p>
          </div>
        </section>

        {/* ── Getting Started ──────────────────────────────────────── */}
        <section id="docs-getting-started" className="glass-panel p-6">
          <h2 className="text-lg font-semibold text-gray-200 mb-3 flex items-center gap-2">
            <span>🚀</span> Getting Started
          </h2>
          <div className="space-y-4 text-sm text-gray-400 leading-relaxed">
            <div>
              <h3 className="text-gray-200 font-medium mb-1">
                1. Choose a Variant
              </h3>
              <p>
                On the landing page, select one of the five interface themes.
                Each provides the same features with a different visual style.
                You can always return to the variant picker at{' '}
                <code className="text-cyber-400 bg-gray-800/50 px-1.5 py-0.5 rounded text-xs">
                  /
                </code>
                .
              </p>
            </div>
            <div>
              <h3 className="text-gray-200 font-medium mb-1">
                2. Enter a Topic
              </h3>
              <p>
                Type any threat topic into the search field on the Home page.
                Examples: &ldquo;APT28 Fancy Bear&rdquo;, &ldquo;Log4Shell
                CVE-2021-44228&rdquo;, &ldquo;LockBit Ransomware&rdquo;. You
                can also click one of the suggested topic chips.
              </p>
            </div>
            <div>
              <h3 className="text-gray-200 font-medium mb-1">
                3. Select a Research Tier
              </h3>
              <p>
                Choose between Free, Standard, or Deep research. The Free tier
                uses Brave Search + Gemini Flash and requires no API keys (rate-limited
                to 10 queries/day). Standard and Deep require a Perplexity API
                key configured in Settings.
              </p>
            </div>
            <div>
              <h3 className="text-gray-200 font-medium mb-1">
                4. Generate &amp; Review
              </h3>
              <p>
                Click <strong className="text-gray-300">Generate Report</strong>{' '}
                and wait for the pipeline to complete. You&apos;ll be
                automatically navigated to the Report page where you can read
                the full BLUF briefing, review IOCs, explore ATT&CK mappings,
                and export your report.
              </p>
            </div>
          </div>
        </section>

        {/* ── Research Sources ─────────────────────────────────────── */}
        <section id="docs-research-sources" className="glass-panel p-6">
          <h2 className="text-lg font-semibold text-gray-200 mb-3 flex items-center gap-2">
            <span>🔍</span> Research Sources
          </h2>
          <div className="space-y-4 text-sm text-gray-400 leading-relaxed">
            <p>
              CyberBRIEF aggregates intelligence from multiple sources depending
              on your selected research tier:
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 border-b border-gray-800">
                    <th className="pb-2 pr-4">Tier</th>
                    <th className="pb-2 pr-4">Search Source</th>
                    <th className="pb-2 pr-4">Synthesis Model</th>
                    <th className="pb-2">API Key Required</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800/50">
                  <tr>
                    <td className="py-2 pr-4">
                      <span className="px-2 py-0.5 rounded text-xs bg-green-500/10 text-green-400 border border-green-500/20">
                        Free
                      </span>
                    </td>
                    <td className="py-2 pr-4 text-gray-300">Brave Search</td>
                    <td className="py-2 pr-4 text-gray-300">
                      Gemini 2.0 Flash
                    </td>
                    <td className="py-2 text-gray-300">
                      Brave + Gemini (optional via env)
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-4">
                      <span className="px-2 py-0.5 rounded text-xs bg-blue-500/10 text-blue-400 border border-blue-500/20">
                        Standard
                      </span>
                    </td>
                    <td className="py-2 pr-4 text-gray-300">
                      Perplexity Sonar
                    </td>
                    <td className="py-2 pr-4 text-gray-300">Built-in</td>
                    <td className="py-2 text-gray-300">Perplexity</td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-4">
                      <span className="px-2 py-0.5 rounded text-xs bg-purple-500/10 text-purple-400 border border-purple-500/20">
                        Deep
                      </span>
                    </td>
                    <td className="py-2 pr-4 text-gray-300">
                      Perplexity Deep Research
                    </td>
                    <td className="py-2 pr-4 text-gray-300">Built-in</td>
                    <td className="py-2 text-gray-300">Perplexity</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p>
              All research results are correlated, deduplicated, and synthesized
              into a single intelligence product. Source provenance is maintained
              throughout the pipeline for citation purposes.
            </p>
          </div>
        </section>

        {/* ── Report Format (BLUF) ─────────────────────────────────── */}
        <section id="docs-report-format" className="glass-panel p-6">
          <h2 className="text-lg font-semibold text-gray-200 mb-3 flex items-center gap-2">
            <span>📄</span> Report Format (BLUF)
          </h2>
          <div className="space-y-3 text-sm text-gray-400 leading-relaxed">
            <p>
              Reports follow the{' '}
              <strong className="text-gray-300">
                BLUF (Bottom Line Up Front)
              </strong>{' '}
              format, a standard in military and intelligence communications.
              The key finding appears first, followed by supporting detail.
            </p>
            <p>A typical report includes these sections:</p>
            <ul className="list-disc list-inside space-y-1 pl-2">
              <li>
                <strong className="text-gray-300">BLUF</strong> — One-paragraph
                executive summary of the key intelligence finding
              </li>
              <li>
                <strong className="text-gray-300">Threat Actor Profile</strong>{' '}
                — Name, aliases, attribution, tooling, first/last seen dates
              </li>
              <li>
                <strong className="text-gray-300">Campaign Overview</strong> —
                Scope, targets, and operational summary
              </li>
              <li>
                <strong className="text-gray-300">TTPs</strong> — Tactics,
                techniques, and procedures with ATT&CK mapping
              </li>
              <li>
                <strong className="text-gray-300">IOCs</strong> — Extracted
                indicators with type classification and context
              </li>
              <li>
                <strong className="text-gray-300">Victimology</strong> —
                Targeted sectors, regions, and organizations
              </li>
              <li>
                <strong className="text-gray-300">Timeline</strong> — Key events
                in chronological order
              </li>
              <li>
                <strong className="text-gray-300">Attribution</strong> —
                Confidence-weighted attribution analysis
              </li>
              <li>
                <strong className="text-gray-300">Remediation</strong> —
                Defensive recommendations and mitigations
              </li>
              <li>
                <strong className="text-gray-300">
                  Endnotes &amp; Bibliography
                </strong>{' '}
                — Chicago NB-style citations
              </li>
            </ul>
            <p>
              Each report is marked with a{' '}
              <strong className="text-gray-300">TLP level</strong> and includes
              confidence assessments for key findings.
            </p>
          </div>
        </section>

        {/* ── ATT&CK Integration ───────────────────────────────────── */}
        <section id="docs-attack-integration" className="glass-panel p-6">
          <h2 className="text-lg font-semibold text-gray-200 mb-3 flex items-center gap-2">
            <span>🎯</span> ATT&CK Integration
          </h2>
          <div className="space-y-3 text-sm text-gray-400 leading-relaxed">
            <p>
              CyberBRIEF maps identified techniques to the{' '}
              <strong className="text-gray-300">
                MITRE ATT&CK Enterprise
              </strong>{' '}
              framework. The integration provides:
            </p>
            <ul className="list-disc list-inside space-y-1.5 pl-2">
              <li>
                <strong className="text-gray-300">Automatic Mapping</strong> —
                Techniques are identified from research content and mapped to
                ATT&CK IDs
              </li>
              <li>
                <strong className="text-gray-300">Interactive Matrix</strong> —
                Full 14-tactic Enterprise matrix with highlighted observed
                techniques
              </li>
              <li>
                <strong className="text-gray-300">Evidence Linking</strong> —
                Each technique includes source quotes that justify the mapping
              </li>
              <li>
                <strong className="text-gray-300">Navigator Export</strong> —
                Download a JSON layer file compatible with the official ATT&CK
                Navigator tool
              </li>
              <li>
                <strong className="text-gray-300">Frequency Tracking</strong> —
                See how often each technique appears across all your reports
              </li>
              <li>
                <strong className="text-gray-300">Technique Search</strong> —
                Look up any technique by ID or name
              </li>
            </ul>
            <p>
              Navigate to the{' '}
              <strong className="text-gray-300">ATT&CK Explorer</strong> page to
              interact with the full matrix.
            </p>
          </div>
        </section>

        {/* ── Keyboard Shortcuts ───────────────────────────────────── */}
        <section id="docs-keyboard-shortcuts" className="glass-panel p-6">
          <h2 className="text-lg font-semibold text-gray-200 mb-3 flex items-center gap-2">
            <span>⌨️</span> Keyboard Shortcuts
          </h2>
          <div className="space-y-3 text-sm text-gray-400 leading-relaxed">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {[
                { keys: 'Enter', action: 'Submit topic (when input is focused)' },
                { keys: 'Esc', action: 'Close tour overlay / dismiss popups' },
              ].map((shortcut) => (
                <div
                  key={shortcut.keys}
                  className="flex items-center gap-3 p-2 rounded-md bg-gray-800/30"
                >
                  <kbd className="px-2 py-0.5 rounded bg-gray-800 text-gray-300 text-xs font-mono border border-gray-700">
                    {shortcut.keys}
                  </kbd>
                  <span className="text-gray-400 text-sm">
                    {shortcut.action}
                  </span>
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-600 mt-2">
              Additional keyboard shortcuts may be added in future releases.
            </p>
          </div>
        </section>

        {/* ── FAQ ──────────────────────────────────────────────────── */}
        <section id="docs-faq" className="glass-panel p-6">
          <h2 className="text-lg font-semibold text-gray-200 mb-3 flex items-center gap-2">
            <span>❓</span> Frequently Asked Questions
          </h2>
          <div className="space-y-4 text-sm text-gray-400 leading-relaxed">
            <FAQItem
              question="Do I need API keys to use CyberBRIEF?"
              answer="The Free tier works with Brave Search and Gemini Flash. If these keys are set via environment variables on the backend, no additional configuration is needed. For Standard and Deep tiers, you'll need a Perplexity API key, which you can add in Settings."
            />
            <FAQItem
              question="Where are my API keys stored?"
              answer="API keys are stored in your browser's localStorage. When used for research, they are sent to the CyberBRIEF backend and then to the respective provider (Brave, Perplexity, Gemini, etc.). The backend is not intended to persist keys server-side, but a hosted operator may access them in transit through normal logging, monitoring, or security boundaries. Self-host CyberBRIEF or avoid entering browser keys if you do not trust the operator."
            />
            <FAQItem
              question="What is the rate limit for Free tier?"
              answer="The Free tier allows 10 queries per day. This limit resets at midnight. You can see your remaining quota on the Home page and in the status bar."
            />
            <FAQItem
              question="Can I export my reports?"
              answer="Yes. From the Report page sidebar, you can export as Markdown or HTML. If the report includes ATT&CK mappings, you can also download a Navigator layer JSON file."
            />
            <FAQItem
              question="What IOC types does CyberBRIEF extract?"
              answer="CyberBRIEF uses regex-based extraction to identify IPv4 and IPv6 addresses, domain names, URLs, MD5/SHA1/SHA256 hashes, and CVE identifiers."
            />
            <FAQItem
              question="How do the 5 variants differ?"
              answer="Each variant provides the same features with a different visual theme. SOC Operator is terminal-inspired, Intelligence Agency is formal, Threat Hunter is tactical, Academic Research is journal-style, and Cyberpunk Analyst is neon-themed."
            />
            <FAQItem
              question="Can I retake the guided tour?"
              answer='Yes — go to Settings and click the "Take Tour" button to restart the onboarding walkthrough.'
            />
          </div>
        </section>
      </div>
    </div>
  );
};

/* ── FAQ Item sub-component ───────────────────────────────────────────── */

const FAQItem: React.FC<{ question: string; answer: string }> = ({
  question,
  answer,
}) => {
  const [open, setOpen] = useState(false);

  return (
    <div className="border border-gray-800 rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-3 text-left hover:bg-gray-800/30 transition-colors"
      >
        <span className="text-gray-200 font-medium">{question}</span>
        <span
          className={`text-gray-500 transition-transform ${
            open ? 'rotate-180' : ''
          }`}
        >
          ▾
        </span>
      </button>
      {open && (
        <div className="px-3 pb-3 text-gray-400 text-sm leading-relaxed border-t border-gray-800/50 pt-2">
          {answer}
        </div>
      )}
    </div>
  );
};
