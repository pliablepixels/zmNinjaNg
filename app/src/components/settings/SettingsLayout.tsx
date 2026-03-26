/**
 * Settings Layout Components
 *
 * Shared layout primitives used across all settings sections.
 */

import type React from 'react';

export function SectionHeader({ label }: { label: string }) {
  return (
    <h2 className="text-sm font-semibold text-primary uppercase tracking-wide mb-2">
      {label}
    </h2>
  );
}

export function SettingsCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border bg-card divide-y">
      {children}
    </div>
  );
}

export function SettingsRow({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between px-4 py-3 gap-3">
      {children}
    </div>
  );
}

export function RowLabel({ label, desc }: { label: string; desc?: string }) {
  return (
    <div className="min-w-0 flex-1">
      <div className="text-sm font-medium">{label}</div>
      {desc && <div className="text-xs text-muted-foreground">{desc}</div>}
    </div>
  );
}
