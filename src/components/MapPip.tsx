import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Tooltip, useMap } from 'react-leaflet';
import L from 'leaflet';
import type { LatLngExpression } from 'leaflet';
import type { DeviceSummary } from '../types';
import 'leaflet/dist/leaflet.css';
import './MapPip.css';

const SEOUL: LatLngExpression = [37.5665, 126.978];
const INITIAL_ZOOM = 15;
const HIGHLIGHT_MS = 4000;

const ESRI_SATELLITE =
  'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
const ESRI_LABELS =
  'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}';

type SizeKey = 'sm' | 'md' | 'lg';
const SIZES: Record<SizeKey, { w: number; h: number }> = {
  sm: { w: 300, h: 200 },
  md: { w: 430, h: 300 },
  lg: { w: 600, h: 430 },
};

// 이미지 에셋 없는 자체 완결 드론 마커 — Vite 에셋 경로 문제 원천 회피.
function droneSvg(color: string): string {
  return `
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none"
         xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <circle cx="12" cy="12" r="11" fill="${color}" fill-opacity="0.18"
              stroke="${color}" stroke-width="1.5"/>
      <circle cx="5" cy="5" r="2.4" fill="${color}"/>
      <circle cx="19" cy="5" r="2.4" fill="${color}"/>
      <circle cx="5" cy="19" r="2.4" fill="${color}"/>
      <circle cx="19" cy="19" r="2.4" fill="${color}"/>
      <rect x="9.2" y="9.2" width="5.6" height="5.6" rx="1.4" fill="#f8fafc"/>
      <line x1="6.7" y1="6.7" x2="9.8" y2="9.8" stroke="${color}" stroke-width="1.4"/>
      <line x1="17.3" y1="6.7" x2="14.2" y2="9.8" stroke="${color}" stroke-width="1.4"/>
      <line x1="6.7" y1="17.3" x2="9.8" y2="14.2" stroke="${color}" stroke-width="1.4"/>
      <line x1="17.3" y1="17.3" x2="14.2" y2="14.2" stroke="${color}" stroke-width="1.4"/>
    </svg>`;
}

function makeDroneIcon(highlighted: boolean): L.DivIcon {
  const color = highlighted ? '#f59e0b' : '#3b82f6';
  return L.divIcon({
    className: `drone-marker${highlighted ? ' highlighted' : ''}`,
    html: `<span class="drone-pulse"></span>${droneSvg(color)}`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -16],
    tooltipAnchor: [0, -12],
  });
}

const NORMAL_ICON = makeDroneIcon(false);
const HIGHLIGHT_ICON = makeDroneIcon(true);

interface LocatedDevice {
  deviceId: string;
  position: LatLngExpression;
  missionStatus: string | null;
}

/** 컨테이너 크기가 바뀌면 Leaflet에 알림(프리셋 크기 변경 시 타일 재정렬). */
function InvalidateOnResize() {
  const map = useMap();
  useEffect(() => {
    const ro = new ResizeObserver(() => map.invalidateSize());
    ro.observe(map.getContainer());
    return () => ro.disconnect();
  }, [map]);
  return null;
}

/** 새 기기 등장 시 전체가 보이도록 fitBounds + 새 기기 id를 상위로 통지. */
function MapEffects({
  located,
  onFresh,
}: {
  located: LocatedDevice[];
  onFresh: (ids: string[]) => void;
}) {
  const map = useMap();
  const seen = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (located.length === 0) {
      seen.current = new Set();
      return;
    }
    const fresh = located.filter((d) => !seen.current.has(d.deviceId));
    seen.current = new Set(located.map((d) => d.deviceId));
    if (fresh.length > 0) {
      map.fitBounds(L.latLngBounds(located.map((d) => d.position)), {
        maxZoom: 16,
        padding: [30, 30],
      });
      onFresh(fresh.map((d) => d.deviceId));
    }
  }, [located, map, onFresh]);

  return null;
}

interface Props {
  devices: DeviceSummary[];
}

