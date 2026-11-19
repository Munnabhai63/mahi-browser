import { Metadata } from 'next';
import CompanyView from '../../components/CompanyView';

export const metadata: Metadata = {
  title: 'Careers at MAHI Browser — Help Build the Future of Anti-Detect',
  description:
    'Join our engineering and research team building undetectable browser automation. Open roles in Chromium, C++, and anti-detect research.',
  openGraph: {
    title: 'Careers at MAHI Browser — Help Build the Future of Anti-Detect',
    description:
      'Join our engineering and research team building undetectable browser automation. Open roles in Chromium, C++, and anti-detect research.',
  },
};

export default function CareersPage() {
  return <CompanyView />;
}
