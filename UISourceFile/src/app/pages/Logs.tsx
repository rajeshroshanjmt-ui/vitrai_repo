import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { CheckCircle2, XCircle, Clock, AlertTriangle, Download } from "lucide-react";

const logs = [
  {
    id: "log-1",
    timestamp: "2026-02-19 14:23:41.123",
    workflowId: "wf_customer_support",
    executionId: "exec_a8b9c0d1",
    status: "success",
    duration: "847ms",
    level: "info",
    message: "Workflow completed successfully",
  },
  {
    id: "log-2",
    timestamp: "2026-02-19 14:22:15.456",
    workflowId: "wf_fraud_detection",
    executionId: "exec_e2f3g4h5",
    status: "success",
    duration: "1234ms",
    level: "info",
    message: "Fraud check completed - no issues detected",
  },
  {
    id: "log-3",
    timestamp: "2026-02-19 14:21:08.789",
    workflowId: "wf_document_processing",
    executionId: "exec_i6j7k8l9",
    status: "error",
    duration: "523ms",
    level: "error",
    message: "Failed to extract text from PDF - file corrupted",
  },
  {
    id: "log-4",
    timestamp: "2026-02-19 14:20:42.012",
    workflowId: "wf_content_moderation",
    executionId: "exec_m0n1o2p3",
    status: "warning",
    duration: "612ms",
    level: "warning",
    message: "Low confidence score (0.62) - routed to human review",
  },
  {
    id: "log-5",
    timestamp: "2026-02-19 14:19:33.345",
    workflowId: "wf_customer_support",
    executionId: "exec_q4r5s6t7",
    status: "success",
    duration: "923ms",
    level: "info",
    message: "Successfully routed to agent @sarah",
  },
];

const getStatusIcon = (status: string) => {
  switch (status) {
    case "success":
      return <CheckCircle2 className="size-4 text-green-500" />;
    case "error":
      return <XCircle className="size-4 text-red-500" />;
    case "warning":
      return <AlertTriangle className="size-4 text-yellow-500" />;
    default:
      return <Clock className="size-4 text-blue-500" />;
  }
};

const getLevelBadge = (level: string) => {
  const variants: Record<string, any> = {
    info: "default",
    warning: "secondary",
    error: "destructive",
  };
  return <Badge variant={variants[level] || "outline"}>{level}</Badge>;
};

export function Logs() {
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Logs</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Real-time execution monitoring with filters and traces
          </p>
        </div>
        <Button variant="outline">
          <Download className="size-4 mr-2" />
          Export Logs
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Input placeholder="Search logs..." />
            <Select defaultValue="all-status">
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all-status">All Status</SelectItem>
                <SelectItem value="success">Success</SelectItem>
                <SelectItem value="error">Error</SelectItem>
                <SelectItem value="warning">Warning</SelectItem>
              </SelectContent>
            </Select>
            <Select defaultValue="all-workflows">
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all-workflows">All Workflows</SelectItem>
                <SelectItem value="wf_customer_support">Customer Support</SelectItem>
                <SelectItem value="wf_fraud_detection">Fraud Detection</SelectItem>
                <SelectItem value="wf_document_processing">Document Processing</SelectItem>
              </SelectContent>
            </Select>
            <Select defaultValue="24h">
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1h">Last Hour</SelectItem>
                <SelectItem value="24h">Last 24 Hours</SelectItem>
                <SelectItem value="7d">Last 7 Days</SelectItem>
                <SelectItem value="30d">Last 30 Days</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Logs Table */}
      <Card>
        <CardHeader>
          <CardTitle>Execution Logs</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {logs.map((log) => (
              <div
                key={log.id}
                className="p-4 rounded-lg border border-border bg-secondary hover:bg-muted transition-colors cursor-pointer"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3 flex-1">
                    {getStatusIcon(log.status)}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="font-mono text-xs text-muted-foreground">{log.timestamp}</span>
                        {getLevelBadge(log.level)}
                        <Badge variant="outline" className="font-mono text-xs">
                          {log.executionId}
                        </Badge>
                      </div>
                      <div className="text-sm mb-1">{log.message}</div>
                      <div className="text-xs text-muted-foreground">
                        Workflow: {log.workflowId} • Duration: {log.duration}
                      </div>
                    </div>
                  </div>
                  <Button variant="ghost" size="sm">
                    View Trace
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Total Executions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">1,247</div>
            <div className="text-xs text-muted-foreground mt-1">Last 24 hours</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Success Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold text-green-500">99.2%</div>
            <div className="text-xs text-muted-foreground mt-1">1,237 successful</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Errors</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold text-red-500">8</div>
            <div className="text-xs text-muted-foreground mt-1">0.6% error rate</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Avg Duration</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">847ms</div>
            <div className="text-xs text-muted-foreground mt-1">-12% vs yesterday</div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
