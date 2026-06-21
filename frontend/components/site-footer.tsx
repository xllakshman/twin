import { LinkedInIcon } from '@/components/linkedin-icon';
import { profile } from '@/lib/profile';

export default function SiteFooter() {
  return (
    <footer className="shrink-0 border-t border-gray-200/80 bg-white/70 px-4 py-2 backdrop-blur-sm dark:border-gray-700 dark:bg-gray-900/70">
      <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 text-xs text-gray-500 dark:text-gray-400">
        <a
          href={profile.linkedinUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 transition-colors hover:text-[#0A66C2] dark:hover:text-blue-400"
        >
          <LinkedInIcon className="h-3.5 w-3.5" />
          LinkedIn
        </a>
        <span>Lakshman&apos;s Digital Avatar</span>
      </div>
    </footer>
  );
}
