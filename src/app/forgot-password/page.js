'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useAuth } from '@/contexts/AuthContext';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { Loader2, Zap, ArrowLeft, MailCheck } from 'lucide-react';

export default function ForgotPasswordPage() {
  const { resetPassword } = useAuth();
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const { register, handleSubmit, formState: { errors } } = useForm();

  const onSubmit = async ({ email }) => {
    setLoading(true);
    const { error } = await resetPassword(email);
    if (error) toast.error(error.message);
    else setSent(true);
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-950 p-8">
      <div className="w-full max-w-md">
        <div className="flex items-center gap-3 mb-10 justify-center">
          <div className="w-10 h-10 bg-brand-600 rounded-xl flex items-center justify-center">
            <Zap className="w-5 h-5 text-white" />
          </div>
          <span className="font-display font-bold text-white text-xl">Bharath Forklift</span>
        </div>

        {sent ? (
          <div className="text-center">
            <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <MailCheck className="w-8 h-8 text-green-400" />
            </div>
            <h2 className="font-display font-bold text-2xl text-white mb-2">Check your email</h2>
            <p className="text-surface-400 mb-8">We sent a password reset link to your email address.</p>
            <Link href="/login" className="btn-primary mx-auto">
              <ArrowLeft className="w-4 h-4" /> Back to login
            </Link>
          </div>
        ) : (
          <>
            <h2 className="font-display font-bold text-3xl text-white mb-2">Reset password</h2>
            <p className="text-surface-400 mb-8">Enter your email to receive a reset link.</p>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-surface-300 mb-1.5">Email address</label>
                <input
                  type="email"
                  className="w-full px-4 py-3 rounded-xl bg-surface-800 border border-surface-700
                             text-white placeholder:text-surface-500 focus:outline-none focus:border-brand-500
                             focus:ring-2 focus:ring-brand-500/20 transition-all"
                  placeholder="you@bharathforklift.com"
                  {...register('email', { required: 'Email is required' })}
                />
                {errors.email && <p className="text-red-400 text-xs mt-1">{errors.email.message}</p>}
              </div>

              <button type="submit" disabled={loading}
                className="w-full py-3 bg-brand-600 hover:bg-brand-500 text-white font-semibold
                           rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-60">
                {loading ? <><Loader2 className="w-5 h-5 animate-spin" /> Sending...</> : 'Send reset link'}
              </button>

              <Link href="/login"
                className="flex items-center justify-center gap-2 text-surface-400 hover:text-surface-200 transition-colors text-sm">
                <ArrowLeft className="w-4 h-4" /> Back to login
              </Link>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
