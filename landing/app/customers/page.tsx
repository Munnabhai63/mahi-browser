import { Metadata } from 'next';
import CustomersCompareView from '../../components/CustomersCompareView';

export const metadata: Metadata = {
  title: 'Customers & Growth Fleets | MAHI Browser Case Studies vs GoLogin',
  description:
    'Explore how top performance marketing fleets, e-commerce brands, and enterprise data scrapers scale with MAHI Browser dual-engine anti-detect architecture.',
  openGraph: {
    title: 'Customers & Growth Fleets | MAHI Browser Case Studies vs GoLogin',
    description:
      'Explore how top performance marketing fleets, e-commerce brands, and enterprise data scrapers scale with MAHI Browser.',
  },
};

export default function CustomersPage() {
  return <CustomersCompareView />;
}
