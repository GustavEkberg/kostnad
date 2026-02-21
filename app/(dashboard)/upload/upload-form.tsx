'use client';

import { useState, useRef } from 'react';
import { Upload, FileSpreadsheet, Check, AlertCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { uploadTransactionsAction } from '@/lib/core/transaction/upload-transactions-action';

type UploadState =
  | { status: 'idle' }
  | { status: 'processing'; fileName: string }
  | {
      status: 'success';
      fileName: string;
      newCount: number;
      skippedCount: number;
      categorizedCount: number;
      dateRangeStart: Date | null;
      dateRangeEnd: Date | null;
    }
  | { status: 'error'; message: string };

export function UploadForm() {
  const [state, setState] = useState<UploadState>({ status: 'idle' });
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.name.endsWith('.xlsx')) {
      setState({ status: 'error', message: 'Please select an Excel file (.xlsx)' });
      return;
    }

    setState({ status: 'processing', fileName: file.name });

    try {
      // Send file directly to server action via FormData
      const formData = new FormData();
      formData.append('file', file);

      const result = await uploadTransactionsAction(formData);

      if (result._tag === 'Error') {
        setState({ status: 'error', message: result.message });
        return;
      }

      setState({
        status: 'success',
        fileName: file.name,
        newCount: result.newCount,
        skippedCount: result.skippedCount,
        categorizedCount: result.categorizedCount,
        dateRangeStart: result.dateRangeStart,
        dateRangeEnd: result.dateRangeEnd
      });

      toast.success(`Imported ${result.newCount} transactions`);
    } catch {
      setState({ status: 'error', message: 'An unexpected error occurred' });
    }

    // Reset input so same file can be selected again
    if (inputRef.current) {
      inputRef.current.value = '';
    }
  };

  const handleReset = () => {
    setState({ status: 'idle' });
  };

  const formatDate = (date: Date | null) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('sv-SE');
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileSpreadsheet className="size-5" />
          Excel File
        </CardTitle>
        <CardDescription>
          Export your transactions from Handelsbanken and upload the .xlsx file
        </CardDescription>
      </CardHeader>
      <CardContent>
        {state.status === 'idle' && (
          <label className="border-muted-foreground/25 hover:border-muted-foreground/50 hover:bg-muted/50 flex cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed p-8 transition-colors">
            <Upload className="text-muted-foreground size-8" />
            <div className="text-center">
              <p className="font-medium">Click to select file</p>
              <p className="text-muted-foreground text-sm">or drag and drop</p>
            </div>
            <input
              ref={inputRef}
              type="file"
              accept=".xlsx"
              onChange={handleFileSelect}
              className="hidden"
            />
          </label>
        )}

        {state.status === 'processing' && (
          <div className="flex flex-col items-center gap-4 py-8">
            <Loader2 className="text-primary size-8 animate-spin" />
            <div className="text-center">
              <p className="font-medium">Processing transactions</p>
              <p className="text-muted-foreground text-sm">Parsing {state.fileName}...</p>
            </div>
          </div>
        )}

        {state.status === 'success' && (
          <div className="space-y-4">
            <div className="flex items-start gap-3 rounded-lg bg-green-50 p-4 dark:bg-green-950/30">
              <Check className="mt-0.5 size-5 text-green-600 dark:text-green-400" />
              <div className="flex-1">
                <p className="font-medium text-green-900 dark:text-green-100">Import successful</p>
                <p className="text-sm text-green-700 dark:text-green-300">{state.fileName}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-lg border p-3">
                <p className="text-muted-foreground text-xs uppercase tracking-wide">New</p>
                <p className="text-2xl font-semibold">{state.newCount}</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-muted-foreground text-xs uppercase tracking-wide">Skipped</p>
                <p className="text-2xl font-semibold">{state.skippedCount}</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-muted-foreground text-xs uppercase tracking-wide">
                  Auto-categorized
                </p>
                <p className="text-2xl font-semibold">{state.categorizedCount}</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-muted-foreground text-xs uppercase tracking-wide">Date Range</p>
                <p className="text-sm font-medium">
                  {formatDate(state.dateRangeStart)} - {formatDate(state.dateRangeEnd)}
                </p>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <Button onClick={handleReset} variant="outline" className="flex-1">
                Upload Another
              </Button>
              <a
                href="/review"
                className="bg-primary text-primary-foreground hover:bg-primary/80 inline-flex flex-1 items-center justify-center rounded-md px-4 py-2 text-sm font-medium transition-colors"
              >
                Review Uncategorized
              </a>
            </div>
          </div>
        )}

        {state.status === 'error' && (
          <div className="space-y-4">
            <div className="flex items-start gap-3 rounded-lg bg-red-50 p-4 dark:bg-red-950/30">
              <AlertCircle className="mt-0.5 size-5 text-red-600 dark:text-red-400" />
              <div>
                <p className="font-medium text-red-900 dark:text-red-100">Upload failed</p>
                <p className="text-sm text-red-700 dark:text-red-300">{state.message}</p>
              </div>
            </div>

            <Button onClick={handleReset} variant="outline" className="w-full">
              Try Again
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
