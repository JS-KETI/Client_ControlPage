import { useState, useRef, useMemo } from 'react';
import { useDeviceStore } from './hooks/useDeviceStore';
import { useWebSocket } from './hooks/useWebSocket';
import { VideoGrid } from './components/VideoGrid';
import { DeviceModal } from './components/DeviceModal';
import { LlmSidebar } from './components/LlmSidebar';
import { WeatherPanel } from './components/WeatherPanel';
import type { DeviceSummary } from './types';
import '@moq/watch/element';
import './App.css';

const WS_URL = `ws://${window.location.host}/ws/monitoring`;

function App() {
  const { devices, handleSnapshot, handleUpsert, handleRemove } = useDeviceStore();
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useWebSocket({
    url: WS_URL,
    onSnapshot: (payload) => handleSnapshot(payload.devices),
    onDeviceUpsert: (payload) => handleUpsert(payload.device),
    onDeviceRemove: (payload) => handleRemove(payload.deviceId),
  });

  const deviceList = useMemo(() => Array.from(devices.values()), [devices]);
  const selectedDevice = selectedDeviceId ? devices.get(selectedDeviceId) : null;

  const handleDeviceClick = (device: DeviceSummary) => {
    setSelectedDeviceId(device.deviceId);
    setModalVisible(true);
  };

  const handleModalClose = () => {
    setModalVisible(false);
    // selectedDeviceId를 유지하여 MoqVideo 연결 보존
  };

  return (
    <div className="app">
      <header className="app-header">
        <h1>MoQ 관제 시스템</h1>
        <nav className="tab-bar">
          <button className="tab active">모니터링</button>
          <button className="tab">히스토리</button>
          <button className="tab">설정</button>
        </nav>
        <WeatherPanel />
        <div className="device-count">연결 기기: {deviceList.length}대</div>
      </header>

      <main className="app-main">
        <VideoGrid devices={deviceList} onDeviceClick={handleDeviceClick} />
      </main>

      {selectedDevice && (
        <div style={{ display: modalVisible ? 'block' : 'none' }}>
          <DeviceModal device={selectedDevice} onClose={handleModalClose} />
        </div>
      )}

      <button className="fab" onClick={() => setSidebarOpen(true)}>
        AI
      </button>

      <LlmSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
    </div>
  );
}

export default App;
