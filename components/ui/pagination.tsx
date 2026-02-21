'use client';

import { useState, useCallback, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';

const PAGE_SIZE_OPTIONS: readonly [10, 20, 50, 100] = [10, 20, 50, 100];
export type PageSize = (typeof PAGE_SIZE_OPTIONS)[number];
const DEFAULT_PAGE_SIZE: PageSize = 20;

function isValidPageSize(value: number): value is PageSize {
  return value === 10 || value === 20 || value === 50 || value === 100;
}

function createStorageKey(key: string) {
  return `pagination-${key}-page-size`;
}

function getStoredPageSize(storageKey: string): PageSize {
  const stored = localStorage.getItem(storageKey);
  if (stored) {
    const parsed = parseInt(stored, 10);
    if (isValidPageSize(parsed)) {
      return parsed;
    }
  }
  return DEFAULT_PAGE_SIZE;
}

/**
 * Hook for localStorage-backed page size.
 * Returns null on first render (SSR/hydration), then the stored value.
 * This prevents hydration mismatch by not rendering until client-side.
 */
export function usePageSize(key: string): [PageSize | null, PageSize, (size: PageSize) => void] {
  const storageKey = createStorageKey(key);
  const [pageSize, setPageSizeState] = useState<PageSize | null>(null);

  // Read from localStorage after mount
  useEffect(() => {
    setPageSizeState(getStoredPageSize(storageKey));
  }, [storageKey]);

  const setPageSize = useCallback(
    (size: PageSize) => {
      localStorage.setItem(storageKey, String(size));
      setPageSizeState(size);
    },
    [storageKey]
  );

  // Return: [actual value (null during SSR), default for calculations, setter]
  return [pageSize, pageSize ?? DEFAULT_PAGE_SIZE, setPageSize];
}

type PaginationProps = {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  pageSize: PageSize;
  /** Set to false during SSR/hydration to hide page size selector until value is known */
  hydrated?: boolean;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: PageSize) => void;
};

export function Pagination({
  currentPage,
  totalPages,
  totalItems,
  pageSize,
  hydrated = true,
  onPageChange,
  onPageSizeChange
}: PaginationProps) {
  const handlePageSizeChange = (value: string | null) => {
    if (!value) return;
    const size = parseInt(value, 10);
    if (!isValidPageSize(size)) return;
    onPageSizeChange(size);
  };

  // Only show if there's more than one page or if total items > smallest page size option
  if (totalPages <= 1 && totalItems <= PAGE_SIZE_OPTIONS[0]) {
    return null;
  }

  return (
    <div className="flex items-center justify-between gap-2">
      {/* Hide page size selector until hydrated to prevent flash */}
      <div className={`flex items-center gap-2 ${hydrated ? '' : 'invisible'}`}>
        <Select value={String(pageSize)} onValueChange={handlePageSizeChange}>
          <SelectTrigger className="h-8 w-[70px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PAGE_SIZE_OPTIONS.map(size => (
              <SelectItem key={size} value={String(size)}>
                {size}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-muted-foreground text-sm">per page</span>
      </div>
      {totalPages > 1 && (
        <div className="flex items-center gap-2">
          <p className="text-muted-foreground hidden text-sm sm:block">
            Page {currentPage} of {totalPages}
          </p>
          <div className="flex gap-1">
            <Button
              variant="outline"
              size="icon-sm"
              onClick={() => onPageChange(currentPage - 1)}
              disabled={currentPage <= 1}
            >
              <ChevronLeft className="size-4" />
            </Button>
            <Button
              variant="outline"
              size="icon-sm"
              onClick={() => onPageChange(currentPage + 1)}
              disabled={currentPage >= totalPages}
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
