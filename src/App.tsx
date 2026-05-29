import { useState, useMemo, useCallback } from 'react';
import { useDeviceStore } from './hooks/useDeviceStore';
import { useWebSocket } from './hooks/useWebSocket';
import { VideoGrid } from './components/VideoGrid';
import { GridSelector } from './components/GridSelector';
import { DeviceModal } from './components/DeviceModal';
import { LlmSidebar } from './components/LlmSidebar';
import { WeatherPanel } from './components/WeatherPanel';
import type { DeviceSummary } from './types';
import '@moq/watch/element';
import './App.css';

const WS_PROTOCOL = window.location.protocol === 'https:' ? 'wss' : 'ws';
const WS_URL = `${WS_PROTOCOL}://${window.location.host}/ws/monitoring`;

function App() {
  const { devices, handleSnapshot, handleUpsert, handleRemove } = useDeviceStore();
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [gridCount, setGridCount] = useState(4);

  useWebSocket({
    url: WS_URL,
    onSnapshot: (payload) => handleSnapshot(payload.devices),
    onDeviceUpsert: (payload) => handleUpsert(payload.device),
    onDeviceRemove: (payload) => handleRemove(payload.deviceId),
  });

  const deviceList = useMemo(() => Array.from(devices.values()), [devices]);
  const selectedDevice = selectedDeviceId ? devices.get(selectedDeviceId) : null;

  const handleDeviceClick = useCallback((device: DeviceSummary) => {
    setSelectedDeviceId(prev => prev === device.deviceId ? null : device.deviceId);
  }, []);

  const handlePanelClose = useCallback(() => {
    setSelectedDeviceId(null);
  }, []);

  return (
    <div className="app">
      <header className="app-header">
        <h1>MoQ Control System</h1>
        <nav className="tab-bar">
          <button className="tab active">Monitoring</button>
          <button className="tab">History</button>
          <button className="tab">Settings</button>
        </nav>
        <WeatherPanel />
        <div className="device-count">Connected: {deviceList.length}</div>
      </header>

      <main className="app-main">
        <VideoGrid
          devices={deviceList}
          onDeviceClick={handleDeviceClick}
          expandedDeviceId={selectedDeviceId}
          gridCount={gridCount}
        />
        <GridSelector value={gridCount} onChange={setGridCount} />
      </main>

      {selectedDevice && (
        <DeviceModal device={selectedDevice} onClose={handlePanelClose} />
      )}

      <button className="fab" onClick={() => setSidebarOpen(true)}>
        AI
      </button>

      <LlmSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
    </div>
  );
}

export default App;
