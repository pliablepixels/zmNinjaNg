import { describe, it, expect, beforeEach } from 'vitest';
import { useKioskStore } from '../kioskStore';

describe('kioskStore', () => {
  beforeEach(() => {
    useKioskStore.setState({
      isLocked: false,
      previousInsomniaState: false,
      pinAttempts: 0,
      cooldownUntil: null,
    });
  });

  describe('lock', () => {
    it('sets isLocked to true and stores previous insomnia state', () => {
      useKioskStore.getState().lock(true);
      const state = useKioskStore.getState();
      expect(state.isLocked).toBe(true);
      expect(state.previousInsomniaState).toBe(true);
    });

    it('stores insomnia=false when insomnia was off', () => {
      useKioskStore.getState().lock(false);
      expect(useKioskStore.getState().previousInsomniaState).toBe(false);
    });
  });

  describe('unlock', () => {
    it('sets isLocked to false and resets pin attempts', () => {
      useKioskStore.getState().lock(true);
      useKioskStore.getState().unlock();
      const state = useKioskStore.getState();
      expect(state.isLocked).toBe(false);
      expect(state.pinAttempts).toBe(0);
      expect(state.cooldownUntil).toBeNull();
    });
  });

  describe('rate limiting', () => {
    it('increments pin attempts on failed attempt', () => {
      useKioskStore.getState().recordFailedAttempt();
      expect(useKioskStore.getState().pinAttempts).toBe(1);
    });

    it('sets cooldown after 5 failed attempts', () => {
      const store = useKioskStore.getState();
      for (let i = 0; i < 5; i++) {
        store.recordFailedAttempt();
      }
      const state = useKioskStore.getState();
      expect(state.pinAttempts).toBe(5);
      expect(state.cooldownUntil).not.toBeNull();
      expect(state.cooldownUntil!).toBeGreaterThan(Date.now());
      expect(state.cooldownUntil!).toBeLessThanOrEqual(Date.now() + 31000);
    });

    it('does not set cooldown before 5 attempts', () => {
      const store = useKioskStore.getState();
      for (let i = 0; i < 4; i++) {
        store.recordFailedAttempt();
      }
      expect(useKioskStore.getState().cooldownUntil).toBeNull();
    });

    it('isCoolingDown returns true during cooldown', () => {
      useKioskStore.setState({ cooldownUntil: Date.now() + 10000 });
      expect(useKioskStore.getState().isCoolingDown()).toBe(true);
    });

    it('isCoolingDown returns false after cooldown expires', () => {
      useKioskStore.setState({ cooldownUntil: Date.now() - 1000 });
      expect(useKioskStore.getState().isCoolingDown()).toBe(false);
    });

    it('resets attempt counter after cooldown expires', () => {
      // Simulate 5 failed attempts triggering cooldown
      const store = useKioskStore.getState();
      for (let i = 0; i < 5; i++) {
        store.recordFailedAttempt();
      }
      expect(useKioskStore.getState().pinAttempts).toBe(5);

      // Simulate cooldown expiring
      useKioskStore.setState({ cooldownUntil: Date.now() - 1000 });

      // Next attempt should reset counter to 1, not 6
      useKioskStore.getState().recordFailedAttempt();
      expect(useKioskStore.getState().pinAttempts).toBe(1);
      expect(useKioskStore.getState().cooldownUntil).toBeNull();
    });
  });
});
