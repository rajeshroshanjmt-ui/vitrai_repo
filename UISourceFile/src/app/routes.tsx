import { createBrowserRouter } from "react-router";
import { MainLayout } from "./components/MainLayout";
import { Dashboard } from "./pages/Dashboard";
import { AIAssistant } from "./pages/AIAssistant";
import { Builder } from "./pages/Builder";
import { Playground } from "./pages/Playground";
import { TestSuite } from "./pages/TestSuite";
import { ReviewQueue } from "./pages/ReviewQueue";
import { Flows } from "./pages/Flows";
import { RAGManagement } from "./pages/RAGManagement";
import { Tools } from "./pages/Tools";
import { APIEmbed } from "./pages/APIEmbed";
import { Logs } from "./pages/Logs";
import { UsageBilling } from "./pages/UsageBilling";
import { Health } from "./pages/Health";
import { Settings } from "./pages/Settings";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: MainLayout,
    children: [
      { index: true, Component: Dashboard },
      { path: "assistant", Component: AIAssistant },
      { path: "builder", Component: Builder },
      { path: "playground", Component: Playground },
      { path: "test-suite", Component: TestSuite },
      { path: "review-queue", Component: ReviewQueue },
      { path: "flows", Component: Flows },
      { path: "rag", Component: RAGManagement },
      { path: "tools", Component: Tools },
      { path: "api", Component: APIEmbed },
      { path: "logs", Component: Logs },
      { path: "usage", Component: UsageBilling },
      { path: "health", Component: Health },
      { path: "settings", Component: Settings },
    ],
  },
]);
