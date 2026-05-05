"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import {
  Plus,
  Archive,
  RotateCcw,
  Trash2,
  ExternalLink,
  Flag,
  ShieldCheck,
  ShieldX,
  ShieldQuestion,
  Loader2,
  Crosshair,
  ChevronDown,
  Search,
  X,
  Check,
  Clock,
} from "lucide-react";
import { SteamAccount, BanStatus } from "@/types";

type SortOption = "newest" | "oldest" | "name-asc" | "name-desc";
type FilterOption = "all" | "clean" | "banned";

// Relative time formatting
function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return "только что";
  if (diffMin < 60) return `${diffMin} мин. назад`;
  if (diffHour < 24) return `${diffHour} ч. назад`;
  if (diffDay === 1) return "вчера";
  if (diffDay < 7) return `${diffDay} дн. назад`;

  return date.toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
  });
}

function formatFullDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function Home() {
  const [accounts, setAccounts] = useState<SteamAccount[]>([]);
  const [inputUrl, setInputUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [mounted, setMounted] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(true);
  const [justUpdated, setJustUpdated] = useState(false);
  const archiveRef = useRef<HTMLDivElement>(null);

  // Search, Sort, Filter
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("newest");
  const [filterBy, setFilterBy] = useState<FilterOption>("all");

  useEffect(() => setMounted(true), []);

  // Load from API (database)
  useEffect(() => {
    const loadAccounts = async () => {
      try {
        const res = await fetch("/api/accounts");
        if (res.ok) {
          const data = await res.json();
          // Transform database format to frontend format
          const formatted = (data.accounts || []).map((acc: any) => ({
            id: String(acc.id),
            steamId64: acc.steamId64,
            profileUrl: acc.profileUrl,
            personaName: acc.personaName,
            avatarUrl: acc.avatarUrl,
            addedAt: acc.addedAt,
            archived: acc.archived,
            banStatus: acc.banStatus,
            lastChecked: acc.lastChecked,
          }));
          setAccounts(formatted);
        }
      } catch {
        // Fallback to localStorage if database not configured
        const saved = localStorage.getItem("steam-tracker-accounts");
        if (saved) {
          try {
            setAccounts(JSON.parse(saved));
          } catch {
            // ignore parse errors
          }
        }
      }
    };
    loadAccounts();
  }, []);

  // Save to localStorage as backup (only if database fails)
  useEffect(() => {
    if (mounted) {
      localStorage.setItem("steam-tracker-accounts", JSON.stringify(accounts));
    }
  }, [accounts, mounted]);

  // Check bans silently (no loading indicator)
  const checkAllBansSilent = useCallback(async () => {
    const activeAccounts = accounts.filter((a) => !a.archived);
    if (activeAccounts.length === 0) return;

    try {
      const steamIds = activeAccounts.map((a) => a.steamId64);
      const res = await fetch("/api/check-bans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ steamIds }),
      });
      const data = await res.json();

      if (res.ok && data.results) {
        const now = new Date().toISOString();
        
        // Update database for changed accounts
        const updates = activeAccounts.map(async (account) => {
          const banInfo = data.results[account.steamId64] as BanStatus | undefined;
          if (banInfo && JSON.stringify(banInfo) !== JSON.stringify(account.banStatus)) {
            try {
              await fetch(`/api/accounts/${account.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ banStatus: banInfo, lastChecked: now }),
              });
            } catch {
              // Continue even if update fails
            }
          }
        });
        await Promise.all(updates);
        
        setAccounts((prev) => {
          const updated = prev.map((account) => {
            const banInfo = data.results[account.steamId64] as BanStatus | undefined;
            if (banInfo) {
              return {
                ...account,
                banStatus: banInfo,
                lastChecked: now,
              };
            }
            return account;
          });

          // Check if anything changed
          const hasChanges = prev.some((acc, i) => {
            const newBan = updated[i].banStatus;
            return JSON.stringify(acc.banStatus) !== JSON.stringify(newBan);
          });

          if (hasChanges) {
            setJustUpdated(true);
            setTimeout(() => setJustUpdated(false), 3000);
          }

          return updated;
        });
      }
    } catch {
      // silent fail
    }
  }, [accounts]);

  // Add account
  const addAccount = async () => {
    if (!inputUrl.trim()) return;
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: inputUrl.trim() }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Ошибка");
        return;
      }

      if (accounts.some((a) => a.steamId64 === data.steamId64)) {
        setError("Этот аккаунт уже добавлен");
        return;
      }

      // Save to database
      const saveRes = await fetch("/api/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          steamId64: data.steamId64,
          personaName: data.personaName,
          avatarUrl: data.avatarUrl,
          profileUrl: data.profileUrl,
          banStatus: data.banStatus,
        }),
      });

      if (!saveRes.ok) {
        const saveError = await saveRes.json();
        setError(saveError.error || "Ошибка при сохранении");
        return;
      }

      const saveData = await saveRes.json();
      const newAccount: SteamAccount = {
        id: String(saveData.account.id),
        steamId64: saveData.account.steamId64,
        profileUrl: saveData.account.profileUrl,
        personaName: saveData.account.personaName,
        avatarUrl: saveData.account.avatarUrl,
        addedAt: saveData.account.addedAt,
        archived: saveData.account.archived,
        banStatus: saveData.account.banStatus,
        lastChecked: saveData.account.lastChecked,
      };

      setAccounts((prev) => [newAccount, ...prev]);
      setInputUrl("");
    } catch {
      setError("Ошибка сети");
    } finally {
      setLoading(false);
    }
  };

  // Auto-refresh triggers
  useEffect(() => {
    if (!mounted) return;

    // Initial check after mount
    const initialTimer = setTimeout(checkAllBansSilent, 1000);

    // Visibility change
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        checkAllBansSilent();
      }
    };

    // Focus
    const handleFocus = () => {
      checkAllBansSilent();
    };

    // Interval (every 3 minutes while active)
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") {
        checkAllBansSilent();
      }
    }, 3 * 60 * 1000);

    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("focus", handleFocus);

    return () => {
      clearTimeout(initialTimer);
      clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("focus", handleFocus);
    };
  }, [mounted, checkAllBansSilent]);

  const archiveAccount = async (id: string) => {
    try {
      await fetch(`/api/accounts/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ archived: true }),
      });
    } catch {
      // Continue with local update even if API fails
    }
    setAccounts((prev) =>
      prev.map((a) => (a.id === id ? { ...a, archived: true } : a))
    );
  };

  const restoreAccount = async (id: string) => {
    try {
      await fetch(`/api/accounts/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ archived: false }),
      });
    } catch {
      // Continue with local update even if API fails
    }
    setAccounts((prev) =>
      prev.map((a) => (a.id === id ? { ...a, archived: false } : a))
    );
  };

  const deleteAccountHandler = async (id: string) => {
    try {
      await fetch(`/api/accounts/${id}`, {
        method: "DELETE",
      });
    } catch {
      // Continue with local delete even if API fails
    }
    setAccounts((prev) => prev.filter((a) => a.id !== id));
  };

  const reportAccount = (account: SteamAccount) => {
    console.log("Report:", account.steamId64);
    alert(`Репорт на аккаунт: ${account.personaName}\n(Заглушка)`);
  };

  const activeAccounts = accounts.filter((a) => !a.archived);
  const archivedAccounts = accounts.filter((a) => a.archived);

  // Stats
  const stats = useMemo(() => {
    const total = activeAccounts.length;
    const banned = activeAccounts.filter((a) => a.banStatus && (a.banStatus.vacBanned || a.banStatus.gameBans > 0)).length;
    const clean = activeAccounts.filter((a) => a.banStatus && !a.banStatus.vacBanned && a.banStatus.gameBans === 0).length;
    return { total, banned, clean };
  }, [activeAccounts]);

  // Filtered & Sorted accounts
  const filteredAccounts = useMemo(() => {
    let result = activeAccounts;

    // Search
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      result = result.filter((a) =>
        a.personaName.toLowerCase().includes(query) ||
        a.steamId64.toLowerCase().includes(query)
      );
    }

    // Filter
    if (filterBy !== "all") {
      result = result.filter((a) => {
        const ban = a.banStatus;
        const hasBan = ban && (ban.vacBanned || ban.gameBans > 0);
        const isClean = ban && !ban.vacBanned && ban.gameBans === 0;

        if (filterBy === "banned") return hasBan;
        if (filterBy === "clean") return isClean;
        return true;
      });
    }

    // Sort
    result = [...result].sort((a, b) => {
      switch (sortBy) {
        case "newest":
          return new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime();
        case "oldest":
          return new Date(a.addedAt).getTime() - new Date(b.addedAt).getTime();
        case "name-asc":
          return a.personaName.localeCompare(b.personaName);
        case "name-desc":
          return b.personaName.localeCompare(a.personaName);
        default:
          return 0;
      }
    });

    return result;
  }, [activeAccounts, searchQuery, filterBy, sortBy]);

  const resetFilters = () => {
    setSearchQuery("");
    setFilterBy("all");
    setSortBy("newest");
  };

  const hasActiveFilters = searchQuery || filterBy !== "all" || sortBy !== "newest";

  if (!mounted) return null;

  return (
    <>
      <div className="app-bg" />
      <main className="main-container">
        {/* Header */}
        <header className="header">
          <div className="header-inner">
            <div className="header-logo">
              <Crosshair size={22} />
            </div>
            <div>
              <h1 className="header-title">Steam Tracker</h1>
              <p className="header-sub">Мониторинг аккаунтов и статусов банов</p>
            </div>
          </div>
          {stats.total > 0 && (
            <div className="stats-bar">
              <div className="stat-item">
                <span className="stat-value">{stats.total}</span>
                <span className="stat-label">всего</span>
              </div>
              <div className="stat-item">
                <span className="stat-value success">{stats.clean}</span>
                <span className="stat-label">чистых</span>
              </div>
              <div className="stat-item">
                <span className="stat-value danger">{stats.banned}</span>
                <span className="stat-label">забанено</span>
              </div>
            </div>
          )}
        </header>

        {/* Add form */}
        <div className="add-form">
          <input
            type="text"
            value={inputUrl}
            onChange={(e) => {
              setInputUrl(e.target.value);
              if (error) setError("");
            }}
            onKeyDown={(e) => e.key === "Enter" && addAccount()}
            placeholder="Steam ID или ссылка на профиль..."
            className="add-input"
          />
          <button
            onClick={addAccount}
            disabled={loading}
            className="add-btn"
          >
            {loading ? <Loader2 size={18} className="animate-spin" /> : <Plus size={18} />}
            <span>Добавить</span>
          </button>
        </div>
        {error && <div className="error-msg">{error}</div>}

        {/* Toolbar */}
        {activeAccounts.length > 0 && (
          <div className="toolbar">
            <div className="search-wrapper">
              <Search size={16} className="search-icon" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Никнейм или ID"
                className="search-input"
              />
            </div>
            <div className="filter-group">
              <span className="filter-label">Сортировка:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                className="filter-select"
              >
                <option value="newest">Сначала новые</option>
                <option value="oldest">Сначала старые</option>
                <option value="name-asc">Имя (А-Я)</option>
                <option value="name-desc">Имя (Я-А)</option>
              </select>
            </div>
            <div className="filter-group">
              <span className="filter-label">Статус:</span>
              <select
                value={filterBy}
                onChange={(e) => setFilterBy(e.target.value as FilterOption)}
                className="filter-select"
              >
                <option value="all">Все</option>
                <option value="clean">Чистые</option>
                <option value="banned">Забаненные</option>
              </select>
            </div>
            <button 
              onClick={resetFilters} 
              className={`reset-btn ${hasActiveFilters ? "visible" : ""}`}
            >
              <X size={14} />
              <span>Сброс</span>
            </button>
          </div>
        )}

        {/* Results info */}
        <div className="results-info">
          {activeAccounts.length > 0 && filteredAccounts.length !== activeAccounts.length && (
            <span>Показано {filteredAccounts.length} из {activeAccounts.length} аккаунтов</span>
          )}
          <span className={`update-indicator ${justUpdated ? "visible" : ""}`}>
            <Check size={14} />
            Обновлено
          </span>
        </div>

        {/* Active accounts */}
        <section className="section">
          <div className="section-header">
            <div style={{ display: "flex", alignItems: "center" }}>
              <span className="section-title">Активные</span>
              <span className="section-count">{filteredAccounts.length}</span>
            </div>
          </div>

          {activeAccounts.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">
                <Crosshair size={24} />
              </div>
              <p className="empty-text">Нет отслеживаемых аккаунтов</p>
              <p className="empty-subtext">Добавьте первый аккаунт выше</p>
            </div>
          ) : filteredAccounts.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">
                <Search size={24} />
              </div>
              <p className="empty-text">Ничего не найдено</p>
              <p className="empty-subtext">Попробуйте изменить параметры поиска</p>
            </div>
          ) : (
            <div className="account-list">
              {filteredAccounts.map((account) => (
                <AccountCard
                  key={account.id}
                  account={account}
                  onArchive={() => archiveAccount(account.id)}
                  onReport={() => reportAccount(account)}
                />
              ))}
            </div>
          )}
        </section>

        {/* Archive */}
        {archivedAccounts.length > 0 && (
          <>
            <div className="divider" />
            <section className="section">
              <button
                onClick={() => setArchiveOpen(!archiveOpen)}
                className="archive-toggle"
              >
                <span>Архив</span>
                <span className="section-count">{archivedAccounts.length}</span>
                <ChevronDown
                  size={18}
                  className={`archive-chevron ${archiveOpen ? "open" : ""}`}
                />
              </button>
              <div
                ref={archiveRef}
                className="archive-content"
                style={{ maxHeight: archiveOpen ? `${archivedAccounts.length * 92}px` : "0" }}
              >
                <div className="account-list">
                  {archivedAccounts.map((account) => (
                    <AccountCard
                      key={account.id}
                      account={account}
                      onRestore={() => restoreAccount(account.id)}
                      onDelete={() => deleteAccountHandler(account.id)}
                      isArchived
                    />
                  ))}
                </div>
              </div>
            </section>
          </>
        )}
      </main>
    </>
  );
}

function AccountCard({
  account,
  onArchive,
  onRestore,
  onDelete,
  onReport,
  isArchived = false,
}: {
  account: SteamAccount;
  onArchive?: () => void;
  onRestore?: () => void;
  onDelete?: () => void;
  onReport?: () => void;
  isArchived?: boolean;
}) {
  const ban = account.banStatus;
  const hasBan = ban && (ban.vacBanned || ban.gameBans > 0);

  return (
    <div className={`account-card ${hasBan ? "banned" : ""} ${isArchived ? "archived" : ""}`}>
      <a
        href={account.profileUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="avatar-link"
      >
        <img
          src={account.avatarUrl}
          alt={account.personaName}
          className="avatar"
        />
        <div className="avatar-overlay">
          <ExternalLink size={14} />
        </div>
      </a>

      <div className="account-info">
        <div className="account-name">{account.personaName}</div>
        <div className="account-meta">
          <span className="account-id">{account.steamId64}</span>
          <span className="account-added">
            <Clock size={10} className="account-added-icon" />
            <span>{formatRelativeTime(account.addedAt)}</span>
            <span className="account-tooltip">
              Добавлен: {formatFullDate(account.addedAt)}
            </span>
          </span>
        </div>
      </div>

      <BanBadge banStatus={ban} />

      <div className="account-actions">
        {!isArchived && onReport && (
          <button onClick={onReport} title="Репорт" className="action-btn warning">
            <Flag size={16} />
          </button>
        )}
        {!isArchived && onArchive && (
          <button onClick={onArchive} title="В архив" className="action-btn muted">
            <Archive size={16} />
          </button>
        )}
        {isArchived && onRestore && (
          <button onClick={onRestore} title="Восстановить" className="action-btn accent">
            <RotateCcw size={16} />
          </button>
        )}
        {isArchived && onDelete && (
          <button onClick={onDelete} title="Удалить" className="action-btn danger">
            <Trash2 size={16} />
          </button>
        )}
      </div>
    </div>
  );
}

function BanBadge({ banStatus }: { banStatus: BanStatus | null }) {
  if (!banStatus) {
    return (
      <span className="badge badge-unknown">
        <ShieldQuestion size={12} />
        <span>?</span>
      </span>
    );
  }

  const hasBan = banStatus.vacBanned || banStatus.gameBans > 0;

  if (hasBan) {
    const parts: string[] = [];
    if (banStatus.vacBanned) parts.push(`VAC ${banStatus.numberOfVACBans}`);
    if (banStatus.gameBans > 0) parts.push(`Game ${banStatus.gameBans}`);

    return (
      <span className="badge badge-banned">
        <ShieldX size={12} />
        <span>{parts.join(" · ")}</span>
      </span>
    );
  }

  return (
    <span className="badge badge-clean">
      <ShieldCheck size={12} />
      <span>Чисто</span>
    </span>
  );
}
