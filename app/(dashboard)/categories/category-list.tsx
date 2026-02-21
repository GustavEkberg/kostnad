'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import {
  Plus,
  Pencil,
  Trash2,
  Loader2,
  ChevronDown,
  ChevronUp,
  MoreHorizontal
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@/components/ui/alert-dialog';
import { createCategoryAction } from '@/lib/core/category/create-category-action';
import { updateCategoryAction } from '@/lib/core/category/update-category-action';
import { deleteCategoryAction } from '@/lib/core/category/delete-category-action';
import type { CategoryWithDetails } from '@/lib/core/transaction/queries';

type Props = {
  categories: CategoryWithDetails[];
};

export function CategoryList({ categories: initialCategories }: Props) {
  const [categories, setCategories] = useState(initialCategories);
  const [isPending, startTransition] = useTransition();
  const [pendingAction, setPendingAction] = useState<string | null>(null);

  // Create state
  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState('');

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  // Expanded state for merchant mappings
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Delete confirmation state
  const [deleteTarget, setDeleteTarget] = useState<CategoryWithDetails | null>(null);

  const handleCreate = () => {
    if (!newName.trim()) {
      toast.error('Category name is required');
      return;
    }

    setPendingAction('create');
    startTransition(async () => {
      const result = await createCategoryAction({ name: newName.trim() });

      if (result._tag === 'Error') {
        toast.error(result.message);
        setPendingAction(null);
        return;
      }

      // Add new category to list
      setCategories(prev =>
        [
          ...prev,
          {
            ...result.category,
            transactionCount: 0,
            merchantMappings: []
          }
        ].sort((a, b) => a.name.localeCompare(b.name))
      );

      setNewName('');
      setIsCreating(false);
      setPendingAction(null);
      toast.success(`Created category "${result.category.name}"`);
    });
  };

  const handleUpdate = (id: string) => {
    if (!editName.trim()) {
      toast.error('Category name is required');
      return;
    }

    setPendingAction(id);
    startTransition(async () => {
      const result = await updateCategoryAction({ id, name: editName.trim() });

      if (result._tag === 'Error') {
        toast.error(result.message);
        setPendingAction(null);
        return;
      }

      // Update category in list
      setCategories(prev =>
        prev
          .map(c => (c.id === id ? { ...c, name: result.category.name } : c))
          .sort((a, b) => a.name.localeCompare(b.name))
      );

      setEditingId(null);
      setEditName('');
      setPendingAction(null);
      toast.success(`Updated category to "${result.category.name}"`);
    });
  };

  const handleDelete = (id: string) => {
    setPendingAction(id);
    startTransition(async () => {
      const result = await deleteCategoryAction({ id });

      if (result._tag === 'Error') {
        toast.error(result.message);
        setPendingAction(null);
        setDeleteTarget(null);
        return;
      }

      // Remove from list
      setCategories(prev => prev.filter(c => c.id !== id));
      setPendingAction(null);
      setDeleteTarget(null);
      toast.success(`Deleted category "${result.name}"`);
    });
  };

  const startEdit = (category: CategoryWithDetails) => {
    setEditingId(category.id);
    setEditName(category.name);
    setIsCreating(false);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditName('');
  };

  const toggleExpanded = (id: string) => {
    setExpandedId(prev => (prev === id ? null : id));
  };

  return (
    <div className="space-y-4">
      {/* Create new category */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Add Category</CardTitle>
        </CardHeader>
        <CardContent>
          {isCreating ? (
            <div className="flex gap-2">
              <Input
                value={newName}
                onChange={e => setNewName(e.target.value)}
                placeholder="Category name"
                className="flex-1"
                autoFocus
                onKeyDown={e => {
                  if (e.key === 'Enter') handleCreate();
                  if (e.key === 'Escape') {
                    setIsCreating(false);
                    setNewName('');
                  }
                }}
              />
              <Button onClick={handleCreate} disabled={isPending && pendingAction === 'create'}>
                {isPending && pendingAction === 'create' ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  'Create'
                )}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setIsCreating(false);
                  setNewName('');
                }}
              >
                Cancel
              </Button>
            </div>
          ) : (
            <Button
              variant="outline"
              onClick={() => {
                setIsCreating(true);
                setEditingId(null);
              }}
              className="w-full"
            >
              <Plus className="mr-2 size-4" />
              Add new category
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Category list */}
      <Card>
        <CardHeader>
          <CardTitle>Categories</CardTitle>
          <CardDescription>
            {categories.length} categor{categories.length !== 1 ? 'ies' : 'y'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {categories.map(category => {
            const isEditing = editingId === category.id;
            const isProcessing = isPending && pendingAction === category.id;
            const isExpanded = expandedId === category.id;
            const hasMappings = category.merchantMappings.length > 0;

            return (
              <div key={category.id} className="border-border rounded-lg border">
                <div className="flex items-center gap-3 p-3">
                  {/* Category name / edit input - fixed width */}
                  <div className="w-48 shrink-0">
                    {isEditing ? (
                      <Input
                        value={editName}
                        onChange={e => setEditName(e.target.value)}
                        className="h-8"
                        autoFocus
                        onKeyDown={e => {
                          if (e.key === 'Enter') handleUpdate(category.id);
                          if (e.key === 'Escape') cancelEdit();
                        }}
                      />
                    ) : (
                      <Link
                        href={`/categories/${category.id}`}
                        className="hover:text-foreground flex items-center gap-2 transition-colors"
                      >
                        {category.icon && <span>{category.icon}</span>}
                        <span className="truncate font-medium">{category.name}</span>
                        {category.isDefault && (
                          <Badge variant="secondary" className="shrink-0 text-xs">
                            Default
                          </Badge>
                        )}
                      </Link>
                    )}
                  </div>

                  {/* Transaction count - fixed width */}
                  <div className="text-muted-foreground w-32 shrink-0 text-sm">
                    {category.transactionCount} txn{category.transactionCount !== 1 ? 's' : ''}
                  </div>

                  {/* Merchant count - fixed width */}
                  <div className="text-muted-foreground w-28 shrink-0 text-sm">
                    {category.merchantMappings.length} merchant
                    {category.merchantMappings.length !== 1 ? 's' : ''}
                  </div>

                  {/* Spacer */}
                  <div className="flex-1" />

                  {/* Expand mappings button */}
                  {hasMappings && (
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => toggleExpanded(category.id)}
                      title={`${category.merchantMappings.length} merchant mapping${category.merchantMappings.length !== 1 ? 's' : ''}`}
                    >
                      {isExpanded ? (
                        <ChevronUp className="size-4" />
                      ) : (
                        <ChevronDown className="size-4" />
                      )}
                    </Button>
                  )}

                  {/* Actions */}
                  {isEditing ? (
                    <>
                      <Button
                        size="sm"
                        onClick={() => handleUpdate(category.id)}
                        disabled={isProcessing}
                      >
                        {isProcessing ? <Loader2 className="size-4 animate-spin" /> : 'Save'}
                      </Button>
                      <Button size="sm" variant="outline" onClick={cancelEdit}>
                        Cancel
                      </Button>
                    </>
                  ) : (
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={<Button variant="ghost" size="icon-sm" disabled={isProcessing} />}
                      >
                        {isProcessing ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <MoreHorizontal className="size-4" />
                        )}
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => startEdit(category)}>
                          <Pencil />
                          Edit
                        </DropdownMenuItem>
                        {!category.isDefault && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              variant="destructive"
                              onClick={() => setDeleteTarget(category)}
                            >
                              <Trash2 />
                              Delete
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>

                {/* Merchants (expanded) */}
                {isExpanded && hasMappings && (
                  <div className="border-border bg-muted/50 border-t px-3 py-2">
                    <div className="text-muted-foreground mb-1.5 text-xs font-medium uppercase tracking-wide">
                      Merchants
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {category.merchantMappings.map(mapping => (
                        <Badge key={mapping.id} variant="outline" className="font-normal">
                          {mapping.merchantPattern}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {categories.length === 0 && (
            <div className="text-muted-foreground py-8 text-center text-sm">
              No categories yet. Create one above.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete confirmation dialog */}
      <AlertDialog open={deleteTarget !== null} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete category?</AlertDialogTitle>
            <AlertDialogDescription>
              Delete &quot;{deleteTarget?.name}&quot;? This will also remove{' '}
              {deleteTarget?.merchantMappings.length ?? 0} merchant mapping
              {deleteTarget?.merchantMappings.length !== 1 ? 's' : ''}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => deleteTarget && handleDelete(deleteTarget.id)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
