import * as React from "react";
import { createPortal } from "react-dom";
import { DismissableLayerBranch } from "@radix-ui/react-dismissable-layer";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";

export interface ComboboxOption {
  value: string;
  label: string;
  description?: string;
}

interface ComboboxProps {
  options: ComboboxOption[];
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  id?: string;
}

export function Combobox({
  options,
  value,
  onValueChange,
  placeholder = "Type or select...",
  disabled = false,
  id,
}: ComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [inputValue, setInputValue] = React.useState(value);
  const [dropdownStyle, setDropdownStyle] =
    React.useState<React.CSSProperties | null>(null);
  const [portalContainer, setPortalContainer] =
    React.useState<HTMLElement | null>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  // Sync input value with external value
  React.useEffect(() => {
    setInputValue(value);
  }, [value]);

  React.useEffect(() => {
    if (!open) {
      setDropdownStyle(null);
    }
  }, [open]);

  // Close dropdown when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        containerRef.current &&
        containerRef.current.contains(target)
      ) {
        return;
      }
      if (
        dropdownRef.current &&
        dropdownRef.current.contains(target)
      ) {
        return;
      }
      setOpen(false);
    };

    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
      return () =>
        document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [open]);

  const updateDropdownPosition = React.useCallback(() => {
    const input = inputRef.current;
    if (!input) return;
    const rect = input.getBoundingClientRect();
    const dialogContent = containerRef.current?.closest(
      "[data-slot='dialog-content']"
    ) as HTMLElement | null;

    if (dialogContent) {
      const dialogRect = dialogContent.getBoundingClientRect();
      setPortalContainer(dialogContent);
      setDropdownStyle({
        position: "absolute",
        top: rect.bottom - dialogRect.top + 4,
        left: rect.left - dialogRect.left,
        width: rect.width,
        zIndex: 60,
      });
      return;
    }

    const left = Math.max(
      8,
      Math.min(rect.left, window.innerWidth - rect.width - 8)
    );
    setPortalContainer(document.body);
    setDropdownStyle({
      position: "fixed",
      top: rect.bottom + 4,
      left,
      width: rect.width,
      zIndex: 60,
    });
  }, []);

  React.useEffect(() => {
    if (!open) return;
    updateDropdownPosition();
    window.addEventListener("resize", updateDropdownPosition);
    window.addEventListener("scroll", updateDropdownPosition, true);
    const dialogContent = containerRef.current?.closest(
      "[data-slot='dialog-content']"
    ) as HTMLElement | null;
    const scrollContainer = dialogContent?.querySelector(
      "[data-combobox-scroll]"
    ) as HTMLElement | null;
    scrollContainer?.addEventListener("scroll", updateDropdownPosition, true);
    return () => {
      window.removeEventListener("resize", updateDropdownPosition);
      window.removeEventListener("scroll", updateDropdownPosition, true);
      scrollContainer?.removeEventListener(
        "scroll",
        updateDropdownPosition,
        true
      );
    };
  }, [open, updateDropdownPosition]);

  // Filter options based on input
  const filteredOptions = React.useMemo(() => {
    if (!inputValue) return options;
    const lower = inputValue.toLowerCase();
    return options.filter(
      (opt) =>
        opt.label.toLowerCase().includes(lower) ||
        opt.value.toLowerCase().includes(lower) ||
        opt.description?.toLowerCase().includes(lower)
    );
  }, [options, inputValue]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setInputValue(newValue);
    onValueChange(newValue);
    if (!open) setOpen(true);
  };

  const handleSelect = (selectedValue: string) => {
    setInputValue(selectedValue);
    onValueChange(selectedValue);
    setOpen(false);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      setOpen(false);
    } else if (e.key === "ArrowDown" && !open) {
      setOpen(true);
    }
  };

  const handleFocus = () => {
    setOpen(true);
  };

  const handleBlur = (e: React.FocusEvent) => {
    // Don't close if clicking within the container (dropdown)
    if (containerRef.current?.contains(e.relatedTarget as Node)) {
      return;
    }
    if (dropdownRef.current?.contains(e.relatedTarget as Node)) {
      return;
    }
    // Small delay to allow click events on dropdown items
    setTimeout(() => setOpen(false), 150);
  };

  return (
    <div ref={containerRef} className="relative">
      <Input
        ref={inputRef}
        id={id}
        type="text"
        value={inputValue}
        onChange={handleInputChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        className="pr-8"
      />
      <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 shrink-0 opacity-50 pointer-events-none" />

      {open &&
        dropdownStyle &&
        createPortal(
          <DismissableLayerBranch className="absolute inset-0 pointer-events-none">
            <div
              ref={dropdownRef}
              style={dropdownStyle}
              className="rounded-md border bg-popover text-popover-foreground shadow-md pointer-events-auto"
            >
              {filteredOptions.length > 0 ? (
                <ul className="max-h-60 overflow-auto py-1">
                  {filteredOptions.map((option) => (
                    <li
                      key={option.value}
                      className={cn(
                        "relative flex cursor-pointer select-none items-center gap-2 px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground",
                        value === option.value && "bg-accent/50"
                      )}
                      onMouseDown={(e) => {
                        e.preventDefault(); // Prevent blur
                        handleSelect(option.value);
                      }}
                    >
                      <Check
                        className={cn(
                          "h-4 w-4 shrink-0",
                          value === option.value ? "opacity-100" : "opacity-0"
                        )}
                      />
                      <div className="flex flex-col">
                        <span>{option.label}</span>
                        {option.description && (
                          <span className="text-xs text-muted-foreground">
                            {option.description}
                          </span>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="py-3 text-center text-sm text-muted-foreground">
                  No options found
                </div>
              )}
            </div>
          </DismissableLayerBranch>,
          portalContainer ?? document.body
        )}
    </div>
  );
}
