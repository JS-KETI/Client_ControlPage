import { useState, useRef, useEffect } from 'react';

interface AvailableModel {
  id: string;
  label: string;
}

interface LlmField {
  label: string;
  value: string;
}

interface LlmJsonResponse {
  type: 'final_answer' | 'follow_up';
  message: string;
  fields?: LlmField[];
}

interface ToolStep {
  name: string;
  status: 'running' | 'success' | 'error';
  summary?: string;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  parsed?: LlmJsonResponse | null;
  steps?: ToolStep[];
  streaming?: boolean;
  elapsedSec?: number;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

const TOOL_LABELS: Record<string, string> = {
  list_devices: '디바이스 목록 조회',
  get_device_status: '디바이스 상태 조회',
  get_weather: '기상 정보 조회',
  capture_photo: '영상 캡처',
  analyze_image: '이미지 분석',
};

function toolLabel(name: string): string {
  return TOOL_LABELS[name] || name;
}

function tryParseJson(text: string): LlmJsonResponse | null {
  try {
    let trimmed = text.trim();
    if (trimmed.startsWith('```')) {
      const start = trimmed.indexOf('{');
      const end = trimmed.lastIndexOf('}');
      if (start >= 0 && end > start) trimmed = trimmed.substring(start, end + 1);
    }
    if (!trimmed.startsWith('{')) return null;
    const parsed = JSON.parse(trimmed);
    if (parsed.type && parsed.message) return parsed as LlmJsonResponse;
    return null;
  } catch {
    return null;
  }
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

// SSE 청크("event:...\ndata:...") 파싱
function parseSseChunk(raw: string): { event: string; data: unknown } | null {
  let event = 'message';
  let data = '';
  for (const line of raw.split('\n')) {
    if (line.startsWith('event:')) event = line.slice(6).trim();
    else if (line.startsWith('data:')) data += line.slice(5).trim();
  }
  if (!data) return null;
  try {
    return { event, data: JSON.parse(data) };
  } catch {
    return null;
  }
}

function FieldCard({ parsed }: { parsed: LlmJsonResponse }) {
  return (
    <div className="assistant-card">
      <div className="card-section message-section">{parsed.message}</div>
      {parsed.fields && parsed.fields.length > 0 && (
        <div className="card-section fields-section">
          {parsed.fields.map((f, i) => (
            <div key={i} className="field-row">
              <span className="field-label">{f.label}</span>
              <span className="field-value">{f.value}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ToolSteps({ steps }: { steps: ToolStep[] }) {
  return (
    <div className="tool-steps">
      {steps.map((s, i) => (
        <div key={i} className={`tool-step ${s.status}`}>
          <span className="step-icon">
            {s.status === 'running' ? (
              <span className="step-spinner" />
            ) : s.status === 'success' ? (
              '✓'
            ) : (
              '✗'
            )}
          </span>
          <div className="step-text">
            <span className="step-label">{toolLabel(s.name)}</span>
            {s.summary && s.status !== 'running' && (
              <span className="step-summary">{s.summary}</span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
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
          if (data.data.length > 0) setSelectedModel(data.data[0].id);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // 마지막 assistant 메시지 갱신
  const updateLastAssistant = (updater: (m: ChatMessage) => ChatMessage) => {
    setMessages(prev => {
      const idx = prev.length - 1;
      if (idx < 0 || prev[idx].role !== 'assistant') return prev;
      const next = [...prev];
      next[idx] = updater(next[idx]);
      return next;
    });
  };

  // SSE 스트림 처리 (pending_capture 시 재귀 재호출)
  const streamChat = async (body: Record<string, unknown>, startTime: number): Promise<void> => {
    const res = await fetch('/api/llm/chat/stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.body) throw new Error('no stream');

    const toolStartTimes: Record<string, number> = {};
    const MIN_STEP_MS = 700; // 도구가 빨라도 진행 표시가 보이도록 최소 노출 시간
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const chunks = buffer.split('\n\n');
      buffer = chunks.pop() || '';

      for (const chunk of chunks) {
        const parsed = parseSseChunk(chunk);
        if (!parsed) continue;
        const { event } = parsed;
        const data = parsed.data as Record<string, string>;

        if (event === 'tool_start') {
          toolStartTimes[data.name] = performance.now();
          updateLastAssistant(m => ({
            ...m,
            steps: [...(m.steps || []), { name: data.name, status: 'running' }],
          }));
        } else if (event === 'tool_done') {
          // 시각적 최소 노출만 setTimeout으로 지연 — 메인 스트림은 블록하지 않음
          const elapsed = performance.now() - (toolStartTimes[data.name] ?? performance.now());
          const remaining = MIN_STEP_MS - elapsed;
          const finalStatus: ToolStep['status'] = data.status === 'success' ? 'success' : 'error';
          const summary = data.summary;
          const applyDone = () =>
            updateLastAssistant(m => ({
              ...m,
              steps: (m.steps || []).map(s =>
                s.name === data.name && s.status === 'running'
                  ? { ...s, status: finalStatus, summary }
                  : s
              ),
            }));
          if (remaining > 0) setTimeout(applyDone, remaining);
          else applyDone();
        } else if (event === 'final') {
          const reply = data.reply || '';
          const parsedReply = tryParseJson(reply);
          const elapsed = Math.round((performance.now() - startTime) / 1000);
          updateLastAssistant(m => ({
            ...m,
            content: parsedReply ? parsedReply.message : reply,
            parsed: parsedReply,
            streaming: false,
            elapsedSec: elapsed,
          }));
        } else if (event === 'pending_capture') {
          const token = data.captureToken;
          const deviceId = token.split('_').slice(0, -1).join('_');
          const uploaded = await captureAndUpload(deviceId, token);
          await streamChat(
            {
              ...body,
              pendingToken: token,
              pendingResult: uploaded
                ? { deviceId, imageRef: token }
                : { deviceId, error: 'Cannot capture video frame.' },
            },
            startTime
          );
          return;
        } else if (event === 'error') {
          updateLastAssistant(m => ({
            ...m,
            content: data.message || '오류가 발생했습니다.',
            streaming: false,
          }));
        }
      }
    }
  };

  const sendMessage = async () => {
    const userMsg = input.trim();
    if (!userMsg || loading) return;
    setInput('');
    setMessages(prev => [
      ...prev,
      { role: 'user', content: userMsg },
      { role: 'assistant', content: '', steps: [], streaming: true },
    ]);
    setLoading(true);
    const startTime = performance.now();

    try {
      await streamChat(
        { message: userMsg, conversationId: null, model: selectedModel || null },
        startTime
      );
    } catch {
      updateLastAssistant(m => ({ ...m, content: 'Server connection failed', streaming: false }));
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="llm-sidebar">
      <div className="sidebar-header">
        <h3>AI Assistant</h3>
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
            {msg.role === 'user' ? (
              <div className="chat-msg user">{msg.content}</div>
            ) : (
              <div className="assistant-block">
                {msg.steps && msg.steps.length > 0 && <ToolSteps steps={msg.steps} />}
                {msg.streaming && (!msg.steps || msg.steps.length === 0) && (
                  <div className="chat-msg assistant loading">분석 중…</div>
                )}
                {!msg.streaming && (
                  msg.parsed ? (
                    <FieldCard parsed={msg.parsed} />
                  ) : (
                    msg.content && <div className="chat-msg assistant">{msg.content}</div>
                  )
                )}
                {!msg.streaming && msg.elapsedSec != null && (
                  <div className="msg-meta">
                    <span className="msg-elapsed">{msg.elapsedSec}s</span>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
        <div ref={chatEndRef} />
      </div>

      <div className="sidebar-input">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && sendMessage()}
          placeholder="Enter a command..."
        />
        <button onClick={() => sendMessage()} disabled={loading}>Send</button>
      </div>
    </div>
  );
}
