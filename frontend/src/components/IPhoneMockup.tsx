import { motion, useMotionValue, useTransform, useSpring, AnimatePresence } from 'framer-motion';
import { useEffect, useState, useRef } from 'react';

// ─── Call feed data ────────────────────────────────────────────────────────────
const CALLS = [
  { name: 'Larsson Law',           sub: 'Tuesday callback requested',      time: 'Just now', tag: 'CALLBACK', color: '#6366f1' },
  { name: 'Unknown · +1 555 0102', sub: 'Transferred to Sophie (urgent)',  time: '3 min',    tag: 'TRANSFER', color: '#f59e0b' },
  { name: 'Marc · Rivera HVAC',    sub: 'Heating quote emailed',           time: '7 min',    tag: 'LEAD',     color: '#8b5cf6' },
  { name: 'Sarah · Bright Dental', sub: 'Monday 2pm appointment confirmed',time: '11 min',   tag: 'BOOKED',   color: '#10b981' },
];

// ─── Waveform bars (static, looks like audio) ─────────────────────────────────
const BARS = [
  0.3,0.6,0.4,0.8,0.5,0.7,0.3,0.9,0.6,0.4,0.7,0.5,0.8,0.3,0.6,0.9,0.4,0.7,
  0.5,0.8,0.3,0.6,0.4,0.9,0.7,0.5,0.3,0.8,0.6,0.4,0.7,0.9,0.5,0.3,0.6,0.8,
];

