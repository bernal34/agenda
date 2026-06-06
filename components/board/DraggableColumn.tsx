import { Gesture } from 'react-native-gesture-handler';
import {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

interface Args {
  index: number;
  stride: number; // ancho de columna + gap
  total: number;
  onReorder: (fromIndex: number, toIndex: number) => void;
}

/**
 * Hook que retorna un Pan gesture (activado por long-press)
 * + un animatedStyle para aplicar al wrapper de la columna.
 * El consumer ata el GestureDetector solo al "handle" pequeño,
 * y el animatedStyle a todo el column wrapper.
 */
export function useColumnDrag({ index, stride, total, onReorder }: Args) {
  const tx = useSharedValue(0);
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);
  const z = useSharedValue(0);

  const gesture = Gesture.Pan()
    .activateAfterLongPress(260)
    .onStart(() => {
      scale.value = withSpring(1.03);
      opacity.value = withTiming(0.94, { duration: 120 });
      z.value = 50;
    })
    .onChange((e) => {
      tx.value = e.translationX;
    })
    .onEnd((e) => {
      const delta = Math.round(e.translationX / stride);
      const target = Math.max(0, Math.min(total - 1, index + delta));
      tx.value = withSpring(0, { damping: 18 });
      scale.value = withSpring(1);
      opacity.value = withTiming(1, { duration: 150 });
      z.value = 0;
      if (target !== index) {
        runOnJS(onReorder)(index, target);
      }
    })
    .onFinalize(() => {
      tx.value = withSpring(0);
      scale.value = withSpring(1);
      opacity.value = withTiming(1);
      z.value = 0;
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }, { scale: scale.value }],
    opacity: opacity.value,
    zIndex: z.value,
    elevation: z.value,
    shadowColor: '#000',
    shadowOpacity: z.value > 0 ? 0.2 : 0,
    shadowRadius: z.value > 0 ? 10 : 0,
    shadowOffset: { width: 0, height: z.value > 0 ? 6 : 0 },
  }));

  return { gesture, animatedStyle };
}
