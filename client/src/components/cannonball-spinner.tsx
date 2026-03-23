import { Loader2 } from "lucide-react";

export function PrimarySpinner({ className = "", size = 14 }: { className?: string; size?: number }) {
  return (
    <span className={`inline-flex items-center shrink-0 ${className}`}>
      <Loader2
        style={{ width: size, height: size }}
        className="animate-spin text-primary"
        aria-hidden="true"
      />
    </span>
  );
}
