import { useEffect, useRef } from 'react';

interface Props {
  relayUrl: string;
  broadcastPath: string;
  className?: string;
}

// @moq/watch Web Component를 React에서 사용하기 위한 래퍼
export function MoqVideo({ relayUrl, broadcastPath, className }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Web Component 생성
    const moqWatch = document.createElement('moq-watch');
    moqWatch.setAttribute('url', relayUrl);
    moqWatch.setAttribute('path', broadcastPath);

    const canvas = document.createElement('canvas');
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.objectFit = 'contain';

    moqWatch.appendChild(canvas);
    container.appendChild(moqWatch);

    return () => {
      container.innerHTML = '';
    };
  }, [relayUrl, broadcastPath]);

  return <div ref={containerRef} className={className} />;
}
