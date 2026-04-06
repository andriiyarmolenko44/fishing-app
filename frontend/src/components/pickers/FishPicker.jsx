import { useEffect, useMemo, useState } from "react";
import { http } from "../../api/http";
import { useI18n } from "../../client/i18n/I18nContext";
import { displayFishName } from "../../client/i18n/displayName";
import { formatSelectionSummary } from "./selectionSummary";

export default function FishPicker({ value, onChange }) {
  const { t, locale } = useI18n();

  const [options, setOptions] = useState([]);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await http.get("/locations/fish");
        const names = (res.data.items || []).map((x) => x.name).filter(Boolean);
        if (!cancelled) setOptions(names);
      } catch {
        if (!cancelled) setOptions([]);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [t]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return options
      .filter((name) => !(value || []).includes(name))
      .filter((name) => {
        if (!q) return true;
        const en = name.toLowerCase();
        const uk = displayFishName(name, locale).toLowerCase();
        return en.includes(q) || uk.includes(q);
      })
      .slice(0, 50);
  }, [options, query, value, locale]);

  const summary = useMemo(
    () =>
      formatSelectionSummary(
        value,
        (name) => displayFishName(name, locale),
        2,
      ),
    [value, locale],
  );

  function add(name) {
    const next = (value || []).includes(name)
      ? value || []
      : [...(value || []), name];
    onChange(next);
  }

  return (
    <div style={{ position: "relative", display: "grid", gap: 6 }}>
      <input
        className="input"
        placeholder={t("fishPicker.placeholder")}
        value={open ? query : summary}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => {
          setQuery("");
          setOpen(true);
        }}
        onBlur={() => {
          setOpen(false);
          setQuery("");
        }}
        style={input}
      />

      {open && filtered.length > 0 ? (
        <div style={{ ...dropdown, marginTop: 44 }}>
          {filtered.map((name) => (
            <div
              key={name}
              onMouseDown={() => {
                add(name);
                setQuery("");
                setOpen(false);
              }}
              style={dropdownItem}
            >
              {displayFishName(name, locale)}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

const input = {
  padding: 10,
  borderRadius: 8,
  border: "1px solid var(--owner-modal-input-border, var(--color-border-soft))",
  background: "var(--color-surface)",
  color: "var(--color-text)",
  width: "100%",
};
const dropdown = {
  position: "absolute",
  zIndex: 10,
  background: "var(--color-surface)",
  border: "1px solid var(--owner-modal-input-border, var(--color-border-soft))",
  width: "100%",
  borderRadius: 8,
  overflow: "hidden",
  maxHeight: 220,
  overflowY: "auto",
};
const dropdownItem = { padding: 8, cursor: "pointer" };
