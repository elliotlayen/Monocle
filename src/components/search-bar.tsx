import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useSchemaStore } from '@/stores/schemaStore';
import { useShallow } from 'zustand/shallow';
import { searchSchema } from '@/lib/search-utils';
import type { SearchResult, GroupedSearchResults } from '@/types/search';
import { Input } from '@/components/ui/input';
import { Search, X, Table2, Eye, Zap, Code, Columns, FunctionSquare } from 'lucide-react';
import { cn } from '@/lib/utils';
import { OBJECT_COLORS } from '@/constants/edge-colors';

function getColorForType(type: SearchResult['type']): string {
  switch (type) {
    case 'table': return OBJECT_COLORS.tables;
    case 'view': return OBJECT_COLORS.views;
    case 'column': return OBJECT_COLORS.tables;
    case 'trigger': return OBJECT_COLORS.triggers;
    case 'procedure': return OBJECT_COLORS.storedProcedures;
    case 'function': return OBJECT_COLORS.scalarFunctions;
  }
}

function getIconForType(type: SearchResult['type']) {
  const color = getColorForType(type);
  switch (type) {
    case 'table':
      return <Table2 className="w-4 h-4" style={{ color }} />;
    case 'view':
      return <Eye className="w-4 h-4" style={{ color }} />;
    case 'column':
      return <Columns className="w-4 h-4" style={{ color }} />;
    case 'trigger':
      return <Zap className="w-4 h-4" style={{ color }} />;
    case 'procedure':
      return <Code className="w-4 h-4" style={{ color }} />;
    case 'function':
      return <FunctionSquare className="w-4 h-4" style={{ color }} />;
  }
}

function flattenResults(results: GroupedSearchResults): Array<{
  type: 'header' | 'result';
  category?: string;
  result?: SearchResult;
}> {
  const flattened: Array<{
    type: 'header' | 'result';
    category?: string;
    result?: SearchResult;
  }> = [];

  if (results.tables.length > 0) {
    flattened.push({ type: 'header', category: 'Tables' });
    for (const table of results.tables) {
      flattened.push({ type: 'result', result: table });
    }
  }

  if (results.views.length > 0) {
    flattened.push({ type: 'header', category: 'Views' });
    for (const view of results.views) {
      flattened.push({ type: 'result', result: view });
    }
  }

  if (results.columns.length > 0) {
    flattened.push({ type: 'header', category: 'Columns' });
    for (const column of results.columns) {
      flattened.push({ type: 'result', result: column });
    }
  }

  if (results.triggers.length > 0) {
    flattened.push({ type: 'header', category: 'Triggers' });
    for (const trigger of results.triggers) {
      flattened.push({ type: 'result', result: trigger });
    }
  }

  if (results.procedures.length > 0) {
    flattened.push({ type: 'header', category: 'Procedures' });
    for (const procedure of results.procedures) {
      flattened.push({ type: 'result', result: procedure });
    }
  }

  if (results.functions.length > 0) {
    flattened.push({ type: 'header', category: 'Functions' });
    for (const fn of results.functions) {
      flattened.push({ type: 'result', result: fn });
    }
  }

  return flattened;
}

