import { useState, useCallback } from "react";
import { useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, AlertTriangle, ArrowRight } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import type { Idea } from "@shared/schema";

interface SimilarIdea {
  id: string;
  title: string;
  description: string;
  stage: string;
  owner: string;
  score: number;
}

interface NewIdeaModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function NewIdeaModal({ open, onOpenChange }: NewIdeaModalProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, navigate] = useLocation();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [owner, setOwner] = useState(user?.displayName ?? "");
  const [tag, setTag] = useState("");
  const [similarIdeas, setSimilarIdeas] = useState<SimilarIdea[]>([]);
  const [showSimilar, setShowSimilar] = useState(false);
  const [checkingDuplicates, setCheckingDuplicates] = useState(false);

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/ideas", {
        title,
        description,
        owner: owner || user?.displayName,
        ownerEmail: user?.email,
        tag: tag || null,
      });
      return (await res.json()) as Idea;
    },
    onSuccess: (idea) => {
      queryClient.invalidateQueries({ queryKey: ["/api/ideas"] });
      onOpenChange(false);
      resetForm();
      navigate(`/workspace/${idea.id}`);
    },
    onError: (err: Error) => {
      toast({
        title: "Failed to create idea",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const resetForm = useCallback(() => {
    setTitle("");
    setDescription("");
    setOwner(user?.displayName ?? "");
    setTag("");
    setSimilarIdeas([]);
    setShowSimilar(false);
  }, [user?.displayName]);

  const checkDuplicates = useCallback(async () => {
    if (!title.trim()) return;
    setCheckingDuplicates(true);
    try {
      const res = await apiRequest("POST", "/api/ideas/check-similar", {
        title: title.trim(),
        description: description.trim(),
      });
      const data = await res.json();
      if (data.similar && data.similar.length > 0) {
        setSimilarIdeas(data.similar);
        setShowSimilar(true);
      } else {
        createMutation.mutate();
      }
    } catch {
      createMutation.mutate();
    } finally {
      setCheckingDuplicates(false);
    }
  }, [title, description, createMutation]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) return;
    if (showSimilar) {
      createMutation.mutate();
    } else {
      checkDuplicates();
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => {
      if (!o) resetForm();
      onOpenChange(o);
    }}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>New Idea</DialogTitle>
        </DialogHeader>

        {showSimilar && similarIdeas.length > 0 ? (
          <div className="space-y-4 pt-2">
            <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30">
              <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium text-amber-500">Similar ideas found</p>
                <p className="text-xs text-muted-foreground mt-1">
                  These existing ideas look similar. Review them before creating a new one.
                </p>
              </div>
            </div>

            <div className="space-y-2 max-h-[240px] overflow-y-auto">
              {similarIdeas.map((idea) => (
                <div
                  key={idea.id}
                  className="p-3 rounded-lg border border-border bg-card hover:border-primary/30 transition-colors cursor-pointer group"
                  onClick={() => {
                    onOpenChange(false);
                    resetForm();
                    navigate(`/workspace/${idea.id}`);
                  }}
                  data-testid={`similar-idea-${idea.id}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">
                        {idea.title}
                      </h4>
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{idea.description}</p>
                    </div>
                    <ArrowRight className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary shrink-0 mt-0.5" />
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <Badge variant="outline" className="text-[10px]">{idea.stage}</Badge>
                    <span className="text-[10px] text-muted-foreground">{idea.owner}</span>
                    <span className="text-[10px] text-amber-500 ml-auto">{idea.score}% match</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowSimilar(false);
                  setSimilarIdeas([]);
                }}
                data-testid="button-back-to-form"
              >
                Back
              </Button>
              <Button
                onClick={() => createMutation.mutate()}
                disabled={createMutation.isPending}
                data-testid="button-proceed-anyway"
              >
                {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create Anyway
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label htmlFor="idea-title">Idea Title</Label>
              <Input
                id="idea-title"
                placeholder="e.g., Automate invoice processing"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                data-testid="input-idea-title"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="idea-desc">One-line Description</Label>
              <Input
                id="idea-desc"
                placeholder="Briefly describe the automation idea"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                data-testid="input-idea-description"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="idea-owner">Process Owner</Label>
              <Input
                id="idea-owner"
                value={owner}
                onChange={(e) => setOwner(e.target.value)}
                data-testid="input-idea-owner"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="idea-tag">
                Tag / Category <span className="text-muted-foreground font-normal">(optional)</span>
              </Label>
              <Input
                id="idea-tag"
                placeholder="e.g., Finance, HR, Operations"
                value={tag}
                onChange={(e) => setTag(e.target.value)}
                data-testid="input-idea-tag"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                data-testid="button-cancel-idea"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={!title.trim() || !description.trim() || createMutation.isPending || checkingDuplicates}
                data-testid="button-submit-idea"
              >
                {(createMutation.isPending || checkingDuplicates) && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Submit Idea
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
