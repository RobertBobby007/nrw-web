import { NextResponse } from "next/server";
import { createSessionToken, createUser, publicUser, sessionCookie } from "@/lib/auth-store";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    const name = typeof body?.name === "string" ? body.name.trim() : "";
    const email = typeof body?.email === "string" ? body.email.trim() : "";
    const password = typeof body?.password === "string" ? body.password : "";

    if (!name || !email || !password) {
      return NextResponse.json({ message: "Please fill in your name, email, and password." }, { status: 400 });
    }
    if (!email.includes("@")) {
      return NextResponse.json({ message: "Email is not valid." }, { status: 400 });
    }
    if (password.length < 8) {
      return NextResponse.json({ message: "Password must be at least 8 characters long." }, { status: 400 });
    }

    let user;
    try {
      user = createUser({ name, email, password });
    } catch (err) {
      if (err instanceof Error && err.message === "BlockedContent") {
        return NextResponse.json(
          { message: "The name or email contains blocked content." },
          { status: 400 },
        );
      }
      if (err instanceof Error && err.message === "UserAlreadyExists") {
        return NextResponse.json({ message: "An account with this email already exists." }, { status: 409 });
      }
      throw err;
    }

    const token = createSessionToken(user);
    const res = NextResponse.json({ user: publicUser(user) }, { status: 201 });
    res.cookies.set(sessionCookie.name, token, sessionCookie);
    return res;
  } catch (err) {
    console.error("Register error", err);
    return NextResponse.json({ message: "Something went wrong. Please try again." }, { status: 500 });
  }
}
