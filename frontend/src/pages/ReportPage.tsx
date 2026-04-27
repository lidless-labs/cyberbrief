import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useReportStore } from '../stores/reportStore';
import { apiClient } from '../api/client';
import type { TLPLevel, AttackTechnique, ConfidenceLevel } from '../types';

const TLP_BANNERS: Record<TLPLevel, string> = {
  'TLP:CLEAR': 'TLP:CLEAR - Disclosure is not limited.',
  'TLP:GREEN': 'TLP:GREEN - Limited disclosure, community only.',
  'TLP:AMBER': 'TLP:AMBER - Limited disclosure, restricted to participants organizations.',
  'TLP:AMBER+STRICT': 'TLP:AMBER+STRICT - Limited disclosure, restricted to participants only.',
  'TLP:RED': 'TLP:RED - Not for disclosure. Restricted to participants only.',
};

const TLP_TONES: Record<TLPLevel, string> = {
  'TLP:CLEAR': 'report-tone-clear',
  'TLP:GREEN': 'report-tone-green',
  'TLP:AMBER': 'report-tone-amber',
  'TLP:AMBER+STRICT': 'report-tone-amber',
  'TLP:RED': 'report-tone-red',
};

const CONFIDENCE_TONES: Record<ConfidenceLevel, string> = {
  Low: 'report-tone-red',
  Moderate: 'report-tone-amber',
  High: 'report-tone-green',
};

/** Ordered list of ATT&CK tactics for the mini matrix */
const TACTIC_ORDER = [
  'Reconnaissance',
  'Resource Development',
  'Initial Access',
  'Execution',
  'Persistence',
  'Privilege Escalation',
  'Defense Evasion',
  'Credential Access',
  'Discovery',
  'Lateral Movement',
  'Collection',
  'Command and Control',
  'Exfiltration',
  'Impact',
];

const TACTIC_COLORS: Record<string, string> = {
  'Reconnaissance': '#6baed6',
  'Resource Development': '#74c476',
  'Initial Access': '#e6550d',
  'Execution': '#fd8d3c',
  'Persistence': '#fdae6b',
  'Privilege Escalation': '#fdd0a2',
  'Defense Evasion': '#c6dbef',
  'Credential Access': '#e7969c',
  'Discovery': '#9ecae1',
  'Lateral Movement': '#a1d99b',
  'Collection': '#bcbddc',
  'Command and Control': '#d9d9d9',
  'Exfiltration': '#ff9896',
  'Impact': '#e60d0d',
};

/**
 * Inject clickable footnote superscripts into section content.
 */
function renderContentWithFootnotes(content: string, citations: string[]): React.ReactNode {
  if (!citations.length) {
    return <span className="whitespace-pre-wrap">{content}</span>;
  }

  const pattern = /\[(\d+)\]/g;
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(content)) !== null) {
    if (match.index > lastIndex) {
      parts.push(content.slice(lastIndex, match.index));
    }
    const noteNum = match[1];
    parts.push(
      <a
        key={`fn-${match.index}`}
        href={`#endnote-${noteNum}`}
        className="text-cyber-400 hover:text-cyber-300 text-[10px] align-super no-underline hover:underline"
        title={`See endnote ${noteNum}`}
      >
        [{noteNum}]
      </a>
    );
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < content.length) {
    parts.push(content.slice(lastIndex));
  }

  return <span className="whitespace-pre-wrap">{parts}</span>;
}

/** Build a MITRE ATT&CK URL from technique ID */
function attackUrl(techniqueId: string): string {
  return `https://attack.mitre.org/techniques/${techniqueId.replace('.', '/')}`;
}

/** Group techniques by tactic for the mini matrix */
function groupByTactic(techniques: AttackTechnique[]): Record<string, AttackTechnique[]> {
  const groups: Record<string, AttackTechnique[]> = {};
  for (const tech of techniques) {
    const tactic = tech.tactic;
    if (!groups[tactic]) groups[tactic] = [];
    groups[tactic].push(tech);
  }
  return groups;
}

