import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { getEnv } from "@/lib/env";

export type SessionUser = {
  sub: string;
  userId: number;
  tenantId: number | null;
  roleSlug: string;
  email: string;
  name: string;
  impersonatedTenantId?: number | null;
};

const ACCESS_COOKIE = "avrkr_access";
const REFRESH_COOKIE = "avrkr_refresh";

function secretKey() {
  return new TextEncoder().encode(getEnv().SESSION_SECRET);
}

export async function createAccessToken(user: SessionUser): Promise<string> {
  return new SignJWT({ ...user })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("15m")
    .sign(secretKey());
}

export async function createRefreshToken(userId: number): Promise<string> {
  return new SignJWT({ userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secretKey());
}

export async function verifyToken(token: string): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey());
    return payload as unknown as SessionUser;
  } catch {
    return null;
  }
}

export async function setAuthCookies(
  access: string,
  refresh: string,
): Promise<void> {
  const cookieStore = await cookies();
  const secure = getEnv().APP_ENV === "production";
  cookieStore.set(ACCESS_COOKIE, access, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 15,
  });
  cookieStore.set(REFRESH_COOKIE, refresh, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function clearAuthCookies(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(ACCESS_COOKIE);
  cookieStore.delete(REFRESH_COOKIE);
}

export async function getSessionFromCookies(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(ACCESS_COOKIE)?.value;
  if (!token) return null;
  return verifyToken(token);
}

export { ACCESS_COOKIE, REFRESH_COOKIE };
