import { Outlet, Link, useLocation } from "react-router";
import { Bell, Search, User, ChevronDown, LayoutDashboard, Sparkles, Workflow, Play, TestTube, UserCheck, GitBranch, Database, Wrench, Code, ScrollText, CreditCard, Activity, Settings } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "./ui/dropdown-menu";
import { Badge } from "./ui/badge";
import { useState } from "react";

const navItems = [
  { path: "/", label: "Dashboard", icon: LayoutDashboard },
  { path: "/assistant", label: "AI Assistant", icon: Sparkles },
  { path: "/builder", label: "Builder", icon: Workflow },
  { path: "/playground", label: "Playground", icon: Play },
  { path: "/test-suite", label: "Test Suite", icon: TestTube },
  { path: "/review-queue", label: "Review Queue", icon: UserCheck },
  { path: "/flows", label: "Flows", icon: GitBranch },
  { path: "/rag", label: "RAG", icon: Database },
  { path: "/tools", label: "Tools", icon: Wrench },
  { path: "/api", label: "API & Embed", icon: Code },
  { path: "/logs", label: "Logs", icon: ScrollText },
  { path: "/usage", label: "Usage & Billing", icon: CreditCard },
  { path: "/health", label: "Health", icon: Activity },
  { path: "/settings", label: "Settings", icon: Settings },
];

export function MainLayout() {
  const location = useLocation();
  const [tenant, setTenant] = useState("acme-corp");
  const [environment, setEnvironment] = useState("production");

  return (
    <div className="flex h-screen bg-background dark">
      {/* Sidebar */}
      <aside className="w-64 border-r border-sidebar-border bg-sidebar flex flex-col">
        <div className="p-4 border-b border-sidebar-border">
          <h1 className="text-xl font-semibold text-sidebar-foreground">AI Control Plane</h1>
          <p className="text-xs text-muted-foreground mt-1">Enterprise Infrastructure</p>
        </div>
        
        <nav className="flex-1 overflow-y-auto p-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg mb-1 transition-colors ${
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                }`}
              >
                <Icon className="size-4" />
                <span className="text-sm">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-sidebar-border">
          <div className="text-xs text-muted-foreground">
            <div className="mb-1">Version 2.4.1</div>
            <div>© 2026 Enterprise AI</div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Topbar */}
        <header className="h-14 border-b border-border bg-card flex items-center justify-between px-4 gap-4">
          <div className="flex items-center gap-4 flex-1">
            {/* Tenant Selector */}
            <Select value={tenant} onValueChange={setTenant}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="acme-corp">Acme Corp</SelectItem>
                <SelectItem value="globex">Globex Inc</SelectItem>
                <SelectItem value="initech">Initech</SelectItem>
              </SelectContent>
            </Select>

            {/* Environment Selector */}
            <Select value={environment} onValueChange={setEnvironment}>
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="production">
                  <div className="flex items-center gap-2">
                    <div className="size-2 rounded-full bg-green-500" />
                    Production
                  </div>
                </SelectItem>
                <SelectItem value="staging">
                  <div className="flex items-center gap-2">
                    <div className="size-2 rounded-full bg-yellow-500" />
                    Staging
                  </div>
                </SelectItem>
                <SelectItem value="development">
                  <div className="flex items-center gap-2">
                    <div className="size-2 rounded-full bg-blue-500" />
                    Development
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>

            {/* Search */}
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                placeholder="Search workflows, logs, tools..."
                className="pl-9 bg-input-background border-border"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Notifications */}
            <Button variant="ghost" size="icon" className="relative">
              <Bell className="size-4" />
              <Badge className="absolute -top-1 -right-1 size-5 flex items-center justify-center p-0 bg-destructive text-xs">
                3
              </Badge>
            </Button>

            {/* User Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="flex items-center gap-2">
                  <div className="size-8 rounded-full bg-primary flex items-center justify-center">
                    <User className="size-4 text-primary-foreground" />
                  </div>
                  <span className="text-sm">Admin User</span>
                  <ChevronDown className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuLabel>My Account</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem>Profile</DropdownMenuItem>
                <DropdownMenuItem>Team</DropdownMenuItem>
                <DropdownMenuItem>Documentation</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem>Log out</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-auto bg-background">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
