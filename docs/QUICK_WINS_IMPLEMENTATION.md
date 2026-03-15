# User Management - Quick Wins Implementation Guide

**Status:** Ready to Start
**Timeline:** 1-2 days
**Effort:** 24-30 hours
**Value:** High - Immediate user satisfaction

---

## 🎯 Quick Win #1: Resend Invitation Button
**Time:** 2 hours | **Value:** 9/10 | **Difficulty:** Easy

### Problem
Invited users lose their invitation email and have no way to get it again.

### Solution
Add "Resend Invite" button to users table for pending users.

### Implementation

**Backend (30 min)**
```python
# backend/users.py - Add new endpoint

@router.post("/users/{user_id}/resend-invitation")
def resend_invitation(
    user_id: str,
    user: Annotated[dict, Depends(require_roles("admin"))],
    db: Session = Depends(get_db)
) -> dict:
    """Resend invitation email to pending user."""
    tenant_id = user.get("tenant_id")
    actor_user_id = user.get("user_id")
    actor_email = user.get("sub")

    # Fetch user
    target_user = db.query(User).filter(
        User.id == user_id,
        User.tenant_id == tenant_id
    ).one_or_none()

    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")

    # Check if user is in pending state (no password)
    if target_user.password_hash:
        raise HTTPException(status_code=400, detail="User already activated")

    # Send invitation email (use existing email service)
    # send_invitation_email(target_user.email, tenant_id)

    # Write audit log
    _write_audit_log(
        db, tenant_id, actor_user_id, actor_email,
        "user.invitation_resent", "user",
        resource_id=user_id,
        details={"email": target_user.email}
    )

    return {"status": "ok", "message": "Invitation email sent"}
```

**Frontend (1.5 hours)**

```jsx
// frontend/ui/src/views/users/index.jsx

// In ShowUserRow component, modify the action buttons:

<StyledTableCell>
    {props.row.status && props.row.status.toUpperCase() === 'INVITED' && (
        <>
            <PermissionIconButton
                permissionId={'workspace:add-user,users:manage'}
                title='Resend Invitation'
                color='primary'
                onClick={() => props.onResendClick(props.row)}
            >
                <IconMail />  {/* Add this icon import */}
            </PermissionIconButton>
            <PermissionIconButton
                permissionId={'workspace:add-user,users:manage'}
                title='Edit'
                color='primary'
                onClick={() => props.onEditClick(props.row)}
            >
                <IconEdit />
            </PermissionIconButton>
        </>
    )}
    {/* ... rest of buttons */}
</StyledTableCell>

// In Users component, add handler:

const resendInvitation = async (user) => {
    try {
        setDeletingUserId(user.id) // Reuse for loading state
        const response = await fetch(`/api/users/${user.id}/resend-invitation`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        })

        if (response.ok) {
            enqueueSnackbar({
                message: `Invitation resent to ${user.email}`,
                options: {
                    variant: 'success',
                    key: new Date().getTime() + Math.random()
                }
            })
        }
    } catch (error) {
        enqueueSnackbar({
            message: `Failed to resend invitation: ${error.message}`,
            options: {
                variant: 'error',
                persist: true
            }
        })
    } finally {
        setDeletingUserId(null)
    }
}

// Update ShowUserRow to pass handler:
<ShowUserRow
    key={index}
    row={item}
    onResendClick={resendInvitation}
    onDeleteClick={deleteUser}
    onEditClick={edit}
    deletingUserId={deletingUserId}
/>
```

**Add Icon Import:**
```jsx
import { IconTrash, IconEdit, IconX, IconPlus, IconUser, IconMail } from '@tabler/icons-react'
```

---

## 🎯 Quick Win #2: User Search Sorting
**Time:** 3 hours | **Value:** 8/10 | **Difficulty:** Easy

### Problem
Users can't sort user list by email, role, login time, etc.

### Solution
Add sortable column headers and persist preferences.

### Implementation

**Frontend (3 hours)**

