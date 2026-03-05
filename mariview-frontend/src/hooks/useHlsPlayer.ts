import { useEffect, useRef, useCallback } from 'react';
import Hls from 'hls.js';

/**
 * HLS stream URL for the virtual drone camera feed.
 * Points directly at MediaMTX's exposed port (docker-compose maps 8888:8888).
 */
const DEFAULT_HLS_URL = 'http://localhost:8888/drone-cam/index.m3u8';

/**
 * useHlsPlayer — attaches an HLS.js instance to a <video> element.
 *
 * This hook handles the case where the video element may not exist on mount
 * (e.g., inside a Dialog). It watches for the ref to become available and
 * attaches HLS when the element appears. It cleans up when the element
 * disappears or the component unmounts.
 *
 * @param videoRef     React ref to the <video> element
 * @param enabled      Whether to attach (use to gate on Dialog open state)
 * @param hlsUrl       HLS manifest URL
 * @param fallbackSrc  Fallback MP4 when HLS is unavailable
 */
export function useHlsPlayer(
    videoRef: React.RefObject<HTMLVideoElement | null>,
    enabled: boolean = true,
    hlsUrl: string = DEFAULT_HLS_URL,
    fallbackSrc: string = '/assets/raw_drone.mp4',
) {
    const hlsInstanceRef = useRef<Hls | null>(null);
    const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const retryCountRef = useRef(0);
    const maxRetries = 30; // 30 retries × 2s = 60s max wait

    useEffect(() => {
        // Don't attach if disabled or video element doesn't exist yet
        const video = videoRef.current;
        if (!enabled || !video) return;

        // Clean up any previous instance
        if (hlsInstanceRef.current) {
            hlsInstanceRef.current.destroy();
            hlsInstanceRef.current = null;
        }
        if (retryTimerRef.current) {
            clearTimeout(retryTimerRef.current);
            retryTimerRef.current = null;
        }

        function attachHls() {
            // Re-check ref on each retry (async callback)
            const video = videoRef.current;
            if (!video) return;

            // Clean up any previous instance
            if (hlsInstanceRef.current) {
                hlsInstanceRef.current.destroy();
                hlsInstanceRef.current = null;
            }

            // If HLS.js is supported (Chrome, Firefox, Edge, etc.)
            if (Hls.isSupported()) {
                const hls = new Hls({
                    enableWorker: true,
                    lowLatencyMode: true,
                    liveSyncDurationCount: 3,
                    liveMaxLatencyDurationCount: 5,
                    maxLiveSyncPlaybackRate: 1,
                    maxBufferLength: 10,
                    maxMaxBufferLength: 30,
                    backBufferLength: 0,
                });

                hls.loadSource(hlsUrl);
                hls.attachMedia(video);

                hls.on(Hls.Events.MANIFEST_PARSED, () => {
                    console.log('[HLS] Manifest parsed, starting playback');
                    retryCountRef.current = 0; // Reset retry count on success
                    video.play().catch(() => { });
                });

                hls.on(Hls.Events.ERROR, (_event, data) => {
                    if (data.fatal) {
                        if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
                            console.warn('[HLS] Media error, recovering...');
                            hls.recoverMediaError();
                        } else {
                            // Network error or any other fatal error → destroy and retry
                            retryCountRef.current += 1;
                            if (retryCountRef.current <= maxRetries) {
                                console.warn(`[HLS] Stream unavailable, retry ${retryCountRef.current}/${maxRetries} in 2s...`);
                                hls.destroy();
                                hlsInstanceRef.current = null;
                                retryTimerRef.current = setTimeout(() => {
                                    attachHls();
                                }, 2000);
                            } else {
                                console.warn('[HLS] Max retries reached, falling back to MP4');
                                hls.destroy();
                                hlsInstanceRef.current = null;
                                video.src = fallbackSrc;
                                video.play().catch(() => { });
                            }
                        }
                    }
                });

                hlsInstanceRef.current = hls;

                // Safari has native HLS support
            } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
                video.src = hlsUrl;
                video.addEventListener('loadedmetadata', () => {
                    video.play().catch(() => { });
                });

                // No HLS support — fallback to MP4
            } else {
                video.src = fallbackSrc;
                video.play().catch(() => { });
            }
        }

        // Initial attach
        attachHls();

        // Jump to live edge when tab regains focus (prevents fast-forward catch-up)
        const jumpToLiveEdge = () => {
            if (videoRef.current) {
                const v = videoRef.current;
                // Force HLS to re-sync to live edge
                if (hlsInstanceRef.current) {
                    hlsInstanceRef.current.startLoad(-1);
                }
                // Snap to live edge immediately (offset avoids buffer-end stall)
                if (v.duration && isFinite(v.duration)) {
                    v.currentTime = Math.max(0, v.duration - 0.5);
                }
                v.playbackRate = 1;
                v.play().catch(() => { });
            }
        };

        const handleVisibility = () => {
            if (document.visibilityState === 'visible') jumpToLiveEdge();
        };

        document.addEventListener('visibilitychange', handleVisibility);
        window.addEventListener('focus', jumpToLiveEdge);

        // Cleanup on unmount or when enabled/ref changes
        return () => {
            document.removeEventListener('visibilitychange', handleVisibility);
            window.removeEventListener('focus', jumpToLiveEdge);
            if (retryTimerRef.current) {
                clearTimeout(retryTimerRef.current);
                retryTimerRef.current = null;
            }
            if (hlsInstanceRef.current) {
                hlsInstanceRef.current.destroy();
                hlsInstanceRef.current = null;
            }
        };
        // Re-run when enabled changes (e.g., dialog opens/closes)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [enabled, hlsUrl, fallbackSrc]);
}
