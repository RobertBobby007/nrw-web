"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type WeatherState = {
  loading: boolean;
  error: boolean;
  temp: number | null;
  description: string | null;
  icon: string | null;
  city: string | null;
  region: string | null;
  updatedAt: string | null;
  forecast: Array<{ day: string; min: number; max: number; icon: string | null }>;
  alerts: Array<{
    id: string;
    title: string;
    description: string | null;
    severity: "low" | "moderate" | "high";
    validFrom: string | null;
    validTo: string | null;
  }>;
  alertsError: boolean;
};

type WeatherResponse = {
  main?: { temp?: number };
  weather?: Array<{ description?: string; icon?: string }>;
  name?: string;
};
type ForecastResponse = {
  list?: Array<{ dt?: number; main?: { temp_min?: number; temp_max?: number }; weather?: Array<{ icon?: string }> }>;
};
type ReverseGeoResponse = Array<{ state?: string; name?: string }>;
type AlertResponse = {
  alerts?: Array<{
    id?: string;
    title?: string;
    description?: string | null;
    severity?: "low" | "moderate" | "high";
    validFrom?: string | null;
    validTo?: string | null;
  }>;
  region?: string | null;
  error?: string;
};

const DEFAULT_CITY = "Praha,CZ";
const DEFAULT_REGION = "Praha";
const DESCRIPTION_MAP: Record<string, string> = {
  "clear sky": "jasno",
  "few clouds": "skoro jasno",
  "scattered clouds": "oblačno",
  "broken clouds": "zataženo",
  "overcast clouds": "zataženo",
  "mist": "mlha",
  "fog": "mlha",
  "haze": "opar",
  "smoke": "kouřmo",
  "dust": "prach",
  "sand": "písečno",
  "ash": "popel",
  "squalls": "poryvy větru",
  "tornado": "tornádo",
  "light rain": "slabý déšť",
  "moderate rain": "mírný déšť",
  "heavy intensity rain": "silný déšť",
  "very heavy rain": "velmi silný déšť",
  "extreme rain": "extrémní déšť",
  "freezing rain": "mrznoucí déšť",
  "light intensity shower rain": "slabé přeháňky",
  "shower rain": "přeháňky",
  "heavy intensity shower rain": "silné přeháňky",
  "ragged shower rain": "místy přeháňky",
  "light snow": "slabé sněžení",
  "snow": "sněžení",
  "heavy snow": "silné sněžení",
  "sleet": "sněhový déšť",
  "light shower sleet": "slabý sněhový déšť",
  "shower sleet": "sněhový déšť",
  "light rain and snow": "slabý déšť se sněhem",
  "rain and snow": "déšť se sněhem",
  "light shower snow": "slabé sněhové přeháňky",
  "shower snow": "sněhové přeháňky",
  "heavy shower snow": "silné sněhové přeháňky",
  "thunderstorm": "bouřka",
  "thunderstorm with light rain": "bouřka se slabým deštěm",
  "thunderstorm with rain": "bouřka s deštěm",
  "thunderstorm with heavy rain": "bouřka se silným deštěm",
  "thunderstorm with light drizzle": "bouřka se slabým mrholením",
  "thunderstorm with drizzle": "bouřka s mrholením",
  "thunderstorm with heavy drizzle": "bouřka se silným mrholením",
  "light intensity drizzle": "slabé mrholení",
  "drizzle": "mrholení",
  "heavy intensity drizzle": "silné mrholení",
  "light intensity drizzle rain": "slabý mrholivý déšť",
  "drizzle rain": "mrholivý déšť",
  "heavy intensity drizzle rain": "silný mrholivý déšť",
  "shower rain and drizzle": "přeháňky s mrholením",
  "heavy shower rain and drizzle": "silné přeháňky s mrholením",
  "shower drizzle": "mrholivé přeháňky",
};

const DEFAULT_REFRESH_MS = 10 * 60 * 1000;
const refreshMsRaw = Number(process.env.NEXT_PUBLIC_WEATHER_REFRESH_MS);
const WEATHER_REFRESH_MS =
  Number.isFinite(refreshMsRaw) && refreshMsRaw > 0 ? refreshMsRaw : DEFAULT_REFRESH_MS;

const toCzech = (value: string | null) => {
  if (!value) return value;
  const key = value.toLowerCase().trim();
  return DESCRIPTION_MAP[key] ?? value;
};

