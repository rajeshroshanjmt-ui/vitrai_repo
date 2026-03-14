"""
Initialize default permissions and system roles.
Run this once to seed the database with permissions.
"""
from uuid import uuid4
from sqlalchemy.orm import Session
from database import get_db, engine, Base
from models import Permission, Role, RolePermission, Tenant

# Define all available permissions
DEFAULT_PERMISSIONS = [
    # Users
    ("users:view", "users", "view", "View users"),
    ("users:create", "users", "create", "Create users"),
    ("users:edit", "users", "edit", "Edit users"),
    ("users:delete", "users", "delete", "Delete users"),
    ("users:manage", "users", "manage", "Manage users (all operations)"),

    # Flows
    ("flows:view", "flows", "view", "View chatflows"),
    ("flows:create", "flows", "create", "Create chatflows"),
    ("flows:edit", "flows", "edit", "Edit chatflows"),
    ("flows:delete", "flows", "delete", "Delete chatflows"),
    ("flows:execute", "flows", "execute", "Execute chatflows"),
    ("flows:export", "flows", "export", "Export chatflows"),
    ("flows:import", "flows", "import", "Import chatflows"),
    ("flows:duplicate", "flows", "duplicate", "Duplicate chatflows"),
    ("flows:config", "flows", "config", "Configure chatflows"),

    # Agent flows
    ("agentflows:view", "agentflows", "view", "View agent flows"),
    ("agentflows:create", "agentflows", "create", "Create agent flows"),
    ("agentflows:edit", "agentflows", "edit", "Edit agent flows"),
    ("agentflows:delete", "agentflows", "delete", "Delete agent flows"),

    # Assistants
    ("assistants:view", "assistants", "view", "View assistants"),
    ("assistants:create", "assistants", "create", "Create assistants"),
    ("assistants:edit", "assistants", "edit", "Edit assistants"),
    ("assistants:delete", "assistants", "delete", "Delete assistants"),

    # Executions
    ("executions:view", "executions", "view", "View execution logs"),

    # Templates
    ("templates:marketplace", "templates", "marketplace", "Access marketplace templates"),
    ("templates:custom", "templates", "custom", "Create custom templates"),
    ("templates:custom-share", "templates", "custom-share", "Share custom templates"),
    ("templates:flowexport", "templates", "flowexport", "Export flows as templates"),

    # Tools
    ("tools:view", "tools", "view", "View tools"),
    ("tools:create", "tools", "create", "Create tools"),
    ("tools:edit", "tools", "edit", "Edit tools"),
    ("tools:delete", "tools", "delete", "Delete tools"),

    # Credentials
    ("credentials:view", "credentials", "view", "View credentials"),
    ("credentials:create", "credentials", "create", "Create credentials"),
    ("credentials:edit", "credentials", "edit", "Edit credentials"),
    ("credentials:share", "credentials", "share", "Share credentials"),
    ("credentials:delete", "credentials", "delete", "Delete credentials"),

    # Variables
    ("variables:view", "variables", "view", "View variables"),
    ("variables:create", "variables", "create", "Create variables"),
    ("variables:update", "variables", "update", "Update variables"),
    ("variables:delete", "variables", "delete", "Delete variables"),

    # API Keys
    ("apikeys:view", "apikeys", "view", "View API keys"),
    ("apikeys:create", "apikeys", "create", "Create API keys"),
    ("apikeys:update", "apikeys", "update", "Update API keys"),
    ("apikeys:delete", "apikeys", "delete", "Delete API keys"),

    # Document Stores
    ("documentStores:view", "documentStores", "view", "View document stores"),
    ("documentStores:create", "documentStores", "create", "Create document stores"),
    ("documentStores:edit", "documentStores", "edit", "Edit document stores"),
    ("documentStores:delete", "documentStores", "delete", "Delete document stores"),

    # Datasets
    ("datasets:view", "datasets", "view", "View datasets"),
    ("datasets:create", "datasets", "create", "Create datasets"),
    ("datasets:update", "datasets", "update", "Update datasets"),
    ("datasets:delete", "datasets", "delete", "Delete datasets"),

    # Evaluators
    ("evaluators:view", "evaluators", "view", "View evaluators"),
    ("evaluators:create", "evaluators", "create", "Create evaluators"),
    ("evaluators:update", "evaluators", "update", "Update evaluators"),
    ("evaluators:delete", "evaluators", "delete", "Delete evaluators"),

    # Evaluations
    ("evaluations:view", "evaluations", "view", "View evaluations"),
    ("evaluations:create", "evaluations", "create", "Create evaluations"),
    ("evaluations:update", "evaluations", "update", "Update evaluations"),
    ("evaluations:delete", "evaluations", "delete", "Delete evaluations"),

    # Logs
    ("logs:view", "logs", "view", "View system logs"),

    # Workspace
    ("workspace:view", "workspace", "view", "View workspaces"),
    ("workspace:create", "workspace", "create", "Create workspaces"),
    ("workspace:update", "workspace", "update", "Update workspaces"),
    ("workspace:delete", "workspace", "delete", "Delete workspaces"),
    ("workspace:add-user", "workspace", "add-user", "Add users to workspace"),
    ("workspace:unlink-user", "workspace", "unlink-user", "Remove users from workspace"),
    ("workspace:export", "workspace", "export", "Export workspace"),
    ("workspace:import", "workspace", "import", "Import workspace"),
]

