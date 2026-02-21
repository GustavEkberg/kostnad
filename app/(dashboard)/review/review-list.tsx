'use client';

import { useState, useTransition, useRef, useMemo } from 'react';
import { toast } from 'sonner';
import {
  Check,
  CheckCircle2,
  Loader2,
  Plus,
  Sparkles,
  Store,
  Layers,
  X,
  Trash2
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { Pagination, usePageSize } from '@/components/ui/pagination';
import { categorizeTransactionAction } from '@/lib/core/transaction/categorize-transaction-action';
import { deleteTransactionAction } from '@/lib/core/transaction/delete-transaction-action';
import { markMultiMerchantAction } from '@/lib/core/transaction/mark-multi-merchant-action';
import { unmarkMultiMerchantAction } from '@/lib/core/transaction/unmark-multi-merchant-action';
import { suggestCategoriesAction } from '@/lib/core/transaction/suggest-categories-action';
import { createCategoryAction } from '@/lib/core/category/create-category-action';
import type { CategorySuggestion } from '@/lib/core/transaction/suggest-categories';

type Transaction = {
  id: string;
  date: Date;
  merchant: string;
  amount: number;
  balance: number | null;
};

type Category = {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  isDefault: boolean;
};

type Props = {
  transactions: Transaction[];
  categories: Category[];
  multiMerchantPatterns: string[];
};

export function ReviewList({
  transactions: initialTransactions,
  categories: initialCategories,
  multiMerchantPatterns: initialMultiMerchantPatterns
}: Props) {
  const [transactions, setTransactions] = useState(initialTransactions);
  const [categories, setCategories] = useState(initialCategories);
  const [multiMerchantPatterns, setMultiMerchantPatterns] = useState(initialMultiMerchantPatterns);
  const [suggestions, setSuggestions] = useState<CategorySuggestion[]>([]);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isSuggesting, startSuggestTransition] = useTransition();
  const [creatingForTxId, setCreatingForTxId] = useState<string | null>(null);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryDescription, setNewCategoryDescription] = useState('');
  const [newCategoryIcon, setNewCategoryIcon] = useState('');
  const [isCreating, startCreateTransition] = useTransition();
  const nameInputRef = useRef<HTMLInputElement>(null);

  // Pagination state - localStorage-backed with SSR support
  // pageSizeHydrated is null during SSR, pageSize has default fallback for calculations
  const [pageSizeHydrated, pageSize, setPageSize] = usePageSize('review');
  const [currentPage, setCurrentPage] = useState(1);

  const totalPages = Math.ceil(transactions.length / pageSize);

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
    setSuggestions([]);
  };

  const handlePageSizeChange = (newSize: typeof pageSize) => {
    setPageSize(newSize);
    setCurrentPage(1);
    setSuggestions([]);
  };

  // Paginated view - only for display and AI suggestions
  const paginatedTransactions = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return transactions.slice(start, start + pageSize);
  }, [transactions, currentPage, pageSize]);

  // Build lookup for suggestions
  const suggestionMap = new Map(suggestions.map(s => [s.transactionId, s]));

  const handleSuggest = () => {
    startSuggestTransition(async () => {
      // Only request suggestions for currently visible (paginated) transactions
      const result = await suggestCategoriesAction(
        paginatedTransactions.map(t => ({ id: t.id, merchant: t.merchant, amount: t.amount })),
        categories.map(c => ({ id: c.id, name: c.name, description: c.description, icon: c.icon }))
      );

      if (result._tag === 'Error') {
        toast.error(result.message);
        return;
      }

      setSuggestions(result.suggestions);
      const count = result.suggestions.filter(s => s.suggestedCategoryId).length;
      toast.success(`AI suggested ${count} categories`);
    });
  };

  const handleCategorize = (transactionId: string, categoryId: string) => {
    // Special value to trigger new category creation
    if (categoryId === '__new__') {
      setCreatingForTxId(transactionId);
      setNewCategoryName('');
      setNewCategoryDescription('');
      setNewCategoryIcon('');
      setTimeout(() => nameInputRef.current?.focus(), 0);
      return;
    }

    // Find the merchant name for this transaction
    const tx = transactions.find(t => t.id === transactionId);
    const merchant = tx?.merchant;
    const multiMerchant = merchant ? isMultiMerchant(merchant) : false;

    setPendingId(transactionId);

    startTransition(async () => {
      const result = await categorizeTransactionAction({ transactionId, categoryId });

      if (result._tag === 'Error') {
        toast.error(result.message);
        setPendingId(null);
        return;
      }

      // Multi-merchant: only remove this transaction
      // Normal merchant: remove all with same merchant
      setTransactions(prev => {
        const filtered = multiMerchant
          ? prev.filter(t => t.id !== transactionId)
          : prev.filter(t => t.merchant !== merchant);

        // Adjust page if current page would be empty
        const newTotalPages = Math.ceil(filtered.length / pageSize);
        if (currentPage > newTotalPages && newTotalPages > 0) {
          setCurrentPage(newTotalPages);
        }

        return filtered;
      });
      setPendingId(null);

      const categoryName = categories.find(c => c.id === categoryId)?.name ?? 'category';
      if (result.updatedCount > 1) {
        toast.success(`Categorized ${result.updatedCount} transactions as ${categoryName}`);
      } else {
        toast.success(`Categorized as ${categoryName}`);
      }
    });
  };

  const handleCreateCategory = (transactionId: string) => {
    if (!newCategoryName.trim()) {
      toast.error('Category name required');
      return;
    }

    startCreateTransition(async () => {
      const result = await createCategoryAction({
        name: newCategoryName.trim(),
        description: newCategoryDescription.trim() || undefined,
        icon: newCategoryIcon.trim() || undefined
      });

      if (result._tag === 'Error') {
        toast.error(result.message);
        return;
      }

      // Add new category to local state
      const newCat = {
        ...result.category,
        description: result.category.description ?? null,
        icon: result.category.icon ?? null
      };
      setCategories(prev => [...prev, newCat].sort((a, b) => a.name.localeCompare(b.name)));

      // Now categorize the transaction with the new category
      setCreatingForTxId(null);
      setNewCategoryName('');
      setNewCategoryDescription('');
      setNewCategoryIcon('');
      handleCategorize(transactionId, result.category.id);
    });
  };

  const cancelCreate = () => {
    setCreatingForTxId(null);
    setNewCategoryName('');
    setNewCategoryDescription('');
    setNewCategoryIcon('');
  };

  const handleDelete = (transactionId: string) => {
    setPendingId(transactionId);

    startTransition(async () => {
      const result = await deleteTransactionAction({ id: transactionId });

      if (result._tag === 'Error') {
        toast.error(result.message);
        setPendingId(null);
        return;
      }

      setTransactions(prev => {
        const filtered = prev.filter(t => t.id !== transactionId);
        const newTotalPages = Math.ceil(filtered.length / pageSize);
        if (currentPage > newTotalPages && newTotalPages > 0) {
          setCurrentPage(newTotalPages);
        }
        return filtered;
      });
      setPendingId(null);
      toast.success('Transaction deleted');
    });
  };

  const handleMarkMultiMerchant = (transactionId: string) => {
    const tx = transactions.find(t => t.id === transactionId);
    if (!tx) return;

    setPendingId(transactionId);

    startTransition(async () => {
      const result = await markMultiMerchantAction({ transactionId });

      if (result._tag === 'Error') {
        toast.error(result.message);
        setPendingId(null);
        return;
      }

      // Add to local multi-merchant patterns (transaction stays in list for categorization)
      setMultiMerchantPatterns(prev => [...prev, result.merchant]);
      setPendingId(null);
      toast.success(`Marked "${result.merchant}" as multi-merchant`);
    });
  };

  const handleUnmarkMultiMerchant = (transactionId: string) => {
    const tx = transactions.find(t => t.id === transactionId);
    if (!tx) return;

    setPendingId(transactionId);

    startTransition(async () => {
      const result = await unmarkMultiMerchantAction({ transactionId });

      if (result._tag === 'Error') {
        toast.error(result.message);
        setPendingId(null);
        return;
      }

      // Remove from local multi-merchant patterns
      setMultiMerchantPatterns(prev => prev.filter(p => p !== result.merchant));
      setPendingId(null);
      toast.success(`Removed "${result.merchant}" from multi-merchants`);
    });
  };

  // Check if a merchant is marked as multi-merchant
  const isMultiMerchant = (merchant: string) => {
    const merchantLower = merchant.toLowerCase();
    return multiMerchantPatterns.some(pattern => merchantLower.includes(pattern.toLowerCase()));
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('sv-SE');
  };

  const formatAmount = (amount: number) => {
    const formatted = new Intl.NumberFormat('sv-SE', {
      style: 'currency',
      currency: 'SEK',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(Math.abs(amount));

    return amount < 0 ? `-${formatted}` : `+${formatted}`;
  };

  const getConfidenceBadge = (confidence: 'high' | 'medium' | 'low') => {
    switch (confidence) {
      case 'high':
        return {
          text: 'High',
          className: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
        };
      case 'medium':
        return {
          text: 'Medium',
          className: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300'
        };
      case 'low':
        return {
          text: 'Low',
          className: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300'
        };
    }
  };

  // Get category display text
  const getCategoryDisplay = (categoryId: string) => {
    const cat = categories.find(c => c.id === categoryId);
    if (!cat) return null;
    return cat.icon ? `${cat.icon} ${cat.name}` : cat.name;
  };

  // Empty state
  if (transactions.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <CheckCircle2 className="mb-4 size-12 text-green-500" />
          <h2 className="text-lg font-semibold">All caught up!</h2>
          <p className="text-muted-foreground mt-1 text-center">
            All transactions have been categorized.
          </p>
          <a
            href="/upload"
            className="text-primary mt-4 text-sm underline underline-offset-4 hover:no-underline"
          >
            Upload more transactions
          </a>
        </CardContent>
      </Card>
    );
  }

  // Don't render list until page size is hydrated from localStorage
  // This prevents flash of wrong number of items
  if (pageSizeHydrated === null) {
    return (
      <Card className="mx-auto max-w-4xl">
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="size-6 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mx-auto max-w-4xl">
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle>Uncategorized Transactions</CardTitle>
            <CardDescription>
              {transactions.length} transaction{transactions.length !== 1 ? 's' : ''} need
              categorization
              {suggestions.length > 0 && (
                <span className="ml-2 inline-flex items-center gap-1 text-xs">
                  <Sparkles className="size-3" />
                  AI suggestions applied
                </span>
              )}
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleSuggest}
            disabled={isSuggesting}
            className="shrink-0"
          >
            {isSuggesting ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                Suggesting...
              </>
            ) : (
              <>
                <Sparkles className="mr-2 size-4" />
                AI Suggest
              </>
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 px-3 sm:px-6">
        {paginatedTransactions.map(tx => {
          const isProcessing = pendingId === tx.id && isPending;
          const suggestion = suggestionMap.get(tx.id);

          return (
            <div key={tx.id} className="border-border rounded-lg border p-3">
              {/* Desktop: single row */}
              <div className="hidden items-center gap-4 sm:flex">
                {/* Date */}
                <div className="text-muted-foreground w-24 shrink-0 text-sm">
                  {formatDate(tx.date)}
                </div>

                {/* Multi-merchant toggle + Merchant */}
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  {isMultiMerchant(tx.merchant) ? (
                    <button
                      type="button"
                      onClick={() => handleUnmarkMultiMerchant(tx.id)}
                      disabled={isProcessing}
                      className="text-amber-600 hover:text-muted-foreground shrink-0 transition-colors disabled:opacity-50"
                      title="Remove multi-merchant flag"
                    >
                      <Layers className="size-4" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleMarkMultiMerchant(tx.id)}
                      disabled={isProcessing}
                      className="text-muted-foreground hover:text-amber-600 shrink-0 transition-colors disabled:opacity-50"
                      title="Mark as multi-merchant (always requires review)"
                    >
                      <Store className="size-4" />
                    </button>
                  )}
                  <a
                    href={`/transactions?search=${encodeURIComponent(tx.merchant)}`}
                    className="truncate font-medium hover:underline"
                  >
                    {tx.merchant}
                  </a>
                </div>

                {/* Amount */}
                <div
                  className={`w-24 shrink-0 text-right font-mono text-sm ${
                    tx.amount < 0
                      ? 'text-red-600 dark:text-red-400'
                      : 'text-green-600 dark:text-green-400'
                  }`}
                >
                  {formatAmount(tx.amount)}
                </div>

                {/* Category selector */}
                <div className="w-44 shrink-0">
                  {isProcessing ? (
                    <div className="flex h-9 items-center justify-center">
                      <Loader2 className="size-4 animate-spin" />
                    </div>
                  ) : creatingForTxId === tx.id ? (
                    <div className="flex flex-col gap-1">
                      <div className="flex gap-1">
                        <Input
                          value={newCategoryIcon}
                          onChange={e => setNewCategoryIcon(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Escape') cancelCreate();
                          }}
                          placeholder="Icon"
                          className="h-8 w-12 px-1 text-center text-sm"
                          disabled={isCreating}
                          maxLength={4}
                        />
                        <Input
                          ref={nameInputRef}
                          value={newCategoryName}
                          onChange={e => setNewCategoryName(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') handleCreateCategory(tx.id);
                            if (e.key === 'Escape') cancelCreate();
                          }}
                          placeholder="Name"
                          className="h-8 flex-1 text-sm"
                          disabled={isCreating}
                        />
                      </div>
                      <div className="flex gap-1">
                        <Input
                          value={newCategoryDescription}
                          onChange={e => setNewCategoryDescription(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') handleCreateCategory(tx.id);
                            if (e.key === 'Escape') cancelCreate();
                          }}
                          placeholder="Description (optional)"
                          className="h-8 flex-1 text-sm"
                          disabled={isCreating}
                        />
                        <Button
                          size="sm"
                          className="h-8 px-2"
                          onClick={() => handleCreateCategory(tx.id)}
                          disabled={isCreating || !newCategoryName.trim()}
                        >
                          {isCreating ? (
                            <Loader2 className="size-4 animate-spin" />
                          ) : (
                            <Check className="size-4" />
                          )}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <Select
                      onValueChange={(value: string | null) =>
                        value && handleCategorize(tx.id, value)
                      }
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select category">
                          {suggestion?.suggestedCategoryId
                            ? getCategoryDisplay(suggestion.suggestedCategoryId)
                            : 'Select category'}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map(cat => (
                          <SelectItem key={cat.id} value={cat.id}>
                            {cat.icon ? `${cat.icon} ` : ''}
                            {cat.name}
                          </SelectItem>
                        ))}
                        <SelectItem value="__new__" className="text-primary">
                          <Plus className="mr-1 inline size-3" />
                          New category...
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                </div>

                {/* AI confidence badge - click to accept */}
                {suggestion?.suggestedCategoryId && !isProcessing && (
                  <button
                    type="button"
                    onClick={() => handleCategorize(tx.id, suggestion.suggestedCategoryId!)}
                    className={`group shrink-0 cursor-pointer rounded px-2 py-1 text-center text-xs font-medium transition-colors hover:bg-green-600 hover:text-white ${getConfidenceBadge(suggestion.confidence).className}`}
                  >
                    <span className="group-hover:hidden">
                      {getConfidenceBadge(suggestion.confidence).text}
                    </span>
                    <Check className="mx-auto hidden size-4 group-hover:block" />
                  </button>
                )}

                {/* Multi-merchant button */}
                {/* Delete button */}
                <AlertDialog>
                  <AlertDialogTrigger
                    render={
                      <button
                        type="button"
                        disabled={isProcessing}
                        className="text-muted-foreground hover:text-destructive shrink-0 p-1 transition-colors disabled:opacity-50"
                        title="Delete transaction"
                      />
                    }
                  >
                    <Trash2 className="size-4" />
                  </AlertDialogTrigger>
                  <AlertDialogContent size="sm">
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete transaction?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Delete &quot;{tx.merchant}&quot;? This cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction variant="destructive" onClick={() => handleDelete(tx.id)}>
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>

              {/* Mobile: two rows */}
              <div className="space-y-2 sm:hidden">
                {/* Row 1: multi-merchant toggle + merchant + date + amount */}
                <div className="flex items-center justify-between gap-2">
                  {isMultiMerchant(tx.merchant) ? (
                    <button
                      type="button"
                      onClick={() => handleUnmarkMultiMerchant(tx.id)}
                      disabled={isProcessing}
                      className="text-amber-600 hover:text-muted-foreground shrink-0 transition-colors disabled:opacity-50"
                      title="Remove multi-merchant flag"
                    >
                      <Layers className="size-4" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleMarkMultiMerchant(tx.id)}
                      disabled={isProcessing}
                      className="text-muted-foreground hover:text-amber-600 shrink-0 transition-colors disabled:opacity-50"
                      title="Mark as multi-merchant"
                    >
                      <Store className="size-4" />
                    </button>
                  )}
                  <a
                    href={`/transactions?search=${encodeURIComponent(tx.merchant)}`}
                    className="min-w-0 flex-1 truncate font-medium hover:underline"
                  >
                    {tx.merchant}
                  </a>
                  <span className="text-muted-foreground shrink-0 text-sm">
                    {formatDate(tx.date)}
                  </span>
                  <span
                    className={`shrink-0 font-mono text-sm ${
                      tx.amount < 0
                        ? 'text-red-600 dark:text-red-400'
                        : 'text-green-600 dark:text-green-400'
                    }`}
                  >
                    {formatAmount(tx.amount)}
                  </span>
                </div>

                {/* Row 2: category selector + actions */}
                <div className="flex items-center gap-2">
                  {isProcessing ? (
                    <div className="flex h-10 flex-1 items-center justify-center">
                      <Loader2 className="size-4 animate-spin" />
                    </div>
                  ) : creatingForTxId === tx.id ? (
                    <div className="flex flex-1 flex-col gap-2">
                      <div className="flex gap-2">
                        <Input
                          value={newCategoryIcon}
                          onChange={e => setNewCategoryIcon(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Escape') cancelCreate();
                          }}
                          placeholder="Icon"
                          className="h-10 w-14 px-2 text-center"
                          disabled={isCreating}
                          maxLength={4}
                        />
                        <Input
                          ref={nameInputRef}
                          value={newCategoryName}
                          onChange={e => setNewCategoryName(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') handleCreateCategory(tx.id);
                            if (e.key === 'Escape') cancelCreate();
                          }}
                          placeholder="Name"
                          className="h-10 flex-1"
                          disabled={isCreating}
                        />
                      </div>
                      <div className="flex gap-2">
                        <Input
                          value={newCategoryDescription}
                          onChange={e => setNewCategoryDescription(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') handleCreateCategory(tx.id);
                            if (e.key === 'Escape') cancelCreate();
                          }}
                          placeholder="Description"
                          className="h-10 flex-1"
                          disabled={isCreating}
                        />
                        <Button
                          size="icon"
                          onClick={() => handleCreateCategory(tx.id)}
                          disabled={isCreating || !newCategoryName.trim()}
                        >
                          {isCreating ? (
                            <Loader2 className="size-4 animate-spin" />
                          ) : (
                            <Check className="size-4" />
                          )}
                        </Button>
                        <Button size="icon" variant="outline" onClick={cancelCreate}>
                          <X className="size-4" />
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <Select
                        onValueChange={(value: string | null) =>
                          value && handleCategorize(tx.id, value)
                        }
                      >
                        <SelectTrigger className="h-10 flex-1">
                          <SelectValue placeholder="Select category">
                            {suggestion?.suggestedCategoryId
                              ? getCategoryDisplay(suggestion.suggestedCategoryId)
                              : 'Select category'}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {categories.map(cat => (
                            <SelectItem key={cat.id} value={cat.id}>
                              {cat.icon ? `${cat.icon} ` : ''}
                              {cat.name}
                            </SelectItem>
                          ))}
                          <SelectItem value="__new__" className="text-primary">
                            <Plus className="mr-1 inline size-3" />
                            New category...
                          </SelectItem>
                        </SelectContent>
                      </Select>

                      {/* AI confidence badge */}
                      {suggestion?.suggestedCategoryId && !isProcessing && (
                        <button
                          type="button"
                          onClick={() => handleCategorize(tx.id, suggestion.suggestedCategoryId!)}
                          className={`group shrink-0 cursor-pointer rounded px-3 py-2 text-xs font-medium transition-colors hover:bg-green-600 hover:text-white ${getConfidenceBadge(suggestion.confidence).className}`}
                        >
                          <span className="group-hover:hidden">
                            {getConfidenceBadge(suggestion.confidence).text}
                          </span>
                          <Check className="mx-auto hidden size-4 group-hover:block" />
                        </button>
                      )}

                      {/* Delete button */}
                      <AlertDialog>
                        <AlertDialogTrigger
                          render={
                            <button
                              type="button"
                              disabled={isProcessing}
                              className="text-muted-foreground hover:text-destructive shrink-0 p-2 transition-colors disabled:opacity-50"
                              title="Delete transaction"
                            />
                          }
                        >
                          <Trash2 className="size-4" />
                        </AlertDialogTrigger>
                        <AlertDialogContent size="sm">
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete transaction?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Delete &quot;{tx.merchant}&quot;? This cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              variant="destructive"
                              onClick={() => handleDelete(tx.id)}
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </CardContent>

      {/* Pagination */}
      <div className="px-3 pb-4 sm:px-6">
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={transactions.length}
          pageSize={pageSize}
          hydrated={pageSizeHydrated !== null}
          onPageChange={handlePageChange}
          onPageSizeChange={handlePageSizeChange}
        />
      </div>
    </Card>
  );
}
