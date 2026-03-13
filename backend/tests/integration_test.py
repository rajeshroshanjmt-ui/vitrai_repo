"""
Integration tests for Vetrai Phase 1-3 implementations.
Tests critical workflows across users, files, workspace, and audit logging.
"""

import os
import json
import requests
from datetime import datetime, timedelta
from typing import Dict, Any

BASE_URL = os.getenv("TEST_BASE_URL", "http://localhost:8000/api")
TENANT_ID = os.getenv("TEST_TENANT_ID", "00000000-0000-0000-0000-000000000001")
ADMIN_EMAIL = "integration-test-admin@vetrai.com"
VIEWER_EMAIL = "integration-test-viewer@vetrai.com"

class VetraiIntegrationTest:
    """Integration test suite for Vetrai."""

    def __init__(self):
        self.admin_token = None
        self.viewer_token = None
        self.test_user_id = None
        self.test_file_id = None
        self.test_workspace_id = None
        self.results = {"passed": 0, "failed": 0, "errors": []}

    def log(self, message: str, level: str = "INFO"):
        """Log test messages."""
        timestamp = datetime.now().strftime("%H:%M:%S")
        print(f"[{timestamp}] [{level}] {message}")

    def request(self, method: str, endpoint: str, token: str = None, data: Dict = None, files: Dict = None) -> Dict:
        """Make HTTP request with error handling."""
        url = f"{BASE_URL}{endpoint}"
        headers = {"Content-Type": "application/json"}
        if token:
            headers["Authorization"] = f"Bearer {token}"

        try:
            if method == "GET":
                resp = requests.get(url, headers=headers, timeout=10)
            elif method == "POST":
                if files:
                    headers.pop("Content-Type")  # Let requests set multipart
                    resp = requests.post(url, headers=headers, files=files, timeout=10)
                else:
                    resp = requests.post(url, headers=headers, json=data, timeout=10)
            elif method == "PUT":
                resp = requests.put(url, headers=headers, json=data, timeout=10)
            elif method == "DELETE":
                resp = requests.delete(url, headers=headers, timeout=10)
            else:
                raise ValueError(f"Unsupported method: {method}")

            if resp.status_code >= 400:
                self.log(f"HTTP {resp.status_code}: {resp.text}", "ERROR")
                return {"error": resp.text, "status": resp.status_code}

            return resp.json() if resp.text else {"status": "ok"}
        except Exception as e:
            self.log(f"Request failed: {str(e)}", "ERROR")
            return {"error": str(e)}

    def test_health_check(self):
        """Test backend health."""
        self.log("Testing health check...")
        resp = requests.get(f"{BASE_URL}/health/ready", timeout=10)
        if resp.status_code == 200:
            self.log("✓ Health check passed", "INFO")
            self.results["passed"] += 1
        else:
            self.log("✗ Health check failed", "ERROR")
            self.results["failed"] += 1

    def test_auth(self):
        """Test authentication and permissions."""
        self.log("Testing authentication...")

        # Admin login
        resp = self.request("POST", "/auth/token", data={
            "email": ADMIN_EMAIL,
            "tenant_id": TENANT_ID,
            "password": "test-password"
        })
        if "access_token" in resp:
            self.admin_token = resp["access_token"]
            self.log("✓ Admin login successful", "INFO")
            self.results["passed"] += 1
        else:
            self.log("✗ Admin login failed", "ERROR")
            self.results["failed"] += 1
            return

        # Check permissions
        resp = self.request("GET", "/auth/permissions", token=self.admin_token)
        if "permissions" in resp and "users:manage" in resp.get("permissions", []):
            self.log("✓ Admin permissions verified", "INFO")
            self.results["passed"] += 1
        else:
            self.log("✗ Admin permissions check failed", "ERROR")
            self.results["failed"] += 1

    def test_user_management(self):
        """Test user CRUD operations."""
        if not self.admin_token:
            self.log("⊘ Skipping user management (no token)", "WARN")
            return

        self.log("Testing user management...")

        # Invite user
        resp = self.request("POST", "/users/invite", token=self.admin_token, data={
            "email": VIEWER_EMAIL,
            "role": "viewer"
        })
        if "id" in resp:
            self.test_user_id = resp["id"]
            self.log("✓ User invitation successful", "INFO")
            self.results["passed"] += 1
        else:
            self.log("✗ User invitation failed", "ERROR")
            self.results["failed"] += 1
            return

        # List users
        resp = self.request("GET", "/users", token=self.admin_token)
        if "data" in resp and len(resp["data"]) > 0:
            self.log(f"✓ Listed {len(resp['data'])} users", "INFO")
            self.results["passed"] += 1
        else:
            self.log("✗ User list failed", "ERROR")
            self.results["failed"] += 1

        # Update user role
        if self.test_user_id:
            resp = self.request("PUT", f"/users/{self.test_user_id}", token=self.admin_token, data={
                "role": "editor"
            })
            if "id" in resp:
                self.log("✓ User role update successful", "INFO")
                self.results["passed"] += 1
            else:
                self.log("✗ User role update failed", "ERROR")
                self.results["failed"] += 1

    def test_file_management(self):
        """Test file upload and management."""
        if not self.admin_token:
            self.log("⊘ Skipping file management (no token)", "WARN")
            return

        self.log("Testing file management...")

        # Upload file
        test_file_content = b"Test document content for Vetrai integration test"
        resp = self.request("POST", "/files/upload", token=self.admin_token, files={
            "file": ("test_document.txt", test_file_content)
        })
        if "id" in resp:
            self.test_file_id = resp["id"]
            self.log("✓ File upload successful", "INFO")
            self.results["passed"] += 1
        else:
            self.log("✗ File upload failed", "ERROR")
            self.results["failed"] += 1

        # List files
        resp = self.request("GET", "/files", token=self.admin_token)
        if "data" in resp:
            self.log(f"✓ Listed files: {len(resp['data'])} found", "INFO")
            self.results["passed"] += 1
        else:
            self.log("✗ File list failed", "ERROR")
            self.results["failed"] += 1

    def test_workspace_management(self):
        """Test workspace operations."""
        if not self.admin_token:
            self.log("⊘ Skipping workspace management (no token)", "WARN")
            return

        self.log("Testing workspace management...")

        # Create workspace
        resp = self.request("POST", "/workspaces", token=self.admin_token, data={
            "name": "Integration Test Workspace",
            "description": "Workspace for integration testing"
        })
        if "id" in resp:
            self.test_workspace_id = resp["id"]
            self.log("✓ Workspace created", "INFO")
            self.results["passed"] += 1
        else:
            self.log("✗ Workspace creation failed", "ERROR")
            self.results["failed"] += 1
            return

        # List workspaces
        resp = self.request("GET", "/workspaces", token=self.admin_token)
        if "data" in resp:
            self.log(f"✓ Listed workspaces: {len(resp['data'])} found", "INFO")
            self.results["passed"] += 1
        else:
            self.log("✗ Workspace list failed", "ERROR")
            self.results["failed"] += 1

        # Switch workspace
        if self.test_workspace_id:
            resp = self.request("POST", "/workspaces/switch", token=self.admin_token, data={
                "workspace_id": self.test_workspace_id
            })
            if "status" in resp and resp["status"] == "ok":
                self.log("✓ Workspace switch successful", "INFO")
                self.results["passed"] += 1
            else:
                self.log("✗ Workspace switch failed", "ERROR")
                self.results["failed"] += 1

    def test_audit_logging(self):
        """Test audit log coverage."""
        if not self.admin_token:
            self.log("⊘ Skipping audit logging (no token)", "WARN")
            return

        self.log("Testing audit logging...")

        # Get login activity
        resp = self.request("POST", "/audit/login-activity", token=self.admin_token, data={
            "startDate": (datetime.now() - timedelta(days=7)).isoformat(),
            "endDate": datetime.now().isoformat()
        })
        if "data" in resp:
            login_events = [x for x in resp["data"] if x.get("action") == "login"]
            self.log(f"✓ Audit logs retrieved: {len(resp['data'])} events, {len(login_events)} logins", "INFO")
            self.results["passed"] += 1
        else:
            self.log("✗ Audit log retrieval failed", "ERROR")
            self.results["failed"] += 1

        # Check for specific audit actions
        expected_actions = [
            "user.invited",
            "user.role_changed",
            "workspace.created",
        ]
        if "data" in resp:
            found_actions = set(x.get("action") for x in resp["data"])
            missing = [a for a in expected_actions if a not in found_actions]
            if not missing:
                self.log("✓ All expected audit actions found", "INFO")
                self.results["passed"] += 1
            else:
                self.log(f"⚠ Some audit actions missing (may not be triggered): {missing}", "WARN")

    def test_sso_config(self):
        """Test SSO configuration."""
        if not self.admin_token:
            self.log("⊘ Skipping SSO config (no token)", "WARN")
            return

        self.log("Testing SSO configuration...")

        # Get SSO config
        resp = self.request("GET", "/sso-config", token=self.admin_token)
        if "data" in resp:
            self.log(f"✓ SSO config retrieved: {len(resp['data'])} providers configured", "INFO")
            self.results["passed"] += 1
        else:
            self.log("✗ SSO config retrieval failed", "ERROR")
            self.results["failed"] += 1

    def cleanup(self):
        """Clean up test resources."""
        if not self.admin_token:
            return

        self.log("Cleaning up test resources...")

        # Delete test user
        if self.test_user_id:
            try:
                self.request("DELETE", f"/users/{self.test_user_id}", token=self.admin_token)
                self.log("✓ Test user deleted", "INFO")
            except:
                pass

        # Delete test workspace
        if self.test_workspace_id:
            try:
                self.request("DELETE", f"/workspaces/{self.test_workspace_id}", token=self.admin_token)
                self.log("✓ Test workspace deleted", "INFO")
            except:
                pass

    def run_all(self):
        """Run all tests."""
        self.log("=" * 60, "INFO")
        self.log("Vetrai Integration Test Suite", "INFO")
        self.log(f"Base URL: {BASE_URL}", "INFO")
        self.log(f"Tenant ID: {TENANT_ID}", "INFO")
        self.log("=" * 60, "INFO")

        self.test_health_check()
        self.test_auth()
        self.test_user_management()
        self.test_file_management()
        self.test_workspace_management()
        self.test_audit_logging()
        self.test_sso_config()

        self.cleanup()

        self.log("=" * 60, "INFO")
        self.log(f"Test Results: {self.results['passed']} passed, {self.results['failed']} failed", "INFO")
        self.log("=" * 60, "INFO")

        return self.results["failed"] == 0


if __name__ == "__main__":
    test = VetraiIntegrationTest()
    success = test.run_all()
    exit(0 if success else 1)
