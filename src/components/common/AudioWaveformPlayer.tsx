import React, { useEffect, useRef, useState, useCallback, memo } from "react";
import { Box, IconButton, Typography } from "@mui/material";
import { PlayArrow, Pause } from "@mui/icons-material";
import { useTheme, alpha } from "@mui/material/styles";

interface AudioWaveformPlayerProps {
  /** Blob URL or remote URL to audio file */
  src: string;
  /** Compact mode for inline use (smaller height and play button) */
  compact?: boolean;
}

const BAR_COUNT = 48;
const BAR_GAP = 2;
const MIN_BAR_HEIGHT_FULL = 4;
const MAX_BAR_HEIGHT_FULL = 36;
const MIN_BAR_HEIGHT_COMPACT = 3;
const MAX_BAR_HEIGHT_COMPACT = 22;

/**
 * WhatsApp-style progressive waveform audio player.
 * Decodes audio data to build a visual waveform, then progressively
 * fills bars from left to right during playback.
 */
export const AudioWaveformPlayer = memo<AudioWaveformPlayerProps>(
  ({ src, compact = false }) => {
    const theme = useTheme();
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const animFrameRef = useRef<number>(0);
    const waveformRef = useRef<HTMLDivElement>(null);

    const [isPlaying, setIsPlaying] = useState(false);
    const [progress, setProgress] = useState(0);
    const [duration, setDuration] = useState(0);
    const [currentTime, setCurrentTime] = useState(0);
    const [waveformData, setWaveformData] = useState<number[]>([]);

    const minBarH = compact ? MIN_BAR_HEIGHT_COMPACT : MIN_BAR_HEIGHT_FULL;
    const maxBarH = compact ? MAX_BAR_HEIGHT_COMPACT : MAX_BAR_HEIGHT_FULL;

    // ── Decode audio → waveform amplitudes ──────────────────────────
    // Uses OfflineAudioContext to avoid creating an output device (no ping/pop)
    // and caches the ArrayBuffer for the <audio> element to reuse.
    const decodedBufRef = useRef<ArrayBuffer | null>(null);

    useEffect(() => {
      let cancelled = false;

      const decode = async () => {
        try {
          const res = await fetch(src);
          const buf = await res.arrayBuffer();
          // Keep a copy for the audio element blob URL
          decodedBufRef.current = buf.slice(0);

          // OfflineAudioContext never connects to speakers → no ping
          const offCtx = new OfflineAudioContext(1, 1, 44100);
          const decoded = await offCtx.decodeAudioData(buf);
          const raw = decoded.getChannelData(0);
          const step = Math.floor(raw.length / BAR_COUNT);
          const bars: number[] = [];

          for (let i = 0; i < BAR_COUNT; i++) {
            let sum = 0;
            const start = i * step;
            for (let j = start; j < start + step && j < raw.length; j++) {
              sum += Math.abs(raw[j]);
            }
            bars.push(sum / step);
          }

          const peak = Math.max(...bars);
          const normalized = bars.map((b) => (peak > 0 ? b / peak : 0));

          if (!cancelled) setWaveformData(normalized);
        } catch {
          // Fallback: procedural bars so the player still looks natural
          if (!cancelled) {
            setWaveformData(
              Array.from(
                { length: BAR_COUNT },
                (_, i) => 0.15 + 0.65 * Math.abs(Math.sin(i * 0.45)),
              ),
            );
          }
        }
      };

      if (src) decode();
      return () => {
        cancelled = true;
      };
    }, [src]);

    // ── Playback progress via rAF ───────────────────────────────────
    const tick = useCallback(() => {
      const a = audioRef.current;
      if (a && !a.paused) {
        setCurrentTime(a.currentTime);
        setProgress(a.duration ? a.currentTime / a.duration : 0);
        animFrameRef.current = requestAnimationFrame(tick);
      }
    }, []);

    useEffect(() => {
      return () => {
        if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      };
    }, []);

    // ── Controls ────────────────────────────────────────────────────
    const togglePlay = useCallback(async () => {
      const a = audioRef.current;
      if (!a) return;
      if (a.paused) {
        try {
          await a.play();
          setIsPlaying(true);
          animFrameRef.current = requestAnimationFrame(tick);
        } catch {
          // Browser blocked autoplay or source not ready
        }
      } else {
        a.pause();
        setIsPlaying(false);
        cancelAnimationFrame(animFrameRef.current);
      }
    }, [tick]);

    const handleSeek = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
      const el = waveformRef.current;
      const a = audioRef.current;
      if (!el || !a || !a.duration) return;
      const rect = el.getBoundingClientRect();
      const pct = Math.max(
        0,
        Math.min(1, (e.clientX - rect.left) / rect.width),
      );
      a.currentTime = pct * a.duration;
      setProgress(pct);
      setCurrentTime(a.currentTime);
    }, []);

    const onLoaded = useCallback(() => {
      if (audioRef.current) setDuration(audioRef.current.duration);
    }, []);

    const onEnded = useCallback(() => {
      setIsPlaying(false);
      setProgress(0);
      setCurrentTime(0);
      cancelAnimationFrame(animFrameRef.current);
    }, []);

    // ── Helpers ─────────────────────────────────────────────────────
    const fmt = (s: number) => {
      const m = Math.floor(s / 60);
      const sec = Math.floor(s % 60);
      return `${m}:${sec.toString().padStart(2, "0")}`;
    };

    const playedIdx = Math.floor(progress * waveformData.length);
    const btnSize = compact ? 32 : 42;

    return (
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: compact ? 1 : 1.5,
          px: compact ? 1 : 2,
          py: compact ? 0.75 : 1.25,
          borderRadius: compact ? 10 : 12,
          background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.06)} 0%, ${alpha(theme.palette.primary.light, 0.1)} 100%)`,
          border: `1px solid ${alpha(theme.palette.primary.main, 0.15)}`,
          transition: "box-shadow 0.2s ease",
          "&:hover": {
            boxShadow: `0 2px 12px ${alpha(theme.palette.primary.main, 0.1)}`,
          },
        }}
      >
        {/* Hidden audio element – preload="auto" buffers data upfront to avoid playback delay */}
        <audio
          ref={audioRef}
          src={src}
          onLoadedMetadata={onLoaded}
          onEnded={onEnded}
          preload="auto"
        />

        {/* Play / Pause */}
        <IconButton
          onClick={togglePlay}
          size="small"
          sx={{
            width: btnSize,
            height: btnSize,
            background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.light} 100%)`,
            color: "#fff",
            boxShadow: `0 2px 8px ${alpha(theme.palette.primary.main, 0.3)}`,
            "&:hover": {
              background: `linear-gradient(135deg, ${theme.palette.primary.dark} 0%, ${theme.palette.primary.main} 100%)`,
            },
          }}
        >
          {isPlaying ? (
            <Pause fontSize={compact ? "small" : "medium"} />
          ) : (
            <PlayArrow fontSize={compact ? "small" : "medium"} />
          )}
        </IconButton>

        {/* Waveform bars */}
        <Box
          ref={waveformRef}
          onClick={handleSeek}
          sx={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            gap: `${BAR_GAP}px`,
            height: maxBarH + 8,
            cursor: "pointer",
            py: 0.5,
          }}
        >
          {waveformData.map((amp, i) => {
            const h = minBarH + amp * (maxBarH - minBarH);
            const played = i <= playedIdx && progress > 0;
            return (
              <Box
                key={i}
                sx={{
                  flex: 1,
                  minWidth: 2,
                  height: `${h}px`,
                  borderRadius: 1,
                  bgcolor: played
                    ? theme.palette.primary.main
                    : alpha(theme.palette.primary.light, 0.55),
                  transition: "background-color 0.15s ease, height 0.3s ease",
                }}
              />
            );
          })}
        </Box>

        {/* Duration / current time */}
        <Typography
          variant="caption"
          sx={{
            minWidth: compact ? 30 : 38,
            textAlign: "right",
            color: theme.palette.text.secondary,
            fontVariantNumeric: "tabular-nums",
            fontWeight: 500,
            fontSize: compact ? "0.65rem" : "0.75rem",
            userSelect: "none",
          }}
        >
          {isPlaying || currentTime > 0 ? fmt(currentTime) : fmt(duration)}
        </Typography>
      </Box>
    );
  },
);

AudioWaveformPlayer.displayName = "AudioWaveformPlayer";
