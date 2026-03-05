import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Copy, ExternalLink } from "lucide-react";
import { toast } from "sonner";

const endpoints = [
  { method: "POST", path: "/api/v1/workflows/execute", description: "Execute a workflow" },
  { method: "GET", path: "/api/v1/workflows/{id}", description: "Get workflow details" },
  { method: "GET", path: "/api/v1/executions/{id}", description: "Get execution status" },
  { method: "POST", path: "/api/v1/workflows/{id}/test", description: "Test a workflow" },
];

const curlExample = `curl -X POST https://api.acme-corp.io/v1/workflows/execute \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "workflow_id": "wf_customer_support",
    "input": {
      "message": "I need help with my order",
      "customer_id": "cust_12345"
    }
  }'`;

const responseExample = `{
  "execution_id": "exec_a8b9c0d1",
  "status": "completed",
  "duration_ms": 847,
  "output": {
    "action": "route_to_agent",
    "agent_id": "agent_sarah",
    "priority": "medium"
  },
  "tokens_used": 1247,
  "cost": 0.0124
}`;

const jsExample = `import { AcmeAI } from '@acme/ai-sdk';

const client = new AcmeAI({
  apiKey: process.env.ACME_API_KEY
});

const result = await client.workflows.execute({
  workflowId: 'wf_customer_support',
  input: {
    message: 'I need help with my order',
    customer_id: 'cust_12345'
  }
});

console.log(result);`;

const pythonExample = `from acme_ai import AcmeAI

client = AcmeAI(api_key=os.environ['ACME_API_KEY'])

result = client.workflows.execute(
    workflow_id='wf_customer_support',
    input={
        'message': 'I need help with my order',
        'customer_id': 'cust_12345'
    }
)

print(result)`;

const embedCode = `<script src="https://cdn.acme-corp.io/ai-widget.js"></script>
<script>
  AcmeAI.init({
    apiKey: 'YOUR_PUBLIC_KEY',
    workflowId: 'wf_customer_support',
    containerId: 'ai-widget'
  });
</script>
<div id="ai-widget"></div>`;

export function APIEmbed() {
  const handleCopy = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success("Copied to clipboard!");
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">API & Embed</h1>
          <p className="text-sm text-muted-foreground mt-1">
            API endpoints, code examples, and embeddable widgets
          </p>
        </div>
        <Button>
          <ExternalLink className="size-4 mr-2" />
          View Full Docs
        </Button>
      </div>

      <Tabs defaultValue="endpoints" className="space-y-4">
        <TabsList>
          <TabsTrigger value="endpoints">Endpoints</TabsTrigger>
          <TabsTrigger value="examples">Code Examples</TabsTrigger>
          <TabsTrigger value="embed">Embed Widget</TabsTrigger>
        </TabsList>

        <TabsContent value="endpoints" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>REST API Endpoints</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {endpoints.map((endpoint, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-3 rounded-lg border border-border bg-secondary"
                  >
                    <div className="flex items-center gap-3">
                      <Badge
                        variant={endpoint.method === "POST" ? "default" : "outline"}
                        className="font-mono"
                      >
                        {endpoint.method}
                      </Badge>
                      <div>
                        <div className="font-mono text-sm">{endpoint.path}</div>
                        <div className="text-xs text-muted-foreground mt-1">{endpoint.description}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Request Example (cURL)</CardTitle>
                  <Button variant="ghost" size="sm" onClick={() => handleCopy(curlExample)}>
                    <Copy className="size-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="bg-[#0B1220] rounded-lg p-4 font-mono text-xs text-foreground overflow-x-auto">
                  <pre>{curlExample}</pre>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Response Example</CardTitle>
                  <Button variant="ghost" size="sm" onClick={() => handleCopy(responseExample)}>
                    <Copy className="size-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="bg-[#0B1220] rounded-lg p-4 font-mono text-xs text-foreground overflow-x-auto">
                  <pre>{responseExample}</pre>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="examples" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">JavaScript / TypeScript</CardTitle>
                  <Button variant="ghost" size="sm" onClick={() => handleCopy(jsExample)}>
                    <Copy className="size-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="bg-[#0B1220] rounded-lg p-4 font-mono text-xs text-foreground overflow-x-auto">
                  <pre>{jsExample}</pre>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Python</CardTitle>
                  <Button variant="ghost" size="sm" onClick={() => handleCopy(pythonExample)}>
                    <Copy className="size-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="bg-[#0B1220] rounded-lg p-4 font-mono text-xs text-foreground overflow-x-auto">
                  <pre>{pythonExample}</pre>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>SDK Installation</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="text-sm font-medium mb-2">Node.js / JavaScript</div>
                <div className="bg-[#0B1220] rounded-lg p-3 font-mono text-xs text-foreground">
                  npm install @acme/ai-sdk
                </div>
              </div>
              <div>
                <div className="text-sm font-medium mb-2">Python</div>
                <div className="bg-[#0B1220] rounded-lg p-3 font-mono text-xs text-foreground">
                  pip install acme-ai
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="embed" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Embeddable Widget Code</CardTitle>
                <Button variant="ghost" size="sm" onClick={() => handleCopy(embedCode)}>
                  <Copy className="size-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="bg-[#0B1220] rounded-lg p-4 font-mono text-xs text-foreground overflow-x-auto">
                <pre>{embedCode}</pre>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Widget Preview</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="border-2 border-dashed border-border rounded-lg p-8 bg-secondary">
                <div className="max-w-sm mx-auto bg-card border border-border rounded-lg shadow-lg p-4">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold">AI Assistant</h3>
                    <Badge variant="outline" className="text-xs">Powered by Acme AI</Badge>
                  </div>
                  <div className="space-y-2 mb-4">
                    <div className="bg-secondary rounded-lg p-3 text-sm">
                      Hi! How can I help you today?
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <input
                      placeholder="Type your message..."
                      className="flex-1 px-3 py-2 rounded-lg border border-border bg-background text-sm"
                      disabled
                    />
                    <Button size="sm">Send</Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
