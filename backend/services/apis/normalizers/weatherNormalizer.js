const weatherCodeLookup = {
  0: "Clear sky",
  1: "Mainly clear",
  2: "Partly cloudy",
  3: "Overcast",
  45: "Fog",
  48: "Depositing rime fog",
  51: "Light drizzle",
  53: "Drizzle",
  55: "Dense drizzle",
  61: "Slight rain",
  63: "Rain",
  65: "Heavy rain",
  71: "Slight snow",
  73: "Snow",
  75: "Heavy snow",
  80: "Rain showers",
  81: "Strong rain showers",
  95: "Thunderstorm"
};

function weatherLabel(code) {
  return weatherCodeLookup[code] || "Unknown weather";
}

export function normalizeWeatherResult(api, raw, context = {}) {
  const current = raw.current || {};
  const daily = raw.daily || {};
  const normalized = {
    location: context.locationName || raw.timezone || "Unknown location",
    latitude: context.latitude,
    longitude: context.longitude,
    current: {
      temperatureC: current.temperature_2m ?? null,
      apparentTemperatureC: current.apparent_temperature ?? null,
      windSpeedKmh: current.wind_speed_10m ?? null,
      precipitationMm: current.precipitation ?? null,
      weatherCode: current.weather_code ?? null,
      weatherText: weatherLabel(current.weather_code)
    },
    forecast: Array.isArray(daily.time)
      ? daily.time.slice(0, 3).map((date, index) => ({
          date,
          minTempC: daily.temperature_2m_min?.[index] ?? null,
          maxTempC: daily.temperature_2m_max?.[index] ?? null,
          precipitationProbability:
            daily.precipitation_probability_max?.[index] ?? null,
          weatherText: weatherLabel(daily.weather_code?.[index])
        }))
      : []
  };

  const summaryText =
    context.capability === "forecast"
      ? `${normalized.location}: current ${normalized.current.temperatureC ?? "n/a"}°C, forecast ${normalized.forecast
          .map(
            (day) =>
              `${day.date}: ${day.minTempC ?? "n/a"}-${day.maxTempC ?? "n/a"}°C, ${day.weatherText}`
          )
          .join(" | ")}`
      : `${normalized.location}: ${normalized.current.temperatureC ?? "n/a"}°C, ${normalized.current.weatherText}, wind ${normalized.current.windSpeedKmh ?? "n/a"} km/h`;

  return {
    sourceType: "api",
    sourceName: api.name,
    capability: context.capability,
    raw,
    normalized,
    summaryText
  };
}

