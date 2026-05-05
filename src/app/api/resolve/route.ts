import { NextRequest, NextResponse } from "next/server";

const STEAM_API_KEY = process.env.STEAM_API_KEY || "";

export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json();

    if (!url || typeof url !== "string") {
      return NextResponse.json({ error: "URL не указан" }, { status: 400 });
    }

    if (!STEAM_API_KEY) {
      return NextResponse.json(
        { error: "Steam API ключ не настроен. Добавьте STEAM_API_KEY в .env.local" },
        { status: 500 }
      );
    }

    let steamId64: string | null = null;
    const input = url.trim().replace(/\/+$/, "");

    // 1. Pure digits (Steam ID64) — 17 digits starting with 7656
    const pureDigits = input.match(/^(\d{17})$/);
    if (pureDigits) {
      steamId64 = pureDigits[1];
    }

    // 2. URL containing /profiles/{id}
    if (!steamId64) {
      const profilesMatch = input.match(/\/profiles\/(\d{17})/);
      if (profilesMatch) {
        steamId64 = profilesMatch[1];
      }
    }

    // 3. URL containing /id/{vanity} — extract vanity name
    let vanityName: string | null = null;
    if (!steamId64) {
      const vanityMatch = input.match(/\/id\/([^\/\?\s]+)/);
      if (vanityMatch) {
        vanityName = vanityMatch[1];
      }
    }

    // 4. If nothing matched yet, treat the whole input as either a vanity name or a raw Steam ID
    if (!steamId64 && !vanityName) {
      // Check if it looks like a Steam ID64 (17 digits somewhere in the string)
      const idInText = input.match(/(\d{17})/);
      if (idInText) {
        steamId64 = idInText[1];
      } else {
        // Treat as vanity name (remove any URL parts, spaces, etc.)
        vanityName = input
          .replace(/https?:\/\//g, "")
          .replace(/steamcommunity\.com\/?/g, "")
          .replace(/[\/\s]/g, "")
          .trim();
      }
    }

    // 5. Resolve vanity name to Steam ID64
    if (!steamId64 && vanityName) {
      const resolveRes = await fetch(
        `https://api.steampowered.com/ISteamUser/ResolveVanityURL/v1/?key=${STEAM_API_KEY}&vanityurl=${vanityName}`
      );
      const resolveData = await resolveRes.json();
      if (resolveData.response?.success === 1) {
        steamId64 = resolveData.response.steamid;
      } else {
        return NextResponse.json(
          { error: `Не удалось найти аккаунт: "${vanityName}"` },
          { status: 404 }
        );
      }
    }

    if (!steamId64) {
      return NextResponse.json(
        { error: "Не удалось распознать ввод. Введите ссылку, Steam ID или имя профиля." },
        { status: 400 }
      );
    }

    // Get player summary
    const summaryRes = await fetch(
      `https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/?key=${STEAM_API_KEY}&steamids=${steamId64}`
    );
    const summaryData = await summaryRes.json();
    const player = summaryData.response?.players?.[0];

    if (!player) {
      return NextResponse.json(
        { error: "Профиль не найден" },
        { status: 404 }
      );
    }

    // Get ban info
    const banRes = await fetch(
      `https://api.steampowered.com/ISteamUser/GetPlayerBans/v1/?key=${STEAM_API_KEY}&steamids=${steamId64}`
    );
    const banData = await banRes.json();
    const banInfo = banData.players?.[0];

    const banStatus = banInfo
      ? {
          vacBanned: banInfo.VACBanned,
          numberOfVACBans: banInfo.NumberOfVACBans,
          daysSinceLastBan: banInfo.DaysSinceLastBan,
          gameBans: banInfo.NumberOfGameBans,
          communityBanned: banInfo.CommunityBanned,
          economyBan: banInfo.EconomyBan,
        }
      : null;

    return NextResponse.json({
      steamId64,
      personaName: player.personaname,
      avatarUrl: player.avatarfull,
      profileUrl: `https://steamcommunity.com/profiles/${steamId64}`,
      banStatus,
    });
  } catch (error) {
    console.error("Resolve error:", error);
    return NextResponse.json(
      { error: "Ошибка при обработке запроса" },
      { status: 500 }
    );
  }
}
