import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Input } from "../components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Plus, GitBranch, Play, Pause, Trash2, Copy } from "lucide-react";

const flows = [
  {
    id: "flow-1",
    name: "Customer Support Flow",
    version: "v2.4.1",
    status: "active",
    environment: "production",
    executions: 45234,
    successRate: 99.4,
    lastModified: "2 days ago",
    description: "Automated customer support routing with sentiment analysis",
  },
  {
    id: "flow-2",
    name: "Document Processing",
    version: "v1.8.3",
    status: "active",
    environment: "production",
    executions: 12847,
    successRate: 98.7,
    lastModified: "1 week ago",
    description: "Extract and structure data from PDF documents",
  },
  {
    id: "flow-3",
    name: "Fraud Detection System",
    version: "v3.1.0",
    status: "active",
    environment: "production",
    executions: 89123,
    successRate: 96.8,
    lastModified: "3 days ago",
    description: "Multi-step fraud detection with risk scoring",
  },
  {
    id: "flow-4",
    name: "Content Moderation",
    version: "v1.2.0",
    status: "paused",
    environment: "staging",
    executions: 3421,
    successRate: 94.2,
    lastModified: "5 days ago",
    description: "AI-powered content moderation pipeline",
  },
  {
    id: "flow-5",
    name: "Lead Scoring Engine",
    version: "v2.0.0-beta",
    status: "draft",
    environment: "development",
    executions: 0,
    successRate: 0,
    lastModified: "1 day ago",
    description: "Automated lead qualification and scoring",
  },
];

const versions = [
  { version: "v2.4.1", deployedAt: "2 days ago", status: "active", deployedBy: "admin@acme.com" },
  { version: "v2.4.0", deployedAt: "1 week ago", status: "archived", deployedBy: "admin@acme.com" },
  { version: "v2.3.2", deployedAt: "2 weeks ago", status: "archived", deployedBy: "sarah@acme.com" },
  { version: "v2.3.1", deployedAt: "3 weeks ago", status: "archived", deployedBy: "admin@acme.com" },
];

export function Flows() {
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Flows</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Workflow lifecycle management with versioning and deployments
          </p>
        </div>
        <Button>
          <Plus className="size-4 mr-2" />
          New Flow
        </Button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <Input placeholder="Search flows..." className="max-w-xs" />
        <Select defaultValue="all">
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="paused">Paused</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
          </SelectContent>
        </Select>
        <Select defaultValue="all-env">
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Environment" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all-env">All Environments</SelectItem>
            <SelectItem value="production">Production</SelectItem>
            <SelectItem value="staging">Staging</SelectItem>
            <SelectItem value="development">Development</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Flows List */}
      <div className="space-y-3">
        {flows.map((flow) => (
          <Card key={flow.id}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <div className="size-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                    <GitBranch className="size-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-base">{flow.name}</CardTitle>
                      <Badge variant="outline" className="text-xs font-mono">
                        {flow.version}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">{flow.description}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge
                    variant={
                      flow.status === "active"
                        ? "default"
                        : flow.status === "paused"
                        ? "secondary"
                        : "outline"
                    }
                  >
                    {flow.status}
                  </Badge>
                  <Badge variant="outline">{flow.environment}</Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-6 text-sm">
                  <div>
                    <span className="text-muted-foreground">Executions: </span>
                    <span className="font-semibold">{flow.executions.toLocaleString()}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Success Rate: </span>
                    <span className="font-semibold">{flow.successRate}%</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Modified: </span>
                    <span className="text-xs">{flow.lastModified}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {flow.status === "active" ? (
                    <Button variant="outline" size="sm">
                      <Pause className="size-3 mr-1" />
                      Pause
                    </Button>
                  ) : (
                    <Button variant="outline" size="sm">
                      <Play className="size-3 mr-1" />
                      Activate
                    </Button>
                  )}
                  <Button variant="outline" size="sm">
                    <Copy className="size-3 mr-1" />
                    Clone
                  </Button>
                  <Button variant="outline" size="sm">
                    Edit
                  </Button>
                  <Button variant="ghost" size="sm">
                    <Trash2 className="size-3" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Version History */}
      <Card>
        <CardHeader>
          <CardTitle>Version History: Customer Support Flow</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {versions.map((version) => (
              <div
                key={version.version}
                className="flex items-center justify-between p-3 rounded-lg border border-border bg-secondary"
              >
                <div className="flex items-center gap-4">
                  <Badge variant={version.status === "active" ? "default" : "outline"} className="font-mono">
                    {version.version}
                  </Badge>
                  <div className="text-sm">
                    <div className="text-muted-foreground">
                      Deployed {version.deployedAt} by {version.deployedBy}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {version.status === "active" ? (
                    <Badge className="bg-green-500">Active</Badge>
                  ) : (
                    <>
                      <Button variant="outline" size="sm">
                        Rollback
                      </Button>
                      <Button variant="ghost" size="sm">
                        View
                      </Button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
