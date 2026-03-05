import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { CheckCircle2, XCircle, AlertTriangle, Activity, TrendingUp, TrendingDown } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

const services = [
  {
    name: "API Gateway",
    status: "healthy",
    uptime: "99.99%",
    latency: "12ms",
    requests: "1.2M/hr",
    lastIncident: "None",
  },
  {
    name: "Workflow Engine",
    status: "healthy",
    uptime: "99.97%",
    latency: "34ms",
    requests: "850K/hr",
    lastIncident: "3 days ago",
  },
  {
    name: "Vector DB (Qdrant)",
    status: "healthy",
    uptime: "100%",
    latency: "8ms",
    requests: "450K/hr",
    lastIncident: "None",
  },
  {
    name: "LLM Router",
    status: "degraded",
    uptime: "99.85%",
    latency: "156ms",
    requests: "920K/hr",
    lastIncident: "2 hours ago",
  },
  {
    name: "Authentication Service",
    status: "healthy",
    uptime: "99.98%",
    latency: "18ms",
    requests: "320K/hr",
    lastIncident: "1 week ago",
  },
  {
    name: "Storage Service",
    status: "healthy",
    uptime: "99.95%",
    latency: "42ms",
    requests: "180K/hr",
    lastIncident: "None",
  },
];

const latencyData = [
  { time: "00:00", api: 12, workflow: 34, qdrant: 8, llm: 145 },
  { time: "04:00", api: 11, workflow: 32, qdrant: 7, llm: 142 },
  { time: "08:00", api: 15, workflow: 38, qdrant: 9, llm: 168 },
  { time: "12:00", api: 14, workflow: 36, qdrant: 8, llm: 156 },
  { time: "16:00", api: 13, workflow: 35, qdrant: 8, llm: 152 },
  { time: "20:00", api: 12, workflow: 33, qdrant: 7, llm: 148 },
];

const incidents = [
  {
    id: "inc-1",
    service: "LLM Router",
    severity: "medium",
    status: "investigating",
    description: "Increased latency on OpenAI API calls",
    startedAt: "2 hours ago",
    impact: "Some requests experiencing delays",
  },
  {
    id: "inc-2",
    service: "Workflow Engine",
    severity: "low",
    status: "resolved",
    description: "Minor memory spike during peak hours",
    startedAt: "3 days ago",
    resolvedAt: "3 days ago",
    impact: "No user impact",
  },
];

const metrics = [
  { label: "Overall Uptime", value: "99.94%", trend: "up", change: "+0.02%" },
  { label: "Avg Response Time", value: "42ms", trend: "down", change: "-8ms" },
  { label: "Error Rate", value: "0.06%", trend: "down", change: "-0.01%" },
  { label: "Active Incidents", value: "1", trend: "up", change: "+1" },
];

const getStatusIcon = (status: string) => {
  switch (status) {
    case "healthy":
      return <CheckCircle2 className="size-5 text-green-500" />;
    case "degraded":
      return <AlertTriangle className="size-5 text-yellow-500" />;
    case "down":
      return <XCircle className="size-5 text-red-500" />;
    default:
      return <Activity className="size-5 text-gray-500" />;
  }
};

export function Health() {
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">System Health</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Service monitoring, latency trends, and incident management
          </p>
        </div>
        <Badge className="bg-green-500 text-base py-2 px-4">
          All Systems Operational
        </Badge>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {metrics.map((metric) => (
          <Card key={metric.label}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">{metric.label}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold">{metric.value}</div>
              <div className="flex items-center gap-1 mt-1">
                {metric.trend === "up" ? (
                  <TrendingUp className="size-4 text-green-500" />
                ) : (
                  <TrendingDown className="size-4 text-green-500" />
                )}
                <span className="text-sm text-green-500">{metric.change}</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Service Status */}
      <Card>
        <CardHeader>
          <CardTitle>Service Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {services.map((service) => (
              <div
                key={service.name}
                className="flex items-center justify-between p-4 rounded-lg border border-border bg-secondary"
              >
                <div className="flex items-center gap-3">
                  {getStatusIcon(service.status)}
                  <div>
                    <div className="font-medium text-sm">{service.name}</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Latency: {service.latency} • {service.requests} • Last incident: {service.lastIncident}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <div className="text-xs text-muted-foreground">Uptime</div>
                    <div className="text-sm font-semibold">{service.uptime}</div>
                  </div>
                  <Badge
                    variant={
                      service.status === "healthy"
                        ? "default"
                        : service.status === "degraded"
                        ? "secondary"
                        : "destructive"
                    }
                  >
                    {service.status}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Latency Trends */}
      <Card>
        <CardHeader>
          <CardTitle>Latency Trends (24h)</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={latencyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1F2937" />
              <XAxis dataKey="time" stroke="#9CA3AF" fontSize={12} />
              <YAxis stroke="#9CA3AF" fontSize={12} tickFormatter={(value) => `${value}ms`} />
              <Tooltip
                contentStyle={{ backgroundColor: "#1F2937", border: "1px solid #374151", borderRadius: "8px" }}
                labelStyle={{ color: "#E5E7EB" }}
              />
              <Line type="monotone" dataKey="api" stroke="#2563EB" strokeWidth={2} name="API Gateway" />
              <Line type="monotone" dataKey="workflow" stroke="#10B981" strokeWidth={2} name="Workflow Engine" />
              <Line type="monotone" dataKey="qdrant" stroke="#8B5CF6" strokeWidth={2} name="Vector DB" />
              <Line type="monotone" dataKey="llm" stroke="#F59E0B" strokeWidth={2} name="LLM Router" />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Active Incidents */}
      <Card>
        <CardHeader>
          <CardTitle>Active & Recent Incidents</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {incidents.map((incident) => (
              <div key={incident.id} className="p-4 rounded-lg border border-border bg-secondary">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-start gap-3">
                    {incident.severity === "high" ? (
                      <XCircle className="size-5 text-red-500 flex-shrink-0" />
                    ) : incident.severity === "medium" ? (
                      <AlertTriangle className="size-5 text-yellow-500 flex-shrink-0" />
                    ) : (
                      <Activity className="size-5 text-blue-500 flex-shrink-0" />
                    )}
                    <div>
                      <div className="font-medium text-sm">{incident.service}</div>
                      <div className="text-sm text-foreground mt-1">{incident.description}</div>
                      <div className="text-xs text-muted-foreground mt-2">
                        {incident.impact} • Started {incident.startedAt}
                        {incident.resolvedAt && ` • Resolved ${incident.resolvedAt}`}
                      </div>
                    </div>
                  </div>
                  <Badge
                    variant={incident.status === "resolved" ? "default" : "destructive"}
                    className="flex-shrink-0"
                  >
                    {incident.status}
                  </Badge>
                </div>
                {incident.status === "investigating" && (
                  <Button variant="outline" size="sm" className="mt-2">
                    View Updates
                  </Button>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
