import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { CheckCircle2, XCircle, AlertTriangle, Clock } from "lucide-react";

const reviewItems = [
  {
    id: "rev-1",
    workflow: "Loan Approval",
    executionId: "exec_a8b9c0d1",
    risk: "high",
    reason: "Approval amount exceeds $50,000 threshold",
    input: { customer_id: "cust_9876", amount: 75000, credit_score: 720 },
    recommendation: "Approve with additional verification",
    timestamp: "5 minutes ago",
    status: "pending",
  },
  {
    id: "rev-2",
    workflow: "Content Moderation",
    executionId: "exec_e2f3g4h5",
    risk: "medium",
    reason: "Borderline content detected (confidence: 67%)",
    input: { content_id: "post_1234", type: "user_post" },
    recommendation: "Flag for manual review",
    timestamp: "12 minutes ago",
    status: "pending",
  },
  {
    id: "rev-3",
    workflow: "Customer Support",
    executionId: "exec_i6j7k8l9",
    risk: "medium",
    reason: "Multiple escalation triggers detected",
    input: { ticket_id: "tick_5678", sentiment: -0.85 },
    recommendation: "Route to senior agent",
    timestamp: "18 minutes ago",
    status: "pending",
  },
  {
    id: "rev-4",
    workflow: "Fraud Detection",
    executionId: "exec_m0n1o2p3",
    risk: "high",
    reason: "Suspicious transaction pattern identified",
    input: { transaction_id: "txn_3456", amount: 15000, location: "unusual" },
    recommendation: "Block and investigate",
    timestamp: "22 minutes ago",
    status: "approved",
  },
];

const getRiskColor = (risk: string) => {
  switch (risk) {
    case "high":
      return "bg-red-500";
    case "medium":
      return "bg-yellow-500";
    case "low":
      return "bg-green-500";
    default:
      return "bg-gray-500";
  }
};

const getRiskIcon = (risk: string) => {
  switch (risk) {
    case "high":
      return <AlertTriangle className="size-5 text-red-500" />;
    case "medium":
      return <Clock className="size-5 text-yellow-500" />;
    case "low":
      return <CheckCircle2 className="size-5 text-green-500" />;
    default:
      return null;
  }
};

export function ReviewQueue() {
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Review Queue (HITL)</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Human-in-the-loop approval system for critical workflow decisions
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-red-500 border-red-500">
            3 High Priority
          </Badge>
          <Badge variant="outline">6 Total Pending</Badge>
        </div>
      </div>

      <Tabs defaultValue="pending" className="space-y-4">
        <TabsList>
          <TabsTrigger value="pending">Pending (6)</TabsTrigger>
          <TabsTrigger value="approved">Approved (124)</TabsTrigger>
          <TabsTrigger value="rejected">Rejected (18)</TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="space-y-4">
          {reviewItems
            .filter((item) => item.status === "pending")
            .map((item) => (
              <Card key={item.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      {getRiskIcon(item.risk)}
                      <div>
                        <CardTitle className="text-base">{item.workflow}</CardTitle>
                        <p className="text-xs text-muted-foreground mt-1 font-mono">{item.executionId}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={getRiskColor(item.risk)}>{item.risk} risk</Badge>
                      <span className="text-xs text-muted-foreground">{item.timestamp}</span>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <div className="text-sm font-medium mb-2">Review Reason</div>
                    <div className="p-3 rounded-lg bg-secondary text-sm">{item.reason}</div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-sm font-medium mb-2">Input Data</div>
                      <div className="p-3 rounded-lg bg-[#0B1220] font-mono text-xs text-foreground overflow-x-auto">
                        <pre>{JSON.stringify(item.input, null, 2)}</pre>
                      </div>
                    </div>
                    <div>
                      <div className="text-sm font-medium mb-2">AI Recommendation</div>
                      <div className="p-3 rounded-lg bg-secondary text-sm">{item.recommendation}</div>
                    </div>
                  </div>

                  <div className="flex gap-2 pt-2">
                    <Button className="flex-1 bg-green-600 hover:bg-green-700">
                      <CheckCircle2 className="size-4 mr-2" />
                      Approve
                    </Button>
                    <Button variant="destructive" className="flex-1">
                      <XCircle className="size-4 mr-2" />
                      Reject
                    </Button>
                    <Button variant="outline">Request More Info</Button>
                  </div>
                </CardContent>
              </Card>
            ))}
        </TabsContent>

        <TabsContent value="approved">
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              <CheckCircle2 className="size-12 mx-auto mb-3 text-green-500" />
              <p>124 items approved in the last 30 days</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="rejected">
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              <XCircle className="size-12 mx-auto mb-3 text-red-500" />
              <p>18 items rejected in the last 30 days</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
