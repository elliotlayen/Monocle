import type { AuthType } from "@/features/schema-graph/types";

export type ImportDialogStep = "connect" | "database" | "pick";

export interface ImportConnectionIdentity {
  server: string;
  authType: AuthType;
  username: string;
  trustServerCertificate: boolean;
}

interface ImportConnectionIdentityInput {
  server: string;
  authType: AuthType;
  username?: string;
  trustServerCertificate: boolean;
}

export const getImportSessionStep = (
  hasCachedDatabases: boolean
): ImportDialogStep => (hasCachedDatabases ? "database" : "connect");

export const buildImportConnectionIdentity = ({
  server,
  authType,
  username,
  trustServerCertificate,
}: ImportConnectionIdentityInput): ImportConnectionIdentity => ({
  server,
  authType,
  username: authType === "sqlServer" ? (username ?? "") : "",
  trustServerCertificate,
});

export const shouldInvalidateImportSession = (
  previous: ImportConnectionIdentity,
  next: ImportConnectionIdentity
) =>
  previous.server !== next.server ||
  previous.authType !== next.authType ||
  previous.username !== next.username ||
  previous.trustServerCertificate !== next.trustServerCertificate;

export const resolveSelectedDatabaseAfterConnect = (
  databases: string[],
  previousSelectedDatabase: string
) => {
  if (previousSelectedDatabase && databases.includes(previousSelectedDatabase)) {
    return previousSelectedDatabase;
  }
  return databases[0] ?? "";
};
