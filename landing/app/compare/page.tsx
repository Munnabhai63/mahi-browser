import type { Metadata } from 'next';
import CompareView from '../../components/CompareView';

export const metadata: Metadata = {
  title: 'MAHI Browser vs GoLogin (2026 Comparison) | #1 Anti-Detect Alternative',
  description:
    'Detailed head-to-head technical capability comparison between MAHI Browser and GoLogin Orbita. Discover why top fleets migrate for Chromium 138, zero CDP leaks, and 0% UPI fees.',
  openGraph: {
    title: 'MAHI Browser vs GoLogin (2026 Comparison) | #1 Anti-Detect Alternative',
    description:
      'Detailed head-to-head technical capability comparison between MAHI Browser and GoLogin Orbita.',
  },
};

export default function ComparePage() {
  return <CompareView />;
}
