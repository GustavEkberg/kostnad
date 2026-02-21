'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { ArrowLeft, Save, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
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
import { updateTransactionDetailAction } from '@/lib/core/transaction/update-transaction-detail-action';
import { deleteTransactionAction } from '@/lib/core/transaction/delete-transaction-action';
import { createTransactionAction } from '@/lib/core/transaction/create-transaction-action';
import type { TransactionDetail } from '@/lib/core/transaction/queries';

type Category = {
  id: string;
  name: string;
  icon: string | null;
};

type Props = {
  transaction: TransactionDetail | null;
  categories: Category[];
  isNew: boolean;
};

function formatDateForInput(date: Date): string {
  // Use local date parts to avoid timezone shift
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function TransactionForm({ transaction, categories, isNew }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Form state
  const [date, setDate] = useState(
    transaction ? formatDateForInput(transaction.date) : formatDateForInput(new Date())
  );
  const [merchant, setMerchant] = useState(transaction?.merchant ?? '');
  const [amount, setAmount] = useState(transaction?.amount.toString() ?? '');
  const [balance, setBalance] = useState(transaction?.balance?.toString() ?? '');
  const [categoryId, setCategoryId] = useState<string | null>(transaction?.categoryId ?? null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount)) {
      toast.error('Invalid amount');
      return;
    }

    const parsedBalance = balance ? parseFloat(balance) : null;
    if (balance && parsedBalance === null) {
      toast.error('Invalid balance');
      return;
    }

    // Validate date format YYYY-MM-DD
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      toast.error('Invalid date');
      return;
    }

    startTransition(async () => {
      if (isNew) {
        const result = await createTransactionAction({
          date,
          merchant,
          amount: parsedAmount,
          balance: parsedBalance,
          categoryId
        });

        if (result._tag === 'Error') {
          toast.error(result.message);
          return;
        }

        toast.success('Transaction created');
        router.push(`/transactions/${result.id}`);
      } else if (transaction) {
        const result = await updateTransactionDetailAction({
          id: transaction.id,
          date,
          merchant,
          amount: parsedAmount,
          categoryId
        });

        if (result._tag === 'Error') {
          toast.error(result.message);
          return;
        }

        toast.success('Transaction updated');
      }
    });
  };

  const handleDelete = () => {
    if (!transaction) return;

    startTransition(async () => {
      const result = await deleteTransactionAction({ id: transaction.id });

      if (result._tag === 'Error') {
        toast.error(result.message);
        return;
      }

      toast.success('Transaction deleted');
      router.push('/transactions');
    });
  };

  return (
    <main className="min-h-screen p-4 sm:p-8">
      <div className="mx-auto max-w-2xl space-y-6">
        {/* Header */}
        <div className="space-y-2">
          <Link
            href="/transactions"
            className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm transition-colors"
          >
            <ArrowLeft className="size-4" />
            Back to transactions
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight">
            {isNew ? 'New Transaction' : 'Edit Transaction'}
          </h1>
          {!isNew && transaction && (
            <p className="text-muted-foreground text-sm">
              Created {transaction.createdAt.toLocaleDateString()}
              {transaction.uploadId ? ' (from upload)' : ' (manual entry)'}
            </p>
          )}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Transaction Details</CardTitle>
            <CardDescription>
              {isNew
                ? 'Enter the details for the new transaction'
                : 'Edit the transaction details. The original values are preserved for duplicate detection.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="date">Date</Label>
                  <Input
                    id="date"
                    type="date"
                    value={date}
                    onChange={e => setDate(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="amount">Amount</Label>
                  <Input
                    id="amount"
                    type="number"
                    step="0.01"
                    value={amount}
                    onChange={e => setAmount(e.target.value)}
                    placeholder="-100.00"
                    required
                  />
                  <p className="text-muted-foreground text-xs">Negative for expenses</p>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="merchant">Merchant</Label>
                <Input
                  id="merchant"
                  type="text"
                  value={merchant}
                  onChange={e => setMerchant(e.target.value)}
                  placeholder="Store name"
                  required
                />
              </div>

              {isNew && (
                <div className="space-y-2">
                  <Label htmlFor="balance">Balance (optional)</Label>
                  <Input
                    id="balance"
                    type="number"
                    step="0.01"
                    value={balance}
                    onChange={e => setBalance(e.target.value)}
                    placeholder="1000.00"
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="category">Category</Label>
                <Select
                  value={categoryId ?? '__none__'}
                  onValueChange={v => setCategoryId(v === '__none__' ? null : v)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select category">
                      {categoryId
                        ? (() => {
                            const cat = categories.find(c => c.id === categoryId);
                            return cat ? `${cat.icon ?? ''} ${cat.name}`.trim() : 'Select category';
                          })()
                        : 'Uncategorized'}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Uncategorized</SelectItem>
                    {categories.map(cat => (
                      <SelectItem key={cat.id} value={cat.id}>
                        {cat.icon && <span>{cat.icon}</span>}
                        {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between pt-4">
                {!isNew && transaction && (
                  <AlertDialog>
                    <AlertDialogTrigger
                      render={
                        <Button type="button" variant="destructive" disabled={isPending}>
                          <Trash2 className="size-4" />
                          Delete
                        </Button>
                      }
                    />
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete transaction?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will permanently delete this transaction. This action cannot be
                          undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction variant="destructive" onClick={handleDelete}>
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}

                <div className="ml-auto">
                  <Button type="submit" disabled={isPending}>
                    <Save className="size-4" />
                    {isPending ? 'Saving...' : isNew ? 'Create' : 'Save'}
                  </Button>
                </div>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
