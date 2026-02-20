import { Lightbulb } from "lucide-react";

export default function Ideas() {
  return (
    <div
      className="flex flex-col items-center justify-center h-full gap-4"
      data-testid="page-ideas"
    >
      <div className="flex items-center justify-center w-16 h-16 rounded-full bg-card border border-border">
        <Lightbulb className="h-7 w-7 text-cb-gold" />
      </div>
      <div className="text-center space-y-2">
        <h2 className="text-lg font-semibold text-foreground">My Ideas</h2>
        <p className="text-sm text-muted-foreground max-w-sm">
          Your submitted ideas will appear here. This section is coming soon.
        </p>
      </div>
    </div>
  );
}
