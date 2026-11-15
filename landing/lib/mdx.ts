import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';

function getContentDir(): string {
  const candidates = [
    path.join(process.cwd(), 'landing', 'content'),
    path.join(process.cwd(), 'content'),
    path.resolve(process.cwd(), 'landing/content'),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return path.join(process.cwd(), 'content');
}

export interface DocItem {
  slug: string;
  title: string;
  description: string;
  order: number;
  section: string;
  content: string;
}

export interface BlogPost {
  slug: string;
  title: string;
  description: string;
  date: string;
  author: string;
  category: string;
  readTime: string;
  content: string;
}

export function getAllDocs(): DocItem[] {
  const docsDir = path.join(getContentDir(), 'docs');
  if (!fs.existsSync(docsDir)) return [];
  const files = fs.readdirSync(docsDir).filter((f) => f.endsWith('.mdx') || f.endsWith('.md'));
  const docs = files.map((file) => {
    const slug = file.replace(/\.mdx?$/, '');
    const raw = fs.readFileSync(path.join(docsDir, file), 'utf8');
    const { data, content } = matter(raw);
    return {
      slug,
      title: data.title || slug,
      description: data.description || '',
      order: data.order ?? 99,
      section: data.section || 'General',
      content,
    };
  });
  return docs.sort((a, b) => a.order - b.order);
}

export function getDocBySlug(slug: string): DocItem | null {
  const docs = getAllDocs();
  return docs.find((d) => d.slug === slug) || null;
}

export function getAllBlogPosts(): BlogPost[] {
  const blogDir = path.join(getContentDir(), 'blog');
  if (!fs.existsSync(blogDir)) return [];
  const files = fs.readdirSync(blogDir).filter((f) => f.endsWith('.mdx') || f.endsWith('.md'));
  const posts = files.map((file) => {
    const slug = file.replace(/\.mdx?$/, '');
    const raw = fs.readFileSync(path.join(blogDir, file), 'utf8');
    const { data, content } = matter(raw);
    return {
      slug,
      title: data.title || slug,
      description: data.description || '',
      date: data.date || '2026-11-16',
      author: data.author || 'Munna Bhai',
      category: data.category || 'Engineering',
      readTime: data.readTime || '6 min read',
      content,
    };
  });
  return posts.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

export function getBlogPostBySlug(slug: string): BlogPost | null {
  const posts = getAllBlogPosts();
  return posts.find((p) => p.slug === slug) || null;
}
