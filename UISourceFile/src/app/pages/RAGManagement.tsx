import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Badge } from "../components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Plus, Database, Upload, FileText, Settings } from "lucide-react";

const collections = [
  {
    id: "col-1",
    name: "Product Documentation",
    vectors: 45234,
    size: "2.3 GB",
    dimensions: 1536,
    model: "text-embedding-ada-002",
    lastUpdated: "2 hours ago",
  },
  {
    id: "col-2",
    name: "Customer Support KB",
    vectors: 18923,
    size: "1.1 GB",
    dimensions: 1536,
    model: "text-embedding-ada-002",
    lastUpdated: "1 day ago",
  },
  {
    id: "col-3",
    name: "Legal Documents",
    vectors: 8745,
    size: "890 MB",
    dimensions: 1536,
    model: "text-embedding-ada-002",
    lastUpdated: "3 days ago",
  },
];

const documents = [
  {
    id: "doc-1",
    name: "API_Documentation_v2.pdf",
    status: "indexed",
    chunks: 234,
    size: "4.2 MB",
    uploadedAt: "2 hours ago",
  },
  {
    id: "doc-2",
    name: "Product_Guide_2024.pdf",
    status: "indexed",
    chunks: 187,
    size: "3.8 MB",
    uploadedAt: "1 day ago",
  },
  {
    id: "doc-3",
    name: "Support_Manual.docx",
    status: "processing",
    chunks: 0,
    size: "2.1 MB",
    uploadedAt: "5 minutes ago",
  },
  {
    id: "doc-4",
    name: "FAQ_Collection.txt",
    status: "indexed",
    chunks: 89,
    size: "450 KB",
    uploadedAt: "3 days ago",
  },
];

export function RAGManagement() {
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">RAG Management</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Vector collections and document management with Qdrant integration
          </p>
        </div>
        <Button>
          <Plus className="size-4 mr-2" />
          New Collection
        </Button>
      </div>

      <Tabs defaultValue="collections" className="space-y-4">
        <TabsList>
          <TabsTrigger value="collections">Collections</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="configuration">Configuration</TabsTrigger>
        </TabsList>

        <TabsContent value="collections" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {collections.map((collection) => (
              <Card key={collection.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <div className="size-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                        <Database className="size-5" />
                      </div>
                      <div>
                        <CardTitle className="text-base">{collection.name}</CardTitle>
                        <p className="text-xs text-muted-foreground mt-1">Updated {collection.lastUpdated}</p>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Vectors</span>
                    <span className="font-semibold">{collection.vectors.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Size</span>
                    <span className="font-semibold">{collection.size}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Dimensions</span>
                    <span className="font-semibold">{collection.dimensions}</span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-2">Model: {collection.model}</div>
                  <div className="flex gap-2 mt-4">
                    <Button variant="outline" size="sm" className="flex-1">
                      <Upload className="size-3 mr-1" />
                      Upload
                    </Button>
                    <Button variant="ghost" size="sm" className="flex-1">
                      <Settings className="size-3 mr-1" />
                      Config
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="documents" className="space-y-4">
          <div className="flex items-center gap-4">
            <Input placeholder="Search documents..." className="max-w-xs" />
            <Button>
              <Upload className="size-4 mr-2" />
              Upload Documents
            </Button>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Document Library</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {documents.map((doc) => (
                  <div
                    key={doc.id}
                    className="flex items-center justify-between p-3 rounded-lg border border-border bg-secondary"
                  >
                    <div className="flex items-center gap-3">
                      <FileText className="size-5 text-muted-foreground" />
                      <div>
                        <div className="font-medium text-sm">{doc.name}</div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {doc.size} • Uploaded {doc.uploadedAt}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {doc.status === "indexed" ? (
                        <>
                          <Badge className="bg-green-500">{doc.status}</Badge>
                          <span className="text-xs text-muted-foreground">{doc.chunks} chunks</span>
                        </>
                      ) : (
                        <Badge variant="secondary">{doc.status}</Badge>
                      )}
                      <Button variant="ghost" size="sm">
                        View
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="configuration">
          <Card>
            <CardHeader>
              <CardTitle>Qdrant Configuration</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Qdrant URL</label>
                <Input defaultValue="https://qdrant.acme-corp.io" className="font-mono" />
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">API Key</label>
                <Input type="password" defaultValue="••••••••••••••••" className="font-mono" />
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Default Embedding Model</label>
                <Input defaultValue="text-embedding-ada-002" className="font-mono" />
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Chunk Size</label>
                <Input type="number" defaultValue="512" />
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Chunk Overlap</label>
                <Input type="number" defaultValue="50" />
              </div>
              <Button>Save Configuration</Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
