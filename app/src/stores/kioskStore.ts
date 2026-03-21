/**
 * Kiosk Store
 *
 * Manages kiosk (lock) mode state. Ephemeral — resets to unlocked on app restart.
 * PIN storage is handled separately by lib/kioskPin.ts via secure storage.
 */

import { create } from 'zustand';

const MAX_PIN_ATTEMPTS = 5;
const COOLDOWN_MS = 30_000;

interface KioskState {
  isLocked: boolean;
  previousInsomniaState: boolean;
  pinAttempts: number;
  cooldownUntil: number | null;

  lock: (currentInsomniaState: boolean) => void;
  unlock: () => void;
  recordFailedAttempt: () => void;
  isCoolingDown: () => boolean;
}

export const useKioskStore = create<KioskState>()((set, get) => ({
  isLocked: false,
  previousInsomniaState: false,
  pinAttempts: 0,
  cooldownUntil: null,

  lock: (currentInsomniaState: boolean) => {
    set({
      isLocked: true,
      previousInsomniaState: currentInsomniaState,
      pinAttempts: 0,
      cooldownUntil: null,
    });
  },

  unlock: () => {
    set({
      isLocked: false,
      pinAttempts: 0,
      cooldownUntil: null,
    });
  },

  recordFailedAttempt: () => {
    const { cooldownUntil, pinAttempts } = get();
    // Reset counter if previous cooldown has expired
    const currentAttempts = (cooldownUntil && Date.now() >= cooldownUntil) ? 0 : pinAttempts;
    const attempts = currentAttempts + 1;
    set({
      pinAttempts: attempts,
      cooldownUntil: attempts >= MAX_PIN_ATTEMPTS ? Date.now() + COOLDOWN_MS : null,
    });
  },

  isCoolingDown: () => {
    const { cooldownUntil } = get();
    if (!cooldownUntil) return false;
    return Date.now() < cooldownUntil;
  },
}));
