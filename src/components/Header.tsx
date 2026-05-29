// Header — persistent across all signed-in routes.
//
// M4 adds the Log / Cars nav between the wordmark and the sign-out
// control. `NavLink` from react-router toggles an `active` class via
// its className-as-function form; the `end` prop on the `/` link
// prevents it from matching `/cars` or `/cars/:carId`.
//
// Active styling: bold + underline. The blue accent stays on the
// sign-out button so the active-route signal doesn't fight with it.

import { NavLink } from 'react-router';
import { useAuth } from '../auth/useAuth';

const NAV_BASE =
  'text-sm min-h-[44px] inline-flex items-center px-1 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded';
const NAV_ACTIVE = 'font-semibold underline text-gray-900';
const NAV_INACTIVE = 'text-gray-600 hover:text-gray-900';

export function Header() {
  const { user, signOut } = useAuth();
  // Logical-OR fallback (not ??): firstSignIn writes '' for
  // displayName when Google profile has none, and an empty string
  // should fall through to email. See M3 dispatch §8 U1.
  const label = user
    ? (user.displayName || user.email || 'Signed in')
    : 'Signed in';

  return (
    <header className="flex items-center justify-between px-6 py-4 border-b border-gray-200 max-w-md mx-auto w-full gap-3">
      <h1 className="text-xl font-bold">flog</h1>
      <nav className="flex items-center gap-4" aria-label="Primary">
        <NavLink
          to="/"
          end
          className={({ isActive }) =>
            `${NAV_BASE} ${isActive ? NAV_ACTIVE : NAV_INACTIVE}`
          }
        >
          Log
        </NavLink>
        <NavLink
          to="/cars"
          className={({ isActive }) =>
            `${NAV_BASE} ${isActive ? NAV_ACTIVE : NAV_INACTIVE}`
          }
        >
          Cars
        </NavLink>
      </nav>
      <div className="flex items-center gap-3 text-sm">
        <span
          className="text-gray-600 truncate max-w-[8rem] hidden sm:inline"
          title={label}
        >
          {label}
        </span>
        <button
          type="button"
          onClick={() => {
            void signOut();
          }}
          className="text-blue-600 underline min-h-[44px] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded"
        >
          Sign out
        </button>
      </div>
    </header>
  );
}
