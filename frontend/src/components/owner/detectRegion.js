const REGION_BY_ISO_CODE = {
  "UA-05": "VINNYTSIA",
  "UA-07": "VOLYN",
  "UA-09": "LUHANSK",
  "UA-12": "DNIPROPETROVSK",
  "UA-14": "DONETSK",
  "UA-18": "ZHYTOMYR",
  "UA-21": "ZAKARPATTIA",
  "UA-23": "ZAPORIZHZHIA",
  "UA-26": "IVANO_FRANKIVSK",
  "UA-30": "KYIV",
  "UA-32": "KYIV",
  "UA-35": "KIROVOHRAD",
  "UA-40": "CRIMEA",
  "UA-43": "CRIMEA",
  "UA-46": "LVIV",
  "UA-48": "MYKOLAIV",
  "UA-51": "ODESA",
  "UA-53": "POLTAVA",
  "UA-56": "RIVNE",
  "UA-59": "SUMY",
  "UA-61": "TERNOPIL",
  "UA-63": "KHARKIV",
  "UA-65": "KHERSON",
  "UA-68": "KHMELNYTSKYI",
  "UA-71": "CHERKASY",
  "UA-74": "CHERNIHIV",
  "UA-77": "CHERNIVTSI",
};

const REGION_BY_NAME = {
  vinnytsia: "VINNYTSIA",
  vinnitsia: "VINNYTSIA",
  volyn: "VOLYN",
  dnipropetrovsk: "DNIPROPETROVSK",
  donetsk: "DONETSK",
  zhytomyr: "ZHYTOMYR",
  zakarpattia: "ZAKARPATTIA",
  zaporizhzhia: "ZAPORIZHZHIA",
  "ivano frankivsk": "IVANO_FRANKIVSK",
  kyiv: "KYIV",
  kiev: "KYIV",
  kirovohrad: "KIROVOHRAD",
  luhansk: "LUHANSK",
  lviv: "LVIV",
  mykolaiv: "MYKOLAIV",
  odesa: "ODESA",
  odessa: "ODESA",
  poltava: "POLTAVA",
  rivne: "RIVNE",
  sumy: "SUMY",
  ternopil: "TERNOPIL",
  kharkiv: "KHARKIV",
  kherson: "KHERSON",
  khmelnytskyi: "KHMELNYTSKYI",
  cherkasy: "CHERKASY",
  chernivtsi: "CHERNIVTSI",
  chernihiv: "CHERNIHIV",
  crimea: "CRIMEA",
};

const REVERSE_GEOCODING_URL =
  import.meta.env.VITE_REVERSE_GEOCODING_URL ||
  "https://nominatim.openstreetmap.org/reverse";
const REQUEST_INTERVAL_MS = 1000;
const regionCache = new Map();
let requestQueue = Promise.resolve();
let nextAllowedRequestAt = 0;

export async function detectRegion(lat, lng, { signal } = {}) {
  const cacheKey = `${Number(lat).toFixed(5)},${Number(lng).toFixed(5)}`;
  const cachedRegion = regionCache.get(cacheKey);
  if (cachedRegion) return cachedRegion;

  const lookup = requestQueue.then(async () => {
    await waitForRequestSlot(signal);
    const region = await fetchRegion(lat, lng, signal);
    regionCache.set(cacheKey, region);
    return region;
  });

  requestQueue = lookup.catch(() => null);
  return lookup;
}

async function fetchRegion(lat, lng, signal) {
  const url = new URL(REVERSE_GEOCODING_URL);
  url.search = new URLSearchParams({
    format: "jsonv2",
    lat: String(lat),
    lon: String(lng),
    zoom: "5",
    addressdetails: "1",
    "accept-language": "en",
  });

  const response = await fetch(url, {
    headers: { Accept: "application/json" },
    signal,
  });

  if (!response.ok) {
    throw new Error("Region lookup failed");
  }

  const address = (await response.json())?.address || {};

  if (String(address.country_code || "").toLowerCase() !== "ua") {
    throw new Error("Selected point is outside supported regions");
  }

  for (const [key, value] of Object.entries(address)) {
    if (!key.startsWith("ISO3166-2")) continue;
    const region = REGION_BY_ISO_CODE[String(value).toUpperCase()];
    if (region) return region;
  }

  const normalizedName = normalizeRegionName(
    address.state || address.region || address.province || "",
  );
  const region = REGION_BY_NAME[normalizedName];

  if (!region) {
    throw new Error("Region was not found");
  }

  return region;
}

async function waitForRequestSlot(signal) {
  const delay = Math.max(0, nextAllowedRequestAt - Date.now());
  if (delay) await wait(delay, signal);
  if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
  nextAllowedRequestAt = Date.now() + REQUEST_INTERVAL_MS;
}

function wait(delay, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException("Aborted", "AbortError"));
      return;
    }

    const onAbort = () => {
      clearTimeout(timeout);
      reject(new DOMException("Aborted", "AbortError"));
    };
    const timeout = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, delay);

    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

function normalizeRegionName(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\b(oblast|region|autonomous republic)\b/g, "")
    .replace(/[^a-z]+/g, " ")
    .trim();
}
