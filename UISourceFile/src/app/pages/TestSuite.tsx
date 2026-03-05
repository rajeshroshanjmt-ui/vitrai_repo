import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Input } from "../components/ui/input";
import { Play, Plus, CheckCircle2, XCircle, Clock } from "lucide-react";

const testSuites = [
  {
    id: "suite-1",
    name: "Customer Support Regression",
    workflow: "customer-support",
    totalTests: 24,
    passed: 22,
    failed: 2,
    lastRun: "2 hours ago",
    avgAccuracy: 94.2,
  },
  {
    id: "suite-2",
    name: "Document Processing Tests",
    workflow: "document-processing",
    totalTests: 18,
    passed: 18,
    failed: 0,
    lastRun: "1 day ago",
    avgAccuracy: 98.7,
  },
  {
    id: "suite-3",
    name: "Fraud Detection Suite",
    workflow: "fraud-detection",
    totalTests: 32,
    passed: 30,
    failed: 2,
    lastRun: "3 hours ago",
    avgAccuracy: 96.1,
  },
];

const testCases = [
  {
    id: "test-1",
    name: "Negative sentiment routing",
    input: "Angry customer complaint",
    expected: "Route to human agent",
    actual: "Route to human agent",
    status: "passed",
    duration: "847ms",
    accuracy: 98.5,
  },
  {
    id: "test-2",
    name: "Positive feedback handling",
    input: "Thank you message",
    expected: "Auto-respond with appreciation",
    actual: "Auto-respond with appreciation",
    status: "passed",
    duration: "623ms",
    accuracy: 96.2,
  },
  {
    id: "test-3",
    name: "Neutral inquiry processing",
    input: "Product information request",
    expected: "Provide product details",
    actual: "Route to human agent",
    status: "failed",
    duration: "912ms",
    accuracy: 78.3,
  },
  {
    id: "test-4",
    name: "Urgent issue detection",
    input: "Account security problem",
    expected: "Escalate immediately",
    actual: "Escalate immediately",
    status: "passed",
    duration: "734ms",
    accuracy: 99.1,
  },
];

export function TestSuite() {
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Test Suite</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Regression testing and quality assurance for workflows
          </p>
        </div>
        <Button>
          <Plus className="size-4 mr-2" />
          New Test Suite
        </Button>
      </div>

      {/* Test Suites */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {testSuites.map((suite) => (
          <Card key={suite.id}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-base">{suite.name}</CardTitle>
                  <p className="text-xs text-muted-foreground mt-1">{suite.workflow}</p>
                </div>
                <Badge variant={suite.failed > 0 ? "destructive" : "default"}>
                  {suite.passed}/{suite.totalTests}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Accuracy</span>
                  <span className="font-semibold">{suite.avgAccuracy}%</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Last Run</span>
                  <span className="text-xs">{suite.lastRun}</span>
                </div>
                <div className="flex gap-2 mt-4">
                  <Button variant="outline" size="sm" className="flex-1">
                    <Play className="size-3 mr-1" />
                    Run
                  </Button>
                  <Button variant="ghost" size="sm" className="flex-1">
                    Details
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Test Case Details */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Test Cases: Customer Support Regression</CardTitle>
            <div className="flex items-center gap-2">
              <Input placeholder="Search tests..." className="w-64" />
              <Button variant="outline" size="sm">
                <Play className="size-4 mr-2" />
                Run All
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {testCases.map((test) => (
              <div
                key={test.id}
                className="p-4 rounded-lg border border-border bg-secondary hover:bg-muted transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3 flex-1">
                    {test.status === "passed" ? (
                      <CheckCircle2 className="size-5 text-green-500 flex-shrink-0 mt-0.5" />
                    ) : test.status === "failed" ? (
                      <XCircle className="size-5 text-red-500 flex-shrink-0 mt-0.5" />
                    ) : (
                      <Clock className="size-5 text-yellow-500 flex-shrink-0 mt-0.5" />
                    )}
                    <div className="flex-1">
                      <div className="font-medium text-sm mb-2">{test.name}</div>
                      <div className="grid grid-cols-3 gap-4 text-xs">
                        <div>
                          <div className="text-muted-foreground mb-1">Input</div>
                          <div className="text-foreground">{test.input}</div>
                        </div>
                        <div>
                          <div className="text-muted-foreground mb-1">Expected</div>
                          <div className="text-foreground">{test.expected}</div>
                        </div>
                        <div>
                          <div className="text-muted-foreground mb-1">Actual</div>
                          <div className={test.status === "failed" ? "text-red-500" : "text-foreground"}>
                            {test.actual}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="text-right ml-4">
                    <Badge variant={test.status === "passed" ? "default" : "destructive"} className="mb-2">
                      {test.accuracy}% accuracy
                    </Badge>
                    <div className="text-xs text-muted-foreground font-mono">{test.duration}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
