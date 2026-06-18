import { PackageSearch } from 'lucide-react';

export default function Page() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="max-w-lg rounded-2xl border border-amber-200 bg-amber-50 p-8 text-center">
        <PackageSearch className="mx-auto mb-4 h-10 w-10 text-amber-600" />
        <h1 className="text-2xl font-bold text-zinc-900">Stock en preparación</h1>
        <p className="mt-2 text-zinc-700">
          El trabajo del módulo se conserva, pero todavía no está disponible en producción.
        </p>
      </div>
    </div>
  );
}
