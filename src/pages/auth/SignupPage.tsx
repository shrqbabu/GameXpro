import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Mail, Lock, User, ArrowRight, Gift, AlertCircle } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import toast from 'react-hot-toast';

export const SignupPage: React.FC = () => {
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
    referralCode: '',
    agreeTerms: false,
  });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const { signup } = useAuth();
  const navigate = useNavigate();

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.username || formData.username.length < 3) {
      newErrors.username = 'Username must be at least 3 characters';
    }
    if (!/^[a-zA-Z0-9_]+$/.test(formData.username)) {
      newErrors.username = 'Username can only contain letters, numbers and underscore';
    }
    if (!formData.email) newErrors.email = 'Email is required';
    if (!/\S+@\S+\.\S+/.test(formData.email)) newErrors.email = 'Invalid email address';
    if (!formData.password || formData.password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }
    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }
    if (!formData.agreeTerms) newErrors.terms = 'You must agree to the terms';
    return newErrors;
  };

  const handleChange = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({ ...prev, [field]: e.target.value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: '' }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors = validate();
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setLoading(true);
    try {
      await signup(formData.email, formData.username, formData.password);
      toast.success('🎉 Welcome to RoyalFlush! ₹100 bonus added!', { duration: 5000 });
      navigate('/dashboard');
    } catch (err) {
      setErrors({ general: (err as Error).message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen animated-bg flex items-center justify-center p-4">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/3 right-1/4 w-96 h-96 bg-purple-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/3 left-1/4 w-80 h-80 bg-amber-500/5 rounded-full blur-3xl" />
      </div>

      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md relative"
      >
        <div className="glass rounded-3xl p-8 border border-white/10 shadow-2xl">
          {/* Logo */}
          <div className="text-center mb-6">
            <Link to="/" className="inline-flex flex-col items-center gap-2">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-500 to-yellow-400 flex items-center justify-center text-2xl font-bold shadow-[0_0_25px_rgba(245,158,11,0.4)]">
                ♠
              </div>
              <span className="text-xl font-display font-bold text-gradient-gold">RoyalFlush</span>
            </Link>
            <h1 className="text-xl font-semibold text-white mt-3">Create Account</h1>
          </div>

          {/* Welcome Bonus Banner */}
          <div className="mb-6 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
            <div className="flex items-center gap-2">
              <Gift className="w-4 h-4 text-emerald-400 flex-shrink-0" />
              <div>
                <p className="text-emerald-400 text-xs font-semibold">🎁 Welcome Bonus!</p>
                <p className="text-gray-400 text-xs">Get ₹100 bonus + 10,000 demo chips on signup</p>
              </div>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Username"
              type="text"
              placeholder="AceKing777"
              value={formData.username}
              onChange={handleChange('username')}
              icon={<User className="w-4 h-4" />}
              error={errors.username}
              hint="Letters, numbers, underscore only"
              autoComplete="username"
            />
            <Input
              label="Email Address"
              type="email"
              placeholder="you@example.com"
              value={formData.email}
              onChange={handleChange('email')}
              icon={<Mail className="w-4 h-4" />}
              error={errors.email}
              autoComplete="email"
            />
            <Input
              label="Password"
              type="password"
              placeholder="Min. 6 characters"
              value={formData.password}
              onChange={handleChange('password')}
              icon={<Lock className="w-4 h-4" />}
              error={errors.password}
              autoComplete="new-password"
            />
            <Input
              label="Confirm Password"
              type="password"
              placeholder="Repeat your password"
              value={formData.confirmPassword}
              onChange={handleChange('confirmPassword')}
              icon={<Lock className="w-4 h-4" />}
              error={errors.confirmPassword}
              autoComplete="new-password"
            />
            <Input
              label="Referral Code (Optional)"
              type="text"
              placeholder="Enter referral code"
              value={formData.referralCode}
              onChange={handleChange('referralCode')}
              icon={<Gift className="w-4 h-4" />}
              hint="Get extra ₹50 bonus with a valid referral code"
            />

            {/* Terms */}
            <div className="space-y-2">
              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.agreeTerms}
                  onChange={(e) => setFormData((prev) => ({ ...prev, agreeTerms: e.target.checked }))}
                  className="mt-0.5 rounded"
                />
                <span className="text-gray-400 text-xs leading-relaxed">
                  I agree to the{' '}
                  <span className="text-amber-400 hover:text-amber-300 cursor-pointer">Terms of Service</span>
                  {' '}and{' '}
                  <span className="text-amber-400 hover:text-amber-300 cursor-pointer">Privacy Policy</span>.
                  I confirm I am 18+ years old.
                </span>
              </label>
              {errors.terms && <p className="text-red-400 text-xs">{errors.terms}</p>}
            </div>

            {errors.general && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm"
              >
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {errors.general}
              </motion.div>
            )}

            <Button
              type="submit"
              fullWidth
              size="lg"
              loading={loading}
              icon={<ArrowRight className="w-4 h-4" />}
              iconPosition="right"
            >
              Create Free Account
            </Button>
          </form>

          {/* Login link */}
          <p className="text-center text-gray-400 text-sm mt-6">
            Already have an account?{' '}
            <Link to="/login" className="text-amber-400 hover:text-amber-300 font-medium transition-colors">
              Sign in
            </Link>
          </p>
        </div>

        <div className="text-center mt-4">
          <Link to="/" className="text-gray-500 hover:text-gray-400 text-sm transition-colors">
            ← Back to Home
          </Link>
        </div>
      </motion.div>
    </div>
  );
};

export default SignupPage;