```jsx
// frontend/ui/src/views/users/index.jsx

const Users = () => {
    // ... existing state ...
    const [sortBy, setSortBy] = useState('email') // Default sort
    const [sortOrder, setSortOrder] = useState('asc')

    // Load from localStorage
    useEffect(() => {
        const saved = localStorage.getItem('users_sort')
        if (saved) {
            const { sortBy, sortOrder } = JSON.parse(saved)
            setSortBy(sortBy)
            setSortOrder(sortOrder)
        }
    }, [])

    const handleSort = (column) => {
        let newOrder = 'asc'
        if (sortBy === column && sortOrder === 'asc') {
            newOrder = 'desc'
        }
        setSortBy(column)
        setSortOrder(newOrder)
        localStorage.setItem('users_sort', JSON.stringify({ sortBy: column, sortOrder: newOrder }))
    }

    const sortUsers = (users) => {
        return users.sort((a, b) => {
            let aVal, bVal

            switch (sortBy) {
                case 'email':
                    aVal = a.user.email
                    bVal = b.user.email
                    break
                case 'role':
                    aVal = a.role?.name || ''
                    bVal = b.role?.name || ''
                    break
                case 'status':
                    aVal = a.status || ''
                    bVal = b.status || ''
                    break
                case 'lastLogin':
                    aVal = a.lastLogin ? new Date(a.lastLogin).getTime() : 0
                    bVal = b.lastLogin ? new Date(b.lastLogin).getTime() : 0
                    break
                case 'createdAt':
                    aVal = a.createdDate ? new Date(a.createdDate).getTime() : 0
                    bVal = b.createdDate ? new Date(b.createdDate).getTime() : 0
                    break
                default:
                    return 0
            }

            if (typeof aVal === 'string') {
                aVal = aVal.toLowerCase()
                bVal = bVal.toLowerCase()
            }

            if (sortOrder === 'asc') {
                return aVal > bVal ? 1 : -1
            } else {
                return aVal < bVal ? 1 : -1
            }
        })
    }

    const SortableTableCell = ({ column, label }) => (
        <StyledTableCell
            sx={{ cursor: 'pointer', userSelect: 'none' }}
            onClick={() => handleSort(column)}
        >
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                {label}
                {sortBy === column && (
                    sortOrder === 'asc' ? <IconArrowUp size={16} /> : <IconArrowDown size={16} />
                )}
            </div>
        </StyledTableCell>
    )

    // In render, replace table headers:
    <TableRow>
        <StyledTableCell>&nbsp;</StyledTableCell>
        <SortableTableCell column="email" label="Email/Name" />
        <SortableTableCell column="role" label="Role" />
        <SortableTableCell column="status" label="Status" />
        <SortableTableCell column="lastLogin" label="Last Login" />
        <StyledTableCell> </StyledTableCell>
    </TableRow>

    // In render, use sorted users:
    {sortUsers(users.filter(filterUsers)).map((item, index) => (
        <ShowUserRow key={index} {...} />
    ))}
}
```

**Add Icon Imports:**
```jsx
import { IconArrowUp, IconArrowDown } from '@tabler/icons-react'
```

---

## 🎯 Quick Win #3: Status Badges Enhancement
**Time:** 2 hours | **Value:** 7/10 | **Difficulty:** Very Easy

### Problem
Status badges are plain text, not visually clear.

### Solution
Enhance badges with icons and better styling.

### Implementation

```jsx
// frontend/ui/src/views/users/index.jsx

const StatusBadge = ({ status }) => {
    switch (status?.toUpperCase()) {
        case 'ACTIVE':
            return (
                <Chip
                    icon={<IconCheck size={16} />}
                    label="ACTIVE"
                    color="success"
                    variant="outlined"
                    size="small"
                />
            )
        case 'PENDING':
            return (
                <Chip
                    icon={<IconClock size={16} />}
                    label="PENDING"
                    color="warning"
                    variant="outlined"
                    size="small"
                />
            )
        case 'INACTIVE':
            return (
                <Chip
                    icon={<IconX size={16} />}
                    label="INACTIVE"
                    color="error"
                    variant="outlined"
                    size="small"
                />
            )
        default:
            return null
    }
}

// In ShowUserRow:
<StyledTableCell>
    <StatusBadge status={props.row.status} />
</StyledTableCell>
```

**Add Icon Imports:**
```jsx
import { IconCheck, IconClock, IconX } from '@tabler/icons-react'
```

---

## 🎯 Quick Win #4: User Export to CSV
**Time:** 4 hours | **Value:** 8/10 | **Difficulty:** Medium

### Implementation

**Backend (1 hour)**
```python
# backend/users.py

import csv
from io import StringIO
from fastapi import FileResponse

@router.get("/users/export/csv")
def export_users_csv(
    user: Annotated[dict, Depends(require_roles("admin"))],
    db: Session = Depends(get_db)
):
    """Export all users as CSV file."""
    tenant_id = user.get("tenant_id")

    users = db.query(User).filter(User.tenant_id == tenant_id).all()

    # Create CSV
    output = StringIO()
    writer = csv.writer(output)
    writer.writerow(['Email', 'Role', 'Status', 'Last Login', 'Created Date'])

    for u in users:
        status = "active" if u.password_hash else "pending"
        last_login = u.last_login.isoformat() if u.last_login else "Never"
        created_at = u.created_at.isoformat() if u.created_at else ""

        writer.writerow([u.email, u.role, status, last_login, created_at])

    output.seek(0)

    return FileResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=users.csv"}
    )
```

