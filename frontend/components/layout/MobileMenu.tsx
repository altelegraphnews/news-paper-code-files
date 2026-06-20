'use client';

import { Fragment, useEffect } from 'react';
import Link from 'next/link';
import { X, ChevronLeft, Home } from 'lucide-react';
import { Dialog, Transition } from '@headlessui/react';
import DarkModeToggle from '@/components/ui/DarkModeToggle';
import { buildNavLinks } from '@/lib/nav';
import type { Category } from '@/lib/types';

interface NavCategory {
  label: string;
  href: string;
  subcategories?: { label: string; href: string }[];
}

interface MobileMenuProps {
  isOpen: boolean;
  onClose: () => void;
  categories?: Category[];
}

export default function MobileMenu({ isOpen, onClose, categories: navCategories = [] }: MobileMenuProps) {
  const categories: NavCategory[] = buildNavLinks(navCategories);

  // Lock scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  return (
    <Transition show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-modal lg:hidden" onClose={onClose} dir="rtl">
        {/* Backdrop */}
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/60" aria-hidden="true" />
        </Transition.Child>

        {/* Drawer */}
        <Transition.Child
          as={Fragment}
          enter="transform transition ease-out duration-300"
          enterFrom="translate-x-full"
          enterTo="translate-x-0"
          leave="transform transition ease-in duration-200"
          leaveFrom="translate-x-0"
          leaveTo="translate-x-full"
        >
          <Dialog.Panel className="fixed inset-y-0 right-0 w-[85vw] max-w-sm bg-white dark:bg-gray-900 shadow-2xl flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-gray-800 bg-primary dark:bg-primary-900">
              <Dialog.Title className="text-xl font-heading font-bold text-white">
                التلغراف
              </Dialog.Title>
              <button
                onClick={onClose}
                className="p-2 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors"
                aria-label="إغلاق القائمة"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Navigation */}
            <nav className="flex-1 overflow-y-auto py-4" aria-label="القائمة الرئيسية">
              {categories.map((cat) => (
                <MobileMenuCategory key={cat.href} category={cat} onClose={onClose} />
              ))}

              <div className="my-4 border-t border-gray-100 dark:border-gray-800" />

              <Link
                href="/"
                onClick={onClose}
                className="flex items-center gap-3 px-5 py-3 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors font-arabic text-base"
              >
                <Home className="w-5 h-5 text-primary dark:text-accent" />
                الرئيسية
              </Link>

            </nav>

            {/* Footer */}
            <div className="border-t border-gray-100 dark:border-gray-800 p-4 space-y-3">
              <DarkModeToggle variant="dropdown" className="w-full justify-center" />
              <p className="text-xs text-gray-400 dark:text-gray-500 text-center font-heading">
                © {new Date().getFullYear()} التلغراف. جميع الحقوق محفوظة.
              </p>
            </div>
          </Dialog.Panel>
        </Transition.Child>
      </Dialog>
    </Transition>
  );
}

function MobileMenuCategory({
  category,
  onClose,
}: {
  category: NavCategory;
  onClose: () => void;
}) {
  const hasSubcategories = category.subcategories && category.subcategories.length > 0;

  if (!hasSubcategories) {
    return (
      <Link
        href={category.href}
        onClick={onClose}
        className="flex items-center gap-3 px-5 py-3.5 text-gray-800 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-primary dark:hover:text-accent transition-colors font-arabic text-base font-semibold border-b border-gray-50 dark:border-gray-800/50"
      >
        {category.label}
      </Link>
    );
  }

  return (
    <details className="group">
      <summary className="flex items-center justify-between px-5 py-3.5 text-gray-800 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer font-arabic text-base font-semibold border-b border-gray-50 dark:border-gray-800/50 list-none">
        <Link
          href={category.href}
          onClick={(e) => e.stopPropagation()}
          className="hover:text-primary dark:hover:text-accent"
        >
          {category.label}
        </Link>
        <ChevronLeft className="w-4 h-4 text-gray-400 group-open:rotate-90 transition-transform duration-200" />
      </summary>
      <div className="bg-gray-50 dark:bg-gray-800/50">
        {category.subcategories?.map((sub) => (
          <Link
            key={sub.href}
            href={sub.href}
            onClick={onClose}
            className="flex items-center gap-3 pr-10 pl-5 py-2.5 text-gray-600 dark:text-gray-400 hover:text-primary dark:hover:text-accent transition-colors font-arabic text-sm"
          >
            <span className="w-1 h-1 rounded-full bg-accent flex-shrink-0" />
            {sub.label}
          </Link>
        ))}
      </div>
    </details>
  );
}
