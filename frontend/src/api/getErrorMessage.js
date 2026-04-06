export function getErrorMessage(err, fallback = "Something went wrong", t) {
  const data = err?.response?.data;

  const code = data?.error?.code || data?.code;
  const message = data?.error?.message || data?.message;
  const details = data?.error?.details || data?.details;

  if (t && code) {
    const key = `errors.${String(code)}`;
    const translated = t(key, "");
    if (translated) return translated;
  }

  if (details?.fields && typeof details.fields === "object") {
    const firstKey = Object.keys(details.fields)[0];
    const fieldVal = details.fields[firstKey];

    if (t && firstKey) {
      const reason = String(fieldVal || "");
      const translatedField = t(`errors.fields.${firstKey}.${reason}`, "");
      if (translatedField) return translatedField;
    }
    if (firstKey) return `${firstKey}: ${String(fieldVal)}`;
  }

  if (typeof message === "string" && message.trim()) return message;
  if (typeof data?.error === "string") return data.error;
  if (typeof err?.message === "string" && err.message.trim()) return err.message;

  return fallback;
}
