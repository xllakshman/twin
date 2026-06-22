'use client';

import { useEffect, useState } from 'react';
import { LinkedInIcon } from '@/components/linkedin-icon';
import { profile } from '@/lib/profile';

export default function ProfileDrawer() {
  const [open, setOpen] = useState(false);
  const [avatarSrc, setAvatarSrc] = useState('/avatar.png');

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    if (open) window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open]);

  const toggle = () => setOpen((value) => !value);
  const close = () => setOpen(false);

  return (
    <>
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-label={open ? 'Close profile menu' : 'Open profile menu'}
        className="relative z-[70] flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-700 shadow-sm transition-colors hover:border-blue-200 hover:bg-blue-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:border-blue-700 dark:hover:bg-gray-700"
      >
        <span className={`hamburger-icon ${open ? 'is-open' : ''}`}>
          <span className="hamburger-line" />
          <span className="hamburger-line" />
          <span className="hamburger-line" />
        </span>
      </button>

      {open && (
        <button
          type="button"
          className="fixed inset-0 top-16 z-40 cursor-default bg-transparent"
          onClick={close}
          aria-label="Close profile menu"
        />
      )}

      <aside
        className={`pointer-events-none fixed left-0 top-16 z-50 h-[calc(100dvh-4rem)] w-80 max-w-[85vw] transition-transform duration-300 ease-in-out ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
        aria-hidden={!open}
      >
        <div
          className="pointer-events-auto flex h-full flex-col overflow-y-auto border-r border-gray-200 bg-white p-6 shadow-2xl dark:border-gray-700 dark:bg-gray-900"
          onClick={(event) => event.stopPropagation()}
        >
          <img
            src={avatarSrc}
            alt={profile.name}
            onError={() => setAvatarSrc('/avatar.jpg')}
            className="mx-auto h-32 w-32 rounded-full object-cover ring-4 ring-blue-100 shadow-lg dark:ring-blue-900"
          />
          <h2 className="mt-5 text-center text-xl font-bold text-gray-900 dark:text-white">
            {profile.name}
          </h2>
          <p className="mt-1 text-center text-sm font-medium text-blue-800 dark:text-blue-300">
            {profile.title}
          </p>
          <p className="mt-1 text-center text-sm text-gray-500 dark:text-gray-400">
            {profile.company} · {profile.location}
          </p>
          <p className="mt-4 text-center text-sm leading-relaxed text-gray-600 dark:text-gray-300">
            {profile.tagline}
          </p>

          <a
            href={profile.linkedinUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-8 inline-flex items-center justify-center gap-2 rounded-full bg-[#0A66C2] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#004182]"
          >
            <LinkedInIcon className="h-4 w-4" />
            Connect on LinkedIn
          </a>
        </div>
      </aside>
    </>
  );
}
