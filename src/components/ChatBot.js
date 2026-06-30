import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import ChatHeader from './ChatHeader';
import ChatMessage from './ChatMessage';
import TypingIndicator from './TypingIndicator';
import OptionList from './OptionList';
import ChatInput from './ChatInput';
import BookingConfirmation from './BookingConfirmation';

import api from '../services/api';
import { COLORS, SIZES, SHADOWS } from '../constants/theme';
import { chatCompletion, hasApiKey, LLM_MODEL } from '../services/llm';
import { buildSystemPrompt } from '../services/agentPrompt';
import { TOOL_SCHEMA, callTool, widgetFromToolResult } from '../services/agentTools';
import { validateMobile } from '../utils/validators';

// Heuristic: did the bot's last message ask for a mobile/phone number?
// Triggers the input's "phone-pad + max 10 digits + +91 prefix" mode.
// Matches phrasings like "mobile number", "phone number", "your mobile",
// and retry prompts like "valid 10-digit number".
const MOBILE_PROMPT_RE = /\b(mobile|phone)\b|\b10[- ]?digit\b/i;
const digitsOnly = (t) => (t || '').replace(/\D/g, '').slice(0, 10);

// =================================================================
// ChatBot — conversational agent UI
//
// Runs a tool-calling loop against the LLM. The LLM drives the
// conversation; this component:
//   - renders chat bubbles + a typing indicator
//   - renders inline pickers when the LLM returns selectable results
//     (doctors / time slots / procedures)
//   - shows a hard confirmation card before any actual booking call
//   - shows a success card after a successful booking
// =================================================================

const MAX_AGENT_ITERATIONS = 8;

const now = () =>
  new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

const newId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

const GREETING =
  "Hi! I'm your Qurix healthcare assistant. " +
  "Tell me what kind of doctor you'd like to see, or describe what you need — I'll help you book an appointment.";

// ----- Map flat request_booking params into the booking object api.js expects -----
const buildBookingFromParams = (p) => ({
  doctor: { doctorId: p.doctorId, doctorName: p.doctorName },
  slot: {
    slotId: p.slotId,
    sessionInstanceId: p.sessionInstanceId,
    sessionId: p.sessionId ?? p.sessionInstanceId,
    sessionDate: p.sessionDate,
    timeSlot: p.timeSlot,
    startTime: p.displayTime || p.timeSlot,
    date: p.sessionDate,
  },
  procedure: {
    procedureId: p.procedureId,
    procedureName: p.procedureName,
    price: p.procedurePrice,
  },
  patient: p.existingPatientUuid
    ? {
        uuid: p.existingPatientUuid,
        patientId: p.existingPatientUuid,
        masterIdentifierId: p.masterIdentifierId,
        firstName: p.firstName,
        lastName: p.lastName,
        gender: p.gender,
        dob: p.dob,
        title: p.title,
        mobile: p.mobile,
      }
    : null,
  firstName: p.firstName,
  lastName: p.lastName,
  gender: p.gender,
  dob: p.dob,
  mobile: p.mobile,
  title: p.title,
});