**Frontend (3 hours)**
```jsx
// In Users component, add export handler:

const exportUsers = async () => {
    try {
        const response = await fetch('/api/users/export/csv', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        })

        if (!response.ok) throw new Error('Export failed')

        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = `users-${new Date().toISOString().split('T')[0]}.csv`
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        window.URL.revokeObjectURL(url)

        enqueueSnackbar({
            message: 'Users exported successfully',
            options: { variant: 'success' }
        })
    } catch (error) {
        enqueueSnackbar({
            message: `Export failed: ${error.message}`,
            options: { variant: 'error' }
        })
    }
}

// Add export button to ViewHeader:
<StyledPermissionButton
    permissionId={'users:manage'}
    variant='outlined'
    onClick={exportUsers}
    startIcon={<IconDownload />}
>
    Export CSV
</StyledPermissionButton>
```

---

## 🎯 Quick Win #5: Activity Log Expansion
**Time:** 4 hours | **Value:** 9/10 | **Difficulty:** Medium

### Problem
Activity only tracks login, not critical changes.

### Solution
Expand audit logging to include role changes, deletions, group assignments.

### Implementation

**Backend (2 hours)**

Already done in Phase 1! Just ensure audit logs are created for:
- ✅ user.invited (done)
- ✅ user.role_changed (done)
- ✅ user.deleted (done)
- Add: user.password_reset
- Add: user.session_started
- Add: user.session_ended

```python
# Ensure these are logged:

# In password reset:
_write_audit_log(db, tenant_id, actor_user_id, actor_email,
    "user.password_reset", "user", resource_id=user_id,
    details={"email": target_user.email})

# In login:
_write_audit_log(db, tenant_id, user_id, user_email,
    "user.login", "user", resource_id=user_id,
    details={"ip": request.client.host, "user_agent": request.headers.get("user-agent")})
```

**Frontend (2 hours)**

