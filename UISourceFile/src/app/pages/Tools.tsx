import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Badge } from "../components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Plus, CheckCircle2, AlertCircle } from "lucide-react";

const llmTools = [
  { id: "llm-1", name: "OpenAI GPT-4", type: "LLM", status: "connected", requests: 245123 },
  { id: "llm-2", name: "Anthropic Claude", type: "LLM", status: "connected", requests: 89234 },
  { id: "llm-3", name: "Google Gemini", type: "LLM", status: "connected", requests: 45678 },
  { id: "llm-4", name: "OpenAI GPT-3.5", type: "LLM", status: "connected", requests: 567890 },
];

const databases = [
  { id: "db-1", name: "PostgreSQL Production", type: "Database", status: "connected", host: "prod-db.acme.io" },
  { id: "db-2", name: "MongoDB Analytics", type: "Database", status: "connected", host: "analytics-mongo.acme.io" },
  { id: "db-3", name: "Redis Cache", type: "Database", status: "connected", host: "cache.acme.io" },
];

const apis = [
  { id: "api-1", name: "Stripe Payment API", type: "API", status: "connected", endpoint: "https://api.stripe.com" },
  { id: "api-2", name: "SendGrid Email", type: "API", status: "connected", endpoint: "https://api.sendgrid.com" },
  { id: "api-3", name: "Twilio SMS", type: "API", status: "error", endpoint: "https://api.twilio.com" },
  { id: "api-4", name: "Slack Webhook", type: "API", status: "connected", endpoint: "https://hooks.slack.com" },
];

const fileProcessors = [
  { id: "fp-1", name: "PDF Extractor", type: "File Processor", status: "connected", formats: "PDF" },
  { id: "fp-2", name: "Image OCR", type: "File Processor", status: "connected", formats: "PNG, JPG" },
  { id: "fp-3", name: "CSV Parser", type: "File Processor", status: "connected", formats: "CSV, TSV" },
];

export function Tools() {
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Tools</h1>
          <p className="text-sm text-muted-foreground mt-1">
            External integrations for LLMs, databases, APIs, and file processors
          </p>
        </div>
        <Button>
          <Plus className="size-4 mr-2" />
          Add Tool
        </Button>
      </div>

      <Tabs defaultValue="llms" className="space-y-4">
        <TabsList>
          <TabsTrigger value="llms">LLMs ({llmTools.length})</TabsTrigger>
          <TabsTrigger value="databases">Databases ({databases.length})</TabsTrigger>
          <TabsTrigger value="apis">APIs ({apis.length})</TabsTrigger>
          <TabsTrigger value="files">File Processors ({fileProcessors.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="llms" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {llmTools.map((tool) => (
              <Card key={tool.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-base">{tool.name}</CardTitle>
                      <p className="text-xs text-muted-foreground mt-1">{tool.type}</p>
                    </div>
                    <Badge className="bg-green-500 flex items-center gap-1">
                      <CheckCircle2 className="size-3" />
                      {tool.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Total Requests</span>
                      <span className="font-semibold">{tool.requests.toLocaleString()}</span>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" className="flex-1">
                        Configure
                      </Button>
                      <Button variant="ghost" size="sm" className="flex-1">
                        Test
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="databases" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Database Connections</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {databases.map((db) => (
                  <div
                    key={db.id}
                    className="flex items-center justify-between p-3 rounded-lg border border-border bg-secondary"
                  >
                    <div>
                      <div className="font-medium text-sm">{db.name}</div>
                      <div className="text-xs text-muted-foreground mt-1 font-mono">{db.host}</div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge className="bg-green-500 flex items-center gap-1">
                        <CheckCircle2 className="size-3" />
                        {db.status}
                      </Badge>
                      <Button variant="outline" size="sm">
                        Manage
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="apis" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>API Integrations</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {apis.map((api) => (
                  <div
                    key={api.id}
                    className="flex items-center justify-between p-3 rounded-lg border border-border bg-secondary"
                  >
                    <div>
                      <div className="font-medium text-sm">{api.name}</div>
                      <div className="text-xs text-muted-foreground mt-1 font-mono">{api.endpoint}</div>
                    </div>
                    <div className="flex items-center gap-3">
                      {api.status === "connected" ? (
                        <Badge className="bg-green-500 flex items-center gap-1">
                          <CheckCircle2 className="size-3" />
                          {api.status}
                        </Badge>
                      ) : (
                        <Badge variant="destructive" className="flex items-center gap-1">
                          <AlertCircle className="size-3" />
                          {api.status}
                        </Badge>
                      )}
                      <Button variant="outline" size="sm">
                        Configure
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="files" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>File Processors</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {fileProcessors.map((processor) => (
                  <div
                    key={processor.id}
                    className="flex items-center justify-between p-3 rounded-lg border border-border bg-secondary"
                  >
                    <div>
                      <div className="font-medium text-sm">{processor.name}</div>
                      <div className="text-xs text-muted-foreground mt-1">Supports: {processor.formats}</div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge className="bg-green-500 flex items-center gap-1">
                        <CheckCircle2 className="size-3" />
                        {processor.status}
                      </Badge>
                      <Button variant="outline" size="sm">
                        Settings
                      </Button>
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
