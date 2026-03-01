import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { ClerkProvider } from '@clerk/clerk-react'

const publishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string | undefined

if (!publishableKey) {
  throw new Error('Missing VITE_CLERK_PUBLISHABLE_KEY')
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ClerkProvider publishableKey={publishableKey}>
      <App />
    </ClerkProvider>
  </StrictMode>,
)




// That 401 is coming from Clerk JWT validation failing on the nbf (not-before) claim due to clock skew:

// Your response header shows: token-not-active-yet (nbf) and the token’s nbf is ~70s in the future.
// Fix (code): I updated Clerk’s Express middleware to allow a larger time skew:

// index.ts (line 886) now uses clerkMiddleware({ clockSkewInMs: 2 * 60 * 1000 })
// Rebuild already passes (npm -C backend run build).

// Also do this (recommended):

// Sync your Windows clock (Settings → Time & language → Date & time → “Set time automatically” ON, then “Sync now”), then restart backend + frontend. This prevents future nbf issues.






