import React, { useState, useRef, Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Canvas, useFrame } from '@react-three/fiber';
import { RoundedBox, Text } from '@react-three/drei';
import * as THREE from 'three';
import { useAuth } from '../../context/AuthContext';
import { playDiceGame } from '../../firebase/games';
import { calculateUsableBalance, formatCurrency } from '../../utils/helpers';
import { Loader2, Trophy, TrendingDown } from 'lucide-react';
import toast from 'react-hot-toast';

// 3D Dice face dots positions
const diceDots: Record<number, [number, number][]> = {
  1: [[0, 0]],
  2: [[-0.3, 0.3], [0.3, -0.3]],
  3: [[-0.3, 0.3], [0, 0], [0.3, -0.3]],
  4: [[-0.3, 0.3], [0.3, 0.3], [-0.3, -0.3], [0.3, -0.3]],
  5: [[-0.3, 0.3], [0.3, 0.3], [0, 0], [-0.3, -0.3], [0.3, -0.3]],
  6: [[-0.3, 0.3], [0.3, 0.3], [-0.3, 0], [0.3, 0], [-0.3, -0.3], [0.3, -0.3]],
};

interface DiceMeshProps {
  value: number;
  rolling: boolean;
  delay?: number;
}

const DiceMesh: React.FC<DiceMeshProps> = ({ value, rolling, delay = 0 }) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const speedRef = useRef(0);

  useFrame((_, delta) => {
    if (!meshRef.current) return;
    if (rolling) {
      speedRef.current = Math.min(speedRef.current + delta * 10, 15);
      meshRef.current.rotation.x += delta * speedRef.current;
      meshRef.current.rotation.y += delta * speedRef.current * 0.7;
      meshRef.current.rotation.z += delta * speedRef.current * 0.5;
    } else {
      speedRef.current = Math.max(speedRef.current - delta * 8, 0);
      if (speedRef.current > 0) {
        meshRef.current.rotation.x += delta * speedRef.current;
        meshRef.current.rotation.y += delta * speedRef.current * 0.7;
      }
    }
  });

  return (
    <mesh ref={meshRef}>
      <RoundedBox args={[1.8, 1.8, 1.8]} radius={0.2} smoothness={4}>
        <meshStandardMaterial color="#1e1b4b" roughness={0.3} metalness={0.5} />
      </RoundedBox>
      {/* Dots */}
      {(diceDots[value] || diceDots[1]).map(([x, y], i) => (
        <mesh key={i} position={[x, y, 0.92]}>
          <sphereGeometry args={[0.12, 16, 16]} />
          <meshStandardMaterial color="#fbbf24" roughness={0.2} metalness={0.8} emissive="#fbbf24" emissiveIntensity={0.5} />
        </mesh>
      ))}
    </mesh>
  );
};

const DiceScene: React.FC<{ dice1: number; dice2: number; rolling: boolean }> = ({ dice1, dice2, rolling }) => {
  return (
    <>
      <ambientLight intensity={0.6} />
      <pointLight position={[5, 5, 5]} intensity={1.5} color="#fbbf24" />
      <pointLight position={[-5, -5, 5]} intensity={0.8} color="#818cf8" />
      <group position={[-1.2, 0, 0]}>
        <DiceMesh value={dice1} rolling={rolling} />
      </group>
      <group position={[1.2, 0, 0]}>
        <DiceMesh value={dice2} rolling={rolling} delay={0.2} />
      </group>
    </>
  );
};

const BET_AMOUNTS = [10, 20, 50, 100, 200, 500];

