import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export type CanvasDirtyAction = "exit" | "open" | "enter";

const ACTION_LABELS: Record<CanvasDirtyAction, string> = {
  exit: "leave Canvas Mode",
  open: "open another file",
  enter: "start a new canvas",
};

interface CanvasDirtyDialogProps {
  open: boolean;
  action: CanvasDirtyAction;
  fileName: string;
  isSaving?: boolean;
  onOpenChange: (open: boolean) => void;
  onSaveAndContinue: () => void;
  onDiscardAndContinue: () => void;
}

export function CanvasDirtyDialog({
  open,
  action,
  fileName,
  isSaving = false,
  onOpenChange,
  onSaveAndContinue,
  onDiscardAndContinue,
}: CanvasDirtyDialogProps) {
  const actionLabel = ACTION_LABELS[action];
  const fileLabel = fileName === "Untitled" ? "this canvas" : fileName;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" showCloseButton={!isSaving}>
        <DialogHeader>
          <DialogTitle>Unsaved changes</DialogTitle>
          <DialogDescription>
            You have unsaved changes in {fileLabel}. Save before you {actionLabel}?
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSaving}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={onDiscardAndContinue}
            disabled={isSaving}
          >
            Don't Save
          </Button>
          <Button onClick={onSaveAndContinue} disabled={isSaving}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
