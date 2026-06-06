import { useEffect } from 'react';
import { Platform } from 'react-native';

/**
 * Hook universal de atajos de teclado. Solo activo en web.
 * `bindings` mapea cadenas tipo "c", "?", "cmd+k", "shift+/" a handlers.
 * No matchea cuando el foco está en un input/textarea/contenteditable.
 */
export interface Binding {
  combo: string;       // ej: "c", "?", "shift+?", "cmd+k", "/"
  description: string;
  handler: () => void;
  /** Si true, permite que el shortcut funcione aunque haya un input enfocado */
  evenInInput?: boolean;
}

function normalize(e: KeyboardEvent) {
  const parts: string[] = [];
  if (e.metaKey || e.ctrlKey) parts.push('cmd');
  if (e.altKey) parts.push('alt');
  if (e.shiftKey) parts.push('shift');
  parts.push(e.key.toLowerCase());
  return parts.join('+');
}

function isEditableTarget(t: EventTarget | null): boolean {
  if (!t || !(t instanceof HTMLElement)) return false;
  const tag = t.tagName.toLowerCase();
  return tag === 'input' || tag === 'textarea' || t.isContentEditable;
}

export function useKeyboardShortcuts(bindings: Binding[]) {
  useEffect(() => {
    if (Platform.OS !== 'web') return;

    const map = new Map<string, Binding>();
    bindings.forEach((b) => map.set(b.combo.toLowerCase(), b));

    const onKey = (e: KeyboardEvent) => {
      const combo = normalize(e);
      const b = map.get(combo);
      if (!b) return;
      if (isEditableTarget(e.target) && !b.evenInInput) return;
      e.preventDefault();
      b.handler();
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [bindings]);
}
