import { useMemo, useRef, useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import type { LatLngExpression } from 'leaflet';
import type { DeviceSummary } from '../types';
import 'leaflet/dist/leaflet.css';
import './MapPip.css';

const SEOUL: LatLngExpression = [37.5665, 126.978];
const INITIAL_ZOOM = 15;

const ESRI_SATELLITE =
  'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
const ESRI_LABELS =
  'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}';

// 이미지 에셋 없는 자체 완결 드론 마커 — Vite 에셋 경로 문제 원천 회피.
const droneIcon = L.divIcon({
  className: 'drone-marker',
  html: `
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none"
         xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <circle cx="12" cy="12" r="11" fill="#3b82f6" fill-opacity="0.18"
              stroke="#3b82f6" stroke-width="1.5"/>
      <circle cx="5" cy="5" r="2.4" fill="#3b82f6"/>
      <circle cx="19" cy="5" r="2.4" fill="#3b82f6"/>
      <circle cx="5" cy="19" r="2.4" fill="#3b82f6"/>
      <circle cx="19" cy="19" r="2.4" fill="#3b82f6"/>
      <rect x="9.2" y="9.2" width="5.6" height="5.6" rx="1.4" fill="#f8fafc"/>
      <line x1="6.7" y1="6.7" x2="9.8" y2="9.8" stroke="#3b82f6" stroke-width="1.4"/>
      <line x1="17.3" y1="6.7" x2="14.2" y2="9.8" stroke="#3b82f6" stroke-width="1.4"/>
      <line x1="6.7" y1="17.3" x2="9.8" y2="14.2" stroke="#3b82f6" stroke-width="1.4"/>
      <line x1="17.3" y1="17.3" x2="14.2" y2="14.2" stroke="#3b82f6" stroke-width="1.4"/>
    </svg>`,
  iconSize: [28, 28],
  iconAnchor: [14, 14],
  popupAnchor: [0, -14],
});

interface LocatedDevice {
  deviceId: string;
  position: LatLngExpression;
  missionStatus: string | null;
}

/** 첫 디바이스(empty -> located 전환) 등장 시 1회만 recenter. 이후 telemetry로 시야를 흔들지 않음. */
function RecenterOnFirstFix({ center }: { center: LatLngExpression | null }) {
  const map = useMap();
  const hasCentered = useRef(false);
  useEffect(() => {
    if (center && !hasCentered.current) {
      map.setView(center, map.getZoom());
      hasCentered.current = true;
    }
  }, [center, map]);
  return null;
}

interface Props {
  devices: DeviceSummary[];
}

export function MapPip({ devices }: Props) {
  const [collapsed, setCollapsed] = useState(false);

  // 좌표 둘 다 있는 디바이스만. deviceList ref가 WS 갱신마다 바뀌므로 마커 자동 동기화.
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

  const firstFix = located.length > 0 ? located[0].position : null;

  return (
    <div className={`map-pip ${collapsed ? 'collapsed' : ''}`}>
      <div className="map-pip-header">
        <span className="map-pip-title">Satellite · {located.length} located</span>
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

      {/* 접힘 시 MapContainer 언마운트 → 재펼침 때 실제 크기로 재mount되어 zero-size/invalidateSize 문제 없음 */}
      {!collapsed && (
        <div className="map-pip-body">
          <MapContainer
            center={firstFix ?? SEOUL}
            zoom={INITIAL_ZOOM}
            className="map-pip-leaflet"
            zoomControl={false}
            attributionControl={true}
          >
            <TileLayer url={ESRI_SATELLITE} attribution="Tiles &copy; Esri" />
            <TileLayer url={ESRI_LABELS} />
            <RecenterOnFirstFix center={firstFix} />
            {located.map((d) => (
              <Marker key={d.deviceId} position={d.position} icon={droneIcon}>
                <Popup>
                  <strong>{d.deviceId}</strong>
                  <br />
                  {d.missionStatus ?? 'no mission'}
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        </div>
      )}
    </div>
  );
}
