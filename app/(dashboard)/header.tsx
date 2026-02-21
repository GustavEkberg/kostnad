'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  MenuIcon,
  UploadIcon,
  SettingsIcon,
  LogOutIcon,
  HomeIcon,
  BarChart3Icon,
  ListChecksIcon,
  StoreIcon,
  ReceiptIcon,
  TagIcon
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { authClient } from '@/lib/services/auth/auth-client';

type Props = {
  uncategorizedCount: number;
};

export function Header({ uncategorizedCount }: Props) {
  const pathname = usePathname();

  const isActive = (href: string) => (href === '/' ? pathname === '/' : pathname.startsWith(href));

  const handleLogout = () => {
    authClient.signOut({
      fetchOptions: {
        onSuccess: () => {
          window.location.href = '/';
        }
      }
    });
  };

  return (
    <header className="border-border/40 bg-background/95 supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50 w-full border-b backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
        <Link href="/" className="text-lg font-semibold tracking-tight">
          Kostnad
        </Link>

        <div className="flex items-center gap-4">
          {/* Desktop nav */}
          <nav className="hidden items-center gap-4 sm:flex">
            <Link
              href="/"
              className={`text-sm transition-colors ${isActive('/') ? 'text-foreground font-semibold' : 'text-muted-foreground hover:text-foreground'}`}
            >
              Dashboard
            </Link>
            <Link
              href="/analytics"
              className={`text-sm transition-colors ${isActive('/analytics') ? 'text-foreground font-semibold' : 'text-muted-foreground hover:text-foreground'}`}
            >
              Analytics
            </Link>
            <Link
              href="/merchants"
              className={`text-sm transition-colors ${isActive('/merchant') ? 'text-foreground font-semibold' : 'text-muted-foreground hover:text-foreground'}`}
            >
              Merchants
            </Link>
            <Link
              href="/transactions"
              className={`text-sm transition-colors ${isActive('/transactions') ? 'text-foreground font-semibold' : 'text-muted-foreground hover:text-foreground'}`}
            >
              Transactions
            </Link>
            <Link
              href="/categories"
              className={`text-sm transition-colors ${isActive('/categories') ? 'text-foreground font-semibold' : 'text-muted-foreground hover:text-foreground'}`}
            >
              Categories
            </Link>
            <Link
              href="/review"
              className={`flex items-center gap-1.5 text-sm transition-colors ${isActive('/review') ? 'text-foreground font-semibold' : 'text-muted-foreground hover:text-foreground'}`}
            >
              Review
              {uncategorizedCount > 0 && (
                <span className="bg-foreground text-background rounded-full px-1.5 py-0.5 text-xs font-medium">
                  {uncategorizedCount}
                </span>
              )}
            </Link>
          </nav>

          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="ghost" size="icon" aria-label="Menu" />}>
              <MenuIcon className="size-5" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              {/* Mobile only */}
              <DropdownMenuItem render={<Link href="/" />} className="sm:hidden">
                <HomeIcon />
                Dashboard
              </DropdownMenuItem>
              <DropdownMenuItem render={<Link href="/analytics" />} className="sm:hidden">
                <BarChart3Icon />
                Analytics
              </DropdownMenuItem>
              <DropdownMenuItem render={<Link href="/merchants" />} className="sm:hidden">
                <StoreIcon />
                Merchants
              </DropdownMenuItem>
              <DropdownMenuItem render={<Link href="/transactions" />} className="sm:hidden">
                <ReceiptIcon />
                Transactions
              </DropdownMenuItem>
              <DropdownMenuItem render={<Link href="/categories" />} className="sm:hidden">
                <TagIcon />
                Categories
              </DropdownMenuItem>
              <DropdownMenuItem render={<Link href="/review" />} className="sm:hidden">
                <ListChecksIcon />
                <span className="flex-1">Review</span>
                {uncategorizedCount > 0 && (
                  <span className="bg-foreground text-background rounded-full px-1.5 py-0.5 text-xs font-medium">
                    {uncategorizedCount}
                  </span>
                )}
              </DropdownMenuItem>
              <DropdownMenuItem render={<Link href="/upload" />}>
                <UploadIcon />
                Upload
              </DropdownMenuItem>
              <DropdownMenuItem render={<Link href="/settings" />}>
                <SettingsIcon />
                Settings
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout} variant="destructive">
                <LogOutIcon />
                Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
