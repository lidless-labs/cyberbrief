// ─── Research Tiers ──────────────────────────────────────────────────────────

export type ResearchTier = 'FREE' | 'STANDARD' | 'DEEP';

// ─── Traffic Light Protocol ──────────────────────────────────────────────────

export type TLPLevel =
  | 'TLP:CLEAR'
  | 'TLP:GREEN'
  | 'TLP:AMBER'
  | 'TLP:AMBER+STRICT'
  | 'TLP:RED';

// ─── Confidence ──────────────────────────────────────────────────────────────

export type ConfidenceLevel = 'Low' | 'Moderate' | 'High';

// ─── Indicators of Compromise ────────────────────────────────────────────────

export type IOCType =
  | 'ipv4'
  | 'ipv6'
  | 'domain'
  | 'url'
  | 'md5'
  | 'sha1'
  | 'sha256'
  | 'cve';

export interface IOC {
  type: IOCType;
  value: string;
  context?: string;
  sources: string[];
}

// ─── MITRE ATT&CK ───────────────────────────────────────────────────────────

export interface AttackTechnique {
  techniqueId: string;
  name: string;
  tactic: string;
  description: string;
  evidence: {
    quote: string;
    source: string;
  }[];
}

// ─── Threat Actor ────────────────────────────────────────────────────────────

export interface ThreatActorProfile {
  name: string;
  aliases: string[];
  attribution: string;
  firstSeen?: string;
  lastActive?: string;
  tooling: string[];
  notes?: string;
}

// ─── Report ──────────────────────────────────────────────────────────────────

export interface ReportSection {
  id: string;
  title: string;
  content: string;
  citations: string[];
}

export interface ReportSource {
  title: string;
  url: string;
  accessedAt: string;
  snippet?: string;
}

export interface ConfidenceAssessment {
  finding: string;
  confidence: ConfidenceLevel;
  rationale: string;
}

export interface Report {
  id: string;
  topic: string;
  createdAt: string;
  tier: ResearchTier;
  tlp: TLPLevel;
  bluf: string;
  threatActor: ThreatActorProfile;
  sections: ReportSection[];
  iocs: IOC[];
  attackMapping: AttackTechnique[];
  sources: ReportSource[];
  confidenceAssessments: ConfidenceAssessment[];
}

// ─── App Settings ────────────────────────────────────────────────────────────

export interface ApiKeys {
  perplexity?: string;
  openai?: string;
  anthropic?: string;
  gemini?: string;
  brave?: string;
}

export interface AppSettings {
  defaultTier: ResearchTier;
  defaultTlp: TLPLevel;
  apiKeys: ApiKeys;
  enabledSections: string[];
}

// ─── Research ────────────────────────────────────────────────────────────────

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  publishedDate?: string;
}

export interface ResearchBundle {
  topic: string;
  tier: ResearchTier;
  searchResults: SearchResult[];
  synthesizedContent: string;
  extractedIOCs: IOC[];
  suggestedTechniques: AttackTechnique[];
  sources: ReportSource[];
  metadata: {
    searchDurationMs: number;
    synthesisDurationMs: number;
    totalDurationMs: number;
    searchProvider: string;
    synthesisModel: string;
    /** User-provided sources that could not be read and were left out of synthesis. */
    skippedSources?: { url: string; reason: string }[];
  };
}

// ─── API Request/Response ────────────────────────────────────────────────────

export interface ResearchRequest {
  topic: string;
  tier: ResearchTier;
  apiKeys?: ApiKeys;
}

export interface ReportGenerateRequest {
  bundle: ResearchBundle;
  settings?: Partial<AppSettings>;
}

export interface ApiError {
  detail: string;
  code?: string;
}

// ─── Rate Limiting ───────────────────────────────────────────────────────────

export interface RateLimitState {
  remaining: number;
  limit: number;
  resetAt: string;
}
