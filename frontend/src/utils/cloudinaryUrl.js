export function getCloudinaryVariant(
  url,
  {
    w,
    h,
    crop = "fill",
    gravity,
    quality = "auto",
    format = "auto",
    dpr,
  } = {}
) {
  if (!url || typeof url !== "string") return url;

  const marker = "/upload/";
  const i = url.indexOf(marker);
  if (i === -1) return url;

  const prefix = url.slice(0, i + marker.length);
  const rest = url.slice(i + marker.length);

  if (rest.startsWith("w_") || rest.startsWith("c_") || rest.startsWith("q_") || rest.startsWith("f_")) {
    return url;
  }

  const parts = [];

  if (w) parts.push(`w_${Number(w)}`);
  if (h) parts.push(`h_${Number(h)}`);
  if (crop) parts.push(`c_${crop}`);
  if (gravity) parts.push(`g_${gravity}`);

  if (quality) parts.push(`q_${quality}`);
  if (format) parts.push(`f_${format}`);
  if (dpr) parts.push(`dpr_${dpr}`);

  const tr = parts.join(",");

  return `${prefix}${tr}/${rest}`;
}
