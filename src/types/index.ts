export interface SteamAccount {
  id: string;
  steamId64: string;
  profileUrl: string;
  personaName: string;
  avatarUrl: string;
  addedAt: string;
  archived: boolean;
  banStatus: BanStatus | null;
  lastChecked: string | null;
}

export interface BanStatus {
  vacBanned: boolean;
  numberOfVACBans: number;
  daysSinceLastBan: number;
  gameBans: number;
  communityBanned: boolean;
  economyBan: string;
}

export interface SteamPlayerSummary {
  steamid: string;
  personaname: string;
  avatarfull: string;
  profileurl: string;
}
