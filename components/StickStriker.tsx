
import React, { useRef, useEffect, useState, useCallback } from 'react';
import { GameState, Box, Player, Particle, Vector2D, PowerUp, PowerUpType, Difficulty } from '../types';
import { getCombatCommentary, getRankName } from '../services/geminiService';

const COLORS = {
  PLAYER: '#38bdf8',
  PLAYER_GLOW: '#0ea5e9',
  TRAIL: 'rgba(56, 189, 248, 0.3)',
  BOX_LOW: '#4ade80',
  BOX_MED: '#facc15',
  BOX_HIGH: '#f87171',
  PARTICLE: '#ffffff',
  BG: '#0f172a',
  POWERUP_GROW: '#a855f7',
  POWERUP_MULTIPLIER: '#fbbf24',
  POWERUP_SUPER: '#f472b6'
};

const GRAVITY = 0.15;
const FRICTION = 0.985;
const MAX_POWER = 25;
const TRAIL_LENGTH = 15;
const POWERUP_DURATION = 8000;
const HIGH_SCORE_KEY = 'STICK_STRIKER_HIGH_SCORE';

const StickStriker: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const [gameState, setGameState] = useState<GameState>(GameState.MENU);
  const [difficulty, setDifficulty] = useState<Difficulty>(Difficulty.MEDIUM);
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [commentary, setCommentary] = useState("ESMAGUE!");
  const [rank, setRank] = useState("");
  const [activeEffects, setActiveEffects] = useState<PowerUpType[]>([]);

  const boxesRef = useRef<Box[]>([]);
  const powerUpsRef = useRef<PowerUp[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const playerRef = useRef<Player>({
    id: 'player',
    pos: { x: window.innerWidth / 2, y: window.innerHeight - 100 },
    size: { x: 15, y: 70 },
    vel: { x: 0, y: 0 },
    color: COLORS.PLAYER,
    rotation: 0,
    angularVelocity: 0,
    isAiming: false,
    aimStart: { x: 0, y: 0 },
    aimCurrent: { x: 0, y: 0 },
    trail: [],
    activePowerUps: {}
  });

  const lastTimeRef = useRef<number>(0);
  const frameRef = useRef<number>(0);
  const spawnTimerRef = useRef<number>(0);
  const screenShakeRef = useRef<number>(0);

  // Load high score on mount
  useEffect(() => {
    const saved = localStorage.getItem(HIGH_SCORE_KEY);
    if (saved) {
      setHighScore(parseInt(saved, 10));
    }
  }, []);

  // Sound Engine
  const playHitSound = (isPowerful = false) => {
    if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    const ctx = audioCtxRef.current;
    if (ctx.state === 'suspended') ctx.resume();

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = isPowerful ? 'square' : 'triangle';
    osc.frequency.setValueAtTime(isPowerful ? 150 : 200 + Math.random() * 100, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(40, ctx.currentTime + 0.1);

    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.15);

    const clink = ctx.createOscillator();
    const clinkGain = ctx.createGain();
    clink.type = 'sine';
    clink.frequency.setValueAtTime(800 + Math.random() * 400, ctx.currentTime);
    clinkGain.gain.setValueAtTime(0.1, ctx.currentTime);
    clinkGain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.05);
    clink.connect(clinkGain);
    clinkGain.connect(ctx.destination);
    clink.start();
    clink.stop(ctx.currentTime + 0.05);
  };

  const initGame = useCallback((selectedDiff?: Difficulty) => {
    const finalDiff = selectedDiff || difficulty;
    setDifficulty(finalDiff);
    boxesRef.current = [];
    powerUpsRef.current = [];
    particlesRef.current = [];
    playerRef.current = {
      ...playerRef.current,
      pos: { x: window.innerWidth / 2, y: window.innerHeight - 150 },
      size: { x: 15, y: 70 },
      vel: { x: 0, y: 0 },
      rotation: 0,
      angularVelocity: 0,
      isAiming: false,
      trail: [],
      activePowerUps: {}
    };
    setScore(0);
    setActiveEffects([]);
    setGameState(GameState.PLAYING);
    spawnTimerRef.current = 0;
  }, [difficulty]);

  const spawnBox = useCallback(() => {
    const width = Math.random() * 40 + 40;
    const maxHealth = Math.floor(Math.random() * Math.min(10, 1 + score / 1000)) + 1;
    
    let speedMult = 1.0;
    if (difficulty === Difficulty.EASY) speedMult = 0.6;
    if (difficulty === Difficulty.HARD) speedMult = 2.0;

    const newBox: Box = {
      id: Math.random().toString(36),
      pos: { x: Math.random() * (window.innerWidth - width), y: -width },
      size: { x: width, y: width },
      vel: { x: (Math.random() - 0.5) * 1, y: (1 + Math.random() * 1.5) * speedMult },
      color: maxHealth > 7 ? COLORS.BOX_HIGH : maxHealth > 3 ? COLORS.BOX_MED : COLORS.BOX_LOW,
      health: maxHealth,
      maxHealth: maxHealth,
      rotation: Math.random() * Math.PI * 2,
      rotationSpeed: (Math.random() - 0.5) * 0.05,
      points: maxHealth * 10
    };
    boxesRef.current.push(newBox);

    if (Math.random() < 0.12) {
      const types = [PowerUpType.GROW, PowerUpType.MULTIPLIER, PowerUpType.SUPER];
      const type = types[Math.floor(Math.random() * types.length)];
      const color = type === PowerUpType.GROW ? COLORS.POWERUP_GROW : 
                    type === PowerUpType.MULTIPLIER ? COLORS.POWERUP_MULTIPLIER : 
                    COLORS.POWERUP_SUPER;
      
      powerUpsRef.current.push({
        id: Math.random().toString(36),
        type,
        pos: { x: Math.random() * (window.innerWidth - 30), y: -50 },
        size: { x: 30, y: 30 },
        vel: { x: (Math.random() - 0.5) * 0.5, y: 2 * speedMult },
        color,
        rotation: 0
      });
    }
  }, [score, difficulty]);

  const handleMouseDown = (e: React.MouseEvent | React.TouchEvent) => {
    if (gameState !== GameState.PLAYING) return;
    const clientX = 'touches' in e ? (e as React.TouchEvent).touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = 'touches' in e ? (e as React.TouchEvent).touches[0].clientY : (e as React.MouseEvent).clientY;
    
    playerRef.current.isAiming = true;
    playerRef.current.aimStart = { x: clientX, y: clientY };
    playerRef.current.aimCurrent = { x: clientX, y: clientY };
  };

  const handleMouseMove = (e: MouseEvent | TouchEvent) => {
    if (!playerRef.current.isAiming) return;
    const clientX = 'touches' in e ? (e as TouchEvent).touches[0].clientX : (e as MouseEvent).clientX;
    const clientY = 'touches' in e ? (e as TouchEvent).touches[0].clientY : (e as MouseEvent).clientY;
    playerRef.current.aimCurrent = { x: clientX, y: clientY };
  };

  const handleMouseUp = () => {
    if (!playerRef.current.isAiming) return;
    
    const dx = playerRef.current.aimStart.x - playerRef.current.aimCurrent.x;
    const dy = playerRef.current.aimStart.y - playerRef.current.aimCurrent.y;
    
    const power = Math.min(Math.sqrt(dx * dx + dy * dy) * 0.15, MAX_POWER);
    const angle = Math.atan2(dy, dx);
    
    playerRef.current.vel.x = Math.cos(angle) * power;
    playerRef.current.vel.y = Math.sin(angle) * power;
    playerRef.current.angularVelocity = (Math.random() - 0.5) * 0.4;
    playerRef.current.isAiming = false;
  };

  const createParticles = (x: number, y: number, color: string, count = 8) => {
    for (let i = 0; i < count; i++) {
      particlesRef.current.push({
        id: Math.random().toString(36),
        pos: { x, y },
        vel: { x: (Math.random() - 0.5) * 12, y: (Math.random() - 0.5) * 12 },
        size: Math.random() * 5 + 2,
        color: color,
        life: 1.0
      });
    }
  };

  const update = (dt: number) => {
    if (gameState !== GameState.PLAYING) return;

    const p = playerRef.current;

    const active: PowerUpType[] = [];
    Object.keys(p.activePowerUps).forEach(key => {
      const type = key as PowerUpType;
      const timeLeft = p.activePowerUps[type] || 0;
      if (timeLeft > 0) {
        p.activePowerUps[type] = timeLeft - dt;
        active.push(type);
      } else {
        delete p.activePowerUps[type];
        if (type === PowerUpType.GROW) p.size = { x: 15, y: 70 };
      }
    });
    if (active.length !== activeEffects.length) setActiveEffects(active);

    if (p.activePowerUps[PowerUpType.GROW] && p.size.y < 120) {
      p.size = { x: 25, y: 140 };
    }

    spawnTimerRef.current += dt;
    const spawnRate = Math.max(600, 1800 - (score / 10));
    if (spawnTimerRef.current > spawnRate) {
      spawnBox();
      spawnTimerRef.current = 0;
    }

    if (!p.isAiming) {
      p.pos.x += p.vel.x;
      p.pos.y += p.vel.y;
      p.vel.y += GRAVITY;
      p.vel.x *= FRICTION;
      p.vel.y *= FRICTION;
      p.rotation += p.angularVelocity;
      p.angularVelocity *= 0.99;

      if (p.pos.x < 0 || p.pos.x > window.innerWidth) {
        p.vel.x *= -0.8;
        p.pos.x = p.pos.x < 0 ? 1 : window.innerWidth - 1;
        screenShakeRef.current = 5;
      }
      if (p.pos.y < 0) {
        p.vel.y *= -0.8;
        p.pos.y = 1;
      }
      if (p.pos.y > window.innerHeight) {
        p.vel.y *= -0.6;
        p.pos.y = window.innerHeight - 1;
      }

      p.trail.unshift({ x: p.pos.x, y: p.pos.y });
      if (p.trail.length > TRAIL_LENGTH) p.trail.pop();
    } else {
      if (p.trail.length > 0) p.trail.pop();
    }

    powerUpsRef.current.forEach((pu, idx) => {
      pu.pos.y += pu.vel.y;
      pu.pos.x += pu.vel.x;
      pu.rotation += 0.05;

      if (pu.pos.x < 0 || pu.pos.x + pu.size.x > window.innerWidth) {
        pu.vel.x *= -1;
        pu.pos.x = pu.pos.x < 0 ? 0 : window.innerWidth - pu.size.x;
      }

      const dx = p.pos.x - pu.pos.x;
      const dy = p.pos.y - pu.pos.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 40) {
        p.activePowerUps[pu.type] = POWERUP_DURATION;
        createParticles(pu.pos.x, pu.pos.y, pu.color, 20);
        powerUpsRef.current.splice(idx, 1);
        setCommentary(pu.type + "!");
        playHitSound(true);
      }
      if (pu.pos.y > window.innerHeight) powerUpsRef.current.splice(idx, 1);
    });

    boxesRef.current.forEach((box, bIdx) => {
      box.pos.y += box.vel.y;
      box.pos.x += box.vel.x;
      box.rotation += box.rotationSpeed;

      if (box.pos.x < 0 || box.pos.x + box.size.x > window.innerWidth) {
        box.vel.x *= -1;
        box.pos.x = box.pos.x < 0 ? 0 : window.innerWidth - box.size.x;
      }

      if (box.pos.y > window.innerHeight) {
        setGameState(GameState.GAMEOVER);
      }

      const dx = p.pos.x - (box.pos.x + box.size.x / 2);
      const dy = p.pos.y - (box.pos.y + box.size.y / 2);
      const dist = Math.sqrt(dx * dx + dy * dy);
      const minDist = box.size.x / 2 + (p.size.y / 3);

      if (dist < minDist) {
        const speed = Math.sqrt(p.vel.x * p.vel.x + p.vel.y * p.vel.y);
        const isSuper = !!p.activePowerUps[PowerUpType.SUPER];

        if (speed > 2 || isSuper) {
          playHitSound(isSuper || speed > 15);
          box.health -= isSuper ? 5 : 1;
          screenShakeRef.current = speed * 0.5;
          createParticles(p.pos.x, p.pos.y, box.color, 12);
          
          const angle = Math.atan2(dy, dx);
          const bounceFactor = isSuper ? 0.3 : 0.8;
          p.vel.x = Math.cos(angle) * (speed * bounceFactor + 2);
          p.vel.y = Math.sin(angle) * (speed * bounceFactor + 2);
          p.angularVelocity = (Math.random() - 0.5) * 0.8;

          if (box.health <= 0) {
            setScore(prev => {
              const multi = p.activePowerUps[PowerUpType.MULTIPLIER] ? 2 : 1;
              const newScore = prev + (box.points * multi);
              if (newScore > 0 && Math.floor(newScore / 1000) > Math.floor(prev / 1000)) {
                fetchCommentary(newScore);
              }
              return newScore;
            });
            boxesRef.current.splice(bIdx, 1);
          }
        }
      }
    });

    particlesRef.current.forEach(part => {
      part.pos.x += part.vel.x;
      part.pos.y += part.vel.y;
      part.life -= 0.02;
    });
    particlesRef.current = particlesRef.current.filter(part => part.life > 0);

    if (screenShakeRef.current > 0) screenShakeRef.current *= 0.9;
  };

  const fetchCommentary = async (s: number) => {
    const msg = await getCombatCommentary(s);
    setCommentary(msg);
  };

  const fetchRank = async (s: number) => {
    const r = await getRankName(s);
    setRank(r);
  };

  useEffect(() => {
    if (gameState === GameState.GAMEOVER) {
      fetchRank(score);
      if (score > highScore) {
        setHighScore(score);
        localStorage.setItem(HIGH_SCORE_KEY, score.toString());
      }
    }
  }, [gameState, score, highScore]);

  const draw = (ctx: CanvasRenderingContext2D | null) => {
    if (!ctx) return;
    const canvas = ctx.canvas;
    ctx.save();
    
    if (screenShakeRef.current > 0.5) {
      ctx.translate((Math.random() - 0.5) * screenShakeRef.current, (Math.random() - 0.5) * screenShakeRef.current);
    }
    
    ctx.clearRect(-100, -100, canvas.width + 200, canvas.height + 200);

    const p = playerRef.current;

    if (p.isAiming) {
      const dx = p.aimStart.x - p.aimCurrent.x;
      const dy = p.aimStart.y - p.aimCurrent.y;
      const power = Math.min(Math.sqrt(dx * dx + dy * dy) * 0.15, MAX_POWER);
      const angle = Math.atan2(dy, dx);

      ctx.setLineDash([5, 10]);
      ctx.strokeStyle = COLORS.PLAYER;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(p.pos.x, p.pos.y);
      ctx.lineTo(p.pos.x + Math.cos(angle) * power * 10, p.pos.y + Math.sin(angle) * power * 10);
      ctx.stroke();
      ctx.setLineDash([]);
      
      ctx.beginPath();
      ctx.arc(p.pos.x, p.pos.y, power * 5, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(56, 189, 248, ${power/MAX_POWER})`;
      ctx.stroke();
    }

    if (p.trail.length > 1) {
      ctx.beginPath();
      ctx.strokeStyle = p.activePowerUps[PowerUpType.SUPER] ? COLORS.POWERUP_SUPER : COLORS.TRAIL;
      ctx.lineWidth = p.size.x;
      ctx.lineCap = 'round';
      ctx.moveTo(p.trail[0].x, p.trail[0].y);
      for(let i = 1; i < p.trail.length; i++) {
        ctx.lineTo(p.trail[i].x, p.trail[i].y);
      }
      ctx.stroke();
    }

    ctx.save();
    ctx.translate(p.pos.x, p.pos.y);
    ctx.rotate(p.rotation);
    ctx.fillStyle = p.activePowerUps[PowerUpType.SUPER] ? '#fff' : p.color;
    ctx.shadowBlur = 15;
    ctx.shadowColor = p.activePowerUps[PowerUpType.SUPER] ? COLORS.POWERUP_SUPER : COLORS.PLAYER_GLOW;
    ctx.fillRect(-p.size.x / 2, -p.size.y / 2, p.size.x, p.size.y);
    ctx.restore();

    powerUpsRef.current.forEach(pu => {
      ctx.save();
      ctx.translate(pu.pos.x, pu.pos.y);
      ctx.rotate(pu.rotation);
      ctx.fillStyle = pu.color;
      ctx.shadowBlur = 15;
      ctx.shadowColor = pu.color;
      ctx.beginPath();
      ctx.arc(0, 0, 15, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.font = "bold 12px Rajdhani";
      ctx.textAlign = "center";
      const icon = pu.type === PowerUpType.GROW ? "G" : pu.type === PowerUpType.MULTIPLIER ? "2X" : "S";
      ctx.fillText(icon, 0, 4);
      ctx.restore();
    });

    boxesRef.current.forEach(box => {
      ctx.save();
      ctx.translate(box.pos.x + box.size.x / 2, box.pos.y + box.size.y / 2);
      ctx.rotate(box.rotation);
      ctx.fillStyle = box.color;
      ctx.shadowBlur = 10;
      ctx.shadowColor = box.color;
      ctx.fillRect(-box.size.x / 2, -box.size.y / 2, box.size.x, box.size.y);
      
      ctx.rotate(-box.rotation);
      ctx.fillStyle = '#000';
      ctx.font = 'bold 16px Rajdhani';
      ctx.textAlign = 'center';
      ctx.fillText(box.health.toString(), 0, 6);
      ctx.restore();
    });

    particlesRef.current.forEach(part => {
      ctx.globalAlpha = part.life;
      ctx.fillStyle = part.color;
      ctx.fillRect(part.pos.x, part.pos.y, part.size, part.size);
    });
    ctx.globalAlpha = 1.0;
    
    ctx.restore();
  };

  useEffect(() => {
    const handleResize = () => {
      if (canvasRef.current) {
        canvasRef.current.width = window.innerWidth;
        canvasRef.current.height = window.innerHeight;
      }
    };

    const mouseMoveHandler = (e: MouseEvent) => handleMouseMove(e);
    const touchMoveHandler = (e: TouchEvent) => handleMouseMove(e);

    window.addEventListener('mousemove', mouseMoveHandler);
    window.addEventListener('touchmove', touchMoveHandler);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('touchend', handleMouseUp);
    window.addEventListener('resize', handleResize);
    handleResize();

    const loop = (time: number) => {
      const dt = time - lastTimeRef.current;
      lastTimeRef.current = time;

      update(dt);
      if (canvasRef.current) {
        draw(canvasRef.current.getContext('2d'));
      }
      frameRef.current = requestAnimationFrame(loop);
    };

    frameRef.current = requestAnimationFrame(loop);

    return () => {
      window.removeEventListener('mousemove', mouseMoveHandler);
      window.removeEventListener('touchmove', touchMoveHandler);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchend', handleMouseUp);
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(frameRef.current);
    };
  }, [gameState, score, difficulty]);

  const powerUpIcons: Record<PowerUpType, { icon: string; color: string; label: string }> = {
    [PowerUpType.GROW]: { icon: "fa-up-right-and-down-left-from-center", color: "text-purple-400", label: "Gigante" },
    [PowerUpType.MULTIPLIER]: { icon: "fa-angles-up", color: "text-amber-400", label: "2X Pontos" },
    [PowerUpType.SUPER]: { icon: "fa-fire", color: "text-pink-400", label: "Super Smash" }
  };

  return (
    <div 
        className="relative w-full h-screen overflow-hidden bg-slate-900 touch-none select-none" 
        onMouseDown={handleMouseDown}
        onTouchStart={handleMouseDown}
    >
      <canvas ref={canvasRef} />

      {/* Notice Bar */}
      <div className="absolute top-0 w-full flex justify-center z-50 pointer-events-none">
        <div className="bg-white/10 backdrop-blur-md px-4 py-1 rounded-b-xl border border-white/10 border-t-0 shadow-2xl flex items-center gap-2">
           <i className="fa-brands fa-google text-sky-400 text-xs"></i>
           <span className="text-[10px] text-white/60 font-bold uppercase tracking-[0.2em]">
             Feito inteiramente pelo Google AI Studio
           </span>
        </div>
      </div>

      {/* HUD */}
      {gameState === GameState.PLAYING && (
        <div className="absolute top-0 left-0 w-full p-6 pt-12 flex justify-between items-start pointer-events-none">
          <div className="flex flex-col gap-1">
            <span className="text-sky-400 text-sm font-bold tracking-widest uppercase">Score</span>
            <span className="text-white text-4xl font-bold pixel-font">{score}</span>
            <span className="text-white/40 text-[10px] uppercase tracking-widest mt-1">Dificuldade: {difficulty}</span>
            
            <div className="flex gap-2 mt-4">
              {activeEffects.map(type => (
                <div key={type} className={`flex items-center gap-2 bg-slate-800/80 px-3 py-1.5 rounded-lg border border-white/10 ${powerUpIcons[type].color} animate-pulse shadow-lg`}>
                  <i className={`fa-solid ${powerUpIcons[type].icon}`}></i>
                  <span className="text-xs font-bold uppercase tracking-tighter">{powerUpIcons[type].label}</span>
                </div>
              ))}
            </div>
          </div>
          
          <div className="flex flex-col items-end gap-2 max-w-[50%]">
             {commentary && (
               <div className="bg-pink-500 text-white px-3 py-1 rounded text-sm italic font-bold animate-bounce text-right shadow-lg border-2 border-white/20">
                  "{commentary}"
               </div>
             )}
          </div>
        </div>
      )}

      {/* Menu Principal */}
      {gameState === GameState.MENU && (
        <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="max-w-md w-full text-center space-y-8 animate-in fade-in zoom-in duration-300">
            <div>
              <h1 className="text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-sky-400 via-pink-400 to-yellow-400 pixel-font leading-tight drop-shadow-2xl">
                JOGUE O<br/>BASTÃO
              </h1>
              {highScore > 0 && (
                <div className="mt-4 inline-block bg-yellow-500/20 border border-yellow-500/40 px-4 py-2 rounded-full">
                  <span className="text-yellow-400 text-xs font-bold uppercase tracking-widest mr-2">Recorde:</span>
                  <span className="text-white font-bold pixel-font">{highScore}</span>
                </div>
              )}
            </div>
            
            <div className="space-y-4">
                <p className="text-slate-300 text-lg">
                    Você é o bastão! Puxe e solte para se lançar contra as caixas.
                </p>
                
                {/* Dificuldades */}
                <div className="grid grid-cols-3 gap-3">
                  <button 
                    onClick={(e) => { e.stopPropagation(); initGame(Difficulty.EASY); }}
                    className="p-3 bg-green-500/20 border border-green-500/50 hover:bg-green-500/40 rounded-xl text-green-400 font-bold transition-all text-sm uppercase"
                  >
                    Fácil
                  </button>
                  <button 
                    onClick={(e) => { e.stopPropagation(); initGame(Difficulty.MEDIUM); }}
                    className="p-3 bg-yellow-500/20 border border-yellow-500/50 hover:bg-yellow-500/40 rounded-xl text-yellow-400 font-bold transition-all text-sm uppercase"
                  >
                    Médio
                  </button>
                  <button 
                    onClick={(e) => { e.stopPropagation(); initGame(Difficulty.HARD); }}
                    className="p-3 bg-red-500/20 border border-red-500/50 hover:bg-red-500/40 rounded-xl text-red-400 font-bold transition-all text-sm uppercase"
                  >
                    Difícil
                  </button>
                </div>
            </div>

            <button 
              onClick={(e) => { e.stopPropagation(); initGame(); }}
              className="group relative px-12 py-6 bg-sky-500 hover:bg-sky-400 transition-all rounded-2xl text-white font-bold text-2xl shadow-[0_0_20px_rgba(14,165,233,0.4)] hover:shadow-[0_0_40px_rgba(14,165,233,0.6)] active:scale-95"
            >
              <div className="flex items-center gap-3">
                <i className="fa-solid fa-bolt text-white/50 group-hover:text-white"></i>
                LANCAR AGORA
              </div>
            </button>
            <div className="text-slate-500 text-[10px] uppercase tracking-widest pt-10">
              Puxe para trás para o estilingue
            </div>
          </div>
        </div>
      )}

      {/* Game Over */}
      {gameState === GameState.GAMEOVER && (
        <div className="absolute inset-0 bg-red-950/90 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="max-w-md w-full bg-slate-900 border-2 border-red-500/50 rounded-[40px] p-10 text-center space-y-8 shadow-2xl">
            <div className="space-y-2">
              <h2 className="text-5xl font-black text-red-500 pixel-font">QUEDA!</h2>
              <div className="h-1 w-24 bg-red-500 mx-auto rounded-full" />
            </div>

            <div className="space-y-4 py-4">
              <div className="flex flex-col">
                 <span className="text-slate-400 text-sm uppercase tracking-widest">Sua Legenda</span>
                 <span className="text-yellow-400 text-2xl font-bold italic">
                   {rank || "Calculando força..."}
                 </span>
              </div>
              
              <div className="flex justify-center gap-12 items-center">
                <div className="text-center">
                  <div className="text-slate-400 text-xs uppercase mb-1">Score</div>
                  <div className="text-white text-3xl font-bold pixel-font">{score}</div>
                </div>
                {score >= highScore && score > 0 && (
                  <div className="text-center">
                    <div className="text-yellow-400 text-[10px] uppercase mb-1 font-bold animate-pulse">Novo Recorde!</div>
                    <i className="fa-solid fa-trophy text-yellow-400 text-2xl"></i>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-3">
               <button 
                onClick={(e) => { e.stopPropagation(); initGame(); }}
                className="w-full py-5 bg-white text-slate-950 hover:bg-slate-100 transition-all rounded-2xl font-bold text-xl flex items-center justify-center gap-3 shadow-xl hover:scale-105 active:scale-95"
              >
                <i className="fa-solid fa-rotate-right"></i>
                TENTAR NOVAMENTE
              </button>
              <button 
                onClick={(e) => { e.stopPropagation(); setGameState(GameState.MENU); }}
                className="w-full py-3 bg-slate-800 text-white hover:bg-slate-700 transition-all rounded-xl font-bold text-sm uppercase tracking-widest"
              >
                Menu Principal
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StickStriker;