import React from 'react';
import type { Metadata } from 'next';
import BlogView from '../../components/BlogView';

export const metadata: Metadata = {
  title: 'Blog — News & Insights | Lateral',
  description:
    'Articles, insights and updates from the Lateral team on autonomous AI agents, finance operations, and enterprise scale.',
  openGraph: {
    title: 'Blog — News & Insights | Lateral',
    description:
      'Articles, insights and updates from the Lateral team on autonomous AI agents, finance operations, and enterprise scale.',
    type: 'website',
    images: ['/assets/blog/featured_phone.jpg'],
  },
};

export default function BlogPage() {
  return <BlogView />;
}
