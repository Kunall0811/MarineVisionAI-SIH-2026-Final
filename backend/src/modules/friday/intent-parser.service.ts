import { Injectable } from '@nestjs/common';

export interface ParsedIntent {
  intent: string;
  parameters: Record<string, any>;
  isDestructive: boolean;
  confidence: number; // 0..1, based on how specifically the rules matched - real, not invented
}

const RISK_WORDS: Record<string, string> = {
  'high risk': 'HIGH', 'high-risk': 'HIGH', critical: 'CRITICAL',
  'low risk': 'LOW', medium: 'MEDIUM',
};

const CLASS_WORDS: Record<string, string> = {
  'ghost net': 'ghost_net', 'ghost nets': 'ghost_net',
  container: 'container', containers: 'container',
  pipe: 'pipe', pipes: 'pipe',
  shipwreck: 'shipwreck', shipwrecks: 'shipwreck',
  'fishing gear': 'fishing_gear',
  debris: 'marine_debris',
};

// Extended page navigation map with more aliases
const PAGE_MAP: Record<string, string> = {
  dashboard: '/',
  command: '/',
  'command dashboard': '/',
  'command center': '/',
  home: '/',
  globe: '/globe',
  earth: '/globe',
  '3d globe': '/globe',
  '3d earth': '/globe',
  map: '/map',
  gis: '/map',
  'gis map': '/map',
  'survey map': '/map',
  surveys: '/surveys',
  survey: '/surveys',
  'survey management': '/surveys',
  reports: '/reports',
  report: '/reports',
  'review queue': '/anomaly-review',
  'anomaly review': '/anomaly-review',
  anomalies: '/anomaly-review',
  analytics: '/analytics',
  analysis: '/analytics',
  statistics: '/analytics',
  stats: '/analytics',
  notifications: '/notifications',
  'ai test': '/ai-test',
  'ai model': '/ai-test',
  'model test': '/ai-test',
  'ai model test': '/ai-test',
  training: '/training',
  'ai training': '/training',
  'train model': '/training',
  'train ai': '/training',
  friday: '/friday',
  assistant: '/friday',
  'ai assistant': '/friday',
  datasets: '/datasets',
  dataset: '/datasets',
  'ai models': '/ai-models',
  models: '/ai-models',
};

/**
 * Rule-based intent parser for FRIDAY. This is deterministic keyword/regex
 * matching over the transcript - NOT a large-language-model call, and no
 * claim to that effect is made anywhere in the API or UI. It is built so
 * CommandExecutorService's interface (intent + parameters in, structured
 * result out) does not need to change if this is later swapped for an
 * LLM-based classifier.
 */
