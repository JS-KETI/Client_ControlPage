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

interface LlmJsonResponse {
  type: 'final_answer' | 'follow_up';
  message: string;
  device?: { name?: string; battery?: number; location?: string; status?: string };
  analysis?: { items?: string[]; summary?: string };
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  parsed?: LlmJsonResponse | null;
  toolResults?: ToolResult[];
  elapsedSec?: number;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
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

function AssistantCard({ parsed }: { parsed: LlmJsonResponse }) {
  return (
    <div className="assistant-card">
      {parsed.device && (
        <div className="card-section device-section">
          <div className="card-section-title">{parsed.device.name || 'Device'}</div>
          <div className="card-section-body">
            {parsed.device.battery != null && <span>Battery {parsed.device.battery}%</span>}
            {parsed.device.location && <span>{parsed.device.location}</span>}
            {parsed.device.status && <span>{parsed.device.status}</span>}
          </div>
        </div>
      )}
      {parsed.analysis && (
        <div className="card-section analysis-section">
          <div className="card-section-title">Video Analysis</div>
          {parsed.analysis.items && parsed.analysis.items.length > 0 && (
            <ul className="analysis-items">
              {parsed.analysis.items.map((item, i) => <li key={i}>{item}</li>)}
            </ul>
          )}
          {parsed.analysis.summary && <p className="analysis-summary">{parsed.analysis.summary}</p>}
        </div>
      )}
      <div className="card-section message-section">
        {parsed.message}
      </div>
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

  const addAssistantMessage = (reply: string, toolResults: ToolResult[], elapsedSec?: number) => {
    const parsed = tryParseJson(reply);
    const displayText = parsed ? parsed.message : reply;
    setMessages(prev => [...prev, { role: 'assistant', content: displayText, parsed, toolResults, elapsedSec }]);
  };

  const replaceLastAssistant = (reply: string, toolResults: ToolResult[], elapsedSec?: number) => {
    const parsed = tryParseJson(reply);
    const displayText = parsed ? parsed.message : reply;
    setMessages(prev => [...prev.slice(0, -1), { role: 'assistant', content: displayText, parsed, toolResults, elapsedSec }]);
  };

  const sendMessage = async () => {
    const userMsg = input.trim();
    if (!userMsg || loading) return;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setLoading(true);
    const startTime = performance.now();

    try {
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
        setMessages(prev => [...prev, { role: 'assistant', content: 'Analyzing video frame...' }]);

        const deviceId = pendingCaptureToken.split('_').slice(0, -1).join('_');
        const uploaded = await captureAndUpload(deviceId, pendingCaptureToken);

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
              : { deviceId, error: 'Cannot capture video frame.' },
          }),
        });
        const data2 = await res2.json();
        const elapsed = Math.round((performance.now() - startTime) / 1000);
        const reply = data2.data?.reply || 'No response from LLM.';
        const toolResults = data2.data?.toolResults || [];
        replaceLastAssistant(reply, toolResults, elapsed);
        return;
      }

      const elapsed = Math.round((performance.now() - startTime) / 1000);
      const reply = data.data?.reply || 'No response from LLM.';
      const toolResults = data.data?.toolResults || [];
      addAssistantMessage(reply, toolResults, elapsed);
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Server connection failed' }]);
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
            ) : msg.parsed ? (
              <AssistantCard parsed={msg.parsed} />
            ) : (
              <div className="chat-msg assistant">{msg.content}</div>
            )}
            {msg.role === 'assistant' && (
              <div className="msg-meta">
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
                {msg.elapsedSec != null && (
                  <span className="msg-elapsed">{msg.elapsedSec}s</span>
                )}
              </div>
            )}
          </div>
        ))}
        {loading && <div className="chat-msg assistant loading">Generating response...</div>}
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
