import { useEffect, useCallback, useRef } from 'react';

/* ── driver.js type shim (loaded via CDN) ─────────────────────────────── */

interface DriverStep {
  element: string;
  popover: {
    title: string;
    description: string;
    side?: 'top' | 'bottom' | 'left' | 'right';
    align?: 'start' | 'center' | 'end';
  };
}

interface DriverConfig {
  showProgress: boolean;
  animate: boolean;
  overlayColor: string;
  stagePadding: number;
  stageRadius: number;
  popoverClass: string;
  showButtons: string[];
  nextBtnText: string;
  prevBtnText: string;
  doneBtnText: string;
  steps: DriverStep[];
  onDestroyStarted?: () => void;
  onDestroyed?: () => void;
}

interface DriverInstance {
  drive: () => void;
  destroy: () => void;
  isActive: () => boolean;
}

interface DriverConstructor {
  new (config: DriverConfig): DriverInstance;
}

declare global {
  interface Window {
    driver?: {
      js: {
        driver: DriverConstructor;
      };
    };
  }
}

/* ── Tour Steps ───────────────────────────────────────────────────────── */

const TOUR_STEPS: DriverStep[] = [
  {
    element: '[data-tour="topic-input"]',
    popover: {
      title: '🔍 Enter a Threat Topic',
      description:
        'Start by typing a cyber threat topic — an APT group, vulnerability, ransomware family, or any threat you want to research. You can also click a suggested topic below.',
      side: 'bottom',
      align: 'center',
    },
  },
  {
    element: '[data-tour="generate-button"]',
    popover: {
      title: '🚀 Generate Your Report',
      description:
        'Click here to launch the research pipeline. CyberBRIEF will search multiple sources, synthesize intelligence, extract IOCs, map ATT&CK techniques, and generate a full BLUF report.',
      side: 'top',
      align: 'center',
    },
  },
  {
    element: '[data-tour="tier-selector"]',
    popover: {
      title: '📊 Choose Research Tier',
      description:
        'Select your research depth: Standard (Perplexity Sonar) for fast, citation-backed research, or Deep Research for comprehensive multi-source analysis with full threat actor profiling.',
      side: 'top',
      align: 'center',
    },
  },
  {
    element: '[data-tour="nav-attack"]',
    popover: {
      title: '🎯 ATT&CK Explorer',
      description:
        'Explore the MITRE ATT&CK matrix. After generating a report, observed techniques are highlighted in the interactive matrix. Click any technique for details.',
      side: 'bottom',
      align: 'center',
    },
  },
  {
    element: '[data-tour="nav-settings"]',
    popover: {
      title: '⚙️ Settings & API Keys',
      description:
        'Configure your API keys (BYOK), default research tier, TLP classification, and report sections. You can also retake this tour from Settings.',
      side: 'bottom',
      align: 'center',
    },
  },
];

/* ── Constants ────────────────────────────────────────────────────────── */

const TOUR_COMPLETE_KEY = 'cyberbrief-tour-complete';

/* ── Hook ─────────────────────────────────────────────────────────────── */

export function useGuidedTour(): { startTour: () => void } {
  const driverRef = useRef<DriverInstance | null>(null);

  const startTour = useCallback(() => {
    const DriverClass = window.driver?.js?.driver;
    if (!DriverClass) {
      console.warn('[GuidedTour] driver.js not loaded via CDN — skipping tour');
      return;
    }

    // Destroy any existing instance
    if (driverRef.current?.isActive()) {
      driverRef.current.destroy();
    }

    const instance = new DriverClass({
      showProgress: true,
      animate: true,
      overlayColor: 'rgba(0, 0, 0, 0.75)',
      stagePadding: 8,
      stageRadius: 8,
      popoverClass: 'cyberbrief-tour-popover',
      showButtons: ['next', 'previous', 'close'],
      nextBtnText: 'Next →',
      prevBtnText: '← Back',
      doneBtnText: 'Done ✓',
      steps: TOUR_STEPS,
      onDestroyStarted: () => {
        localStorage.setItem(TOUR_COMPLETE_KEY, 'true');
        instance.destroy();
      },
      onDestroyed: () => {
        localStorage.setItem(TOUR_COMPLETE_KEY, 'true');
      },
    });

    driverRef.current = instance;
    instance.drive();
  }, []);

  return { startTour };
}

/* ── Auto-start component ─────────────────────────────────────────────── */

export const GuidedTour: React.FC = () => {
  const { startTour } = useGuidedTour();

  useEffect(() => {
    const completed = localStorage.getItem(TOUR_COMPLETE_KEY);
    if (completed) return;

    // Delay to let the page render before highlighting elements
    const timer = setTimeout(() => {
      startTour();
    }, 800);

    return () => clearTimeout(timer);
  }, [startTour]);

  return null;
};

export default GuidedTour;
