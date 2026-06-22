'use client';

import { useEffect, useState } from 'react';
import { LinkedInIcon } from '@/components/linkedin-icon';
import { profile } from '@/lib/profile';

export default function ProfileDrawer() {
  const [open, setOpen] = useState(false);
  const [avatarSrc, setAvatarSrc] = useState('/avatar.jpg');

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const toggle = () => setOpen((value) => !value);

  return (
    <aside
      className={`flex h-full shrink-0 flex-col overflow-hidden border-r border-gray-200 bg-white transition-[width] duration-300 ease-in-out dark:border-gray-700 dark:bg-gray-900 ${
        open ? 'w-72' : 'w-14'
      }`}
      aria-label="Profile sidebar"
    >
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-label={open ? 'Close profile menu' : 'Open profile menu'}
        className="flex h-16 shrink-0 items-center justify-center border-b border-gray-200 text-gray-700 transition-colors hover:bg-blue-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
      >
        <span className={`hamburger-icon ${open ? 'is-open' : ''}`}>
          <span className="hamburger-line" />
          <span className="hamburger-line" />
          <span className="hamburger-line" />
        </span>
      </button>

      {open && (
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-5">
          <img
            src={avatarSrc}
            alt={profile.name}
            onError={() => setAvatarSrc('/icon.png')}
            className="mx-auto h-28 w-28 rounded-full object-cover ring-4 ring-blue-100 shadow-lg dark:ring-blue-900"
          />
          <h2 className="mt-4 text-center text-lg font-bold text-gray-900 dark:text-white">
            {profile.name}
          </h2>
          <p className="mt-1 text-center text-sm font-medium text-blue-800 dark:text-blue-300">
            {profile.title}
          </p>
          <p className="mt-1 text-center text-sm text-gray-500 dark:text-gray-400">
            {profile.company} · {profile.location}
          </p>
          <p className="mt-3 text-center text-sm leading-relaxed text-gray-600 dark:text-gray-300">
            {profile.tagline}
          </p>

          <a
            href={profile.linkedinUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-6 inline-flex items-center justify-center gap-2 rounded-full bg-[#0A66C2] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#004182]"
          >
            <LinkedInIcon className="h-4 w-4" />
            Connect on LinkedIn
          </a>
        </div>
      )}
    </aside>
  );
}
