import crypto from "crypto";
import db from "./db";

export type UserRecord = {
  id: string;
  name: string;
  email: string;
  password_hash: string;
  salt: string;
  created_at: number;
};

const TOKEN_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

const sanitizeEmail = (email: string) => email.trim().toLowerCase();

function hashPassword(password: string, salt: string) {
  return crypto.createHash("sha256").update(password + salt).digest("hex");
}

export function createUser(input: { name: string; email: string; password: string }): UserRecord {
  const email = sanitizeEmail(input.email);
  const salt = crypto.randomBytes(16).toString("hex");
  const passwordHash = hashPassword(input.password, salt);
  const user = {
    id: crypto.randomUUID(),
    name: input.name.trim(),
    email,
    salt,
    password_hash: passwordHash,
    created_at: Date.now(),
  };

  try {
    db.prepare(
      `INSERT INTO users (id, name, email, password_hash, salt, created_at)
       VALUES (@id, @name, @email, @password_hash, @salt, @created_at)`
    ).run(user);
  } catch (err) {
    if (err instanceof Error && /UNIQUE constraint failed: users.email/.test(err.message)) {
      throw new Error("UserAlreadyExists");
    }
    throw err;
  }

  return user;
}

export function findUserByEmail(emailRaw: string): UserRecord | null {
  const email = sanitizeEmail(emailRaw);
  const row = db
    .prepare<[string], UserRecord>(`SELECT * FROM users WHERE email = ? LIMIT 1`)
    .get(email);
  return row ?? null;
}

export function verifyUser(input: { email: string; password: string }): UserRecord | null {
  const user = findUserByEmail(input.email);
  if (!user) return null;
  const candidate = hashPassword(input.password, user.salt);
  return candidate === user.password_hash ? user : null;
}

export function createSessionToken(user: UserRecord) {
  const payload = {
    sub: user.id,
    email: user.email,
    iat: Date.now(),
  };
  return Buffer.from(JSON.stringify(payload)).toString("base64url");
}

export function publicUser(user: UserRecord) {
  return { id: user.id, name: user.name, email: user.email, createdAt: user.created_at };
}

export const sessionCookie = {
  name: "nexa_session",
  maxAge: TOKEN_TTL_SECONDS,
  path: "/",
  httpOnly: true,
  sameSite: "lax" as const,
};
