import Twin from '@/components/twin';

export default function Home() {
  return (
    <main className="h-screen flex flex-col bg-gradient-to-br from-slate-50 to-gray-100 overflow-hidden">
      <header className="shrink-0 px-4 pt-4 pb-3 text-center">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-800 mb-1">
          Get to Know About Lakshman Yeluri
        </h1>
        <p className="text-sm md:text-base text-gray-600">
          Senior Technical Program Manager - Amazon
        </p>
      </header>

      <div className="flex-1 min-h-0 px-3 pb-3 md:px-4 md:pb-4">
        <Twin />
      </div>
    </main>
  );
}
