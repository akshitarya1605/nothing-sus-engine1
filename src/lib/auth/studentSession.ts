import { cookies } from "next/headers";
import { prisma } from "../db/prisma";
import { generateSecret, hashToken } from "./tokens";

const STUDENT_COOKIE = "ns_student";
const STUDENT_SESSION_HOURS = 24;

export interface StudentSessionData {
  accountId: string;
  collegeRegId: string;
  fullName: string;
  approvalStatus: string;
}

export async function createStudentSession(accountId: string): Promise<string> {
  const raw = generateSecret();
  const tokenHash = hashToken(raw);
  const expiresAt = new Date(Date.now() + STUDENT_SESSION_HOURS * 60 * 60 * 1000);

  await prisma.studentSession.create({
    data: {
      accountId,
      tokenHash,
      expiresAt,
    },
  });

  const store = await cookies();
  store.set(STUDENT_COOKIE, raw, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: STUDENT_SESSION_HOURS * 60 * 60,
  });

  return raw;
}

export async function getStudentSession(): Promise<StudentSessionData | null> {
  try {
    const store = await cookies();
    const raw = store.get(STUDENT_COOKIE)?.value;
    if (!raw) return null;

    const tokenHash = hashToken(raw);
    const session = await prisma.studentSession.findUnique({
      where: { tokenHash },
      include: { account: true },
    });

    if (!session || session.revokedAt || session.expiresAt < new Date()) {
      return null;
    }

    return {
      accountId: session.account.id,
      collegeRegId: session.account.collegeRegId,
      fullName: session.account.fullName,
      approvalStatus: session.account.approvalStatus,
    };
  } catch {
    return null;
  }
}

export async function destroyStudentSession(): Promise<void> {
  try {
    const store = await cookies();
    const raw = store.get(STUDENT_COOKIE)?.value;
    if (raw) {
      const tokenHash = hashToken(raw);
      await prisma.studentSession.updateMany({
        where: { tokenHash, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      store.delete(STUDENT_COOKIE);
    }
  } catch {
    /* ignore */
  }
}