@Injectable()
export class IntentParserService {
  parse(rawTranscript: string): ParsedIntent {
    const text = rawTranscript.toLowerCase().trim();

    const surveyCodeMatch = text.match(/\b([a-z]{2,6}-\d{4}(?:-\d{1,2})?)\b/i);
    const surveyCode = surveyCodeMatch ? surveyCodeMatch[1].toUpperCase() : null;

    const anomalyCodeMatch = text.match(/\b(anm-\d{2,4})\b/i);
    const anomalyCode = anomalyCodeMatch ? anomalyCodeMatch[1].toUpperCase() : null;

    let riskLevel: string | null = null;
    for (const [phrase, level] of Object.entries(RISK_WORDS)) {
      if (text.includes(phrase)) { riskLevel = level; break; }
    }

    let anomalyClass: string | null = null;
    for (const [phrase, cls] of Object.entries(CLASS_WORDS)) {
      if (text.includes(phrase)) { anomalyClass = cls; break; }
    }

    const regionMatch = text.match(/\bin (?:the )?([a-z ]+?sea|[a-z ]+?ocean|[a-z ]+?gulf|goa|kerala|mumbai|chennai|vizag|visakhapatnam)\b/);
    const region = regionMatch ? regionMatch[1].trim() : null;

    // ---- FRIDAY power commands ----
    if (/\bfriday\s+(on|activate|start|enable|wake up)\b/.test(text) || /\bactivate\s+friday\b/.test(text)) {
      return { intent: 'FRIDAY_ON', parameters: {}, isDestructive: false, confidence: 0.98 };
    }

    if (/\bfriday\s+(off|deactivate|stop|disable|sleep|shutdown)\b/.test(text) || /\bdeactivate\s+friday\b/.test(text)) {
      return { intent: 'FRIDAY_OFF', parameters: {}, isDestructive: false, confidence: 0.98 };
    }

    // ---- Rule matching, most specific first ----
    if (/\b(how many|count of|number of)\b.*\bunverified\b/.test(text)) {
      return { intent: 'COUNT_UNVERIFIED', parameters: {}, isDestructive: false, confidence: 0.95 };
    }

    if (/\bsend\b.*\breport\b/.test(text) || /\bemail\b.*\breport\b/.test(text)) {
      return { intent: 'SEND_REPORT', parameters: { surveyCode }, isDestructive: true, confidence: surveyCode ? 0.9 : 0.6 };
    }

    if (/\bgenerate\b.*\breport\b/.test(text) || /\bcreate\b.*\breport\b/.test(text)) {
      const format = /\bpdf\b/.test(text) ? 'PDF' : /\bcsv\b/.test(text) ? 'CSV' : /\bjson\b/.test(text) ? 'JSON' : /\bgeojson\b/.test(text) ? 'GEOJSON' : 'PDF';
      return { intent: 'GENERATE_REPORT', parameters: { surveyCode, format }, isDestructive: false, confidence: surveyCode ? 0.9 : 0.55 };
    }

    if (/\bstart\b.*\bprocess/.test(text) || /\bprocess\b.*\bsurvey\b/.test(text)) {
      return { intent: 'START_PROCESSING', parameters: { surveyCode }, isDestructive: true, confidence: surveyCode ? 0.9 : 0.5 };
    }

    // AI training commands
    if (/\btrain\b.*\b(ai|model|neural|yolo)\b/.test(text) || /\b(ai|model)\b.*\btraining\b/.test(text) || text === 'train ai model') {
      return { intent: 'NAVIGATE', parameters: { route: '/training', label: 'AI Training' }, isDestructive: false, confidence: 0.9 };
    }

    // AI test commands
    if (/\btest\b.*\b(ai|model)\b/.test(text) || /\b(ai|model)\b.*\btest\b/.test(text) || text === 'test ai model') {
      return { intent: 'NAVIGATE', parameters: { route: '/ai-test', label: 'AI Model Test' }, isDestructive: false, confidence: 0.9 };
    }

    if (/\bverify\b/.test(text) && (anomalyCode || /\bthis\b|\bcurrent\b/.test(text))) {
      return { intent: 'VERIFY_ANOMALY', parameters: { anomalyCode: anomalyCode || 'CURRENT' }, isDestructive: true, confidence: anomalyCode ? 0.9 : 0.6 };
    }

    if (/\bzoom\b.*\b(globe|earth|map)?/.test(text) || /\bfly to\b/.test(text)) {
      return { intent: 'ZOOM_GLOBE', parameters: { anomalyCode: anomalyCode || 'CURRENT' }, isDestructive: false, confidence: anomalyCode ? 0.85 : 0.6 };
    }

    if (/\bopen\b.*\b(latest|newest)\b.*\banomaly\b/.test(text)) {
      return { intent: 'OPEN_ANOMALY', parameters: { which: 'LATEST' }, isDestructive: false, confidence: 0.9 };
    }
    if (/\bopen\b.*\banomaly\b/.test(text) && anomalyCode) {
      return { intent: 'OPEN_ANOMALY', parameters: { which: anomalyCode }, isDestructive: false, confidence: 0.9 };
    }

    if (/\bshow\b.*\banomal/.test(text) || /\bshow\b.*\bdetections?\b/.test(text)) {
      return {
        intent: 'SHOW_ANOMALIES',
        parameters: { riskLevel, class: anomalyClass, region },
        isDestructive: false,
        confidence: riskLevel || anomalyClass || region ? 0.85 : 0.65,
      };
    }

    // Navigation - extended with "switch to" and panel-specific phrases
    const navPhrases = [
      /\bgo to\b/,
      /\bopen\b/,
      /\bnavigate to\b/,
      /\bshow me the\b/,
      /\bswitch to\b/,
      /\btake me to\b/,
      /\blaunch\b/,
      /\bload\b/,
    ];

    const isNavIntent = navPhrases.some((r) => r.test(text));
    if (isNavIntent) {
      // Try longest match first
      const sortedPages = Object.keys(PAGE_MAP).sort((a, b) => b.length - a.length);
      for (const phrase of sortedPages) {
        if (text.includes(phrase)) {
          const route = PAGE_MAP[phrase];
          return { intent: 'NAVIGATE', parameters: { route, label: phrase }, isDestructive: false, confidence: 0.88 };
        }
      }
    }

    // Also match bare panel names without nav verb (e.g. "analytics", "3d globe")
    const sortedPages = Object.keys(PAGE_MAP).sort((a, b) => b.length - a.length);
    for (const phrase of sortedPages) {
      if (phrase.length > 3 && text === phrase) {
        return { intent: 'NAVIGATE', parameters: { route: PAGE_MAP[phrase], label: phrase }, isDestructive: false, confidence: 0.75 };
      }
    }

    if (/\bhelp\b|\bwhat can you do\b/.test(text)) {
      return { intent: 'HELP', parameters: {}, isDestructive: false, confidence: 1 };
    }

    return { intent: 'UNKNOWN', parameters: { rawTranscript }, isDestructive: false, confidence: 0 };
  }
}
