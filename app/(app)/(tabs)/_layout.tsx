import { useMemo, useState } from 'react';
import { Tabs, useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Home, LayoutGrid, MessageSquare, Bell, User, Plus } from 'lucide-react-native';

import { ShortcutsDialog, type ShortcutItem } from '../../../components/ui';
import { useKeyboardShortcuts, type Binding } from '../../../lib/useKeyboardShortcuts';
import {
  useNotificationsRealtime,
  useUnreadCount,
} from '../../../lib/queries/notifications';
import { useAuthStore } from '../../../stores/authStore';
import { palette, shadow, tokens, typography } from '../../../constants/theme';

type IconProps = { focused: boolean; color: string };

function TabIcon({
  Icon,
  focused,
  color,
}: {
  Icon: typeof Home;
  focused: boolean;
  color: string;
}) {
  return <Icon size={20} color={color as string} strokeWidth={focused ? 2.4 : 1.8} />;
}

function NotifTabIcon({ focused, color }: IconProps) {
  const userId = useAuthStore((s) => s.user?.id);
  const unread = useUnreadCount(userId);
  return (
    <View style={badgeStyles.wrap}>
      <Bell size={20} color={color} strokeWidth={focused ? 2.4 : 1.8} />
      {unread > 0 && (
        <View style={badgeStyles.badge}>
          <Text style={badgeStyles.badgeText}>{unread > 9 ? '9+' : unread}</Text>
        </View>
      )}
    </View>
  );
}

export default function TabsLayout() {
  const userId = useAuthStore((s) => s.user?.id);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  useNotificationsRealtime(userId);

  const [showShortcuts, setShowShortcuts] = useState(false);

  const bindings: Binding[] = useMemo(
    () => [
      { combo: 'c',     description: 'Nueva tarea',           handler: () => router.push('/tasks/new' as never) },
      { combo: 'g+i',   description: 'Ir a Inicio',           handler: () => router.push('/' as never) },
      { combo: 'g+t',   description: 'Ir a Tableros',         handler: () => router.push('/boards' as never) },
      { combo: 'g+c',   description: 'Ir a Chats',            handler: () => router.push('/chat' as never) },
      { combo: 'g+n',   description: 'Ir a Notificaciones',   handler: () => router.push('/notifications' as never) },
      { combo: 'g+p',   description: 'Ir a Perfil',           handler: () => router.push('/profile' as never) },
      { combo: 'shift+?', description: 'Mostrar atajos',      handler: () => setShowShortcuts(true) },
      { combo: '?',     description: 'Mostrar atajos',        handler: () => setShowShortcuts(true) },
      { combo: 'escape', description: 'Cerrar diálogos',      handler: () => setShowShortcuts(false), evenInInput: true },
    ],
    [router],
  );

  useKeyboardShortcuts(bindings);

  const shortcuts: ShortcutItem[] = bindings
    .filter((b) => !['escape', 'shift+?'].includes(b.combo))
    .map((b) => ({ combo: b.combo, description: b.description }));

  return (
    <>
    <ShortcutsDialog
      visible={showShortcuts}
      onClose={() => setShowShortcuts(false)}
      shortcuts={shortcuts}
    />
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: tokens.brand[600],
        tabBarInactiveTintColor: tokens.text.muted,
        tabBarStyle: [
          styles.tabBar,
          {
            height: 58 + Math.max(insets.bottom, 8) + 6,
            paddingBottom: Math.max(insets.bottom, 8) + 6,
          },
        ],
        tabBarLabelStyle: styles.tabLabel,
        tabBarItemStyle: { paddingTop: 6 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Inicio',
          tabBarIcon: ({ focused, color }) => (
            <TabIcon Icon={Home} focused={focused} color={color as string} />
          ),
        }}
      />
      <Tabs.Screen
        name="boards"
        options={{
          title: 'Tableros',
          tabBarIcon: ({ focused, color }) => (
            <TabIcon Icon={LayoutGrid} focused={focused} color={color as string} />
          ),
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          title: 'Chats',
          tabBarIcon: ({ focused, color }) => (
            <TabIcon Icon={MessageSquare} focused={focused} color={color as string} />
          ),
        }}
      />
      <Tabs.Screen
        name="notifications"
        options={{
          title: 'Avisos',
          tabBarIcon: ({ focused, color }) => <NotifTabIcon focused={focused} color={color as string} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Perfil',
          tabBarIcon: ({ focused, color }) => (
            <TabIcon Icon={User} focused={focused} color={color as string} />
          ),
        }}
      />
      {/* Rutas de detalle: no deben aparecer como tabs */}
      <Tabs.Screen name="boards/[areaId]" options={{ href: null }} />
      <Tabs.Screen name="chat/[channelId]" options={{ href: null }} />
    </Tabs>

    <Pressable
      onPress={() => router.push('/tasks/new' as never)}
      style={({ pressed }) => [
        styles.fab,
        {
          bottom: 58 + Math.max(insets.bottom, 8) + 6 + 16,
        },
        pressed && styles.fabPressed,
      ]}
      hitSlop={6}
      accessibilityLabel="Nueva tarea"
    >
      <Plus size={22} color={tokens.brand.fg} strokeWidth={2.6} />
    </Pressable>
    </>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    right: 18,
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: tokens.brand[600],
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  fabPressed: { backgroundColor: tokens.brand[700] },

  tabBar: {
    backgroundColor: tokens.bg.surface,
    borderTopColor: tokens.border.subtle,
    borderTopWidth: 1,
    paddingTop: 4,
    ...shadow.soft,
  },
  tabLabel: {
    fontSize: typography.size['2xs'],
    fontWeight: typography.weight.semibold as '600',
    letterSpacing: 0.3,
    marginTop: 2,
  },
});

const badgeStyles = StyleSheet.create({
  wrap: { position: 'relative' },
  badge: {
    position: 'absolute',
    top: -4,
    right: -8,
    backgroundColor: palette.red[500],
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: tokens.bg.surface,
  },
  badgeText: {
    color: tokens.brand.fg,
    fontSize: 9,
    fontWeight: typography.weight.bold as '700',
    lineHeight: 12,
  },
});
