import { BookOpen } from "lucide-react";

export default function Guide() {
  return (
    <div
      className="flex flex-col items-center justify-center h-full gap-4"
      data-testid="page-guide"
    >
      <div className="flex items-center justify-center w-16 h-16 rounded-full bg-card border border-border">
        <BookOpen className="h-7 w-7 text-cb-teal" />
      </div>
      <div className="text-center space-y-2">
        <h2 className="text-lg font-semibold text-foreground">User Guide</h2>
        <p className="text-sm text-muted-foreground max-w-sm">
          Documentation and how-to guides will be available here soon.
        </p>
      </div>
    </div>
  );
}
