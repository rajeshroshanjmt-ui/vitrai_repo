#!/usr/bin/env python3
import argparse
import json
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

CHATFLOW_DOMAINS = {
    "Customer Support": [
        "FAQ chatbot",
        "Order tracking chatbot",
        "Refund assistant",
        "Complaint handling bot",
        "Technical troubleshooting bot",
        "Service outage notification bot",
        "Customer onboarding chatbot",
        "Subscription cancellation assistant",
        "Product support chatbot",
        "Warranty claim chatbot",
    ],
    "Sales": [
        "Lead qualification chatbot",
        "Product recommendation chatbot",
        "Sales demo assistant",
        "Pricing inquiry chatbot",
        "Appointment booking chatbot",
        "Product comparison chatbot",
        "Upsell assistant chatbot",
        "Retail sales chatbot",
        "Real estate sales chatbot",
        "Insurance consultation chatbot",
    ],
    "Marketing": [
        "Content idea generator chatbot",
        "Social media assistant chatbot",
        "SEO keyword research chatbot",
        "Campaign planning chatbot",
        "Brand messaging chatbot",
        "Newsletter generation chatbot",
        "Influencer outreach chatbot",
        "Market research chatbot",
        "Audience segmentation chatbot",
        "Ad copy generator chatbot",
    ],
    "Education": [
        "AI tutor chatbot",
        "Homework help chatbot",
        "Quiz assistant chatbot",
        "Language learning chatbot",
        "Exam preparation chatbot",
        "Lecture summary chatbot",
        "Classroom Q&A chatbot",
        "Research assistant chatbot",
        "Study planner chatbot",
        "Student support chatbot",
    ],
    "Healthcare": [
        "Symptom checker chatbot",
        "Appointment scheduling chatbot",
        "Medical FAQ chatbot",
        "Telemedicine assistant chatbot",
        "Mental health support chatbot",
        "Medication reminder chatbot",
        "Nutrition advice chatbot",
        "Health coaching chatbot",
        "Patient intake chatbot",
        "Healthcare triage chatbot",
    ],
}

AGENTFLOW_DOMAINS = {
    "Business Operations": [
        "Meeting transcript summarization workflow",
        "Email classification workflow",
        "Task automation workflow",
        "Document approval workflow",
        "Business report generation workflow",
        "Knowledge base indexing workflow",
        "Internal helpdesk automation workflow",
        "Operations monitoring workflow",
        "Process optimization workflow",
        "Incident management workflow",
    ],
    "Data & Analytics": [
        "Dataset summarization workflow",
        "KPI monitoring workflow",
        "Sales analytics workflow",
        "Customer churn prediction workflow",
        "Revenue forecasting workflow",
        "Data anomaly detection workflow",
        "Data cleaning workflow",
        "Trend analysis workflow",
        "Data visualization workflow",
        "BI insights workflow",
    ],
    "Software Development": [
        "Code review automation workflow",
        "Pull request summarization workflow",
        "Bug report analysis workflow",
        "API documentation workflow",
        "CI/CD failure analysis workflow",
        "DevOps incident summarization workflow",
        "Code refactoring workflow",
        "Test case generation workflow",
        "Code explanation workflow",
        "Architecture documentation workflow",
    ],
    "HR & Recruitment": [
        "Resume screening workflow",
        "Candidate ranking workflow",
        "Interview question generation workflow",
        "Employee onboarding workflow",
        "Performance review workflow",
        "HR analytics workflow",
        "Hiring pipeline automation workflow",
        "Employee feedback analysis workflow",
        "Salary benchmarking workflow",
        "HR policy automation workflow",
    ],
    "Finance": [
        "Invoice processing workflow",
        "Expense categorization workflow",
        "Financial report summarization workflow",
        "Fraud detection workflow",
        "Budget forecasting workflow",
        "Accounting automation workflow",
        "Risk analysis workflow",
        "Vendor payment workflow",
        "Audit preparation workflow",
        "Tax document processing workflow",
    ],
    "Ecommerce": [
        "Product catalog generation workflow",
        "Inventory forecasting workflow",
        "Order processing workflow",
        "Customer segmentation workflow",
        "Pricing optimization workflow",
        "Cart abandonment workflow",
        "Product review analysis workflow",
        "Supplier recommendation workflow",
        "Promotion optimization workflow",
        "Ecommerce analytics workflow",
    ],
}

