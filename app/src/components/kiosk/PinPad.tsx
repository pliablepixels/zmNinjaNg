/**
 * PIN Pad Component
 *
 * A numeric keypad dialog for setting and entering a 4-digit kiosk PIN.
 * Three modes: 'set' (first-time), 'confirm' (verify set PIN), 'unlock' (enter to unlock).
 */

import { useState, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../ui/button';
import { Delete } from 'lucide-react';

export type PinPadMode = 'set' | 'confirm' | 'unlock';

interface PinPadProps {
  mode: PinPadMode;
  onSubmit: (pin: string) => void;
  onCancel: () => void;
  error?: string | null;
  cooldownSeconds?: number;
}

const PIN_LENGTH = 4;

export function PinPad({ mode, onSubmit, onCancel, error, cooldownSeconds }: PinPadProps) {
  const { t } = useTranslation();
  const [pin, setPin] = useState('');

  // Reset pin when mode or error changes
  useEffect(() => {
    setPin('');
  }, [mode, error]);

  const title =
    mode === 'set'
      ? t('kiosk.set_pin_title')
      : mode === 'confirm'
        ? t('kiosk.confirm_pin_title')
        : t('kiosk.enter_pin_title');

  const handleDigit = useCallback((digit: string) => {
    setPin((prev) => {
      if (prev.length >= PIN_LENGTH) return prev;
      const next = prev + digit;
      if (next.length === PIN_LENGTH) {
        // Auto-submit when 4 digits entered
        setTimeout(() => onSubmit(next), 100);
      }
      return next;
    });
  }, [onSubmit]);

  const handleDelete = useCallback(() => {
    setPin((prev) => prev.slice(0, -1));
  }, []);

  const isCooling = cooldownSeconds != null && cooldownSeconds > 0;

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/70 backdrop-blur-sm"
      data-testid="kiosk-pin-pad"
    >
      <div className="bg-card rounded-2xl p-6 w-[280px] shadow-2xl">
        <h2 className="text-base font-semibold text-center mb-1">{title}</h2>

        {/* PIN dots */}
        <div className="flex justify-center gap-3 my-4" data-testid="kiosk-pin-input">
          {Array.from({ length: PIN_LENGTH }).map((_, i) => (
            <div
              key={i}
              className={`w-3.5 h-3.5 rounded-full border-2 transition-colors ${
                i < pin.length
                  ? 'bg-primary border-primary'
                  : 'border-muted-foreground/40'
              }`}
            />
          ))}
        </div>

        {/* Error message */}
        {error && (
          <p className="text-destructive text-xs text-center mb-2">{error}</p>
        )}

        {/* Cooldown message */}
        {isCooling && (
          <p className="text-destructive text-xs text-center mb-2">
            {t('kiosk.pin_cooldown', { seconds: cooldownSeconds })}
          </p>
        )}

        {/* Number pad */}
        <div className="grid grid-cols-3 gap-2">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
            <Button
              key={digit}
              variant="outline"
              className="h-12 text-lg font-medium"
              onClick={() => handleDigit(digit)}
              disabled={isCooling}
              data-testid={`kiosk-pin-digit-${digit}`}
            >
              {digit}
            </Button>
          ))}
          <Button
            variant="ghost"
            className="h-12 text-sm"
            onClick={onCancel}
            data-testid="kiosk-pin-cancel"
          >
            {t('common.cancel')}
          </Button>
          <Button
            variant="outline"
            className="h-12 text-lg font-medium"
            onClick={() => handleDigit('0')}
            disabled={isCooling}
            data-testid="kiosk-pin-digit-0"
          >
            0
          </Button>
          <Button
            variant="ghost"
            className="h-12"
            onClick={handleDelete}
            disabled={isCooling}
            data-testid="kiosk-pin-delete"
          >
            <Delete className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
