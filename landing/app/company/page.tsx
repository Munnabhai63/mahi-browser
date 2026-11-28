import type { Metadata } from 'next';
import CompanyView from '../../components/CompanyView';

export const metadata: Metadata = {
  title: 'About MAHI Browser & Leadership Team — Anti-Detect Browser by Mahipal Choudhary',
  description:
    'Powering the Future of Anti-Detect & Growth Fleets. Meet Founder Mahipal Choudhary and our engineering team building undetectable browser automation.',
  openGraph: {
    title: 'About MAHI Browser & Leadership Team — Anti-Detect Browser by Mahipal Choudhary',
    description:
      'Powering the Future of Anti-Detect & Growth Fleets. Meet Founder Mahipal Choudhary and our engineering team building undetectable browser automation.',
  },
};

export default function CompanyPage() {
  return <CompanyView />;
}
