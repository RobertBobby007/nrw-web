"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type WeatherState = {
  loading: boolean;
  error: boolean;
  temp: number | null;
  description: string | null;
  icon: string | null;
  city: string | null;
  updatedAt: string | null;
  forecast: Array<{ day: string; min: number; max: number; icon: string | null }>;
};

type WeatherResponse = {
  main?: { temp?: number };
  weather?: Array<{ description?: string; icon?: string }>;
  name?: string;
};
type ForecastResponse = {
  list?: Array<{ dt?: number; main?: { temp_min?: number; temp_max?: number }; weather?: Array<{ icon?: string }> }>;
};

const DEFAULT_CITY = "Praha,CZ";
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

const toCzech = (value: string | null) => {
  if (!value) return value;
  const key = value.toLowerCase().trim();
  return DESCRIPTION_MAP[key] ?? value;
};

export function useWeather() {
  const [state, setState] = useState<WeatherState>({
    loading: true,
    error: false,
    temp: null,
    description: null,
    icon: null,
    city: null,
    updatedAt: null,
    forecast: [],
  });
  const hasFetchedRef = useRef(false);

  const fetchWeather = useCallback(async (url: string) => {
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
    const updatedAt = data?.dt ? new Date(data.dt * 1000).toISOString() : null;
    setState({
      loading: false,
      error: false,
      temp,
      description,
      icon,
      city,
      updatedAt,
      forecast: [],
    });
  }, []);

  const loadWeather = useCallback(
    async (mode: "geo" | "city") => {
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

      const fallback = async () => {
        try {
          await fetchWeather(buildUrl(`q=${encodeURIComponent(DEFAULT_CITY)}`));
          await fetchForecast(buildForecastUrl(`q=${encodeURIComponent(DEFAULT_CITY)}`));
        } catch (err) {
          console.error("weather fallback failed", err);
          setState((prev) => ({ ...prev, loading: false, error: true }));
        }
      };

      setState((prev) => ({ ...prev, loading: true, error: false }));

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
          void fetchWeather(buildUrl(`lat=${latitude}&lon=${longitude}`))
            .then(() => fetchForecast(buildForecastUrl(`lat=${latitude}&lon=${longitude}`)))
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
    if (hasFetchedRef.current) return;
    hasFetchedRef.current = true;
    void loadWeather("geo");
  }, [loadWeather]);

  return { ...state, refreshWithLocation: () => loadWeather("geo") };
}
