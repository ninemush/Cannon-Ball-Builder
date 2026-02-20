import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Link } from "wouter";
import { type Idea } from "@shared/schema";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Lightbulb, Clock, ArrowRight } from "lucide-react";

function formatTimestamp(date: string | Date): string {
  const d = new Date(date);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function Ideas() {
  const { user } = useAuth();
  const { data: allIdeas, isLoading } = useQuery<Idea[]>({
    queryKey: ["/api/ideas"],
  });

  const myIdeas = (allIdeas ?? []).filter(
    (idea) => idea.ownerEmail === user?.email
  );

  if (isLoading) {
    return (
      <div className="flex flex-col h-full" data-testid="page-ideas">
        <div className="px-6 py-4 border-b border-border">
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-3 w-40 mt-1.5" />
        </div>
        <div className="p-6 space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full" data-testid="page-ideas">
      <div className="px-6 py-4 border-b border-border">
        <h1 className="text-lg font-semibold text-foreground">My Ideas</h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          {myIdeas.length} idea{myIdeas.length !== 1 ? "s" : ""} submitted
        </p>
      </div>

      {myIdeas.length === 0 ? (
        <div className="flex flex-col items-center justify-center flex-1 gap-4">
          <div className="flex items-center justify-center w-16 h-16 rounded-full bg-card border border-border">
            <Lightbulb className="h-7 w-7 text-cb-gold" />
          </div>
          <div className="text-center space-y-2">
            <h2 className="text-base font-semibold text-foreground">No ideas yet</h2>
            <p className="text-sm text-muted-foreground max-w-sm">
              Click "New Idea" in the top navigation to submit your first automation idea.
            </p>
          </div>
        </div>
      ) : (
        <div className="p-6 space-y-3 overflow-y-auto">
          {myIdeas.map((idea) => (
            <Link
              key={idea.id}
              href={`/workspace/${idea.id}`}
              className="block p-4 rounded-lg bg-card border border-card-border hover:border-primary/30 transition-colors cursor-pointer group"
              data-testid={`idea-card-${idea.id}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">
                    {idea.title}
                  </h4>
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                    {idea.description}
                  </p>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0 mt-0.5" />
              </div>
              <div className="flex items-center gap-3 mt-3">
                <Badge variant="outline" className="text-[10px]">
                  {idea.stage}
                </Badge>
                {idea.tag && (
                  <Badge variant="secondary" className="text-[10px]">
                    {idea.tag}
                  </Badge>
                )}
                <span className="text-[10px] text-muted-foreground flex items-center gap-1 ml-auto">
                  <Clock className="h-2.5 w-2.5" />
                  {formatTimestamp(idea.updatedAt)}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
