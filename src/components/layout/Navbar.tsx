"use client";

import { Menu, Activity } from "lucide-react";

type NavbarProps = {
  title: string;
  onMenuClick: () => void;
};

export function Navbar({ title, onMenuClick }: NavbarProps) {
  return (
    <header className="sticky top-0 z-30 border-b border-slate-100 bg-white">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center space-x-3 md:hidden">
            <button
              type="button"
              onClick={onMenuClick}
              className="-ml-2 rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-700"
              aria-label="เปิดเมนู"
            >
              <Menu className="h-6 w-6" />
            </button>
            <div className="flex items-center space-x-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-mint-brandLight text-mint-brand">
                <Activity className="h-4 w-4" />
              </div>
              <span className="text-sm font-bold tracking-tight text-mint-neutralDark">
                WEALTH
              </span>
            </div>
          </div>

          <div className="hidden items-center space-x-2 text-xs font-medium text-slate-400 md:flex">
            <span className="hover:text-slate-600">Wealth Transfer</span>
            <span>/</span>
            <span className="font-semibold text-mint-brand">{title}</span>
          </div>
        </div>
      </div>
    </header>
  );
}
