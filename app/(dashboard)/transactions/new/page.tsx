import { Suspense } from 'react';
import { Effect } from 'effect';
import { cookies } from 'next/headers';
import { NextEffect } from '@/lib/next-effect';
import { AppLayer } from '@/lib/layers';
import { getAllCategories } from '@/lib/core/transaction/queries';
import { TransactionForm } from '../[id]/transaction-form';
import { LoadingFallback } from '../../loading-fallback';

export const dynamic = 'force-dynamic';

async function Content() {
  await cookies();

  return await NextEffect.runPromise(
    Effect.gen(function* () {
      const categories = yield* getAllCategories();
      return <TransactionForm transaction={null} categories={categories} isNew={true} />;
    }).pipe(Effect.provide(AppLayer), Effect.scoped)
  );
}

export default async function NewTransactionPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <Content />
    </Suspense>
  );
}
