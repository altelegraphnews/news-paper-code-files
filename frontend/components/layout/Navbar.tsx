'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Search, Menu } from 'lucide-react';
import { clsx } from 'clsx';
import DarkModeToggle from '@/components/ui/DarkModeToggle';
import SearchOverlay from '@/components/ui/SearchOverlay';
import MobileMenu from './MobileMenu';
import { buildNavLinks } from '@/lib/nav';
import type { Category } from '@/lib/types';

export default function Navbar({ categories = [] }: { categories?: Category[] }) {
  const pathname = usePathname();
  const NAV_LINKS = buildNavLinks(categories);
  const [isScrolled, setIsScrolled] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setIsSearchOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <>
      <header
        className={clsx(
          'navbar sticky top-[44px] left-0 right-0 z-navbar transition-all duration-300 border-b',
          isScrolled
            ? 'navbar-scrolled border-accent/30'
            : 'bg-ink border-white/10'
        )}
        style={{ height: 'var(--navbar-height)' }}
        role="banner"
      >
        {/* Gold hairline along the top edge */}
        <span
          aria-hidden="true"
          className="absolute top-0 right-0 left-0 h-[2px] bg-gradient-to-l from-transparent via-accent/80 to-transparent"
        />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-full flex items-center gap-4">
          {/* Masthead */}
          <Link
            href="/"
            className="flex-shrink-0 flex items-center gap-3 focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-ink rounded"
            aria-label="التلغراف - الصفحة الرئيسية"
          >
            <img
              src="/logo-light.png"
              alt="التلغراف"
              width={229}
              height={100}
              className="h-10 sm:h-11 w-auto select-none"
              draggable={false}
            />
          </Link>

          {/* Desktop Navigation */}
          <nav
            className="hidden lg:flex items-center gap-0.5 flex-1 mr-4 overflow-x-auto scrollbar-none"
            aria-label="القائمة الرئيسية"
          >
            {NAV_LINKS.map((link) => {
              const isActive =
                pathname === link.href || pathname.startsWith(link.href + '/');
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-current={isActive || undefined}
                  className={clsx(
                    'nav-link flex-shrink-0 px-2.5 py-2 font-arabic font-medium text-sm transition-colors duration-150 whitespace-nowrap',
                    isActive
                      ? 'text-accent-300'
                      : 'text-white/80 hover:text-white'
                  )}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>

          {/* Actions */}
          <div className="flex items-center gap-2 mr-auto">
            <button
              onClick={() => setIsSearchOpen(true)}
              className="flex items-center gap-2 px-3 py-2 rounded-md text-white/75 hover:text-accent-300 hover:bg-white/5 transition-colors duration-200"
              aria-label="البحث"
              title="بحث (Ctrl+K)"
            >
              <Search className="w-5 h-5" />
              <span className="hidden xl:flex items-center gap-1 text-xs text-white/40">
                <kbd className="px-1.5 py-0.5 bg-white/10 rounded text-xs font-mono">⌃K</kbd>
              </span>
            </button>

            <DarkModeToggle className="text-white/75 hover:text-accent-300" />

            <button
              onClick={() => setIsMobileMenuOpen(true)}
              className="lg:hidden flex items-center justify-center w-9 h-9 rounded-md text-white/75 hover:text-accent-300 hover:bg-white/5 transition-colors"
              aria-label="فتح القائمة"
              aria-expanded={isMobileMenuOpen}
            >
              <Menu className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      <SearchOverlay isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />
      <MobileMenu isOpen={isMobileMenuOpen} onClose={() => setIsMobileMenuOpen(false)} categories={categories} />
    </>
  );
}
