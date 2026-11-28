import type { RpaTemplate } from '../types/automation.js';

export const RPA_TEMPLATES: RpaTemplate[] = [
  {
    id: 'google-organic-search',
    name: 'Google Organic Search & Engagement',
    category: 'Search',
    icon: 'Search',
    description: 'Searches a target keyword on Google, randomly scrolls search results, and simulates organic click behavior.',
    estimatedDuration: '~25s',
    steps: [
      {
        type: 'OPEN_URL',
        label: 'Open Google Homepage',
        target: 'https://www.google.com',
        timeoutMs: 15000,
      },
      {
        type: 'RANDOM_SLEEP',
        label: 'Human Pause',
        value: '1500-3000',
      },
      {
        type: 'SEARCH',
        label: 'Search Target Keyword',
        target: 'Google',
        value: 'best anti detect browser for multi accounting 2026',
      },
      {
        type: 'RANDOM_SLEEP',
        label: 'Review Search Results',
        value: '2000-4000',
      },
      {
        type: 'SCROLL',
        label: 'Natural Page Scroll',
        value: '650',
      },
      {
        type: 'RANDOM_SLEEP',
        label: 'Read Snippets',
        value: '1500-2500',
      },
      {
        type: 'SCREENSHOT',
        label: 'Capture SERP Results',
      },
    ],
  },
  {
    id: 'youtube-video-watcher',
    name: 'YouTube Video Watcher & Engagement',
    category: 'Social',
    icon: 'Play',
    description: 'Navigates to YouTube trending, scrolls videos, and views the first video for natural account activity.',
    estimatedDuration: '~45s',
    steps: [
      {
        type: 'OPEN_URL',
        label: 'Open YouTube Trending',
        target: 'https://www.youtube.com/feed/trending',
        timeoutMs: 20000,
      },
      {
        type: 'RANDOM_SLEEP',
        label: 'Wait for video feed to load',
        value: '3000-5000',
      },
      {
        type: 'SCROLL',
        label: 'Scroll Trending Feed',
        value: '800',
      },
      {
        type: 'RANDOM_SLEEP',
        label: 'Browse Thumbnails',
        value: '2000-4000',
      },
      {
        type: 'CLICK',
        label: 'Click Top Video',
        target: 'ytd-video-renderer a#thumbnail, a#video-title',
        continueOnError: true,
      },
      {
        type: 'WAIT',
        label: 'Watch Video Segment',
        value: '15000',
      },
      {
        type: 'SCREENSHOT',
        label: 'Verify Video Playback',
      },
    ],
  },
  {
    id: 'amazon-product-warming',
    name: 'E-Commerce Product View & Warming',
    category: 'E-Commerce',
    icon: 'ShoppingCart',
    description: 'Simulates shopping intent by browsing e-commerce deals, scrolling reviews, and building cookies.',
    estimatedDuration: '~35s',
    steps: [
      {
        type: 'OPEN_URL',
        label: 'Open Amazon Deals',
        target: 'https://www.amazon.com/gp/goldbox',
        timeoutMs: 20000,
      },
      {
        type: 'RANDOM_SLEEP',
        label: 'Initial Browse Pause',
        value: '2000-3500',
      },
      {
        type: 'SCROLL',
        label: 'Scroll Deals Feed',
        value: '700',
      },
      {
        type: 'RANDOM_SLEEP',
        label: 'Inspect Products',
        value: '2000-3000',
      },
      {
        type: 'SCROLL',
        label: 'Scroll to Reviews Section',
        value: '1200',
      },
      {
        type: 'SCREENSHOT',
        label: 'Record Product Page State',
      },
    ],
  },
  {
    id: 'social-feed-scroller',
    name: 'Social Media Feed Auto-Scroller',
    category: 'Social',
    icon: 'Share2',
    description: 'Simulates active user feed browsing with multiple random scroll intervals and pauses.',
    estimatedDuration: '~30s',
    steps: [
      {
        type: 'OPEN_URL',
        label: 'Open Reddit Popular',
        target: 'https://www.reddit.com/r/popular',
        timeoutMs: 20000,
      },
      {
        type: 'RANDOM_SLEEP',
        label: 'Initial Feed Load',
        value: '3000-5000',
      },
      {
        type: 'SCROLL',
        label: 'Scroll Feed Down',
        value: '800',
      },
      {
        type: 'RANDOM_SLEEP',
        label: 'Read Top Post',
        value: '2500-4000',
      },
      {
        type: 'SCROLL',
        label: 'Scroll Further Down',
        value: '1000',
      },
      {
        type: 'RANDOM_SLEEP',
        label: 'Human Reading Pause',
        value: '2000-3000',
      },
      {
        type: 'SCREENSHOT',
        label: 'Verify Feed Position',
      },
    ],
  },
  {
    id: 'fingerprint-ip-auditor',
    name: 'Fingerprint & WebRTC Leak Auditor',
    category: 'Auditing',
    icon: 'ShieldCheck',
    description: 'Audits profile stealthiness on BrowserLeaks, checks WebRTC, Canvas, and captures proof screenshot.',
    estimatedDuration: '~20s',
    steps: [
      {
        type: 'OPEN_URL',
        label: 'Open BrowserLeaks IP & WebRTC Test',
        target: 'https://browserleaks.com/ip',
        timeoutMs: 20000,
      },
      {
        type: 'RANDOM_SLEEP',
        label: 'Allow Leak Tests to Finish',
        value: '4000-6000',
      },
      {
        type: 'EXTRACT_TITLE',
        label: 'Extract Page Title',
      },
      {
        type: 'SCROLL',
        label: 'Scroll Down to WebRTC Detection Box',
        value: '400',
      },
      {
        type: 'SCREENSHOT',
        label: 'Full Audit Screenshot Proof',
      },
    ],
  },
];
