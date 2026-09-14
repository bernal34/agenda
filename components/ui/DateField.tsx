import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, X } from 'lucide-react-native';

import { buildMonthCells, sameDay, toIso } from '../../lib/calendarGrid';
import { dmyToIso, isoToDmy } from '../../lib/dateFormat';
import { radius, shadow, spacing, typography, type Tokens } from '../../constants/theme';
import { useTheme, useThemedStyles } from '../../lib/theme';

const WEEKDAYS = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa', 'Do'];

interface Props {
  label: string;
  /** Fecha en DD/MM/YYYY, o cadena vacía si no hay. */
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
}

/**
 * Campo de fecha con calendario propio.
 *
 * Antes había que tipear DD/MM/YYYY a mano en el detalle de tarea, y en el
 * formulario de alta el calendario solo existía en web (input nativo del
 * navegador). Esto da el mismo calendario en las dos plataformas, sin sumar
 * dependencias: la grilla sale de buildMonthCells, que ya tiene tests.
 */
export function DateField({ label, value, onChange, placeholder = 'Sin fecha' }: Props) {
  const styles = useThemedStyles(makeStyles);
  const { t } = useTheme();
  const [open, setOpen] = useState(false);
  const selectedIso = dmyToIso(value);

  const [anchor, setAnchor] = useState(() => startAnchor(selectedIso));

  const openPicker = () => {
    setAnchor(startAnchor(dmyToIso(value)));
    setOpen(true);
  };

  const pick = (iso: string) => {
    onChange(isoToDmy(iso));
    setOpen(false);
  };

  const today = new Date();
  const cells = buildMonthCells(anchor.getFullYear(), anchor.getMonth());
  const monthLabel = anchor.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });

  return (
    <View style={{ gap: spacing[1] }}>
      <Text style={styles.label}>{label}</Text>

      <Pressable
        onPress={openPicker}
        accessibilityLabel={`${label}: ${value || placeholder}`}
        style={({ pressed }) => [styles.field, pressed && styles.fieldPressed]}
      >
        <CalendarIcon size={16} color={t.text.muted} strokeWidth={2} />
        <Text style={[styles.fieldText, !value && styles.fieldPlaceholder]}>
          {value || placeholder}
        </Text>
        {!!value && (
          <Pressable
            onPress={() => onChange('')}
            hitSlop={8}
            accessibilityLabel={`Quitar ${label.toLowerCase()}`}
          >
            <X size={14} color={t.text.muted} strokeWidth={2} />
          </Pressable>
        )}
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable style={styles.card} onPress={() => {}}>
            <View style={styles.header}>
              <Pressable
                onPress={() => setAnchor((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1))}
                hitSlop={8}
                accessibilityLabel="Mes anterior"
                style={styles.navBtn}
              >
                <ChevronLeft size={18} color={t.text.secondary} strokeWidth={2} />
              </Pressable>
              <Text style={styles.monthLabel}>{monthLabel}</Text>
              <Pressable
                onPress={() => setAnchor((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1))}
                hitSlop={8}
                accessibilityLabel="Mes siguiente"
                style={styles.navBtn}
              >
                <ChevronRight size={18} color={t.text.secondary} strokeWidth={2} />
              </Pressable>
            </View>

            <View style={styles.weekdays}>
              {WEEKDAYS.map((w) => (
                <Text key={w} style={styles.weekday}>{w}</Text>
              ))}
            </View>

            <View style={styles.grid}>
              {cells.map((cell, idx) => {
                if (!cell.date || !cell.iso) {
                  return <View key={`empty-${idx}`} style={styles.dayCell} />;
                }
                const isSelected = selectedIso === cell.iso;
                const isToday = sameDay(cell.date, today);
                return (
                  <Pressable
                    key={cell.iso}
                    onPress={() => pick(cell.iso!)}
                    style={({ pressed }) => [
                      styles.dayCell,
                      isToday && !isSelected && styles.dayToday,
                      isSelected && styles.daySelected,
                      pressed && !isSelected && styles.dayPressed,
                    ]}
                  >
                    <Text
                      style={[
                        styles.dayNum,
                        isToday && !isSelected && styles.dayNumToday,
                        isSelected && styles.dayNumSelected,
                      ]}
                    >
                      {cell.date.getDate()}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.footer}>
              <Pressable
                onPress={() => pick(toIso(new Date()))}
                style={({ pressed }) => [styles.footerBtn, pressed && styles.footerBtnPressed]}
              >
                <Text style={styles.footerBtnText}>Hoy</Text>
              </Pressable>
              <Pressable
                onPress={() => { onChange(''); setOpen(false); }}
                style={({ pressed }) => [styles.footerBtn, pressed && styles.footerBtnPressed]}
              >
                <Text style={styles.footerBtnText}>Quitar fecha</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

/** Mes que se muestra al abrir: el de la fecha elegida, o el actual. */
function startAnchor(iso: string | null): Date {
  if (iso) {
    const d = new Date(`${iso}T00:00:00`);
    if (!Number.isNaN(d.getTime())) return new Date(d.getFullYear(), d.getMonth(), 1);
  }
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

const makeStyles = (t: Tokens) => StyleSheet.create({
  label: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium as '500',
    color: t.text.primary,
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    minHeight: 42,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    borderWidth: 1,
    borderColor: t.border.strong,
    borderRadius: radius.md,
    backgroundColor: t.bg.surface,
  },
  fieldPressed: { backgroundColor: t.bg.subtle },
  fieldText: {
    flex: 1,
    fontSize: typography.size.base,
    color: t.text.primary,
  },
  fieldPlaceholder: { color: t.text.muted },

  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing[4],
  },
  card: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: t.bg.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: t.border.default,
    padding: spacing[3],
    ...shadow.md,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: spacing[2],
  },
  navBtn: {
    width: 32,
    height: 32,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: t.border.subtle,
  },
  monthLabel: {
    fontSize: typography.size.base,
    fontWeight: typography.weight.semibold as '600',
    color: t.text.primary,
    textTransform: 'capitalize',
  },

  weekdays: { flexDirection: 'row', paddingBottom: spacing[1] },
  weekday: {
    flex: 1,
    textAlign: 'center',
    fontSize: typography.size['2xs'],
    color: t.text.muted,
    fontWeight: typography.weight.semibold as '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  dayCell: {
    width: `${100 / 7}%`,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
  },
  dayPressed: { backgroundColor: t.bg.subtle },
  dayToday: { backgroundColor: t.brand[50] },
  daySelected: { backgroundColor: t.brand[600] },
  dayNum: {
    fontSize: typography.size.base,
    color: t.text.primary,
    fontWeight: typography.weight.medium as '500',
  },
  dayNumToday: { color: t.brand[700], fontWeight: typography.weight.bold as '700' },
  dayNumSelected: { color: t.brand.fg, fontWeight: typography.weight.bold as '700' },

  footer: {
    flexDirection: 'row',
    gap: spacing[2],
    marginTop: spacing[2],
    paddingTop: spacing[2],
    borderTopWidth: 1,
    borderTopColor: t.border.subtle,
  },
  footerBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing[2],
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: t.border.default,
  },
  footerBtnPressed: { backgroundColor: t.bg.subtle },
  footerBtnText: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold as '600',
    color: t.text.secondary,
  },
});
