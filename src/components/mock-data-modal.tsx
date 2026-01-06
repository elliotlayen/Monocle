import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type MockDataSize = "small" | "medium" | "large" | "stress";

interface MockDataModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onLoad: (size: MockDataSize) => void;
  isLoading: boolean;
}

const PRESETS: {
  id: MockDataSize;
  label: string;
  description: string;
  stats: { tables: number; views: number; relationships: number };
}[] = [
  {
    id: "small",
    label: "Small",
    description: "Quick testing",
    stats: { tables: 10, views: 3, relationships: 15 },
  },
  {
    id: "medium",
    label: "Medium",
    description: "Typical database",
    stats: { tables: 100, views: 20, relationships: 150 },
  },
  {
    id: "large",
    label: "Large",
    description: "Enterprise scale",
    stats: { tables: 500, views: 50, relationships: 750 },
  },
  {
    id: "stress",
    label: "Stress Test",
    description: "Performance testing",
    stats: { tables: 2000, views: 200, relationships: 3000 },
  },
];

export function MockDataModal({
  open,
  onOpenChange,
  onLoad,
  isLoading,
}: MockDataModalProps) {
  const [selectedSize, setSelectedSize] = useState<MockDataSize>("small");

  const handleLoad = () => {
    onLoad(selectedSize);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Load Mock Data</DialogTitle>
          <DialogDescription>
            Select a preset size for testing and development
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3 py-4">
          {PRESETS.map((preset) => (
            <button
              key={preset.id}
              onClick={() => setSelectedSize(preset.id)}
              disabled={isLoading}
              className={cn(
                "flex flex-col items-start p-3 rounded-lg border-2 transition-colors text-left",
                selectedSize === preset.id
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/50"
              )}
            >
              <span className="font-medium">{preset.label}</span>
              <span className="text-xs text-muted-foreground">
                {preset.description}
              </span>
              <span className="text-xs text-muted-foreground mt-1">
                {preset.stats.tables} tables, {preset.stats.views} views
              </span>
            </button>
          ))}
        </div>

        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button onClick={handleLoad} disabled={isLoading}>
            {isLoading ? "Loading..." : "Load"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