const ChatBot = () => {
  // ---- chat-visible state ----
  const [displayMessages, setDisplayMessages] = useState([]);
  const [widget, setWidget] = useState(null);          // { kind, items } | null
  const [pendingConfirm, setPendingConfirm] = useState(null); // request_booking params | null
  const [appointment, setAppointment] = useState(null); // { result, summary } | null
  const [isTyping, setIsTyping] = useState(false);
  const [error, setError] = useState(null);
  const [inputDisabled, setInputDisabled] = useState(false);

  // ---- agent loop bookkeeping ----
  // OpenAI-format message history (system + user + assistant + tool).
  const apiMessagesRef = useRef([]);
  // Shared tool context (departments cache + confirmation resolver).
  const ctxRef = useRef({});
  // Resolver for the currently-pending confirmation card.
  const confirmResolverRef = useRef(null);

  const scrollRef = useRef(null);
  // Imperative handle into the ChatInput so we can re-focus after each bot turn.
  const chatInputRef = useRef(null);

  // -----------------------------------------------------------------
  // Display helpers
  // -----------------------------------------------------------------
  const scrollToBottom = useCallback(() => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);
  }, []);

  const pushDisplay = useCallback(
    (msg) => {
      setDisplayMessages((prev) => [
        ...prev,
        { id: newId(), timestamp: now(), ...msg },
      ]);
      scrollToBottom();
    },
    [scrollToBottom]
  );

  // -----------------------------------------------------------------
  // Booking confirmation (wired into the tool context)
  // -----------------------------------------------------------------
  const confirmBooking = useCallback(
    (params) =>
      new Promise((resolve) => {
        setPendingConfirm(params);
        confirmResolverRef.current = resolve;
        scrollToBottom();
      }),
    [scrollToBottom]
  );

  // Refresh the ctx reference so the latest closures are used.
  ctxRef.current.confirmBooking = confirmBooking;

  const handleConfirmAccept = async () => {
    const params = pendingConfirm;
    if (!params || !confirmResolverRef.current) return;
    const resolve = confirmResolverRef.current;
    confirmResolverRef.current = null;
    setPendingConfirm(null);
    setIsTyping(true);
    try {
      const booking = buildBookingFromParams(params);
      const result = await api.bookAppointment(booking);
      // Remember for the success card.
      setAppointment({
        result,
        summary: {
          doctorName: params.doctorName,
          departmentName: params.departmentName || '',
          date: params.sessionDate,
          time: params.displayTime || params.timeSlot,
          procedureName: params.procedureName,
          patientName: `${params.firstName || ''} ${params.lastName || ''}`.trim(),
        },
      });
      resolve({ confirmed: true, appointmentId: result?.appointmentId ?? null, result });
    } catch (e) {
      resolve({ confirmed: true, error: e.message });
    } finally {
      setIsTyping(false);
    }
  };

  const handleConfirmCancel = () => {
    if (!confirmResolverRef.current) return;
    const resolve = confirmResolverRef.current;
    confirmResolverRef.current = null;
    setPendingConfirm(null);
    resolve({ confirmed: false });
  };

  // -----------------------------------------------------------------
  // The agent loop
  // -----------------------------------------------------------------
  const runAgent = useCallback(
    async (userText, { skipDisplay = false } = {}) => {
      if (!userText) return;

      // Append to API history.
      apiMessagesRef.current.push({ role: 'user', content: userText });

      if (!skipDisplay) {
        pushDisplay({ sender: 'user', text: userText });
      }

      setWidget(null);
      setError(null);
      setIsTyping(true);
      setInputDisabled(true);

      try {
        let nextWidget = null;
        for (let i = 0; i < MAX_AGENT_ITERATIONS; i++) {
          const assistant = await chatCompletion(
            apiMessagesRef.current,
            TOOL_SCHEMA
          );

          // Push the assistant message into history (including tool_calls).
          // tool_calls field must be preserved or the next round will be invalid.
          apiMessagesRef.current.push(assistant);

          // Show any text the assistant gave us.
          if (assistant.content && assistant.content.trim()) {
            pushDisplay({ sender: 'bot', text: assistant.content });
          }

          const toolCalls = assistant.tool_calls || [];
          if (toolCalls.length === 0) {
            break; // conversation pause — wait for next user input
          }

          // Execute every tool call in order. Latest selectable result wins
          // as the widget to render.
          for (const tc of toolCalls) {
            let parsedArgs = {};
            try {
              parsedArgs = JSON.parse(tc.function.arguments || '{}');
            } catch (e) {
              apiMessagesRef.current.push({
                role: 'tool',
                tool_call_id: tc.id,
                name: tc.function.name,
                content: JSON.stringify({ error: `Invalid JSON args: ${e.message}` }),
              });
              continue;
            }

            let result;
            try {
              result = await callTool(tc.function.name, parsedArgs, ctxRef.current);
            } catch (e) {
              result = { error: e.message };
            }

            apiMessagesRef.current.push({
              role: 'tool',
              tool_call_id: tc.id,
              name: tc.function.name,
              content: JSON.stringify(result),
            });

            const w = widgetFromToolResult(tc.function.name, result);
            if (w) nextWidget = w;
          }
        }

        // Render the latest selectable widget (if any) after the loop.
        if (nextWidget) setWidget(nextWidget);
      } catch (e) {
        const msg = e?.message || 'Something went wrong talking to the assistant.';
        setError(msg);
        pushDisplay({ sender: 'bot', text: `Sorry, I hit an issue: ${msg}` });
      } finally {
        setIsTyping(false);
        setInputDisabled(false);
      }
    },
    [pushDisplay]
  );

  // -----------------------------------------------------------------
  // Initial greeting + reset
  // -----------------------------------------------------------------
  const startConversation = useCallback(() => {
    setDisplayMessages([]);
    setWidget(null);
    setPendingConfirm(null);
    setAppointment(null);
    setError(null);
    confirmResolverRef.current = null;
    ctxRef.current = { confirmBooking };
    apiMessagesRef.current = [
      { role: 'system', content: buildSystemPrompt() },
    ];
    pushDisplay({ sender: 'bot', text: GREETING });
  }, [confirmBooking, pushDisplay]);

  useEffect(() => {
    startConversation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Pre-warm departments cache in the background so the first search is snappy.
  useEffect(() => {
    api.fetchDepartments()
      .then((d) => { ctxRef.current.departmentsCache = d; })
      .catch(() => { /* ignore — will fetch on demand */ });
  }, []);

  // Auto-focus the chat input whenever the bot finishes its turn so the
  // user can keep typing without clicking back into the field. We skip
  // focusing while the confirmation card is up (user needs to tap a
  // button) or after the booking is complete (input is unmounted).
  useEffect(() => {
    if (isTyping || inputDisabled || pendingConfirm || appointment) return;
    const t = setTimeout(() => chatInputRef.current?.focus?.(), 50);
    return () => clearTimeout(t);
  }, [isTyping, inputDisabled, pendingConfirm, appointment, displayMessages.length]);

  // -----------------------------------------------------------------
  // Widget → user-message handlers
  // -----------------------------------------------------------------
  const onSelectDoctor = (doc) => {
    setWidget(null);
    runAgent(`${doc.doctorName}`);
  };
  const onSelectSlot = (slot) => {
    setWidget(null);
    runAgent(`${slot.displayTime} on ${slot.displayDate}`);
  };
  const onSelectProcedure = (proc) => {
    setWidget(null);
    runAgent(proc.procedureName);
  };

  const onSubmitText = (text) => {
    runAgent(text);
  };

  // -----------------------------------------------------------------
  // Render helpers
  // -----------------------------------------------------------------
  const renderWidget = () => {
    if (!widget) return null;

    if (widget.kind === 'doctors') {
      return (
        <View style={styles.widgetBox}>
          <OptionList
            options={widget.items.map((d) => ({
              id: d.doctorId,
              title: d.doctorName,
              subtitle: d.qualification || d.department,
              meta: d.department,
              icon: 'person',
            }))}
            onSelect={(opt) =>
              onSelectDoctor(widget.items.find((d) => d.doctorId === opt.id))
            }
            maxHeight={260}
          />
        </View>
      );
    }

    if (widget.kind === 'slots') {
      return (
        <View style={styles.widgetBox}>
          <OptionList
            options={widget.items.map((s) => ({
              id: s.slotId,
              title: s.displayTime,
              subtitle: s.displayDate,
              icon: 'time',
            }))}
            onSelect={(opt) =>
              onSelectSlot(widget.items.find((s) => s.slotId === opt.id))
            }
            columns={2}
            maxHeight={260}
          />
        </View>
      );
    }

    if (widget.kind === 'procedures') {
      return (
        <View style={styles.widgetBox}>
          <OptionList
            options={widget.items.map((p) => ({
              id: p.procedureId,
              title: p.procedureName,
              subtitle: p.isFree ? 'No charge' : `₹${p.price}`,
              meta: p.duration ? `${p.duration} min` : null,
              icon: p.isVirtual ? 'videocam' : p.isFree ? 'gift' : 'cash',
            }))}
            onSelect={(opt) =>
              onSelectProcedure(widget.items.find((p) => p.procedureId === opt.id))
            }
            maxHeight={240}
          />
        </View>
      );
    }

    return null;
  };

  const renderConfirmCard = () => {
    if (!pendingConfirm) return null;
    const p = pendingConfirm;
    const priceLine =
      p.procedurePrice != null
        ? (p.procedurePrice > 0 ? `₹${p.procedurePrice}` : 'No charge')
        : null;
    return (
      <View style={styles.summaryCard}>
        <Text style={styles.summaryTitle}>Confirm your booking</Text>
        <SummaryRow label="Doctor" value={p.doctorName} />
        <SummaryRow label="Date & Time" value={`${p.sessionDate} · ${p.displayTime || p.timeSlot}`} />
        <SummaryRow label="Procedure" value={p.procedureName} />
        {priceLine && <SummaryRow label="Fee" value={priceLine} />}
        <SummaryRow
          label="Patient"
          value={`${p.firstName || ''} ${p.lastName || ''}`.trim()}
        />
        <SummaryRow label="Mobile" value={p.mobile ? `+91 ${p.mobile}` : ''} />

        <View style={styles.confirmRow}>
          <TouchableOpacity style={styles.cancelBtn} onPress={handleConfirmCancel}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.confirmBtn} onPress={handleConfirmAccept}>
            <Ionicons name="checkmark-circle" size={18} color={COLORS.white} />
            <Text style={styles.confirmText}>Book Appointment</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderSuccessCard = () => {
    if (!appointment) return null;
    return (
      <BookingConfirmation
        appointment={appointment.result || {}}
        summary={appointment.summary}
        onNewBooking={startConversation}
      />
    );
  };

  // -----------------------------------------------------------------
  // Layout
  // -----------------------------------------------------------------
  // Find the most recent bot message and check if it's asking for a mobile
  // number; if so, swap in the constrained phone-pad input below.
  const lastBotText = (() => {
    for (let i = displayMessages.length - 1; i >= 0; i--) {
      if (displayMessages[i].sender === 'bot') return displayMessages[i].text || '';
    }
    return '';
  })();
  const askingMobile = MOBILE_PROMPT_RE.test(lastBotText);

  return (
    <View style={styles.container}>
      <ChatHeader onReset={startConversation} />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 60 : 0}
      >
        <ScrollView
          ref={scrollRef}
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {!hasApiKey() && (
            <View style={styles.errorBanner}>
              <Ionicons name="warning" size={16} color={COLORS.white} />
              <Text style={styles.errorBannerText}>
                OpenAI key missing. Add EXPO_PUBLIC_OPENAI_API_KEY to your .env file.
              </Text>
            </View>
          )}

          {displayMessages.map((m) => (
            <ChatMessage
              key={m.id}
              sender={m.sender}
              message={m.text}
              timestamp={m.timestamp}
            />
          ))}

          {isTyping && <TypingIndicator />}

          {renderWidget()}
          {renderConfirmCard()}
          {renderSuccessCard()}

          {error && (
            <View style={styles.errorChip}>
              <Text style={styles.errorChipText}>{error}</Text>
            </View>
          )}

          <View style={{ height: 80 }} />
        </ScrollView>

        <View style={styles.inputDock}>
          {!appointment && (
            askingMobile ? (
              <ChatInput
                ref={chatInputRef}
                placeholder="10-digit mobile number"
                keyboardType="phone-pad"
                maxLength={10}
                prefix="+91"
                sanitize={digitsOnly}
                validate={validateMobile}
                onSubmit={onSubmitText}
                autoFocus
              />
            ) : (
              <ChatInput
                ref={chatInputRef}
                placeholder="Ask anything or type to reply..."
                onSubmit={onSubmitText}
                autoFocus
              />
            )
          )}
          <Text style={styles.poweredBy}>
            Powered by {LLM_MODEL}
          </Text>
        </View>

        {inputDisabled && isTyping && (
          <View style={styles.busyOverlay} pointerEvents="none">
            <ActivityIndicator size="small" color={COLORS.primary} />
          </View>
        )}
      </KeyboardAvoidingView>
    </View>
  );
};

const SummaryRow = ({ label, value }) => (
  <View style={styles.sumRow}>
    <Text style={styles.sumLabel}>{label}</Text>
    <Text style={styles.sumValue}>{value || '-'}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scroll: { flex: 1 },
  scrollContent: { paddingVertical: 12, paddingBottom: 30 },

  widgetBox: { marginTop: 4 },

  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.warning,
    marginHorizontal: 12,
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: SIZES.radius,
  },
  errorBannerText: {
    color: COLORS.white,
    marginLeft: 8,
    flex: 1,
    fontSize: SIZES.small,
    fontWeight: '500',
  },

  errorChip: {
    backgroundColor: COLORS.primaryLight,
    marginHorizontal: 12,
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: SIZES.radius,
  },
  errorChipText: { color: COLORS.error, fontSize: SIZES.small },

  summaryCard: {
    backgroundColor: COLORS.white,
    margin: 12,
    borderRadius: SIZES.radius,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.medium,
  },
  summaryTitle: {
    fontSize: SIZES.large,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 12,
  },
  sumRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
  },
  sumLabel: { color: COLORS.textSecondary, fontSize: SIZES.medium },
  sumValue: {
    color: COLORS.textPrimary,
    fontSize: SIZES.medium,
    fontWeight: '600',
    maxWidth: '60%',
    textAlign: 'right',
  },
  confirmRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  cancelBtn: {
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: SIZES.radiusLarge,
    borderWidth: 1.5,
    borderColor: COLORS.border,
  },
  cancelText: { color: COLORS.textSecondary, fontWeight: '600', fontSize: SIZES.medium },
  confirmBtn: {
    flexDirection: 'row',
    backgroundColor: COLORS.primary,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: SIZES.radiusLarge,
    alignItems: 'center',
    ...SHADOWS.medium,
  },
  confirmText: {
    color: COLORS.white,
    fontWeight: '700',
    fontSize: SIZES.medium,
    marginLeft: 6,
  },

  inputDock: {
    borderTopWidth: 1,
    borderTopColor: COLORS.divider,
    paddingBottom: 8,
    backgroundColor: COLORS.background,
  },
  poweredBy: {
    textAlign: 'center',
    color: COLORS.textMuted,
    fontSize: 10,
    marginTop: 4,
  },

  busyOverlay: {
    position: 'absolute',
    right: 24,
    bottom: 86,
  },
});

export default ChatBot;
