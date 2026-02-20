import { GitBranch } from "lucide-react";

export default function Home() {
  return (
    <div
      className="flex flex-col items-center justify-center h-full gap-4"
      data-testid="page-home"
    >
      <div className="flex items-center justify-center w-16 h-16 rounded-full bg-card border border-border">
        <GitBranch className="h-7 w-7 text-primary" />
      </div>
      <div className="text-center space-y-2">
        <h2 className="text-lg font-semibold text-foreground">
          CannonBall is loading...
        </h2>
        <p className="text-sm text-muted-foreground max-w-sm">
          Your automation pipeline workspace is getting ready. Features are on the way.
        </p>
      </div>
    </div>
  );
}
