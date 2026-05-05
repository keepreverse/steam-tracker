import { NextRequest, NextResponse } from "next/server";
import { getAllAccounts, createAccount, initDatabase, getAccountBySteamId } from "@/lib/db";

// Initialize database on first request
let dbInitialized = false;

export async function GET() {
  try {
    if (!dbInitialized) {
      await initDatabase();
      dbInitialized = true;
    }

    const accounts = await getAllAccounts();
    return NextResponse.json({ accounts });
  } catch (error) {
    console.error("Get accounts error:", error);
    return NextResponse.json(
      { error: "Ошибка при получении аккаунтов" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!dbInitialized) {
      await initDatabase();
      dbInitialized = true;
    }

    const body = await request.json();
    const { steamId64, personaName, avatarUrl, profileUrl, banStatus } = body;

    if (!steamId64 || !personaName || !avatarUrl || !profileUrl) {
      return NextResponse.json(
        { error: "Не все обязательные поля заполнены" },
        { status: 400 }
      );
    }

    // Check if account already exists
    const existing = await getAccountBySteamId(steamId64);
    if (existing) {
      return NextResponse.json(
        { error: "Этот аккаунт уже добавлен" },
        { status: 409 }
      );
    }

    const account = await createAccount({
      steamId64,
      personaName,
      avatarUrl,
      profileUrl,
      banStatus: banStatus || null,
    });

    return NextResponse.json({ account });
  } catch (error) {
    console.error("Create account error:", error);
    return NextResponse.json(
      { error: "Ошибка при создании аккаунта" },
      { status: 500 }
    );
  }
}
