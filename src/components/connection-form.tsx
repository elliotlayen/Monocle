import { useState, type FormEvent } from "react";
import { useSchemaStore } from "@/stores/schemaStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { ConnectionParams } from "@/types/schema";

export function ConnectionForm() {
  const { loadSchema, loadMockSchema, isLoading, error } = useSchemaStore();

  const [formData, setFormData] = useState<ConnectionParams>({
    server: "localhost",
    database: "",
    username: "",
    password: "",
    trustServerCertificate: true,
  });

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    await loadSchema(formData);
  };

  const handleChange = (
    field: keyof ConnectionParams,
    value: string | boolean
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl">Connect to SQL Server</CardTitle>
          <CardDescription>
            Enter your database credentials to visualize the schema
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="server">Server</Label>
              <Input
                id="server"
                type="text"
                value={formData.server}
                onChange={(e) => handleChange("server", e.target.value)}
                placeholder="localhost or server.database.windows.net"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="database">Database</Label>
              <Input
                id="database"
                type="text"
                value={formData.database}
                onChange={(e) => handleChange("database", e.target.value)}
                placeholder="MyDatabase"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                type="text"
                value={formData.username}
                onChange={(e) => handleChange("username", e.target.value)}
                placeholder="sa"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={formData.password}
                onChange={(e) => handleChange("password", e.target.value)}
                required
              />
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="trustCert"
                checked={formData.trustServerCertificate}
                onCheckedChange={(checked) =>
                  handleChange("trustServerCertificate", checked === true)
                }
              />
              <Label htmlFor="trustCert" className="text-sm font-normal">
                Trust Server Certificate
              </Label>
            </div>

            {error && (
              <div className="p-3 bg-destructive/10 border border-destructive/30 rounded-md text-sm text-destructive">
                {error}
              </div>
            )}

            <div className="flex flex-col gap-2 pt-2">
              <Button type="submit" disabled={isLoading} className="w-full">
                {isLoading ? "Connecting..." : "Connect"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={loadMockSchema}
                disabled={isLoading}
                className="w-full"
              >
                Load Mock Data
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
