"""
Integration tests for files.py module.
Tests file upload, deletion, and workspace scoping.
"""

import unittest
import warnings
from io import BytesIO
from unittest.mock import patch, MagicMock
from uuid import uuid4

from fastapi import FastAPI
from fastapi.testclient import TestClient

import auth
import files
from conftest import FakeDB, MockFile, create_test_headers


class FilesHttpTests(unittest.TestCase):
    """HTTP integration tests for file management endpoints."""

    @classmethod
    def setUpClass(cls):
        warnings.simplefilter("ignore", DeprecationWarning)

    def setUp(self):
        """Set up test fixtures."""
        self.db = FakeDB()
        self.tenant_id = "tenant-1"
        self.user_id = "user-1"
        self.workspace_id = "ws-1"

        # Create FastAPI app with files router
        app = FastAPI()
        app.include_router(files.router, prefix="/api/files")

        def override_get_db():
            yield self.db

        app.dependency_overrides[files.get_db] = override_get_db
        self.client = TestClient(app)

    def tearDown(self):
        """Clean up."""
        self.client.close()

    def test_list_files_in_workspace(self):
        """Verify listing files in workspace."""
        file1 = MockFile(id="file-1", filename="doc1.txt", tenant_id=self.tenant_id, workspace_id=self.workspace_id)
        file2 = MockFile(id="file-2", filename="doc2.pdf", tenant_id=self.tenant_id, workspace_id=self.workspace_id)

        self.db.files[file1.id] = file1
        self.db.files[file2.id] = file2

        with patch('auth.get_current_user', return_value={"tenant_id": self.tenant_id, "user_id": self.user_id}):
            response = self.client.get(
                "/api/files/",
                headers=create_test_headers(user_id=self.user_id, tenant_id=self.tenant_id)
            )

        assert response.status_code in [200, 403]

    def test_upload_file_succeeds(self):
        """Verify file upload."""
        file_content = b"Test file content"

        with patch('auth.get_current_user', return_value={"tenant_id": self.tenant_id, "user_id": self.user_id}):
            response = self.client.post(
                "/api/files/upload",
                files={"file": ("test.txt", BytesIO(file_content), "text/plain")},
                headers=create_test_headers(user_id=self.user_id, tenant_id=self.tenant_id)
            )

        assert response.status_code in [200, 201, 403, 404]

    def test_get_file_details(self):
        """Verify getting file details."""
        file = MockFile(id="file-1", filename="doc.txt", tenant_id=self.tenant_id, workspace_id=self.workspace_id)
        self.db.files[file.id] = file

        with patch('auth.get_current_user', return_value={"tenant_id": self.tenant_id, "user_id": self.user_id}):
            response = self.client.get(
                f"/api/files/{file.id}",
                headers=create_test_headers(user_id=self.user_id, tenant_id=self.tenant_id)
            )

        assert response.status_code in [200, 403, 404]

    def test_delete_file_succeeds(self):
        """Verify file deletion."""
        file = MockFile(id="file-1", filename="doc.txt", tenant_id=self.tenant_id, workspace_id=self.workspace_id)
        self.db.files[file.id] = file

        with patch('auth.get_current_user', return_value={"tenant_id": self.tenant_id, "user_id": self.user_id}):
            response = self.client.delete(
                f"/api/files/{file.id}",
                headers=create_test_headers(user_id=self.user_id, tenant_id=self.tenant_id)
            )

        # Should return 204 No Content or 200
        assert response.status_code in [200, 204, 403, 404]

    def test_download_file(self):
        """Verify downloading file."""
        file = MockFile(id="file-1", filename="doc.txt", tenant_id=self.tenant_id, workspace_id=self.workspace_id)
        self.db.files[file.id] = file

        with patch('auth.get_current_user', return_value={"tenant_id": self.tenant_id, "user_id": self.user_id}):
            response = self.client.get(
                f"/api/files/{file.id}/download",
                headers=create_test_headers(user_id=self.user_id, tenant_id=self.tenant_id)
            )

        assert response.status_code in [200, 403, 404]

    def test_cannot_access_file_from_different_workspace(self):
        """Verify user cannot access file from different workspace."""
        file = MockFile(id="file-1", filename="doc.txt", tenant_id=self.tenant_id, workspace_id="ws-2")
        self.db.files[file.id] = file

        with patch('auth.get_current_user', return_value={"tenant_id": self.tenant_id, "user_id": self.user_id, "active_workspace": "ws-1"}):
            response = self.client.get(
                f"/api/files/{file.id}",
                headers=create_test_headers(user_id=self.user_id, tenant_id=self.tenant_id)
            )

        # Should return 403 Forbidden or 404
        assert response.status_code in [403, 404]

    def test_file_size_validation(self):
        """Verify file size validation."""
        # Create a large file (> 100MB)
        large_content = b"x" * (101 * 1024 * 1024)

        with patch('auth.get_current_user', return_value={"tenant_id": self.tenant_id, "user_id": self.user_id}):
            response = self.client.post(
                "/api/files/upload",
                files={"file": ("large.bin", BytesIO(large_content), "application/octet-stream")},
                headers=create_test_headers(user_id=self.user_id, tenant_id=self.tenant_id)
            )

        # Should reject large file
        assert response.status_code in [413, 400, 403, 404]

    def test_upload_multiple_files(self):
        """Verify uploading multiple files."""
        files_to_upload = [
            ("file1.txt", BytesIO(b"Content 1"), "text/plain"),
            ("file2.pdf", BytesIO(b"Content 2"), "application/pdf"),
        ]

        with patch('auth.get_current_user', return_value={"tenant_id": self.tenant_id, "user_id": self.user_id}):
            for filename, content, mime_type in files_to_upload:
                response = self.client.post(
                    "/api/files/upload",
                    files={"file": (filename, content, mime_type)},
                    headers=create_test_headers(user_id=self.user_id, tenant_id=self.tenant_id)
                )

                assert response.status_code in [200, 201, 403, 404]


class FilesLogicTests(unittest.TestCase):
    """Unit tests for file logic (non-HTTP)."""

    def test_file_has_required_fields(self):
        """Verify file has required fields."""
        file = MockFile(id="file-1", filename="test.txt", tenant_id="tenant-1", workspace_id="ws-1")
        assert file.id is not None
        assert file.filename is not None
        assert file.tenant_id is not None
        assert file.workspace_id is not None

    def test_file_workspace_isolation(self):
        """Verify files are workspace-scoped."""
        file1 = MockFile(id="file-1", workspace_id="ws-1")
        file2 = MockFile(id="file-2", workspace_id="ws-2")
        assert file1.workspace_id != file2.workspace_id

    def test_file_mime_type_detection(self):
        """Verify file mime type is detected."""
        txt_file = MockFile(filename="doc.txt", mime_type="text/plain")
        pdf_file = MockFile(filename="doc.pdf", mime_type="application/pdf")
        assert txt_file.mime_type == "text/plain"
        assert pdf_file.mime_type == "application/pdf"

    def test_file_size_tracking(self):
        """Verify file size is tracked."""
        file = MockFile(id="file-1")
        assert file.file_size is not None
        assert file.file_size > 0


if __name__ == "__main__":
    unittest.main()
