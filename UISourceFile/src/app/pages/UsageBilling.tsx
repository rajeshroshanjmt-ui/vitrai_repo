import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { TrendingUp, DollarSign, Zap, Download } from "lucide-react";

const usageData = [
  { date: "Feb 13", tokens: 320000000, cost: 384 },
  { date: "Feb 14", tokens: 380000000, cost: 456 },
  { date: "Feb 15", tokens: 420000000, cost: 504 },
  { date: "Feb 16", tokens: 390000000, cost: 468 },
  { date: "Feb 17", tokens: 450000000, cost: 540 },
  { date: "Feb 18", tokens: 480000000, cost: 576 },
  { date: "Feb 19", tokens: 420000000, cost: 504 },
];

const modelBreakdown = [
  { model: "GPT-4", tokens: 120000000, cost: 240, percentage: 28 },
  { model: "GPT-3.5", tokens: 200000000, cost: 100, percentage: 48 },
  { model: "Claude 3", tokens: 80000000, cost: 120, percentage: 19 },
  { model: "Gemini Pro", tokens: 20000000, cost: 44, percentage: 5 },
];

const workflowCosts = [
  { workflow: "Customer Support", executions: 45234, tokens: 180000000, cost: 216 },
  { workflow: "Fraud Detection", executions: 89123, tokens: 120000000, cost: 180 },
  { workflow: "Document Processing", executions: 12847, tokens: 90000000, cost: 108 },
  { workflow: "Content Moderation", executions: 3421, tokens: 30000000, cost: 60 },
];

export function UsageBilling() {
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Usage & Billing</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Token consumption, cost analytics, and billing information
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select defaultValue="7d">
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Last 7 Days</SelectItem>
              <SelectItem value="30d">Last 30 Days</SelectItem>
              <SelectItem value="90d">Last 90 Days</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline">
            <Download className="size-4 mr-2" />
            Export Report
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
              <DollarSign className="size-4" />
              Total Cost (7d)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">$3,432</div>
            <div className="text-xs text-green-500 mt-1">+12.5% vs last week</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
              <Zap className="size-4" />
              Tokens Used (7d)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">2.86B</div>
            <div className="text-xs text-green-500 mt-1">+8.3% vs last week</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
              <TrendingUp className="size-4" />
              Avg Daily Cost
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">$490</div>
            <div className="text-xs text-muted-foreground mt-1">~$14,700/month</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Current Plan</CardTitle>
          </CardHeader>
          <CardContent>
            <Badge className="bg-primary">Enterprise</Badge>
            <div className="text-xs text-muted-foreground mt-2">Unlimited workflows</div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="models">By Model</TabsTrigger>
          <TabsTrigger value="workflows">By Workflow</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Token Usage Trend</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={usageData}>
                    <defs>
                      <linearGradient id="colorTokens" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#2563EB" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#2563EB" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1F2937" />
                    <XAxis dataKey="date" stroke="#9CA3AF" fontSize={12} />
                    <YAxis stroke="#9CA3AF" fontSize={12} tickFormatter={(value) => `${(value / 1000000).toFixed(0)}M`} />
                    <Tooltip
                      contentStyle={{ backgroundColor: "#1F2937", border: "1px solid #374151", borderRadius: "8px" }}
                      labelStyle={{ color: "#E5E7EB" }}
                      formatter={(value: number) => [`${(value / 1000000).toFixed(1)}M`, "Tokens"]}
                    />
                    <Area type="monotone" dataKey="tokens" stroke="#2563EB" fillOpacity={1} fill="url(#colorTokens)" />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Cost Trend</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={usageData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1F2937" />
                    <XAxis dataKey="date" stroke="#9CA3AF" fontSize={12} />
                    <YAxis stroke="#9CA3AF" fontSize={12} tickFormatter={(value) => `$${value}`} />
                    <Tooltip
                      contentStyle={{ backgroundColor: "#1F2937", border: "1px solid #374151", borderRadius: "8px" }}
                      labelStyle={{ color: "#E5E7EB" }}
                      formatter={(value: number) => [`$${value}`, "Cost"]}
                    />
                    <Bar dataKey="cost" fill="#10B981" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="models">
          <Card>
            <CardHeader>
              <CardTitle>Usage by Model</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {modelBreakdown.map((model) => (
                  <div key={model.model} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium text-sm">{model.model}</div>
                        <div className="text-xs text-muted-foreground">
                          {(model.tokens / 1000000).toFixed(1)}M tokens • ${model.cost}
                        </div>
                      </div>
                      <Badge variant="outline">{model.percentage}%</Badge>
                    </div>
                    <div className="w-full bg-secondary rounded-full h-2">
                      <div
                        className="bg-primary rounded-full h-2 transition-all"
                        style={{ width: `${model.percentage}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="workflows">
          <Card>
            <CardHeader>
              <CardTitle>Cost by Workflow</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {workflowCosts.map((workflow) => (
                  <div
                    key={workflow.workflow}
                    className="p-4 rounded-lg border border-border bg-secondary"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium text-sm">{workflow.workflow}</div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {workflow.executions.toLocaleString()} executions • {(workflow.tokens / 1000000).toFixed(1)}M tokens
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-semibold">${workflow.cost}</div>
                        <div className="text-xs text-muted-foreground">${(workflow.cost / workflow.executions * 1000).toFixed(3)}/1k exec</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
