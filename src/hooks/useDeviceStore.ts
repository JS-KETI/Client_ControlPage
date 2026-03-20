import { useReducer, useCallback } from 'react';
import type { DeviceSummary } from '../types';

type Action =
  | { type: 'SNAPSHOT'; devices: DeviceSummary[] }
  | { type: 'UPSERT'; device: DeviceSummary }
  | { type: 'REMOVE'; deviceId: string };

function deviceReducer(state: Map<string, DeviceSummary>, action: Action): Map<string, DeviceSummary> {
  switch (action.type) {
    case 'SNAPSHOT': {
      const map = new Map<string, DeviceSummary>();
      action.devices.forEach(d => map.set(d.deviceId, d));
      return map;
    }
    case 'UPSERT': {
      const map = new Map(state);
      map.set(action.device.deviceId, action.device);
      return map;
    }
    case 'REMOVE': {
      const map = new Map(state);
      map.delete(action.deviceId);
      return map;
    }
    default:
      return state;
  }
}

export function useDeviceStore() {
  const [devices, dispatch] = useReducer(deviceReducer, new Map<string, DeviceSummary>());

  const handleSnapshot = useCallback((deviceList: DeviceSummary[]) => {
    dispatch({ type: 'SNAPSHOT', devices: deviceList });
  }, []);

  const handleUpsert = useCallback((device: DeviceSummary) => {
    dispatch({ type: 'UPSERT', device });
  }, []);

  const handleRemove = useCallback((deviceId: string) => {
    dispatch({ type: 'REMOVE', deviceId });
  }, []);

  return { devices, handleSnapshot, handleUpsert, handleRemove };
}
