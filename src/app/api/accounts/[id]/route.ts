import { NextRequest, NextResponse } from "next/server";
import { updateAccount, deleteAccount } from "@/lib/db";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const accountId = parseInt(id, 10);

    if (isNaN(accountId)) {
      return NextResponse.json(
        { error: "Неверный ID аккаунта" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { archived, banStatus, lastChecked } = body;

    const account = await updateAccount(accountId, {
      archived,
      banStatus,
      lastChecked: lastChecked ? new Date(lastChecked) : undefined,
    });

    if (!account) {
      return NextResponse.json(
        { error: "Аккаунт не найден" },
        { status: 404 }
      );
    }

    return NextResponse.json({ account });
  } catch (error) {
    console.error("Update account error:", error);
    return NextResponse.json(
      { error: "Ошибка при обновлении аккаунта" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const accountId = parseInt(id, 10);

    if (isNaN(accountId)) {
      return NextResponse.json(
        { error: "Неверный ID аккаунта" },
        { status: 400 }
      );
    }

    await deleteAccount(accountId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete account error:", error);
    return NextResponse.json(
      { error: "Ошибка при удалении аккаунта" },
      { status: 500 }
    );
  }
}
