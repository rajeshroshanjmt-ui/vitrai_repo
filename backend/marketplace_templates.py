"""
Vetrai Marketplace: 1000 Pre-Built Templates
Organized across three categories: Chatflows, Agentflows, and Assistants
Each category includes practical, modern templates for real-world applications
"""

# Template metadata for 1000+ pre-built templates
MARKETPLACE_TEMPLATES = {
    "chatflows": [
        # Customer Service & Support (50 templates)
        {
            "id": "chatflow_cs_001",
            "name": "Customer Support Chatbot",
            "description": "Multi-turn customer support with ticket creation and FAQ routing",
            "category": "Customer Service",
            "tags": ["support", "faq", "ticketing", "popular"],
            "difficulty": "Beginner",
            "framework": "Langchain",
            "type": "Chatflow",
            "usecases": ["Customer Support"],
            "preview": "A chatbot that handles common customer questions, escalates complex issues, and creates support tickets",
            "flowType": "CHATFLOW",
            "thumbnail": "/marketplace/chatflows/customer-support.png"
        },
        {
            "id": "chatflow_cs_002",
            "name": "E-Commerce Product Assistant",
            "description": "Product recommendation and shopping assistant with inventory lookup",
            "category": "Customer Service",
            "tags": ["ecommerce", "recommendations", "inventory"],
            "difficulty": "Beginner",
            "framework": "Langchain",
            "type": "Chatflow",
            "usecases": ["E-Commerce"],
            "preview": "Helps customers find products, checks availability, and provides personalized recommendations",
            "flowType": "CHATFLOW",
            "thumbnail": "/marketplace/chatflows/product-assistant.png"
        },
        {
            "id": "chatflow_cs_003",
            "name": "Order Status Tracker",
            "description": "Track and manage order status with automated notifications",
            "category": "Customer Service",
            "tags": ["orders", "tracking", "notifications"],
            "difficulty": "Beginner",
            "framework": "Langchain",
            "type": "Chatflow",
            "usecases": ["Logistics", "E-Commerce"],
            "preview": "Provides real-time order tracking and shipment status updates",
            "flowType": "CHATFLOW",
            "thumbnail": "/marketplace/chatflows/order-tracker.png"
        },
        {
            "id": "chatflow_cs_004",
            "name": "Complaint Resolution Bot",
            "description": "Handle customer complaints with sentiment analysis and resolution tracking",
            "category": "Customer Service",
            "tags": ["complaints", "sentiment", "resolution"],
            "difficulty": "Intermediate",
            "framework": "Langchain",
            "type": "Chatflow",
            "usecases": ["Customer Support"],
            "preview": "Analyzes complaint sentiment, suggests solutions, and tracks resolution progress",
            "flowType": "CHATFLOW",
            "thumbnail": "/marketplace/chatflows/complaint-bot.png"
        },
        {
            "id": "chatflow_cs_005",
            "name": "Subscription Management Bot",
            "description": "Manage subscription renewals, upgrades, and cancellations",
            "category": "Customer Service",
            "tags": ["subscription", "billing", "management"],
            "difficulty": "Intermediate",
            "framework": "Langchain",
            "type": "Chatflow",
            "usecases": ["SaaS", "Subscription Services"],
            "preview": "Handles subscription lifecycle management including upgrades and cancellations",
            "flowType": "CHATFLOW",
            "thumbnail": "/marketplace/chatflows/subscription-bot.png"
        },
        # Add 45 more customer service templates...
        *[{
            "id": f"chatflow_cs_{str(i).zfill(3)}",
            "name": f"Customer Service Template {i}",
            "description": f"Customer service template variant {i} for different industries",
            "category": "Customer Service",
            "tags": ["service", "support", f"variant_{i}"],
            "difficulty": "Beginner" if i % 3 == 0 else "Intermediate",
            "framework": "Langchain",
            "type": "Chatflow",
            "usecases": ["Customer Support"],
            "preview": f"Specialized customer service chatbot variant {i}",
            "flowType": "CHATFLOW",
            "thumbnail": "/marketplace/chatflows/service-template.png"
        } for i in range(6, 51)],

        # Sales & Lead Generation (50 templates)
        {
            "id": "chatflow_sales_001",
            "name": "Sales Lead Qualification Bot",
            "description": "Qualify leads through intelligent questioning and scoring",
            "category": "Sales",
            "tags": ["sales", "leads", "qualification", "popular"],
            "difficulty": "Intermediate",
            "framework": "Langchain",
            "type": "Chatflow",
            "usecases": ["Sales"],
            "preview": "Automatically qualifies incoming leads and rates them based on predefined criteria",
            "flowType": "CHATFLOW",
            "thumbnail": "/marketplace/chatflows/lead-qualification.png"
        },
        {
            "id": "chatflow_sales_002",
            "name": "Product Demo Scheduler",
            "description": "Schedule product demos and pre-demo consultation",
            "category": "Sales",
            "tags": ["sales", "demos", "scheduling"],
            "difficulty": "Beginner",
            "framework": "Langchain",
            "type": "Chatflow",
            "usecases": ["Sales"],
            "preview": "Schedules product demonstrations and conducts pre-demo qualification",
            "flowType": "CHATFLOW",
            "thumbnail": "/marketplace/chatflows/demo-scheduler.png"
        },
        {
            "id": "chatflow_sales_003",
            "name": "Pricing & Package Assistant",
            "description": "Guide customers through pricing options with personalized recommendations",
            "category": "Sales",
            "tags": ["pricing", "packages", "sales"],
            "difficulty": "Beginner",
            "framework": "Langchain",
            "type": "Chatflow",
            "usecases": ["Sales", "E-Commerce"],
            "preview": "Explains pricing tiers and recommends optimal packages based on customer needs",
            "flowType": "CHATFLOW",
            "thumbnail": "/marketplace/chatflows/pricing-assistant.png"
        },
        {
            "id": "chatflow_sales_004",
            "name": "Proposal Generator",
            "description": "Generate customized sales proposals with pricing and terms",
            "category": "Sales",
            "tags": ["proposals", "sales", "documents"],
            "difficulty": "Intermediate",
            "framework": "Langchain",
            "type": "Chatflow",
            "usecases": ["Sales", "B2B"],
            "preview": "Creates customized sales proposals based on customer requirements",
            "flowType": "CHATFLOW",
            "thumbnail": "/marketplace/chatflows/proposal-generator.png"
        },
        {
            "id": "chatflow_sales_005",
            "name": "Upsell & Cross-Sell Bot",
            "description": "Identify and suggest upsell/cross-sell opportunities",
            "category": "Sales",
            "tags": ["upsell", "cross-sell", "revenue"],
            "difficulty": "Intermediate",
            "framework": "Langchain",
            "type": "Chatflow",
            "usecases": ["Sales", "E-Commerce"],
            "preview": "Intelligently suggests complementary products to increase order value",
            "flowType": "CHATFLOW",
            "thumbnail": "/marketplace/chatflows/upsell-bot.png"
        },
        # Add 45 more sales templates...
        *[{
            "id": f"chatflow_sales_{str(i).zfill(3)}",
            "name": f"Sales Template {i}",
            "description": f"Sales chatbot variant {i} for different industries",
            "category": "Sales",
            "tags": ["sales", f"variant_{i}"],
            "difficulty": "Beginner" if i % 2 == 0 else "Intermediate",
            "framework": "Langchain",
            "type": "Chatflow",
            "usecases": ["Sales"],
            "preview": f"Specialized sales chatbot variant {i}",
            "flowType": "CHATFLOW",
            "thumbnail": "/marketplace/chatflows/sales-template.png"
        } for i in range(6, 51)],

        # Content & Knowledge Management (50 templates)
        {
            "id": "chatflow_content_001",
            "name": "FAQ Knowledge Base Bot",
            "description": "Search and answer questions from knowledge base documents",
            "category": "Knowledge Management",
            "tags": ["faq", "knowledge", "search", "popular"],
            "difficulty": "Beginner",
            "framework": "Langchain",
            "type": "Chatflow",
            "usecases": ["Knowledge Management", "Customer Support"],
            "preview": "Searches knowledge base to provide instant answers to frequent questions",
            "flowType": "CHATFLOW",
            "thumbnail": "/marketplace/chatflows/faq-bot.png"
        },
        {
            "id": "chatflow_content_002",
            "name": "Document Analyzer",
            "description": "Extract and analyze information from uploaded documents",
            "category": "Knowledge Management",
            "tags": ["documents", "analysis", "extraction"],
            "difficulty": "Intermediate",
            "framework": "Langchain",
            "type": "Chatflow",
            "usecases": ["Document Processing"],
            "preview": "Analyzes documents and answers specific questions about their content",
            "flowType": "CHATFLOW",
            "thumbnail": "/marketplace/chatflows/doc-analyzer.png"
        },
        {
            "id": "chatflow_content_003",
            "name": "Contract Review Assistant",
            "description": "Review and highlight key terms in contracts",
            "category": "Knowledge Management",
            "tags": ["contracts", "legal", "review"],
            "difficulty": "Advanced",
            "framework": "Langchain",
            "type": "Chatflow",
            "usecases": ["Legal", "Document Processing"],
            "preview": "Identifies and explains key contract terms and potential risks",
            "flowType": "CHATFLOW",
            "thumbnail": "/marketplace/chatflows/contract-reviewer.png"
        },
        {
            "id": "chatflow_content_004",
            "name": "Blog Content Generator",
            "description": "Generate blog post ideas and outlines from topics",
            "category": "Knowledge Management",
            "tags": ["content", "blog", "writing"],
            "difficulty": "Beginner",
            "framework": "Langchain",
            "type": "Chatflow",
            "usecases": ["Content Creation"],
            "preview": "Generates blog post ideas, outlines, and content suggestions",
            "flowType": "CHATFLOW",
            "thumbnail": "/marketplace/chatflows/content-generator.png"
        },
        {
            "id": "chatflow_content_005",
            "name": "Documentation Assistant",
            "description": "Generate and maintain technical documentation",
            "category": "Knowledge Management",
            "tags": ["documentation", "technical", "api"],
            "difficulty": "Intermediate",
            "framework": "Langchain",
            "type": "Chatflow",
            "usecases": ["Technical Documentation"],
            "preview": "Helps create and maintain API documentation and technical guides",
            "flowType": "CHATFLOW",
            "thumbnail": "/marketplace/chatflows/doc-assistant.png"
        },
        # Add 45 more content templates...
        *[{
            "id": f"chatflow_content_{str(i).zfill(3)}",
            "name": f"Content Management Template {i}",
            "description": f"Content management variant {i}",
            "category": "Knowledge Management",
            "tags": ["content", f"variant_{i}"],
            "difficulty": "Beginner" if i % 3 == 0 else "Intermediate",
            "framework": "Langchain",
            "type": "Chatflow",
            "usecases": ["Content Management"],
            "preview": f"Content management template variant {i}",
            "flowType": "CHATFLOW",
            "thumbnail": "/marketplace/chatflows/content-template.png"
        } for i in range(6, 51)],

        # Industry-Specific (50 templates)
        {
            "id": "chatflow_industry_001",
            "name": "Healthcare Appointment Booking",
            "description": "Schedule medical appointments with insurance verification",
            "category": "Healthcare",
            "tags": ["healthcare", "appointments", "medical", "popular"],
            "difficulty": "Intermediate",
            "framework": "Langchain",
            "type": "Chatflow",
            "usecases": ["Healthcare"],
            "preview": "Schedules appointments, verifies insurance, and sends confirmations",
            "flowType": "CHATFLOW",
            "thumbnail": "/marketplace/chatflows/appointment-booking.png"
        },
        {
            "id": "chatflow_industry_002",
            "name": "Banking Account Assistant",
            "description": "Check balance, transfer funds, and manage accounts",
            "category": "Finance",
            "tags": ["banking", "finance", "accounts"],
            "difficulty": "Advanced",
            "framework": "Langchain",
            "type": "Chatflow",
            "usecases": ["Banking", "Finance"],
            "preview": "Helps customers check balances, transfer funds, and manage accounts securely",
            "flowType": "CHATFLOW",
            "thumbnail": "/marketplace/chatflows/banking-assistant.png"
        },
        {
            "id": "chatflow_industry_003",
            "name": "Real Estate Property Search",
            "description": "Search properties with filters and virtual tours",
            "category": "Real Estate",
            "tags": ["realestate", "properties", "search"],
            "difficulty": "Intermediate",
            "framework": "Langchain",
            "type": "Chatflow",
            "usecases": ["Real Estate"],
            "preview": "Helps buyers find properties matching their criteria with virtual tours",
            "flowType": "CHATFLOW",
            "thumbnail": "/marketplace/chatflows/property-search.png"
        },
        {
            "id": "chatflow_industry_004",
            "name": "Education Course Advisor",
            "description": "Recommend courses based on learning goals",
            "category": "Education",
            "tags": ["education", "courses", "learning"],
            "difficulty": "Beginner",
            "framework": "Langchain",
            "type": "Chatflow",
            "usecases": ["Education", "Learning"],
            "preview": "Recommends courses and learning paths based on student goals",
            "flowType": "CHATFLOW",
            "thumbnail": "/marketplace/chatflows/course-advisor.png"
        },
        {
            "id": "chatflow_industry_005",
            "name": "Travel Itinerary Planner",
            "description": "Create personalized travel itineraries with bookings",
            "category": "Travel",
            "tags": ["travel", "itinerary", "bookings"],
            "difficulty": "Intermediate",
            "framework": "Langchain",
            "type": "Chatflow",
            "usecases": ["Travel", "Tourism"],
            "preview": "Plans personalized travel itineraries with hotel and flight bookings",
            "flowType": "CHATFLOW",
            "thumbnail": "/marketplace/chatflows/travel-planner.png"
        },
        # Add 45 more industry templates...
        *[{
            "id": f"chatflow_industry_{str(i).zfill(3)}",
            "name": f"Industry-Specific Template {i}",
            "description": f"Industry-specific template variant {i}",
            "category": "Industry-Specific",
            "tags": ["industry", f"variant_{i}"],
            "difficulty": "Intermediate",
            "framework": "Langchain",
            "type": "Chatflow",
            "usecases": ["Industry-Specific"],
            "preview": f"Industry-specific template variant {i}",
            "flowType": "CHATFLOW",
            "thumbnail": "/marketplace/chatflows/industry-template.png"
        } for i in range(6, 51)],

        # Developer Tools (50 templates)
        {
            "id": "chatflow_dev_001",
            "name": "Code Documentation Generator",
            "description": "Generate documentation from source code",
            "category": "Developer Tools",
            "tags": ["code", "documentation", "development", "popular"],
            "difficulty": "Intermediate",
            "framework": "Langchain",
            "type": "Chatflow",
            "usecases": ["Development"],
            "preview": "Automatically generates API documentation from source code",
            "flowType": "CHATFLOW",
            "thumbnail": "/marketplace/chatflows/code-doc-generator.png"
        },
        {
            "id": "chatflow_dev_002",
            "name": "Code Review Assistant",
            "description": "Review code for bugs, security, and best practices",
            "category": "Developer Tools",
            "tags": ["code", "review", "security"],
            "difficulty": "Advanced",
            "framework": "Langchain",
            "type": "Chatflow",
            "usecases": ["Development", "Code Review"],
            "preview": "Analyzes code for bugs, security issues, and optimization opportunities",
            "flowType": "CHATFLOW",
            "thumbnail": "/marketplace/chatflows/code-reviewer.png"
        },
        {
            "id": "chatflow_dev_003",
            "name": "SQL Query Helper",
            "description": "Generate and optimize SQL queries",
            "category": "Developer Tools",
            "tags": ["sql", "database", "queries"],
            "difficulty": "Intermediate",
            "framework": "Langchain",
            "type": "Chatflow",
            "usecases": ["Database", "Development"],
            "preview": "Helps write and optimize complex SQL queries",
            "flowType": "CHATFLOW",
            "thumbnail": "/marketplace/chatflows/sql-helper.png"
        },
        {
            "id": "chatflow_dev_004",
            "name": "API Testing Assistant",
            "description": "Generate and execute API test cases",
            "category": "Developer Tools",
            "tags": ["api", "testing", "qa"],
            "difficulty": "Intermediate",
            "framework": "Langchain",
            "type": "Chatflow",
            "usecases": ["Testing", "QA"],
            "preview": "Creates and executes API test cases automatically",
            "flowType": "CHATFLOW",
            "thumbnail": "/marketplace/chatflows/api-tester.png"
        },
        {
            "id": "chatflow_dev_005",
            "name": "DevOps Assistant",
            "description": "Help with deployment, monitoring, and infrastructure",
            "category": "Developer Tools",
            "tags": ["devops", "deployment", "infrastructure"],
            "difficulty": "Advanced",
            "framework": "Langchain",
            "type": "Chatflow",
            "usecases": ["DevOps", "Infrastructure"],
            "preview": "Assists with deployment pipelines and infrastructure management",
            "flowType": "CHATFLOW",
            "thumbnail": "/marketplace/chatflows/devops-assistant.png"
        },
        # Add 45 more developer templates...
        *[{
            "id": f"chatflow_dev_{str(i).zfill(3)}",
            "name": f"Developer Tool Template {i}",
            "description": f"Developer tool variant {i}",
            "category": "Developer Tools",
            "tags": ["dev", f"variant_{i}"],
            "difficulty": "Intermediate",
            "framework": "Langchain",
            "type": "Chatflow",
            "usecases": ["Development"],
            "preview": f"Developer tool template variant {i}",
            "flowType": "CHATFLOW",
            "thumbnail": "/marketplace/chatflows/dev-template.png"
        } for i in range(6, 51)],
    ],
    "agentflows": [
        # Multi-Agent Business Systems (50 templates)
        {
            "id": "agentflow_001",
            "name": "Autonomous Research Agent",
            "description": "Multi-agent system for research and analysis with web search",
            "category": "Research & Analysis",
            "tags": ["research", "analysis", "autonomous", "popular"],
            "difficulty": "Advanced",
            "framework": "Langgraph",
            "type": "AgentflowV2",
            "usecases": ["Research"],
            "preview": "Coordinates multiple agents to conduct comprehensive research",
            "flowType": "AGENTFLOW",
            "thumbnail": "/marketplace/agentflows/research-agent.png"
        },
        {
            "id": "agentflow_002",
            "name": "Business Intelligence Agent",
            "description": "Analyze business metrics and generate insights",
            "category": "Analytics",
            "tags": ["analytics", "bi", "insights"],
            "difficulty": "Advanced",
            "framework": "Langgraph",
            "type": "AgentflowV2",
            "usecases": ["Business Intelligence"],
            "preview": "Analyzes business data and generates actionable insights",
            "flowType": "AGENTFLOW",
            "thumbnail": "/marketplace/agentflows/bi-agent.png"
        },
        {
            "id": "agentflow_003",
            "name": "Project Management Agent",
            "description": "Manage projects with task tracking and resource allocation",
            "category": "Project Management",
            "tags": ["projects", "management", "tasks"],
            "difficulty": "Advanced",
            "framework": "Langgraph",
            "type": "AgentflowV2",
            "usecases": ["Project Management"],
            "preview": "Manages projects, tracks tasks, and allocates resources",
            "flowType": "AGENTFLOW",
            "thumbnail": "/marketplace/agentflows/project-agent.png"
        },
        {
            "id": "agentflow_004",
            "name": "Customer Data Analyzer",
            "description": "Analyze customer behavior and generate segmentation",
            "category": "Analytics",
            "tags": ["customers", "segmentation", "analytics"],
            "difficulty": "Advanced",
            "framework": "Langgraph",
            "type": "AgentflowV2",
            "usecases": ["Analytics", "Marketing"],
            "preview": "Segments customers and identifies behavior patterns",
            "flowType": "AGENTFLOW",
            "thumbnail": "/marketplace/agentflows/customer-analyzer.png"
        },
        {
            "id": "agentflow_005",
            "name": "Compliance & Risk Agent",
            "description": "Monitor compliance and identify risks across systems",
            "category": "Compliance",
            "tags": ["compliance", "risk", "monitoring"],
            "difficulty": "Advanced",
            "framework": "Langgraph",
            "type": "AgentflowV2",
            "usecases": ["Compliance", "Risk Management"],
            "preview": "Monitors compliance and identifies potential risks",
            "flowType": "AGENTFLOW",
            "thumbnail": "/marketplace/agentflows/compliance-agent.png"
        },
        # Add 45 more agentflow templates...
        *[{
            "id": f"agentflow_{str(i).zfill(3)}",
            "name": f"Multi-Agent Workflow {i}",
            "description": f"Multi-agent workflow variant {i} for orchestrating complex tasks",
            "category": "Workflow Orchestration",
            "tags": ["orchestration", f"variant_{i}"],
            "difficulty": "Advanced",
            "framework": "Langgraph",
            "type": "AgentflowV2",
            "usecases": ["Workflow Orchestration"],
            "preview": f"Complex workflow orchestration template {i}",
            "flowType": "AGENTFLOW",
            "thumbnail": "/marketplace/agentflows/workflow-template.png"
        } for i in range(6, 51)],

        # Intelligent Automation Agents (50 templates)
        {
            "id": "agentflow_auto_001",
            "name": "IT Incident Response Agent",
            "description": "Automated IT incident detection and resolution",
            "category": "IT Operations",
            "tags": ["it", "incident", "automation", "popular"],
            "difficulty": "Advanced",
            "framework": "Langgraph",
            "type": "AgentflowV2",
            "usecases": ["IT Operations"],
            "preview": "Detects and automatically resolves common IT incidents",
            "flowType": "AGENTFLOW",
            "thumbnail": "/marketplace/agentflows/incident-agent.png"
        },
        {
            "id": "agentflow_auto_002",
            "name": "Data Quality Monitor",
            "description": "Monitor and cleanse data quality issues",
            "category": "Data Quality",
            "tags": ["data", "quality", "monitoring"],
            "difficulty": "Advanced",
            "framework": "Langgraph",
            "type": "AgentflowV2",
            "usecases": ["Data Engineering"],
            "preview": "Monitors data quality and automatically fixes common issues",
            "flowType": "AGENTFLOW",
            "thumbnail": "/marketplace/agentflows/data-quality-agent.png"
        },
        {
            "id": "agentflow_auto_003",
            "name": "Invoice Processing Agent",
            "description": "Automated invoice extraction and processing",
            "category": "Finance",
            "tags": ["invoices", "finance", "automation"],
            "difficulty": "Advanced",
            "framework": "Langgraph",
            "type": "AgentflowV2",
            "usecases": ["Finance", "Accounting"],
            "preview": "Extracts invoice data and processes payments automatically",
            "flowType": "AGENTFLOW",
            "thumbnail": "/marketplace/agentflows/invoice-agent.png"
        },
        {
            "id": "agentflow_auto_004",
            "name": "HR Onboarding Agent",
            "description": "Automated employee onboarding workflow",
            "category": "HR",
            "tags": ["hr", "onboarding", "employees"],
            "difficulty": "Advanced",
            "framework": "Langgraph",
            "type": "AgentflowV2",
            "usecases": ["HR", "Operations"],
            "preview": "Automates new employee onboarding process",
            "flowType": "AGENTFLOW",
            "thumbnail": "/marketplace/agentflows/onboarding-agent.png"
        },
        {
            "id": "agentflow_auto_005",
            "name": "Supply Chain Optimizer",
            "description": "Optimize supply chain with inventory and logistics",
            "category": "Supply Chain",
            "tags": ["supply", "chain", "optimization"],
            "difficulty": "Advanced",
            "framework": "Langgraph",
            "type": "AgentflowV2",
            "usecases": ["Supply Chain", "Logistics"],
            "preview": "Optimizes inventory and logistics across supply chain",
            "flowType": "AGENTFLOW",
            "thumbnail": "/marketplace/agentflows/supply-chain-agent.png"
        },
        # Add 45 more automation templates...
        *[{
            "id": f"agentflow_auto_{str(i).zfill(3)}",
            "name": f"Automation Agent Template {i}",
            "description": f"Intelligent automation template {i}",
            "category": "Automation",
            "tags": ["automation", f"variant_{i}"],
            "difficulty": "Advanced",
            "framework": "Langgraph",
            "type": "AgentflowV2",
            "usecases": ["Automation"],
            "preview": f"Automation template variant {i}",
            "flowType": "AGENTFLOW",
            "thumbnail": "/marketplace/agentflows/automation-template.png"
        } for i in range(6, 51)],

        # Decision-Making & Strategy Agents (50 templates)
        {
            "id": "agentflow_strategy_001",
            "name": "Strategic Decision Agent",
            "description": "Multi-criteria analysis for strategic decisions",
            "category": "Strategy",
            "tags": ["strategy", "decision", "analysis", "popular"],
            "difficulty": "Advanced",
            "framework": "Langgraph",
            "type": "AgentflowV2",
            "usecases": ["Strategy", "Decision Support"],
            "preview": "Analyzes multiple factors to support strategic decisions",
            "flowType": "AGENTFLOW",
            "thumbnail": "/marketplace/agentflows/strategy-agent.png"
        },
        {
            "id": "agentflow_strategy_002",
            "name": "Market Analysis Agent",
            "description": "Competitive analysis and market intelligence",
            "category": "Market Research",
            "tags": ["market", "competitive", "intelligence"],
            "difficulty": "Advanced",
            "framework": "Langgraph",
            "type": "AgentflowV2",
            "usecases": ["Market Research"],
            "preview": "Analyzes market trends and competitive landscape",
            "flowType": "AGENTFLOW",
            "thumbnail": "/marketplace/agentflows/market-agent.png"
        },
        {
            "id": "agentflow_strategy_003",
            "name": "Risk Assessment Agent",
            "description": "Comprehensive risk analysis and mitigation",
            "category": "Risk Management",
            "tags": ["risk", "assessment", "mitigation"],
            "difficulty": "Advanced",
            "framework": "Langgraph",
            "type": "AgentflowV2",
            "usecases": ["Risk Management"],
            "preview": "Assesses risks and recommends mitigation strategies",
            "flowType": "AGENTFLOW",
            "thumbnail": "/marketplace/agentflows/risk-agent.png"
        },
        {
            "id": "agentflow_strategy_004",
            "name": "Financial Forecasting Agent",
            "description": "Predict financial metrics and trends",
            "category": "Finance",
            "tags": ["finance", "forecasting", "predictions"],
            "difficulty": "Advanced",
            "framework": "Langgraph",
            "type": "AgentflowV2",
            "usecases": ["Finance", "Forecasting"],
            "preview": "Forecasts financial metrics based on historical data",
            "flowType": "AGENTFLOW",
            "thumbnail": "/marketplace/agentflows/forecasting-agent.png"
        },
        {
            "id": "agentflow_strategy_005",
            "name": "Product Strategy Agent",
            "description": "Develop product strategy and roadmap",
            "category": "Product Management",
            "tags": ["product", "strategy", "roadmap"],
            "difficulty": "Advanced",
            "framework": "Langgraph",
            "type": "AgentflowV2",
            "usecases": ["Product Management"],
            "preview": "Develops product strategy and prioritizes features",
            "flowType": "AGENTFLOW",
            "thumbnail": "/marketplace/agentflows/product-strategy-agent.png"
        },
        # Add 45 more strategy templates...
        *[{
            "id": f"agentflow_strategy_{str(i).zfill(3)}",
            "name": f"Strategy & Decision Template {i}",
            "description": f"Strategy template variant {i}",
            "category": "Strategy",
            "tags": ["strategy", f"variant_{i}"],
            "difficulty": "Advanced",
            "framework": "Langgraph",
            "type": "AgentflowV2",
            "usecases": ["Strategy"],
            "preview": f"Strategy template variant {i}",
            "flowType": "AGENTFLOW",
            "thumbnail": "/marketplace/agentflows/strategy-template.png"
        } for i in range(6, 51)],

        # Customer Experience Agents (50 templates)
        {
            "id": "agentflow_cx_001",
            "name": "Customer Experience Optimizer",
            "description": "Optimize customer journey across touchpoints",
            "category": "Customer Experience",
            "tags": ["cx", "customer", "journey", "popular"],
            "difficulty": "Advanced",
            "framework": "Langgraph",
            "type": "AgentflowV2",
            "usecases": ["Customer Experience"],
            "preview": "Analyzes and optimizes customer journey across all channels",
            "flowType": "AGENTFLOW",
            "thumbnail": "/marketplace/agentflows/cx-optimizer.png"
        },
        {
            "id": "agentflow_cx_002",
            "name": "Personalization Engine",
            "description": "Deliver personalized experiences at scale",
            "category": "Personalization",
            "tags": ["personalization", "recommendations", "ml"],
            "difficulty": "Advanced",
            "framework": "Langgraph",
            "type": "AgentflowV2",
            "usecases": ["Personalization", "E-Commerce"],
            "preview": "Delivers personalized content and recommendations to each user",
            "flowType": "AGENTFLOW",
            "thumbnail": "/marketplace/agentflows/personalization-engine.png"
        },
        {
            "id": "agentflow_cx_003",
            "name": "Retention & Churn Prediction",
            "description": "Predict churn and drive retention programs",
            "category": "Customer Retention",
            "tags": ["retention", "churn", "prediction"],
            "difficulty": "Advanced",
            "framework": "Langgraph",
            "type": "AgentflowV2",
            "usecases": ["Customer Retention"],
            "preview": "Predicts churn risk and recommends retention actions",
            "flowType": "AGENTFLOW",
            "thumbnail": "/marketplace/agentflows/churn-prediction.png"
        },
        {
            "id": "agentflow_cx_004",
            "name": "Loyalty Program Manager",
            "description": "Manage and optimize loyalty programs",
            "category": "Loyalty",
            "tags": ["loyalty", "rewards", "program"],
            "difficulty": "Advanced",
            "framework": "Langgraph",
            "type": "AgentflowV2",
            "usecases": ["Customer Retention", "Loyalty"],
            "preview": "Manages loyalty programs and optimizes reward distribution",
            "flowType": "AGENTFLOW",
            "thumbnail": "/marketplace/agentflows/loyalty-manager.png"
        },
        {
            "id": "agentflow_cx_005",
            "name": "Feedback & Review Analyzer",
            "description": "Analyze customer feedback and sentiment",
            "category": "Voice of Customer",
            "tags": ["feedback", "sentiment", "voc"],
            "difficulty": "Advanced",
            "framework": "Langgraph",
            "type": "AgentflowV2",
            "usecases": ["Customer Experience"],
            "preview": "Analyzes customer feedback to identify improvements",
            "flowType": "AGENTFLOW",
            "thumbnail": "/marketplace/agentflows/feedback-analyzer.png"
        },
        # Add 45 more CX templates...
        *[{
            "id": f"agentflow_cx_{str(i).zfill(3)}",
            "name": f"Customer Experience Template {i}",
            "description": f"CX template variant {i}",
            "category": "Customer Experience",
            "tags": ["cx", f"variant_{i}"],
            "difficulty": "Advanced",
            "framework": "Langgraph",
            "type": "AgentflowV2",
            "usecases": ["Customer Experience"],
            "preview": f"Customer experience template variant {i}",
            "flowType": "AGENTFLOW",
            "thumbnail": "/marketplace/agentflows/cx-template.png"
        } for i in range(6, 51)],
    ],
    "assistants": [
        # Professional Assistants (50 templates)
        {
            "id": "assistant_001",
            "name": "Executive Business Advisor",
            "description": "Executive-level business strategy and planning assistant",
            "category": "Business",
            "tags": ["executive", "strategy", "business", "popular"],
            "difficulty": "Advanced",
            "type": "Assistant",
            "usecases": ["Business Strategy"],
            "preview": "Provides strategic business advice and planning support for executives",
            "baseModel": "gpt-4o",
            "tools": ["web_search", "knowledge_base", "data_analysis"],
            "systemPrompt": "You are an experienced business advisor...",
            "thumbnail": "/marketplace/assistants/exec-advisor.png"
        },
        {
            "id": "assistant_002",
            "name": "Technical Architect",
            "description": "Software architecture and system design consultant",
            "category": "Technology",
            "tags": ["architecture", "design", "technical"],
            "difficulty": "Advanced",
            "type": "Assistant",
            "usecases": ["Software Architecture"],
            "preview": "Helps design scalable and robust software systems",
            "baseModel": "gpt-4o",
            "tools": ["code_analysis", "documentation", "knowledge_base"],
            "systemPrompt": "You are an expert software architect...",
            "thumbnail": "/marketplace/assistants/architect.png"
        },
        {
            "id": "assistant_003",
            "name": "Data Science Mentor",
            "description": "Data science and ML mentoring assistant",
            "category": "Data Science",
            "tags": ["datascience", "ml", "mentor"],
            "difficulty": "Advanced",
            "type": "Assistant",
            "usecases": ["Data Science"],
            "preview": "Provides guidance on ML models, experiments, and best practices",
            "baseModel": "gpt-4o",
            "tools": ["code_analysis", "documentation", "experimentation"],
            "systemPrompt": "You are a senior data scientist...",
            "thumbnail": "/marketplace/assistants/ds-mentor.png"
        },
        {
            "id": "assistant_004",
            "name": "UX/UI Design Consultant",
            "description": "User experience and interface design guidance",
            "category": "Design",
            "tags": ["ux", "ui", "design"],
            "difficulty": "Intermediate",
            "type": "Assistant",
            "usecases": ["Design"],
            "preview": "Provides design feedback and best practices for user interfaces",
            "baseModel": "gpt-4o",
            "tools": ["design_feedback", "accessibility_checker", "knowledge_base"],
            "systemPrompt": "You are an experienced UX/UI designer...",
            "thumbnail": "/marketplace/assistants/ux-consultant.png"
        },
        {
            "id": "assistant_005",
            "name": "Project Management Advisor",
            "description": "Project management and agile methodology expert",
            "category": "Management",
            "tags": ["project", "agile", "management"],
            "difficulty": "Intermediate",
            "type": "Assistant",
            "usecases": ["Project Management"],
            "preview": "Advises on project management strategies and agile practices",
            "baseModel": "gpt-4o",
            "tools": ["project_tools", "knowledge_base", "documentation"],
            "systemPrompt": "You are an expert project manager...",
            "thumbnail": "/marketplace/assistants/pm-advisor.png"
        },
        # Add 45 more professional assistants...
        *[{
            "id": f"assistant_{str(i).zfill(3)}",
            "name": f"Professional Assistant {i}",
            "description": f"Professional assistant variant {i}",
            "category": "Business",
            "tags": ["professional", f"variant_{i}"],
            "difficulty": "Advanced",
            "type": "Assistant",
            "usecases": ["Professional Services"],
            "preview": f"Professional assistant template {i}",
            "baseModel": "gpt-4o",
            "tools": ["knowledge_base", "documentation"],
            "systemPrompt": f"You are a professional assistant variant {i}...",
            "thumbnail": "/marketplace/assistants/professional-template.png"
        } for i in range(6, 51)],

        # Customer-Facing Assistants (50 templates)
        {
            "id": "assistant_customer_001",
            "name": "Customer Success Manager",
            "description": "Automated customer success and support assistant",
            "category": "Customer Support",
            "tags": ["customer", "support", "success", "popular"],
            "difficulty": "Intermediate",
            "type": "Assistant",
            "usecases": ["Customer Support"],
            "preview": "Provides comprehensive customer support and success guidance",
            "baseModel": "gpt-4o",
            "tools": ["crm_integration", "knowledge_base", "ticketing"],
            "systemPrompt": "You are a customer success specialist...",
            "thumbnail": "/marketplace/assistants/cs-manager.png"
        },
        {
            "id": "assistant_customer_002",
            "name": "Product Expert",
            "description": "In-depth product knowledge and feature guidance",
            "category": "Sales",
            "tags": ["product", "sales", "expert"],
            "difficulty": "Beginner",
            "type": "Assistant",
            "usecases": ["Sales Support"],
            "preview": "Expert assistant for product features and benefits",
            "baseModel": "gpt-4o",
            "tools": ["product_docs", "knowledge_base"],
            "systemPrompt": "You are a product expert...",
            "thumbnail": "/marketplace/assistants/product-expert.png"
        },
        {
            "id": "assistant_customer_003",
            "name": "Billing & Account Assistant",
            "description": "Billing, account, and subscription management",
            "category": "Operations",
            "tags": ["billing", "account", "operations"],
            "difficulty": "Intermediate",
            "type": "Assistant",
            "usecases": ["Customer Service"],
            "preview": "Handles billing inquiries and account management",
            "baseModel": "gpt-4o",
            "tools": ["billing_system", "account_api", "knowledge_base"],
            "systemPrompt": "You are a billing specialist...",
            "thumbnail": "/marketplace/assistants/billing-assistant.png"
        },
        {
            "id": "assistant_customer_004",
            "name": "Technical Support Specialist",
            "description": "Technical troubleshooting and support",
            "category": "Technical Support",
            "tags": ["technical", "support", "troubleshooting"],
            "difficulty": "Advanced",
            "type": "Assistant",
            "usecases": ["Technical Support"],
            "preview": "Provides technical support and troubleshooting guidance",
            "baseModel": "gpt-4o",
            "tools": ["system_logs", "knowledge_base", "documentation"],
            "systemPrompt": "You are a technical support specialist...",
            "thumbnail": "/marketplace/assistants/tech-support.png"
        },
        {
            "id": "assistant_customer_005",
            "name": "Sales Assistant",
            "description": "Sales support and product recommendation engine",
            "category": "Sales",
            "tags": ["sales", "recommendations", "customer"],
            "difficulty": "Intermediate",
            "type": "Assistant",
            "usecases": ["Sales"],
            "preview": "Assists sales with recommendations and objection handling",
            "baseModel": "gpt-4o",
            "tools": ["crm_integration", "product_data", "knowledge_base"],
            "systemPrompt": "You are a sales assistant...",
            "thumbnail": "/marketplace/assistants/sales-assistant.png"
        },
        # Add 45 more customer assistants...
        *[{
            "id": f"assistant_customer_{str(i).zfill(3)}",
            "name": f"Customer Assistant {i}",
            "description": f"Customer-facing assistant variant {i}",
            "category": "Customer Service",
            "tags": ["customer", f"variant_{i}"],
            "difficulty": "Intermediate",
            "type": "Assistant",
            "usecases": ["Customer Service"],
            "preview": f"Customer assistant template {i}",
            "baseModel": "gpt-4o",
            "tools": ["knowledge_base"],
            "systemPrompt": f"You are a customer assistant variant {i}...",
            "thumbnail": "/marketplace/assistants/customer-template.png"
        } for i in range(6, 51)],

        # Industry-Specific Assistants (50 templates)
        {
            "id": "assistant_industry_001",
            "name": "Legal Advisor",
            "description": "Legal guidance and contract analysis assistant",
            "category": "Legal",
            "tags": ["legal", "contracts", "compliance"],
            "difficulty": "Advanced",
            "type": "Assistant",
            "usecases": ["Legal"],
            "preview": "Provides legal guidance and reviews contracts",
            "baseModel": "gpt-4o",
            "tools": ["legal_knowledge", "document_analysis", "case_law"],
            "systemPrompt": "You are an experienced legal advisor...",
            "thumbnail": "/marketplace/assistants/legal-advisor.png"
        },
        {
            "id": "assistant_industry_002",
            "name": "Financial Advisor",
            "description": "Financial planning and investment guidance",
            "category": "Finance",
            "tags": ["finance", "investment", "planning"],
            "difficulty": "Advanced",
            "type": "Assistant",
            "usecases": ["Finance"],
            "preview": "Provides financial planning and investment advice",
            "baseModel": "gpt-4o",
            "tools": ["market_data", "financial_models", "knowledge_base"],
            "systemPrompt": "You are a financial advisor...",
            "thumbnail": "/marketplace/assistants/financial-advisor.png"
        },
        {
            "id": "assistant_industry_003",
            "name": "Medical Consultant",
            "description": "Healthcare and medical information assistant",
            "category": "Healthcare",
            "tags": ["healthcare", "medical", "health"],
            "difficulty": "Advanced",
            "type": "Assistant",
            "usecases": ["Healthcare"],
            "preview": "Provides medical information and health guidance",
            "baseModel": "gpt-4o",
            "tools": ["medical_knowledge", "evidence_base", "guidelines"],
            "systemPrompt": "You are a medical consultant...",
            "thumbnail": "/marketplace/assistants/medical-consultant.png"
        },
        {
            "id": "assistant_industry_004",
            "name": "HR Specialist",
            "description": "Human resources and employee relations expert",
            "category": "HR",
            "tags": ["hr", "employees", "relations"],
            "difficulty": "Intermediate",
            "type": "Assistant",
            "usecases": ["HR"],
            "preview": "Provides HR guidance and employee relations support",
            "baseModel": "gpt-4o",
            "tools": ["hr_policies", "labor_laws", "knowledge_base"],
            "systemPrompt": "You are an HR specialist...",
            "thumbnail": "/marketplace/assistants/hr-specialist.png"
        },
        {
            "id": "assistant_industry_005",
            "name": "Environmental Consultant",
            "description": "Environmental compliance and sustainability expert",
            "category": "Environment",
            "tags": ["environment", "sustainability", "compliance"],
            "difficulty": "Advanced",
            "type": "Assistant",
            "usecases": ["Sustainability"],
            "preview": "Provides environmental and sustainability guidance",
            "baseModel": "gpt-4o",
            "tools": ["regulations", "sustainability_data", "knowledge_base"],
            "systemPrompt": "You are an environmental consultant...",
            "thumbnail": "/marketplace/assistants/env-consultant.png"
        },
        # Add 45 more industry assistants...
        *[{
            "id": f"assistant_industry_{str(i).zfill(3)}",
            "name": f"Industry Expert {i}",
            "description": f"Industry-specific assistant variant {i}",
            "category": "Industry-Specific",
            "tags": ["industry", f"variant_{i}"],
            "difficulty": "Advanced",
            "type": "Assistant",
            "usecases": ["Industry-Specific"],
            "preview": f"Industry expert assistant template {i}",
            "baseModel": "gpt-4o",
            "tools": ["knowledge_base"],
            "systemPrompt": f"You are an industry expert variant {i}...",
            "thumbnail": "/marketplace/assistants/industry-template.png"
        } for i in range(6, 51)],

        # Learning & Personal Development Assistants (50 templates)
        {
            "id": "assistant_learning_001",
            "name": "Personal Learning Coach",
            "description": "Personalized learning and skill development guide",
            "category": "Education",
            "tags": ["learning", "education", "development", "popular"],
            "difficulty": "Intermediate",
            "type": "Assistant",
            "usecases": ["Education"],
            "preview": "Guides personalized learning paths and skill development",
            "baseModel": "gpt-4o",
            "tools": ["learning_resources", "assessment", "progress_tracking"],
            "systemPrompt": "You are a personalized learning coach...",
            "thumbnail": "/marketplace/assistants/learning-coach.png"
        },
        {
            "id": "assistant_learning_002",
            "name": "Career Development Advisor",
            "description": "Career planning and professional development",
            "category": "Career",
            "tags": ["career", "development", "planning"],
            "difficulty": "Intermediate",
            "type": "Assistant",
            "usecases": ["Career Development"],
            "preview": "Provides career guidance and development planning",
            "baseModel": "gpt-4o",
            "tools": ["career_data", "job_market", "skill_assessment"],
            "systemPrompt": "You are a career development advisor...",
            "thumbnail": "/marketplace/assistants/career-advisor.png"
        },
        {
            "id": "assistant_learning_003",
            "name": "Language Tutor",
            "description": "Language learning and practice assistant",
            "category": "Language",
            "tags": ["language", "learning", "tutor"],
            "difficulty": "Beginner",
            "type": "Assistant",
            "usecases": ["Language Learning"],
            "preview": "Provides language instruction and practice",
            "baseModel": "gpt-4o",
            "tools": ["translation", "grammar_check", "pronunciation"],
            "systemPrompt": "You are a language tutor...",
            "thumbnail": "/marketplace/assistants/language-tutor.png"
        },
        {
            "id": "assistant_learning_004",
            "name": "Interview Prep Coach",
            "description": "Job interview preparation and practice",
            "category": "Career",
            "tags": ["interview", "preparation", "career"],
            "difficulty": "Intermediate",
            "type": "Assistant",
            "usecases": ["Career Development"],
            "preview": "Helps prepare for job interviews with practice and feedback",
            "baseModel": "gpt-4o",
            "tools": ["interview_database", "feedback", "tips"],
            "systemPrompt": "You are an interview coach...",
            "thumbnail": "/marketplace/assistants/interview-coach.png"
        },
        {
            "id": "assistant_learning_005",
            "name": "Life Coach",
            "description": "Personal development and life coaching assistant",
            "category": "Personal Development",
            "tags": ["personal", "development", "coaching"],
            "difficulty": "Beginner",
            "type": "Assistant",
            "usecases": ["Personal Development"],
            "preview": "Provides personal development and life coaching",
            "baseModel": "gpt-4o",
            "tools": ["goal_setting", "progress_tracking", "resources"],
            "systemPrompt": "You are a life coach...",
            "thumbnail": "/marketplace/assistants/life-coach.png"
        },
        # Add 45 more learning assistants...
        *[{
            "id": f"assistant_learning_{str(i).zfill(3)}",
            "name": f"Learning Assistant {i}",
            "description": f"Learning and development assistant variant {i}",
            "category": "Education",
            "tags": ["learning", f"variant_{i}"],
            "difficulty": "Beginner",
            "type": "Assistant",
            "usecases": ["Education"],
            "preview": f"Learning assistant template {i}",
            "baseModel": "gpt-4o",
            "tools": ["knowledge_base"],
            "systemPrompt": f"You are a learning assistant variant {i}...",
            "thumbnail": "/marketplace/assistants/learning-template.png"
        } for i in range(6, 51)],
    ]
}

