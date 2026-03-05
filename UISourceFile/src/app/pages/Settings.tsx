import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Switch } from "../components/ui/switch";
import { Badge } from "../components/ui/badge";
import { Plus, Trash2 } from "lucide-react";

const users = [
  { id: "user-1", name: "Admin User", email: "admin@acme.com", role: "SuperAdmin", status: "active" },
  { id: "user-2", name: "Sarah Johnson", email: "sarah@acme.com", role: "OrgAdmin", status: "active" },
  { id: "user-3", name: "Mike Chen", email: "mike@acme.com", role: "User", status: "active" },
  { id: "user-4", name: "Emily Davis", email: "emily@acme.com", role: "User", status: "inactive" },
];

export function Settings() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Tenant configuration, user management, and security policies
        </p>
      </div>

      <Tabs defaultValue="general" className="space-y-4">
        <TabsList>
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="users">Users & Roles</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
          <TabsTrigger value="models">Model Settings</TabsTrigger>
          <TabsTrigger value="integrations">Integrations</TabsTrigger>
        </TabsList>

        {/* General Settings */}
        <TabsContent value="general">
          <Card>
            <CardHeader>
              <CardTitle>Organization Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Organization Name</Label>
                <Input defaultValue="Acme Corporation" />
              </div>
              <div>
                <Label>Tenant ID</Label>
                <Input defaultValue="acme-corp" className="font-mono" disabled />
              </div>
              <div>
                <Label>Default Environment</Label>
                <Select defaultValue="production">
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="production">Production</SelectItem>
                    <SelectItem value="staging">Staging</SelectItem>
                    <SelectItem value="development">Development</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Time Zone</Label>
                <Select defaultValue="utc">
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="utc">UTC</SelectItem>
                    <SelectItem value="est">Eastern Time</SelectItem>
                    <SelectItem value="pst">Pacific Time</SelectItem>
                    <SelectItem value="cst">Central Time</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label>Enable Audit Logging</Label>
                  <p className="text-xs text-muted-foreground mt-1">
                    Log all workflow executions and user actions
                  </p>
                </div>
                <Switch defaultChecked />
              </div>
              <Button>Save Changes</Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Users & Roles */}
        <TabsContent value="users">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Team Members</CardTitle>
                <Button>
                  <Plus className="size-4 mr-2" />
                  Invite User
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {users.map((user) => (
                  <div
                    key={user.id}
                    className="flex items-center justify-between p-3 rounded-lg border border-border bg-secondary"
                  >
                    <div>
                      <div className="font-medium text-sm">{user.name}</div>
                      <div className="text-xs text-muted-foreground mt-1">{user.email}</div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant={user.status === "active" ? "default" : "secondary"}>
                        {user.status}
                      </Badge>
                      <Select defaultValue={user.role}>
                        <SelectTrigger className="w-36">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="SuperAdmin">SuperAdmin</SelectItem>
                          <SelectItem value="OrgAdmin">OrgAdmin</SelectItem>
                          <SelectItem value="User">User</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button variant="ghost" size="sm">
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="mt-4">
            <CardHeader>
              <CardTitle>Role Permissions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="p-4 rounded-lg border border-border bg-secondary">
                  <div className="font-medium text-sm mb-2">SuperAdmin</div>
                  <div className="text-xs text-muted-foreground">
                    Full system access • Manage all workflows • Configure integrations • Manage users
                  </div>
                </div>
                <div className="p-4 rounded-lg border border-border bg-secondary">
                  <div className="font-medium text-sm mb-2">OrgAdmin</div>
                  <div className="text-xs text-muted-foreground">
                    Create workflows • Edit workflows • View all logs • Manage team members
                  </div>
                </div>
                <div className="p-4 rounded-lg border border-border bg-secondary">
                  <div className="font-medium text-sm mb-2">User</div>
                  <div className="text-xs text-muted-foreground">
                    View workflows • Execute workflows • View own logs
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Security */}
        <TabsContent value="security">
          <Card>
            <CardHeader>
              <CardTitle>Security Policies</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Require Two-Factor Authentication</Label>
                  <p className="text-xs text-muted-foreground mt-1">
                    Force all users to enable 2FA
                  </p>
                </div>
                <Switch defaultChecked />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label>Enable IP Whitelisting</Label>
                  <p className="text-xs text-muted-foreground mt-1">
                    Restrict access to specific IP addresses
                  </p>
                </div>
                <Switch />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label>Require Human Review for High-Risk Actions</Label>
                  <p className="text-xs text-muted-foreground mt-1">
                    Route critical decisions to HITL queue
                  </p>
                </div>
                <Switch defaultChecked />
              </div>
              <div>
                <Label>Session Timeout</Label>
                <Select defaultValue="24h">
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1h">1 hour</SelectItem>
                    <SelectItem value="8h">8 hours</SelectItem>
                    <SelectItem value="24h">24 hours</SelectItem>
                    <SelectItem value="7d">7 days</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button>Save Security Settings</Button>
            </CardContent>
          </Card>

          <Card className="mt-4">
            <CardHeader>
              <CardTitle>API Keys</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 mb-4">
                <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-secondary">
                  <div>
                    <div className="font-mono text-sm">ak_prod_••••••••••••6f2a</div>
                    <div className="text-xs text-muted-foreground mt-1">Production • Created 30 days ago</div>
                  </div>
                  <Button variant="ghost" size="sm">
                    <Trash2 className="size-4" />
                  </Button>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-secondary">
                  <div>
                    <div className="font-mono text-sm">ak_dev_••••••••••••9c4d</div>
                    <div className="text-xs text-muted-foreground mt-1">Development • Created 5 days ago</div>
                  </div>
                  <Button variant="ghost" size="sm">
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>
              <Button variant="outline">
                <Plus className="size-4 mr-2" />
                Generate New Key
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Model Settings */}
        <TabsContent value="models">
          <Card>
            <CardHeader>
              <CardTitle>Default Model Configuration</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Default LLM Provider</Label>
                <Select defaultValue="openai">
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="openai">OpenAI</SelectItem>
                    <SelectItem value="anthropic">Anthropic</SelectItem>
                    <SelectItem value="google">Google</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Default Model</Label>
                <Select defaultValue="gpt4">
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gpt4">GPT-4</SelectItem>
                    <SelectItem value="gpt35">GPT-3.5 Turbo</SelectItem>
                    <SelectItem value="claude3">Claude 3</SelectItem>
                    <SelectItem value="gemini">Gemini Pro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Default Temperature</Label>
                <Input type="number" defaultValue="0.7" step="0.1" min="0" max="2" />
              </div>
              <div>
                <Label>Default Max Tokens</Label>
                <Input type="number" defaultValue="1000" />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label>Enable Model Fallback</Label>
                  <p className="text-xs text-muted-foreground mt-1">
                    Automatically switch to backup model on failure
                  </p>
                </div>
                <Switch defaultChecked />
              </div>
              <Button>Save Model Settings</Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Integrations */}
        <TabsContent value="integrations">
          <Card>
            <CardHeader>
              <CardTitle>External Service Integrations</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>OpenAI API Key</Label>
                <Input type="password" defaultValue="••••••••••••••••" className="font-mono" />
              </div>
              <div>
                <Label>Anthropic API Key</Label>
                <Input type="password" defaultValue="••••••••••••••••" className="font-mono" />
              </div>
              <div>
                <Label>Slack Webhook URL</Label>
                <Input defaultValue="https://hooks.slack.com/services/..." className="font-mono" />
              </div>
              <div>
                <Label>SendGrid API Key</Label>
                <Input type="password" defaultValue="••••••••••••••••" className="font-mono" />
              </div>
              <Button>Save Integration Settings</Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
