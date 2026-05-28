import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Mail, ArrowLeft, CheckCircle } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';

export const ForgotPasswordPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const { resetPassword } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) { setError('Please enter your email'); return; }
    setLoading(true);
    setError('');
    try {
      await resetPassword(email);
      setSent(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen animated-bg flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="glass rounded-3xl p-8 border border-white/10">
          <div className="text-center mb-8">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-500 to-yellow-400 flex items-center justify-center text-3xl font-bold shadow-[0_0_25px_rgba(245,158,11,0.4)] mx-auto mb-4">
              ♠
            </div>
            {!sent ? (
              <>
                <h1 className="text-xl font-semibold text-white">Forgot Password?</h1>
                <p className="text-gray-400 text-sm mt-1">Enter your email to receive a reset link</p>
              </>
            ) : (
              <>
                <CheckCircle className="w-12 h-12 text-emerald-400 mx-auto mb-3" />
                <h1 className="text-xl font-semibold text-white">Check Your Email</h1>
                <p className="text-gray-400 text-sm mt-1">
                  We've sent a password reset link to <span className="text-amber-400">{email}</span>
                </p>
              </>
            )}
          </div>

          {!sent ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                label="Email Address"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                icon={<Mail className="w-4 h-4" />}
                error={error}
              />
              <Button type="submit" fullWidth size="lg" loading={loading}>
                Send Reset Link
              </Button>
            </form>
          ) : (
            <div className="space-y-3">
              <Button variant="ghost" fullWidth size="lg" onClick={() => setSent(false)}>
                Send Again
              </Button>
            </div>
          )}

          <div className="text-center mt-6">
            <Link to="/login" className="inline-flex items-center gap-2 text-gray-400 hover:text-white text-sm transition-colors">
              <ArrowLeft className="w-4 h-4" />
              Back to Login
            </Link>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default ForgotPasswordPage;
