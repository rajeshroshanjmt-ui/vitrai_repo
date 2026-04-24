import logging
import os
from pathlib import Path
from typing import Annotated
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from auth import get_current_user, _write_audit_log
from database import get_db
from models import TenantResource

router = APIRouter()
logger = logging.getLogger(__name__)

# Get uploads base directory
UPLOADS_BASE_DIR = os.getenv("UPLOADS_DIR", "./uploads")
os.makedirs(UPLOADS_BASE_DIR, exist_ok=True)


class FileMetadata(BaseModel):
    id: str
    name: str
    path: str
    size: int
    mimeType: str
    createdDate: str

    class Config:
        from_attributes = True


class FilesListResponse(BaseModel):
    data: list[FileMetadata]
    total: int


def _ensure_tenant_upload_dir(tenant_id: str) -> Path:
    """Create uploads directory for tenant if it doesn't exist."""
    tenant_dir = Path(UPLOADS_BASE_DIR) / tenant_id
    tenant_dir.mkdir(parents=True, exist_ok=True)
    return tenant_dir


@router.get("/files", response_model=FilesListResponse)
def list_files(
    user: Annotated[dict, Depends(get_current_user)],
    db: Session = Depends(get_db),
    skip: int = 0,
    limit: int = 100
) -> FilesListResponse:
    """List all uploaded files for the tenant."""
    tenant_id = user.get("tenant_id")

    # Query TenantResource for uploaded_file resources
    resources = (
        db.query(TenantResource)
        .filter(
            TenantResource.tenant_id == tenant_id,
            TenantResource.resource_type == "uploaded_file"
        )
        .offset(skip)
        .limit(limit)
        .all()
    )
    total = (
        db.query(TenantResource)
        .filter(
            TenantResource.tenant_id == tenant_id,
            TenantResource.resource_type == "uploaded_file"
        )
        .count()
    )

    files = []
    for resource in resources:
        payload = resource.payload or {}
        files.append(
            FileMetadata(
                id=resource.id,
                name=resource.name,
                path=payload.get("path", ""),
                size=payload.get("size", 0),
                mimeType=payload.get("mimeType", ""),
                createdDate=resource.created_at.isoformat() if resource.created_at else None
            )
        )

    return FilesListResponse(data=files, total=total)


@router.post("/files/upload")
async def upload_file(
    user: Annotated[dict, Depends(get_current_user)],
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
) -> dict:
    """Upload a file to the tenant's upload directory."""
    tenant_id = user.get("tenant_id")
    actor_user_id = user.get("user_id")
    actor_email = user.get("sub")

    # Create tenant-specific upload directory
    tenant_dir = _ensure_tenant_upload_dir(tenant_id)

    # Read file content
    try:
        contents = await file.read()
        file_size = len(contents)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to read file: {str(e)}")

    # Generate unique filename
    file_id = str(uuid4())
    file_ext = Path(file.filename).suffix if file.filename else ""
    safe_filename = f"{file_id}{file_ext}"
    file_path = tenant_dir / safe_filename

    # Write file to disk
    try:
        with open(file_path, "wb") as f:
            f.write(contents)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save file: {str(e)}")

    # Store metadata in TenantResource
    resource = TenantResource(
        id=file_id,
        tenant_id=tenant_id,
        resource_type="uploaded_file",
        name=file.filename or "uploaded_file",
        payload={
            "path": str(file_path),
            "size": file_size,
            "mimeType": file.content_type or "application/octet-stream",
            "originalFilename": file.filename
        },
        created_by=actor_user_id,
        updated_by=actor_user_id
    )
    db.add(resource)

    # Write audit log
    _write_audit_log(
        db, tenant_id, actor_user_id, actor_email, "file.uploaded", "file",
        resource_id=file_id, details={"filename": file.filename, "size": file_size}
    )
    db.commit()

    return {
        "id": file_id,
        "name": file.filename,
        "path": str(file_path),
        "size": file_size,
        "mimeType": file.content_type or "application/octet-stream",
        "createdDate": resource.created_at.isoformat()
    }


@router.delete("/files")
def delete_file(
    user: Annotated[dict, Depends(get_current_user)],
    path: Annotated[str, Query(...)],
    db: Session = Depends(get_db)
) -> dict:
    """Delete an uploaded file by path."""
    tenant_id = user.get("tenant_id")
    actor_user_id = user.get("user_id")
    actor_email = user.get("sub")

    # Validate path is within tenant's upload directory
    tenant_dir = _ensure_tenant_upload_dir(tenant_id)
    file_path = Path(path)

    try:
        # Ensure the path is within the tenant directory for security
        file_path.resolve().relative_to(tenant_dir.resolve())
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid file path")

    # Find and delete the resource from database
    resource = (
        db.query(TenantResource)
        .filter(
            TenantResource.tenant_id == tenant_id,
            TenantResource.resource_type == "uploaded_file",
            TenantResource.payload["path"].astext == path
        )
        .one_or_none()
    )

    if resource is None:
        raise HTTPException(status_code=404, detail="File not found")

    # Delete file from disk
    if file_path.exists():
        try:
            file_path.unlink()
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to delete file: {str(e)}")

    # Delete resource from database
    db.delete(resource)

    # Write audit log
    _write_audit_log(
        db, tenant_id, actor_user_id, actor_email, "file.deleted", "file",
        resource_id=resource.id, details={"filename": resource.name, "path": path}
    )
    db.commit()

    return {"status": "ok", "message": "File deleted"}
