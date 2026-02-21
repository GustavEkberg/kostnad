import { Suspense } from 'react';
import { Effect } from 'effect';
import { cookies } from 'next/headers';
import { NextEffect } from '@/lib/next-effect';
import { AppLayer } from '@/lib/layers';
import { getCategoriesWithDetails } from '@/lib/core/transaction/queries';
import { CategoryList } from './category-list';
import { LoadingFallback } from '../loading-fallback';

export const dynamic = 'force-dynamic';

async function Content() {
  await cookies();

  return await NextEffect.runPromise(
    Effect.gen(function* () {
      const categories = yield* getCategoriesWithDetails();

      return (
        <main className="min-h-screen p-4 sm:p-8">
          <div className="mx-auto max-w-6xl space-y-6">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">Categories</h1>
              <p className="text-muted-foreground mt-1">
                Manage expense categories and merchant mappings
              </p>
            </div>

            <CategoryList categories={categories} />
          </div>
        </main>
      );
    }).pipe(Effect.provide(AppLayer), Effect.scoped)
  );
}

export default async function CategoriesPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <Content />
    </Suspense>
  );
}
