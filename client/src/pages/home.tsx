function CannonBallIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <circle cx="16" cy="18" r="11" fill="currentColor" />
      <line x1="22" y1="10" x2="26" y2="4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <circle cx="27" cy="3" r="1.5" fill="hsl(var(--primary))" />
    </svg>
  );
}

export default function Home() {
  return (
    <div
      className="flex flex-col items-center justify-center h-full gap-4"
      data-testid="page-home"
    >
      <div className="flex items-center justify-center w-16 h-16 rounded-full bg-card border border-border">
        <CannonBallIcon className="h-8 w-8 text-foreground" />
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
