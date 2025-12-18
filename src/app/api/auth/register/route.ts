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
      return NextResponse.json({ message: "Vyplň prosím jméno, e-mail i heslo." }, { status: 400 });
    }
    if (!email.includes("@")) {
      return NextResponse.json({ message: "E-mail není platný." }, { status: 400 });
    }
    if (password.length < 8) {
      return NextResponse.json({ message: "Heslo musí mít alespoň 8 znaků." }, { status: 400 });
    }

    let user;
    try {
      user = createUser({ name, email, password });
    } catch (err) {
      if (err instanceof Error && err.message === "BlockedContent") {
        return NextResponse.json(
          { message: "Jméno nebo e-mail obsahuje nevhodný text." },
          { status: 400 },
        );
      }
      if (err instanceof Error && err.message === "UserAlreadyExists") {
        return NextResponse.json({ message: "Účet s tímto e-mailem už existuje." }, { status: 409 });
      }
      throw err;
    }

    const token = createSessionToken(user);
    const res = NextResponse.json({ user: publicUser(user) }, { status: 201 });
    res.cookies.set(sessionCookie.name, token, sessionCookie);
    return res;
  } catch (err) {
    console.error("Register error", err);
    return NextResponse.json({ message: "Něco se pokazilo. Zkus to prosím znovu." }, { status: 500 });
  }
}
