import React from 'react';
import { Outlet, NavLink, useLocation } from 'react-router-dom';
import { ThemeProvider } from '../context/ThemeContext';
import { useSettingsStore } from '../stores/settingsStore';
import { useResearchStore } from '../stores/researchStore';

const NAV_ITEMS = [
  { path: 'home', label: 'Briefing', tourId: '' },
  { path: 'report/latest', label: 'Latest Report', tourId: '' },
  { path: 'attack', label: 'ATT&CK Map', tourId: 'nav-attack' },
  { path: 'history', label: 'Report Stream', tourId: '' },
  { path: 'settings', label: 'BLUF Builder', tourId: 'nav-settings' },
  { path: 'docs', label: 'Field Notes', tourId: '' },
];

const theme = { id: '3', name: 'Intelligence Desk', className: 'variant-hunter' };

export const Variant3: React.FC = () => {
  const location = useLocation();
  const tier = useSettingsStore((s) => s.defaultTier);
  const rateLimit = useResearchStore((s) => s.rateLimit);
  const today = new Date().toISOString().split('T')[0];

  return (
    <ThemeProvider theme={theme}>
      <div className="variant-hunter min-h-screen" style={{
        '--desk-bg': '#eee9dd',
        '--desk-surface': '#fbf8f1',
        '--desk-ink': '#17202b',
        '--desk-muted': '#516173',
        '--desk-border': '#d6cec0',
        '--desk-hairline': '#c6beb1',
        '--desk-accent': '#9b2f42',
        '--desk-accent-dark': '#6d1f2e',
        '--desk-blue': '#17384f',
        '--desk-green': '#567866',
      } as React.CSSProperties}>

        <header className="sticky top-0 z-50 px-4 pt-4 lg:px-7" style={{ background: 'linear-gradient(180deg, rgba(238,233,221,0.98), rgba(238,233,221,0.86))', backdropFilter: 'blur(16px)' }}>
          <nav className="mx-auto flex max-w-[1368px] flex-col gap-4 rounded-[22px] border px-4 py-3 shadow-sm md:flex-row md:items-center md:justify-between md:px-5" style={{ backgroundColor: 'rgba(251,248,241,0.92)', borderColor: 'var(--desk-border)' }}>
            <NavLink to="/home" className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl text-sm font-black tracking-wide text-white" style={{ backgroundColor: 'var(--desk-accent)' }}>
              CB
              </div>
              <div>
                <div className="text-sm font-black uppercase tracking-[0.18em]" style={{ color: 'var(--desk-ink)' }}>
                CyberBRIEF
                </div>
                <div className="text-xs" style={{ color: 'var(--desk-muted)' }}>
                  Threat intelligence desk
                </div>
              </div>
            </NavLink>

            <div className="flex flex-wrap items-center justify-center gap-1">
            {NAV_ITEMS.map((item) => {
              const isActive = location.pathname.startsWith(`/${item.path.split('/')[0]}`);
              return (
                <NavLink
                  key={item.path}
                  to={`/${item.path}`}
                    className="rounded-full px-4 py-2 text-sm transition-all"
                  style={{
                      color: isActive ? 'var(--desk-blue)' : 'var(--desk-muted)',
                      backgroundColor: isActive ? '#e5e2da' : 'transparent',
                  }}
                >
                  {item.label}
                </NavLink>
              );
            })}
            </div>

            <div className="inline-flex items-center gap-2 self-start rounded-full border px-3 py-2 text-sm md:self-auto" style={{ color: 'var(--desk-green)', borderColor: 'var(--desk-border)', backgroundColor: 'rgba(255,255,255,0.56)' }}>
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: 'var(--desk-green)' }} />
              Ops active, sources current
            </div>
          </nav>

          <div className="mx-auto mt-4 grid max-w-[1368px] grid-cols-2 overflow-hidden rounded-2xl border text-[10px] font-bold uppercase tracking-[0.14em] md:grid-cols-5" style={{ borderColor: 'var(--desk-hairline)', color: 'var(--desk-muted)', backgroundColor: 'rgba(251,248,241,0.78)' }}>
            <div className="flex min-w-0 flex-col gap-1 border-r px-3 py-3 xl:flex-row xl:items-center xl:justify-between" style={{ borderColor: 'var(--desk-hairline)' }}><span>Edition</span><span style={{ color: 'var(--desk-accent-dark)' }}>{today}</span></div>
            <div className="flex min-w-0 flex-col gap-1 border-r px-3 py-3 xl:flex-row xl:items-center xl:justify-between" style={{ borderColor: 'var(--desk-hairline)' }}><span>Classification</span><span style={{ color: 'var(--desk-accent-dark)' }}>Restricted</span></div>
            <div className="flex min-w-0 flex-col gap-1 border-r px-3 py-3 xl:flex-row xl:items-center xl:justify-between" style={{ borderColor: 'var(--desk-hairline)' }}><span>Research Mode</span><span style={{ color: 'var(--desk-accent-dark)' }}>{tier}</span></div>
            <div className="flex min-w-0 flex-col gap-1 border-r px-3 py-3 xl:flex-row xl:items-center xl:justify-between" style={{ borderColor: 'var(--desk-hairline)' }}><span>Scan Budget</span><span style={{ color: 'var(--desk-accent-dark)' }}>{rateLimit.remaining} of {rateLimit.limit}</span></div>
            <div className="flex min-w-0 flex-col gap-1 px-3 py-3 xl:flex-row xl:items-center xl:justify-between"><span>Status</span><span style={{ color: 'var(--desk-green)' }}>Active</span></div>
          </div>
        </header>

        <main className="min-h-screen px-4 pb-10 pt-5 lg:px-7" style={{ color: 'var(--desk-ink)' }}>
          <div className="mx-auto max-w-[1368px]">
            <Outlet />
          </div>
        </main>
      </div>

      <style>{`
        .variant-hunter {
          background:
            radial-gradient(circle at 13% 15%, rgba(155, 47, 66, 0.08), transparent 28rem),
            radial-gradient(circle at 80% 18%, rgba(23, 56, 79, 0.08), transparent 30rem),
            var(--desk-bg);
          font-family: Inter, ui-sans-serif, system-ui, sans-serif;
        }
        .variant-hunter h1, .variant-hunter h2, .variant-hunter h3 {
          font-family: Georgia, 'Times New Roman', serif;
          font-weight: 500;
          letter-spacing: 0;
          color: var(--desk-ink);
        }
        .variant-hunter .glass-panel {
          background: rgba(251, 248, 241, 0.9);
          border: 1px solid var(--desk-border);
          border-radius: 18px;
          box-shadow: 0 18px 50px rgba(53, 46, 36, 0.08);
        }
        .variant-hunter .glass-panel:hover {
          border-color: var(--desk-hairline);
        }
        .variant-hunter .cyber-glow {
          box-shadow: 0 18px 42px rgba(155, 47, 66, 0.2);
        }
        .variant-hunter input[type="text"],
        .variant-hunter input[type="password"],
        .variant-hunter textarea,
        .variant-hunter select {
          background: rgba(255, 255, 255, 0.54) !important;
          border-color: var(--desk-border) !important;
          color: var(--desk-ink) !important;
        }
        .variant-hunter input[type="text"]:focus,
        .variant-hunter input[type="password"]:focus,
        .variant-hunter textarea:focus {
          border-color: rgba(155, 47, 66, 0.48) !important;
          box-shadow: 0 0 0 3px rgba(155, 47, 66, 0.12) !important;
        }
        .variant-hunter .text-cyber-400,
        .variant-hunter .text-cyber-500 {
          color: var(--desk-accent) !important;
        }
        .variant-hunter .bg-cyber-500 {
          background-color: var(--desk-accent) !important;
          color: #ffffff !important;
        }
        .variant-hunter .bg-cyber-500:hover {
          background-color: var(--desk-accent-dark) !important;
        }
        .variant-hunter .bg-cyber-500\\/10,
        .variant-hunter .bg-cyber-500\\/20 {
          background-color: rgba(155, 47, 66, 0.1) !important;
        }
        .variant-hunter .border-cyber-500,
        .variant-hunter .border-cyber-500\\/30 {
          border-color: rgba(155, 47, 66, 0.3) !important;
        }
        .variant-hunter .ring-cyber-500\\/50 {
          --tw-ring-color: rgba(155, 47, 66, 0.5) !important;
        }
        .variant-hunter .text-gray-100,
        .variant-hunter .text-gray-200,
        .variant-hunter .text-gray-300 {
          color: var(--desk-ink) !important;
        }
        .variant-hunter .text-gray-400,
        .variant-hunter .text-gray-500,
        .variant-hunter .text-gray-600 {
          color: var(--desk-muted) !important;
        }
        .variant-hunter .bg-gray-900\\/30,
        .variant-hunter .bg-gray-900\\/50,
        .variant-hunter .bg-gray-800\\/30,
        .variant-hunter .bg-gray-800\\/50,
        .variant-hunter .bg-gray-800 {
          background-color: rgba(255, 255, 255, 0.44) !important;
        }
        .variant-hunter .border-gray-700,
        .variant-hunter .border-gray-800,
        .variant-hunter .divide-gray-800\\/50 > :not([hidden]) ~ :not([hidden]) {
          border-color: var(--desk-border) !important;
        }
        @media (max-width: 640px) {
          .variant-hunter header {
            position: static;
          }
        }
      `}</style>
    </ThemeProvider>
  );
};
