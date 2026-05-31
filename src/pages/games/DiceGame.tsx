// src/pages/games/DiceGame.tsx
import React, { useState, useRef, Suspense, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Canvas, useFrame } from '@react-three/fiber';
import { RoundedBox } from '@react-three/drei';
import * as THREE from 'three';
import { useAuth } from '../../context/AuthContext';
import { playDiceGame } from '../../firebase/games';
import { calculateUsableBalance, formatCurrency } from '../../utils/helpers';
import { Loader2, Trophy, TrendingDown, Timer, Zap } from 'lucide-react';
import toast from 'react-hot-toast';

// ── Dot positions per face ───────────────────────────────────
const diceDots: Record<number, [number, number, number][]> = {
  1: [[0, 0, 0.92]],
  2: [[-0.3, 0.3, 0.92], [0.3, -0.3, 0.92]],
  3: [[-0.3, 0.3, 0.92], [0, 0, 0.92], [0.3, -0.3, 0.92]],
  4: [[-0.3, 0.3, 0.92], [0.3, 0.3, 0.92], [-0.3, -0.3, 0.92], [0.3, -0.3, 0.92]],
  5: [[-0.3, 0.3, 0.92], [0.3, 0.3, 0.92], [0, 0, 0.92], [-0.3, -0.3, 0.92], [0.3, -0.3, 0.92]],
  6: [[-0.3, 0.3, 0.92], [0.3, 0.3, 0.92], [-0.3, 0, 0.92], [0.3, 0, 0.92], [-0.3, -0.3, 0.92], [0.3, -0.3, 0.92]],
};

// ── Target rotations so the correct face shows forward ───────
// Face 1 → front (+Z), 2 → back, 3 → top, 4 → bottom, 5 → right, 6 → left
const faceRotations: Record<number, [number, number, number]> = {
  1: [0, 0, 0],
  2: [0, Math.PI, 0],
  3: [-Math.PI / 2, 0, 0],
  4: [Math.PI / 2, 0, 0],
  5: [0, -Math.PI / 2, 0],
  6: [0, Math.PI / 2, 0],
};

// ── Single 3-D die ───────────────────────────────────────────
interface DiceMeshProps {
  value: number;
  rolling: boolean;
  offset?: number; // x-axis offset
}

const DiceMesh: React.FC<DiceMeshProps> = ({ value, rolling, offset = 0 }) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const speed = useRef(0);
  const settled = useRef(false);
  const targetRot = faceRotations[value] ?? [0, 0, 0];

  // Reset when rolling starts
  useEffect(() => {
    if (rolling) { settled.current = false; speed.current = 0; }
  }, [rolling]);

  useFrame((_, delta) => {
    if (!meshRef.current) return;

    if (rolling) {
      // Spin fast
      speed.current = Math.min(speed.current + delta * 12, 18);
      meshRef.current.rotation.x += delta * speed.current;
      meshRef.current.rotation.y += delta * speed.current * 0.8;
      meshRef.current.rotation.z += delta * speed.current * 0.4;
      settled.current = false;
    } else if (!settled.current) {
      // Lerp toward target face
      speed.current = Math.max(speed.current - delta * 10, 0);
      meshRef.current.rotation.x += delta * speed.current;
      meshRef.current.rotation.y += delta * speed.current * 0.8;

      const lerpSpeed = 6;
      meshRef.current.rotation.x = THREE.MathUtils.lerp(
        meshRef.current.rotation.x, targetRot[0], delta * lerpSpeed
      );
      meshRef.current.rotation.y = THREE.MathUtils.lerp(
        meshRef.current.rotation.y, targetRot[1], delta * lerpSpeed
      );
      meshRef.current.rotation.z = THREE.MathUtils.lerp(
        meshRef.current.rotation.z, targetRot[2], delta * lerpSpeed
      );

      const diff = Math.abs(meshRef.current.rotation.x - targetRot[0])
        + Math.abs(meshRef.current.rotation.y - targetRot[1])
        + Math.abs(meshRef.current.rotation.z - targetRot[2]);

      if (diff < 0.01 && speed.current < 0.1) {
        meshRef.current.rotation.set(...targetRot);
        settled.current = true;
      }
    }
  });

  return (
    <group position={[offset, 0, 0]}>
      <mesh ref={meshRef} castShadow>
        {/* White die body */}
        <RoundedBox args={[1.8, 1.8, 1.8]} radius={0.18} smoothness={6}>
          <meshStandardMaterial
            color="#ffffff"
            roughness={0.15}
            metalness={0.05}
          />
        </RoundedBox>

        {/* Black dots */}
        {(diceDots[value] ?? diceDots[1]).map(([x, y, z], i) => (
          <mesh key={i} position={[x, y, z]}>
            <sphereGeometry args={[0.11, 16, 16]} />
            <meshStandardMaterial
              color="#111111"
              roughness={0.3}
              metalness={0.0}
            />
          </mesh>
        ))}
      </mesh>
    </group>
  );
};