ASSISTANT_DOMAINS = {
    "Business Assistants": [
        "Executive AI assistant",
        "Meeting assistant",
        "Email writing assistant",
        "Research assistant",
        "Business analyst assistant",
        "Project manager assistant",
        "Operations assistant",
        "Strategy advisor assistant",
        "Knowledge base assistant",
        "Documentation assistant",
    ],
    "Developer Assistants": [
        "Coding assistant",
        "Debugging assistant",
        "API design assistant",
        "DevOps assistant",
        "Architecture advisor",
        "Security review assistant",
        "Performance optimization assistant",
        "Code documentation assistant",
        "Test automation assistant",
        "Git workflow assistant",
    ],
    "Marketing Assistants": [
        "Content writer assistant",
        "SEO advisor assistant",
        "Social media assistant",
        "Marketing strategist assistant",
        "Campaign planning assistant",
        "Brand voice assistant",
        "Ad copy assistant",
        "Market research assistant",
        "Audience insights assistant",
        "Email marketing assistant",
    ],
    "Finance Assistants": [
        "Financial advisor assistant",
        "Investment research assistant",
        "Budget planning assistant",
        "Accounting assistant",
        "Expense tracking assistant",
        "Risk analysis assistant",
        "Financial reporting assistant",
        "Tax assistant",
        "Fraud detection assistant",
        "Portfolio management assistant",
    ],
    "Legal Assistants": [
        "Contract review assistant",
        "Legal research assistant",
        "Compliance assistant",
        "NDA generator assistant",
        "Policy analysis assistant",
        "Case law assistant",
        "Legal document summarizer",
        "Legal Q&A assistant",
        "Due diligence assistant",
        "Legal citation assistant",
    ],
    "Healthcare Assistants": [
        "Medical research assistant",
        "Clinical documentation assistant",
        "Healthcare advisor assistant",
        "Patient support assistant",
        "Medical knowledge assistant",
        "Drug interaction assistant",
        "Medical coding assistant",
        "Clinical trial assistant",
        "Health risk assistant",
        "Telemedicine assistant",
    ],
}

CHATFLOW_VARIANTS = [
    ("Standard", "balanced conversation pipeline"),
    ("RAG", "retrieval-grounded response pipeline"),
    ("Omnichannel", "handoff-aware and channel-adaptive pipeline"),
]

AGENTFLOW_VARIANTS = [
    ("Standard", "orchestrated multi-step automation"),
    ("Monitoring", "event-aware monitoring and alerting automation"),
    ("Compliance", "policy-aware review and approval automation"),
    ("Autonomous", "goal-driven autonomous execution automation"),
]

ASSISTANT_VARIANTS = [
    ("Core", "day-to-day execution support"),
    ("Expert", "domain-deep analytical support"),
    ("Executive", "decision-oriented strategic support"),
]


def request_json(method, url, token=None, payload=None):
    data = None
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    if payload is not None:
        data = json.dumps(payload).encode("utf-8")

    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    attempts = 0
    while attempts < 6:
        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                raw = resp.read().decode("utf-8")
                if not raw:
                    return {}
                return json.loads(raw)
        except urllib.error.HTTPError as exc:
            body = exc.read().decode("utf-8", errors="replace")
            if exc.code in (429, 503):
                attempts += 1
                time.sleep(0.25 * attempts)
                continue
            raise RuntimeError(f"{method} {url} failed ({exc.code}): {body}") from exc

    raise RuntimeError(f"{method} {url} failed after retries due to rate limiting")


def issue_token(base_api, email, password, tenant_id, role):
    payload = {"email": email, "password": password, "tenant_id": tenant_id}
    out = request_json("POST", f"{base_api}/auth/token", payload=payload)
    token = out.get("access_token")
    if not token:
        raise RuntimeError("Unable to get access token")
    return token


