import Link from 'next/link';
import { ShieldOff } from 'lucide-react';

export default function UnauthorizedPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-950">
      <div className="text-center">
        <div className="w-20 h-20 bg-red-900/30 rounded-2xl flex items-center justify-center mx-auto mb-6">
          <ShieldOff className="w-10 h-10 text-red-400" />
        </div>
        <h1 className="font-display font-bold text-3xl text-white mb-2">Access Denied</h1>
        <p className="text-surface-400 mb-8">You don't have permission to view this page.</p>
        <Link href="/dashboard" className="btn-primary">Back to Dashboard</Link>
      </div>
    </div>
  );
}
