'use client';

import Link from 'next/link';
import { useState, useEffect, useCallback, useRef } from 'react';
import { Upload, Brain, PieChart, TrendingUp, MenuIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogCloseButton
} from '@/components/ui/dialog';
import { IncomeExpenseRadialChart } from '@/components/income-expense-radial-chart';
import { ComparisonChart } from '@/components/comparison-chart';
import { CategoryHorizontalBarChart } from '@/components/category-horizontal-bar-chart';
import { CategoryTrendChart } from '@/components/charts/category-trend-chart';
import { sendContactAction } from '@/lib/core/contact/send-contact-action';
import { formatCurrency } from '@/lib/utils';
import { AnimatedBackground, type AnimatedBackgroundRef } from './animated-background';

// Region-specific mock data
type RegionData = {
  income: number;
  expenses: number;
  comparison: {
    income: { current: number; prevMonth: number; yearAgo: number };
    expenses: { current: number; prevMonth: number; yearAgo: number };
    net: { current: number; prevMonth: number; yearAgo: number };
  };
  categorySummary: Array<{
    categoryId: string;
    categoryName: string;
    total: number;
    count: number;
  }>;
  categoryStats: {
    totalExpenses: number;
    transactionCount: number;
    avgTransaction: number;
    merchantCount: number;
  };
  categoryTrends: Array<{
    period: string;
    periodKey: string;
    expenses: number;
    income: number;
    transactionCount: number;
  }>;
  topMerchants: Array<{ merchant: string; total: number; transactionCount: number }>;
};

// European data (EUR)
const MOCK_DATA_EU: RegionData = {
  income: 5240,
  expenses: 3875,
  comparison: {
    income: { current: 5240, prevMonth: 4820, yearAgo: 4500 },
    expenses: { current: 3875, prevMonth: 4120, yearAgo: 3580 },
    net: { current: 1365, prevMonth: 700, yearAgo: 920 }
  },
  categorySummary: [
    { categoryId: '1', categoryName: 'Housing', total: -1250, count: 1 },
    { categoryId: '2', categoryName: 'Food & Dining', total: -820, count: 45 },
    { categoryId: '3', categoryName: 'Transport', total: -680, count: 22 },
    { categoryId: '4', categoryName: 'Entertainment', total: -450, count: 12 },
    { categoryId: '5', categoryName: 'Shopping', total: -380, count: 8 },
    { categoryId: '6', categoryName: 'Health', total: -295, count: 3 }
  ],
  categoryStats: {
    totalExpenses: 15200,
    transactionCount: 14,
    avgTransaction: 1085,
    merchantCount: 5
  },
  categoryTrends: [
    { period: 'Mar', periodKey: '2025-03', expenses: 1350, income: 0, transactionCount: 2 },
    { period: 'Apr', periodKey: '2025-04', expenses: 1580, income: 0, transactionCount: 3 },
    { period: 'May', periodKey: '2025-05', expenses: 1320, income: 0, transactionCount: 2 },
    { period: 'Jun', periodKey: '2025-06', expenses: 1890, income: 0, transactionCount: 4 },
    { period: 'Jul', periodKey: '2025-07', expenses: 1420, income: 0, transactionCount: 2 },
    { period: 'Aug', periodKey: '2025-08', expenses: 1650, income: 0, transactionCount: 3 },
    { period: 'Sep', periodKey: '2025-09', expenses: 2100, income: 0, transactionCount: 5 },
    { period: 'Oct', periodKey: '2025-10', expenses: 1380, income: 0, transactionCount: 2 },
    { period: 'Nov', periodKey: '2025-11', expenses: 1520, income: 0, transactionCount: 3 },
    { period: 'Dec', periodKey: '2025-12', expenses: 1950, income: 0, transactionCount: 4 },
    { period: 'Jan', periodKey: '2026-01', expenses: 1480, income: 0, transactionCount: 3 }
  ],
  topMerchants: [
    { merchant: 'Rent Payment', total: 13200, transactionCount: 11 },
    { merchant: 'Electricity Provider', total: 980, transactionCount: 11 },
    { merchant: 'Internet Service', total: 550, transactionCount: 11 },
    { merchant: 'Home Insurance', total: 320, transactionCount: 1 },
    { merchant: 'Water Utility', total: 150, transactionCount: 3 }
  ]
};

