import lateralData from './lateralBlogData.json';

export interface BlogSection {
  heading: string;
  paragraphs: string[];
}

export interface LateralPost {
  slug: string;
  category: string;
  date: string;
  title: string;
  description: string;
  image: string;
  isFeatured: boolean;
  authorName?: string;
  authorRole?: string;
  authorImage?: string;
  sections: BlogSection[];
}

export const LATERAL_BLOG_POSTS: LateralPost[] = (lateralData as LateralPost[]).map((p) => ({
  ...p,
  authorName: p.authorName || 'Mahipal Choudhary',
  authorRole: p.authorRole || 'Founder & CEO',
  authorImage: p.authorImage || '/assets/company/mahipal_founder.jpg',
}));

export function getAllLateralPosts(): LateralPost[] {
  return LATERAL_BLOG_POSTS;
}

export function getFeaturedPost(): LateralPost {
  return LATERAL_BLOG_POSTS.find((p) => p.isFeatured) || LATERAL_BLOG_POSTS[0];
}

export function getGridPosts(): LateralPost[] {
  return LATERAL_BLOG_POSTS.filter((p) => !p.isFeatured);
}

export function getPostBySlug(slug: string): LateralPost | undefined {
  return LATERAL_BLOG_POSTS.find((p) => p.slug === slug);
}

export function getRelatedPosts(currentSlug: string, count = 3): LateralPost[] {
  return LATERAL_BLOG_POSTS.filter((p) => p.slug !== currentSlug).slice(0, count);
}
