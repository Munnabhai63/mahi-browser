import { Metadata } from 'next';
import CompanyView from '../../components/CompanyView';

export const metadata: Metadata = {
  title: 'Company & Team — Lateral AI Workforce',
  description:
    'Powering the Future of Finance. We are building the autonomous AI workforce for modern finance teams.',
  openGraph: {
    title: 'Company & Team — Lateral AI Workforce',
    description:
      'Powering the Future of Finance. We are building the autonomous AI workforce for modern finance teams.',
  },
};

export default function AboutPage() {
  return <CompanyView />;
}