// Swedish data (SEK) - realistic Swedish household amounts
const MOCK_DATA_SE: RegionData = {
  income: 42500,
  expenses: 31200,
  comparison: {
    income: { current: 42500, prevMonth: 41800, yearAgo: 39500 },
    expenses: { current: 31200, prevMonth: 33400, yearAgo: 29800 },
    net: { current: 11300, prevMonth: 8400, yearAgo: 9700 }
  },
  categorySummary: [
    { categoryId: '1', categoryName: 'Boende', total: -12500, count: 1 },
    { categoryId: '2', categoryName: 'Mat & Restaurang', total: -6800, count: 45 },
    { categoryId: '3', categoryName: 'Transport', total: -4200, count: 22 },
    { categoryId: '4', categoryName: 'Nöje', total: -3100, count: 12 },
    { categoryId: '5', categoryName: 'Shopping', total: -2800, count: 8 },
    { categoryId: '6', categoryName: 'Hälsa', total: -1800, count: 3 }
  ],
  categoryStats: {
    totalExpenses: 124000,
    transactionCount: 14,
    avgTransaction: 8857,
    merchantCount: 5
  },
  categoryTrends: [
    { period: 'Mar', periodKey: '2025-03', expenses: 11200, income: 0, transactionCount: 2 },
    { period: 'Apr', periodKey: '2025-04', expenses: 12800, income: 0, transactionCount: 3 },
    { period: 'May', periodKey: '2025-05', expenses: 10900, income: 0, transactionCount: 2 },
    { period: 'Jun', periodKey: '2025-06', expenses: 14200, income: 0, transactionCount: 4 },
    { period: 'Jul', periodKey: '2025-07', expenses: 11500, income: 0, transactionCount: 2 },
    { period: 'Aug', periodKey: '2025-08', expenses: 13100, income: 0, transactionCount: 3 },
    { period: 'Sep', periodKey: '2025-09', expenses: 15800, income: 0, transactionCount: 5 },
    { period: 'Oct', periodKey: '2025-10', expenses: 11100, income: 0, transactionCount: 2 },
    { period: 'Nov', periodKey: '2025-11', expenses: 12400, income: 0, transactionCount: 3 },
    { period: 'Dec', periodKey: '2025-12', expenses: 16200, income: 0, transactionCount: 4 },
    { period: 'Jan', periodKey: '2026-01', expenses: 12500, income: 0, transactionCount: 3 }
  ],
  topMerchants: [
    { merchant: 'Hyra', total: 112500, transactionCount: 11 },
    { merchant: 'Vattenfall', total: 8200, transactionCount: 11 },
    { merchant: 'Telia', total: 4990, transactionCount: 11 },
    { merchant: 'Länsförsäkringar', total: 2850, transactionCount: 1 },
    { merchant: 'Stockholm Vatten', total: 1320, transactionCount: 3 }
  ]
};

// Categories for EU
const MOCK_CATEGORIES_EU: Array<{ id: string; name: string; icon: string | null }> = [
  { id: '1', name: 'Housing', icon: '🏠' },
  { id: '2', name: 'Food & Dining', icon: '🍽️' },
  { id: '3', name: 'Transport', icon: '🚗' },
  { id: '4', name: 'Entertainment', icon: '🎬' },
  { id: '5', name: 'Shopping', icon: '🛍️' },
  { id: '6', name: 'Health', icon: '💊' }
];

// Categories for Sweden
const MOCK_CATEGORIES_SE: Array<{ id: string; name: string; icon: string | null }> = [
  { id: '1', name: 'Boende', icon: '🏠' },
  { id: '2', name: 'Mat & Restaurang', icon: '🍽️' },
  { id: '3', name: 'Transport', icon: '🚗' },
  { id: '4', name: 'Nöje', icon: '🎬' },
  { id: '5', name: 'Shopping', icon: '🛍️' },
  { id: '6', name: 'Hälsa', icon: '💊' }
];

type MockTransaction = {
  id: string;
  date: string;
  merchant: string;
  amount: number;
  category: { icon: string; name: string } | null;
};