export function MapPip({ devices }: Props) {
  const [collapsed, setCollapsed] = useState(false);
  const [size, setSize] = useState<SizeKey>('md');
  const [highlighted, setHighlighted] = useState<Set<string>>(new Set());
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  // 좌표 둘 다 있는 디바이스만. deviceList ref가 WS 갱신마다 바뀌므로 자동 동기화.
  const located = useMemo<LocatedDevice[]>(
    () =>
      devices
        .filter(
          (d): d is DeviceSummary & { latitude: number; longitude: number } =>
            d.latitude != null && d.longitude != null,
        )
        .map((d) => ({
          deviceId: d.deviceId,
          position: [d.latitude, d.longitude] as LatLngExpression,
          missionStatus: d.missionStatus,
        })),
    [devices],
  );

  // 새 기기를 잠시(HIGHLIGHT_MS) 강조 표시.
  const handleFresh = useCallback((ids: string[]) => {
    setHighlighted((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => next.add(id));
      return next;
    });
    ids.forEach((id) => {
      const existing = timers.current.get(id);
      if (existing) clearTimeout(existing);
      const t = setTimeout(() => {
        setHighlighted((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
        timers.current.delete(id);
      }, HIGHLIGHT_MS);
      timers.current.set(id, t);
    });
  }, []);

  useEffect(() => {
    const t = timers.current;
    return () => {
      t.forEach((timer) => clearTimeout(timer));
      t.clear();
    };
  }, []);

  const firstFix = located.length > 0 ? located[0].position : null;

  return (
    <div className={`map-pip ${collapsed ? 'collapsed' : ''}`} style={{ width: SIZES[size].w }}>
      <div className="map-pip-header">
        <span className="map-pip-title">Satellite · {located.length} located</span>
        <div className="map-pip-controls">
          {!collapsed && (
            <div className="map-pip-sizes">
              {(['sm', 'md', 'lg'] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  className={`size-btn ${size === s ? 'active' : ''}`}
                  onClick={() => setSize(s)}
                  title={`${s.toUpperCase()} 크기`}
                >
                  {s === 'sm' ? 'S' : s === 'md' ? 'M' : 'L'}
                </button>
              ))}
            </div>
          )}
          <button
            type="button"
            className="map-pip-toggle"
            onClick={() => setCollapsed((c) => !c)}
            aria-label={collapsed ? 'Expand map' : 'Collapse map'}
            title={collapsed ? 'Expand map' : 'Collapse map'}
          >
            {collapsed ? '▢' : '—'}
          </button>
        </div>
      </div>

      {/* 접힘 시 MapContainer 언마운트 → 재펼침 때 실제 크기로 재mount(zero-size 문제 없음) */}
      {!collapsed && (
        <div className="map-pip-body" style={{ height: SIZES[size].h }}>
          <MapContainer
            center={firstFix ?? SEOUL}
            zoom={INITIAL_ZOOM}
            className="map-pip-leaflet"
            zoomControl={false}
            attributionControl={true}
          >
            <TileLayer url={ESRI_SATELLITE} attribution="Tiles &copy; Esri" />
            <TileLayer url={ESRI_LABELS} />
            <InvalidateOnResize />
            <MapEffects located={located} onFresh={handleFresh} />
            {located.map((d) => {
              const isHot = highlighted.has(d.deviceId);
              return (
                <Marker
                  key={d.deviceId}
                  position={d.position}
                  icon={isHot ? HIGHLIGHT_ICON : NORMAL_ICON}
                  zIndexOffset={isHot ? 1000 : 0}
                >
                  <Tooltip permanent direction="top" className="device-tag">
                    {d.deviceId}
                  </Tooltip>
                  <Popup>
                    <strong>{d.deviceId}</strong>
                    <br />
                    {d.missionStatus ?? 'no mission'}
                  </Popup>
                </Marker>
              );
            })}
          </MapContainer>
        </div>
      )}
    </div>
  );
}
