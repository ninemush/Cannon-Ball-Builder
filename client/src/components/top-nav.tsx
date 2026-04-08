import { useState } from "react";
import { Bell, Moon, Sun, ChevronDown, LogOut, Plus, Menu } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useTheme } from "@/components/theme-provider";
import { useAuth } from "@/hooks/use-auth";
import { NewIdeaModal } from "@/components/new-idea-modal";
import { ROLES, type UserRole } from "@shared/schema";

function getRoleColor(role: UserRole): string {
  switch (role) {
    case "Process SME":
      return "bg-cb-teal text-white";
    case "CoE":
      return "bg-cb-gold text-white";
    case "Admin":
      return "bg-cb-purple text-white";
    default:
      return "bg-secondary text-secondary-foreground";
  }
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function TopNav() {
  const { theme, toggleTheme } = useTheme();
  const { user, activeRole, switchRole, logout } = useAuth();
  const [newIdeaOpen, setNewIdeaOpen] = useState(false);
  const isMobile = useIsMobile();

  return (
    <>
    <NewIdeaModal open={newIdeaOpen} onOpenChange={setNewIdeaOpen} />
    <header
      className="flex items-center justify-between gap-2 px-3 sm:px-4 h-12 sm:h-14 bg-card z-50 sticky top-0 border-b border-[#3d3d3d] dark:border-[#3d3d3d]"
      data-testid="top-nav"
    >
      <div className="flex items-center gap-2 sm:gap-3">
        <SidebarTrigger data-testid="button-sidebar-toggle" />
        <span
          className="text-lg sm:text-xl font-bold tracking-tight select-none"
          data-testid="text-logo"
        >
          <span className="text-primary">Cannon</span>
          <span className="text-foreground">Ball</span>
        </span>
      </div>

      <div className="flex items-center gap-1 sm:gap-2">
        <Button
          size="sm"
          onClick={() => setNewIdeaOpen(true)}
          data-testid="button-new-idea"
          className="gap-1 sm:gap-1.5 h-8 px-2 sm:px-3"
        >
          <Plus className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">New Idea</span>
        </Button>

        {!isMobile && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" data-testid="button-role-switcher">
                <span className="text-xs text-muted-foreground mr-1">Demo Mode</span>
                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuLabel className="text-xs text-muted-foreground">
                Switch Role
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {ROLES.map((role) => (
                <DropdownMenuItem
                  key={role}
                  onClick={() => switchRole(role)}
                  data-testid={`menu-role-${role.toLowerCase().replace(/\s/g, "-")}`}
                >
                  <span className="flex items-center gap-2 w-full">
                    <span
                      className={`inline-block w-2 h-2 rounded-full ${
                        role === activeRole ? "bg-primary" : "bg-muted-foreground/30"
                      }`}
                    />
                    <span className={role === activeRole ? "font-medium" : ""}>
                      {role}
                    </span>
                  </span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {!isMobile && (
          <Button
            variant="ghost"
            size="icon"
            data-testid="button-notifications"
            className="relative"
          >
            <Bell className="h-4 w-4" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-primary" />
          </Button>
        )}

        <Button
          variant="ghost"
          size="icon"
          onClick={toggleTheme}
          data-testid="button-theme-toggle"
          className="h-8 w-8 sm:h-9 sm:w-9"
        >
          {theme === "dark" ? (
            <Sun className="h-4 w-4" />
          ) : (
            <Moon className="h-4 w-4" />
          )}
        </Button>

        {!isMobile && (
          <Badge
            className={`text-xs no-default-hover-elevate no-default-active-elevate ${getRoleColor(activeRole)}`}
            data-testid="badge-active-role"
          >
            {activeRole}
          </Badge>
        )}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full h-8 w-8 sm:h-9 sm:w-9"
              data-testid="button-user-avatar"
            >
              <Avatar className="h-7 w-7 sm:h-8 sm:w-8">
                <AvatarFallback className="bg-cb-dark-slate text-white text-[10px] sm:text-xs font-medium">
                  {user ? getInitials(user.displayName) : "CB"}
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <div className="flex flex-col gap-1">
                <span className="text-sm font-medium" data-testid="text-user-name">
                  {user?.displayName ?? "Demo User"}
                </span>
                <span className="text-xs text-muted-foreground" data-testid="text-user-email">
                  {user?.email ?? "demo@cannonball.demo"}
                </span>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {isMobile && (
              <>
                <DropdownMenuLabel className="text-xs text-muted-foreground">
                  Switch Role
                </DropdownMenuLabel>
                {ROLES.map((role) => (
                  <DropdownMenuItem
                    key={role}
                    onClick={() => switchRole(role)}
                    data-testid={`menu-role-${role.toLowerCase().replace(/\s/g, "-")}`}
                  >
                    <span className="flex items-center gap-2 w-full">
                      <span
                        className={`inline-block w-2 h-2 rounded-full ${
                          role === activeRole ? "bg-primary" : "bg-muted-foreground/30"
                        }`}
                      />
                      <span className={role === activeRole ? "font-medium" : ""}>
                        {role}
                      </span>
                    </span>
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
              </>
            )}
            <DropdownMenuItem onClick={logout} data-testid="button-logout">
              <LogOut className="mr-2 h-4 w-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
    </>
  );
}
