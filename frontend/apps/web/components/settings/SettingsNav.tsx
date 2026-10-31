'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { IconAccount, IconDisplay, IconPrivacy, IconProfileEdit, IconSecurity } from '@/components/icons';
import { SETTINGS_SECTIONS, type SettingsSectionSlug } from '@/lib/settings-sections';

const ICONS: Record<SettingsSectionSlug, (p: { size?: number; className?: string }) => ReactNode> = {
  perfil: IconProfileEdit,
  exibicao: IconDisplay,
  privacidade: IconPrivacy,
  seguranca: IconSecurity,
  conta: IconAccount,
};

/** Menu lateral das seções (telas largas). */
export function SettingsSideNav({ current }: { current: string }) {
  return (
    <nav aria-label="Seções das configurações" className="hidden md:block">
      <ul className="sticky top-24 grid gap-1">
        {SETTINGS_SECTIONS.map((s) => {
          const Icon = ICONS[s.slug];
          const active = current === s.href;
          return (
            <li key={s.slug}>
              <Link
                href={s.href}
                aria-current={active ? 'page' : undefined}
                className={`flex min-h-11 items-center gap-2 rounded-md px-3 py-2 font-semibold no-underline hover:bg-sunken ${
                  active ? 'border-l-4 border-fg bg-sunken' : 'border-l-4 border-transparent'
                }`}
              >
                <Icon size={18} />
                {s.title}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Lista das seções em /configuracoes (no celular é o menu; na tela larga, o índice). */
export function SettingsList() {
  return (
    <nav aria-label="Seções das configurações">
      <ul className="grid gap-3 sm:grid-cols-2">
        {SETTINGS_SECTIONS.map((s) => {
          const Icon = ICONS[s.slug];
          return (
            <li key={s.slug}>
              <Link href={s.href} className="os-card flex h-full gap-3 p-4 no-underline hover:bg-sunken">
                <Icon size={22} className="mt-0.5 flex-none" />
                <span className="grid gap-1">
                  <span className="text-lg font-bold underline-offset-4">{s.title}</span>
                  <span className="text-sm text-muted">{s.description}</span>
                  {s.law && <span className="os-law w-fit">{s.law}</span>}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
