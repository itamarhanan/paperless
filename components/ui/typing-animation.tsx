"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion, MotionProps, useInView } from "motion/react";
import { cn } from "@/lib/utils";

interface TypingAnimationProps extends MotionProps {
  children?: React.ReactNode;
  text?: string;
  words?: string[];
  className?: string;
  duration?: number;
  typeSpeed?: number;
  deleteSpeed?: number;
  delay?: number;
  pauseDelay?: number;
  loop?: boolean;
  as?: React.ElementType;
  startOnView?: boolean;
  showCursor?: boolean;
  blinkCursor?: boolean;
  cursorStyle?: "line" | "block" | "underscore";
  cursorClassName?: string;
}

export function TypingAnimation({
  children,
  text,
  words,
  className,
  duration = 100,
  typeSpeed,
  deleteSpeed,
  delay = 0,
  pauseDelay = 1000,
  loop = false,
  as: Component = "div",
  startOnView = true,
  showCursor = true,
  blinkCursor = true,
  cursorStyle = "line",
  cursorClassName,
  ...props
}: TypingAnimationProps) {
  const MotionComponent = motion.create(Component, {
    forwardMotionProps: true,
  });

  const [displayProgress, setDisplayProgress] = useState<number>(0);
  const [currentWordIndex, setCurrentWordIndex] = useState(0);
  const [phase, setPhase] = useState<"typing" | "pause" | "deleting">("typing");
  const elementRef = useRef<HTMLElement | null>(null);
  const isInView = useInView(elementRef as React.RefObject<Element>, {
    amount: 0.3,
    once: true,
  });

  // Handle different input types
  const textContent = useMemo(() => {
    if (text) return text;
    if (typeof children === "string") return children;
    return null;
  }, [text, children]);

  const wordsToAnimate = useMemo(
    () => words || (textContent ? [textContent] : []),
    [words, textContent]
  );

  const hasMultipleWords = wordsToAnimate.length > 1;
  const hasReactChildren = !textContent && children;

  const typingSpeed = typeSpeed || duration;
  const deletingSpeed = deleteSpeed || typingSpeed / 2;
  const shouldStart = startOnView ? isInView : true;

  // Text-based typing animation (original behavior)
  useEffect(() => {
    if (!shouldStart || wordsToAnimate.length === 0 || hasReactChildren) return;

    const timeoutDelay =
      delay > 0 && displayProgress === 0
        ? delay
        : phase === "typing"
        ? typingSpeed
        : phase === "deleting"
        ? deletingSpeed
        : pauseDelay;

    const timeout = setTimeout(() => {
      const currentWord = wordsToAnimate[currentWordIndex] || "";
      const graphemes = Array.from(currentWord);

      switch (phase) {
        case "typing":
          if (displayProgress < graphemes.length) {
            setDisplayProgress(displayProgress + 1);
          } else {
            if (hasMultipleWords || loop) {
              const isLastWord = currentWordIndex === wordsToAnimate.length - 1;
              if (!isLastWord || loop) {
                setPhase("pause");
              }
            }
          }
          break;

        case "pause":
          setPhase("deleting");
          break;

        case "deleting":
          if (displayProgress > 0) {
            setDisplayProgress(displayProgress - 1);
          } else {
            const nextIndex = (currentWordIndex + 1) % wordsToAnimate.length;
            setCurrentWordIndex(nextIndex);
            setPhase("typing");
          }
          break;
      }
    }, timeoutDelay);

    return () => clearTimeout(timeout);
  }, [
    shouldStart,
    phase,
    displayProgress,
    currentWordIndex,
    wordsToAnimate,
    hasMultipleWords,
    hasReactChildren,
    loop,
    typingSpeed,
    deletingSpeed,
    pauseDelay,
    delay,
  ]);

  // React children reveal animation (new behavior)
  useEffect(() => {
    if (!shouldStart || !hasReactChildren) return;

    const startDelay = delay > 0 && displayProgress === 0 ? delay : typingSpeed;

    const timeout = setTimeout(() => {
      if (displayProgress < 100) {
        // Increment by small amount for smooth reveal
        setDisplayProgress((prev) => Math.min(prev + 2, 100));
      }
    }, startDelay);

    return () => clearTimeout(timeout);
  }, [shouldStart, hasReactChildren, displayProgress, typingSpeed, delay]);

  const getCursorChar = () => {
    switch (cursorStyle) {
      case "block":
        return "▌";
      case "underscore":
        return "_";
      case "line":
      default:
        return "|";
    }
  };

  // For text content
  if (textContent) {
    const currentWord = wordsToAnimate[currentWordIndex] || "";
    const graphemes = Array.from(currentWord);
    const displayedText = graphemes.slice(0, displayProgress).join("");

    const isComplete =
      !loop &&
      currentWordIndex === wordsToAnimate.length - 1 &&
      displayProgress >= graphemes.length &&
      phase !== "deleting";

    const shouldShowCursor =
      showCursor &&
      !isComplete &&
      (hasMultipleWords || loop || displayProgress < graphemes.length);

    return (
      <MotionComponent
        ref={elementRef}
        className={cn("leading-20 tracking-[-0.02em]", className)}
        {...props}
      >
        {displayedText}
        {shouldShowCursor && (
          <span
            className={cn(
              "inline-block",
              blinkCursor && "animate-blink-cursor",
              cursorClassName
            )}
          >
            {getCursorChar()}
          </span>
        )}
      </MotionComponent>
    );
  }

  // For React children (like ReactMarkdown)
  if (hasReactChildren) {
    const isComplete = displayProgress >= 100;

    return (
      <MotionComponent
        ref={elementRef}
        className={cn("relative", className)}
        {...props}
      >
        <div
          style={{
            clipPath: `inset(0 ${100 - displayProgress}% 0 0)`,
            transition: "clip-path 0.05s linear",
          }}
        >
          {children}
        </div>
        {showCursor && !isComplete && (
          <span
            className={cn(
              "inline-block ml-1 align-text-bottom",
              blinkCursor && "animate-blink-cursor",
              cursorClassName,
              cursorStyle === "line" && "w-0.5 h-[1.1em] bg-primary",
              cursorStyle === "block" && "w-[0.6em] h-[1.1em] bg-primary",
              cursorStyle === "underscore" &&
                "w-[0.6em] h-0.5 bg-primary translate-y-[1em]"
            )}
            aria-hidden="true"
          />
        )}
      </MotionComponent>
    );
  }

  return null;
}
