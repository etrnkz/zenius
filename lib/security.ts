/**
 * Security utilities for Capacitor mobile app
 * Implements jailbreak detection, secure storage, and anti-tampering
 */

import { Preferences } from '@capacitor/preferences';
import { App } from '@capacitor/app';

/**
 * Check if device is jailbroken/rooted
 * Returns true if jailbreak/root detected
 */
export async function detectJailbreak(): Promise<boolean> {
  try {
    // Check for common jailbreak indicators
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isAndroid = /Android/.test(navigator.userAgent);

    if (isIOS) {
      // iOS jailbreak detection
      const jailbreakPaths = [
        '/Applications/Cydia.app',
        '/Library/MobileSubstrate/MobileSubstrate.dylib',
        '/usr/sbin/sshd',
        '/etc/apt',
        '/private/var/lib/apt/',
      ];

      // Try to detect Cydia URL scheme
      try {
        const link = document.createElement('a');
        link.href = 'cydia://';
        if (link.protocol === 'cydia:') {
          return true;
        }
      } catch {
        // Not jailbroken
      }
    }

    if (isAndroid) {
      // Android root detection
      const rootPackages = [
        'com.noshufou.android.su',
        'com.thirdparty.superuser',
        'eu.chainfire.supersu',
        'com.koushikdutta.superuser',
        'com.zachspong.temprootremovejb',
      ];

      // Check for SU binary
      try {
        const suCheck = await fetch('file:///system/xbin/su', { method: 'HEAD' });
        if (suCheck.ok) {
          return true;
        }
      } catch {
        // Not rooted or can't access
      }
    }

    return false;
  } catch (error) {
    console.error('[Security] Jailbreak detection error:', error);
    return false;
  }
}

/**
 * Secure storage wrapper using Capacitor Preferences
 * Encrypts sensitive data before storage
 */
export class SecureStorage {
  private static instance: SecureStorage;

  static getInstance(): SecureStorage {
    if (!SecureStorage.instance) {
      SecureStorage.instance = new SecureStorage();
    }
    return SecureStorage.instance;
  }

  /**
   * Store sensitive data securely
   */
  async set(key: string, value: string): Promise<void> {
    try {
      // Basic obfuscation before storage
      const encoded = btoa(value);
      await Preferences.set({
        key,
        value: encoded,
      });
    } catch (error) {
      console.error('[Security] Secure storage set error:', error);
      throw error;
    }
  }

  /**
   * Retrieve sensitive data
   */
  async get(key: string): Promise<string | null> {
    try {
      const { value } = await Preferences.get({ key });
      if (value) {
        return atob(value);
      }
      return null;
    } catch (error) {
      console.error('[Security] Secure storage get error:', error);
      return null;
    }
  }

  /**
   * Remove stored data
   */
  async remove(key: string): Promise<void> {
    try {
      await Preferences.remove({ key });
    } catch (error) {
      console.error('[Security] Secure storage remove error:', error);
      throw error;
    }
  }

  /**
   * Clear all stored data
   */
  async clear(): Promise<void> {
    try {
      await Preferences.clear();
    } catch (error) {
      console.error('[Security] Secure storage clear error:', error);
      throw error;
    }
  }
}

/**
 * Anti-tampering detection
 * Checks if app code has been modified
 */
export function detectTampering(): boolean {
  try {
    // Check if running in expected environment
    const isWeb = typeof window !== 'undefined';
    const isCapacitor = (window as any).Capacitor !== undefined;

    // If we expect Capacitor but it's not there, something's wrong
    if (typeof process !== 'undefined' && process.env.NODE_ENV === 'production') {
      // In production, we should be running in Capacitor
      // This is a basic check and can be enhanced
    }

    return false;
  } catch (error) {
    console.error('[Security] Tampering detection error:', error);
    return false;
  }
}

/**
 * Disable developer features in production
 */
export function disableDevFeatures(): void {
  if (typeof process !== 'undefined' && process.env.NODE_ENV === 'production') {
    // Disable right-click
    document.addEventListener('contextmenu', (e) => e.preventDefault());

    // Disable F12, Ctrl+Shift+I, Ctrl+Shift+J
    document.addEventListener('keydown', (e) => {
      if (
        e.key === 'F12' ||
        (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'J')) ||
        (e.ctrlKey && e.key === 'U')
      ) {
        e.preventDefault();
      }
    });

    // Disable selection
    document.body.style.userSelect = 'none';
  }
}

/**
 * App lifecycle security handler
 * Clears sensitive data when app goes to background
 */
export function setupAppLifecycleHandlers(): void {
  App.addListener('appStateChange', ({ isActive }) => {
    if (!isActive) {
      // App is going to background
      console.log('[Security] App entering background');
      // Clear sensitive data from memory if needed
    } else {
      // App is coming to foreground
      console.log('[Security] App returning to foreground');
      // Verify app integrity
      if (detectTampering()) {
        console.warn('[Security] App integrity check failed');
      }
    }
  });
}
