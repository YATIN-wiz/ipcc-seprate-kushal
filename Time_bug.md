# Part 1: Exam Time 5-Hour Bug Fix
Root Cause: Timezone conversion error in teacher.html at line 1708-1716

The function datetimeLocalToUTC() subtracts the timezone offset when it should add it:

// CURRENT (WRONG): line 1714
const utcTime = new Date(dt.getTime() - offset); // SUBTRACT offset

// SHOULD BE: ADD offset
const utcTime = new Date(dt.getTime() + offset); // ADD offset
Additionally, there's a second issue when displaying times back. The student.html fmt() function also needs correction.

Part 2: Unified RBAC Implementation
#	Task	Files Affected
1.1	Fix timezone conversion bug in datetimeLocalToUTC()	frontend/teacher.html:1714
1.2	Fix timezone parsing in teacher.py parse_dt()	backend/routers/teacher.py:22-28
1.3	Fix timezone handling in exam status display	frontend/student.html:1587-1589
2.1	Create unified auth dependency file	backend/dependencies/auth.py (new)
2.2	Create permissions system	backend/permissions.py (new)
2.3	Refactor student.py to use unified auth	backend/routers/student.py
2.4	Refactor teacher.py to use unified auth	backend/routers/teacher.py
2.5	Update admin_erp.py with permission checks	backend/routers/admin_erp.py
2.6	Remove duplicate role guards	backend/routers/erp_auth.py


Detailed Fix Steps

Bug Fix: Timezone (Priority - High)
Step	File	Change
1	teacher.html:1714	Change - offset to + offset
2	teacher.html add helper	Add isoToLocal() to convert UTC back for editing
3	teacher.html:2286-2287	Use isoToLocal() when loading exam for edit
4	student.html:1587-1589	Fix fmt() to apply timezone offset
5	teacher.py:22-28	Verify parse_dt() handles offset correctly
6	Also need to check: admin.html:1518 for consistency

## RBAC Implementation (Medium Priority)
File: backend/dependencies/auth.py (new)

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
import jwt
from pydantic import BaseModel
from typing import Optional, Union
from uuid import UUID

bearer = HTTPBearer(auto_error=False)

class CurrentUser(BaseModel):
    id: UUID
    name: str
    email: str
    role: str  # "student" | "teacher" | "admin"
    role_data: Optional[dict] = None

async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
) -> CurrentUser:
    """Unified auth - validates JWT and returns user context"""
    if not credentials:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    try:
        payload = jwt.decode(
            credentials.credentials, 
            ERP_JWT_SECRET, 
            algorithms=["HS256"]
        )
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")
    
    return CurrentUser(
        id=payload["sub"],
        name=payload.get("name", ""),
        email=payload.get("email", ""),
        role=payload.get("role", ""),
    )

def require_role(expected: str):
    """Decorator-like dependency for role checking"""
    async def role_checker(user: CurrentUser = Depends(get_current_user)):
        if user.role != expected:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Requires {expected} role"
            )
        return user
    return role_checker

# File: backend/permissions.py (new)

from enum import Enum
from functools import wraps
from typing import Callable

class Permission(Enum):
    # Admin permissions
    MANAGE_USERS = "manage_users"
    MANAGE_EXAMS = "manage_exams"
    VIEW_PROCTORING = "view_proctoring"
    MANAGE_COURSES = "manage_courses"
    # Teacher permissions  
    CREATE_EXAM = "create_exam"
    ADD_QUESTION = "add_question"
    EVALUATE = "evaluate"
    # Student permissions
    VIEW_COURSES = "view_courses"
    TAKE_EXAM = "take_exam"
    VIEW_RESULTS = "view_results"

# Map admin permission flags to Permission enum
ADMIN_PERMISSION_MAP = {
    "can_manage_users": Permission.MANAGE_USERS,
    "can_manage_exams": Permission.MANAGE_EXAMS,
    "can_view_proctoring": Permission.VIEW_PROCTORING,
    "can_manage_courses": Permission.MANAGE_COURSES,
}

async def check_permission(user, permission: Permission, db_pool) -> bool:
    """Check if user has the given permission"""
    if user.role == "admin":
        # Query admin permissions from DB
        async with db_pool.acquire() as conn:
            perm = await conn.fetchrow(
                """SELECT can_manage_users, can_manage_exams, 
                   can_view_proctoring, can_manage_courses
                   FROM erp_admins WHERE id = $1""",
                user.id
            )
            if perm:
                flag = ADMIN_PERMISSION_MAP.get(permission.value)
                return perm.get(flag, False) if flag else False
    elif user.role == "teacher":
        # Teachers have all teacher permissions by default
        teacher_perms = [Permission.CREATE_EXAM, Permission.ADD_QUESTION, Permission.EVALUATE]
        return permission in teacher_perms
    elif user.role == "student":
        student_perms = [Permission.VIEW_COURSES, Permission.TAKE_EXAM, Permission.VIEW_RESULTS]
        return permission in student_perms
    return False