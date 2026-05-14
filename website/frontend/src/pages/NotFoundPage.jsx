import React, { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";

export default function NotFoundPage() {
  const navigate = useNavigate();
  const canvasRef = useRef(null);

  // Glitchy scanline animation on canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    let animId;
    let frame = 0;

    function resize() {
      canvas.width  = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    }
    resize();
    window.addEventListener("resize", resize);

    function draw() {
      const { width, height } = canvas;
      ctx.clearRect(0, 0, width, height);

      // Scanlines
      ctx.fillStyle = "rgba(77,255,200,0.012)";
      for (let y = 0; y < height; y += 3) {
        ctx.fillRect(0, y, width, 1);
      }

      // Random glitch bars (rare)
      if (frame % 40 < 3) {
        const barY = Math.random() * height;
        const barH = Math.random() * 6 + 1;
        ctx.fillStyle = `rgba(77,255,200,${Math.random() * 0.06})`;
        ctx.fillRect(0, barY, width, barH);
      }

      frame++;
      animId = requestAnimationFrame(draw);
    }
    draw();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <div className="min-h-screen grid-bg bg-noir-950 flex flex-col items-center justify-center relative overflow-hidden">

      {/* Canvas overlay — scanlines + glitch */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full pointer-events-none"
        style={{ zIndex: 1 }}
      />

      {/* Deep glow behind the 404 */}
      <div
        className="absolute pointer-events-none"
        style={{
          width: 500,
          height: 500,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(77,255,200,0.07) 0%, transparent 70%)",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          zIndex: 0,
        }}
      />

      {/* Content */}
      <div className="relative flex flex-col items-center text-center px-6" style={{ zIndex: 2 }}>

        {/* Corner accents on the 404 block */}
        <div className="relative inline-block mb-8">
          <span className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 border-prifi-600" />
          <span className="absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2 border-prifi-600" />
          <span className="absolute bottom-0 left-0 w-3 h-3 border-b-2 border-l-2 border-prifi-600" />
          <span className="absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 border-prifi-600" />

          <div className="px-10 py-6">
            <p className="font-display text-xs text-prifi-600 tracking-[0.4em] uppercase mb-3">
              Error
            </p>
            {/* Giant 404 */}
            <h1
              className="font-display text-white leading-none select-none"
              style={{
                fontSize: "clamp(6rem, 20vw, 14rem)",
                letterSpacing: "-0.04em",
                textShadow: "0 0 60px rgba(77,255,200,0.15)",
              }}
            >
              4
              <span className="text-prifi-400" style={{ textShadow: "0 0 40px rgba(77,255,200,0.5)" }}>
                0
              </span>
              4
            </h1>
          </div>
        </div>

        <p className="font-display text-sm text-white/70 tracking-widest uppercase mb-3">
          Page not found
        </p>
        <p className="font-body text-sm text-white/40 max-w-xs leading-relaxed mb-10">
          This route doesn't exist in the protocol. You may have followed a broken
          link or typed an address that was never shielded.
        </p>

        {/* Actions */}
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate(-1)}
            className="font-display text-xs tracking-widest uppercase py-3 px-6 border border-noir-600 text-white/50 hover:text-white hover:border-noir-500 transition-all"
          >
            ← Go Back
          </button>
          <button
            onClick={() => navigate("/")}
            className="font-display text-xs tracking-widest uppercase py-3 px-6 border border-prifi-600/60 text-prifi-400 hover:bg-prifi-600/10 transition-all"
          >
            Home
          </button>
        </div>

        {/* Tiny brand anchor */}
        <div className="flex items-center gap-2 mt-16 opacity-30">
          <div className="w-4 h-4 border border-prifi-600 flex items-center justify-center">
            <div className="w-1.5 h-1.5 bg-prifi-600" />
          </div>
          <span className="font-display text-xs tracking-widest text-white">PriFi</span>
        </div>
      </div>
    </div>
  );
}