import { useState, useEffect } from 'react';

interface WeatherData {
  rainfall: number;
  windSpeed: number;
}

export function WeatherPanel() {
  const [weather, setWeather] = useState<WeatherData>({ rainfall: 0, windSpeed: 3.5 });
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<WeatherData>({ rainfall: 0, windSpeed: 3.5 });

  useEffect(() => {
    fetch('/api/weather')
      .then(res => res.json())
      .then(data => {
        if (data.data) {
          setWeather(data.data);
          setDraft(data.data);
        }
      })
      .catch(() => {});
  }, []);

  const save = async () => {
    try {
      const res = await fetch('/api/weather', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draft),
      });
      const data = await res.json();
      if (data.data) {
        setWeather(data.data);
        setEditing(false);
      }
    } catch { /* ignore */ }
  };

  const rainfallWarning = weather.rainfall >= 5;
  const windWarning = weather.windSpeed >= 10;

  return (
    <div className="weather-panel">
      <span className="weather-label">기상</span>
      {editing ? (
        <div className="weather-edit">
          <label>
            강수량
            <input
              type="number"
              step="0.1"
              min="0"
              value={draft.rainfall}
              onChange={e => setDraft({ ...draft, rainfall: parseFloat(e.target.value) || 0 })}
            />
            mm
          </label>
          <label>
            풍속
            <input
              type="number"
              step="0.1"
              min="0"
              value={draft.windSpeed}
              onChange={e => setDraft({ ...draft, windSpeed: parseFloat(e.target.value) || 0 })}
            />
            m/s
          </label>
          <button className="weather-btn save" onClick={save}>저장</button>
          <button className="weather-btn cancel" onClick={() => { setDraft(weather); setEditing(false); }}>취소</button>
        </div>
      ) : (
        <div className="weather-display" onClick={() => setEditing(true)} title="클릭하여 수정">
          <span className={rainfallWarning ? 'warn' : ''}>강수 {weather.rainfall}mm</span>
          <span className={windWarning ? 'warn' : ''}>풍속 {weather.windSpeed}m/s</span>
          {(rainfallWarning || windWarning) && <span className="flight-warn">비행부적합</span>}
        </div>
      )}
    </div>
  );
}
