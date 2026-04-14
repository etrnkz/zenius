'use client';

import { useEffect } from 'react';
import {
  detectJailbreak,
  disableDevFeatures,
  setupAppLifecycleHandlers,
  SecureStorage,
} from '@/lib/security';

/**
 * SecurityProvider component
 * Initializes security features when app loads
 */
export function SecurityProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Initialize security features in production
    if (process.env.NODE_ENV === 'production') {
      // Disable developer features
      disableDevFeatures();

      // Setup app lifecycle handlers
      setupAppLifecycleHandlers();

      // Check for jailbreak/root
      detectJailbreak().then((isJailbroken) => {
        if (isJailbroken) {
          console.warn('[Security] Device appears to be jailbroken/rooted');
          // You can choose to restrict functionality here
          // For now, we just log it
        }
      });

      // Initialize secure storage
      const secureStorage = SecureStorage.getInstance();

      // Clear any cached data on app start
      secureStorage.clear().catch((error) => {
        console.error('[Security] Failed to clear secure storage:', error);
      });
    }
  }, []);

  return <>{children}</>;
}
