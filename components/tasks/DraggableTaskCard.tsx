import { useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  runOnJS,
  SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { Check } from 'lucide-react-native';

import { TaskCard } from './TaskCard';
import { MyTask } from '../../lib/queries/tasks';
import { palette, radius, tokens } from '../../constants/theme';

interface Props {
  task: MyTask;
  onPress: () => void;
  onDragStart: (task: MyTask, bounds: { x: number; y: number; w: number; h: number }) => void;
  onDragMove: (absX: number, absY: number) => void;
  onDragEnd: (taskId: string, absX: number, absY: number) => void;
  selectable?: boolean;
  selected?: boolean;
}

export function DraggableTaskCard({
  task,
  onPress,
  onDragStart,
  onDragMove,
  onDragEnd,
  selectable,
  selected,
}: Props) {
  if (selectable) {
    return (
      <Pressable onPress={onPress} style={styles.selectWrap}>
        <View style={[styles.checkbox, selected && styles.checkboxOn]}>
          {selected && <Check size={12} color="#fff" strokeWidth={3} />}
        </View>
        <View style={[{ flex: 1 }, selected && styles.cardSelected]}>
          <TaskCard task={task} compact />
        </View>
      </Pressable>
    );
  }
  const wrapRef = useRef<View>(null);
  const opacity = useSharedValue(1);

  const pan = Gesture.Pan()
    .activateAfterLongPress(220)
    .onStart(() => {
      opacity.value = withTiming(0, { duration: 100 });
      runOnJS(measureAndStart)();
    })
    .onChange((e) => {
      runOnJS(onDragMove)(e.absoluteX, e.absoluteY);
    })
    .onEnd((e) => {
      runOnJS(onDragEnd)(task.id, e.absoluteX, e.absoluteY);
      opacity.value = withTiming(1, { duration: 120 });
    })
    .onFinalize(() => {
      opacity.value = withTiming(1, { duration: 120 });
    });

  const tap = Gesture.Tap()
    .maxDuration(220)
    .onEnd((_e, success) => {
      if (success) runOnJS(onPress)();
    });

  const composed = Gesture.Exclusive(tap, pan);

  function measureAndStart() {
    wrapRef.current?.measureInWindow((x, y, w, h) => {
      onDragStart(task, { x, y, w, h });
    });
  }

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <GestureDetector gesture={composed}>
      <Animated.View ref={wrapRef} style={animatedStyle}>
        <TaskCard task={task} compact />
      </Animated.View>
    </GestureDetector>
  );
}

interface PreviewProps {
  task: MyTask;
  startX: number;
  startY: number;
  width: number;
  dragX: SharedValue<number>;
  dragY: SharedValue<number>;
}

export function DragPreview({ task, startX, startY, width, dragX, dragY }: PreviewProps) {
  const style = useAnimatedStyle(() => ({
    position: 'absolute',
    left: dragX.value - width / 2,
    top: dragY.value - 30,
    width,
    transform: [{ scale: 1.04 }],
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 16,
    zIndex: 9999,
  }));

  return (
    <Animated.View style={[styles.preview, style]} pointerEvents="none">
      <TaskCard task={task} compact />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  preview: { pointerEvents: 'none' as any },
  selectWrap: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
  },
  checkbox: {
    marginTop: 8,
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: tokens.border.strong,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.bg.surface,
  },
  checkboxOn: {
    backgroundColor: palette.brand[600],
    borderColor: palette.brand[600],
  },
  cardSelected: {
    borderRadius: radius.lg,
    borderWidth: 2,
    borderColor: palette.brand[400],
  },
});