export const DiceGame: React.FC = () => {
  const { firebaseUser, wallet } = useAuth();
  const [prediction, setPrediction] = useState<'ODD' | 'EVEN' | null>(null);
  const [betAmount, setBetAmount] = useState(10);
  const [rolling, setRolling] = useState(false);
  const [dice1, setDice1] = useState(1);
  const [dice2, setDice2] = useState(1);
  const [result, setResult] = useState<{ won: boolean; sum: number; payout: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const isProcessing = useRef(false);

  const usableBalance = wallet ? calculateUsableBalance(wallet) : 0;

  const rollDice = async () => {
    if (!firebaseUser || !prediction || isProcessing.current) return;
    if (betAmount > usableBalance) { toast.error('Insufficient balance'); return; }
    if (loading) return;

    isProcessing.current = true;
    setLoading(true);
    setResult(null);
    setRolling(true);

    // Show random dice during rolling
    const rollInterval = setInterval(() => {
      setDice1(Math.floor(Math.random() * 6) + 1);
      setDice2(Math.floor(Math.random() * 6) + 1);
    }, 100);

    try {
      const gameResult = await playDiceGame(firebaseUser.uid, betAmount, prediction);

      setTimeout(() => {
        clearInterval(rollInterval);
        setRolling(false);
        setDice1(gameResult.dice1);
        setDice2(gameResult.dice2);
        setResult({ won: gameResult.won, sum: gameResult.sum, payout: gameResult.payout });

        if (gameResult.won) {
          toast.success(`🎲 You won! Dice sum: ${gameResult.sum} (${gameResult.sum % 2 === 0 ? 'EVEN' : 'ODD'})`);
        } else {
          toast.error(`😔 You lost. Dice sum: ${gameResult.sum} (${gameResult.sum % 2 === 0 ? 'EVEN' : 'ODD'})`);
        }
        setLoading(false);
        isProcessing.current = false;
      }, 2500);
    } catch (err: any) {
      clearInterval(rollInterval);
      setRolling(false);
      toast.error(err.message || 'Failed to roll dice');
      setLoading(false);
      isProcessing.current = false;
    }
  };

  return (
    <div className="max-w-lg mx-auto space-y-5">
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="text-center">
        <h2 className="text-2xl font-bold text-white">🎲 Dice Game</h2>
        <p className="text-gray-400 text-sm">Roll 2 dice — predict Odd or Even sum</p>
      </motion.div>

      {/* 3D Dice Canvas */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="bg-gradient-to-br from-indigo-900/40 to-purple-900/40 border border-indigo-500/20 rounded-2xl overflow-hidden"
        style={{ height: 240 }}
      >
        <Canvas camera={{ position: [0, 0, 6], fov: 50 }}>
          <Suspense fallback={null}>
            <DiceScene dice1={dice1} dice2={dice2} rolling={rolling} />
          </Suspense>
        </Canvas>
      </motion.div>

      {/* Sum display */}
      <AnimatePresence>
        {result && (
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            className={`rounded-2xl p-5 text-center border ${
              result.won
                ? 'bg-green-500/10 border-green-500/30'
                : 'bg-red-500/10 border-red-500/30'
            }`}
          >
            <div className="flex items-center justify-center gap-3 mb-2">
              {result.won ? (
                <Trophy className="w-8 h-8 text-yellow-400" />
              ) : (
                <TrendingDown className="w-8 h-8 text-red-400" />
              )}
              <span className="text-3xl font-bold text-white">
                {dice1} + {dice2} = {result.sum}
              </span>
            </div>
            <p className={`text-lg font-bold ${result.sum % 2 === 0 ? 'text-blue-400' : 'text-orange-400'}`}>
              {result.sum % 2 === 0 ? 'EVEN' : 'ODD'}
            </p>
            {result.won ? (
              <p className="text-green-400 font-bold text-xl mt-1">
                🎉 You Won {formatCurrency(result.payout)}!
              </p>
            ) : (
              <p className="text-red-400 text-lg mt-1">Better luck next time!</p>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Dice values display when not rolling */}
      {!rolling && !result && (
        <div className="flex items-center justify-center gap-6">
          <div className="w-16 h-16 bg-indigo-900/60 border border-indigo-500/30 rounded-xl flex items-center justify-center text-3xl font-bold text-yellow-400">
            {dice1}
          </div>
          <span className="text-gray-400 text-xl">+</span>
          <div className="w-16 h-16 bg-indigo-900/60 border border-indigo-500/30 rounded-xl flex items-center justify-center text-3xl font-bold text-yellow-400">
            {dice2}
          </div>
          <span className="text-gray-400 text-xl">= {dice1 + dice2}</span>
        </div>
      )}

      {/* Prediction Selection */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
        <p className="text-sm font-medium text-gray-300 mb-3">Your Prediction</p>
        <div className="grid grid-cols-2 gap-3 mb-4">
          {(['ODD', 'EVEN'] as const).map(opt => (
            <motion.button
              key={opt}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => setPrediction(opt)}
              className={`py-4 rounded-xl border-2 font-bold text-lg transition-all ${
                prediction === opt
                  ? opt === 'ODD'
                    ? 'bg-orange-500/30 border-orange-400 text-orange-300'
                    : 'bg-blue-500/30 border-blue-400 text-blue-300'
                  : 'bg-white/5 border-white/10 text-gray-300 hover:bg-white/10'
              }`}
            >
              {opt === 'ODD' ? '🎯 ODD' : '🎯 EVEN'}
              <p className="text-xs text-gray-400 font-normal mt-1">2× Payout</p>
            </motion.button>
          ))}
        </div>

        {/* Bet Amount */}
        <p className="text-sm font-medium text-gray-300 mb-2">Bet Amount</p>
        <div className="grid grid-cols-3 gap-2 mb-3">
          {BET_AMOUNTS.map(amt => (
            <motion.button
              key={amt}
              whileTap={{ scale: 0.95 }}
              onClick={() => setBetAmount(amt)}
              disabled={amt > usableBalance}
              className={`py-2 rounded-xl text-sm font-semibold border transition-all ${
                betAmount === amt
                  ? 'bg-yellow-500/20 border-yellow-500/50 text-yellow-400'
                  : 'bg-white/5 border-white/10 text-gray-300 hover:bg-white/10'
              } disabled:opacity-40`}
            >
              ₹{amt}
            </motion.button>
          ))}
        </div>

        <div className="flex items-center justify-between text-xs text-gray-400 mb-3">
          <span>Usable: {formatCurrency(usableBalance)}</span>
          <span>Win: {formatCurrency(betAmount * 2)}</span>
        </div>

        <motion.button
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.98 }}
          onClick={rollDice}
          disabled={!prediction || loading || rolling}
          className="w-full bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-400 hover:to-purple-400 text-white font-bold py-4 rounded-xl disabled:opacity-50 flex items-center justify-center gap-2 text-lg"
        >
          {loading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Rolling...
            </>
          ) : (
            '🎲 Roll Dice'
          )}
        </motion.button>
      </div>

      {/* Rules */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
        <h3 className="text-sm font-bold text-white mb-2">How to Play</h3>
        <ul className="text-xs text-gray-400 space-y-1">
          <li>• Two dice are rolled simultaneously</li>
          <li>• Predict if the sum will be ODD or EVEN</li>
          <li>• Correct prediction = 2× your bet amount</li>
          <li>• Min bet: ₹10 | Deposit balance not usable in games</li>
        </ul>
      </div>
    </div>
  );
};
