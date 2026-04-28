# RBAC Implementation Plan
Current State
Single erp_users table with role enum ('student', 'teacher', 'admin')
Single login (POST /erp/login) already issues JWT with role claim
Duplicate role guards in 4 files: erp_auth.py, student.py, teacher.py, admin_erp.py
Permission flags exist in erp_admins table but not enforced
## Implementation Steps
1. Create Unified Auth Dependencies (backend/dependencies/auth.py)
# Single dependency returning user context with role info
class CurrentUser:
    id: UUID
    name: str
    email: str
    role: str  # "student" | "teacher" | "admin"
    role_data: dict  # role-specific fields

# Unified guard - validates JWT and returns CurrentUser
async def get_current_user(credentials = Depends(...)) -> CurrentUser


2. Add Role-Based Permissions System (backend/permissions.py)
# Permission definitions matching existing admin flags
Permission = Enum("Permission", [
    "manage_users",
    "manage_exams", 
    "view_proctoring",
    "manage_courses",
    "create_exam",
    "evaluate_submission",
    # Add for student/teacher as needed
])


# Check permission: async def require_permission(user: CurrentUser, perm: Permission)
3. Refactor Role Guards to Use Unified System
File	Change
student.py	Replace get_current_student() with get_current_user() + @require_role("student")
teacher.py	Replace get_current_teacher() with get_current_user() + @require_role("teacher")
admin_erp.py	Replace get_current_admin() + add permission checks for each endpoint

4. Add Granular Permission Checks to Admin Endpoints
Update protected admin endpoints to check specific permissions:

GET /admin/users → requires manage_users
POST /admin/courses → requires manage_courses
GET /admin/exams, POST /admin/exams → requires manage_exams
GET /admin/sessions → requires view_proctoring


5. Optional: Role-Specific Permissions
Add similar permission enums for students/Teachers if needed:

Student: view_courses, take_exam, view_results
Teacher: create_exam, add_question, evaluate