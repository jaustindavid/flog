import { useAuth } from '../auth/useAuth';

interface RejectedScreenProps {
  email: string | null | undefined;
}

export function RejectedScreen({ email }: RejectedScreenProps) {
  const { signOut } = useAuth();

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8 gap-6 max-w-md mx-auto text-center">
      <h1 className="text-2xl font-bold">flog</h1>
      <p className="text-gray-800">
        <span className="font-semibold">{email ?? 'This account'}</span>{' '}
        isn&apos;t authorized to use flog yet.
      </p>
      <p className="text-gray-600">
        Ask whoever invited you to share a car with your email, then sign
        in again.
      </p>
      <button
        type="button"
        onClick={() => {
          void signOut();
        }}
        className="bg-blue-600 text-white px-6 py-3 rounded-md text-base font-medium min-h-[44px] min-w-[44px] hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
      >
        Sign out / Try a different account
      </button>
    </div>
  );
}
