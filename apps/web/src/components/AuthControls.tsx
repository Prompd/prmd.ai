import { SignedIn, SignedOut, SignInButton, UserButton } from '@clerk/clerk-react';
import { isAuthEnabled } from '../auth';

/**
 * Header auth controls. Renders nothing when Clerk isn't configured so the
 * dev experience stays clean without keys. When configured, shows the Clerk
 * sign-in button (modal) for signed-out users and the user avatar menu for
 * signed-in users.
 */
export function AuthControls(): JSX.Element | null {
  if (!isAuthEnabled()) return null;
  return (
    <>
      <SignedOut>
        <SignInButton mode="modal">
          <button type="button" className="btn">
            Sign in
          </button>
        </SignInButton>
      </SignedOut>
      <SignedIn>
        <UserButton afterSignOutUrl="/" />
      </SignedIn>
    </>
  );
}
