import { useState, useEffect, useRef } from 'react';
import { PLAYLIST } from '../shared.jsx';

export const useAudioPlayer = () => {
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

  return { isPlaying, currentTrack, playPause, prevTrack, nextTrack };
};
