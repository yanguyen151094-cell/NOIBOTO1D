import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";

declare global {
  interface Window {
    YT?: {
      Player: new (el: HTMLElement, opts: Record<string, unknown>) => PlayerInstance;
      PlayerState: { ENDED: number; PLAYING: number; PAUSED: number; CUED: number };
    };
    onYouTubeIframeAPIReady?: () => void;
  }
}

interface PlayerInstance {
  loadVideoById: (id: string, startSeconds?: number) => void;
  playVideo: () => void;
  pauseVideo: () => void;
  seekTo: (seconds: number, allowSeekAhead?: boolean) => void;
  getCurrentTime: () => number;
  getDuration: () => number;
  destroy: () => void;
}

export interface YoutubePlayerHandle {
  loadVideo: (videoId: string, startAt?: number) => void;
  play: () => void;
  pause: () => void;
  seekTo: (seconds: number) => void;
  getCurrentTime: () => number;
  getDuration: () => number;
}

interface Props {
  onStateChange?: (state: number) => void;
  onError?: (errorCode: number) => void;
  onReady?: () => void;
}

let apiPromise: Promise<typeof window.YT> | null = null;

function loadYTApi(): Promise<typeof window.YT> {
  if (typeof window !== "undefined" && window.YT?.Player) return Promise.resolve(window.YT);
  if (apiPromise) return apiPromise;
  apiPromise = new Promise((resolve) => {
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      if (prev) prev();
      resolve(window.YT);
    };
    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(tag);
  });
  return apiPromise;
}

const YoutubePlayer = forwardRef<YoutubePlayerHandle, Props>(function YoutubePlayer(
  { onStateChange, onError, onReady },
  ref
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<PlayerInstance | null>(null);
  const stateChangeRef = useRef(onStateChange);
  const errorRef = useRef(onError);
  const readyRef = useRef(onReady);
  const [apiReady, setApiReady] = useState(false);

  useEffect(() => {
    stateChangeRef.current = onStateChange;
    errorRef.current = onError;
    readyRef.current = onReady;
  }, [onStateChange, onError, onReady]);

  useEffect(() => {
    let cancelled = false;
    loadYTApi().then((YT) => {
      if (cancelled || !containerRef.current) return;
      setApiReady(true);
      playerRef.current = new YT.Player(containerRef.current, {
        height: "100%",
        width: "100%",
        playerVars: {
          controls: 0,
          rel: 0,
          playsinline: 1,
          modestbranding: 1,
        },
        events: {
          onReady: () => {
            readyRef.current?.();
          },
          onStateChange: (e: { data: number }) => {
            stateChangeRef.current?.(e.data);
          },
          onError: (e: { data: number }) => {
            errorRef.current?.(e.data);
          },
        },
      });
    });
    return () => {
      cancelled = true;
      try {
        playerRef.current?.destroy();
      } catch {
        // ignore
      }
      playerRef.current = null;
    };
  }, []);

  useImperativeHandle(ref, () => ({
    loadVideo: (videoId: string, startAt?: number) => {
      const p = playerRef.current;
      if (p && typeof p.loadVideoById === "function") {
        p.loadVideoById(videoId, startAt ?? 0);
      }
    },
    play: () => {
      const p = playerRef.current;
      if (p && typeof p.playVideo === "function") {
        p.playVideo();
      }
    },
    pause: () => {
      const p = playerRef.current;
      if (p && typeof p.pauseVideo === "function") {
        p.pauseVideo();
      }
    },
    seekTo: (seconds: number) => {
      const p = playerRef.current;
      if (p && typeof p.seekTo === "function") {
        p.seekTo(seconds, true);
      }
    },
    getCurrentTime: () => {
      const p = playerRef.current;
      if (p && typeof p.getCurrentTime === "function") {
        return p.getCurrentTime();
      }
      return 0;
    },
    getDuration: () => {
      const p = playerRef.current;
      if (p && typeof p.getDuration === "function") {
        return p.getDuration();
      }
      return 0;
    },
  }));

  return (
    <div className="w-full h-full relative">
      <div ref={containerRef} className="w-full h-full" />
      {!apiReady && (
        <div className="absolute inset-0 flex items-center justify-center bg-black text-white">
          <i className="ri-loader-4-line animate-spin text-2xl mr-2" />
          <span className="text-sm">Đang tải player...</span>
        </div>
      )}
    </div>
  );
});

export default YoutubePlayer;