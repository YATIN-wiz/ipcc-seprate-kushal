import jwt
import time

# Same secret from your backend config
ERP_JWT_SECRET = "shared-secret-with-java-erp"

# Generate token for the exam shown in your screenshot
student_id = "student123"
exam_code = "CS101"
student_name = "Demo Student"

payload = {
    "sub": student_id,
    "name": student_name,
    "exam_code": exam_code,
    "exp": int(time.time()) + 3600  # Expires in 1 hour
}

token = jwt.encode(payload, ERP_JWT_SECRET, algorithm="HS256")

print("=" * 80)
print("✅ VALID ERP TOKEN GENERATED")
print("=" * 80)
print(f"\nStudent ID: {student_id}")
print(f"Exam Code: {exam_code}")
print(f"Expires in: 1 hour")
print(f"\n🔐 TOKEN:\n")
print(token)
print("\n" + "=" * 80)
print("👉 Copy the token above and paste it into the 'Paste ERP Token' field")
print("=" * 80)