def list_flows(base_api, token, limit=200):
    query = urllib.parse.urlencode({"limit": limit})
    out = request_json("GET", f"{base_api}/flows/list?{query}", token=token)
    return out.get("items", [])


def create_flow(base_api, token, name, definition):
    out = request_json(
        "POST",
        f"{base_api}/flows/create",
        token=token,
        payload={"name": name, "json_definition": definition},
    )
    return out.get("flow_id")


def update_flow_draft(base_api, token, flow_id, definition):
    return request_json(
        "PUT",
        f"{base_api}/flows/{flow_id}/draft",
        token=token,
        payload={"json_definition": definition},
    )


def get_flow(base_api, token, flow_id):
    return request_json("GET", f"{base_api}/flows/{flow_id}", token=token)


def delete_flow(base_api, token, flow_id):
    return request_json("DELETE", f"{base_api}/flows/{flow_id}", token=token)


def list_resources(base_api, token, resource_type, limit=500, offset=0):
    query = urllib.parse.urlencode({"limit": limit, "offset": offset})
    out = request_json("GET", f"{base_api}/resources/{resource_type}?{query}", token=token)
    return out.get("items", [])


def list_all_resources(base_api, token, resource_type, page_size=200):
    items = []
    offset = 0
    while True:
        page = list_resources(base_api, token, resource_type, limit=page_size, offset=offset)
        if not page:
            break
        items.extend(page)
        if len(page) < page_size:
            break
        offset += page_size
    return items


def create_resource(base_api, token, resource_type, name, payload):
    return request_json(
        "POST",
        f"{base_api}/resources/{resource_type}",
        token=token,
        payload={"name": name, "payload": payload},
    )


def update_resource(base_api, token, resource_type, resource_id, name, payload):
    return request_json(
        "PUT",
        f"{base_api}/resources/{resource_type}/{resource_id}",
        token=token,
        payload={"name": name, "payload": payload},
    )


def delete_resource(base_api, token, resource_type, resource_id):
    return request_json(
        "DELETE",
        f"{base_api}/resources/{resource_type}/{resource_id}",
        token=token,
    )


def make_chatflow_definition(name):
    return {
        "__meta": {"flowType": "CHATFLOW", "seededBy": "seed_ui_demo_data.py"},
        "nodes": [
            {
                "id": "prompt_0",
                "type": "customNode",
                "position": {"x": 120, "y": 140},
                "data": {
                    "id": "prompt_0",
                    "name": "promptTemplate",
                    "label": "Prompt",
                    "inputParams": [
                        {"label": "Template", "name": "template", "type": "string", "optional": False, "id": "prompt_0-input-template-string"}
                    ],
                    "inputAnchors": [],
                    "outputAnchors": [
                        {
                            "id": "prompt_0-output-prompt-PromptTemplate",
                            "name": "prompt",
                            "label": "Prompt",
                            "type": "PromptTemplate",
                        }
                    ],
                    "inputs": {"template": f"{name} prompt"},
                    "outputs": {},
                },
            },
            {
                "id": "llm_0",
                "type": "customNode",
                "position": {"x": 420, "y": 140},
                "data": {
                    "id": "llm_0",
                    "name": "ollamaChat",
                    "label": "Ollama Chat",
                    "inputParams": [
                        {"label": "Model", "name": "model", "type": "string", "optional": False, "id": "llm_0-input-model-string"}
                    ],
                    "inputAnchors": [
                        {"id": "llm_0-input-prompt-PromptTemplate", "label": "Prompt", "name": "prompt", "type": "PromptTemplate"}
                    ],
                    "outputAnchors": [{"id": "llm_0-output-chatModel-ChatModel", "name": "chatModel", "label": "Chat Model", "type": "ChatModel"}],
                    "inputs": {"model": "llama3.2", "prompt": "{{prompt_0.data.instance}}"},
                    "outputs": {},
                },
            },
        ],
        "edges": [
            {
                "source": "prompt_0",
                "sourceHandle": "prompt_0-output-prompt-PromptTemplate",
                "target": "llm_0",
                "targetHandle": "llm_0-input-prompt-PromptTemplate",
                "type": "buttonedge",
                "id": "prompt_0-prompt_0-output-prompt-PromptTemplate-llm_0-llm_0-input-prompt-PromptTemplate",
            }
        ],
    }


