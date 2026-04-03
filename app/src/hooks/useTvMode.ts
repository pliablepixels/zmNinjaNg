/**
 * Hook that returns whether TV mode is active.
 * TV mode is either auto-detected or manually toggled in settings.
 */

import { useCurrentProfile } from './useCurrentProfile';

export function useTvMode() {
  const { settings } = useCurrentProfile();
  return { isTvMode: settings.tvMode };
}
