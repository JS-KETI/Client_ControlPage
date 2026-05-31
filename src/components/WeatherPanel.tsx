import { useState, useEffect } from 'react';

interface WeatherData {
  rainfall: number;
  windSpeed: number;
  locationName: string | null;
  available: boolean;
}

interface FlightCriteria {
  maxWindSpeed: number;
  maxRainfall: number;
}

type Status = 'loading' | 'ready' | 'no-location' | 'error';

export function WeatherPanel() {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [status, setStatus] = useState<Status>('loading');
  const [criteria, setCriteria] = useState<FlightCriteria>({ maxWindSpeed: 10, maxRainfall: 5 });

  // 비행 판단 기준값 로드 (Settings에서 설정한 값 — 경고 임계값으로 사용)
  useEffect(() => {
    fetch('/api/flight-criteria')
      .then(res => res.json())
      .then(data => { if (data.data) setCriteria(data.data); })
      .catch(() => {});
  }, []);

  // 브라우저 위치 기반 날씨 로드
  useEffect(() => {
    let cancelled = false;

    const fetchWeather = (lat: number, lon: number) => {
      fetch(`/api/weather?lat=${lat}&lon=${lon}`)
        .then(res => res.json())
        .then(data => {
          if (cancelled) return;
          if (data.data && data.data.available) {
            setWeather(data.data);
            setStatus('ready');
          } else {
            setStatus('error');
          }
        })
        .catch(() => { if (!cancelled) setStatus('error'); });
    };

    const requestLocation = () => {
      if (!navigator.geolocation) {
        setStatus('no-location');
        return;
      }
      navigator.geolocation.getCurrentPosition(
        pos => fetchWeather(pos.coords.latitude, pos.coords.longitude),
        () => { if (!cancelled) setStatus('no-location'); },
        { enableHighAccuracy: false, timeout: 10000, maximumAge: 600000 }
      );
    };

    requestLocation();
    // 10분마다 위치·날씨 갱신
    const timer = setInterval(requestLocation, 10 * 60 * 1000);
    return () => { cancelled = true; clearInterval(timer); };
  }, []);

  if (status === 'loading') {
    return (
      <div className="weather-panel">
        <span className="weather-label">Weather</span>
        <div className="weather-display"><span>…</span></div>
      </div>
    );
  }

  if (status === 'no-location') {
    return (
      <div className="weather-panel">
        <span className="weather-label">Weather</span>
        <div className="weather-display"><span>위치 권한 필요</span></div>
      </div>
    );
  }

  if (status === 'error' || !weather) {
    return (
      <div className="weather-panel">
        <span className="weather-label">Weather</span>
        <div className="weather-display"><span>날씨 정보 없음</span></div>
      </div>
    );
  }

  const rainfallWarning = weather.rainfall >= criteria.maxRainfall;
  const windWarning = weather.windSpeed >= criteria.maxWindSpeed;

  return (
    <div className="weather-panel">
      <span className="weather-label">
        Weather{weather.locationName ? ` · ${weather.locationName}` : ''}
      </span>
      <div className="weather-display">
        <span className={rainfallWarning ? 'warn' : ''}>Rain {weather.rainfall}mm</span>
        <span className={windWarning ? 'warn' : ''}>Wind {weather.windSpeed}m/s</span>
        {(rainfallWarning || windWarning) && <span className="flight-warn">Unsafe to fly</span>}
      </div>
    </div>
  );
}
