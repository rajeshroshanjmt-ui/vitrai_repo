"""
Shared test fixtures and utilities for all test modules.
"""

import pytest
from uuid import uuid4
from datetime import datetime, timezone
from unittest.mock import MagicMock

import auth


class FakeDB:
    """Mock database for testing without real database."""

    def __init__(self):
        self.users = {}
        self.roles = {}
        self.permissions = {}
        self.workspaces = {}
        self.resources = {}
        self.files = {}
        self.user_preferences = {}
        self.role_permissions = {}
        self.added = []
        self.commits = 0
        self.deleted = []

    def add(self, obj):
        """Add object to session."""
        self.added.append(obj)
        if hasattr(obj, 'id'):
            if type(obj).__name__ == 'User':
                self.users[obj.id] = obj
            elif type(obj).__name__ == 'Role':
                self.roles[obj.id] = obj
            elif type(obj).__name__ == 'Permission':
                self.permissions[obj.id] = obj
            elif type(obj).__name__ == 'TenantResource' and hasattr(obj, 'resource_type') and obj.resource_type == 'workspace':
                self.workspaces[obj.id] = obj
            elif type(obj).__name__ == 'TenantResource':
                self.resources[obj.id] = obj
            elif type(obj).__name__ == 'File':
                self.files[obj.id] = obj
            elif type(obj).__name__ == 'UserPreference':
                self.user_preferences[obj.id] = obj

    def delete(self, obj):
        """Mark object for deletion."""
        self.deleted.append(obj)

    def commit(self):
        """Commit transaction."""
        self.commits += 1

    def rollback(self):
        """Rollback transaction."""
        self.added.clear()
        self.deleted.clear()

    def query(self, model):
        """Query model."""
        return FakeQuery(self, model)

    def get(self, model, id_value):
        """Get object by ID."""
        if model.__name__ == 'User':
            return self.users.get(id_value)
        elif model.__name__ == 'Role':
            return self.roles.get(id_value)
        elif model.__name__ == 'TenantResource':
            return self.workspaces.get(id_value) or self.resources.get(id_value)
        return None


class FakeQuery:
    """Mock query builder for database."""

    def __init__(self, db, model):
        self.db = db
        self.model = model
        self.filters = []
        self.order_bys = []
        self.offset_val = 0
        self.limit_val = None

    def filter(self, *criteria):
        """Add filter criteria."""
        self.filters.extend(criteria)
        return self

    def order_by(self, *orders):
        """Add order by."""
        self.order_bys.extend(orders)
        return self

    def offset(self, offset_val):
        """Set offset."""
        self.offset_val = offset_val
        return self

    def limit(self, limit_val):
        """Set limit."""
        self.limit_val = limit_val
        return self

    def first(self):
        """Get first result."""
        results = self.all()
        return results[0] if results else None

    def one_or_none(self):
        """Get single result or None."""
        results = self.all()
        if len(results) > 1:
            raise Exception("Multiple results found")
        return results[0] if results else None

    def all(self):
        """Get all results."""
        if self.model.__name__ == 'User':
            results = list(self.db.users.values())
        elif self.model.__name__ == 'Role':
            results = list(self.db.roles.values())
        elif self.model.__name__ == 'Permission':
            results = list(self.db.permissions.values())
        elif self.model.__name__ == 'TenantResource':
            results = list(self.db.workspaces.values()) + list(self.db.resources.values())
        elif self.model.__name__ == 'File':
            results = list(self.db.files.values())
        elif self.model.__name__ == 'UserPreference':
            results = list(self.db.user_preferences.values())
        else:
            results = []

        # Apply filters (simplified)
        for criterion in self.filters:
            # This is a simplified filter - real implementation would parse criteria
            pass

        # Apply offset/limit
        if self.offset_val > 0:
            results = results[self.offset_val:]
        if self.limit_val is not None:
            results = results[:self.limit_val]

        return results

    def count(self):
        """Get count."""
        return len(self.all())


