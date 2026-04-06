import { useCallback, useEffect, useMemo, useState } from "react";
import { http } from "../../api/http";
import { getStoredUser } from "../../auth/auth";

const IDS_LIMIT = 500;

export function useFavorites() {
  const user = getStoredUser();

  const canUseFavorites = useMemo(() => {
    return !!user && (user.role === "USER" || user.role === "OWNER");
  }, [user]);

  const [favoriteIds, setFavoriteIds] = useState(() => new Set());

  const refreshFavoriteIds = useCallback(async () => {
    if (!canUseFavorites) {
      setFavoriteIds(new Set());
      return;
    }

    try {
      const res = await http.get("/favorites", {
        params: { page: 1, limit: IDS_LIMIT },
      });
      const ids = (res.data.items || []).map((x) => x.id);
      setFavoriteIds(new Set(ids));
    } catch {
      setFavoriteIds(new Set());
    }
  }, [canUseFavorites]);

  useEffect(() => {
    queueMicrotask(refreshFavoriteIds);
  }, [refreshFavoriteIds]);

  const isFavorite = useCallback(
    (locationId) => favoriteIds.has(locationId),
    [favoriteIds],
  );

  const toggleFavorite = useCallback(
    async (locationId) => {
      if (!canUseFavorites) return { ok: false, reason: "not_allowed" };

      const wasFav = favoriteIds.has(locationId);

      setFavoriteIds((prev) => {
        const next = new Set(prev);
        if (wasFav) next.delete(locationId);
        else next.add(locationId);
        return next;
      });

      try {
        if (wasFav) {
          await http.delete(`/favorites/${locationId}`);
        } else {
          await http.post(`/favorites/${locationId}`);
        }
        return { ok: true, nowFav: !wasFav };
      } catch {
        setFavoriteIds((prev) => {
          const next = new Set(prev);
          if (wasFav) next.add(locationId);
          else next.delete(locationId);
          return next;
        });
        return { ok: false, reason: "request_failed" };
      }
    },
    [canUseFavorites, favoriteIds],
  );

  return {
    canUseFavorites,
    isFavorite,
    toggleFavorite,
  };
}
