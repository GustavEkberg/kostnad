'use client';

import { Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuSeparator,
  DropdownMenuGroup,
  DropdownMenuLabel
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export type Category = {
  id: string;
  name: string;
  icon: string | null;
};

type Props = {
  categories: Category[];
  /** null = all categories, string[] = selected category IDs */
  selectedIds: readonly string[] | null;
  onChange: (ids: string[] | null) => void;
  className?: string;
};

export function CategoryFilter({ categories, selectedIds, onChange, className }: Props) {
  const allSelected = selectedIds === null;
  const selectedCount = selectedIds?.length ?? categories.length + 1; // +1 for uncategorized

  const isSelected = (id: string) => {
    if (selectedIds === null) return true;
    return selectedIds.includes(id);
  };

  const handleToggle = (id: string) => {
    if (selectedIds === null) {
      // Currently "all" selected, switch to all except this one
      const allIds = [...categories.map(c => c.id), 'uncategorized'];
      onChange(allIds.filter(i => i !== id));
    } else if (selectedIds.includes(id)) {
      // Remove from selection
      const newIds = selectedIds.filter(i => i !== id);
      // If empty, keep empty (show nothing)
      onChange(newIds.length === 0 ? [] : newIds);
    } else {
      // Add to selection
      const newIds = [...selectedIds, id];
      // If all are selected, switch to null (all)
      const allIds = [...categories.map(c => c.id), 'uncategorized'];
      if (newIds.length === allIds.length) {
        onChange(null);
      } else {
        onChange(newIds);
      }
    }
  };

  const handleSelectAll = () => {
    onChange(null);
  };

  const handleSelectNone = () => {
    onChange([]);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="outline" size="sm" className={cn('gap-2', className)}>
            <Filter className="size-4" />
            <span className="hidden sm:inline">Categories</span>
            {!allSelected && (
              <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                {selectedCount}
              </Badge>
            )}
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Filter by Category</DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />

        <div className="flex gap-1 px-2 py-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 flex-1 text-xs"
            onClick={handleSelectAll}
          >
            All
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 flex-1 text-xs"
            onClick={handleSelectNone}
          >
            None
          </Button>
        </div>

        <DropdownMenuSeparator />

        <DropdownMenuGroup className="max-h-64 overflow-y-auto">
          {categories.map(category => (
            <DropdownMenuCheckboxItem
              key={category.id}
              checked={isSelected(category.id)}
              onCheckedChange={() => handleToggle(category.id)}
            >
              {category.icon && <span>{category.icon}</span>}
              {category.name}
            </DropdownMenuCheckboxItem>
          ))}
        </DropdownMenuGroup>

        <DropdownMenuSeparator />

        <DropdownMenuGroup>
          <DropdownMenuCheckboxItem
            checked={isSelected('uncategorized')}
            onCheckedChange={() => handleToggle('uncategorized')}
            className="text-muted-foreground"
          >
            Uncategorized
          </DropdownMenuCheckboxItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
