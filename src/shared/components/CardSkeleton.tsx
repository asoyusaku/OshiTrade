import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import { Card } from 'react-native-paper';
import { COLORS, SPACING, BORDER_RADIUS } from '../utils/constants';

type CardSkeletonProps = {
  variant?: 'match' | 'list';
};

export function CardSkeleton({ variant = 'list' }: CardSkeletonProps) {
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.3,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [opacity]);

  if (variant === 'match') {
    return (
      <Card style={styles.card}>
        <Card.Content>
          <View style={styles.row}>
            <Animated.View style={[styles.avatar, { opacity }]} />
            <Animated.View style={[styles.textLine, styles.name, { opacity }]} />
          </View>
          <Animated.View style={[styles.tradeBox, { opacity }]} />
          <Animated.View style={[styles.button, { opacity }]} />
        </Card.Content>
      </Card>
    );
  }

  return (
    <Card style={styles.card}>
      <Card.Content style={styles.row}>
        <Animated.View style={[styles.thumbnail, { opacity }]} />
        <View style={styles.listInfo}>
          <Animated.View style={[styles.textLine, styles.name, { opacity }]} />
          <Animated.View style={[styles.textLine, styles.subtitle, { opacity }]} />
        </View>
      </Card.Content>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: SPACING.sm,
    backgroundColor: COLORS.white,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: BORDER_RADIUS.xl,
    backgroundColor: COLORS.surface,
    marginRight: SPACING.sm,
  },
  thumbnail: {
    width: 48,
    height: 48,
    borderRadius: BORDER_RADIUS.sm,
    backgroundColor: COLORS.surface,
    marginRight: SPACING.sm,
  },
  textLine: {
    height: 16,
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.sm,
  },
  name: {
    width: 120,
    marginBottom: SPACING.xs,
  },
  subtitle: {
    width: 80,
  },
  tradeBox: {
    height: 72,
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.md,
    marginTop: SPACING.sm,
  },
  button: {
    height: 36,
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.md,
    marginTop: SPACING.sm,
  },
  listInfo: {
    flex: 1,
  },
});
