import type { FormEvent, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DialogFooter } from "@/components/ui/dialog";
import type { AuthType } from "@/features/schema-graph/types";

export interface ServerConnectionFormValues {
  server: string;
  authType: AuthType;
  username: string;
  password: string;
  trustServerCertificate: boolean;
}

export interface ServerConnectionFormProps {
  values: ServerConnectionFormValues;
  onValuesChange: (patch: Partial<ServerConnectionFormValues>) => void;
  onSubmit: () => void | Promise<void>;
  isSubmitting: boolean;
  submitLabel: string;
  submitDisabled?: boolean;
  error?: string | null;
  cancelAction?: ReactNode;
  extraActions?: ReactNode;
  fieldIdPrefix?: string;
}

export function ServerConnectionForm({
  values,
  onValuesChange,
  onSubmit,
  isSubmitting,
  submitLabel,
  submitDisabled = false,
  error,
  cancelAction,
  extraActions,
  fieldIdPrefix = "server-connection",
}: ServerConnectionFormProps) {
  const isWindowsAuth = values.authType === "windows";
  const serverId = `${fieldIdPrefix}-server`;
  const authTypeId = `${fieldIdPrefix}-auth-type`;
  const usernameId = `${fieldIdPrefix}-username`;
  const passwordId = `${fieldIdPrefix}-password`;
  const trustCertId = `${fieldIdPrefix}-trust-cert`;
  const submitIsDisabled = isSubmitting || submitDisabled;

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (submitIsDisabled) return;
    void onSubmit();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="space-y-1">
        <Label htmlFor={serverId}>Server</Label>
        <Input
          id={serverId}
          type="text"
          value={values.server}
          onChange={(event) => onValuesChange({ server: event.target.value })}
          placeholder="HOST\\INSTANCE"
          required
        />
        <p className="text-xs text-muted-foreground">
          Examples: HOST\INSTANCE, HOST,1433, localhost
        </p>
      </div>

      <div className="space-y-1">
        <Label htmlFor={authTypeId}>Authentication</Label>
        <Select
          value={values.authType}
          onValueChange={(value: AuthType) => onValuesChange({ authType: value })}
        >
          <SelectTrigger id={authTypeId}>
            <SelectValue placeholder="Select authentication type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="sqlServer">SQL Server Authentication</SelectItem>
            <SelectItem value="windows">Windows Authentication</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {!isWindowsAuth && (
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label htmlFor={usernameId}>Username</Label>
            <Input
              id={usernameId}
              type="text"
              autoCapitalize="off"
              value={values.username}
              onChange={(event) => onValuesChange({ username: event.target.value })}
              placeholder="sa"
              required
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor={passwordId}>Password</Label>
            <Input
              id={passwordId}
              type="password"
              value={values.password}
              onChange={(event) => onValuesChange({ password: event.target.value })}
              required
            />
          </div>
        </div>
      )}

      <div className="flex items-center space-x-2">
        <Checkbox
          id={trustCertId}
          checked={values.trustServerCertificate}
          onCheckedChange={(checked) =>
            onValuesChange({ trustServerCertificate: checked === true })
          }
        />
        <Label htmlFor={trustCertId} className="text-sm font-normal">
          Trust Server Certificate
        </Label>
      </div>

      {error && (
        <div className="p-3 bg-destructive/10 border border-destructive/30 rounded-md text-sm text-destructive">
          {error}
        </div>
      )}

      <DialogFooter className="pt-2 sm:justify-end">
        {cancelAction}
        <Button
          type="submit"
          disabled={submitIsDisabled}
          className={cancelAction ? undefined : "flex-1"}
        >
          {isSubmitting ? "Connecting..." : submitLabel}
        </Button>
        {extraActions}
      </DialogFooter>
    </form>
  );
}
