import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CreditCard, Smartphone, Building2, CheckCircle,
  AlertCircle, ChevronRight, Wallet, Zap,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Badge } from '../components/ui/Badge';
import { formatCurrency } from '../utils/helpers';
import toast from 'react-hot-toast';

const PRESET_AMOUNTS = [100, 500, 1000, 5000];

const PAYMENT_METHODS = [
  { id: 'upi', label: 'UPI', icon: <Smartphone className="w-5 h-5" />, popular: true, desc: 'GPay, PhonePe, Paytm' },
  { id: 'card', label: 'Card', icon: <CreditCard className="w-5 h-5" />, popular: false, desc: 'Credit / Debit Card' },
  { id: 'netbanking', label: 'Net Banking', icon: <Building2 className="w-5 h-5" />, popular: false, desc: 'All major banks' },
];

const OFFERS = [
  { min: 100, bonus: 10, label: '10% Extra', color: 'emerald' },
  { min: 500, bonus: 15, label: '15% Extra', color: 'amber' },
  { min: 1000, bonus: 20, label: '20% Extra', color: 'purple' },
  { min: 5000, bonus: 30, label: '30% Extra', color: 'blue' },
];

type Step = 'select' | 'payment' | 'processing' | 'success';

export const AddMoneyPage: React.FC = () => {
  const { userProfile, updateWallet } = useAuth();
  const [step, setStep] = useState<Step>('select');
  const [amount, setAmount] = useState('');
  const [selectedMethod, setSelectedMethod] = useState('upi');
  const [upiId, setUpiId] = useState('');
  const [processing, setProcessing] = useState(false);

  if (!userProfile) return null;

  const numAmount = parseFloat(amount) || 0;
  const applicableOffer = OFFERS.filter((o) => numAmount >= o.min).pop();
  const bonusAmount = applicableOffer
    ? Math.round((numAmount * applicableOffer.bonus) / 100)
    : 0;

  const handlePreset = (val: number) => {
    setAmount(val.toString());
  };

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/[^0-9.]/g, '');
    setAmount(val);
  };

  const handleProceed = () => {
    if (numAmount < 100) {
      toast.error('Minimum deposit is ₹100');
      return;
    }
    if (numAmount > 100000) {
      toast.error('Maximum deposit is ₹1,00,000');
      return;
    }
    setStep('payment');
  };

  const handlePay = async () => {
    if (selectedMethod === 'upi' && !upiId && !upiId.includes('@')) {
      toast.error('Please enter a valid UPI ID');
      return;
    }

    setProcessing(true);
    setStep('processing');

    // Simulate payment processing
    await new Promise((resolve) => setTimeout(resolve, 2500));

    // Update wallet (demo)
    const newDeposit = userProfile.wallet.depositBalance + numAmount;
    const newBonus = userProfile.wallet.bonusBalance + bonusAmount;
    const newTotalDeposited = userProfile.wallet.totalDeposited + numAmount;

    await updateWallet({
      depositBalance: newDeposit,
      bonusBalance: newBonus,
      totalDeposited: newTotalDeposited,
    });

    setProcessing(false);
    setStep('success');
    toast.success(`₹${numAmount} added successfully! 🎉`);
  };

  const handleReset = () => {
    setStep('select');
    setAmount('');
    setUpiId('');
  };

  return (
    <div className="max-w-lg mx-auto space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center"
      >
        <div className="inline-flex w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-500 to-yellow-400 items-center justify-center text-3xl mb-4 shadow-[0_0_25px_rgba(245,158,11,0.4)]">
          💳
        </div>
        <h1 className="text-2xl font-display font-bold text-white">Add Money</h1>
        <p className="text-gray-400 text-sm mt-1">
          Current Balance: <span className="text-amber-400 font-mono">{formatCurrency(userProfile.wallet.depositBalance)}</span>
        </p>
      </motion.div>

      <AnimatePresence mode="wait">
        {/* STEP 1: Select Amount */}
        {step === 'select' && (
          <motion.div
            key="select"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="space-y-5"
          >
            {/* Preset amounts */}
            <div className="glass rounded-2xl p-5">
              <h3 className="text-white font-semibold mb-4">Quick Add</h3>
              <div className="grid grid-cols-2 gap-3">
                {PRESET_AMOUNTS.map((preset) => {
                  const offer = OFFERS.find((o) => o.min === preset);
                  return (
                    <button
                      key={preset}
                      onClick={() => handlePreset(preset)}
                      className={`relative p-4 rounded-xl border text-center transition-all duration-200 ${
                        amount === preset.toString()
                          ? 'bg-amber-500/20 border-amber-400/50 shadow-[0_0_15px_rgba(245,158,11,0.2)]'
                          : 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20'
                      }`}
                    >
                      {offer && (
                        <div className="absolute -top-2 -right-2">
                          <Badge variant="green" size="xs">{offer.label}</Badge>
                        </div>
                      )}
                      <p className="text-white font-bold text-lg font-mono">{formatCurrency(preset)}</p>
                      {offer && (
                        <p className="text-emerald-400 text-xs mt-0.5">+₹{Math.round((preset * offer.bonus) / 100)} bonus</p>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Custom amount */}
            <div className="glass rounded-2xl p-5">
              <h3 className="text-white font-semibold mb-4">Custom Amount</h3>
              <Input
                label="Enter Amount (₹)"
                type="text"
                placeholder="Minimum ₹100"
                value={amount}
                onChange={handleAmountChange}
                icon={<Wallet className="w-4 h-4" />}
                hint="Min: ₹100 | Max: ₹1,00,000"
              />

              {numAmount >= 100 && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="mt-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20"
                >
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Deposit Amount:</span>
                    <span className="text-white font-mono">{formatCurrency(numAmount)}</span>
                  </div>
                  {bonusAmount > 0 && (
                    <div className="flex justify-between text-sm mt-1">
                      <span className="text-emerald-400">Bonus ({applicableOffer?.bonus}%):</span>
                      <span className="text-emerald-400 font-mono">+{formatCurrency(bonusAmount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold mt-2 pt-2 border-t border-white/10">
                    <span className="text-white">You'll receive:</span>
                    <span className="text-amber-400 font-mono">{formatCurrency(numAmount + bonusAmount)}</span>
                  </div>
                </motion.div>
              )}
            </div>

            {/* Offers */}
            <div className="glass rounded-2xl p-5">
              <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
                <Zap className="w-4 h-4 text-amber-400" />
                Deposit Offers
              </h3>
              <div className="space-y-2">
                {OFFERS.map((offer) => (
                  <div
                    key={offer.min}
                    className={`flex items-center justify-between p-3 rounded-xl border transition-colors cursor-pointer
                      ${numAmount >= offer.min
                        ? 'bg-amber-500/10 border-amber-500/30'
                        : 'bg-white/3 border-white/5 opacity-50'}
                    `}
                    onClick={() => handlePreset(offer.min)}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-amber-400">🎁</span>
                      <div>
                        <p className="text-white text-sm font-medium">On ₹{offer.min.toLocaleString()}+</p>
                        <p className="text-gray-500 text-xs">Get {offer.bonus}% extra bonus</p>
                      </div>
                    </div>
                    <Badge variant="gold" size="xs">{offer.label}</Badge>
                  </div>
                ))}
              </div>
            </div>

            <Button
              fullWidth
              size="lg"
              onClick={handleProceed}
              disabled={numAmount < 100}
              icon={<ChevronRight className="w-4 h-4" />}
              iconPosition="right"
            >
              Proceed to Pay {numAmount >= 100 ? formatCurrency(numAmount) : ''}
            </Button>
          </motion.div>
        )}

        {/* STEP 2: Payment Method */}
        {step === 'payment' && (
          <motion.div
            key="payment"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-5"
          >
            {/* Amount summary */}
            <div className="glass rounded-2xl p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-sm">Amount to pay</p>
                  <p className="text-2xl font-bold font-mono text-amber-400">{formatCurrency(numAmount)}</p>
                </div>
                {bonusAmount > 0 && (
                  <div className="text-right">
                    <p className="text-gray-400 text-sm">You'll get</p>
                    <p className="text-emerald-400 font-mono font-bold text-lg">
                      +{formatCurrency(bonusAmount)} bonus
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Payment methods */}
            <div className="glass rounded-2xl p-5">
              <h3 className="text-white font-semibold mb-4">Select Payment Method</h3>
              <div className="space-y-3">
                {PAYMENT_METHODS.map((method) => (
                  <button
                    key={method.id}
                    onClick={() => setSelectedMethod(method.id)}
                    className={`w-full flex items-center gap-3 p-4 rounded-xl border text-left transition-all ${
                      selectedMethod === method.id
                        ? 'bg-amber-500/15 border-amber-400/50'
                        : 'bg-white/5 border-white/10 hover:bg-white/8'
                    }`}
                  >
                    <div className={`p-2 rounded-lg ${selectedMethod === method.id ? 'bg-amber-500/20 text-amber-400' : 'bg-white/5 text-gray-400'}`}>
                      {method.icon}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-white font-medium">{method.label}</span>
                        {method.popular && <Badge variant="green" size="xs">Popular</Badge>}
                      </div>
                      <span className="text-gray-500 text-xs">{method.desc}</span>
                    </div>
                    <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 ${
                      selectedMethod === method.id ? 'bg-amber-400 border-amber-400' : 'border-gray-600'
                    }`} />
                  </button>
                ))}
              </div>
            </div>

            {/* UPI ID input */}
            {selectedMethod === 'upi' && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="glass rounded-2xl p-5"
              >
                <Input
                  label="UPI ID"
                  type="text"
                  placeholder="yourname@upi"
                  value={upiId}
                  onChange={(e) => setUpiId(e.target.value)}
                  icon={<Smartphone className="w-4 h-4" />}
                  hint="Enter your UPI ID (e.g., 9876543210@paytm)"
                />
                <div className="mt-3 flex items-center gap-2">
                  {['gpay', 'phonepe', 'paytm', 'bhim'].map((app) => (
                    <button
                      key={app}
                      className="px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-gray-400 text-xs hover:bg-white/10 transition-colors"
                    >
                      {app}
                    </button>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Demo notice */}
            <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
              <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
              <p className="text-amber-400 text-xs">
                <strong>Demo Mode:</strong> No real money will be charged. This simulates a payment flow for demo purposes only.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Button variant="ghost" size="lg" onClick={() => setStep('select')}>
                ← Back
              </Button>
              <Button size="lg" onClick={handlePay} loading={processing}>
                Pay {formatCurrency(numAmount)}
              </Button>
            </div>
          </motion.div>
        )}

        {/* STEP 3: Processing */}
        {step === 'processing' && (
          <motion.div
            key="processing"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="glass rounded-2xl p-12 text-center"
          >
            <div className="relative inline-block mb-6">
              <div className="w-20 h-20 rounded-full bg-amber-500/20 flex items-center justify-center">
                <div className="w-12 h-12 rounded-full border-4 border-amber-400 border-t-transparent animate-spin" />
              </div>
            </div>
            <h3 className="text-xl font-bold text-white mb-2">Processing Payment</h3>
            <p className="text-gray-400 text-sm">Please wait while we process your transaction...</p>
            <div className="mt-6 space-y-2">
              {['Connecting to payment gateway', 'Verifying transaction', 'Crediting your wallet'].map((step, i) => (
                <motion.div
                  key={step}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.8 }}
                  className="flex items-center gap-2 text-sm text-gray-500"
                >
                  <div className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                  {step}
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}

        {/* STEP 4: Success */}
        {step === 'success' && (
          <motion.div
            key="success"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: 'spring', damping: 15 }}
            className="glass rounded-2xl p-10 text-center"
          >
            {/* Confetti animation */}
            <div className="relative inline-block mb-6">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', delay: 0.2 }}
                className="w-20 h-20 rounded-full bg-emerald-500/20 flex items-center justify-center"
              >
                <CheckCircle className="w-10 h-10 text-emerald-400" />
              </motion.div>
              {/* Sparks */}
              {Array.from({ length: 8 }).map((_, i) => (
                <motion.div
                  key={i}
                  className="absolute w-2 h-2 rounded-full bg-amber-400"
                  style={{
                    top: '50%',
                    left: '50%',
                    transform: `rotate(${i * 45}deg) translateY(-30px)`,
                  }}
                  initial={{ scale: 0, opacity: 1 }}
                  animate={{ scale: [0, 1, 0], opacity: [1, 1, 0] }}
                  transition={{ delay: 0.3 + i * 0.05, duration: 0.8 }}
                />
              ))}
            </div>

            <motion.h3
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="text-2xl font-bold text-white mb-2"
            >
              Payment Successful! 🎉
            </motion.h3>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="space-y-3 mt-6 mb-8"
            >
              <div className="flex justify-between p-3 rounded-xl bg-white/5">
                <span className="text-gray-400">Deposited</span>
                <span className="text-white font-mono font-bold">{formatCurrency(numAmount)}</span>
              </div>
              {bonusAmount > 0 && (
                <div className="flex justify-between p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                  <span className="text-emerald-400">Bonus Credited</span>
                  <span className="text-emerald-400 font-mono font-bold">+{formatCurrency(bonusAmount)}</span>
                </div>
              )}
              <div className="flex justify-between p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
                <span className="text-amber-400 font-bold">New Balance</span>
                <span className="text-amber-400 font-mono font-bold">
                  {formatCurrency(userProfile.wallet.depositBalance)}
                </span>
              </div>
            </motion.div>

            <div className="grid grid-cols-2 gap-3">
              <Button variant="ghost" size="md" onClick={handleReset}>
                Add More
              </Button>
              <Button size="md" onClick={() => window.location.href = '/table'}>
                Play Now 🎰
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AddMoneyPage;
