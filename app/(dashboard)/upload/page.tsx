import { Suspense } from 'react';
import { UploadForm } from './upload-form';
import { LoadingFallback } from '../loading-fallback';

export const dynamic = 'force-dynamic';

function Content() {
  return (
    <main className="min-h-screen p-4 sm:p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Upload Transactions</h1>
          <p className="text-muted-foreground mt-1">
            Import transactions from a Handelsbanken Excel export
          </p>
        </div>

        <UploadForm />

        <p className="text-muted-foreground text-center text-sm">
          Duplicates are automatically detected and skipped based on date, merchant, and amount.
        </p>
      </div>
    </main>
  );
}

export default async function UploadPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <Content />
    </Suspense>
  );
}