def make_agentflow_definition(name):
    return {
        "__meta": {"flowType": "AGENTFLOW", "seededBy": "seed_ui_demo_data.py"},
        "nodes": [
            {
                "id": "start_0",
                "type": "agentFlow",
                "position": {"x": 120, "y": 180},
                "data": {
                    "id": "start_0",
                    "name": "startAgentflow",
                    "label": "Start",
                    "color": "#7EE787",
                    "inputParams": [],
                    "inputAnchors": [],
                    "outputAnchors": [{"id": "start_0-output-0", "label": "Start", "name": "startAgentflow"}],
                    "inputs": {},
                    "outputs": {},
                },
            },
            {
                "id": "llm_0",
                "type": "agentFlow",
                "position": {"x": 420, "y": 180},
                "data": {
                    "id": "llm_0",
                    "name": "llmAgentflow",
                    "label": "LLM",
                    "color": "#64B5F6",
                    "inputParams": [{"label": "Instruction", "name": "instruction", "type": "string", "optional": True}],
                    "inputAnchors": [],
                    "outputAnchors": [{"id": "llm_0-output-0", "label": "LLM", "name": "llmAgentflow"}],
                    "inputs": {"instruction": f"{name} instruction"},
                    "outputs": {},
                },
            },
            {
                "id": "reply_0",
                "type": "agentFlow",
                "position": {"x": 720, "y": 180},
                "data": {
                    "id": "reply_0",
                    "name": "directReplyAgentflow",
                    "label": "Reply",
                    "color": "#4DDBBB",
                    "inputParams": [],
                    "inputAnchors": [],
                    "outputAnchors": [],
                    "inputs": {},
                    "outputs": {},
                },
            },
        ],
        "edges": [
            {
                "source": "start_0",
                "sourceHandle": "start_0-output-0",
                "target": "llm_0",
                "targetHandle": "llm_0",
                "type": "agentFlow",
                "id": "start_0-start_0-output-0-llm_0-llm_0",
                "data": {"sourceColor": "#7EE787", "targetColor": "#64B5F6"},
            },
            {
                "source": "llm_0",
                "sourceHandle": "llm_0-output-0",
                "target": "reply_0",
                "targetHandle": "reply_0",
                "type": "agentFlow",
                "id": "llm_0-llm_0-output-0-reply_0-reply_0",
                "data": {"sourceColor": "#64B5F6", "targetColor": "#4DDBBB"},
            },
        ],
    }


def make_marketplace_chatflow_definition(name, industry, usecase):
    flow = make_chatflow_definition(name)
    flow["__meta"]["templateSource"] = "marketplace"
    flow["nodes"][0]["data"]["inputs"]["template"] = (
        f"You are a {industry} assistant for {usecase.lower()}. Ask concise clarifying questions when details are missing."
    )
    return flow


def make_marketplace_agentflow_definition(name, industry, usecase):
    flow = make_agentflow_definition(name)
    flow["__meta"]["templateSource"] = "marketplace"
    flow["nodes"][1]["data"]["inputs"]["instruction"] = (
        f"{industry} workflow for {usecase.lower()}: triage request, reason, then produce final response."
    )
    return flow


