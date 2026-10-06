import React, { useRef } from "react";
import { motion, useMotionValue, useSpring, useTransform } from "motion/react";
import { Utensils, Moon, Coffee, Sparkles, Clock, Bell, WifiOff } from "lucide-react";

interface ServerDownScreenProps {
  restaurantName?: string;
  restaurantSlug?: string;
  errorCode?: string;
  title?: React.ReactNode;
  customMessage?: React.ReactNode;
}

export default function ServerDownScreen({
  restaurantName = "Spice & Silk",
  restaurantSlug = "spice-and-silk",
  errorCode = "RESTAURANT TEMPORARILY OFFLINE",
  title,
  customMessage = "This restaurant is currently closed for online table orders. Please contact restaurant staff."
}: ServerDownScreenProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Smooth mouse coordinates for parallax
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  // Damped spring physics for smooth floating feel
  const springX = useSpring(mouseX, { stiffness: 45, damping: 20 });
  const springY = useSpring(mouseY, { stiffness: 45, damping: 20 });

  // 3D rotation and translation transforms
  const clocheRotateX = useTransform(springY, [-300, 300], [12, -12]);
  const clocheRotateY = useTransform(springX, [-400, 400], [-16, 16]);
  const clocheTranslateX = useTransform(springX, [-400, 400], [-22, 22]);
  const clocheTranslateY = useTransform(springY, [-300, 300], [-14, 14]);

  // Ambient parallax for orbiting elements
  const orbitRotateCW = useTransform(springX, [-400, 400], [-20, 20]);
  const orbitRotateCCW = useTransform(springX, [-400, 400], [20, -20]);
  const floatLayerX = useTransform(springX, [-400, 400], [18, -18]);
  const floatLayerY = useTransform(springY, [-300, 300], [12, -12]);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    mouseX.set(e.clientX - centerX);
    mouseY.set(e.clientY - centerY);
  };

  const handleMouseLeave = () => {
    mouseX.set(0);
    mouseY.set(0);
  };

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className="relative min-h-screen w-full bg-[#faf7f2] text-[#1c1917] font-sans overflow-x-hidden selection:bg-amber-200 selection:text-amber-900 flex flex-col justify-between"
    >
      {/* LUXURY EDITORIAL BACKGROUND PATTERN */}
      <div className="absolute inset-0 pointer-events-none opacity-35">
        <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="culinary-grid" width="60" height="60" patternUnits="userSpaceOnUse">
              <path d="M 60 0 L 0 0 0 60" fill="none" stroke="#e8e2d5" strokeWidth="0.8" />
              <circle cx="0" cy="0" r="1.5" fill="#cfc5b0" />
            </pattern>
            <linearGradient id="warm-aurora" x1="50%" y1="0%" x2="50%" y2="100%">
              <stop offset="0%" stopColor="#d4af37" stopOpacity="0.15" />
              <stop offset="100%" stopColor="#d4af37" stopOpacity="0" />
            </linearGradient>
          </defs>
          <rect width="100%" height="100%" fill="url(#culinary-grid)" />
          <circle cx="68%" cy="45%" r="480" fill="url(#warm-aurora)" />
        </svg>
      </div>

      {/* TOP BRAND HEADER (Clean, Pure Static, NO Buttons, NO URLs) */}
      <header className="relative z-20 w-full px-6 sm:px-12 lg:px-20 pt-8 pb-4 flex items-center justify-between border-b border-stone-200/60 backdrop-blur-xs select-none">
        <div className="flex items-center gap-3">
          <span className="font-serif font-black text-xl sm:text-2xl tracking-tight text-stone-900">
            {restaurantName.toLowerCase().replace(/\s+/g, '')}
          </span>
          <span className="text-[#d4af37] font-serif font-bold text-lg">)</span>
          <span className="text-[10px] font-mono tracking-widest text-stone-400 uppercase ml-2 border-l border-stone-300 pl-3">
            Dining Room Dispatch
          </span>
        </div>

        {/* Resting status pill */}
        <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-full bg-amber-50/90 border border-amber-200 text-amber-800 text-xs font-mono">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
          </span>
          <span className="font-semibold tracking-wide">ORDERS PAUSED</span>
        </div>
      </header>

      {/* LEFT VERTICAL ACCENT TEXT (Static, NO Links) */}
      <aside className="hidden lg:flex fixed left-8 top-1/2 -translate-y-1/2 z-20 items-center gap-3 select-none pointer-events-none">
        <div className="w-[1.5px] h-14 bg-stone-300"></div>
        <div className="text-[10px] font-mono tracking-[0.3em] text-stone-400 uppercase -rotate-90 origin-left translate-y-3 whitespace-nowrap">
          {restaurantName} • Service Pause Protocol
        </div>
      </aside>

      {/* MAIN HERO STAGE */}
      <main className="relative z-10 max-w-7xl mx-auto px-6 sm:px-12 lg:px-20 py-10 sm:py-16 grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center flex-1">
        
        {/* LEFT COLUMN: PURE RELEVANT TYPOGRAPHY & HOSPITALITY ASSISTANCE (NO BUTTONS, NO URLS) */}
        <div className="lg:col-span-5 flex flex-col justify-center space-y-6 lg:pr-4 select-none">
          
          {/* Status Badge */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-50 border border-amber-200/80 text-amber-800 text-xs font-mono font-medium self-start shadow-2xs"
          >
            <Clock size={13} className="text-amber-600" />
            <span>{errorCode}</span>
          </motion.div>

          {/* Large Hero Title */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          >
            <h1 className="text-4xl sm:text-5xl xl:text-6xl font-serif font-black text-stone-900 leading-[1.08] tracking-tight">
              {title || (
                <>
                  Restaurant<br />
                  <span className="italic font-normal text-[#c29729]">Temporarily</span><br />
                  Offline.
                </>
              )}
            </h1>
          </motion.div>

          {/* Required Descriptive Message */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
            className="space-y-4"
          >
            <p className="text-base sm:text-lg text-stone-800 font-medium leading-relaxed max-w-md">
              {customMessage}
            </p>
            <p className="text-xs sm:text-sm text-stone-500 leading-relaxed max-w-md">
              The digital ordering server for <strong className="text-stone-800 font-semibold">{restaurantName}</strong> is taking a short rest. Online table ordering is currently paused while the kitchen prepares for the next service.
            </p>
          </motion.div>

          {/* REFINED HOSPITALITY CARD (Clean & Elegant, NO TELEMETRY, NO BUTTONS, NO URLS) */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="pt-2 max-w-md"
          >
            <div className="p-5 rounded-2xl bg-white border border-stone-200/80 shadow-xs space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200/60 text-[#b58b22] flex items-center justify-center shrink-0">
                  <Utensils size={18} />
                </div>
                <div>
                  <div className="text-sm font-semibold text-stone-800">Dining Room Assistance</div>
                  <div className="text-xs text-stone-500">In-person table service is active</div>
                </div>
              </div>
              
              <p className="text-xs text-stone-600 leading-relaxed pt-2 border-t border-stone-100">
                Printed physical menus and direct ordering via your table attendant remain available. Please signal our floor staff for immediate dining assistance.
              </p>

              <div className="flex items-center justify-between text-[11px] font-mono text-stone-400 pt-1">
                <span className="flex items-center gap-1.5">
                  <Sparkles size={11} className="text-amber-500" />
                  Service auto-syncs when online
                </span>
                <span className="text-stone-500 font-medium">Table Support Active</span>
              </div>
            </div>
          </motion.div>

        </div>

        {/* RIGHT COLUMN: EXTRAORDINARY & VERSATILE KINETIC CULINARY CLOCHE ANIMATION */}
        <div className="lg:col-span-7 flex items-center justify-center relative min-h-[500px] select-none">
          
          {/* AMBIENT WARM LIGHTING GLOW BEHIND THE ARTWORK */}
          <motion.div
            style={{ x: floatLayerX, y: floatLayerY }}
            animate={{ 
              scale: [1, 1.1, 1],
              opacity: [0.5, 0.75, 0.5]
            }}
            transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
            className="absolute w-80 sm:w-96 h-80 sm:h-96 rounded-full bg-gradient-to-tr from-amber-300/30 via-orange-200/20 to-transparent blur-3xl pointer-events-none"
          />

          {/* MAIN 3D KINETIC COMPOSITION */}
          <motion.div
            style={{
              rotateX: clocheRotateX,
              rotateY: clocheRotateY,
              x: clocheTranslateX,
              y: clocheTranslateY,
              transformStyle: "preserve-3d",
            }}
            className="relative w-full max-w-[540px] aspect-square flex items-center justify-center"
          >

            {/* DESIGN 1: CELESTIAL ORBITING RING (COUNTER-CLOCKWISE WITH MOON & CUTLERY) */}
            <motion.div
              style={{ rotate: orbitRotateCCW }}
              animate={{ rotate: -360 }}
              transition={{ duration: 32, repeat: Infinity, ease: "linear" }}
              className="absolute w-[360px] sm:w-[420px] h-[360px] sm:h-[420px] pointer-events-none"
            >
              <svg viewBox="0 0 420 420" className="w-full h-full overflow-visible">
                <ellipse
                  cx="210"
                  cy="210"
                  rx="200"
                  ry="90"
                  fill="none"
                  stroke="#d4af37"
                  strokeWidth="1.2"
                  strokeDasharray="6 10"
                  opacity="0.6"
                  transform="rotate(-25 210 210)"
                />
              </svg>
              
              {/* Orbiting Badge: Resting Moon */}
              <motion.div 
                className="absolute top-10 left-16 w-9 h-9 rounded-full bg-white border border-amber-200 shadow-md flex items-center justify-center text-amber-700"
                title="Resting Kitchen"
              >
                <Moon size={16} />
              </motion.div>

              {/* Orbiting Badge: Crossed Cutlery */}
              <motion.div 
                className="absolute bottom-12 right-14 w-9 h-9 rounded-full bg-white border border-amber-200 shadow-md flex items-center justify-center text-[#c29729]"
                title="Table Service"
              >
                <Utensils size={15} />
              </motion.div>
            </motion.div>

            {/* DESIGN 2: COMPLEMENTARY TILTED ORBITING RING (CLOCKWISE WITH COFFEE & BELL) */}
            <motion.div
              style={{ rotate: orbitRotateCW }}
              animate={{ rotate: 360 }}
              transition={{ duration: 26, repeat: Infinity, ease: "linear" }}
              className="absolute w-[320px] sm:w-[380px] h-[320px] sm:h-[380px] pointer-events-none"
            >
              <svg viewBox="0 0 380 380" className="w-full h-full overflow-visible">
                <ellipse
                  cx="190"
                  cy="190"
                  rx="180"
                  ry="75"
                  fill="none"
                  stroke="#c29729"
                  strokeWidth="1"
                  strokeDasharray="4 8"
                  opacity="0.45"
                  transform="rotate(35 190 190)"
                />
              </svg>

              {/* Orbiting Badge: Warm Steaming Coffee */}
              <motion.div 
                className="absolute top-14 right-16 w-8 h-8 rounded-full bg-white border border-amber-200 shadow-md flex items-center justify-center text-amber-600"
              >
                <Coffee size={14} />
              </motion.div>

              {/* Orbiting Badge: Service Bell */}
              <motion.div 
                className="absolute bottom-14 left-14 w-8 h-8 rounded-full bg-white border border-amber-200 shadow-md flex items-center justify-center text-[#d4af37]"
              >
                <Bell size={14} />
              </motion.div>
            </motion.div>

            {/* DESIGN 3: FLOATING WARM EMBERS & CULINARY SPARKS DRIFTING UP */}
            {[
              { x: -50, delay: 0, duration: 4.5 },
              { x: 40, delay: 1.2, duration: 5.2 },
              { x: -15, delay: 2.1, duration: 4.8 },
              { x: 70, delay: 0.8, duration: 5.8 },
              { x: -80, delay: 3, duration: 6.2 },
            ].map((spark, i) => (
              <motion.div
                key={i}
                animate={{
                  y: [40, -120],
                  opacity: [0, 0.85, 0],
                  scale: [0.6, 1.2, 0.4]
                }}
                transition={{
                  duration: spark.duration,
                  repeat: Infinity,
                  delay: spark.delay,
                  ease: "easeInOut"
                }}
                style={{ translateX: spark.x }}
                className="absolute bottom-36 w-2.5 h-2.5 rounded-full bg-gradient-to-t from-amber-400 to-yellow-200 blur-[0.5px] pointer-events-none"
              />
            ))}

            {/* DESIGN 4: THE FLOATING RESTAURANT SERVING PLATTER BASE */}
            <div className="absolute bottom-16 w-72 sm:w-88 h-24 sm:h-30 z-5 pointer-events-none">
              <svg viewBox="0 0 360 120" className="w-full h-full overflow-visible">
                <defs>
                  <linearGradient id="platter-rim" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#d5cebe" />
                    <stop offset="30%" stopColor="#f3eee3" />
                    <stop offset="70%" stopColor="#ffffff" />
                    <stop offset="100%" stopColor="#cfc4b0" />
                  </linearGradient>
                  <linearGradient id="gold-accent" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#b58b22" />
                    <stop offset="50%" stopColor="#f7d377" />
                    <stop offset="100%" stopColor="#c29729" />
                  </linearGradient>
                  <radialGradient id="platter-hearth-glow" cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.5" />
                    <stop offset="60%" stopColor="#ea580c" stopOpacity="0.2" />
                    <stop offset="100%" stopColor="#ea580c" stopOpacity="0" />
                  </radialGradient>
                </defs>

                {/* Soft Hearth Glow on Platter */}
                <ellipse cx="180" cy="60" rx="140" ry="38" fill="url(#platter-hearth-glow)" />

                {/* Outer Silver/Porcelain Platter Rim */}
                <ellipse cx="180" cy="62" rx="160" ry="34" fill="url(#platter-rim)" stroke="#b5a995" strokeWidth="2.5" />
                
                {/* Inner Gold Inlaid Rim */}
                <ellipse cx="180" cy="62" rx="138" ry="26" fill="none" stroke="url(#gold-accent)" strokeWidth="2" />
                
                {/* Platter Center Well */}
                <ellipse cx="180" cy="63" rx="115" ry="20" fill="#fcf9f2" stroke="#d5cebe" strokeWidth="1.5" />
              </svg>
            </div>

            {/* DESIGN 5: THE FLOATING LUXURY BRASS CLOCHE (FOOD SERVING DOME) */}
            <motion.div
              animate={{ 
                y: [0, -14, 0],
                rotate: [-1, 1, -1]
              }}
              transition={{ duration: 5.5, repeat: Infinity, ease: "easeInOut" }}
              className="relative z-10 w-64 sm:w-76 h-64 sm:h-76 flex items-center justify-center -translate-y-8"
            >
              <svg viewBox="0 0 320 320" className="w-full h-full overflow-visible drop-shadow-2xl">
                <defs>
                  {/* Rich Champagne Gold Cloche Gradients */}
                  <linearGradient id="cloche-body-gold" x1="0%" y1="0%" x2="100%" y2="80%">
                    <stop offset="0%" stopColor="#ecd48c" />
                    <stop offset="25%" stopColor="#fce9b2" />
                    <stop offset="50%" stopColor="#d4af37" />
                    <stop offset="75%" stopColor="#b88b20" />
                    <stop offset="100%" stopColor="#8c6614" />
                  </linearGradient>

                  <linearGradient id="cloche-highlight" x1="20%" y1="0%" x2="80%" y2="100%">
                    <stop offset="0%" stopColor="#ffffff" stopOpacity="0.75" />
                    <stop offset="40%" stopColor="#ffffff" stopOpacity="0.1" />
                    <stop offset="100%" stopColor="#000000" stopOpacity="0.3" />
                  </linearGradient>

                  <linearGradient id="finial-gold" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#fff2be" />
                    <stop offset="50%" stopColor="#d4af37" />
                    <stop offset="100%" stopColor="#7a540a" />
                  </linearGradient>
                </defs>

                {/* ETHEREAL SILK STEAM RIBBONS RISING FROM CLOCHE */}
                <g id="steam-ribbons" opacity="0.75">
                  <motion.path
                    d="M 140 70 C 130 40, 150 20, 135 0"
                    fill="none"
                    stroke="#f59e0b"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    animate={{ 
                      d: [
                        "M 140 70 C 130 40, 150 20, 135 0",
                        "M 140 70 C 150 45, 130 15, 145 0",
                        "M 140 70 C 130 40, 150 20, 135 0"
                      ]
                    }}
                    transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                  />
                  <motion.path
                    d="M 160 65 C 175 35, 155 18, 170 0"
                    fill="none"
                    stroke="#d4af37"
                    strokeWidth="3"
                    strokeLinecap="round"
                    animate={{ 
                      d: [
                        "M 160 65 C 175 35, 155 18, 170 0",
                        "M 160 65 C 150 38, 175 14, 158 0",
                        "M 160 65 C 175 35, 155 18, 170 0"
                      ]
                    }}
                    transition={{ duration: 4.8, repeat: Infinity, ease: "easeInOut", delay: 0.4 }}
                  />
                  <motion.path
                    d="M 180 72 C 195 48, 185 24, 195 5"
                    fill="none"
                    stroke="#f59e0b"
                    strokeWidth="2"
                    strokeLinecap="round"
                    animate={{ 
                      d: [
                        "M 180 72 C 195 48, 185 24, 195 5",
                        "M 180 72 C 170 50, 198 22, 182 5",
                        "M 180 72 C 195 48, 185 24, 195 5"
                      ]
                    }}
                    transition={{ duration: 5.2, repeat: Infinity, ease: "easeInOut", delay: 0.8 }}
                  />
                </g>

                {/* CLOCHE TOP SCULPTURAL FINIAL HANDLE */}
                {/* Stem */}
                <rect x="156" y="66" width="8" height="14" rx="2" fill="url(#finial-gold)" stroke="#664606" strokeWidth="1.2" />
                {/* Ring Knob */}
                <circle cx="160" cy="56" r="12" fill="url(#finial-gold)" stroke="#664606" strokeWidth="2" />
                <circle cx="160" cy="56" r="5" fill="#fcf6de" />

                {/* CLOCHE BELL DOME */}
                <path
                  d="M 35 240 C 35 125, 90 76, 160 76 C 230 76, 285 125, 285 240 Z"
                  fill="url(#cloche-body-gold)"
                  stroke="#664606"
                  strokeWidth="2.8"
                />

                {/* Curved Specular Light Reflection Sweep */}
                <path
                  d="M 35 240 C 35 125, 90 76, 160 76 C 230 76, 285 125, 285 240 Z"
                  fill="url(#cloche-highlight)"
                />

                {/* Front Highlights and Contours */}
                <path
                  d="M 80 230 C 80 145, 115 105, 160 98"
                  fill="none"
                  stroke="#ffffff"
                  strokeWidth="4"
                  strokeLinecap="round"
                  opacity="0.65"
                />
                <path
                  d="M 98 220 C 98 160, 128 128, 160 120"
                  fill="none"
                  stroke="#ffffff"
                  strokeWidth="2"
                  strokeLinecap="round"
                  opacity="0.4"
                />

                {/* Delicate Inlaid Filigree Line on Cloche */}
                <path
                  d="M 50 232 C 80 180, 240 180, 270 232"
                  fill="none"
                  stroke="#8c6614"
                  strokeWidth="1.8"
                  opacity="0.6"
                />

                {/* Cloche Base Rim Lip */}
                <ellipse cx="160" cy="240" rx="126" ry="16" fill="url(#finial-gold)" stroke="#664606" strokeWidth="2.4" />
                <ellipse cx="160" cy="240" rx="123" ry="13" fill="none" stroke="#ffffff" strokeWidth="1.2" opacity="0.6" />
              </svg>

              {/* FLOATING STATUS PILL OVER CLOCHE */}
              <motion.div
                animate={{ 
                  y: [-3, 3, -3],
                }}
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                className="absolute -top-4 px-3.5 py-1.5 rounded-full bg-stone-900/90 border border-amber-400/80 text-amber-300 text-[10px] font-mono tracking-widest uppercase shadow-xl flex items-center gap-1.5 backdrop-blur-md"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                <span>KITCHEN AT REST</span>
              </motion.div>
            </motion.div>

          </motion.div>

        </div>

      </main>

      {/* FOOTER BAR (Clean, Pure Static Informational Text, NO Buttons, NO URLs) */}
      <footer className="relative z-10 w-full px-6 sm:px-12 lg:px-20 py-6 border-t border-stone-200/60 text-xs text-stone-400 flex flex-col sm:flex-row items-center justify-between gap-3 select-none">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-amber-500" />
          <span className="font-mono text-[11px] text-stone-500">
            {restaurantName} • Table Order Dispatch Offline Protocol
          </span>
        </div>
        <div className="font-mono text-[11px] text-stone-400">
          STATUS CODE: 503 • SERVICE TEMPORARILY UNAVAILABLE
        </div>
      </footer>
    </div>
  );
}