export function SearchBar() {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [debouncedQuery, setDebouncedQuery] = useState('');

  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const {
    schema,
    searchFilter,
    setSearchFilter,
    setDebouncedSearchFilter,
    setFocusedTable,
  } = useSchemaStore(
    useShallow((state) => ({
      schema: state.schema,
      searchFilter: state.searchFilter,
      setSearchFilter: state.setSearchFilter,
      setDebouncedSearchFilter: state.setDebouncedSearchFilter,
      setFocusedTable: state.setFocusedTable,
    }))
  );

  // Debounce search query
  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(() => {
      setDebouncedQuery(searchFilter);
      setDebouncedSearchFilter(searchFilter);
    }, 150);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [searchFilter, setDebouncedSearchFilter]);

  // Compute search results
  const results = useMemo<GroupedSearchResults | null>(() => {
    if (!schema || !debouncedQuery.trim()) {
      return null;
    }
    return searchSchema(schema, debouncedQuery);
  }, [schema, debouncedQuery]);

  // Flatten results for keyboard navigation
  const flatResults = useMemo(() => {
    if (!results) return [];
    return flattenResults(results);
  }, [results]);

  // Get selectable items (only results, not headers)
  const selectableItems = useMemo(() => {
    return flatResults.filter((item) => item.type === 'result');
  }, [flatResults]);

  // Open dropdown when we have results
  useEffect(() => {
    if (results && results.totalCount > 0) {
      setIsOpen(true);
      setSelectedIndex(0);
    } else {
      setIsOpen(false);
    }
  }, [results]);

  // Handle result selection
  const handleSelectResult = useCallback(
    (result: SearchResult) => {
      switch (result.type) {
        case 'table':
          setFocusedTable(result.tableId);
          break;
        case 'view':
          setFocusedTable(result.viewId);
          break;
        case 'column':
          setFocusedTable(result.parentId);
          break;
        case 'trigger':
          setFocusedTable(result.tableId);
          break;
        case 'procedure':
          // Procedures don't have focus, keep the filter active
          break;
        case 'function':
          // Functions don't have focus, keep the filter active
          break;
      }
      setIsOpen(false);
      inputRef.current?.blur();
    },
    [setFocusedTable]
  );

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (!isOpen || selectableItems.length === 0) {
        if (e.key === 'Escape') {
          setSearchFilter('');
          inputRef.current?.blur();
        }
        return;
      }

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex((prev) =>
            prev < selectableItems.length - 1 ? prev + 1 : prev
          );
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex((prev) => (prev > 0 ? prev - 1 : prev));
          break;
        case 'Enter': {
          e.preventDefault();
          const selectedItem = selectableItems[selectedIndex];
          if (selectedItem?.result) {
            handleSelectResult(selectedItem.result as SearchResult);
          }
          break;
        }
        case 'Escape':
          e.preventDefault();
          setIsOpen(false);
          break;
      }
    },
    [isOpen, selectableItems, selectedIndex, handleSelectResult, setSearchFilter]
  );

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        !inputRef.current?.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Track which result index corresponds to each selectable item
  const getSelectableIndex = (result: SearchResult): number => {
    return selectableItems.findIndex((item) => item.result?.id === result.id);
  };

  return (
    <div className="relative flex-1 max-w-md">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
      <Input
        ref={inputRef}
        type="text"
        placeholder="Search"
        value={searchFilter}
        onChange={(e) => setSearchFilter(e.target.value)}
        onKeyDown={handleKeyDown}
        onFocus={() => {
          if (results && results.totalCount > 0) {
            setIsOpen(true);
          }
        }}
        onBlur={() => {
          // Small delay to allow click events on dropdown items to fire
          setTimeout(() => setIsOpen(false), 150);
        }}
        className="pl-9 h-9"
      />
      {searchFilter && (
        <button
          onClick={() => {
            setSearchFilter('');
            setIsOpen(false);
          }}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-muted rounded"
        >
          <X className="w-3 h-3 text-muted-foreground" />
        </button>
      )}

      {isOpen && results && results.totalCount > 0 && (
        <div
          ref={dropdownRef}
          className="absolute top-full left-0 right-0 mt-1 bg-popover border border-border rounded-md shadow-lg z-50 overflow-hidden"
        >
          <div className="max-h-[400px] overflow-y-auto py-1">
            {flatResults.map((item) => {
                if (item.type === 'header') {
                  return (
                    <div
                      key={`header-${item.category}`}
                      className="px-3 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider bg-muted/50"
                    >
                      {item.category}
                    </div>
                  );
                }

                const result = item.result as SearchResult;
                const selectableIdx = getSelectableIndex(result);
                const isSelected = selectableIdx === selectedIndex;

                return (
                  <button
                    key={result.id}
                    onClick={() => handleSelectResult(result)}
                    onMouseEnter={() => setSelectedIndex(selectableIdx)}
                    className={cn(
                      'w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-accent transition-colors',
                      isSelected && 'bg-accent'
                    )}
                  >
                    <div className="shrink-0">{getIconForType(result.type)}</div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate" style={{ color: getColorForType(result.type) }}>
                        {result.label}
                      </div>
                      {result.sublabel && (
                        <div className="text-xs text-muted-foreground truncate">
                          {result.sublabel}
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
          </div>
        </div>
      )}

      {isOpen && results && results.totalCount === 0 && debouncedQuery.trim() && (
        <div
          ref={dropdownRef}
          className="absolute top-full left-0 right-0 mt-1 bg-popover border border-border rounded-md shadow-lg z-50 p-4 text-center text-sm text-muted-foreground"
        >
          No results found
        </div>
      )}
    </div>
  );
}
