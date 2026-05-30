// flog — Copyright © 2026 Austin David — PolyForm Noncommercial 1.0.0

// App — top-level routing + auth state machine.
//
// `/tos` and `/privacy` are PUBLIC: they render in any auth state,
// so they sit ABOVE the auth gate as their own routes. Google's OAuth
// review and signed-out visitors must be able to load them directly,
// and flog's auth switch (below) otherwise returns SignedOutScreen for
// every URL when signed out — which would hide them.
//
// Everything else falls through to `AuthGate`, the original
// state-machine switch. M4 layout: `/` is the log form, `/cars` the
// car list, `/cars/:carId` the per-car detail. Loading / signed-out /
// rejected render as full-screen non-routed states (dispatch M4 §7.1).

import { Navigate, Route, Routes } from 'react-router';
import { useAuth } from './auth/useAuth';
import { LoadingScreen } from './screens/LoadingScreen';
import { SignedOutScreen } from './screens/SignedOutScreen';
import { RejectedScreen } from './screens/RejectedScreen';
import { CarListScreen } from './screens/CarListScreen';
import { CarDetailScreen } from './screens/CarDetailScreen';
import { LogFillupScreen } from './screens/LogFillupScreen';
import { TermsScreen } from './screens/TermsScreen';
import { PrivacyScreen } from './screens/PrivacyScreen';
import { Header } from './components/Header';

function App() {
  return (
    <Routes>
      <Route path="/tos" element={<TermsScreen />} />
      <Route path="/privacy" element={<PrivacyScreen />} />
      <Route path="*" element={<AuthGate />} />
    </Routes>
  );
}

// The original top-level auth switch. Mounted for every non-legal URL.
function AuthGate() {
  const { status, user } = useAuth();

  switch (status) {
    case 'loading':
      return <LoadingScreen />;
    case 'signed-out':
      return <SignedOutScreen />;
    case 'rejected':
      return <RejectedScreen email={user?.email} />;
    case 'signed-in':
      if (!user) {
        // Should be unreachable given the state machine; render
        // LoadingScreen rather than crash. Type-narrowing benefit
        // alongside.
        return <LoadingScreen />;
      }
      return (
        <>
          <Header />
          <Routes>
            <Route path="/" element={<LogFillupScreen />} />
            <Route path="/cars" element={<CarListScreen />} />
            <Route path="/cars/:carId" element={<CarDetailScreen />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </>
      );
  }
}

export default App;
