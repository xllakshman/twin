import { LinkedInIcon } from '@/components/linkedin-icon';
import { profile } from '@/lib/profile';

export default function ProfilePanel() {
  return (
    <aside className="hidden w-80 shrink-0 flex-col border-r border-gray-200/80 bg-white/70 p-6 backdrop-blur-sm lg:flex dark:border-gray-700 dark:bg-gray-900/70">
      <img
        src="/avatar.jpg"
        alt={profile.name}
        className="mx-auto h-36 w-36 rounded-full object-cover ring-4 ring-blue-100 shadow-lg dark:ring-blue-900"
      />
      <h2 className="mt-5 text-center text-xl font-bold text-gray-900 dark:text-white">
        {profile.name}
      </h2>
      <p className="mt-1 text-center text-sm font-medium text-blue-800 dark:text-blue-300">
        {profile.title}
      </p>
      <p className="text-center text-sm text-gray-500 dark:text-gray-400">
        {profile.company} · {profile.location}
      </p>

      <div className="mt-6 space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
          Highlights
        </p>
        <ul className="space-y-2">
          {profile.highlights.map((highlight) => (
            <li
              key={highlight}
              className="rounded-lg border border-blue-100 bg-blue-50/60 px-3 py-2 text-sm text-blue-900 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-200"
            >
              {highlight}
            </li>
          ))}
        </ul>
      </div>

      <a
        href={profile.linkedinUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-auto inline-flex items-center justify-center gap-2 rounded-full bg-[#0A66C2] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#004182]"
      >
        <LinkedInIcon className="h-4 w-4" />
        Connect on LinkedIn
      </a>
    </aside>
  );
}