def seed_flows(base_api, token):
    chat_names = [f"UI Demo Chatflow {i:02d}" for i in range(1, 6)]
    agent_names = [f"UI Demo Agentflow {i:02d}" for i in range(1, 6)]
    temp_names = ["UI Demo Chatflow TEMP", "UI Demo Agentflow TEMP"]
    cleanup_names = set(chat_names + agent_names + temp_names)

    existing = list_flows(base_api, token, limit=500)
    existing_by_name = {row.get("name"): row for row in existing}
    for name in cleanup_names:
        flow = existing_by_name.get(name)
        if flow:
            delete_flow(base_api, token, flow["flow_id"])

    created_chat_ids = []
    created_agent_ids = []

    for name in chat_names:
        created_chat_ids.append(create_flow(base_api, token, name, make_chatflow_definition(name)))
    for name in agent_names:
        created_agent_ids.append(create_flow(base_api, token, name, make_agentflow_definition(name)))

    # CRUD - Update + Read on first of each type
    first_chat_id = created_chat_ids[0]
    first_agent_id = created_agent_ids[0]
    chat_def = make_chatflow_definition(chat_names[0])
    chat_def["__meta"]["crudUpdated"] = True
    agent_def = make_agentflow_definition(agent_names[0])
    agent_def["__meta"]["crudUpdated"] = True
    update_flow_draft(base_api, token, first_chat_id, chat_def)
    update_flow_draft(base_api, token, first_agent_id, agent_def)
    get_flow(base_api, token, first_chat_id)
    get_flow(base_api, token, first_agent_id)

    # CRUD - Delete temp rows
    temp_chat_id = create_flow(base_api, token, temp_names[0], make_chatflow_definition(temp_names[0]))
    temp_agent_id = create_flow(base_api, token, temp_names[1], make_agentflow_definition(temp_names[1]))
    delete_flow(base_api, token, temp_chat_id)
    delete_flow(base_api, token, temp_agent_id)

    return {"chatflow_count": len(created_chat_ids), "agentflow_count": len(created_agent_ids)}


def build_marketplace_templates():
    template_family = "regenerated_marketplace_v2"

    def badge_for(index):
        if index % 13 == 0:
            return "POPULAR"
        if index % 4 == 0:
            return "NEW"
        return None

    def assistant_profile_id(domain, usecase, variant):
        merged = f"{domain}_{usecase}_{variant}".lower()
        normalized = "".join(ch if ch.isalnum() else "_" for ch in merged)
        while "__" in normalized:
            normalized = normalized.replace("__", "_")
        return normalized.strip("_")

    templates = []
    idx = 1

    for domain, usecases in CHATFLOW_DOMAINS.items():
        for usecase in usecases:
            for variant_name, variant_summary in CHATFLOW_VARIANTS:
                name = f"{domain}: {usecase} ({variant_name})"
                templates.append(
                    {
                        "name": name,
                        "payload": {
                            "isPrebuilt": True,
                            "isCustom": False,
                            "type": "Chatflow",
                            "description": f"{domain} conversational template for {usecase.lower()} with {variant_summary}.",
                            "badge": badge_for(idx),
                            "framework": ["Langchain"],
                            "usecases": [usecase, domain, "Conversational AI"],
                            "categories": ["Marketplace 2026", "Chatflows", domain, variant_name],
                            "flowData": json.dumps(make_marketplace_chatflow_definition(name, domain, usecase)),
                            "templateFamily": template_family,
                            "templateVariant": variant_name,
                        },
                    }
                )
                idx += 1

    for domain, usecases in AGENTFLOW_DOMAINS.items():
        for usecase in usecases:
            for variant_name, variant_summary in AGENTFLOW_VARIANTS:
                name = f"{domain}: {usecase} ({variant_name})"
                templates.append(
                    {
                        "name": name,
                        "payload": {
                            "isPrebuilt": True,
                            "isCustom": False,
                            "type": "AgentflowV2",
                            "description": f"{domain} automation template for {usecase.lower()} with {variant_summary}.",
                            "badge": badge_for(idx),
                            "framework": ["Langgraph"],
                            "usecases": [usecase, domain, "Automation"],
                            "categories": ["Marketplace 2026", "Agentflows", domain, variant_name],
                            "flowData": json.dumps(make_marketplace_agentflow_definition(name, domain, usecase)),
                            "templateFamily": template_family,
                            "templateVariant": variant_name,
                        },
                    }
                )
                idx += 1

    for domain, usecases in ASSISTANT_DOMAINS.items():
        for usecase in usecases:
            for variant_name, variant_summary in ASSISTANT_VARIANTS:
                name = f"{domain}: {usecase} ({variant_name})"
                templates.append(
                    {
                        "name": name,
                        "payload": {
                            "isPrebuilt": True,
                            "isCustom": False,
                            "type": "Assistant",
                            "description": f"{domain} assistant template for {usecase.lower()} focused on {variant_summary}.",
                            "badge": badge_for(idx),
                            "framework": ["Assistant Runtime"],
                            "usecases": [usecase, domain, "AI Agent"],
                            "categories": ["Marketplace 2026", "Assistants", domain, variant_name],
                            "assistantData": {
                                "type": "CUSTOM",
                                "profileId": assistant_profile_id(domain, usecase, variant_name),
                                "profileLabel": usecase,
                                "qualityPreset": "marketplace_regenerated_v1",
                                "instruction": (
                                    f"You are the {name}. Help users with {usecase.lower()} in {domain.lower()}. "
                                    "Use concise, actionable steps, ask clarifying questions when information is missing, "
                                    "and clearly separate verified facts from assumptions."
                                ),
                            },
                            "templateFamily": template_family,
                            "templateVariant": variant_name,
                        },
                    }
                )
                idx += 1

    return templates


