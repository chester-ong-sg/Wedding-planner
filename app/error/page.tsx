'use client';

import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Suspense } from 'react';

function ErrorContent() {
  const searchParams = useSearchParams();
  const message = searchParams.get('message');

  const getErrorMessage = () => {
    switch (message) {
      case 'missing_env_vars':
        return 'Missing Supabase environment variables. Please check your configuration.';
      case 'auth_error':
        return 'Authentication error. Please try signing in again.';
      default:
        return 'An error occurred. Please try again later.';
    }
  };

  const getActionButton = () => {
    switch (message) {
      case 'auth_error':
        return (
          <Button asChild>
            <Link href="/Wedding-planner/login">Return to Login</Link>
          </Button>
        );
      default:
        return (
          <Button asChild>
            <Link href="/Wedding-planner">Return Home</Link>
          </Button>
        );
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4">
      <h1 className="text-4xl font-bold mb-4">Error</h1>
      <p className="text-lg text-center mb-8">{getErrorMessage()}</p>
      {getActionButton()}
    </div>
  );
}

export default function ErrorPage() {
  return (
    <Suspense fallback={
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <h1 className="text-4xl font-bold mb-4">Loading...</h1>
      </div>
    }>
      <ErrorContent />
    </Suspense>
  );
} 