// European transactions (EUR)
const MOCK_TRANSACTIONS_EU: MockTransaction[] = [
  {
    id: '1',
    date: '2026-01-28',
    merchant: 'Whole Foods Market',
    amount: -89.5,
    category: { icon: '🍽️', name: 'Food & Dining' }
  },
  {
    id: '2',
    date: '2026-01-28',
    merchant: 'Spotify',
    amount: -9.99,
    category: { icon: '🎬', name: 'Entertainment' }
  },
  {
    id: '3',
    date: '2026-01-27',
    merchant: 'Shell Gas Station',
    amount: -52.3,
    category: { icon: '🚗', name: 'Transport' }
  },
  {
    id: '4',
    date: '2026-01-27',
    merchant: 'Amazon',
    amount: -34.99,
    category: { icon: '🛍️', name: 'Shopping' }
  },
  {
    id: '5',
    date: '2026-01-26',
    merchant: 'Netflix',
    amount: -15.99,
    category: { icon: '🎬', name: 'Entertainment' }
  },
  {
    id: '6',
    date: '2026-01-26',
    merchant: 'Starbucks',
    amount: -6.45,
    category: { icon: '🍽️', name: 'Food & Dining' }
  },
  {
    id: '7',
    date: '2026-01-25',
    merchant: 'Uber',
    amount: -18.5,
    category: { icon: '🚗', name: 'Transport' }
  },
  {
    id: '8',
    date: '2026-01-25',
    merchant: 'Pharmacy Plus',
    amount: -23.8,
    category: { icon: '💊', name: 'Health' }
  },
  {
    id: '9',
    date: '2026-01-24',
    merchant: 'IKEA',
    amount: -156.0,
    category: { icon: '🏠', name: 'Housing' }
  },
  {
    id: '11',
    date: '2026-01-23',
    merchant: 'Gym Membership',
    amount: -45.0,
    category: { icon: '💊', name: 'Health' }
  },
  {
    id: '12',
    date: '2026-01-23',
    merchant: 'Pizza Hut',
    amount: -28.9,
    category: { icon: '🍽️', name: 'Food & Dining' }
  },
  {
    id: '13',
    date: '2026-01-22',
    merchant: 'Apple Store',
    amount: -199.0,
    category: { icon: '🛍️', name: 'Shopping' }
  },
  {
    id: '14',
    date: '2026-01-22',
    merchant: 'Train Ticket',
    amount: -12.5,
    category: { icon: '🚗', name: 'Transport' }
  },
  {
    id: '15',
    date: '2026-01-21',
    merchant: 'Electricity Bill',
    amount: -85.0,
    category: { icon: '🏠', name: 'Housing' }
  },
  {
    id: '16',
    date: '2026-01-21',
    merchant: 'Lidl',
    amount: -67.3,
    category: { icon: '🍽️', name: 'Food & Dining' }
  },
  {
    id: '17',
    date: '2026-01-20',
    merchant: 'Cinema City',
    amount: -24.0,
    category: { icon: '🎬', name: 'Entertainment' }
  },
  {
    id: '18',
    date: '2026-01-20',
    merchant: 'Zara',
    amount: -79.99,
    category: { icon: '🛍️', name: 'Shopping' }
  },
  {
    id: '20',
    date: '2026-01-19',
    merchant: 'Internet Bill',
    amount: -49.99,
    category: { icon: '🏠', name: 'Housing' }
  },
  {
    id: '21',
    date: '2026-01-18',
    merchant: 'Dentist',
    amount: -120.0,
    category: { icon: '💊', name: 'Health' }
  },
  {
    id: '22',
    date: '2026-01-18',
    merchant: 'McDonalds',
    amount: -11.5,
    category: { icon: '🍽️', name: 'Food & Dining' }
  },
  {
    id: '23',
    date: '2026-01-17',
    merchant: 'Parking Fee',
    amount: -8.0,
    category: { icon: '🚗', name: 'Transport' }
  },
  {
    id: '24',
    date: '2026-01-17',
    merchant: 'Book Store',
    amount: -22.5,
    category: { icon: '🛍️', name: 'Shopping' }
  },
  {
    id: '25',
    date: '2026-01-16',
    merchant: 'Rent Payment',
    amount: -1250.0,
    category: { icon: '🏠', name: 'Housing' }
  }
];

