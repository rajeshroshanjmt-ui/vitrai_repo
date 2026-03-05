import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Textarea } from "../components/ui/textarea";
import { Badge } from "../components/ui/badge";
import { Sparkles, Send, Loader2 } from "lucide-react";
import { useState } from "react";

const examplePrompts = [
  "Create a customer support workflow that routes tickets based on sentiment analysis",
  "Build a document processing pipeline that extracts structured data from PDFs",
  "Design a fraud detection system using multiple LLM calls and validation steps",
  "Generate a multi-step research workflow that summarizes and synthesizes information",
];

const generatedWorkflow = {
  nodes: [
    { id: "input", type: "Input", label: "Receive Customer Ticket" },
    { id: "sentiment", type: "LLM Call", label: "Analyze Sentiment", model: "GPT-4" },
    { id: "router", type: "Conditional", label: "Route by Priority" },
    { id: "high", type: "Action", label: "Alert Human Agent" },
    { id: "low", type: "LLM Call", label: "Generate Auto-Response" },
    { id: "output", type: "Output", label: "Send Response" },
  ],
  edges: [
    { from: "input", to: "sentiment" },
    { from: "sentiment", to: "router" },
    { from: "router", to: "high", condition: "sentiment < -0.5" },
    { from: "router", to: "low", condition: "sentiment >= -0.5" },
    { from: "high", to: "output" },
    { from: "low", to: "output" },
  ],
};

export function AIAssistant() {
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [generated, setGenerated] = useState(false);

  const handleGenerate = () => {
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setGenerated(true);
    }, 2000);
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground flex items-center gap-2">
          <Sparkles className="size-6 text-primary" />
          AI Assistant
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Describe your workflow in natural language and AI will generate it for you
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Input Section */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Describe Your Workflow</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                placeholder="E.g., Create a workflow that processes incoming support tickets, analyzes sentiment, and routes high-priority issues to human agents while auto-responding to simple queries..."
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                className="min-h-32 bg-input-background border-border font-mono text-sm"
              />
              <Button onClick={handleGenerate} disabled={!prompt || loading} className="w-full">
                {loading ? (
                  <>
                    <Loader2 className="size-4 mr-2 animate-spin" />
                    Generating Workflow...
                  </>
                ) : (
                  <>
                    <Send className="size-4 mr-2" />
                    Generate Workflow
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Generated Workflow Preview */}
          {generated && (
            <Card>
              <CardHeader>
                <CardTitle>Generated Workflow</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {generatedWorkflow.nodes.map((node, idx) => (
                    <div key={node.id} className="flex items-start gap-3">
                      <div className="size-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-semibold flex-shrink-0">
                        {idx + 1}
                      </div>
                      <div className="flex-1 p-3 rounded-lg border border-border bg-secondary">
                        <div className="flex items-center justify-between">
                          <div>
                            <Badge variant="outline" className="mb-2 text-xs">
                              {node.type}
                            </Badge>
                            <div className="font-medium text-sm">{node.label}</div>
                            {node.model && (
                              <div className="text-xs text-muted-foreground mt-1">Model: {node.model}</div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2 mt-6">
                  <Button className="flex-1">
                    Open in Builder
                  </Button>
                  <Button variant="outline" className="flex-1">
                    Edit Workflow
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Example Prompts */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Example Prompts</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {examplePrompts.map((example, idx) => (
                  <button
                    key={idx}
                    onClick={() => setPrompt(example)}
                    className="w-full text-left p-3 rounded-lg border border-border bg-secondary hover:bg-muted transition-colors text-sm"
                  >
                    {example}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Tips</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2">
              <p>• Be specific about your workflow steps</p>
              <p>• Mention any conditional logic or branching</p>
              <p>• Specify which LLM models to use if needed</p>
              <p>• Include error handling requirements</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
