import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Textarea } from "../components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Badge } from "../components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Play, RotateCw, Download } from "lucide-react";
import { useState } from "react";

const executionTrace = [
  { step: 1, node: "Input", status: "success", duration: "2ms", output: "Customer message received" },
  { step: 2, node: "LLM Call: GPT-4", status: "success", duration: "847ms", output: "Sentiment: -0.72 (negative)" },
  { step: 3, node: "Conditional Branch", status: "success", duration: "1ms", output: "Routed to high priority" },
  { step: 4, node: "Action: Alert Agent", status: "success", duration: "124ms", output: "Alert sent to agent @sarah" },
];

const debugLogs = `[2026-02-19 14:23:41.123] INFO: Workflow execution started
[2026-02-19 14:23:41.125] DEBUG: Input node received payload
[2026-02-19 14:23:41.127] INFO: Calling LLM with model=gpt-4
[2026-02-19 14:23:41.974] DEBUG: LLM response: sentiment=-0.72
[2026-02-19 14:23:41.975] INFO: Conditional check: sentiment < -0.5 = true
[2026-02-19 14:23:41.976] INFO: Executing action: alert_agent
[2026-02-19 14:23:42.100] INFO: Agent notification sent successfully
[2026-02-19 14:23:42.101] INFO: Workflow completed in 978ms`;

export function Playground() {
  const [workflow, setWorkflow] = useState("customer-support");
  const [running, setRunning] = useState(false);
  const [executed, setExecuted] = useState(false);

  const handleRun = () => {
    setRunning(true);
    setTimeout(() => {
      setRunning(false);
      setExecuted(true);
    }, 1500);
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Playground</h1>
        <p className="text-sm text-muted-foreground mt-1">Test workflows with live data and debug execution</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Input Panel */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Test Configuration</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Select Workflow</label>
                <Select value={workflow} onValueChange={setWorkflow}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="customer-support">Customer Support Flow</SelectItem>
                    <SelectItem value="document-processing">Document Processing</SelectItem>
                    <SelectItem value="fraud-detection">Fraud Detection</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Input Payload</label>
                <Textarea
                  placeholder='{"message": "I am very unhappy with the service..."}'
                  className="min-h-32 bg-[#0B1220] border-border font-mono text-sm"
                  defaultValue={`{
  "message": "I am very unhappy with the service. My order arrived broken and customer support has been ignoring me for days.",
  "customer_id": "cust_12345",
  "order_id": "ord_98765"
}`}
                />
              </div>

              <Button onClick={handleRun} disabled={running} className="w-full">
                {running ? (
                  <>
                    <RotateCw className="size-4 mr-2 animate-spin" />
                    Running...
                  </>
                ) : (
                  <>
                    <Play className="size-4 mr-2" />
                    Run Workflow
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {executed && (
            <Card>
              <CardHeader>
                <CardTitle>Execution Result</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Status</span>
                    <Badge className="bg-green-500">Success</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Duration</span>
                    <span className="text-sm font-mono">978ms</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Tokens Used</span>
                    <span className="text-sm font-mono">1,247</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Cost</span>
                    <span className="text-sm font-mono">$0.0124</span>
                  </div>
                </div>
                <div className="mt-4">
                  <label className="text-sm font-medium mb-2 block">Output</label>
                  <div className="bg-[#0B1220] rounded-lg p-3 font-mono text-xs text-foreground">
                    {`{
  "action": "alert_agent",
  "agent": "@sarah",
  "priority": "high",
  "sentiment": -0.72
}`}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Debug Panel */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Execution Trace</CardTitle>
            </CardHeader>
            <CardContent>
              {executed ? (
                <div className="space-y-2">
                  {executionTrace.map((trace) => (
                    <div key={trace.step} className="p-3 rounded-lg bg-[#0B1220] border border-border">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">Step {trace.step}</Badge>
                          <span className="text-sm font-medium">{trace.node}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge className="bg-green-500 text-xs">{trace.status}</Badge>
                          <span className="text-xs text-muted-foreground font-mono">{trace.duration}</span>
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground font-mono">{trace.output}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  Run a workflow to see execution trace
                </div>
              )}
            </CardContent>
          </Card>

          {executed && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Debug Logs</span>
                  <Button variant="ghost" size="sm">
                    <Download className="size-4" />
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="bg-[#0B1220] rounded-lg p-4 font-mono text-xs text-foreground overflow-x-auto max-h-64 overflow-y-auto">
                  <pre>{debugLogs}</pre>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
