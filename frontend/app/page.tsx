import Twin from '@/components/twin';

export default function Home() {
  return (
    <div className="flex h-dvh w-full flex-col overflow-hidden bg-gray-100">
      <header className="shrink-0 border-b border-gray-200 bg-white px-4 py-2 text-center">
        <h1 className="text-lg font-bold text-gray-800 md:text-xl">
          Get to Know About Lakshman Yeluri
        </h1>
        <p className="text-xs text-gray-600 md:text-sm">
          Senior Technical Program Manager - Amazon
        </p>
      </header>

      <div className="min-h-0 flex-1">
        <Twin />
      </div>
    </div>
  );
}
