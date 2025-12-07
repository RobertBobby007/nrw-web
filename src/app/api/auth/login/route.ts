import { NextResponse } from "next/server";
import { createSessionToken, publicUser, sessionCookie, verifyUser } from "@/lib/auth-store";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    const email = typeof body?.email === "string" ? body.email.trim() : "";
    const password = typeof body?.password === "string" ? body.password : "";

    if (!email || !password) {
      return NextResponse.json({ message: "Vyplň prosím e-mail i heslo." }, { status: 400 });
    }

    const user = verifyUser({ email, password });
    if (!user) {
      return NextResponse.json({ message: "E-mail nebo heslo nesedí." }, { status: 401 });
    }

    const token = createSessionToken(user);
    const res = NextResponse.json({ user: publicUser(user) }, { status: 200 });
    res.cookies.set(sessionCookie.name, token, sessionCookie);
    return res;
  } catch (err) {
    console.error("Login error", err);
    return NextResponse.json({ message: "Něco se pokazilo. Zkus to prosím znovu." }, { status: 500 });
  }
}
