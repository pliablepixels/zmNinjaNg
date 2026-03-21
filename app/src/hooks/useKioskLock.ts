/**
 * Kiosk Lock Hook
 *
 * Shared logic for activating kiosk mode, including the first-time PIN set flow.
 * Used by both the sidebar lock icon and the fullscreen montage lock icon.
 */

import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useKioskStore } from '../stores/kioskStore';
import { useSettingsStore } from '../stores/settings';
import { useProfileStore } from '../stores/profile';
import { hasPinStored, storePin } from '../lib/kioskPin';
import { useToast } from './use-toast';
import { log, LogLevel } from '../lib/logger';
import type { PinPadMode } from '../components/kiosk/PinPad';

interface UseKioskLockOptions {
  onLocked?: () => void;
}

export function useKioskLock(options?: UseKioskLockOptions) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { isLocked, lock: kioskLock } = useKioskStore();
  const currentProfileId = useProfileStore((s) => s.currentProfileId);
  const { getProfileSettings, updateProfileSettings } = useSettingsStore();

  const [showSetPin, setShowSetPin] = useState(false);
  const [setPinMode, setSetPinMode] = useState<PinPadMode>('set');
  const [pendingPin, setPendingPin] = useState<string | null>(null);
  const [pinError, setPinError] = useState<string | null>(null);

  const activateKioskMode = useCallback(() => {
    if (!currentProfileId) return;
    const settings = getProfileSettings(currentProfileId);
    kioskLock(settings.insomnia);

    // Enable insomnia if off
    if (!settings.insomnia) {
      updateProfileSettings(currentProfileId, { insomnia: true });
    }

    options?.onLocked?.();
    toast({ description: t('kiosk.locked_toast') });
    log.kiosk('Kiosk mode activated', LogLevel.INFO);
  }, [currentProfileId, getProfileSettings, kioskLock, updateProfileSettings, options, toast, t]);

  const handleLockToggle = useCallback(async () => {
    if (isLocked) return;

    const hasPin = await hasPinStored();
    if (!hasPin) {
      setSetPinMode('set');
      setPinError(null);
      setShowSetPin(true);
    } else {
      activateKioskMode();
    }
  }, [isLocked, activateKioskMode]);

  const handleSetPinSubmit = useCallback(async (pin: string) => {
    if (setPinMode === 'set') {
      setPendingPin(pin);
      setSetPinMode('confirm');
      setPinError(null);
    } else if (setPinMode === 'confirm') {
      if (pin === pendingPin) {
        try {
          await storePin(pin);
          setShowSetPin(false);
          setPendingPin(null);
          activateKioskMode();
        } catch {
          log.kiosk('Failed to store PIN', LogLevel.ERROR);
          setPinError(t('common.unknown_error'));
        }
      } else {
        setPinError(t('kiosk.pin_mismatch'));
        setSetPinMode('set');
        setPendingPin(null);
      }
    }
  }, [setPinMode, pendingPin, activateKioskMode, t]);

  const handleSetPinCancel = useCallback(() => {
    setShowSetPin(false);
    setPendingPin(null);
    setPinError(null);
  }, []);

  return {
    isLocked,
    showSetPin,
    setPinMode,
    pinError,
    handleLockToggle,
    handleSetPinSubmit,
    handleSetPinCancel,
  };
}