// Swedish transactions (SEK)
const MOCK_TRANSACTIONS_SE: MockTransaction[] = [
  {
    id: '1',
    date: '2026-01-28',
    merchant: 'ICA Maxi',
    amount: -687,
    category: { icon: '🍽️', name: 'Mat & Restaurang' }
  },
  {
    id: '2',
    date: '2026-01-28',
    merchant: 'Spotify',
    amount: -119,
    category: { icon: '🎬', name: 'Nöje' }
  },
  {
    id: '3',
    date: '2026-01-27',
    merchant: 'Circle K',
    amount: -412,
    category: { icon: '🚗', name: 'Transport' }
  },
  {
    id: '4',
    date: '2026-01-27',
    merchant: 'Elgiganten',
    amount: -299,
    category: { icon: '🛍️', name: 'Shopping' }
  },
  {
    id: '5',
    date: '2026-01-26',
    merchant: 'Netflix',
    amount: -149,
    category: { icon: '🎬', name: 'Nöje' }
  },
  {
    id: '6',
    date: '2026-01-26',
    merchant: 'Espresso House',
    amount: -62,
    category: { icon: '🍽️', name: 'Mat & Restaurang' }
  },
  {
    id: '7',
    date: '2026-01-25',
    merchant: 'Bolt',
    amount: -156,
    category: { icon: '🚗', name: 'Transport' }
  },
  {
    id: '8',
    date: '2026-01-25',
    merchant: 'Apotek Hjärtat',
    amount: -189,
    category: { icon: '💊', name: 'Hälsa' }
  },
  {
    id: '9',
    date: '2026-01-24',
    merchant: 'IKEA',
    amount: -1249,
    category: { icon: '🏠', name: 'Boende' }
  },
  {
    id: '11',
    date: '2026-01-23',
    merchant: 'Friskis & Svettis',
    amount: -399,
    category: { icon: '💊', name: 'Hälsa' }
  },
  {
    id: '12',
    date: '2026-01-23',
    merchant: 'Max Burgers',
    amount: -158,
    category: { icon: '🍽️', name: 'Mat & Restaurang' }
  },
  {
    id: '13',
    date: '2026-01-22',
    merchant: 'Apple Store',
    amount: -1599,
    category: { icon: '🛍️', name: 'Shopping' }
  },
  {
    id: '14',
    date: '2026-01-22',
    merchant: 'SJ Biljett',
    amount: -245,
    category: { icon: '🚗', name: 'Transport' }
  },
  {
    id: '15',
    date: '2026-01-21',
    merchant: 'Vattenfall',
    amount: -745,
    category: { icon: '🏠', name: 'Boende' }
  },
  {
    id: '16',
    date: '2026-01-21',
    merchant: 'Coop',
    amount: -523,
    category: { icon: '🍽️', name: 'Mat & Restaurang' }
  },
  {
    id: '17',
    date: '2026-01-20',
    merchant: 'SF Bio',
    amount: -195,
    category: { icon: '🎬', name: 'Nöje' }
  },
  {
    id: '18',
    date: '2026-01-20',
    merchant: 'H&M',
    amount: -599,
    category: { icon: '🛍️', name: 'Shopping' }
  },
  {
    id: '20',
    date: '2026-01-19',
    merchant: 'Telia',
    amount: -449,
    category: { icon: '🏠', name: 'Boende' }
  },
  {
    id: '21',
    date: '2026-01-18',
    merchant: 'Folktandvården',
    amount: -850,
    category: { icon: '💊', name: 'Hälsa' }
  },
  {
    id: '22',
    date: '2026-01-18',
    merchant: 'McDonalds',
    amount: -109,
    category: { icon: '🍽️', name: 'Mat & Restaurang' }
  },
  {
    id: '23',
    date: '2026-01-17',
    merchant: 'Parkering Stockholm',
    amount: -65,
    category: { icon: '🚗', name: 'Transport' }
  },
  {
    id: '24',
    date: '2026-01-17',
    merchant: 'Akademibokhandeln',
    amount: -189,
    category: { icon: '🛍️', name: 'Shopping' }
  },
  {
    id: '25',
    date: '2026-01-16',
    merchant: 'Hyra',
    amount: -10250,
    category: { icon: '🏠', name: 'Boende' }
  }
];

