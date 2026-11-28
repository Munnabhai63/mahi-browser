import type { Metadata } from 'next';
import CustomersView from '../../components/CustomersView';

export const metadata: Metadata = {
  title: 'Customers & Growth Fleets | MAHI Browser Case Studies',
  description:
    'Explore how top performance marketing fleets, e-commerce brands, and enterprise data scrapers scale with MAHI Browser dual-engine anti-detect architecture.',
  openGraph: {
    title: 'Customers & Growth Fleets | MAHI Browser Case Studies',
    description:
      'Explore how top performance marketing fleets, e-commerce brands, and enterprise data scrapers scale with MAHI Browser.',
  },
};

export default function CustomersPage() {
  return <CustomersView />;
}
