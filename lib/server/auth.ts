import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createHash, randomBytes, timingSafeEqual } from "crypto";

const COOKIE_NAME = "bimcore_admin";
const SESSION_MAX_AGE = 60 * 60 * 24 * 7;

function secret() {
  return process.env.ADMIN_PASSWORD ?? "";
}

function hash(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function shouldUseSecureCookie() {
  return process.env.AUTH_COOKIE_SECURE === "true";
}

export function isAuthConfigured() {
  return secret().length > 0;
}

export function verifyAdminPassword(password: string) {
  const expected = secret();
  if (!expected) return false;
  const a = Buffer.from(hash(password));
  const b = Buffer.from(hash(expected));
  return a.length === b.length && timingSafeEqual(a, b);
}

export function createSessionToken() {
  const nonce = randomBytes(16).toString("hex");
  return `${nonce}.${hash(`${nonce}:${secret()}`)}`;
}

export function verifySessionToken(token?: string) {
  if (!token || !secret()) return false;
  const [nonce, signature] = token.split(".");
  if (!nonce || !signature) return false;
  const expected = hash(`${nonce}:${secret()}`);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function isAuthenticated() {
  return verifySessionToken(cookies().get(COOKIE_NAME)?.value);
}

export function setSessionCookie(resp: NextResponse) {
  resp.cookies.set(COOKIE_NAME, createSessionToken(), {
    httpOnly: true,
    sameSite: "lax",
    secure: shouldUseSecureCookie(),
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
}

export function clearSessionCookie(resp: NextResponse) {
  resp.cookies.set(COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: shouldUseSecureCookie(),
    path: "/",
    maxAge: 0,
  });
}

export function unauthorized() {
  return NextResponse.json({ error: "未登录或会话已过期" }, { status: 401 });
}

export function requireAuth() {
  return isAuthenticated() ? null : unauthorized();
}
