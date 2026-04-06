import { useMemo, useState } from "react";
import { useI18n } from "../../client/i18n/I18nContext";
import { formatSelectionSummary } from "./selectionSummary";

const OPTIONS = ["SPRING", "SUMMER", "AUTUMN", "WINTER"];

export default function SeasonPicker({ value, onChange }) {
  const { t } = useI18n();

  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();

    return OPTIONS
      .filter((x) => !(value || []).includes(x))
      .filter((x) => {
        const label = t(`seasons.${x}`, x).toLowerCase();
        return x.toLowerCase().includes(q) || label.includes(q);
      })
      .slice(0, 10);
  }, [query, value, t]);

  const summary = useMemo(
    () => formatSelectionSummary(value, (code) => t(`seasons.${code}`, code), 2),
    [value, t],
  );

  function add(code) {
    const next = (value || []).includes(code)
      ? value || []
      : [...(value || []), code];
    onChange(next);
  }

  return (
    <div style={{ position: "relative", display: "grid", gap: 6 }}>
      <input
        className="input"
        placeholder={t("seasonPicker.placeholder")}
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
          {filtered.map((code) => (
            <div
              key={code}
              onMouseDown={() => {
                add(code);
                setQuery("");
                setOpen(false);
              }}
              style={dropdownItem}
            >
              {t(`seasons.${code}`, code)}
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
