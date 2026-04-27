import React from 'react';
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
} from 'react-router-dom';
import { HomePage } from './pages/HomePage';
import { ReportPage } from './pages/ReportPage';
import { AttackPage } from './pages/AttackPage';
import { HistoryPage } from './pages/HistoryPage';
import { SettingsPage } from './pages/SettingsPage';
import { DocsPage } from './pages/DocsPage';
import { Variant3 } from './variants/Variant3';

function AppContent() {
  return (
    <Routes>
      {/* Variant 3 (Threat Hunter) is the default and only public variant */}
      <Route path="/" element={<Variant3 />}>
        <Route path="home" element={<HomePage />} />
        <Route path="report/:reportId" element={<ReportPage />} />
        <Route path="attack" element={<AttackPage />} />
        <Route path="history" element={<HistoryPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="docs" element={<DocsPage />} />
        <Route index element={<Navigate to="home" replace />} />
      </Route>

      {/* Legacy variant routes redirect to root */}
      <Route path="/1/*" element={<Navigate to="/" replace />} />
      <Route path="/2/*" element={<Navigate to="/" replace />} />
      <Route path="/3/*" element={<Navigate to="/" replace />} />
      <Route path="/4/*" element={<Navigate to="/" replace />} />
      <Route path="/5/*" element={<Navigate to="/" replace />} />

      {/* Catch-all */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function GitHubFooter() {
  return (
    <a
      href="https://github.com/solomonneas/cyberbrief"
      target="_blank"
      rel="noopener noreferrer"
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6,
        maxWidth: 1368, margin: '0 auto', padding: '0 28px 16px',
        fontSize: 11, color: '#888', textDecoration: 'none',
        opacity: 0.4, transition: 'opacity 0.2s',
      }}
      onMouseEnter={e => (e.currentTarget.style.opacity = '0.8')}
      onMouseLeave={e => (e.currentTarget.style.opacity = '0.4')}
    >
      <svg viewBox="0 0 16 16" fill="currentColor" width="16" height="16"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/></svg>
      Solomon Neas
    </a>
  );
}

const App: React.FC = () => {
  return (
    <BrowserRouter>
      <AppContent />
      <GitHubFooter />
    </BrowserRouter>
  );
};

export default App;
