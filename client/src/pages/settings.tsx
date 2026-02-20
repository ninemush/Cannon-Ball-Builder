import { Settings as SettingsIcon, ShieldAlert } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { Redirect } from "wouter";

export default function SettingsPage() {
  const { activeRole } = useAuth();

  if (activeRole !== "Admin") {
    return <Redirect to="/" />;
  }

  return (
    <div
      className="flex flex-col items-center justify-center h-full gap-4"
      data-testid="page-settings"
    >
      <div className="flex items-center justify-center w-16 h-16 rounded-full bg-card border border-border">
        <SettingsIcon className="h-7 w-7 text-cb-purple" />
      </div>
      <div className="text-center space-y-2">
        <h2 className="text-lg font-semibold text-foreground">Settings</h2>
        <p className="text-sm text-muted-foreground max-w-sm">
          Admin settings and configuration will be available here soon.
        </p>
      </div>
    </div>
  );
}