def seed_marketplace(base_api, token):
    template_family = "regenerated_marketplace_v2"
    templates = build_marketplace_templates()
    existing = list_all_resources(base_api, token, "marketplace", page_size=200)
    existing_by_name = {}
    deleted = 0

    for item in existing:
        payload = item.get("payload") or {}
        if payload.get("isCustom"):
            continue
        if payload.get("templateFamily") == template_family:
            existing_by_name[item.get("name")] = item
            continue
        resource_id = item.get("resource_id")
        if resource_id:
            delete_resource(base_api, token, "marketplace", resource_id)
            deleted += 1

    created = 0
    updated = 0
    for idx, tpl in enumerate(templates):
        current = existing_by_name.get(tpl["name"])
        if current:
            update_resource(base_api, token, "marketplace", current["resource_id"], tpl["name"], tpl["payload"])
            updated += 1
        else:
            create_resource(base_api, token, "marketplace", tpl["name"], tpl["payload"])
            created += 1
        if idx % 8 == 0:
            time.sleep(0.12)

    counts = {"Chatflow": 0, "AgentflowV2": 0, "Assistant": 0}
    for template in templates:
        tpl_type = (template.get("payload") or {}).get("type")
        if tpl_type in counts:
            counts[tpl_type] += 1

    return {
        "template_count": len(templates),
        "created": created,
        "updated": updated,
        "deleted_legacy_prebuilt": deleted,
        "chatflows": counts["Chatflow"],
        "agentflows": counts["AgentflowV2"],
        "assistants": counts["Assistant"],
        "template_family": template_family,
    }


def main():
    parser = argparse.ArgumentParser(description="Seed demo Chatflows/Agentflows and Marketplace templates.")
    parser.add_argument("--base-api", default="http://localhost/api", help="Base API URL, default: http://localhost/api")
    parser.add_argument("--email", default="admin@vetrai.com")
    parser.add_argument("--password", default="AdminPassword123!", help="Password for auth/token endpoint")
    parser.add_argument("--tenant-id", default="00000000-0000-0000-0000-000000000001")
    parser.add_argument("--role", default="admin")
    args = parser.parse_args()

    token = issue_token(args.base_api, args.email, args.password, args.tenant_id, args.role)
    flow_summary = seed_flows(args.base_api, token)
    marketplace_summary = seed_marketplace(args.base_api, token)

    print(
        json.dumps(
            {
                "status": "ok",
                "flows": flow_summary,
                "marketplace": marketplace_summary,
                "notes": [
                    "CRUD covered: create/read/update/delete executed via /flows endpoints",
                    "Final state keeps 5 Chatflows and 5 Agentflows",
                    "Marketplace regenerated catalog includes Chatflow, Agentflow, and Assistant templates",
                    "Legacy non-custom marketplace template lists are removed during seed",
                ],
            },
            indent=2,
        )
    )


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(str(exc), file=sys.stderr)
        sys.exit(1)