def init_permissions(db: Session):
    """Create default permissions if they don't exist."""
    for name, resource, action, description in DEFAULT_PERMISSIONS:
        # Check if permission already exists
        existing = db.query(Permission).filter(Permission.name == name).one_or_none()
        if not existing:
            permission = Permission(
                id=str(uuid4()),
                name=name,
                resource=resource,
                action=action,
                description=description
            )
            db.add(permission)
    db.commit()
    print(f"✓ Initialized {len(DEFAULT_PERMISSIONS)} permissions")


def init_system_roles(db: Session):
    """Create default system roles for each tenant."""
    # Get all tenants
    tenants = db.query(Tenant).all()

    for tenant in tenants:
        # Check if roles already exist for this tenant
        existing_roles = db.query(Role).filter(Role.tenant_id == tenant.id).all()
        if existing_roles:
            print(f"  Roles already exist for tenant {tenant.id}, skipping...")
            continue

        # Get all permissions
        all_permissions = db.query(Permission).all()
        permission_map = {p.name: p.id for p in all_permissions}

        # Define role permission sets
        admin_permissions = [p.id for p in all_permissions]  # All permissions
        editor_permissions = [
            permission_map.get(p) for p in [
                'flows:view', 'flows:create', 'flows:edit', 'flows:delete',
                'flows:execute', 'flows:export', 'flows:import', 'flows:duplicate',
                'agentflows:view', 'agentflows:create', 'agentflows:edit', 'agentflows:delete',
                'executions:view',
                'assistants:view', 'assistants:create', 'assistants:edit', 'assistants:delete',
                'templates:marketplace', 'templates:custom', 'templates:custom-share',
                'tools:view', 'tools:create', 'tools:edit', 'tools:delete',
                'credentials:view', 'credentials:create', 'credentials:edit', 'credentials:share', 'credentials:delete',
                'variables:view', 'variables:create', 'variables:update', 'variables:delete',
                'apikeys:view', 'apikeys:create', 'apikeys:update', 'apikeys:delete',
                'documentStores:view', 'documentStores:create', 'documentStores:edit', 'documentStores:delete',
                'datasets:view', 'datasets:create', 'datasets:update', 'datasets:delete',
                'evaluators:view', 'evaluators:create', 'evaluators:update', 'evaluators:delete',
                'evaluations:view', 'evaluations:create', 'evaluations:update', 'evaluations:delete',
                'logs:view',
                'workspace:view', 'workspace:create', 'workspace:update', 'workspace:add-user', 'workspace:unlink-user', 'workspace:export', 'workspace:import'
            ]
            if permission_map.get(p)
        ]
        viewer_permissions = [
            permission_map.get(p) for p in [
                'flows:view',
                'agentflows:view',
                'executions:view',
                'assistants:view',
                'templates:marketplace',
                'tools:view',
                'credentials:view',
                'variables:view',
                'apikeys:view',
                'documentStores:view',
                'datasets:view',
                'evaluators:view',
                'evaluations:view',
                'logs:view',
                'workspace:view'
            ]
            if permission_map.get(p)
        ]

        # Create roles
        roles = [
            ("admin", "Administrator - Full access to all features", admin_permissions),
            ("editor", "Editor - Can create and edit flows, documents, etc.", editor_permissions),
            ("viewer", "Viewer - Read-only access", viewer_permissions),
        ]

        for role_name, description, permission_ids in roles:
            role = Role(
                id=str(uuid4()),
                tenant_id=tenant.id,
                name=role_name,
                description=description,
                is_custom=False,
                is_system=True
            )
            db.add(role)
            db.flush()  # Flush to get the role id

            # Add permissions to role
            for permission_id in permission_ids:
                if permission_id:  # Skip None values
                    role_permission = RolePermission(
                        id=str(uuid4()),
                        role_id=role.id,
                        permission_id=permission_id
                    )
                    db.add(role_permission)

        db.commit()
        print(f"✓ Initialized 3 system roles for tenant {tenant.id}")


def main():
    """Initialize all permissions and system roles."""
    print("Initializing permissions and system roles...")

    # Create all tables first
    Base.metadata.create_all(bind=engine)

    db = next(get_db())
    try:
        init_permissions(db)
        init_system_roles(db)
        print("\n✓ Permissions and roles initialized successfully!")
    except Exception as e:
        print(f"\n✗ Error initializing permissions: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
