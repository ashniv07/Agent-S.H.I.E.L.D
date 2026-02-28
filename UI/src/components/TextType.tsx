import { useEffect, useMemo, useState } from 'react';

interface TextTypeProps {
  texts: string[];
  typingSpeed?: number;
  deletingSpeed?: number;
  pauseMs?: number;
  className?: string;
}

export function TextType({
  texts,
  typingSpeed = 42,
  deletingSpeed = 28,
  pauseMs = 1200,
  className = '',
}: TextTypeProps) {
  const safeTexts = useMemo(() => texts.filter(Boolean), [texts]);
  const [textIndex, setTextIndex] = useState(0);
  const [display, setDisplay] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (safeTexts.length === 0) return;

    const fullText = safeTexts[textIndex % safeTexts.length];

    if (!isDeleting && display === fullText) {
      const pauseTimer = setTimeout(() => setIsDeleting(true), pauseMs);
      return () => clearTimeout(pauseTimer);
    }

    if (isDeleting && display === '') {
      setIsDeleting(false);
      setTextIndex((prev) => (prev + 1) % safeTexts.length);
      return;
    }

    const nextValue = isDeleting
      ? fullText.slice(0, Math.max(0, display.length - 1))
      : fullText.slice(0, Math.min(fullText.length, display.length + 1));

    const timer = setTimeout(
      () => setDisplay(nextValue),
      isDeleting ? deletingSpeed : typingSpeed
    );

    return () => clearTimeout(timer);
  }, [deletingSpeed, display, isDeleting, pauseMs, safeTexts, textIndex, typingSpeed]);

  return (
    <span className={`inline-flex items-center ${className}`}>
      <span>{display}</span>
      <span className="ml-1 inline-block h-5 w-[2px] animate-pulse bg-cyan-300" />
    </span>
  );
}