function getRandomSample<T>(arr: T[], count: number): T[] {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

type AnimatedTransactionListProps = {
  mockTransactions: MockTransaction[];
  currency: 'SEK' | 'EUR';
};

function AnimatedTransactionList({ mockTransactions, currency }: AnimatedTransactionListProps) {
  const [transactions, setTransactions] = useState<Array<MockTransaction & { isNew?: boolean }>>(
    () => getRandomSample(mockTransactions, 8).sort((a, b) => a.amount - b.amount)
  );

  const addRandomTransaction = useCallback(() => {
    const availableTransactions = mockTransactions.filter(
      t => !transactions.some(existing => existing.id === t.id)
    );

    if (availableTransactions.length === 0) {
      // Reset if we've shown all transactions
      setTransactions(getRandomSample(mockTransactions, 8).sort((a, b) => a.amount - b.amount));
      return;
    }

    const randomIndex = Math.floor(Math.random() * availableTransactions.length);
    const newTransaction = { ...availableTransactions[randomIndex], isNew: true };

    setTransactions(prev => {
      const updated = [newTransaction, ...prev.slice(0, 9)].sort((a, b) => a.amount - b.amount);
      // Remove isNew flag after animation
      setTimeout(() => {
        setTransactions(current =>
          current.map(t => (t.id === newTransaction.id ? { ...t, isNew: false } : t))
        );
      }, 600);
      return updated;
    });
  }, [mockTransactions, transactions]);

  useEffect(() => {
    const interval = setInterval(
      () => {
        addRandomTransaction();
      },
      3000 + Math.random() * 2000
    ); // Random interval between 3-5 seconds

    return () => clearInterval(interval);
  }, [addRandomTransaction]);

  // Find max amount for bar widths (expenses only now)
  const maxExpense = Math.max(...transactions.map(t => Math.abs(t.amount)));

  return (
    <div className="overflow-hidden rounded-lg border">
      <AnimatePresence mode="popLayout">
        {transactions.map(tx => {
          const widthPercent = maxExpense > 0 ? (Math.abs(tx.amount) / maxExpense) * 100 : 0;
          const categoryDisplay = tx.category
            ? `${tx.category.icon} ${tx.category.name}`
            : 'Uncategorized';

          return (
            <motion.div
              key={tx.id}
              layout
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{
                layout: { type: 'spring', stiffness: 500, damping: 40 },
                opacity: { duration: 0.3 }
              }}
              className="relative border-b border-border p-4 last:border-b-0"
            >
              {/* Animated background bar */}
              <motion.div
                className="absolute inset-y-0 left-0 bg-red-500/10"
                initial={{ width: 0 }}
                animate={{ width: `${widthPercent}%` }}
                transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              />

              {/* Desktop layout */}
              <div className="relative hidden items-center gap-4 sm:flex">
                <div className="w-24 shrink-0 text-sm text-muted-foreground">{tx.date}</div>
                <div className="w-36 shrink-0 truncate text-sm">{categoryDisplay}</div>
                <div className="min-w-0 flex-1 truncate font-medium">{tx.merchant}</div>
                <div className="w-28 shrink-0 text-right font-mono text-sm text-red-600 dark:text-red-400">
                  {formatCurrency(tx.amount, currency)}
                </div>
              </div>

              {/* Mobile layout */}
              <div className="relative sm:hidden">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{tx.merchant}</div>
                    <p className="text-xs text-muted-foreground">
                      {tx.date} · {categoryDisplay}
                    </p>
                  </div>
                  <div className="shrink-0 font-mono text-sm text-red-600 dark:text-red-400">
                    {formatCurrency(tx.amount, currency)}
                  </div>
                </div>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}

const FEATURES = [
  {
    icon: Upload,
    title: 'Connect Your Bank Data',
    description: 'We help you organize your transactions.'
  },
  {
    icon: Brain,
    title: 'AI Categorization',
    description: 'Smart categorization learns from your patterns. Less manual work, more insights.'
  },
  {
    icon: PieChart,
    title: 'Visual Breakdown',
    description: 'See where your money goes with clear charts. Compare months and track trends.'
  },
  {
    icon: TrendingUp,
    title: 'Track Progress',
    description: 'Monitor spending over time. Spot patterns and make informed decisions.'
  }
];

type ContactModalProps = {
  onSuccess?: () => void;
};

function ContactModal({ onSuccess }: ContactModalProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [resultMessage, setResultMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || !message) return;

    setStatus('loading');
    const result = await sendContactAction({ name, email, message });

    if (result.success) {
      setStatus('success');
      setResultMessage(result.message);
      setName('');
      setEmail('');
      setMessage('');
      // Auto-close after 1 second
      setTimeout(() => {
        setOpen(false);
        // Trigger highlight effect 500ms after modal closes
        setTimeout(() => {
          onSuccess?.();
        }, 500);
      }, 1000);
    } else {
      setStatus('error');
      setResultMessage(result.message);
    }
  };

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (!isOpen) {
      // Reset form when closing
      setStatus('idle');
      setResultMessage('');
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={<Button size="lg" />}>Contact me</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Request access</DialogTitle>
          <DialogDescription>
            Tell me a bit about yourself and why you want to use Kostnad.
          </DialogDescription>
        </DialogHeader>

        {status === 'success' ? (
          <div className="py-4 text-center">
            <p className="text-green-600 dark:text-green-400">{resultMessage}</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="grid gap-4">
            <div className="grid gap-2">
              <label htmlFor="name" className="text-sm font-medium">
                Name
              </label>
              <Input
                id="name"
                type="text"
                placeholder="Your name"
                value={name}
                onChange={e => setName(e.target.value)}
                required
                disabled={status === 'loading'}
              />
            </div>
            <div className="grid gap-2">
              <label htmlFor="email" className="text-sm font-medium">
                Email
              </label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                disabled={status === 'loading'}
              />
            </div>
            <div className="grid gap-2">
              <label htmlFor="message" className="text-sm font-medium">
                Message
              </label>
              <Textarea
                id="message"
                placeholder="Tell me a bit about yourself and what you're looking for..."
                value={message}
                onChange={e => setMessage(e.target.value)}
                required
                disabled={status === 'loading'}
                rows={4}
              />
            </div>
            {status === 'error' && (
              <p className="text-sm text-red-600 dark:text-red-400">{resultMessage}</p>
            )}
            <DialogFooter>
              <DialogCloseButton type="button">Cancel</DialogCloseButton>
              <Button type="submit" disabled={status === 'loading'}>
                {status === 'loading' ? 'Sending...' : 'Send message'}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Header() {
  return (
    <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <nav className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
        <Link href="/" className="text-lg font-semibold tracking-tight">
          Kostnad
        </Link>

        <div className="flex items-center gap-4">
          {/* Desktop nav */}
          <div className="hidden items-center gap-6 sm:flex">
            <a href="#features" className="text-sm text-muted-foreground hover:text-foreground">
              Features
            </a>
            <a href="#how-it-works" className="text-sm text-muted-foreground hover:text-foreground">
              How it works
            </a>
            <Button variant="outline" size="sm" render={<Link href="/login" />}>
              Log in
            </Button>
          </div>

          {/* Mobile dropdown menu */}
          <DropdownMenu>
            <DropdownMenuTrigger
              render={<Button variant="ghost" size="icon" aria-label="Menu" />}
              className="sm:hidden"
            >
              <MenuIcon className="size-5" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem render={<a href="#features" />}>Features</DropdownMenuItem>
              <DropdownMenuItem render={<a href="#how-it-works" />}>How it works</DropdownMenuItem>
              <DropdownMenuItem render={<Link href="/login" />}>Log in</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </nav>
    </header>
  );
}

type LandingPageProps = {
  isSweden?: boolean;
};

export function LandingPage({ isSweden = false }: LandingPageProps) {
  const currency = isSweden ? 'SEK' : 'EUR';
  const data = isSweden ? MOCK_DATA_SE : MOCK_DATA_EU;
  const transactions = isSweden ? MOCK_TRANSACTIONS_SE : MOCK_TRANSACTIONS_EU;
  const categories = isSweden ? MOCK_CATEGORIES_SE : MOCK_CATEGORIES_EU;
  const backgroundRef = useRef<AnimatedBackgroundRef>(null);

  const handleContactSuccess = useCallback(() => {
    backgroundRef.current?.structureAll();
  }, []);

  return (
    <div className="relative min-h-screen">
      <AnimatedBackground ref={backgroundRef} />
      <Header />

      {/* Hero */}
      <section className="relative flex min-h-[calc(100dvh-3.5rem)] items-center px-4 py-8">
        <div className="mx-auto w-full max-w-6xl">
          <div className="grid gap-8 lg:grid-cols-2 lg:gap-12">
            {/* Left: Text */}
            <div className="flex flex-col justify-center text-center lg:text-left">
              <h1 className="text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">
                Household economics.
                <br />
                Dead simple.
              </h1>
              <p className="mt-4 text-base text-muted-foreground sm:text-lg lg:text-xl">
                See where your money goes. Track how it changes. Plan what comes next.
              </p>
            </div>

            {/* Right: Demo chart */}
            <div className="flex items-center justify-center">
              <div className="w-full max-w-[280px] rounded-xl border bg-card p-4 shadow-sm sm:max-w-sm sm:p-6">
                <IncomeExpenseRadialChart
                  income={data.income}
                  expenses={data.expenses}
                  currency={currency}
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Demo Charts Section */}
      <section className="relative flex min-h-screen items-center px-4 py-6 sm:py-8">
        <div className="mx-auto w-full max-w-6xl">
          <div className="mb-8 text-center">
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Insights at a glance
            </h2>
            <p className="mt-2 text-muted-foreground">
              Compare periods and see exactly where you spend
            </p>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            {/* Comparison Chart */}
            <div className="min-w-0 overflow-hidden rounded-xl border bg-card p-4 shadow-sm sm:p-6">
              <h3 className="mb-4 text-sm font-medium text-muted-foreground">Period Comparison</h3>
              <ComparisonChart
                currentLabel="Jan"
                prevMonthLabel="Dec"
                yearAgoLabel="Jan '25"
                income={data.comparison.income}
                expenses={data.comparison.expenses}
                net={data.comparison.net}
                currency={currency}
              />
            </div>

            {/* Category Chart */}
            <div className="min-w-0 overflow-hidden rounded-xl border bg-card p-4 shadow-sm sm:p-6">
              <h3 className="mb-4 text-sm font-medium text-muted-foreground">
                Spending by Category
              </h3>
              <CategoryHorizontalBarChart
                currentLabel="Jan"
                categorySummary={data.categorySummary}
                categories={categories}
                currency={currency}
              />
            </div>
          </div>
        </div>
      </section>

      {/* Transaction List Demo */}
      <section className="flex min-h-screen items-center px-4 py-12 sm:py-16">
        <div className="mx-auto w-full max-w-4xl">
          <div className="mb-8 text-center">
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              All your transactions in one place
            </h2>
            <p className="mt-2 text-muted-foreground">
              Watch as new transactions flow in, automatically categorized
            </p>
          </div>

          <AnimatedTransactionList mockTransactions={transactions} currency={currency} />
        </div>
      </section>

      {/* Category Detail Demo */}
      <section className="relative flex min-h-screen items-center px-4 py-6 sm:py-8">
        <div className="mx-auto w-full max-w-6xl">
          <div className="mb-8 text-center">
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Deep dive into any category
            </h2>
            <p className="mt-2 text-muted-foreground">
              See trends, top merchants, and detailed stats for each spending category
            </p>
          </div>

          <div className="space-y-6">
            {/* Category Header */}
            <div className="flex items-center gap-3">
              <span className="text-3xl">🏠</span>
              <h3 className="text-xl font-semibold">Housing</h3>
            </div>

            {/* Stats Grid */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Card size="sm">
                <CardHeader>
                  <CardTitle className="text-sm font-normal text-muted-foreground">
                    Total Expenses
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-semibold text-red-600 dark:text-red-400">
                    {formatCurrency(data.categoryStats.totalExpenses, currency)}
                  </p>
                </CardContent>
              </Card>

              <Card size="sm">
                <CardHeader>
                  <CardTitle className="text-sm font-normal text-muted-foreground">
                    Transactions
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-semibold">{data.categoryStats.transactionCount}</p>
                </CardContent>
              </Card>

              <Card size="sm">
                <CardHeader>
                  <CardTitle className="text-sm font-normal text-muted-foreground">
                    Avg Transaction
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-semibold">
                    {formatCurrency(data.categoryStats.avgTransaction, currency)}
                  </p>
                </CardContent>
              </Card>

              <Card size="sm">
                <CardHeader>
                  <CardTitle className="text-sm font-normal text-muted-foreground">
                    Unique Merchants
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-semibold">{data.categoryStats.merchantCount}</p>
                </CardContent>
              </Card>
            </div>

            {/* Two Column Layout */}
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Trend Chart */}
              <Card>
                <CardHeader>
                  <CardTitle>Spending Trends</CardTitle>
                  <CardDescription>Last 12 months</CardDescription>
                </CardHeader>
                <CardContent>
                  <CategoryTrendChart data={data.categoryTrends} height={250} currency={currency} />
                </CardContent>
              </Card>

              {/* Top Merchants */}
              <Card>
                <CardHeader>
                  <CardTitle>Top Merchants</CardTitle>
                  <CardDescription>By total spending</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {data.topMerchants.map((merchant, index) => {
                      const maxTotal = data.topMerchants[0].total;
                      const widthPercent = merchant.total / maxTotal;

                      return (
                        <div key={merchant.merchant} className="space-y-1">
                          <div className="flex items-center justify-between text-sm">
                            <div className="flex items-center gap-2">
                              <span className="w-5 text-right text-xs text-muted-foreground">
                                {index + 1}.
                              </span>
                              <span className="truncate">{merchant.merchant}</span>
                            </div>
                            <span className="shrink-0 font-medium">
                              {formatCurrency(merchant.total, currency)}
                            </span>
                          </div>
                          <div className="ml-7">
                            <div className="h-1.5 w-full rounded-full bg-muted">
                              <div
                                className="h-1.5 rounded-full bg-red-500 transition-all dark:bg-red-400"
                                style={{ width: `${widthPercent * 100}%` }}
                              />
                            </div>
                            <p className="mt-0.5 text-xs text-muted-foreground">
                              {merchant.transactionCount} transaction
                              {merchant.transactionCount !== 1 ? 's' : ''}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="relative flex min-h-screen items-center px-4 py-6 sm:py-8">
        <div className="mx-auto max-w-6xl">
          <div className="mb-12 text-center">
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Everything you need to track expenses
            </h2>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map(feature => (
              <div
                key={feature.title}
                className="rounded-xl border bg-card p-6 transition-shadow hover:shadow-md"
              >
                <feature.icon className="mb-4 size-8 text-primary" />
                <h3 className="mb-2 font-semibold">{feature.title}</h3>
                <p className="text-sm text-muted-foreground">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="relative flex min-h-screen items-center px-4 py-6 sm:py-8">
        <div className="mx-auto max-w-xl text-center">
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Interested in Kostnad?
          </h2>
          <p className="mt-2 text-muted-foreground">Contact me and I&apos;ll let you in.</p>
          <div className="mt-4 flex justify-center">
            <ContactModal onSuccess={handleContactSuccess} />
          </div>
          <p className="mt-6 text-xs text-muted-foreground/60">
            If you use it a lot, you can buy me a coffee later.
          </p>
        </div>
      </section>

      {/* Fork CTA */}
      <section className="relative px-4 py-8">
        <p className="text-center text-xs text-muted-foreground/60">
          Or{' '}
          <a
            href="https://github.com/GustavEkberg/kostnad"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 underline underline-offset-4 hover:text-foreground"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
            </svg>
            fork it
          </a>
          .
        </p>
      </section>

      {/* Footer */}
      <footer className="relative border-t py-8 px-4">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 sm:flex-row">
          <p className="text-sm text-muted-foreground">
            Built by{' '}
            <a
              href="https://gustav.im"
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-4 hover:text-foreground"
            >
              Gustav
            </a>
          </p>
          <a
            href="https://github.com/GustavEkberg/kostnad"
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted-foreground hover:text-foreground"
            aria-label="GitHub"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
            </svg>
          </a>
        </div>
      </footer>
    </div>
  );
}
