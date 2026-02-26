import { useState, useEffect, useRef } from 'react';

const ROTATING_SUFFIXES = [
  "to build a N8N automation from scratch...",
  "to get guidance from N8N docs...",
  "to review and optimize existing workflows...",
  "for workflow optimization tips...",
];

const PREFIX = "Ask ARIA ";
const TYPING_SPEED = 50;
const ERASING_SPEED = 30;
const PAUSE_DURATION = 2000;

type Phase = 'typing' | 'pausing' | 'erasing';

export function useRotatingPlaceholder(): string {
  const [displayText, setDisplayText] = useState(PREFIX);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [charIndex, setCharIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>('typing');
  const timeoutRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    const currentSuffix = ROTATING_SUFFIXES[currentIndex];

    if (phase === 'typing') {
      if (charIndex < currentSuffix.length) {
        timeoutRef.current = setTimeout(() => {
          setCharIndex(prev => prev + 1);
          setDisplayText(PREFIX + currentSuffix.slice(0, charIndex + 1));
        }, TYPING_SPEED);
      } else {
        setPhase('pausing');
      }
    } else if (phase === 'pausing') {
      timeoutRef.current = setTimeout(() => {
        setPhase('erasing');
      }, PAUSE_DURATION);
    } else if (phase === 'erasing') {
      if (charIndex > 0) {
        timeoutRef.current = setTimeout(() => {
          setCharIndex(prev => prev - 1);
          setDisplayText(PREFIX + currentSuffix.slice(0, charIndex - 1));
        }, ERASING_SPEED);
      } else {
        setCurrentIndex(prev => (prev + 1) % ROTATING_SUFFIXES.length);
        setPhase('typing');
      }
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [charIndex, phase, currentIndex]);

  return displayText;
}
