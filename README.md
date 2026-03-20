# Client_ControlPage

MoQ 관제 시스템 — 드론/CCTV 통합 모니터링 관제 페이지.

## 스택
- React 19 + TypeScript + Vite

## 주요 기능
- 3×3 그리드 실시간 영상 모니터링 (최대 9개 카드, 좌상단부터 채움)
- WebSocket `/ws/monitoring` — snapshot/device_upsert/device_remove
- @moq/watch JS API (웹 컴포넌트 아님) → WebTransport 영상 수신
- 배터리 색상: >50% 초록, 15~50% 주황, ≤15% 빨강
- LLM 사이드바 채팅 인터페이스
- 카드 클릭 시 상세 오버레이 모달

## @moq/watch JS API 사용
```typescript
const connection = new Moq.Connection.Reload(relayUrl);
const broadcast = new Watch.Broadcast(connection, broadcastPath);
const backend = new Watch.MultiBackend(broadcast);
const sync = new Watch.Sync(backend, canvasElement);
```

## relay URL
Spring Boot REST 응답의 relayUrl + broadcastPath 사용.
Publisher가 relay URL을 등록하지 않으며, 서버 설정값을 브라우저에 전달.

## 개발 서버
npm run dev

## 빌드
npm run build
