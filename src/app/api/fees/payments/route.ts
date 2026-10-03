/**
 * MODULE: Fee & Payment Management
 * POST /api/fees/payments -> record a payment against an invoice, update invoice status/amountPaid.
 * A student may only pay their own invoice; staff roles may record payments for any invoice
 * (e.g., a cash payment taken at the accounts desk).
 */
import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { payments, invoices, students } from "@/db/schema";
import { requirePermission, ForbiddenError } from "@/lib/rbac";
import { recordAudit } from "@/lib/audit";

const recordPaymentSchema = z.object({
  invoiceId: z.string().uuid(),
  amount: z.number().positive(),
  method: z.enum(["cash", "card", "bank_transfer", "online_gateway", "scholarship_adjustment"]),
  transactionReference: z.string().max(255).optional(),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  try {
    requirePermission(session, "make_payment");
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: e.message }, { status: 403 });
    throw e;
  }

  const body = await req.json();
  const parsed = recordPaymentSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  const { invoiceId, amount, method, transactionReference } = parsed.data;

  const [invoice] = await db.select().from(invoices).where(eq(invoices.id, invoiceId)).limit(1);
  if (!invoice) return NextResponse.json({ error: "Invoice not found" }, { status: 404 });

  // Ownership check for the Student role: may only pay their own invoice.
  if (session!.user.role === "student") {
    const [studentProfile] = await db
      .select({ id: students.id })
      .from(students)
      .where(eq(students.userId, session!.user.id))
      .limit(1);
    if (!studentProfile || studentProfile.id !== invoice.studentId) {
      return NextResponse.json({ error: "You may only pay your own invoice" }, { status: 403 });
    }
  }

  const remaining = Number(invoice.payableAmount) - Number(invoice.amountPaid);
  if (amount > remaining) {
    return NextResponse.json(
      { error: `Payment exceeds the remaining balance of ${remaining.toFixed(2)}` },
      { status: 422 }
    );
  }

  const result = await db.transaction(async (tx) => {
    const [payment] = await tx
      .insert(payments)
      .values({
        invoiceId,
        amount: String(amount),
        method,
        status: "successful", // simplified: a real gateway integration would start as 'pending'
        transactionReference,
        recordedByUserId: session!.user.id,
      })
      .returning();

    const newAmountPaid = Number(invoice.amountPaid) + amount;
    const newStatus =
      newAmountPaid >= Number(invoice.payableAmount)
        ? "paid"
        : newAmountPaid > 0
          ? "partially_paid"
          : invoice.status;

    const [updatedInvoice] = await tx
      .update(invoices)
      .set({ amountPaid: String(newAmountPaid), status: newStatus })
      .where(eq(invoices.id, invoiceId))
      .returning();

    return { payment, invoice: updatedInvoice };
  });

  await recordAudit({
    actorUserId: session!.user.id,
    action: "PaymentRecorded",
    resourceType: "Invoice",
    resourceId: invoiceId,
    newValue: { amount, method, newStatus: result.invoice.status },
  });

  return NextResponse.json(result, { status: 201 });
}
