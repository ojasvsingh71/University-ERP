import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

// Route-prefix -> roles allowed to access it. Checked in addition to, not instead of,
// the per-endpoint permission checks inside each API route handler (defense in depth).
const ROLE_PROTECTED_PREFIXES: { prefix: string; roles: string[] }[] = [
  { prefix: "/api/users", roles: ["super_admin"] },
  { prefix: "/api/academic", roles: ["super_admin", "university_admin", "department_admin"] },
  { prefix: "/api/attendance", roles: ["faculty", "super_admin", "department_admin", "student", "parent"] },
  {
    prefix: "/api/exams",
    roles: ["faculty", "hod", "department_admin", "examination_controller", "super_admin"],
  },
  { prefix: "/api/fees", roles: ["super_admin", "registrar", "student", "parent"] },
  { prefix: "/api/audit", roles: ["auditor", "super_admin"] },
];

const PUBLIC_PATHS = ["/login", "/api/auth"];

export default auth((req) => {
  const { pathname } = req.nextUrl;

  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const session = req.auth;
  if (!session) {
    if (pathname.startsWith("/api")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/login", req.url));
  }

  const rule = ROLE_PROTECTED_PREFIXES.find((r) => pathname.startsWith(r.prefix));
  if (rule && !rule.roles.includes(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
