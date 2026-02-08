import React, { useEffect } from 'react';
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useNavigate,
  useLocation,
} from 'react-router-dom';
import { VariantPicker } from './pages/VariantPicker';
import { HomePage } from './pages/HomePage';
import { ReportPage } from './pages/ReportPage';
import { AttackPage } from './pages/AttackPage';
import { HistoryPage } from './pages/HistoryPage';
import { SettingsPage } from './pages/SettingsPage';
import { DocsPage } from './pages/DocsPage';
import { Variant1 } from './variants/Variant1';
import { Variant2 } from './variants/Variant2';
import { Variant3 } from './variants/Variant3';
import { Variant4 } from './variants/Variant4';
import { Variant5 } from './variants/Variant5';
import KeyboardHints from './components/shared/KeyboardHints';
import VariantSettings from './components/shared/VariantSettings';
import { useDefaultVariant } from './hooks/useDefaultVariant';

const APP_ID = 'cyberbrief';
const VARIANT_NAMES = [
  'Operations Center',
  'Intelligence Brief',
  'Threat Matrix',
  'Analyst Workbench',
  'Dark Protocol',
];

const VARIANT_SHELLS: Record<string, React.FC> = {
  '1': Variant1,
  '2': Variant2,
  '3': Variant3,
  '4': Variant4,
  '5': Variant5,
};

const variantRoutes = (
  <>
    <Route path="home" element={<HomePage />} />
    <Route path="report/:reportId" element={<ReportPage />} />
    <Route path="attack" element={<AttackPage />} />
    <Route path="history" element={<HistoryPage />} />
    <Route path="settings" element={<SettingsPage />} />
    <Route path="docs" element={<DocsPage />} />
    <Route index element={<Navigate to="home" replace />} />
  </>
);

const isTypingTarget = (t: EventTarget | null): boolean =>
  t instanceof HTMLInputElement ||
  t instanceof HTMLTextAreaElement ||
  t instanceof HTMLSelectElement ||
  (t instanceof HTMLElement && t.isContentEditable);

function VariantKeyboardNav() {
  const navigate = useNavigate();
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target)) return;
      const num = parseInt(e.key);
      if (num >= 1 && num <= 5) navigate(`/${num}/home`);
      else if (e.key === 'Escape' || e.key === '0') navigate('/');
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [navigate]);
  return null;
}

function DefaultVariantRedirect({ defaultVariant }: { defaultVariant: number | null }) {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (location.pathname === '/' && defaultVariant) {
      navigate(`/${defaultVariant}/home`, { replace: true });
    }
  }, [location.pathname, defaultVariant, navigate]);

  return null;
}

function AppContent() {
  const location = useLocation();
  const { defaultVariant, setDefaultVariant } = useDefaultVariant(APP_ID);
  const variantMatch = location.pathname.match(/^\/([1-5])/);
  const currentVariant = variantMatch ? parseInt(variantMatch[1], 10) : null;

  return (
    <>
      <VariantKeyboardNav />
      <DefaultVariantRedirect defaultVariant={defaultVariant} />
      <KeyboardHints />
      <VariantSettings
        currentVariant={currentVariant}
        defaultVariant={defaultVariant}
        onSetDefault={setDefaultVariant}
        variantNames={VARIANT_NAMES}
      />
      <Routes>
        {/* Root — Variant Picker */}
        <Route path="/" element={<VariantPicker />} />

        {/* Variant Shells */}
        {Object.entries(VARIANT_SHELLS).map(([id, Shell]) => (
          <Route key={id} path={`/${id}`} element={<Shell />}>
            {variantRoutes}
          </Route>
        ))}

        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}

const App: React.FC = () => {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  );
};

export default App;
