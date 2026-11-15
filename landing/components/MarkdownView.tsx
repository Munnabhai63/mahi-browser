import React from 'react';

interface MarkdownViewProps {
  content: string;
}

export default function MarkdownView({ content }: MarkdownViewProps) {
  // Simple, deterministic, and safe Markdown-to-JSX converter for docs and blogs
  const lines = content.split('\n');
  const elements: React.ReactNode[] = [];
  let inCodeBlock = false;
  let codeBlockContent: string[] = [];
  let codeBlockLang = '';
  let inList = false;
  let listItems: string[] = [];

  const flushList = (key: string) => {
    if (inList && listItems.length > 0) {
      elements.push(
        <ul key={key} className="my-4 list-disc list-inside space-y-1.5 text-slate-300 text-sm sm:text-base leading-relaxed pl-2">
          {listItems.map((item, i) => (
            <li key={i} dangerouslySetInnerHTML={{ __html: renderInline(item) }} />
          ))}
        </ul>
      );
      listItems = [];
      inList = false;
    }
  };

  const renderInline = (text: string): string => {
    return text
      .replace(/`([^`]+)`/g, '<code class="rounded bg-slate-800 px-1.5 py-0.5 font-mono text-red-300 text-xs">$1</code>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong class="font-bold text-white">$1</strong>')
      .replace(/\*([^*]+)\*/g, '<em class="italic text-slate-200">$1</em>')
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="text-red-400 underline hover:text-red-300 transition">$1</a>');
  };

  for (let idx = 0; idx < lines.length; idx++) {
    const line = lines[idx];

    // Code block open/close
    if (line.trim().startsWith('```')) {
      if (inCodeBlock) {
        // close code block
        elements.push(
          <div key={`code-${idx}`} className="my-5 overflow-x-auto rounded-xl border border-slate-800 bg-slate-950 p-4 font-mono text-xs text-slate-200">
            {codeBlockLang && (
              <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-2 border-b border-slate-800/80 pb-1">
                {codeBlockLang}
              </div>
            )}
            <pre className="leading-relaxed">
              <code>{codeBlockContent.join('\n')}</code>
            </pre>
          </div>
        );
        codeBlockContent = [];
        inCodeBlock = false;
      } else {
        flushList(`list-${idx}`);
        inCodeBlock = true;
        codeBlockLang = line.trim().replace(/^```/, '');
      }
      continue;
    }

    if (inCodeBlock) {
      codeBlockContent.push(line);
      continue;
    }

    // List item
    if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
      inList = true;
      listItems.push(line.trim().slice(2));
      continue;
    } else {
      flushList(`list-${idx}`);
    }

    // Headers
    if (line.startsWith('# ')) {
      elements.push(
        <h1 key={`h1-${idx}`} className="mt-8 mb-4 text-2xl sm:text-4xl font-extrabold text-white tracking-tight border-b border-slate-800 pb-3">
          {line.replace(/^# /, '')}
        </h1>
      );
      continue;
    }

    if (line.startsWith('## ')) {
      elements.push(
        <h2 key={`h2-${idx}`} className="mt-7 mb-3 text-xl sm:text-2xl font-bold text-white tracking-tight">
          {line.replace(/^## /, '')}
        </h2>
      );
      continue;
    }

    if (line.startsWith('### ')) {
      elements.push(
        <h3 key={`h3-${idx}`} className="mt-6 mb-2 text-lg sm:text-xl font-semibold text-red-400">
          {line.replace(/^### /, '')}
        </h3>
      );
      continue;
    }

    // Blockquote
    if (line.startsWith('> ')) {
      elements.push(
        <blockquote key={`bq-${idx}`} className="my-4 border-l-4 border-red-500 bg-red-950/20 py-2.5 px-4 text-sm text-slate-300 italic rounded-r-lg">
          <span dangerouslySetInnerHTML={{ __html: renderInline(line.replace(/^> /, '')) }} />
        </blockquote>
      );
      continue;
    }

    // Blank line
    if (!line.trim()) {
      continue;
    }

    // Regular paragraph
    elements.push(
      <p
        key={`p-${idx}`}
        className="my-3 text-sm sm:text-base text-slate-300 leading-relaxed"
        dangerouslySetInnerHTML={{ __html: renderInline(line) }}
      />
    );
  }

  flushList('list-end');

  return <div className="markdown-body prose prose-invert max-w-none space-y-2">{elements}</div>;
}
