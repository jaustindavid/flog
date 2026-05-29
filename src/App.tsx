// flog — Copyright © 2026 Austin David — PolyForm Noncommercial 1.0.0

// App — top-level state-machine switch. The signed-in branch mounts
// the Header + routed surface. M4 restructured: `/` is the log form,
// `/cars` is the car list, `/cars/:carId` is the per-car detail.
// Loading / signed-out / rejected continue to render as full-screen
// non-routed states (dispatch M4 §7.1).

import { Navigate, Route, Routes } from 'react-router';
import { useAuth } from './auth/useAuth';
import { LoadingScreen } from './screens/LoadingScreen';
import { SignedOutScreen } from './screens/SignedOutScreen';
import { RejectedScreen } from './screens/RejectedScreen';
import { CarListScreen } from './screens/CarListScreen';
import { CarDetailScreen } from './screens/CarDetailScreen';
import { LogFillupScreen } from './screens/LogFillupScreen';
import { Header } from './components/Header';

function App() {
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