const normalizeText = (value: string | null) =>
  (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

const CHMU_REGION_MAP: Array<{ aliases: string[]; label: string }> = [
  { aliases: ["praha", "prague", "hlavni mesto praha"], label: "Praha" },
  { aliases: ["stredocesky", "stredocesky kraj", "central bohemian"], label: "Středočeský kraj" },
  { aliases: ["jihocesky", "jiznicesky", "south bohemian"], label: "Jihočeský kraj" },
  { aliases: ["plzensky", "pilsen"], label: "Plzeňský kraj" },
  { aliases: ["karlovarsky", "carlsbad"], label: "Karlovarský kraj" },
  { aliases: ["ustecky", "usti"], label: "Ústecký kraj" },
  { aliases: ["liberecky"], label: "Liberecký kraj" },
  { aliases: ["kralovehradecky", "hradec kralove"], label: "Královéhradecký kraj" },
  { aliases: ["pardubicky"], label: "Pardubický kraj" },
  { aliases: ["vysocina"], label: "Kraj Vysočina" },
  { aliases: ["jihomoravsky", "south moravian"], label: "Jihomoravský kraj" },
  { aliases: ["olomoucky"], label: "Olomoucký kraj" },
  { aliases: ["zlinsky"], label: "Zlínský kraj" },
  { aliases: ["moravskoslezsky", "moravian-silesian"], label: "Moravskoslezský kraj" },
];

const resolveRegionLabel = (stateOrCity: string | null) => {
  const normalized = normalizeText(stateOrCity);
  if (!normalized) return null;
  const match = CHMU_REGION_MAP.find((entry) =>
    entry.aliases.some((alias) => normalized.includes(normalizeText(alias))),
  );
  return match?.label ?? null;
};

export function useWeather() {
  const [state, setState] = useState<WeatherState>({
    loading: true,
    error: false,
    temp: null,
    description: null,
    icon: null,
    city: null,
    region: null,
    updatedAt: null,
    forecast: [],
    alerts: [],
    alertsError: false,
  });
  const hasFetchedRef = useRef(false);
  const cityRef = useRef<string | null>(null);
  const alertTestConfigRef = useRef<{ regionOverride: string | null; mockAlerts: boolean }>({
    regionOverride: null,
    mockAlerts: false,
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const regionOverride = params.get("weatherTestRegion");
    const mockAlerts = params.get("weatherMockAlerts") === "1";
    alertTestConfigRef.current = {
      regionOverride,
      mockAlerts,
    };
  }, []);

  const fetchWeather = useCallback(async (url: string, preserveForecast = false) => {
    const response = await fetch(url);
    if (!response.ok) {
      const errText = await response.text().catch(() => "");
      throw new Error(errText || "weather_fetch_failed");
    }
    const data = (await response.json()) as WeatherResponse & { dt?: number };
    const temp = typeof data?.main?.temp === "number" ? Math.round(data.main.temp) : null;
    const description = toCzech(data?.weather?.[0]?.description ?? null);
    const icon = data?.weather?.[0]?.icon ?? null;
    const city = data?.name ?? null;
    cityRef.current = city;
    const updatedAt = data?.dt ? new Date(data.dt * 1000).toISOString() : null;
    setState((prev) => ({
      loading: false,
      error: false,
      temp,
      description,
      icon,
      city,
      updatedAt,
      forecast: preserveForecast ? prev.forecast : [],
      alerts: prev.alerts,
      region: prev.region,
      alertsError: prev.alertsError,
    }));
  }, []);

  const loadWeather = useCallback(
    async (mode: "geo" | "city", showLoading = true) => {
      const apiKey = process.env.NEXT_PUBLIC_OPENWEATHER_API_KEY;
      if (!apiKey) {
        setState((prev) => ({ ...prev, loading: false, error: true }));
        return;
      }
      const buildUrl = (params: string) =>
        `https://api.openweathermap.org/data/2.5/weather?${params}&units=metric&lang=cs&appid=${apiKey}`;
      const buildForecastUrl = (params: string) =>
        `https://api.openweathermap.org/data/2.5/forecast?${params}&units=metric&lang=cs&appid=${apiKey}`;

      const formatDay = (date: Date) =>
        date
          .toLocaleDateString("cs-CZ", { weekday: "short" })
          .replace(".", "")
          .toLowerCase();

      const fetchForecast = async (url: string) => {
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error("forecast_fetch_failed");
        }
        const data = (await response.json()) as ForecastResponse;
        const list = data?.list ?? [];
        const groups = new Map<string, { min: number; max: number; date: Date; icon?: string }>();
        list.forEach((item) => {
          if (!item?.dt) return;
          const date = new Date(item.dt * 1000);
          const key = date.toISOString().slice(0, 10);
          const min = item?.main?.temp_min;
          const max = item?.main?.temp_max;
          const icon = item?.weather?.[0]?.icon;
          if (typeof min !== "number" || typeof max !== "number") return;
          const existing = groups.get(key);
          if (!existing) {
            groups.set(key, { min, max, date, icon });
            return;
          }
          existing.min = Math.min(existing.min, min);
          existing.max = Math.max(existing.max, max);
          if (!existing.icon && icon) {
            existing.icon = icon;
          }
        });

        const todayKey = new Date().toISOString().slice(0, 10);
        const days = Array.from(groups.entries())
          .filter(([key]) => key !== todayKey)
          .sort((a, b) => a[0].localeCompare(b[0]))
          .slice(0, 5)
          .map(([, value]) => ({
            day: formatDay(value.date),
            min: Math.round(value.min),
            max: Math.round(value.max),
            icon: value.icon ?? null,
          }));

        setState((prev) => ({ ...prev, forecast: days }));
      };

      const resolveRegion = async (latitude: number, longitude: number) => {
        try {
          const response = await fetch(
            `https://api.openweathermap.org/geo/1.0/reverse?lat=${latitude}&lon=${longitude}&limit=1&appid=${apiKey}`,
          );
          if (!response.ok) return null;
          const data = (await response.json()) as ReverseGeoResponse;
          const stateName = data?.[0]?.state ?? data?.[0]?.name ?? null;
          return resolveRegionLabel(stateName);
        } catch {
          return null;
        }
      };

      const fetchAlerts = async (region: string | null) => {
        const testConfig = alertTestConfigRef.current;
        const targetRegion = testConfig.regionOverride ?? region ?? cityRef.current ?? DEFAULT_REGION;

        if (testConfig.mockAlerts) {
          const now = Date.now();
          setState((prev) => ({
            ...prev,
            alertsError: false,
            region: targetRegion,
            alerts: [
              {
                id: "mock-high",
                title: "Velmi silný vítr (test)",
                description: "Testovací výstraha pro ověření vzhledu.",
                severity: "high",
                validFrom: new Date(now - 30 * 60 * 1000).toISOString(),
                validTo: new Date(now + 5 * 60 * 60 * 1000).toISOString(),
              },
              {
                id: "mock-moderate",
                title: "Náledí (test)",
                description: "Testovací výstraha pro ověření fallback stavu.",
                severity: "moderate",
                validFrom: new Date(now - 60 * 60 * 1000).toISOString(),
                validTo: new Date(now + 10 * 60 * 60 * 1000).toISOString(),
              },
            ],
          }));
          return;
        }

        try {
          const response = await fetch(`/api/weather/alerts?region=${encodeURIComponent(targetRegion)}`);
          if (!response.ok) {
            setState((prev) => ({ ...prev, alertsError: true }));
            return;
          }
          const data = (await response.json()) as AlertResponse;
          if (data.error) {
            setState((prev) => ({
              ...prev,
              alerts: [],
              alertsError: true,
              region: data.region ?? targetRegion,
            }));
            return;
          }
          const alerts = (data.alerts ?? [])
            .map((alert, idx) => ({
              id: alert.id ?? `${idx}`,
              title: alert.title ?? "Výstraha Meteoalarm",
              description: alert.description ?? null,
              severity: alert.severity ?? "low",
              validFrom: alert.validFrom ?? null,
              validTo: alert.validTo ?? null,
            }))
            .slice(0, 5);
          setState((prev) => ({
            ...prev,
            alerts,
            alertsError: false,
            region: data.region ?? targetRegion,
          }));
        } catch {
          setState((prev) => ({ ...prev, alertsError: true, region: targetRegion }));
        }
      };

      const fallback = async () => {
        try {
          await fetchWeather(buildUrl(`q=${encodeURIComponent(DEFAULT_CITY)}`), !showLoading);
          await fetchForecast(buildForecastUrl(`q=${encodeURIComponent(DEFAULT_CITY)}`));
          await fetchAlerts(DEFAULT_REGION);
        } catch (err) {
          console.error("weather fallback failed", err);
          setState((prev) => ({ ...prev, loading: false, error: true }));
        }
      };

      setState((prev) => ({
        ...prev,
        loading: showLoading ? true : prev.loading,
        error: false,
        alertsError: false,
      }));

      if (mode === "city") {
        await fallback();
        return;
      }

      if (typeof navigator === "undefined" || !navigator.geolocation) {
        await fallback();
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const { latitude, longitude } = pos.coords;
          void fetchWeather(buildUrl(`lat=${latitude}&lon=${longitude}`), !showLoading)
            .then(async () => {
              await fetchForecast(buildForecastUrl(`lat=${latitude}&lon=${longitude}`));
              const region = await resolveRegion(latitude, longitude);
              await fetchAlerts(region);
            })
            .catch(() => fallback());
        },
        () => {
          void fallback();
        },
        { timeout: 5000 },
      );
    },
    [fetchWeather],
  );

  useEffect(() => {
    if (!hasFetchedRef.current) {
      hasFetchedRef.current = true;
      void loadWeather("geo", true);
    }

    const interval = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      void loadWeather("geo", false);
    }, WEATHER_REFRESH_MS);

    return () => window.clearInterval(interval);
  }, [loadWeather]);

  return { ...state, refreshWithLocation: () => loadWeather("geo") };
}
