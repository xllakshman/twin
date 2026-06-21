'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Element } from 'hast';

function isStandaloneStrongParagraph(node: Element | undefined): boolean {
  if (!node || node.tagName !== 'p') return false;
  const children = node.children ?? [];
  if (children.length !== 1) return false;
  const child = children[0];
  return child.type === 'element' && child.tagName === 'strong';
}

function getStrongText(node: Element | undefined): string {
  if (!node || node.tagName !== 'p') return '';
  const child = node.children?.[0];
  if (child?.type !== 'element' || child.tagName !== 'strong') return '';
  const textNode = child.children?.[0];
  return textNode?.type === 'text' ? textNode.value : '';
}

interface MessageContentProps {
  content: string;
}

export default function MessageContent({ content }: MessageContentProps) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        h1: ({ children }) => (
          <h2 className="text-xl font-bold text-blue-700 mt-4 mb-2 first:mt-0">{children}</h2>
        ),
        h2: ({ children }) => (
          <h2 className="text-lg font-bold text-blue-700 mt-4 mb-2 first:mt-0">{children}</h2>
        ),
        h3: ({ children }) => (
          <h3 className="text-base font-bold text-black mt-3 mb-1">{children}</h3>
        ),
        p: ({ node, children }) => {
          if (isStandaloneStrongParagraph(node as Element | undefined)) {
            const text = getStrongText(node as Element | undefined);
            const isSectionHeading = text.endsWith(':');

            if (isSectionHeading) {
              return (
                <p className="text-lg font-bold text-blue-700 mt-4 mb-2 first:mt-0">{children}</p>
              );
            }

            return (
              <p className="text-base font-bold text-black mt-3 mb-1">{children}</p>
            );
          }

          return <p className="mb-2 leading-relaxed">{children}</p>;
        },
        strong: ({ children }) => (
          <strong className="font-bold text-black">{children}</strong>
        ),
        ul: ({ children }) => (
          <ul className="list-disc pl-5 mb-2 space-y-1">{children}</ul>
        ),
        ol: ({ children }) => (
          <ol className="list-decimal pl-5 mb-2 space-y-1">{children}</ol>
        ),
        li: ({ children }) => (
          <li className="text-sm leading-relaxed [&>strong:first-child]:text-sm [&>strong:first-child]:font-bold [&>strong:first-child]:text-black">
            {children}
          </li>
        ),
      }}
    >
      {content}
    </ReactMarkdown>
  );
}