@pytest.fixture
def db():
    """Provide a fake database for each test."""
    return FakeDB()


@pytest.fixture
def tenant_id():
    """Provide a tenant ID."""
    return str(uuid4())


@pytest.fixture
def user_id():
    """Provide a user ID."""
    return str(uuid4())


@pytest.fixture
def workspace_id():
    """Provide a workspace ID."""
    return str(uuid4())


def create_test_token(user_id="user-1", tenant_id="tenant-1", role="admin", email="user@example.com"):
    """Create a test JWT token."""
    return auth.create_token({
        "sub": email,
        "tenant_id": tenant_id,
        "user_id": user_id,
        "role": role,
    })


def create_test_headers(user_id="user-1", tenant_id="tenant-1", role="admin", email="user@example.com"):
    """Create authorization headers with test token."""
    token = create_test_token(user_id, tenant_id, role, email)
    return {"Authorization": f"Bearer {token}"}


class MockUser:
    """Mock User object."""

    def __init__(self, id=None, email=None, tenant_id=None, role="viewer", full_name="Test User", password_hash="hash", is_verified=True):
        self.id = id or str(uuid4())
        self.email = email or f"user-{self.id[:8]}@example.com"
        self.tenant_id = tenant_id or str(uuid4())
        self.role = role
        self.full_name = full_name
        self.password_hash = password_hash
        self.is_verified = is_verified
        self.created_at = datetime.now(timezone.utc)


class MockRole:
    """Mock Role object."""

    def __init__(self, id=None, name=None, tenant_id=None, is_system=False):
        self.id = id or str(uuid4())
        self.name = name or f"role-{self.id[:8]}"
        self.tenant_id = tenant_id
        self.is_system = is_system
        self.created_at = datetime.now(timezone.utc)


class MockPermission:
    """Mock Permission object."""

    def __init__(self, id=None, name=None, description=""):
        self.id = id or str(uuid4())
        self.name = name or f"perm-{self.id[:8]}"
        self.description = description
        self.created_at = datetime.now(timezone.utc)


class MockWorkspace:
    """Mock Workspace (TenantResource) object."""

    def __init__(self, id=None, name=None, tenant_id=None):
        self.id = id or str(uuid4())
        self.name = name or f"workspace-{self.id[:8]}"
        self.tenant_id = tenant_id or str(uuid4())
        self.resource_type = "workspace"
        self.payload = {"description": "Test workspace"}
        self.created_at = datetime.now(timezone.utc)


class MockResource:
    """Mock Resource (TenantResource) object."""

    def __init__(self, id=None, resource_type="credential", tenant_id=None, workspace_id=None, name=None):
        self.id = id or str(uuid4())
        self.resource_type = resource_type
        self.tenant_id = tenant_id or str(uuid4())
        self.workspace_id = workspace_id or str(uuid4())
        self.name = name or f"resource-{self.id[:8]}"
        self.payload = {"value": "test_value"}
        self.created_at = datetime.now(timezone.utc)


class MockFile:
    """Mock File object."""

    def __init__(self, id=None, filename=None, tenant_id=None, workspace_id=None):
        self.id = id or str(uuid4())
        self.filename = filename or f"file-{self.id[:8]}.txt"
        self.tenant_id = tenant_id or str(uuid4())
        self.workspace_id = workspace_id or str(uuid4())
        self.file_size = 1024
        self.mime_type = "text/plain"
        self.created_at = datetime.now(timezone.utc)


class MockUserPreference:
    """Mock UserPreference object."""

    def __init__(self, id=None, user_id=None, tenant_id=None, active_workspace=None):
        self.id = id or str(uuid4())
        self.user_id = user_id or str(uuid4())
        self.tenant_id = tenant_id or str(uuid4())
        self.active_workspace = active_workspace
        self.created_at = datetime.now(timezone.utc)
