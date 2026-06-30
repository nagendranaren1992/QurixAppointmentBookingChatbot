import React from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import { COLORS, SIZES, SHADOWS, BRAND } from '../constants/theme';

// ChatMessage — renders a single bot or user message bubble.
const ChatMessage = ({ message, sender = 'bot', timestamp }) => {
  const isBot = sender === 'bot';

  return (
    <View style={[styles.row, isBot ? styles.rowBot : styles.rowUser]}>
      {isBot && (
        <View style={styles.avatar}>
          <Image
            source={{ uri: BRAND.logoUrl }}
            style={styles.avatarImg}
            resizeMode="contain"
          />
        </View>
      )}

      <View style={[styles.bubble, isBot ? styles.botBubble : styles.userBubble]}>
        {typeof message === 'string' ? (
          <Text style={[styles.text, isBot ? styles.botText : styles.userText]}>
            {message}
          </Text>
        ) : (
          message /* allow custom children */
        )}
        {timestamp && (
          <Text style={[styles.timestamp, isBot ? styles.timestampBot : styles.timestampUser]}>
            {timestamp}
          </Text>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    marginVertical: 6,
    paddingHorizontal: 12,
    alignItems: 'flex-end',
  },
  rowBot: { justifyContent: 'flex-start' },
  rowUser: { justifyContent: 'flex-end' },

  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.white,
    marginRight: 8,
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOWS.small,
  },
  avatarImg: { width: 22, height: 22 },

  bubble: {
    maxWidth: '78%',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: SIZES.radius,
    ...SHADOWS.small,
  },
  botBubble: {
    backgroundColor: COLORS.botBubble,
    borderTopLeftRadius: 4,
  },
  userBubble: {
    backgroundColor: COLORS.userBubble,
    borderTopRightRadius: 4,
  },
  text: {
    fontSize: SIZES.medium,
    lineHeight: 20,
  },
  botText: { color: COLORS.botText },
  userText: { color: COLORS.userText },

  timestamp: {
    fontSize: 10,
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  timestampBot: { color: COLORS.textMuted },
  timestampUser: { color: 'rgba(255,255,255,0.7)' },
});

export default ChatMessage;
