import { useState, useRef, useEffect } from 'react';

interface AvailableModel {
  id: string;
  label: string;
}

interface ToolResult {
  status: string;
  toolName: string;
  data: unknown;
  message: string | null;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  toolResults?: ToolResult[];
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

async function captureAndUpload(deviceId: string, imageRef: string): Promise<boolean> {
  const video = document.querySelector(
    `video[data-device-id="${deviceId}"], video[data-device-id]`
  ) as HTMLVideoElement | null;
  if (!video || video.videoWidth === 0) return false;

  const canvas = document.createElement('canvas');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  canvas.getContext('2d')!.drawImage(video, 0, 0);

  const blob = await new Promise<Blob | null>(resolve =>
    canvas.toBlob(resolve, 'image/jpeg', 0.85)
  );
  if (!blob) return false;

  const form = new FormData();
  form.append('image', blob, 'capture.jpg');
  const res = await fetch(`/api/images/${imageRef}`, { method: 'POST', body: form });
  return res.ok;
}

export function LlmSidebar({ isOpen, onClose }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [models, setModels] = useState<AvailableModel[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>('');
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch('/api/llm/models')
      .then(res => res.json())
      .then(data => {
        if (data.data) {
          setModels(data.data);
          if (data.data.length > 0 && !selectedModel) {
            setSelectedModel(data.data[0].id);
          }
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async () => {
    const userMsg = input.trim();
    if (!userMsg || loading) return;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setLoading(true);

    try {
      // 1차 호출
      const res = await fetch('/api/llm/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMsg,
          conversationId: null,
          model: selectedModel || null,
        }),
      });
      const data = await res.json();
      const pendingCaptureToken: string | undefined = data.data?.pendingCaptureToken;

      if (pendingCaptureToken) {
        setMessages(prev => [...prev, { role: 'assistant', content: '영상 프레임 분석 중...' }]);

        // deviceId는 토큰에서 추출 (형식: "DRONE-001_1711...")
        const deviceId = pendingCaptureToken.split('_').slice(0, -1).join('_');

        // JPEG blob을 multipart로 서버에 업로드 (base64 변환 없음)
        const uploaded = await captureAndUpload(deviceId, pendingCaptureToken);

        // 2차 호출: pendingToken + imageRef로 재진입 (이미지 데이터 없이 참조만)
        const res2 = await fetch('/api/llm/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: userMsg,
            conversationId: null,
            model: selectedModel || null,
            pendingToken: pendingCaptureToken,
            pendingResult: uploaded
              ? { deviceId, imageRef: pendingCaptureToken }
              : { deviceId, error: '영상 프레임을 캡처할 수 없습니다.' },
          }),
        });
        const data2 = await res2.json();
        const reply = data2.data?.reply || 'LLM 응답을 받을 수 없습니다.';
        const toolResults = data2.data?.toolResults || [];
        setMessages(prev => [...prev.slice(0, -1), { role: 'assistant', content: reply, toolResults }]);
        return;
      }

      const reply = data.data?.reply || 'LLM 응답을 받을 수 없습니다.';
      const toolResults = data.data?.toolResults || [];
      setMessages(prev => [...prev, { role: 'assistant', content: reply, toolResults }]);
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: '서버 연결 실패' }]);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="llm-sidebar">
      <div className="sidebar-header">
        <h3>AI 어시스턴트</h3>
        <button onClick={onClose}>&#x2715;</button>
      </div>

      <div className="sidebar-model-select">
        <select value={selectedModel} onChange={e => setSelectedModel(e.target.value)}>
          {models.map(m => (
            <option key={m.id} value={m.id}>{m.label}</option>
          ))}
        </select>
      </div>

      <div className="sidebar-chat">
        {messages.map((msg, i) => (
          <div key={i}>
            <div className={`chat-msg ${msg.role}`}>
              {msg.content}
            </div>
            {msg.toolResults && msg.toolResults.length > 0 && (
              <div className="tool-results">
                {msg.toolResults.map((tr, j) => (
                  <div key={j} className="tool-result-item">
                    <span className="tool-name">{tr.toolName}</span>
                    <span className={`tool-status ${tr.status}`}>{tr.status}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
        {loading && <div className="chat-msg assistant loading">응답 생성 중...</div>}
        <div ref={chatEndRef} />
      </div>
      <div className="sidebar-input">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && sendMessage()}
          placeholder="명령을 입력하세요..."
        />
        <button onClick={() => sendMessage()} disabled={loading}>전송</button>
      </div>
    </div>
  );
}
