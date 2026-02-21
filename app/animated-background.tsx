'use client';

import { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';

type Blob = {
  el: HTMLDivElement;
  messyX: number;
  messyY: number;
  messyRot: number;
  isPositive: boolean;
  gridX: number;
  gridY: number;
  isStructured: boolean;
};

export type AnimatedBackgroundRef = {
  structureAll: () => void;
};

const BLOB_COUNT_DESKTOP = 500;
const BLOB_COUNT_MOBILE = 150;
const GRID_SIZE = 40;
const RADIUS = 180;

function getRandomShape(): { borderRadius: string; clipPath?: string } {
  const shapeType = Math.random();

  // 40% jagged polygons
  if (shapeType < 0.4) {
    const points = 4 + Math.floor(Math.random() * 5); // 4-8 points
    const coords: string[] = [];
    for (let i = 0; i < points; i++) {
      const angle = (i / points) * Math.PI * 2;
      const radius = 30 + Math.random() * 70; // 30-100% from center
      const x = 50 + Math.cos(angle) * (radius / 2);
      const y = 50 + Math.sin(angle) * (radius / 2);
      coords.push(`${x}% ${y}%`);
    }
    return { borderRadius: '0', clipPath: `polygon(${coords.join(', ')})` };
  }

  // 60% chaotic border-radius blobs
  const r = () => Math.floor(Math.random() * 80 + 10);
  return { borderRadius: `${r()}% ${r()}% ${r()}% ${r()}% / ${r()}% ${r()}% ${r()}% ${r()}%` };
}

export const AnimatedBackground = forwardRef<AnimatedBackgroundRef>(
  function AnimatedBackground(_props, ref) {
    const stageRef = useRef<HTMLDivElement>(null);
    const blobsRef = useRef<Blob[]>([]);
    const animationRef = useRef<number>(0);
    const structureAllRef = useRef(false);
    const structureAllTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    useImperativeHandle(ref, () => ({
      structureAll: () => {
        structureAllRef.current = true;
        // Auto-reset after 10 seconds
        if (structureAllTimeoutRef.current) {
          clearTimeout(structureAllTimeoutRef.current);
        }
        structureAllTimeoutRef.current = setTimeout(() => {
          structureAllRef.current = false;
        }, 10000);
      }
    }));

    useEffect(() => {
      const stage = stageRef.current;
      if (!stage) return;

      const blobs = blobsRef.current;

      function init() {
        if (!stage) return;
        stage.innerHTML = '';
        blobs.length = 0;

        const isMobile = window.innerWidth < 640;
        const blobCount = isMobile ? BLOB_COUNT_MOBILE : BLOB_COUNT_DESKTOP;

        for (let i = 0; i < blobCount; i++) {
          const el = document.createElement('div');
          el.className = 'blob';

          const isPositive = Math.random() < 0.15;

          // Random Messy Size
          const size = 8 + Math.random() * 30;
          el.style.width = `${size}px`;
          el.style.height = `${size}px`;
          const shape = getRandomShape();
          el.style.borderRadius = shape.borderRadius;
          if (shape.clipPath) {
            el.style.clipPath = shape.clipPath;
          }

          // Random Position within viewport
          const x = Math.random() * window.innerWidth;
          const y = Math.random() * window.innerHeight;
          const rot = Math.random() * 360;

          el.style.left = `${x}px`;
          el.style.top = `${y}px`;
          el.style.transform = `rotate(${rot}deg)`;

          stage.appendChild(el);
          blobs.push({
            el,
            messyX: x,
            messyY: y,
            messyRot: rot,
            isPositive,
            gridX: Math.round(x / GRID_SIZE) * GRID_SIZE,
            gridY: Math.round(y / GRID_SIZE) * GRID_SIZE,
            isStructured: false
          });
        }
      }

      // Track mouse position, process in rAF
      let mouseX = -1000;
      let mouseY = -1000;
      const RADIUS_SQ = RADIUS * RADIUS; // Avoid sqrt

      function handleMouseMove(e: MouseEvent) {
        mouseX = e.clientX;
        mouseY = e.clientY;
      }

      function updateBlobsForMouse() {
        // Handle "structure all" mode - arrange all blobs in a grid centered on screen
        if (structureAllRef.current) {
          const centerX = window.innerWidth / 2;
          const centerY = window.innerHeight / 2;
          const gridPositions = generateSpiralGrid(blobs.length);

          for (let i = 0; i < blobs.length; i++) {
            const b = blobs[i];
            const [gx, gy] = gridPositions[i];
            const targetX = centerX + gx * GRID_SIZE;
            const targetY = centerY + gy * GRID_SIZE;

            if (!b.isStructured) {
              b.isStructured = true;
              b.el.classList.add('structured');
              if (b.isPositive) b.el.classList.add('positive');
            }
            b.el.style.left = `${targetX}px`;
            b.el.style.top = `${targetY}px`;
          }
          return;
        }

        // Normal hover mode - collect blobs in hover radius and sort by distance
        const hoveredBlobs: Array<{ blob: Blob; distSq: number }> = [];

        for (let i = 0; i < blobs.length; i++) {
          const b = blobs[i];
          const dx = mouseX - b.messyX;
          const dy = mouseY - b.messyY;
          const distSq = dx * dx + dy * dy;

          if (distSq < RADIUS_SQ) {
            hoveredBlobs.push({ blob: b, distSq });
          } else if (b.isStructured) {
            // Exit hover state
            b.isStructured = false;
            b.el.classList.remove('structured', 'positive');
            b.el.style.left = `${b.messyX}px`;
            b.el.style.top = `${b.messyY}px`;
            b.el.style.transform = `rotate(${b.messyRot}deg)`;
          }
        }

        // Sort by distance so closest blobs get center grid positions
        hoveredBlobs.sort((a, b) => a.distSq - b.distSq);

        // Assign grid positions in spiral from center
        const gridPositions = generateSpiralGrid(hoveredBlobs.length);

        for (let i = 0; i < hoveredBlobs.length; i++) {
          const { blob: b } = hoveredBlobs[i];
          const [gx, gy] = gridPositions[i];
          const targetX = mouseX + gx * GRID_SIZE;
          const targetY = mouseY + gy * GRID_SIZE;

          if (!b.isStructured) {
            b.isStructured = true;
            b.el.classList.add('structured');
            if (b.isPositive) b.el.classList.add('positive');
          }
          b.el.style.left = `${targetX}px`;
          b.el.style.top = `${targetY}px`;
        }
      }

      // Generate grid positions in spiral pattern from center
      function generateSpiralGrid(count: number): Array<[number, number]> {
        const positions: Array<[number, number]> = [[0, 0]];
        let x = 0,
          y = 0;
        let dx = 1,
          dy = 0;
        let steps = 1,
          stepCount = 0,
          turnCount = 0;

        while (positions.length < count) {
          x += dx;
          y += dy;
          positions.push([x, y]);
          stepCount++;

          if (stepCount === steps) {
            stepCount = 0;
            // Turn 90 degrees
            [dx, dy] = [-dy, dx];
            turnCount++;
            if (turnCount === 2) {
              turnCount = 0;
              steps++;
            }
          }
        }
        return positions;
      }

      let lastScrollY = window.scrollY;
      let targetScrollOffset = 0;
      let currentScrollOffset = 0;

      function handleScroll() {
        const scrollDelta = window.scrollY - lastScrollY;
        lastScrollY = window.scrollY;
        targetScrollOffset += scrollDelta;
      }

      function applyScrollEffect() {
        // Smooth lerp towards target
        currentScrollOffset += (targetScrollOffset - currentScrollOffset) * 0.08;
        const h = window.innerHeight;

        // Apply to blobs based on their layer
        for (let i = 0; i < blobs.length; i++) {
          const b = blobs[i];
          if (!b.isStructured) {
            const speed = 0.015 + (i % 5) * 0.008;
            const offset = currentScrollOffset * speed;

            // Calculate position with wrap-around
            let y = b.messyY - offset;

            // Wrap around smoothly
            y = (((y % (h + 100)) + h + 100) % (h + 100)) - 50;

            b.el.style.top = `${y}px`;
          }
        }
      }

      function drift() {
        // Update blob positions for mouse hover
        updateBlobsForMouse();

        // Apply smooth scroll effect
        applyScrollEffect();

        const time = Date.now() * 0.0002;
        for (let i = 0; i < blobs.length; i++) {
          const b = blobs[i];
          if (!b.isStructured) {
            b.messyX += Math.sin(time + i) * 0.15;
            b.messyY += Math.cos(time + i) * 0.1;
            b.el.style.left = `${b.messyX}px`;
          }
        }
        animationRef.current = requestAnimationFrame(drift);
      }

      init();
      drift();

      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('scroll', handleScroll, { passive: true });
      window.addEventListener('resize', init);

      return () => {
        cancelAnimationFrame(animationRef.current);
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('scroll', handleScroll);
        window.removeEventListener('resize', init);
      };
    }, []);

    return (
      <>
        <style jsx global>{`
          :root {
            --expense-subtle: rgba(244, 114, 114, 0.4);
            --income-subtle: rgba(52, 211, 153, 0.45);
            --idle: rgba(203, 213, 225, 0.35);
          }

          .dark {
            --expense-subtle: rgba(244, 114, 114, 0.3);
            --income-subtle: rgba(52, 211, 153, 0.35);
            --idle: rgba(100, 116, 139, 0.25);
          }

          .blob {
            position: absolute;
            background: var(--idle);
            transition:
              left 1.8s cubic-bezier(0.16, 1, 0.3, 1),
              top 1.8s cubic-bezier(0.16, 1, 0.3, 1),
              width 1s cubic-bezier(0.34, 1.56, 0.64, 1),
              height 1s cubic-bezier(0.34, 1.56, 0.64, 1),
              transform 1.4s cubic-bezier(0.16, 1, 0.3, 1),
              background 0.8s ease,
              border-radius 1s cubic-bezier(0.34, 1.56, 0.64, 1),
              opacity 0.8s ease;
            will-change: transform, left, top, width, height;
            pointer-events: none;
            opacity: 0.3;
          }

          .blob.structured {
            background: var(--expense-subtle) !important;
            border-radius: 50% !important;
            width: 4px !important;
            height: 4px !important;
            opacity: 0.6;
            transform: rotate(0deg) scale(1) !important;
          }

          .blob.structured.positive {
            background: var(--income-subtle) !important;
            width: 5px !important;
            height: 5px !important;
            opacity: 0.7;
          }
        `}</style>
        <div
          ref={stageRef}
          className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
          aria-hidden="true"
        />
      </>
    );
  }
);
