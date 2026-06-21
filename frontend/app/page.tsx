import Twin from '@/components/twin';
import { profile } from '@/lib/profile';

export default function Home() {
  return (
    <div className="page-texture flex h-dvh w-full flex-col overflow-hidden bg-gradient-to-br from-slate-50 via-white to-blue-50">
      <header className="shrink-0 border-b border-white/60 bg-white/80 px-4 py-3 shadow-sm backdrop-blur-sm">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <img
              src="/avatar.jpg"
              alt={profile.name}
              className="h-10 w-10 rounded-full object-cover ring-2 ring-blue-100"
            />
            <div>
              <h1 className="text-base font-bold text-gray-900 md:text-lg">
                {profile.name}
              </h1>
              <p className="text-xs text-gray-600 md:text-sm">
                {profile.title} · {profile.company}
              </p>
            </div>
          </div>
          <p className="hidden text-xs text-gray-400 sm:block">
            Digital Avatar
          </p>
        </div>
      </header>

      <div className="min-h-0 flex-1">
        <Twin />
      </div>
    </div>
  );
}