// ── Scene ────────────────────────────────────────────────────
const DiceScene: React.FC<{ d1: number; d2: number; rolling: boolean }> = ({
  d1, d2, rolling,
}) => (
  <>
    <color attach="background" args={['#0f172a']} />
    <ambientLight intensity={1.2} />
    <directionalLight position={[4, 6, 5]} intensity={2.0} castShadow />
    <pointLight position={[-4, -4, 4]} intensity={0.6} color="#e0e7ff" />
    <DiceMesh value={d1} rolling={rolling} offset={-1.2} />
    <DiceMesh value={d2} rolling={rolling} offset={1.2} />
  </>
);

// ── Live countdown timer ──────────────────────────────────────
const LiveTimer: React.FC<{ seconds: number }> = ({ seconds }) => {
  const color =
    seconds > 10 ? 'text-emerald-400' :
    seconds > 5  ? 'text-amber-400' :
                   'text-red-400 animate-pulse';

  const pct = Math.min(100, (seconds / 30) * 100);
  const barColor =
    seconds > 10 ? 'bg-emerald-500' :
    seconds > 5  ? 'bg-amber-500'   : 'bg-red-500';

  return (
    <div className="flex flex-col items-center gap-1 min-w-[56px]">
      <div className={`text-2xl font-black tabular-nums ${color}`}>
        {seconds}
        <span className="text-sm font-normal ml-0.5">s</span>
      </div>
      <div className="w-full h-1.5 bg-gray-700 rounded-full overflow-hidden">
        <div
          className={`h-full ${barColor} rounded-full transition-all duration-300`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
};

// ── Constants ────────────────────────────────────────────────
const BET_AMOUNTS = [10, 20, 50, 100, 200, 500];
const ROUND_DURATION = 30; // seconds per round

// ── Main Component ───────────────────────────────────────────
export const DiceGame: React.FC = () => {
  const { firebaseUser, wallet } = useAuth();

  // Game state
  const [prediction, setPrediction] = useState<'ODD' | 'EVEN' | null>(null);
  const [betAmount, setBetAmount]   = useState(10);
  const [rolling, setRolling]       = useState(false);
  const [d1, setD1] = useState(1);
  const [d2, setD2] = useState(1);
  const [result, setResult] = useState<{
    won: boolean; sum: number; payout: number;
    actual: 'ODD' | 'EVEN';
  } | null>(null);
  const [loading, setLoading] = useState(false);

  // Timer state
  const [timeLeft, setTimeLeft]     = useState(ROUND_DURATION);
  const [phase, setPhase]           = useState<'betting' | 'rolling' | 'result'>('betting');
  const [autoRoll, setAutoRoll]     = useState(false);

  // Refs
  const isProcessing = useRef(false);
  const timerRef     = useRef<ReturnType<typeof setInterval> | null>(null);
  const phaseRef     = useRef(phase);
  phaseRef.current   = phase;

  const usableBalance = wallet ? calculateUsableBalance(wallet) : 0;

  // ── Timer logic ─────────────────────────────────────────
  const startTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    setTimeLeft(ROUND_DURATION);
    setPhase('betting');
    setResult(null);

    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          // Trigger auto-roll phase
          setPhase('rolling');
          setAutoRoll(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  // Start timer on mount
  useEffect(() => {
    startTimer();
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [startTimer]);

  // When auto-roll triggers
  useEffect(() => {
    if (!autoRoll) return;
    setAutoRoll(false);

    // If user hasn't predicted or can't bet, just show random roll animation
    if (!prediction || !firebaseUser || loading) {
      animateOnly();
      return;
    }
    performRoll();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRoll]);

  // ── Animate only (no bet) ────────────────────────────────
  const animateOnly = useCallback(() => {
    setRolling(true);
    const iv = setInterval(() => {
      setD1(Math.floor(Math.random() * 6) + 1);
      setD2(Math.floor(Math.random() * 6) + 1);
    }, 100);
    setTimeout(() => {
      clearInterval(iv);
      const fd1 = Math.floor(Math.random() * 6) + 1;
      const fd2 = Math.floor(Math.random() * 6) + 1;
      setD1(fd1);
      setD2(fd2);
      setRolling(false);
      setPhase('result');
      // Start next round after 5s
      setTimeout(startTimer, 5000);
    }, 2500);
  }, [startTimer]);

  // ── Perform actual bet + roll ────────────────────────────
  const performRoll = useCallback(async () => {
    if (!firebaseUser || !prediction || isProcessing.current) return;
    if (betAmount > usableBalance) {
      toast.error('Insufficient balance — showing result without bet');
      animateOnly();
      return;
    }

    isProcessing.current = true;
    setLoading(true);
    setRolling(true);
    setResult(null);

    // Animate dice while waiting for server
    const iv = setInterval(() => {
      setD1(Math.floor(Math.random() * 6) + 1);
      setD2(Math.floor(Math.random() * 6) + 1);
    }, 100);

    try {
      const gameResult = await playDiceGame(firebaseUser.uid, betAmount, prediction);

      setTimeout(() => {
        clearInterval(iv);
        setRolling(false);
        setD1(gameResult.dice1);
        setD2(gameResult.dice2);

        const actual: 'ODD' | 'EVEN' = gameResult.sum % 2 === 0 ? 'EVEN' : 'ODD';
        setResult({
          won: gameResult.won,
          sum: gameResult.sum,
          payout: gameResult.payout,
          actual,
        });
        setPhase('result');

        if (gameResult.won) {
          toast.success(`🎲 Won! Sum ${gameResult.sum} is ${actual}`);
        } else {
          toast.error(`😔 Lost. Sum ${gameResult.sum} is ${actual}`);
        }

        setLoading(false);
        isProcessing.current = false;

        // Auto-start next round
        setTimeout(() => {
          setPrediction(null);
          startTimer();
        }, 5000);
      }, 2500);
    } catch (err: any) {
      clearInterval(iv);
      setRolling(false);
      toast.error(err.message || 'Roll failed');
      setLoading(false);
      isProcessing.current = false;
      animateOnly();
    }
  }, [firebaseUser, prediction, betAmount, usableBalance, animateOnly, startTimer]);

  // ── Manual roll button ───────────────────────────────────
  const handleManualRoll = () => {
    if (phase !== 'betting') return;
    if (!prediction) { toast.error('Select ODD or EVEN first'); return; }
    // Stop timer and roll immediately
    if (timerRef.current) clearInterval(timerRef.current);
    setPhase('rolling');
    performRoll();
  };

  return (
    <div className="max-w-lg mx-auto space-y-4 pb-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center pt-2"
      >
        <h2 className="text-2xl font-bold text-white flex items-center justify-center gap-2">
          <span>🎲</span> Dice Game
        </h2>
        <p className="text-gray-400 text-sm mt-0.5">
          Roll 2 dice — predict Odd or Even sum
        </p>
      </motion.div>

      {/* Phase banner */}
      <div className={`flex items-center justify-between px-4 py-2.5 rounded-xl border text-sm font-semibold
        ${phase === 'betting'
          ? 'bg-emerald-900/30 border-emerald-600/40 text-emerald-300'
          : phase === 'rolling'
          ? 'bg-amber-900/30 border-amber-600/40 text-amber-300'
          : 'bg-blue-900/30 border-blue-600/40 text-blue-300'}`}
      >
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full flex-shrink-0
            ${phase === 'betting' ? 'bg-emerald-400 animate-pulse' :
              phase === 'rolling' ? 'bg-amber-400 animate-pulse' : 'bg-blue-400'}`}
          />
          {phase === 'betting' && '🟢 Betting Open — Place your bet!'}
          {phase === 'rolling' && '🎲 Rolling dice...'}
          {phase === 'result'  && '🏁 Round Complete'}
        </div>

        {/* Live timer */}
        {phase === 'betting' && (
          <div className="flex items-center gap-1.5">
            <Timer className="w-4 h-4 text-emerald-400" />
            <LiveTimer seconds={timeLeft} />
          </div>
        )}
        {phase === 'rolling' && <Loader2 className="w-4 h-4 animate-spin" />}
        {phase === 'result'  && result && (
          <span className={result.won ? 'text-green-400' : 'text-red-400'}>
            {result.won ? '🎉 Win!' : '😔 Loss'}
          </span>
        )}
      </div>

      {/* 3-D Canvas */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="rounded-2xl overflow-hidden border border-white/10 shadow-2xl"
        style={{ height: 220 }}
      >
        <Canvas
          camera={{ position: [0, 0, 6], fov: 48 }}
          shadows
          gl={{ antialias: true }}
        >
          <Suspense fallback={null}>
            <DiceScene d1={d1} d2={d2} rolling={rolling} />
          </Suspense>
        </Canvas>
      </motion.div>

      {/* Dice value display */}
      <div className="flex items-center justify-center gap-4">
        {[d1, d2].map((val, idx) => (
          <div
            key={idx}
            className="w-14 h-14 bg-white border-2 border-gray-200 rounded-xl
                       flex items-center justify-center text-2xl font-black text-gray-900
                       shadow-lg"
          >
            {val}
          </div>
        ))}
        <div className="text-gray-400 text-xl font-bold">
          = <span className="text-white">{d1 + d2}</span>
        </div>
        <div className={`px-3 py-1 rounded-lg text-sm font-bold
          ${(d1 + d2) % 2 === 0 ? 'bg-blue-500/20 text-blue-300' : 'bg-orange-500/20 text-orange-300'}`}
        >
          {(d1 + d2) % 2 === 0 ? 'EVEN' : 'ODD'}
        </div>
      </div>

      {/* Result card */}
      <AnimatePresence>
        {result && phase === 'result' && (
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            className={`rounded-2xl p-5 text-center border-2
              ${result.won
                ? 'bg-green-900/30 border-green-500/50'
                : 'bg-red-900/30 border-red-500/50'}`}
          >
            <div className="flex items-center justify-center gap-3 mb-1">
              {result.won
                ? <Trophy className="w-7 h-7 text-yellow-400" />
                : <TrendingDown className="w-7 h-7 text-red-400" />}
              <span className="text-2xl font-black text-white">
                {d1} + {d2} = {result.sum}
              </span>
            </div>
            <p className={`text-sm font-bold mb-2
              ${result.actual === 'EVEN' ? 'text-blue-400' : 'text-orange-400'}`}
            >
              Sum is {result.actual}
            </p>
            {result.won ? (
              <p className="text-green-400 font-black text-xl">
                🎉 You Won {formatCurrency(result.payout)}!
              </p>
            ) : (
              <p className="text-red-400 font-bold text-lg">
                Better luck next time!
              </p>
            )}
            <p className="text-gray-500 text-xs mt-2">Next round in 5s…</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bet panel */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-4">
        {/* Prediction */}
        <div>
          <p className="text-sm font-medium text-gray-300 mb-2 flex items-center gap-1">
            <Zap className="w-4 h-4 text-yellow-400" />
            Your Prediction
          </p>
          <div className="grid grid-cols-2 gap-3">
            {(['ODD', 'EVEN'] as const).map(opt => (
              <motion.button
                key={opt}
                whileHover={{ scale: phase === 'betting' ? 1.03 : 1 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => phase === 'betting' && setPrediction(opt)}
                disabled={phase !== 'betting'}
                className={`py-4 rounded-xl border-2 font-bold text-base transition-all
                  disabled:cursor-not-allowed
                  ${prediction === opt
                    ? opt === 'ODD'
                      ? 'bg-orange-500/30 border-orange-400 text-orange-300'
                      : 'bg-blue-500/30 border-blue-400 text-blue-300'
                    : 'bg-white/5 border-white/10 text-gray-300 hover:bg-white/10'
                  } disabled:opacity-60`}
              >
                {opt === 'ODD' ? '🎯 ODD' : '🎯 EVEN'}
                <p className="text-xs text-gray-400 font-normal mt-1">2× Payout</p>
              </motion.button>
            ))}
          </div>
        </div>

        {/* Bet amounts */}
        <div>
          <p className="text-sm font-medium text-gray-300 mb-2">Bet Amount</p>
          <div className="grid grid-cols-3 gap-2 mb-3">
            {BET_AMOUNTS.map(amt => (
              <motion.button
                key={amt}
                whileTap={{ scale: 0.95 }}
                onClick={() => phase === 'betting' && setBetAmount(amt)}
                disabled={amt > usableBalance || phase !== 'betting'}
                className={`py-2 rounded-xl text-sm font-semibold border transition-all
                  ${betAmount === amt
                    ? 'bg-yellow-500/20 border-yellow-500/50 text-yellow-400'
                    : 'bg-white/5 border-white/10 text-gray-300 hover:bg-white/10'
                  } disabled:opacity-40`}
              >
                ₹{amt >= 1000 ? `${amt / 1000}K` : amt}
              </motion.button>
            ))}
          </div>

          <div className="flex justify-between text-xs text-gray-400 mb-3">
            <span>Balance: {formatCurrency(usableBalance)}</span>
            <span className="text-green-400">
              Win: {formatCurrency(betAmount * 2)}
            </span>
          </div>
        </div>

        {/* Roll button */}
        <motion.button
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.97 }}
          onClick={handleManualRoll}
          disabled={!prediction || phase !== 'betting' || loading}
          className="w-full bg-gradient-to-r from-indigo-500 to-purple-600
                     hover:from-indigo-400 hover:to-purple-500
                     text-white font-bold py-4 rounded-xl
                     disabled:opacity-50 disabled:cursor-not-allowed
                     flex items-center justify-center gap-2 text-lg shadow-lg"
        >
          {loading ? (
            <><Loader2 className="w-5 h-5 animate-spin" /> Rolling...</>
          ) : phase === 'betting' ? (
            '🎲 Roll Now'
          ) : (
            '⏳ Round in progress...'
          )}
        </motion.button>

        <p className="text-center text-xs text-gray-500">
          {phase === 'betting'
            ? `Auto-roll in ${timeLeft}s • Or click Roll Now`
            : phase === 'result'
            ? 'Next round starting soon…'
            : 'Dice rolling…'}
        </p>
      </div>

      {/* Rules */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
        <h3 className="text-sm font-bold text-white mb-2">How to Play</h3>
        <ul className="text-xs text-gray-400 space-y-1">
          <li>• 30-second betting window per round</li>
          <li>• Predict if sum of 2 dice is ODD or EVEN</li>
          <li>• Correct prediction = 2× your bet</li>
          <li>• Click <strong className="text-white">Roll Now</strong> to play early</li>
          <li>• Min bet: ₹10</li>
        </ul>
      </div>
    </div>
  );
};
