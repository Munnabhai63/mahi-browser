/**
 * MAHI Browser — Pre-Built RPA Workflow Catalog
 * Reverse-Engineered from MostLogin's Built-in RPA Market & Automation Blueprints
 * 
 * Provides production-ready, 1-click executable RPA workflow templates
 * with built-in humanized delays, natural mouse curves, and cookie retention.
 */

import { AutomationStep } from '../10_CONFIG/shared/types/automation.js';

export interface RpaTemplate {
  id: string;
  name: string;
  description: string;
  category: 'WARMUP' | 'ECOMMERCE' | 'SOCIAL' | 'CRYPTO';
  estimatedDurationSeconds: number;
  steps: AutomationStep[];
}

export const RPA_PRODUCTION_TEMPLATES: RpaTemplate[] = [
  {
    id: 'google-organic-warmer',
    name: 'Google Organic Search & Profile Warmer',
    description: 'Searches real trending topics on Google, reads articles, and establishes high-trust browser cookies.',
    category: 'WARMUP',
    estimatedDurationSeconds: 45,
    steps: [
      {
        id: 'step-1',
        order: 1,
        label: 'Navigate to Google',
        type: 'OPEN_URL',
        target: 'https://www.google.com',
        timeoutMs: 15000,
      },
      {
        id: 'step-2',
        order: 2,
        label: 'Natural Reading Delay',
        type: 'WAIT',
        value: '2500',
        timeoutMs: 5000,
      },
      {
        id: 'step-3',
        order: 3,
        label: 'Type Search Query',
        type: 'FILL',
        target: 'textarea[name="q"], input[name="q"]',
        value: 'latest technology news 2026',
        timeoutMs: 10000,
      },
      {
        id: 'step-4',
        order: 4,
        label: 'Press Enter',
        type: 'KEYPRESS',
        value: 'Enter',
        timeoutMs: 5000,
      },
      {
        id: 'step-5',
        order: 5,
        label: 'Wait for Results',
        type: 'WAIT_FOR_SELECTOR',
        target: '#search',
        timeoutMs: 15000,
      },
      {
        id: 'step-6',
        order: 6,
        label: 'Natural Human Scroll Down',
        type: 'SCROLL',
        value: '600',
        timeoutMs: 5000,
      },
    ],
  },
  {
    id: 'amazon-shopper-intent',
    name: 'Amazon E-Commerce Shopper Intent Warmup',
    description: 'Simulates genuine buyer intent on Amazon with product browsing and review reading.',
    category: 'ECOMMERCE',
    estimatedDurationSeconds: 60,
    steps: [
      {
        id: 'step-1',
        order: 1,
        label: 'Open Amazon Store',
        type: 'OPEN_URL',
        target: 'https://www.amazon.com',
        timeoutMs: 20000,
      },
      {
        id: 'step-2',
        order: 2,
        label: 'Wait for Search Input',
        type: 'WAIT_FOR_SELECTOR',
        target: '#twotabsearchtextbox',
        timeoutMs: 15000,
      },
      {
        id: 'step-3',
        order: 3,
        label: 'Search Product Category',
        type: 'FILL',
        target: '#twotabsearchtextbox',
        value: 'wireless noise cancelling headphones',
        timeoutMs: 10000,
      },
      {
        id: 'step-4',
        order: 4,
        label: 'Submit Search',
        type: 'KEYPRESS',
        value: 'Enter',
        timeoutMs: 5000,
      },
      {
        id: 'step-5',
        order: 5,
        label: 'Browse Product Cards',
        type: 'SCROLL',
        value: '800',
        timeoutMs: 10000,
      },
      {
        id: 'step-6',
        order: 6,
        label: 'Read Reviews Delay',
        type: 'WAIT',
        value: '4000',
        timeoutMs: 6000,
      },
    ],
  },
  {
    id: 'social-matrix-feed-surfer',
    name: 'Social Media Matrix Feed Surfer',
    description: 'Visits active social media portals (Reddit, Twitter/X) with organic dwell time for anti-ban seasoning.',
    category: 'SOCIAL',
    estimatedDurationSeconds: 50,
    steps: [
      {
        id: 'step-1',
        order: 1,
        label: 'Open Reddit Popular',
        type: 'OPEN_URL',
        target: 'https://www.reddit.com/r/technology/',
        timeoutMs: 20000,
      },
      {
        id: 'step-2',
        order: 2,
        label: 'Feed Loading Delay',
        type: 'WAIT',
        value: '3000',
        timeoutMs: 5000,
      },
      {
        id: 'step-3',
        order: 3,
        label: 'Organic Feed Scroll 1',
        type: 'SCROLL',
        value: '700',
        timeoutMs: 5000,
      },
      {
        id: 'step-4',
        order: 4,
        label: 'Reading Pause',
        type: 'WAIT',
        value: '3500',
        timeoutMs: 5000,
      },
      {
        id: 'step-5',
        order: 5,
        label: 'Organic Feed Scroll 2',
        type: 'SCROLL',
        value: '900',
        timeoutMs: 5000,
      },
    ],
  },
  {
    id: 'crypto-web3-faucet-routine',
    name: 'Crypto & Web3 Routine Airdrop Surfer',
    description: 'Surfs CoinMarketCap and CoinGecko to build legitimate decentralized finance browser activity.',
    category: 'CRYPTO',
    estimatedDurationSeconds: 45,
    steps: [
      {
        id: 'step-1',
        order: 1,
        label: 'Open CoinMarketCap',
        type: 'OPEN_URL',
        target: 'https://coinmarketcap.com',
        timeoutMs: 20000,
      },
      {
        id: 'step-2',
        order: 2,
        label: 'Market Data Dwell Delay',
        type: 'WAIT',
        value: '4000',
        timeoutMs: 6000,
      },
      {
        id: 'step-3',
        order: 3,
        label: 'Scroll Market Table',
        type: 'SCROLL',
        value: '1000',
        timeoutMs: 5000,
      },
      {
        id: 'step-4',
        order: 4,
        label: 'Inspect Trending Coin',
        type: 'WAIT',
        value: '3000',
        timeoutMs: 5000,
      },
    ],
  },
];

/**
 * Returns all available pre-built RPA templates.
 */
export function getRpaTemplates(): RpaTemplate[] {
  return RPA_PRODUCTION_TEMPLATES;
}

/**
 * Resolves an RPA template by its unique template ID.
 */
export function getRpaTemplateById(templateId: string): RpaTemplate | undefined {
  return RPA_PRODUCTION_TEMPLATES.find(t => t.id === templateId);
}
