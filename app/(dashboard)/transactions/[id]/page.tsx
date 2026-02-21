import { Suspense } from 'react';
import { Effect } from 'effect';
import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import { NextEffect } from '@/lib/next-effect';
import { AppLayer } from '@/lib/layers';
import { getTransactionById, getAllCategories } from '@/lib/core/transaction/queries';
import { TransactionForm } from './transaction-form';
import { LoadingFallback } from '../../loading-fallback';

export const dynamic = 'force-dynamic';

type Props = {
  params: Promise<{ id: string }>;
};

async function Content({ params }: Props) {
  await cookies();
  const { id } = await params;

  return await NextEffect.runPromise(
    Effect.gen(function* () {
      const [transaction, categories] = yield* Effect.all([
        getTransactionById(id),
        getAllCategories()
      ]);

      if (!transaction) {
        notFound();
      }

      return <TransactionForm transaction={transaction} categories={categories} isNew={false} />;
    }).pipe(Effect.provide(AppLayer), Effect.scoped)
  );
}

export default async function TransactionDetailPage({ params }: Props) {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <Content params={params} />
    </Suspense>
  );
}
