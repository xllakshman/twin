'use client';

import { Fragment } from 'react';

interface MessageContentProps {
  content: string;
}

function stripBoldMarkers(text: string): string {
  return text.replace(/\*\*/g, '').trim();
}

function renderInline(text: string, boldClass = 'font-bold text-black') {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);

  return parts.map((part, index) => {
    const match = part.match(/^\*\*(.+)\*\*$/);
    if (match) {
      return (
        <strong key={index} className={boldClass}>
          {match[1]}
        </strong>
      );
    }
    return part ? <Fragment key={index}>{part}</Fragment> : null;
  });
}

export default function MessageContent({ content }: MessageContentProps) {
  const lines = content.split('\n');

  return (
    <div className="space-y-1">
      {lines.map((rawLine, index) => {
        const line = rawLine.trim();
        if (!line) return null;

        const sectionHeading = line.match(/^\*\*(.+?):\*\*\s*$/);
        if (sectionHeading) {
          return (
            <p
              key={index}
              className="text-lg font-bold text-blue-700 mt-4 mb-2 first:mt-0"
            >
              {sectionHeading[1]}:
            </p>
          );
        }

        const subHeading = line.match(/^\*\*(.+?)\*\*\s*$/);
        if (subHeading) {
          return (
            <p key={index} className="text-base font-bold text-black mt-3 mb-1">
              {subHeading[1]}
            </p>
          );
        }

        const markdownSection = line.match(/^#{1,2}\s+(.+)$/);
        if (markdownSection) {
          return (
            <p
              key={index}
              className="text-lg font-bold text-blue-700 mt-4 mb-2 first:mt-0"
            >
              {stripBoldMarkers(markdownSection[1])}
            </p>
          );
        }

        const markdownSub = line.match(/^#{3,6}\s+(.+)$/);
        if (markdownSub) {
          return (
            <p key={index} className="text-base font-bold text-black mt-3 mb-1">
              {stripBoldMarkers(markdownSub[1])}
            </p>
          );
        }

        const bullet = line.match(/^[-*•]\s+(.+)$/);
        if (bullet) {
          const bulletText = bullet[1];
          const labelMatch = bulletText.match(/^\*\*(.+?):\*\*\s*(.*)$/);

          return (
            <div key={index} className="flex gap-2 text-sm leading-relaxed pl-1">
              <span className="text-gray-500 shrink-0">•</span>
              <p>
                {labelMatch ? (
                  <>
                    <strong className="font-bold text-black">{labelMatch[1]}:</strong>
                    {labelMatch[2] ? ` ${renderInline(labelMatch[2])}` : null}
                  </>
                ) : (
                  renderInline(bulletText)
                )}
              </p>
            </div>
          );
        }

        return (
          <p key={index} className="mb-1 leading-relaxed">
            {renderInline(line)}
          </p>
        );
      })}
    </div>
  );
}
