import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import { COLORS, SHADOWS } from '../constants/theme';
import BrandLogo from './BrandLogo';

// Animated three-dot typing indicator shown while the bot is "thinking".
const TypingIndicator = () => {
  const dot1 = useRef(new Animated.Value(0)).current;
  const dot2 = useRef(new Animated.Value(0)).current;
  const dot3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animate = (dot, delay) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(dot, { toValue: 1, duration: 400, useNativeDriver: true }),
          Animated.timing(dot, { toValue: 0, duration: 400, useNativeDriver: true }),
        ])
      ).start();

    animate(dot1, 0);
    animate(dot2, 150);
    animate(dot3, 300);
  }, [dot1, dot2, dot3]);

  const dotStyle = (anim) => ({
    transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [0, -4] }) }],
    opacity: anim.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }),
  });

  return (
    <View style={styles.row}>
      <View style={styles.avatar}>
        <BrandLogo width={22} height={22} />
      </View>
      <View style={styles.bubble}>
        <Animated.View style={[styles.dot, dotStyle(dot1)]} />
        <Animated.View style={[styles.dot, dotStyle(dot2)]} />
        <Animated.View style={[styles.dot, dotStyle(dot3)]} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginVertical: 6,
    paddingHorizontal: 12,
  },
  avatar: {
    width: 32, height: 32, borderRadius: 16, backgroundColor: COLORS.white,
    marginRight: 8, alignItems: 'center', justifyContent: 'center',
    ...SHADOWS.small,
  },
  avatarImg: { width: 22, height: 22 },
  bubble: {
    flexDirection: 'row',
    backgroundColor: COLORS.botBubble,
    paddingHorizontal: 14, paddingVertical: 12,
    borderRadius: 12, borderTopLeftRadius: 4,
    ...SHADOWS.small,
  },
  dot: {
    width: 7, height: 7, borderRadius: 4,
    backgroundColor: COLORS.primary,
    marginHorizontal: 3,
  },
});

export default TypingIndicator;