// ─── Main component ────────────────────────────────────────────────────────────
export default function IPhoneMockup() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hovered, setHovered] = useState(false);
  const [visibleCards, setVisibleCards] = useState(0);

  // Mouse parallax
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  const rotateX = useSpring(useTransform(mouseY, [-200, 200], [8, -8]), { stiffness: 120, damping: 20 });
  const rotateY = useSpring(useTransform(mouseX, [-200, 200], [-10, 10]), { stiffness: 120, damping: 20 });

  const onMouseMove = (e: React.MouseEvent) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    mouseX.set(e.clientX - rect.left - rect.width / 2);
    mouseY.set(e.clientY - rect.top - rect.height / 2);
  };

  const onMouseLeave = () => {
    mouseX.set(0);
    mouseY.set(0);
  };

  // Stagger cards in
  useEffect(() => {
    const timers = CALLS.map((_, i) =>
      setTimeout(() => setVisibleCards(i + 1), 400 + i * 600)
    );
    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <div
      ref={containerRef}
      className="relative flex items-center justify-center select-none"
      style={{ perspective: 1200 }}
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}
      onMouseEnter={() => setHovered(true)}
    >
      {/* Glow behind phone */}
      <motion.div
        className="absolute rounded-full pointer-events-none"
        style={{
          width: 340,
          height: 340,
          background: 'radial-gradient(circle, rgba(99,102,241,0.25) 0%, transparent 70%)',
          filter: 'blur(40px)',
        }}
        animate={{ scale: hovered ? 1.15 : 1, opacity: hovered ? 0.9 : 0.6 }}
        transition={{ duration: 0.6 }}
      />

      {/* Floating phone wrapper */}
      <motion.div
        style={{ rotateX, rotateY, transformStyle: 'preserve-3d' }}
        animate={{ y: [0, -10, 0] }}
        transition={{ y: { repeat: Infinity, duration: 4, ease: 'easeInOut' } }}
      >
        {/* iPhone frame */}
        <div
          style={{
            width: 272,
            height: 558,
            borderRadius: 50,
            background: 'linear-gradient(145deg, #2a2a2e 0%, #18181c 40%, #111115 100%)',
            boxShadow: `
              0 0 0 1px rgba(255,255,255,0.08),
              0 0 0 2px rgba(0,0,0,0.9),
              0 30px 80px rgba(0,0,0,0.6),
              0 10px 30px rgba(99,102,241,0.15),
              inset 0 1px 0 rgba(255,255,255,0.12),
              inset 0 -1px 0 rgba(255,255,255,0.04)
            `,
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {/* Side sheen */}
          <div style={{
            position: 'absolute', inset: 0, borderRadius: 50,
            background: 'linear-gradient(105deg, rgba(255,255,255,0.05) 0%, transparent 40%, transparent 60%, rgba(255,255,255,0.03) 100%)',
            pointerEvents: 'none', zIndex: 10,
          }} />

          {/* Screen bezel */}
          <div style={{
            position: 'absolute',
            top: 10, left: 10, right: 10, bottom: 10,
            borderRadius: 42,
            background: '#0a0a0f',
            overflow: 'hidden',
          }}>
            {/* Dynamic Island */}
            <div style={{
              position: 'absolute', top: 14, left: '50%',
              transform: 'translateX(-50%)',
              width: 90, height: 26,
              borderRadius: 20,
              background: '#000',
              zIndex: 20,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            }}>
              {/* Camera dot */}
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#1a1a1f' }}>
                <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#0d1117', margin: '2.5px' }} />
              </div>
              {/* Mic dot */}
              <div style={{ width: 4, height: 4, borderRadius: '50%', background: '#1a1a1f' }} />
            </div>

            {/* Screen content */}
            <div style={{ paddingTop: 56, paddingBottom: 24, height: '100%', display: 'flex', flexDirection: 'column' }}>
              {/* Status bar */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 18px 10px' }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.7)', fontFamily: 'system-ui' }}>9:41</span>
                <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                  {/* Signal */}
                  {[3,4,5,6].map(h => (
                    <div key={h} style={{ width: 3, height: h, borderRadius: 1, background: 'rgba(255,255,255,0.7)' }} />
                  ))}
                  {/* Wifi */}
                  <svg width="14" height="10" viewBox="0 0 14 10" style={{ margin: '0 2px', opacity: 0.7 }}>
                    <path d="M7 8.5a1.5 1.5 0 100-3 1.5 1.5 0 000 3z" fill="white"/>
                    <path d="M3.5 5.5C4.8 4.2 5.8 3.5 7 3.5s2.2.7 3.5 2" stroke="white" strokeWidth="1.2" fill="none" strokeLinecap="round"/>
                    <path d="M1 3.5C3 1.5 5 0.5 7 0.5s4 1 6 3" stroke="white" strokeWidth="1.2" fill="none" strokeLinecap="round"/>
                  </svg>
                  {/* Battery */}
                  <div style={{ width: 20, height: 10, borderRadius: 2.5, border: '1.5px solid rgba(255,255,255,0.7)', position: 'relative', opacity: 0.7 }}>
                    <div style={{ position: 'absolute', right: -3.5, top: '50%', transform: 'translateY(-50%)', width: 2.5, height: 5, background: 'rgba(255,255,255,0.7)', borderRadius: '0 1px 1px 0' }} />
                    <div style={{ margin: 1.5, height: 'calc(100% - 3px)', width: '70%', borderRadius: 1, background: 'rgba(255,255,255,0.7)' }} />
                  </div>
                </div>
              </div>

              {/* Live badge */}
              <div style={{ padding: '0 14px 10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#6366f1', boxShadow: '0 0 6px #6366f1' }}
                    className="animate-pulse" />
                  <span style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.9)', letterSpacing: '0.1em', fontFamily: 'system-ui' }}>
                    AI LIVE
                  </span>
                </div>
                <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', fontFamily: 'system-ui' }}>qwillio.ai</span>
              </div>

              {/* Call cards */}
              <div style={{ flex: 1, padding: '0 10px', display: 'flex', flexDirection: 'column', gap: 6, overflow: 'hidden' }}>
                <AnimatePresence>
                  {CALLS.slice(0, visibleCards).map((call, i) => (
                    <motion.div
                      key={call.name}
                      initial={{ opacity: 0, x: -20, scale: 0.95 }}
                      animate={{ opacity: 1, x: 0, scale: 1 }}
                      transition={{ type: 'spring', stiffness: 300, damping: 24 }}
                      style={{
                        background: 'rgba(255,255,255,0.04)',
                        border: '1px solid rgba(255,255,255,0.07)',
                        borderRadius: 12,
                        padding: '8px 10px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                      }}
                    >
                      {/* Phone icon circle */}
                      <div style={{
                        width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                        background: `${call.color}18`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                          <path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1-9.4 0-17-7.6-17-17 0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1L6.6 10.8z"
                            fill={call.color} />
                        </svg>
                      </div>

                      {/* Text */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 10, fontWeight: 600, color: 'rgba(255,255,255,0.9)', fontFamily: 'system-ui', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {call.name}
                        </p>
                        <p style={{ fontSize: 8.5, color: 'rgba(255,255,255,0.35)', fontFamily: 'system-ui', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 1 }}>
                          {call.sub}
                        </p>
                      </div>

                      {/* Badge + time */}
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2, flexShrink: 0 }}>
                        <span style={{
                          fontSize: 7.5, fontWeight: 700, letterSpacing: '0.06em',
                          color: call.color, fontFamily: 'system-ui',
                          background: `${call.color}18`,
                          border: `1px solid ${call.color}30`,
                          borderRadius: 4, padding: '1.5px 4px',
                        }}>
                          {call.tag}
                        </span>
                        <span style={{ fontSize: 7.5, color: 'rgba(255,255,255,0.25)', fontFamily: 'system-ui' }}>
                          {call.time}
                        </span>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>

              {/* Waveform */}
              <div style={{ padding: '10px 14px 0', display: 'flex', alignItems: 'flex-end', gap: 2, height: 36 }}>
                {BARS.map((h, i) => (
                  <motion.div
                    key={i}
                    style={{
                      flex: 1,
                      borderRadius: 2,
                      background: `rgba(99,102,241,${0.3 + h * 0.5})`,
                      height: `${h * 100}%`,
                    }}
                    animate={{ scaleY: [1, 0.4 + Math.random() * 0.6, 1] }}
                    transition={{
                      repeat: Infinity,
                      duration: 1.2 + Math.random() * 0.8,
                      delay: i * 0.04,
                      ease: 'easeInOut',
                    }}
                  />
                ))}
              </div>

              {/* Home indicator */}
              <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 10 }}>
                <div style={{ width: 90, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.25)' }} />
              </div>
            </div>
          </div>

          {/* Volume buttons (left side) */}
          {[-80, -46, -12].map((top, i) => (
            <div key={i} style={{
              position: 'absolute', left: -3, top: `calc(30% + ${top}px)`,
              width: 4, height: i === 0 ? 28 : 40,
              borderRadius: '2px 0 0 2px',
              background: 'linear-gradient(90deg, #1a1a1e, #222226)',
              boxShadow: '-1px 0 3px rgba(0,0,0,0.5)',
            }} />
          ))}

          {/* Power button (right side) */}
          <div style={{
            position: 'absolute', right: -3, top: '38%',
            width: 4, height: 52,
            borderRadius: '0 2px 2px 0',
            background: 'linear-gradient(90deg, #222226, #1a1a1e)',
            boxShadow: '1px 0 3px rgba(0,0,0,0.5)',
          }} />
        </div>

        {/* Phone shadow on surface */}
        <motion.div
          style={{
            position: 'absolute',
            bottom: -24,
            left: '50%',
            transform: 'translateX(-50%)',
            width: 200,
            height: 24,
            borderRadius: '50%',
            background: 'rgba(99,102,241,0.15)',
            filter: 'blur(16px)',
          }}
          animate={{ opacity: hovered ? 0.8 : 0.4, scaleX: hovered ? 1.2 : 1 }}
          transition={{ duration: 0.4 }}
        />
      </motion.div>
    </div>
  );
}