```jsx
// Create new page: frontend/ui/src/views/audit/index.jsx

const AuditLog = () => {
    const [logs, setLogs] = useState([])
    const [filters, setFilters] = useState({
        action: '',
        user: '',
        dateFrom: null,
        dateTo: null
    })

    const fetchLogs = async () => {
        const query = new URLSearchParams({
            ...filters,
            limit: 100
        })

        const response = await fetch(`/api/audit?${query}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        })

        const data = await response.json()
        setLogs(data.data)
    }

    useEffect(() => {
        fetchLogs()
    }, [filters])

    return (
        <MainCard>
            <Stack gap={2}>
                <ViewHeader title="Audit Log" />

                {/* Filters */}
                <Grid container spacing={2}>
                    <Grid item xs={12} sm={6} md={3}>
                        <TextField
                            label="Action"
                            value={filters.action}
                            onChange={(e) => setFilters({...filters, action: e.target.value})}
                            fullWidth
                            size="small"
                        />
                    </Grid>
                    {/* More filters */}
                </Grid>

                {/* Table */}
                <TableContainer>
                    <Table>
                        <TableHead>
                            <TableRow>
                                <TableCell>Timestamp</TableCell>
                                <TableCell>Action</TableCell>
                                <TableCell>User</TableCell>
                                <TableCell>Resource</TableCell>
                                <TableCell>Details</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {logs.map((log) => (
                                <TableRow key={log.id}>
                                    <TableCell>{moment(log.created_at).format('DD/MM/YYYY HH:mm')}</TableCell>
                                    <TableCell><Chip label={log.action} /></TableCell>
                                    <TableCell>{log.actor_email}</TableCell>
                                    <TableCell>{log.resource_type}: {log.resource_id}</TableCell>
                                    <TableCell>{JSON.stringify(log.details)}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </TableContainer>
            </Stack>
        </MainCard>
    )
}
```

---

## 🎯 Quick Win #6: Last Login Fix
**Time:** 2 hours | **Value:** 6/10 | **Difficulty:** Easy

### Problem
Last login not updating on every login.

### Solution
Update last_login timestamp on successful authentication.

### Implementation

```python
# backend/auth.py - In login endpoint:

@router.post("/auth/login")
async def login(payload: LoginRequest, db: Session = Depends(get_db)):
    # ... existing auth logic ...

    # After successful auth, update last_login
    if user:
        user.last_login = datetime.now(timezone.utc)
        db.commit()

    # Return token
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {...}
    }
```

---

## 🎯 Quick Win #7: Invite Customization
**Time:** 3 hours | **Value:** 7/10 | **Difficulty:** Medium

### Problem
Invitation emails are generic, no way to customize message.

### Solution
Add custom message field to invitation dialog.

### Implementation

```jsx
// frontend/ui/src/ui-component/dialog/InviteUsersDialog.jsx

// Add state:
const [customMessage, setCustomMessage] = useState('')

// In DialogContent, add field:
<Box>
    <Typography>Custom Invitation Message (Optional)</Typography>
    <TextField
        multiline
        rows={3}
        placeholder="Add a personalized message to the invitation email..."
        value={customMessage}
        onChange={(e) => setCustomMessage(e.target.value)}
        fullWidth
        sx={{ mt: 1 }}
    />
    <Typography variant="caption" color="text.secondary">
        Leave empty to use default message
    </Typography>
</Box>

// In saveInvite, pass custom message:
const saveObj = {
    user: { email: item.email },
    workspace: { id: selectedWorkspace.id },
    role: { id: selectedRole.id },
    customMessage: customMessage
}
```

---

## 🎯 Quick Win #8: User Statistics Widget
**Time:** 2 hours | **Value:** 6/10 | **Difficulty:** Easy

### Problem
No visibility into user metrics.

### Solution
Add stats widget to users page showing total, active, pending users.

### Implementation

```jsx
// frontend/ui/src/views/users/index.jsx

const UserStats = ({ users }) => {
    const totalUsers = users.length
    const activeUsers = users.filter(u => u.status === 'active').length
    const pendingUsers = users.filter(u => u.status === 'pending').length
    const adminUsers = users.filter(u => u.role?.name === 'admin').length

    return (
        <Grid container spacing={2} sx={{ mb: 2 }}>
            <Grid item xs={12} sm={6} md={3}>
                <Card>
                    <CardContent>
                        <Typography color="textSecondary" gutterBottom>
                            Total Users
                        </Typography>
                        <Typography variant="h5">{totalUsers}</Typography>
                    </CardContent>
                </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
                <Card>
                    <CardContent>
                        <Typography color="textSecondary" gutterBottom>
                            Active
                        </Typography>
                        <Typography variant="h5" color="success.main">{activeUsers}</Typography>
                    </CardContent>
                </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
                <Card>
                    <CardContent>
                        <Typography color="textSecondary" gutterBottom>
                            Pending
                        </Typography>
                        <Typography variant="h5" color="warning.main">{pendingUsers}</Typography>
                    </CardContent>
                </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
                <Card>
                    <CardContent>
                        <Typography color="textSecondary" gutterBottom>
                            Admins
                        </Typography>
                        <Typography variant="h5">{adminUsers}</Typography>
                    </CardContent>
                </Card>
            </Grid>
        </Grid>
    )
}

// In Users component render:
{!isLoading && <UserStats users={users} />}
```

---

## 📋 Implementation Checklist

### Day 1
- [ ] Quick Win #1: Resend Invitation (2h)
- [ ] Quick Win #2: Sort Users (3h)
- [ ] Quick Win #3: Status Badges (2h)
- [ ] Quick Win #4: User Export (4h)
- **Total: 11 hours**

### Day 2
- [ ] Quick Win #5: Activity Logging (4h)
- [ ] Quick Win #6: Last Login Fix (2h)
- [ ] Quick Win #7: Invite Message (3h)
- [ ] Quick Win #8: User Stats (2h)
- [ ] Testing & Fixes (2h)
- **Total: 13 hours**

---

## 🧪 Testing Checklist

For each quick win:
- [ ] Manual testing in browser
- [ ] Mobile responsive test
- [ ] Error handling (network failure)
- [ ] Permission checks (non-admin can't see certain features)
- [ ] Edge cases (empty lists, very long names)
- [ ] Performance test (1000+ users)

---

## 🚀 Deployment Plan

1. **Test** - QA on staging
2. **Deploy** - Push to production
3. **Monitor** - Watch error rates
4. **Rollback** - Have rollback plan ready

---

**Ready to Start!** ✅

Pick your first quick win and start implementing. Each one is independent and can be deployed separately.

Recommended order:
1. Start with #6 (Last Login Fix) - 2 hours, highest reliability
2. Then #1 (Resend Invitation) - 2 hours, highest user value
3. Then #3 (Status Badges) - 2 hours, quick polish
4. Then #2 (Sorting) - 3 hours, major UX improvement
5. Then #4 (Export) - 4 hours, more complex
6. Finally #5, #7, #8

