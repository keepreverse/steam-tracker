import { NextRequest, NextResponse } from "next/server";

const STEAM_API_KEY = process.env.STEAM_API_KEY || "";

export async function POST(request: NextRequest) {
  try {
    const { steamIds } = await request.json();

    if (!steamIds || !Array.isArray(steamIds) || steamIds.length === 0) {
      return NextResponse.json({ error: "Steam ID не указаны" }, { status: 400 });
    }

    if (!STEAM_API_KEY) {
      return NextResponse.json(
        { error: "Steam API ключ не настроен" },
        { status: 500 }
      );
    }

    const idsString = steamIds.join(",");

    const banRes = await fetch(
      `https://api.steampowered.com/ISteamUser/GetPlayerBans/v1/?key=${STEAM_API_KEY}&steamids=${idsString}`
    );
    const banData = await banRes.json();

    const results: Record<string, unknown> = {};
    if (banData.players) {
      for (const player of banData.players) {
        results[player.SteamId] = {
          vacBanned: player.VACBanned,
          numberOfVACBans: player.NumberOfVACBans,
          daysSinceLastBan: player.DaysSinceLastBan,
          gameBans: player.NumberOfGameBans,
          communityBanned: player.CommunityBanned,
          economyBan: player.EconomyBan,
        };
      }
    }

    return NextResponse.json({ results });
  } catch (error) {
    console.error("Check bans error:", error);
    return NextResponse.json(
      { error: "Ошибка при проверке банов" },
      { status: 500 }
    );
  }
}