export const ReportPage: React.FC = () => {
  const { reportId, variant } = useParams<{ reportId: string; variant: string }>();
  const navigate = useNavigate();
  const currentReport = useReportStore((s) => s.currentReport);
  const getReportById = useReportStore((s) => s.getReportById);
  const [activeSectionId, setActiveSectionId] = useState<string>('bluf');
  const [exporting, setExporting] = useState(false);
  const [exportingHtml, setExportingHtml] = useState(false);
  const [downloadingNav, setDownloadingNav] = useState(false);
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});

  const report =
    reportId && reportId !== 'latest'
      ? getReportById(reportId) ?? currentReport
      : currentReport;

  // Scrollspy
  useEffect(() => {
    if (!report) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveSectionId(entry.target.id);
          }
        }
      },
      { rootMargin: '-80px 0px -60% 0px', threshold: 0.1 }
    );

    Object.values(sectionRefs.current).forEach((el) => {
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [report]);

  const scrollToSection = useCallback((id: string) => {
    const el = sectionRefs.current[id] || document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, []);

  // Export handlers
  const handleExportMarkdown = useCallback(async () => {
    if (!report) return;
    setExporting(true);
    try {
      const md = await apiClient.exportMarkdown(report);
      const text = typeof md === 'string' ? md : JSON.stringify(md);
      const blob = new Blob([text], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${report.topic.replace(/[^a-zA-Z0-9]/g, '_')}_report.md`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Markdown export failed:', err);
    } finally {
      setExporting(false);
    }
  }, [report]);

  const handleExportHtml = useCallback(async () => {
    if (!report) return;
    setExportingHtml(true);
    try {
      const htmlContent = await apiClient.exportHtml(report);
      const text = typeof htmlContent === 'string' ? htmlContent : JSON.stringify(htmlContent);
      const blob = new Blob([text], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${report.topic.replace(/[^a-zA-Z0-9]/g, '_')}_report.html`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('HTML export failed:', err);
    } finally {
      setExportingHtml(false);
    }
  }, [report]);

  const handleDownloadNavigator = useCallback(async () => {
    if (!report || !report.attackMapping.length) return;
    setDownloadingNav(true);
    try {
      const layer = await apiClient.generateNavigatorLayer(report.attackMapping);
      const json = JSON.stringify(layer, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${report.topic.replace(/[^a-zA-Z0-9]/g, '_')}_navigator.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Navigator layer download failed:', err);
    } finally {
      setDownloadingNav(false);
    }
  }, [report]);

  // Build TOC entries
  const tocEntries: { id: string; title: string }[] = [];
  if (report) {
    tocEntries.push({ id: 'bluf', title: 'BLUF' });
    if (report.threatActor) {
      tocEntries.push({ id: 'threat-actor-profile', title: 'Threat Actor' });
    }
    report.sections.forEach((s) => {
      tocEntries.push({ id: s.id, title: s.title });
    });
    if (report.iocs.length > 0) {
      tocEntries.push({ id: 'iocs-table', title: 'IOCs' });
    }
    if (report.attackMapping.length > 0) {
      tocEntries.push({ id: 'attack-mapping', title: 'ATT&CK Mapping' });
      tocEntries.push({ id: 'attack-matrix', title: 'ATT&CK Matrix' });
    }
    if (report.confidenceAssessments.length > 0) {
      tocEntries.push({ id: 'confidence', title: 'Confidence' });
    }
    tocEntries.push({ id: 'endnotes', title: 'Endnotes' });
    tocEntries.push({ id: 'bibliography', title: 'Bibliography' });
  }

  // No report state
  if (!report) {
    return (
      <div className="mx-auto max-w-4xl py-12">
        <div className="desk-card p-10 text-center">
          <p className="desk-kicker mb-5 justify-center"><span /> Report desk</p>
          <h1 className="text-4xl">No report selected</h1>
          <p className="mx-auto mt-4 max-w-xl leading-7" style={{ color: 'var(--desk-muted)' }}>
            Generate a brief from the briefing desk to review BLUF findings, source provenance, indicators, ATT&CK mapping, and export-ready notes.
          </p>
          <button
            onClick={() => navigate('/home')}
            className="mt-8 rounded-2xl px-5 py-3 font-bold text-white"
            style={{ background: 'linear-gradient(135deg, var(--desk-accent), var(--desk-blue))' }}
          >
            Start a briefing
          </button>
        </div>
      </div>
    );
  }

  const tacticGroups = groupByTactic(report.attackMapping);
  const generatedAt = new Date(report.createdAt);
  const sourceCount = report.sources.length;
  const iocCount = report.iocs.length;
  const techniqueCount = report.attackMapping.length;
  const highConfidence = report.confidenceAssessments.filter((item) => item.confidence === 'High').length;

  return (
    <div className="report-desk grid gap-5 py-6 xl:grid-cols-[230px_minmax(0,1fr)_300px]">
      <aside className="hidden xl:block">
        <nav className="desk-card sticky top-36 p-4">
          <p className="desk-label mb-4">Report outline</p>
          {tocEntries.map((entry) => (
            <button
              key={entry.id}
              onClick={() => scrollToSection(entry.id)}
              className={`report-toc-button ${activeSectionId === entry.id ? 'is-active' : ''}`}
            >
              {entry.title}
            </button>
          ))}
        </nav>
      </aside>

      <main className="min-w-0">
        <article className="desk-card overflow-hidden">
          <header className="p-6 md:p-8 lg:p-10">
            <div className="mb-7 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
                <p className="desk-kicker mb-4"><span /> Intelligence product</p>
                <h1 className="max-w-4xl text-4xl leading-tight md:text-5xl">
                {report.topic}
              </h1>
                <p className="mt-4 text-sm" style={{ color: 'var(--desk-muted)' }}>
                  Generated {generatedAt.toLocaleString()} | {report.tier} research | ID {report.id}
              </p>
            </div>
              <span className={`report-badge ${TLP_TONES[report.tlp]}`}>
              {report.tlp}
            </span>
          </div>

            <div className="report-meta-grid mb-7">
              <div className="report-meta-cell">
                <span>Sources</span>
                <strong>{sourceCount}</strong>
              </div>
              <div className="report-meta-cell">
                <span>Indicators</span>
                <strong>{iocCount}</strong>
              </div>
              <div className="report-meta-cell">
                <span>ATT&CK Techniques</span>
                <strong>{techniqueCount}</strong>
              </div>
              <div className="report-meta-cell">
                <span>High Confidence</span>
                <strong>{highConfidence}</strong>
              </div>
            </div>

            <div className={`report-tlp-strip ${TLP_TONES[report.tlp]}`}>
              {TLP_BANNERS[report.tlp]}
            </div>

          <div
            id="bluf"
            ref={(el) => { sectionRefs.current['bluf'] = el; }}
              className="report-bluf mt-6"
          >
              <p className="desk-label mb-3">BLUF - Bottom Line Up Front</p>
              <p>{report.bluf}</p>
          </div>
          </header>
        </article>

        {report.threatActor && (
          <section
            id="threat-actor-profile"
            ref={(el) => { sectionRefs.current['threat-actor-profile'] = el; }}
            className="desk-card mt-5 p-6 md:p-7"
          >
            <p className="desk-kicker mb-5"><span /> Actor profile</p>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="report-fact">
                <span>Name</span>
                <strong>{report.threatActor.name}</strong>
              </div>
              <div className="report-fact">
                <span>Attribution</span>
                <strong>{report.threatActor.attribution}</strong>
              </div>
              {report.threatActor.aliases.length > 0 && (
                <div className="report-fact md:col-span-2">
                  <span>Aliases</span>
                  <strong>{report.threatActor.aliases.join(', ')}</strong>
                </div>
              )}
              {report.threatActor.firstSeen && (
                <div className="report-fact">
                  <span>First seen</span>
                  <strong>{report.threatActor.firstSeen}</strong>
                </div>
              )}
              {report.threatActor.lastActive && (
                <div className="report-fact">
                  <span>Last active</span>
                  <strong>{report.threatActor.lastActive}</strong>
                </div>
              )}
              {report.threatActor.tooling.length > 0 && (
                <div className="report-fact md:col-span-2">
                  <span>Tooling</span>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {report.threatActor.tooling.map((tool) => (
                      <span key={tool} className="report-chip">
                        {tool}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </section>
        )}

        {report.sections.map((section) => (
          <section
            key={section.id}
            id={section.id}
            ref={(el) => { sectionRefs.current[section.id] = el; }}
            className="desk-card report-section-card mt-5 p-6 md:p-7"
          >
            <p className="desk-kicker mb-4"><span /> Briefing section</p>
            <h2 className="text-3xl">{section.title}</h2>
            <div className="report-prose mt-4">
              {renderContentWithFootnotes(section.content, section.citations)}
            </div>
          </section>
        ))}

        {report.iocs.length > 0 && (
          <section
            id="iocs-table"
            ref={(el) => { sectionRefs.current['iocs-table'] = el; }}
            className="desk-card mt-5 overflow-hidden"
          >
            <div className="border-b p-6" style={{ borderColor: 'var(--desk-border)' }}>
              <p className="desk-kicker mb-3"><span /> Indicators</p>
              <h2 className="text-3xl">Indicators of compromise</h2>
            </div>
            <div className="overflow-x-auto p-1">
              <table className="report-table">
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>Value</th>
                    <th>Context</th>
                  </tr>
                </thead>
                <tbody>
                  {report.iocs.map((ioc, i) => (
                    <tr key={`${ioc.type}-${ioc.value}-${i}`}>
                      <td>
                        <span className="report-chip">{ioc.type}</span>
                      </td>
                      <td className="break-all font-mono text-xs" style={{ color: 'var(--desk-accent)' }}>
                        {ioc.value}
                      </td>
                      <td style={{ color: 'var(--desk-muted)' }}>
                        {ioc.context ?? 'No context'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {report.attackMapping.length > 0 && (
          <section
            id="attack-mapping"
            ref={(el) => { sectionRefs.current['attack-mapping'] = el; }}
            className="desk-card mt-5 overflow-hidden"
          >
            <div className="flex flex-col gap-4 border-b p-6 md:flex-row md:items-center md:justify-between" style={{ borderColor: 'var(--desk-border)' }}>
              <div>
                <p className="desk-kicker mb-3"><span /> Technique mapping</p>
                <h2 className="text-3xl">
                  MITRE ATT&CK mapping
              </h2>
              </div>
              <button
                onClick={handleDownloadNavigator}
                disabled={downloadingNav}
                className="report-action-button"
              >
                {downloadingNav ? 'Generating...' : 'Navigator layer'}
              </button>
            </div>
            <div className="overflow-x-auto p-1">
              <table className="report-table">
                <thead>
                  <tr>
                    <th>Technique ID</th>
                    <th>Name</th>
                    <th>Tactic</th>
                    <th>Evidence</th>
                  </tr>
                </thead>
                <tbody>
                  {report.attackMapping.map((tech) => (
                    <tr key={tech.techniqueId}>
                      <td>
                        <a
                          href={attackUrl(tech.techniqueId)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-mono text-xs font-bold hover:underline"
                          style={{ color: 'var(--desk-accent)' }}
                        >
                          {tech.techniqueId}
                        </a>
                      </td>
                      <td className="font-semibold">
                        {tech.name}
                      </td>
                      <td>
                        <span className="report-chip">{tech.tactic}</span>
                      </td>
                      <td>
                        {tech.evidence.length > 0 ? (
                          <div className="space-y-1">
                            {tech.evidence.slice(0, 2).map((ev, i) => (
                              <div key={i} className="border-l-2 pl-3" style={{ borderColor: 'rgba(155,47,66,0.32)' }}>
                                <p className="text-xs italic leading-relaxed" style={{ color: 'var(--desk-muted)' }}>
                                  "{ev.quote.length > 120 ? ev.quote.slice(0, 120) + '...' : ev.quote}"
                                </p>
                                <p className="text-[10px]" style={{ color: '#7a6c62' }}>{ev.source}</p>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <span className="text-xs italic" style={{ color: 'var(--desk-muted)' }}>
                            {tech.description.length > 80 ? tech.description.slice(0, 80) + '...' : tech.description}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {report.attackMapping.length > 0 && (
          <section
            id="attack-matrix"
            ref={(el) => { sectionRefs.current['attack-matrix'] = el; }}
            className="desk-card mt-5 p-6"
          >
            <p className="desk-kicker mb-3"><span /> Matrix view</p>
            <h2 className="mb-5 text-3xl">ATT&CK matrix view</h2>
            <div className="overflow-x-auto">
              <div
                className="grid gap-1"
                style={{
                  gridTemplateColumns: `repeat(${TACTIC_ORDER.length}, minmax(80px, 1fr))`,
                  minWidth: `${TACTIC_ORDER.length * 90}px`,
                }}
              >
                {/* Tactic Headers */}
                {TACTIC_ORDER.map((tactic) => (
                  <div
                    key={`header-${tactic}`}
                    className="border-b pb-2 text-center text-[9px] font-bold uppercase tracking-wider"
                    style={{ borderColor: 'var(--desk-border)', color: 'var(--desk-muted)' }}
                    title={tactic}
                  >
                    {tactic.length > 12 ? tactic.split(' ').map(w => w[0]).join('') : tactic}
                  </div>
                ))}

                {/* Technique Cells */}
                {TACTIC_ORDER.map((tactic) => {
                  const techs = tacticGroups[tactic] ?? [];
                  return (
                    <div key={`col-${tactic}`} className="flex flex-col gap-1 pt-1">
                      {techs.length > 0 ? (
                        techs.map((tech) => (
                          <a
                            key={tech.techniqueId}
                            href={attackUrl(tech.techniqueId)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block rounded px-1.5 py-1 text-center font-mono text-[9px] transition-all hover:scale-105 hover:shadow-lg"
                            style={{
                              backgroundColor: `${TACTIC_COLORS[tactic] ?? '#e60d0d'}33`,
                              color: TACTIC_COLORS[tactic] ?? '#e60d0d',
                              border: `1px solid ${TACTIC_COLORS[tactic] ?? '#e60d0d'}55`,
                            }}
                            title={`${tech.techniqueId}: ${tech.name}`}
                          >
                            {tech.techniqueId}
                          </a>
                        ))
                      ) : (
                        <div className="h-6" />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </section>
        )}

        {report.confidenceAssessments.length > 0 && (
          <section
            id="confidence"
            ref={(el) => { sectionRefs.current['confidence'] = el; }}
            className="desk-card mt-5 p-6"
          >
            <p className="desk-kicker mb-3"><span /> Analytic confidence</p>
            <h2 className="mb-5 text-3xl">Confidence assessments</h2>
            <div className="grid gap-3">
              {report.confidenceAssessments.map((assessment, i) => (
                <div key={i} className="report-confidence">
                  <span className={`report-badge ${CONFIDENCE_TONES[assessment.confidence]}`}>
                      {assessment.confidence}
                    </span>
                    <div>
                    <p className="font-semibold">
                        {assessment.finding}
                      </p>
                    <p className="mt-1 text-sm" style={{ color: 'var(--desk-muted)' }}>
                        {assessment.rationale}
                      </p>
                    </div>
                  </div>
              ))}
            </div>
          </section>
        )}

        <section
          id="endnotes"
          ref={(el) => { sectionRefs.current['endnotes'] = el; }}
          className="desk-card mt-5 p-6"
        >
          <p className="desk-kicker mb-3"><span /> Source notes</p>
          <h2 className="mb-5 text-3xl">Endnotes</h2>
          {report.sources.length > 0 ? (
            <ol className="space-y-3">
              {report.sources.map((source, i) => (
                <li
                  key={i}
                  id={`endnote-${i + 1}`}
                  className="grid gap-2 text-sm md:grid-cols-[42px_minmax(0,1fr)]"
                >
                  <span className="report-chip self-start">{i + 1}</span>
                  <span>
                  <a
                    href={source.url}
                    target="_blank"
                    rel="noopener noreferrer"
                      className="font-semibold hover:underline"
                      style={{ color: 'var(--desk-accent)' }}
                  >
                    {source.title}
                  </a>
                    <span className="ml-1 text-xs" style={{ color: 'var(--desk-muted)' }}>
                      accessed {new Date(source.accessedAt).toLocaleDateString()},
                  </span>
                  <a
                    href={source.url}
                    target="_blank"
                    rel="noopener noreferrer"
                      className="ml-1 break-all text-xs hover:underline"
                      style={{ color: 'var(--desk-muted)' }}
                  >
                    {source.url}
                  </a>
                  </span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-sm" style={{ color: 'var(--desk-muted)' }}>No sources to cite.</p>
          )}
        </section>

        <section
          id="bibliography"
          ref={(el) => { sectionRefs.current['bibliography'] = el; }}
          className="desk-card mt-5 p-6"
        >
          <p className="desk-kicker mb-3"><span /> Bibliography</p>
          <h2 className="mb-5 text-3xl">Bibliography</h2>
          {report.sources.length > 0 ? (
            <div className="space-y-3">
              {[...report.sources]
                .sort((a, b) => a.title.localeCompare(b.title))
                .map((source, i) => (
                  <div key={i} className="text-sm leading-7" style={{ color: 'var(--desk-muted)' }}>
                    "{source.title}."{' '}
                    <span>
                      Accessed{' '}
                      {new Date(source.accessedAt).toLocaleDateString('en-US', {
                        month: 'long',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                      .
                    </span>{' '}
                    <a
                      href={source.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="break-all hover:underline"
                      style={{ color: 'var(--desk-accent)' }}
                    >
                      {source.url}
                    </a>
                    .
                  </div>
                ))}
            </div>
          ) : (
            <p className="text-sm" style={{ color: 'var(--desk-muted)' }}>No sources.</p>
          )}
        </section>
      </main>

      <aside>
        <div className="desk-card sticky top-36 p-5">
          <p className="desk-label mb-4">Export packet</p>
          <div className="grid gap-2">
            <button onClick={handleExportMarkdown} disabled={exporting} className="report-action-button">
              {exporting ? 'Exporting...' : 'Export Markdown'}
            </button>
            <button onClick={handleExportHtml} disabled={exportingHtml} className="report-action-button">
              {exportingHtml ? 'Exporting...' : 'Export HTML'}
            </button>
            {report.attackMapping.length > 0 && (
              <button onClick={handleDownloadNavigator} disabled={downloadingNav} className="report-action-button">
                {downloadingNav ? 'Generating...' : 'Navigator JSON'}
              </button>
            )}
          </div>

          <div className="my-5 h-px" style={{ backgroundColor: 'var(--desk-border)' }} />

          <p className="desk-label mb-3">Source posture</p>
          <div className="space-y-2">
            <div className="report-side-stat"><span>Primary sources</span><strong>{sourceCount}</strong></div>
            <div className="report-side-stat"><span>IOC rows</span><strong>{iocCount}</strong></div>
            <div className="report-side-stat"><span>ATT&CK coverage</span><strong>{techniqueCount}</strong></div>
          </div>

          {report.sources.length > 0 && (
            <>
              <div className="my-5 h-px" style={{ backgroundColor: 'var(--desk-border)' }} />
              <p className="desk-label mb-3">Top references</p>
              <div className="space-y-3">
                {report.sources.slice(0, 4).map((source) => (
                  <a key={source.url} href={source.url} target="_blank" rel="noopener noreferrer" className="block rounded-2xl border p-3 text-sm hover:bg-white/40" style={{ borderColor: 'var(--desk-border)' }}>
                    <span className="line-clamp-2 font-semibold">{source.title}</span>
                    <span className="mt-1 block truncate text-xs" style={{ color: 'var(--desk-muted)' }}>{source.url}</span>
                  </a>
                ))}
              </div>
            </>
          )}
        </div>
      </aside>
    </div>
  );
};
