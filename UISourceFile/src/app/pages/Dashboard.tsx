import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { ArrowUp, ArrowDown, Activity, Zap, Clock, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";
import { LineChart, Line, AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

const kpiData = [
  { label: "Total Executions", value: "1,247,893", change: "+12.5%", trend: "up" },
  { label: "Tokens Consumed", value: "4.2B", change: "+8.3%", trend: "up" },
  { label: "Avg Response Time", value: "247ms", change: "-15.2%", trend: "down" },
  { label: "Success Rate", value: "99.4%", change: "+0.2%", trend: "up" },
];

const executionData = [
  { time: "00:00", executions: 1200 },
  { time: "04:00", executions: 800 },
  { time: "08:00", executions: 2400 },
  { time: "12:00", executions: 3200 },
  { time: "16:00", executions: 2800 },
  { time: "20:00", executions: 1600 },
];

const tokenData = [
  { date: "Feb 13", tokens: 320000000 },
  { date: "Feb 14", tokens: 380000000 },
  { date: "Feb 15", tokens: 420000000 },
  { date: "Feb 16", tokens: 390000000 },
  { date: "Feb 17", tokens: 450000000 },
  { date: "Feb 18", tokens: 480000000 },
  { date: "Feb 19", tokens: 420000000 },
];

const modelUsage = [
  { model: "GPT-4", requests: 45000 },
  { model: "GPT-3.5", requests: 120000 },
  { model: "Claude", requests: 38000 },
  { model: "Gemini", requests: 22000 },
];

const systemHealth = [
  { service: "API Gateway", status: "healthy", latency: "12ms", uptime: "99.99%" },
  { service: "Workflow Engine", status: "healthy", latency: "34ms", uptime: "99.97%" },
  { service: "Vector DB (Qdrant)", status: "healthy", latency: "8ms", uptime: "100%" },
  { service: "LLM Router", status: "degraded", latency: "156ms", uptime: "99.85%" },
];

export function Dashboard() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">Real-time platform metrics and system health</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpiData.map((kpi) => (
          <Card key={kpi.label}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{kpi.label}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold">{kpi.value}</div>
              <div className="flex items-center gap-1 mt-1">
                {kpi.trend === "up" ? (
                  <ArrowUp className="size-4 text-green-500" />
                ) : (
                  <ArrowDown className="size-4 text-green-500" />
                )}
                <span className="text-sm text-green-500">{kpi.change}</span>
                <span className="text-xs text-muted-foreground">vs last week</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Execution Trend */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="size-5" />
              Workflow Executions (24h)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={executionData}>
                <defs>
                  <linearGradient id="colorExecutions" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2563EB" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#2563EB" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1F2937" />
                <XAxis dataKey="time" stroke="#9CA3AF" fontSize={12} />
                <YAxis stroke="#9CA3AF" fontSize={12} />
                <Tooltip
                  contentStyle={{ backgroundColor: "#1F2937", border: "1px solid #374151", borderRadius: "8px" }}
                  labelStyle={{ color: "#E5E7EB" }}
                />
                <Area type="monotone" dataKey="executions" stroke="#2563EB" fillOpacity={1} fill="url(#colorExecutions)" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Token Usage */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="size-5" />
              Token Consumption (7d)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={tokenData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1F2937" />
                <XAxis dataKey="date" stroke="#9CA3AF" fontSize={12} />
                <YAxis stroke="#9CA3AF" fontSize={12} tickFormatter={(value) => `${(value / 1000000).toFixed(0)}M`} />
                <Tooltip
                  contentStyle={{ backgroundColor: "#1F2937", border: "1px solid #374151", borderRadius: "8px" }}
                  labelStyle={{ color: "#E5E7EB" }}
                  formatter={(value: number) => [`${(value / 1000000).toFixed(1)}M`, "Tokens"]}
                />
                <Line type="monotone" dataKey="tokens" stroke="#10B981" strokeWidth={2} dot={{ fill: "#10B981" }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Model Usage */}
        <Card>
          <CardHeader>
            <CardTitle>Model Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={modelUsage}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1F2937" />
                <XAxis dataKey="model" stroke="#9CA3AF" fontSize={12} />
                <YAxis stroke="#9CA3AF" fontSize={12} />
                <Tooltip
                  contentStyle={{ backgroundColor: "#1F2937", border: "1px solid #374151", borderRadius: "8px" }}
                  labelStyle={{ color: "#E5E7EB" }}
                />
                <Bar dataKey="requests" fill="#2563EB" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* System Health */}
        <Card>
          <CardHeader>
            <CardTitle>System Health</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {systemHealth.map((service) => (
                <div key={service.service} className="flex items-center justify-between p-3 rounded-lg bg-secondary">
                  <div className="flex items-center gap-3">
                    {service.status === "healthy" ? (
                      <CheckCircle2 className="size-5 text-green-500" />
                    ) : service.status === "degraded" ? (
                      <AlertTriangle className="size-5 text-yellow-500" />
                    ) : (
                      <XCircle className="size-5 text-red-500" />
                    )}
                    <div>
                      <div className="font-medium text-sm">{service.service}</div>
                      <div className="text-xs text-muted-foreground flex items-center gap-3 mt-1">
                        <span className="flex items-center gap-1">
                          <Clock className="size-3" />
                          {service.latency}
                        </span>
                        <span>Uptime: {service.uptime}</span>
                      </div>
                    </div>
                  </div>
                  <Badge variant={service.status === "healthy" ? "default" : "destructive"}>
                    {service.status}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
