import { useState, useEffect, useCallback } from 'react';

export function useSecretTrigger(onTrigger: () => void, requiredTaps = 3, timeWindow = 2000) {
  const [taps, setTaps] = useState<number[]>([]);

  const handleTap = useCallback(() => {
    const now = Date.now();
    // Filter out old taps
    const recentTaps = [...taps, now].filter(t => now - t < timeWindow);
    setTaps(recentTaps);

    if (recentTaps.length >= requiredTaps) {
      onTrigger();
      setTaps([]); // Reset
    }
  }, [taps, requiredTaps, timeWindow, onTrigger]);

  return handleTap;
}
