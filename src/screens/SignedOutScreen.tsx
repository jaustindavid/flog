// flog — Copyright © 2026 Austin David — PolyForm Noncommercial 1.0.0

import { Link } from 'react-router';
import { useAuth } from '../auth/useAuth';

export function SignedOutScreen() {
  const { signIn } = useAuth();

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8 gap-6">
      <h1 className="text-3xl font-bold">flog</h1>
      <button
        type="button"
        onClick={() => {
          void signIn();
        }}
        className="bg-blue-600 text-white px-6 py-3 rounded-md text-base font-medium min-h-[44px] min-w-[44px] hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
      >
        Sign in with Google
      </button>
      <nav className="flex gap-4 text-sm text-gray-500">
        <Link
          to="/tos"
          className="hover:text-gray-700 hover:underline underline-offset-2"
        >
          Terms
        </Link>
        <Link
          to="/privacy"
          className="hover:text-gray-700 hover:underline underline-offset-2"
        >
          Privacy
        </Link>
      </nav>
    </div>
  );
}
