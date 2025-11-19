"use client";

import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle } from 'lucide-react';
import { Suspense } from 'react';

export default function AuthErrorPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-slate-500">Loading...</div>}>
      <AuthErrorContent />
    </Suspense>
  );
}

function AuthErrorContent() {
  const searchParams = useSearchParams();
  const error = searchParams.get('error');

  const errorMessages = {
    AccessDenied: {
      title: 'Access Denied',
      description: 'You do not have permission to sign in. Please contact the administrator.',
      details: 'This could be due to: Your email not being authorized, Database connection issues, or OAuth configuration problems.'
    },
    Configuration: {
      title: 'Configuration Error',
      description: 'There is a problem with the server configuration.',
      details: 'Please contact the system administrator.'
    },
    Verification: {
      title: 'Verification Error',
      description: 'The sign in link is no longer valid.',
      details: 'It may have already been used or expired.'
    },
    Default: {
      title: 'Authentication Error',
      description: 'An error occurred during authentication.',
      details: 'Please try again. If the problem persists, contact support.'
    }
  };

  const errorInfo = errorMessages[error] || errorMessages.Default;

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <Card className="max-w-md w-full">
        <CardHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-red-100 rounded-full">
              <AlertCircle className="h-6 w-6 text-red-600" />
            </div>
            <div>
              <CardTitle className="text-red-600">{errorInfo.title}</CardTitle>
              <CardDescription>{errorInfo.description}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-slate-50 p-4 rounded-lg">
            <p className="text-sm text-slate-600">{errorInfo.details}</p>
          </div>
          
          {error === 'AccessDenied' && (
            <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
              <p className="text-sm font-medium text-blue-900 mb-2">Google OAuth Setup Required</p>
              <p className="text-xs text-blue-700 mb-2">
                The redirect URI must be configured in Google Cloud Console:
              </p>
              <code className="text-xs bg-white p-2 rounded block break-all border border-blue-200">
                https://project-versioning.preview.emergentagent.com/api/auth/callback/google
              </code>
              <p className="text-xs text-blue-700 mt-2">
                See GOOGLE_OAUTH_SETUP.md in the project root for detailed instructions.
              </p>
            </div>
          )}
          
          <div className="flex gap-2">
            <Link href="/auth/signin" className="flex-1">
              <Button variant="outline" className="w-full">
                Try Again
              </Button>
            </Link>
            <Link href="/" className="flex-1">
              <Button className="w-full">
                Go Home
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
