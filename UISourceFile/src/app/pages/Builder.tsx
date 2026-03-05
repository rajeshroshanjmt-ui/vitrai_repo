import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Badge } from "../components/ui/badge";
import { Save, Play, Download, Upload } from "lucide-react";
import { ReactFlow, Background, Controls, MiniMap, useNodesState, useEdgesState, addEdge } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useCallback } from "react";

const initialNodes = [
  {
    id: "1",
    type: "input",
    data: { label: "Start" },
    position: { x: 250, y: 25 },
  },
  {
    id: "2",
    data: { label: "LLM Call: GPT-4" },
    position: { x: 250, y: 125 },
  },
  {
    id: "3",
    data: { label: "Conditional Branch" },
    position: { x: 250, y: 225 },
  },
  {
    id: "4",
    data: { label: "Action: Send Email" },
    position: { x: 100, y: 325 },
  },
  {
    id: "5",
    data: { label: "Action: Log Event" },
    position: { x: 400, y: 325 },
  },
];

const initialEdges = [
  { id: "e1-2", source: "1", target: "2", animated: true },
  { id: "e2-3", source: "2", target: "3" },
  { id: "e3-4", source: "3", target: "4", label: "true" },
  { id: "e3-5", source: "3", target: "5", label: "false" },
];

const nodeLibrary = [
  { category: "Core", items: ["Input", "Output", "LLM Call", "Prompt Template"] },
  { category: "Control", items: ["Conditional", "Loop", "Parallel", "Merge"] },
  { category: "Governance", items: ["Human Review", "Risk Check", "Audit Log"] },
  { category: "Integration", items: ["API Call", "Database Query", "File Upload", "Webhook"] },
];

export function Builder() {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  const onConnect = useCallback(
    (params: any) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  return (
    <div className="h-[calc(100vh-3.5rem)] flex">
      {/* Node Library */}
      <aside className="w-64 border-r border-border bg-card overflow-y-auto">
        <div className="p-4 border-b border-border">
          <h2 className="font-semibold">Node Library</h2>
        </div>
        <div className="p-4 space-y-4">
          {nodeLibrary.map((category) => (
            <div key={category.category}>
              <h3 className="text-xs font-medium text-muted-foreground mb-2">{category.category}</h3>
              <div className="space-y-1">
                {category.items.map((item) => (
                  <button
                    key={item}
                    className="w-full text-left px-3 py-2 rounded-lg border border-border bg-secondary hover:bg-muted transition-colors text-sm"
                    draggable
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </aside>

      {/* Canvas */}
      <div className="flex-1 flex flex-col">
        {/* Toolbar */}
        <div className="h-14 border-b border-border bg-card flex items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <Input placeholder="Workflow Name" className="w-64" defaultValue="Customer Support Flow" />
            <Badge>Draft</Badge>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm">
              <Upload className="size-4 mr-2" />
              Import
            </Button>
            <Button variant="outline" size="sm">
              <Download className="size-4 mr-2" />
              Export
            </Button>
            <Button variant="outline" size="sm">
              <Play className="size-4 mr-2" />
              Test Run
            </Button>
            <Button size="sm">
              <Save className="size-4 mr-2" />
              Save
            </Button>
          </div>
        </div>

        {/* Flow Canvas */}
        <div className="flex-1">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            fitView
            className="bg-[#0B1220]"
          >
            <Background color="#1F2937" />
            <Controls />
            <MiniMap
              nodeColor="#2563EB"
              maskColor="rgba(0, 0, 0, 0.6)"
              className="bg-card border border-border"
            />
          </ReactFlow>
        </div>
      </div>

      {/* Configuration Panel */}
      <aside className="w-80 border-l border-border bg-card overflow-y-auto">
        <div className="p-4 border-b border-border">
          <h2 className="font-semibold">Node Configuration</h2>
        </div>
        <div className="p-4">
          <Tabs defaultValue="settings">
            <TabsList className="w-full">
              <TabsTrigger value="settings" className="flex-1">Settings</TabsTrigger>
              <TabsTrigger value="code" className="flex-1">Code</TabsTrigger>
            </TabsList>
            <TabsContent value="settings" className="space-y-4 mt-4">
              <div>
                <Label>Node Type</Label>
                <Select defaultValue="llm">
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="llm">LLM Call</SelectItem>
                    <SelectItem value="conditional">Conditional</SelectItem>
                    <SelectItem value="action">Action</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Model</Label>
                <Select defaultValue="gpt4">
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gpt4">GPT-4</SelectItem>
                    <SelectItem value="gpt35">GPT-3.5</SelectItem>
                    <SelectItem value="claude">Claude 3</SelectItem>
                    <SelectItem value="gemini">Gemini Pro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Prompt</Label>
                <Input placeholder="Enter prompt template..." className="font-mono text-xs" />
              </div>
              <div>
                <Label>Temperature</Label>
                <Input type="number" defaultValue="0.7" step="0.1" min="0" max="2" />
              </div>
              <div>
                <Label>Max Tokens</Label>
                <Input type="number" defaultValue="1000" />
              </div>
            </TabsContent>
            <TabsContent value="code" className="mt-4">
              <div className="bg-[#0B1220] rounded-lg p-4 font-mono text-xs text-foreground overflow-x-auto">
                <pre>{`{
  "type": "llm_call",
  "model": "gpt-4",
  "prompt": "{{input}}",
  "temperature": 0.7,
  "max_tokens": 1000
}`}</pre>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </aside>
    </div>
  );
}
