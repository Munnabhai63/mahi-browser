import { Metadata } from 'next';
import PricingView from '../../components/PricingView';

export const metadata: Metadata = {
  title: 'Simple Pricing Built for Scale — MAHI Browser Plans & Indian UPI 0% Fees',
  description:
    'Transparent pricing for solo operators and enterprise growth fleets. Save 72% on 6-month Growth and 79% on annual Ultimate billing, with 15 free air-gapped profiles and instant 0% fee Indian UPI settlements.',
  openGraph: {
    title: 'Simple Pricing Built for Scale — MAHI Browser Plans',
    description:
      'Transparent pricing for solo operators and enterprise growth fleets. Save 20% on annual billing.',
  },
};

export default function PricingPage() {
  return <PricingView />;
}
