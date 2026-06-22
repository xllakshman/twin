'use client';

import { Moon, Sun } from 'lucide-react';
import { useEffect, useState } from 'react';
import ProfileSidebar from '@/components/profile-drawer';
import SiteFooter from '@/components/site-footer';
import Twin from '@/components/twin';
import { profile } from '@/lib/profile';

export default function HomeShell() {
  const [darkMode, setDarkMode] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
  }, [darkMode]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setDrawerOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  return (
    <div className="page-texture flex h-dvh w-full flex-col overflow-hidden bg-gradient-to-br from-slate-50 via-white to-blue-50 dark:from-gray-950 dark:via-gray-900 dark:to-slate-900">
      <header className="flex h-16 shrink-0 items-stretch border-b border-gray-200 bg-white/90 shadow-sm backdrop-blur-sm dark:border-gray-700 dark:bg-gray-900/90">
        <button
          type="button"
          onClick={() => setDrawerOpen((value) => !value)}
          aria-expanded={drawerOpen}
          aria-label={drawerOpen ? 'Close profile menu' : 'Open profile menu'}
          className="flex w-14 shrink-0 items-center justify-center border-r border-gray-200 text-gray-700 transition-colors hover:bg-slate-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
        >
          <span className={`hamburger-icon ${drawerOpen ? 'is-open' : ''}`}>
            <span className="hamburger-line" />
            <span className="hamburger-line" />
            <span className="hamburger-line" />
          </span>
        </button>

        <div className="flex min-w-0 flex-1 items-center px-4">
          <div className="min-w-0">
            <h1 className="truncate text-base font-bold text-gray-900 dark:text-white md:text-lg">
              {profile.name}
            </h1>
            <p className="truncate text-xs text-gray-600 dark:text-gray-400 md:text-sm">
              {profile.title} · {profile.company}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2 px-4">
          <p className="hidden text-xs text-gray-400 sm:block dark:text-gray-500">
            Digital Avatar
          </p>
          <button
            type="button"
            onClick={() => setDarkMode((value) => !value)}
            className="rounded-full border border-gray-200 bg-white p-2 text-gray-600 shadow-sm transition-colors hover:border-blue-200 hover:text-blue-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:border-blue-700 dark:hover:text-blue-300"
            aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
        </div>
      </header>

      <div className="flex min-h-0 min-w-0 flex-1">
        {drawerOpen && <ProfileSidebar />}

        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <Twin />
          <SiteFooter />
        </div>
      </div>
    </div>
  );
}
