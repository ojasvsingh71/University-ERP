/**
 * MODULE: User Management
 * GET  /api/users   -> list users (Super Admin only)
 * POST /api/users   -> create a user account (Super Admin only) — FR-IAM-03
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { users } from "@/db/schema";
import { requirePermission, ForbiddenError } from "@/lib/rbac";
import { hashPassword } from "@/lib/password";
import { recordAudit } from "@/lib/audit";

const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  fullName: z.string().min(1).max(255),
  role: z.enum([
    "super_admin",
    "university_admin",
    "registrar",
    "department_admin",
    "hod",
    "examination_controller",
    "faculty",
    "student",
    "parent",
    "auditor",
  ]),
});

export async function GET() {
  const session = await auth();
  try {
    requirePermission(session, "manage_users");
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: e.message }, { status: 403 });
    throw e;
  }

  const rows = await db
    .select({ id: users.id, email: users.email, fullName: users.fullName, role: users.role, status: users.status })
    .from(users);

  return NextResponse.json({ users: rows });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  try {
    requirePermission(session, "manage_users");
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: e.message }, { status: 403 });
    throw e;
  }

  const body = await req.json();
  const parsed = createUserSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const { email, password, fullName, role } = parsed.data;
  const passwordHash = await hashPassword(password);

  const [created] = await db
    .insert(users)
    .values({ email: email.toLowerCase(), passwordHash, fullName, role })
    .returning({ id: users.id, email: users.email, role: users.role });

  await recordAudit({
    actorUserId: session!.user.id,
    action: "UserCreated",
    resourceType: "User",
    resourceId: created.id,
    newValue: { email: created.email, role: created.role },
  });

  return NextResponse.json({ user: created }, { status: 201 });
}
