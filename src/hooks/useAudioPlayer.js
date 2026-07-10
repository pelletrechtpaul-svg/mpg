import { useState, useEffect, useRef } from 'react';
import { PLAYLIST, SOUNDCLOUD_PLAYLIST_URL } from '../shared.jsx';

const SC_API = 'https://w.soundcloud.com/player/api.js';

function loadScApi() {
  return new Promise((resolve) => {
    if (window.SC) return resolve(window.SC);
    const existing = document.querySelector(`script[src="${SC_API}"]`);
    if (existing) { existing.addEventListener('load', () => resolve(window.SC)); return; }
    const s = document.createElement('script');
    s.src = SC_API;
    s.onload = () => resolve(window.SC);
    document.body.appendChild(s);
  });
}

// ── Mode SoundCloud (Widget API pilotant un iframe caché) ──────────────────────
function useSoundcloudPlayer() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTitle, setCurrentTitle] = useState('SoundCloud…');
  const widgetRef = useRef(null);

  useEffect(() => {
    const iframe = document.createElement('iframe');
    iframe.allow = 'autoplay';
    iframe.style.display = 'none';
    iframe.src = `https://w.soundcloud.com/player/?url=${encodeURIComponent(SOUNDCLOUD_PLAYLIST_URL)}&auto_play=false&visual=false`;
    document.body.appendChild(iframe);

    let cancelled = false;
    const refreshTitle = (widget) => widget.getCurrentSound(sound => {
      if (sound?.title) setCurrentTitle(sound.title);
    });

    loadScApi().then(SC => {
      if (cancelled || !SC) return;
      const widget = SC.Widget(iframe);
      widgetRef.current = widget;
      widget.bind(SC.Widget.Events.READY, () => refreshTitle(widget));
      widget.bind(SC.Widget.Events.PLAY, () => { setIsPlaying(true); refreshTitle(widget); });
      widget.bind(SC.Widget.Events.PAUSE, () => setIsPlaying(false));
      widget.bind(SC.Widget.Events.FINISH, () => refreshTitle(widget));
    });

    return () => { cancelled = true; iframe.remove(); widgetRef.current = null; };
  }, []);

  const playPause = () => {
    const w = widgetRef.current; if (!w) return;
    w.isPaused(paused => { paused ? w.play() : w.pause(); });
  };
  const prevTrack = () => widgetRef.current?.prev();
  const nextTrack = () => widgetRef.current?.next();

  return { isPlaying, currentTitle, playPause, prevTrack, nextTrack };
}

// ── Mode MP3 local (fallback) ──────────────────────────────────────────────────
function useLocalPlayer() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTrack, setCurrentTrack] = useState(0);
  const audioRef = useRef(null);
  if (!audioRef.current) audioRef.current = new Audio(PLAYLIST[0].src);

  useEffect(() => {
    const audio = audioRef.current;
    audio.src = PLAYLIST[currentTrack].src;
    audio.load();
    if (isPlaying) audio.play();
  }, [currentTrack]);

  useEffect(() => {
    const audio = audioRef.current;
    const handleEnded = () => setCurrentTrack(t => (t + 1) % PLAYLIST.length);
    audio.addEventListener('ended', handleEnded);
    return () => audio.removeEventListener('ended', handleEnded);
  }, []);

  const playPause = () => {
    const audio = audioRef.current;
    if (isPlaying) { audio.pause(); setIsPlaying(false); }
    else { audio.play(); setIsPlaying(true); }
  };
  const prevTrack = () => setCurrentTrack(t => (t - 1 + PLAYLIST.length) % PLAYLIST.length);
  const nextTrack = () => setCurrentTrack(t => (t + 1) % PLAYLIST.length);

  return { isPlaying, currentTitle: PLAYLIST[currentTrack].title, playPause, prevTrack, nextTrack };
}

const USE_SOUNDCLOUD = !!SOUNDCLOUD_PLAYLIST_URL;

export const useAudioPlayer = USE_SOUNDCLOUD ? useSoundcloudPlayer : useLocalPlayer;
