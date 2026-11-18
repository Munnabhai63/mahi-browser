import React from 'react';
import type { Metadata } from 'next';
import BlogView from '../../components/BlogView';

export const metadata: Metadata = {
  title: 'Blog — Engineering News & Anti-Detect Insights | MAHI Browser',
  description:
    'Articles, kernel architecture teardowns, and stealth updates from the MAHI Browser engineering team by Mahipal Choudhary.',
  openGraph: {
    title: 'Blog — Engineering News & Anti-Detect Insights | MAHI Browser',
    description:
      'Articles, kernel architecture teardowns, and stealth updates from the MAHI Browser engineering team by Mahipal Choudhary.',
    type: 'website',
    images: ['/assets/blog/featured_phone.jpg'],
  },
};

export default function BlogPage() {
  return <BlogView />;
}