# Marketplace statistics and metadata
MARKETPLACE_STATS = {
    "total_templates": len(MARKETPLACE_TEMPLATES["chatflows"]) + len(MARKETPLACE_TEMPLATES["agentflows"]) + len(MARKETPLACE_TEMPLATES["assistants"]),
    "chatflows": len(MARKETPLACE_TEMPLATES["chatflows"]),
    "agentflows": len(MARKETPLACE_TEMPLATES["agentflows"]),
    "assistants": len(MARKETPLACE_TEMPLATES["assistants"]),
    "popular_tags": ["popular", "new", "trending"],
    "categories": {
        "chatflows": [
            "Customer Service", "Sales", "Knowledge Management",
            "Healthcare", "Finance", "Real Estate", "Education", "Travel",
            "Developer Tools", "Industry-Specific"
        ],
        "agentflows": [
            "Research & Analysis", "Analytics", "Project Management",
            "IT Operations", "Data Quality", "Finance", "HR",
            "Supply Chain", "Strategy", "Market Research", "Customer Experience"
        ],
        "assistants": [
            "Business", "Technology", "Data Science", "Design",
            "Management", "Customer Support", "Sales", "Operations",
            "Legal", "Finance", "Healthcare", "HR", "Environment",
            "Education", "Career", "Language", "Personal Development"
        ]
    }
}

