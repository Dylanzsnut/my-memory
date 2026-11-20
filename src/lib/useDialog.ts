import { useEffect, useRef } from 'react';
import type { RefObject } from 'react';

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'textarea:not([disabled])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

// Nested dialogs (e.g. a photo lightbox inside the detail sheet) share one
// scroll lock so closing the inner layer does not unlock the page too early.
let openDialogCount = 0;
let previousOverflow = '';

interface DialogOptions {
  /** Optional nested layer to trap focus inside instead of the main dialog. */
  focusRootRef?: RefObject<HTMLElement | null>;
  /** Changes when the focus root switches, so the trap follows it. */
  focusKey?: string | number;
  /** Return true to consume Escape in a nested layer without closing the dialog. */
  onEscape?: () => boolean;
}

function focusableItems(root: HTMLElement | null): HTMLElement[] {
  if (!root) return [];
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (el) => el.getClientRects().length > 0,
  );
}

/** Escape + focus trap + focus restore + scroll lock for modal overlays. */
export function useDialog(
  ref: RefObject<HTMLElement | null>,
  open: boolean,
  onClose: () => void,
  options: DialogOptions = {},
) {
  const closeRef = useRef(onClose);
  const escapeRef = useRef(options.onEscape);
  closeRef.current = onClose;
  escapeRef.current = options.onEscape;
  const focusRootRef = options.focusRootRef ?? ref;
  const focusKey = options.focusKey ?? 'main';

  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    if (openDialogCount === 0) {
      previousOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
    }
    openDialogCount += 1;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (escapeRef.current?.()) {
        event.preventDefault();
        return;
      }
      event.preventDefault();
      closeRef.current();
    };
    document.addEventListener('keydown', onKeyDown);

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      openDialogCount -= 1;
      if (openDialogCount === 0) document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus?.();
    };
  }, [open, ref]);

  useEffect(() => {
    if (!open) return;
    const root = focusRootRef.current;
    const items = focusableItems(root);
    (items[0] || root)?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;
      const current = focusableItems(focusRootRef.current);
      if (!current.length) {
        event.preventDefault();
        return;
      }
      const first = current[0];
      const last = current[current.length - 1];
      if (event.shiftKey && (document.activeElement === first || !root?.contains(document.activeElement))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !root?.contains(document.activeElement))) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
    // focusKey tracks which nested layer owns the trap.
  }, [open, focusKey, focusRootRef]);
}

/** Escape + outside-click dismissal for non-modal popovers such as the account menu. */
export function useOutsideDismiss(
  ref: RefObject<HTMLElement | null>,
  open: boolean,
  onClose: () => void,
) {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) closeRef.current();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeRef.current();
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open, ref]);
}
