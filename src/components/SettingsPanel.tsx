import { useState, useEffect } from 'react';

interface FlightCriteria {
  maxWindSpeed: number;
  maxRainfall: number;
}

export function SettingsPanel() {
  const [criteria, setCriteria] = useState<FlightCriteria>({ maxWindSpeed: 10, maxRainfall: 5 });
  const [draft, setDraft] = useState<FlightCriteria>({ maxWindSpeed: 10, maxRainfall: 5 });
  const [toast, setToast] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch('/api/flight-criteria')
      .then(res => res.json())
      .then(data => {
        if (data.data) {
          setCriteria(data.data);
          setDraft(data.data);
        }
      })
      .catch(() => {});
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/flight-criteria', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draft),
      });
      const data = await res.json();
      if (data.data) {
        setCriteria(data.data);
        setToast(`풍속 ${data.data.maxWindSpeed}m/s · 강수량 ${data.data.maxRainfall}mm 기준으로 저장되었습니다`);
        setTimeout(() => setToast(null), 3000);
      } else {
        throw new Error('no data');
      }
    } catch {
      setToast('저장에 실패했습니다');
      setTimeout(() => setToast(null), 3000);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="settings-panel">
      <h2>비행 판단 기준 설정</h2>
      <p className="settings-desc">
        AI 에이전트가 드론 비행 가능 여부를 판단하는 기준값입니다.<br />
        현재 기준: 풍속 <strong>{criteria.maxWindSpeed}m/s</strong> · 강수량 <strong>{criteria.maxRainfall}mm</strong> 이상이면 비행 불가
      </p>

      <div className="settings-field">
        <label htmlFor="maxWindSpeed">최대 풍속 (m/s)</label>
        <input
          id="maxWindSpeed"
          type="number" step="0.1" min="0"
          value={draft.maxWindSpeed}
          onChange={e => setDraft({ ...draft, maxWindSpeed: parseFloat(e.target.value) || 0 })}
        />
        <span className="settings-hint">이 값 이상이면 비행 부적합</span>
      </div>

      <div className="settings-field">
        <label htmlFor="maxRainfall">최대 강수량 (mm)</label>
        <input
          id="maxRainfall"
          type="number" step="0.1" min="0"
          value={draft.maxRainfall}
          onChange={e => setDraft({ ...draft, maxRainfall: parseFloat(e.target.value) || 0 })}
        />
        <span className="settings-hint">이 값 이상이면 비행 부적합</span>
      </div>

      <button className="settings-save" onClick={save} disabled={saving}>
        {saving ? '저장 중…' : '저장'}
      </button>

      {toast && <div className="settings-toast">{toast}</div>}
    </div>
  );
}