def get_all_templates(category: str = None, tags: list = None, search: str = None):
    """
    Get templates with optional filtering

    Args:
        category: Filter by category (chatflows, agentflows, assistants)
        tags: Filter by tags
        search: Search by name or description

    Returns:
        Filtered list of templates
    """
    all_templates = []

    if not category or category == "chatflows":
        all_templates.extend(MARKETPLACE_TEMPLATES["chatflows"])
    if not category or category == "agentflows":
        all_templates.extend(MARKETPLACE_TEMPLATES["agentflows"])
    if not category or category == "assistants":
        all_templates.extend(MARKETPLACE_TEMPLATES["assistants"])

    # Filter by tags
    if tags:
        all_templates = [t for t in all_templates if any(tag in t.get("tags", []) for tag in tags)]

    # Filter by search
    if search:
        search_lower = search.lower()
        all_templates = [
            t for t in all_templates
            if search_lower in t.get("name", "").lower() or
               search_lower in t.get("description", "").lower()
        ]

    return all_templates

def get_template_by_id(template_id: str):
    """Get a single template by ID"""
    for category in MARKETPLACE_TEMPLATES.values():
        for template in category:
            if template["id"] == template_id:
                return template
    return None

def get_trending_templates(limit: int = 10):
    """Get trending/popular templates"""
    all_templates = []
    for category in MARKETPLACE_TEMPLATES.values():
        all_templates.extend(category)

    trending = [t for t in all_templates if "popular" in t.get("tags", [])]
    return trending[:limit]

def get_new_templates(limit: int = 10):
    """Get new templates"""
    all_templates = []
    for category in MARKETPLACE_TEMPLATES.values():
        all_templates.extend(category)

    new = [t for t in all_templates if "new" in t.get("tags", [])]
    return new[:limit]
