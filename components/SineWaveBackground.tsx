import React, { useRef, useEffect } from 'react';

interface WaveConfig {
  amplitude: number;
  frequency: number;
  speed: number;
  yOffset: number;
  color: string;
  opacity: number;
  thickness: number;
}

const SineWaveBackground: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;
    let time = 0;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      ctx.scale(dpr, dpr);
    };

    resize();
    window.addEventListener('resize', resize);

    // Wave configurations - create multiple overlapping waves
    const waves: WaveConfig[] = [
      // Back layer waves (more subtle)
      { amplitude: 80, frequency: 0.003, speed: 0.015, yOffset: 0.75, color: '#3B82F6', opacity: 0.15, thickness: 120 },
      { amplitude: 100, frequency: 0.002, speed: 0.012, yOffset: 0.8, color: '#8B5CF6', opacity: 0.12, thickness: 140 },
      { amplitude: 60, frequency: 0.004, speed: 0.018, yOffset: 0.7, color: '#06B6D4', opacity: 0.1, thickness: 100 },
      
      // Middle layer waves
      { amplitude: 90, frequency: 0.0025, speed: 0.02, yOffset: 0.72, color: '#6366F1', opacity: 0.2, thickness: 80 },
      { amplitude: 70, frequency: 0.0035, speed: 0.022, yOffset: 0.78, color: '#A855F7', opacity: 0.18, thickness: 90 },
      
      // Front layer waves (more vibrant)
      { amplitude: 50, frequency: 0.004, speed: 0.025, yOffset: 0.82, color: '#22D3EE', opacity: 0.25, thickness: 60 },
      { amplitude: 65, frequency: 0.003, speed: 0.028, yOffset: 0.76, color: '#818CF8', opacity: 0.22, thickness: 70 },
      { amplitude: 45, frequency: 0.005, speed: 0.03, yOffset: 0.85, color: '#E879F9', opacity: 0.2, thickness: 50 },
    ];

    const drawWave = (wave: WaveConfig, t: number) => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      const baseY = height * wave.yOffset;

      // Create gradient for wave
      const gradient = ctx.createLinearGradient(0, baseY - wave.amplitude, width, baseY + wave.amplitude);
      gradient.addColorStop(0, `${wave.color}00`);
      gradient.addColorStop(0.3, wave.color);
      gradient.addColorStop(0.7, wave.color);
      gradient.addColorStop(1, `${wave.color}00`);

      ctx.beginPath();
      ctx.moveTo(0, height);

      // Draw the wave curve
      for (let x = 0; x <= width; x += 2) {
        const y = baseY + 
          Math.sin(x * wave.frequency + t * wave.speed) * wave.amplitude +
          Math.sin(x * wave.frequency * 0.5 + t * wave.speed * 1.3) * (wave.amplitude * 0.3);
        
        if (x === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }

      // Complete the path to fill
      ctx.lineTo(width, height);
      ctx.lineTo(0, height);
      ctx.closePath();

      ctx.fillStyle = gradient;
      ctx.globalAlpha = wave.opacity;
      ctx.fill();

      // Add glow effect
      ctx.shadowColor = wave.color;
      ctx.shadowBlur = 30;
      
      // Draw the top edge line for glow effect
      ctx.beginPath();
      for (let x = 0; x <= width; x += 2) {
        const y = baseY + 
          Math.sin(x * wave.frequency + t * wave.speed) * wave.amplitude +
          Math.sin(x * wave.frequency * 0.5 + t * wave.speed * 1.3) * (wave.amplitude * 0.3);
        
        if (x === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
      
      ctx.strokeStyle = wave.color;
      ctx.lineWidth = 2;
      ctx.globalAlpha = wave.opacity * 1.5;
      ctx.stroke();
      
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;
    };

    const animate = () => {
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
      
      // Draw waves from back to front
      waves.forEach((wave) => {
        drawWave(wave, time);
      });
      
      time += 1;
      animationId = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(animationId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-0"
      style={{
        background: 'transparent',
      }}
    />
  );
};

export default SineWaveBackground;
