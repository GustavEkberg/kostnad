import { Effect } from 'effect';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { Header } from './header';
import { getSession } from '@/lib/services/auth/get-session';
import { getUncategorizedCount } from '@/lib/core/transaction/queries';
import { AppLayer } from '@/lib/layers';
import { LandingPage } from '../landing-page';

export const dynamic = 'force-dynamic';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const headersList = await headers();
  const pathname = headersList.get('x-pathname') ?? '/';

  const result = await Effect.runPromise(
    Effect.gen(function* () {
      const session = yield* Effect.option(getSession());
      if (session._tag === 'None') {
        return { authenticated: false as const };
      }
      const uncategorizedCount = yield* getUncategorizedCount();
      return { authenticated: true as const, uncategorizedCount };
    }).pipe(Effect.provide(AppLayer), Effect.scoped)
  );

  if (!result.authenticated) {
    // Show landing page for root, redirect to login for other routes
    if (pathname === '/') {
      const country = headersList.get('x-vercel-ip-country');
      const isSweden = country === 'SE';
      return <LandingPage isSweden={isSweden} />;
    }
    redirect('/login');
  }

  return (
    <>
      <Header uncategorizedCount={result.uncategorizedCount} />
      {children}
    </>
  );
}
