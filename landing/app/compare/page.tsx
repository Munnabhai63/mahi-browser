import { Metadata } from 'next';
import CustomersCompareView from '../../components/CustomersCompareView';

export const metadata: Metadata = {
  title: 'Compare Anti-Detect Browsers (2026) | MAHI vs GoLogin, AdsPower & Multilogin',
  description:
    'Complete multi-browser technical comparison matrix: MAHI Browser v1.1.9 vs GoLogin Orbita vs AdsPower SunBrowser vs Multilogin Mimic.',
  openGraph: {
    title: 'Compare Anti-Detect Browsers (2026) | MAHI vs GoLogin, AdsPower & Multilogin',
    description:
      'Complete multi-browser technical comparison matrix: MAHI Browser v1.1.9 vs GoLogin Orbita vs AdsPower SunBrowser vs Multilogin Mimic.',
  },
};

export default function ComparePage() {
  return <CustomersCompareView />;
}
