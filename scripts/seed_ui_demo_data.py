#!/usr/bin/env python3
import argparse
import json
import sys
import time
import urllib.error
import urllib.parse
import urllib.request


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


def issue_token(base_api, email, tenant_id, role):
    payload = {"email": email, "tenant_id": tenant_id, "role": role}
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


def make_chatflow_definition(name):
    return {
        "__meta": {"flowType": "CHATFLOW", "seededBy": "seed_ui_demo_data.py"},
        "nodes": [
            {
                "id": "prompt_0",
                "type": "customNode",
                "position": {"x": 120, "y": 140},
                "data": {"id": "prompt_0", "name": "promptTemplate", "label": "Prompt", "inputs": {"template": f"{name} prompt"}},
            },
            {
                "id": "llm_0",
                "type": "customNode",
                "position": {"x": 420, "y": 140},
                "data": {"id": "llm_0", "name": "ollamaChat", "label": "Ollama Chat", "inputs": {"model": "llama3.2"}},
            },
        ],
        "edges": [],
    }


def make_agentflow_definition(name):
    return {
        "__meta": {"flowType": "AGENTFLOW", "seededBy": "seed_ui_demo_data.py"},
        "nodes": [
            {
                "id": "start_0",
                "type": "agentFlow",
                "position": {"x": 120, "y": 180},
                "data": {"id": "start_0", "name": "startAgentflow", "label": "Start"},
            },
            {
                "id": "llm_0",
                "type": "agentFlow",
                "position": {"x": 420, "y": 180},
                "data": {"id": "llm_0", "name": "llmAgentflow", "label": "LLM"},
            },
            {
                "id": "reply_0",
                "type": "agentFlow",
                "position": {"x": 720, "y": 180},
                "data": {"id": "reply_0", "name": "directReplyAgentflow", "label": "Reply"},
            },
        ],
        "edges": [],
    }


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
    industries = [
        "Healthcare",
        "Banking",
        "Insurance",
        "Retail",
        "Ecommerce",
        "Logistics",
        "Manufacturing",
        "Telecommunications",
        "Education",
        "Real Estate",
        "Hospitality",
        "Travel",
        "Energy",
        "Public Sector",
        "Legal",
        "Pharmaceutical",
        "Media",
        "Automotive",
        "Human Resources",
        "Cybersecurity",
    ]

    chat_patterns = [
        ("Support Copilot", "Customer Support", ["Support", "Q&A"]),
        ("Knowledge Assistant", "Knowledge Retrieval", ["RAG", "Knowledge Base"]),
        ("Onboarding Guide", "User Onboarding", ["Onboarding", "Self-Service"]),
    ]

    agent_patterns = [
        ("Ticket Triage Orchestrator", "Ticket Automation", ["Routing", "Automation"]),
        ("Compliance Workflow Agent", "Compliance Operations", ["Compliance", "Review"]),
        ("Daily Operations Coordinator", "Operations Automation", ["Ops", "Scheduling"]),
    ]

    templates = []
    idx = 1
    for industry in industries:
        for title, usecase, categories in chat_patterns:
            name = f"{industry} {title}"
            templates.append(
                {
                    "name": name,
                    "payload": {
                        "isPrebuilt": True,
                        "isCustom": False,
                        "type": "Chatflow",
                        "description": f"{industry}: pre-built template for {usecase.lower()}",
                        "badge": "POPULAR" if idx % 11 == 0 else ("NEW" if idx % 3 == 0 else None),
                        "framework": ["Langchain"],
                        "usecases": [f"{industry} {usecase}", usecase, industry],
                        "categories": ["Prebuilt", "Real World", industry, *categories],
                        "flowData": json.dumps({"__meta": {"flowType": "CHATFLOW"}, "nodes": [], "edges": []}),
                    },
                }
            )
            idx += 1
    for industry in industries:
        for title, usecase, categories in agent_patterns:
            name = f"{industry} {title}"
            templates.append(
                {
                    "name": name,
                    "payload": {
                        "isPrebuilt": True,
                        "isCustom": False,
                        "type": "AgentflowV2",
                        "description": f"{industry}: pre-built template for {usecase.lower()}",
                        "badge": "POPULAR" if idx % 11 == 0 else ("NEW" if idx % 3 == 0 else None),
                        "framework": ["Langgraph"],
                        "usecases": [f"{industry} {usecase}", usecase, industry],
                        "categories": ["Prebuilt", "Real World", industry, *categories],
                        "flowData": json.dumps({"__meta": {"flowType": "AGENTFLOW"}, "nodes": [], "edges": []}),
                    },
                }
            )
            idx += 1
    return templates


def seed_marketplace(base_api, token):
    templates = build_marketplace_templates()
    existing = list_resources(base_api, token, "marketplace", limit=800)
    existing_by_name = {item.get("name"): item for item in existing}

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

    return {"template_count": len(templates), "created": created, "updated": updated}


def main():
    parser = argparse.ArgumentParser(description="Seed demo Chatflows/Agentflows and Marketplace templates.")
    parser.add_argument("--base-api", default="http://localhost/api", help="Base API URL, default: http://localhost/api")
    parser.add_argument("--email", default="admin@vetrai.com")
    parser.add_argument("--tenant-id", default="00000000-0000-0000-0000-000000000001")
    parser.add_argument("--role", default="admin")
    args = parser.parse_args()

    token = issue_token(args.base_api, args.email, args.tenant_id, args.role)
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
                    "Marketplace has 120 pre-built templates (create/update upsert)",
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
