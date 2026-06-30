import React, { useState, useRef, useEffect, useCallback } from 'react';
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
import DOBPicker from './DOBPicker';
import BookingConfirmation from './BookingConfirmation';

import api from '../services/api';
import { COLORS, SIZES, SHADOWS } from '../constants/theme';
import { validateMobile, validateName, formatDate } from '../utils/validators';
import { filterProceduresForPatient } from '../models/procedure';

// =================================================================
// Conversation step constants — each represents a stage in the flow
// =================================================================
const STEP = {
  WELCOME: 'WELCOME',
  SELECT_DEPARTMENT: 'SELECT_DEPARTMENT',
  SELECT_DOCTOR: 'SELECT_DOCTOR',
  SELECT_SLOT: 'SELECT_SLOT',
  ASK_MOBILE: 'ASK_MOBILE',
  SELECT_EXISTING_PATIENT: 'SELECT_EXISTING_PATIENT',
  ASK_FIRST_NAME: 'ASK_FIRST_NAME',
  ASK_LAST_NAME: 'ASK_LAST_NAME',
  ASK_GENDER: 'ASK_GENDER',
  ASK_DOB: 'ASK_DOB',
  SELECT_PROCEDURE: 'SELECT_PROCEDURE',
  CONFIRM_BOOKING: 'CONFIRM_BOOKING',
  BOOKED: 'BOOKED',
  ERROR: 'ERROR',
};

const now = () => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

const ChatBot = () => {
  // ----------------- State -----------------
  const [messages, setMessages] = useState([]);
  const [step, setStep] = useState(STEP.WELCOME);
  const [isTyping, setIsTyping] = useState(false);
  const [loading, setLoading] = useState(false);

  // collected data
  const [booking, setBooking] = useState({
    department: null,
    doctor: null,
    slot: null,
    procedure: null,
    mobile: null,
    patient: null,
    isNewPatient: false,
    firstName: null,
    lastName: null,
    gender: null,
    dob: null,
  });

  // dynamic option lists
  const [departments, setDepartments] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [slots, setSlots] = useState([]);
  const [procedures, setProcedures] = useState([]);
  const [existingPatients, setExistingPatients] = useState([]);
  const [appointment, setAppointment] = useState(null);

  const scrollRef = useRef(null);

  // ----------------- Helpers -----------------
  const scrollToBottom = useCallback(() => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);
  }, []);

  const pushMessage = useCallback((msg) => {
    setMessages((prev) => [...prev, { ...msg, id: Date.now() + Math.random(), timestamp: now() }]);
    scrollToBottom();
  }, [scrollToBottom]);

  const botSay = useCallback(async (text, delay = 600) => {
    setIsTyping(true);
    scrollToBottom();
    await new Promise((r) => setTimeout(r, delay));
    setIsTyping(false);
    pushMessage({ sender: 'bot', text });
  }, [pushMessage, scrollToBottom]);

  const userSay = useCallback((text) => {
    pushMessage({ sender: 'user', text });
  }, [pushMessage]);

  // ----------------- Step transitions -----------------

  // STEP 1: load departments
  const loadDepartments = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.fetchDepartments();
      setDepartments(data);
      await botSay('Please select a department to continue:');
      setStep(STEP.SELECT_DEPARTMENT);
    } catch (e) {
      await botSay(`Sorry, I couldn't load departments. ${e.message}`);
    } finally {
      setLoading(false);
    }
  }, [botSay]);

  // STEP 2: show doctors for chosen department
  // Doctors are already embedded in the department object (returned by
  // fetchDepartments), so no extra API call is needed here.
  const onSelectDepartment = async (dept) => {
    userSay(dept.departmentName);
    setBooking((b) => ({ ...b, department: dept }));
    try {
      const docs = api.fetchDoctorsByDepartment(dept);
      setDoctors(docs);
      if (!docs || docs.length === 0) {
        await botSay(`Sorry, no doctors are available in ${dept.departmentName} right now. Please pick another department.`);
        return;
      }
      await botSay(`Great choice! Here are the available doctors in ${dept.departmentName}:`);
      setStep(STEP.SELECT_DOCTOR);
    } catch (e) {
      await botSay(`Failed to load doctors. ${e.message}`);
    }
  };

  // STEP 3: load available slots for chosen doctor
  // fetchDoctorAvailability returns a DoctorAvailability object with a
  // pre-flattened `availableSlots` (non-booked only). Defaults to today.
  const onSelectDoctor = async (doc) => {
    userSay(doc.doctorName);
    setBooking((b) => ({ ...b, doctor: doc }));
    try {
      setLoading(true);
      const availability = await api.fetchDoctorAvailability(doc.doctorId);
      const sl = availability?.availableSlots ?? [];
      setSlots(sl);
      if (sl.length === 0) {
        // No slots — clear the doctor/department selection and take the user
        // back to the department picker so they can start the journey again.
        setBooking((b) => ({ ...b, doctor: null, department: null }));
        setDoctors([]);
        await botSay(`Sorry, ${doc.doctorName} has no available slots right now.`);
        await botSay('Please select another department to continue:', 400);
        setStep(STEP.SELECT_DEPARTMENT);
        return;
      }
      await botSay(`Here are the available time slots for ${doc.doctorName}:`);
      setStep(STEP.SELECT_SLOT);
    } catch (e) {
      await botSay(`Failed to check availability. ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  // STEP 4: slot selected → ask mobile
  const onSelectSlot = async (slot) => {
    userSay(`${slot.date} · ${slot.startTime}`);
    setBooking((b) => ({ ...b, slot }));
    await botSay('Perfect! Now I need some patient details to confirm your booking.');
    await botSay('Please enter your 10-digit mobile number:', 400);
    setStep(STEP.ASK_MOBILE);
  };

  // STEP 5: mobile entered → check existing patients
  const onSubmitMobile = async (mobile) => {
    userSay(mobile);
    setBooking((b) => ({ ...b, mobile }));
    try {
      setLoading(true);
      const result = await api.lookupPatientsByMobile(mobile);
      if (result.exists && result.patients.length > 0) {
        setExistingPatients(result.patients);
        await botSay(`I found ${result.patients.length} patient(s) registered with this number. Please select one or add a new patient:`);
        setStep(STEP.SELECT_EXISTING_PATIENT);
      } else {
        await botSay("This is a new number. Let's create your patient profile.");
        await botSay('What is your first name?', 400);
        setStep(STEP.ASK_FIRST_NAME);
        setBooking((b) => ({ ...b, isNewPatient: true }));
      }
    } catch (e) {
      await botSay(`Couldn't look up the number. ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const onSelectExistingPatient = async (patient) => {
    userSay(`${patient.firstName} ${patient.lastName}`);
    setBooking((b) => ({
      ...b,
      patient,
      firstName: patient.firstName,
      lastName: patient.lastName,
      gender: patient.gender,
      dob: patient.dob,
    }));
    // Existing patient → honour their follow-up eligibility for procedure filtering
    await loadProcedures(booking.slot.sessionId, {
      followupEligible: !!patient.followupEligible,
    });
  };

  const onAddNewPatient = async () => {
    userSay('Add new patient');
    setBooking((b) => ({ ...b, isNewPatient: true }));
    await botSay('Sure! What is your first name?');
    setStep(STEP.ASK_FIRST_NAME);
  };

  const onSubmitFirstName = async (firstName) => {
    userSay(firstName);
    setBooking((b) => ({ ...b, firstName }));
    await botSay('And your last name?');
    setStep(STEP.ASK_LAST_NAME);
  };

  const onSubmitLastName = async (lastName) => {
    userSay(lastName);
    setBooking((b) => ({ ...b, lastName }));
    await botSay('Please select your gender:');
    setStep(STEP.ASK_GENDER);
  };

  const onSubmitGender = async (gender) => {
    userSay(gender);
    setBooking((b) => ({ ...b, gender }));
    await botSay('Lastly, what is your date of birth?');
    setStep(STEP.ASK_DOB);
  };

  const onSubmitDOB = async (dob) => {
    userSay(formatDate(dob));
    setBooking((b) => ({ ...b, dob }));
    // New patients are never follow-up eligible — hide OPREVISIT procedures.
    await loadProcedures(booking.slot.sessionId, { followupEligible: false });
  };

  // STEP 6: load procedures for the chosen session and filter by
  // the patient's follow-up eligibility.
  const loadProcedures = async (sessionId, { followupEligible = false } = {}) => {
    try {
      setLoading(true);
      const procs = await api.fetchProcedures(sessionId);
      const visible = filterProceduresForPatient(procs, { followupEligible });
      setProcedures(visible);
      if (visible.length === 0) {
        await botSay("Sorry, no procedures are currently available for this session.");
        return;
      }
      await botSay("Almost done! Please select the type of procedure:");
      setStep(STEP.SELECT_PROCEDURE);
    } catch (e) {
      await botSay(`Failed to load procedures. ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const onSelectProcedure = async (procedure) => {
    userSay(procedure.procedureName);
    setBooking((b) => ({ ...b, procedure }));
    await botSay("Let me review your booking details...");
    setStep(STEP.CONFIRM_BOOKING);
  };

  // STEP 7: final booking
  // The booking API handles both patient creation (when there's no existing
  // record) and the appointment in a single call — we just hand it the
  // collected booking state and let it construct the wire payload.
  const onConfirmBooking = async () => {
    try {
      setLoading(true);
      const result = await api.bookAppointment(booking);
      setAppointment(result);
      setStep(STEP.BOOKED);
      await botSay("🎉 Your appointment has been booked successfully!");
    } catch (e) {
      await botSay(`Booking failed. ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  // ----------------- Reset & Start -----------------
  const startConversation = useCallback(async () => {
    setMessages([]);
    setBooking({
      department: null, doctor: null, slot: null, procedure: null,
      mobile: null, patient: null, isNewPatient: false,
      firstName: null, lastName: null, gender: null, dob: null,
    });
    setAppointment(null);
    await botSay("👋 Hello! I'm your Qurix Healthcare Assistant.");
    await botSay("I can help you book an appointment with our doctors in just a few steps.", 800);
    await loadDepartments();
  }, [botSay, loadDepartments]);

  useEffect(() => {
    startConversation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ----------------- Render the active step UI -----------------
  const renderStepUI = () => {
    if (loading || isTyping) return null;

    switch (step) {
      case STEP.SELECT_DEPARTMENT:
        return (
          <OptionList
            options={departments.map((d) => ({
              id: d.departmentId,
              title: d.departmentName,
              icon: d.icon || 'medkit',
            }))}
            onSelect={(opt) => onSelectDepartment(departments.find((d) => d.departmentId === opt.id))}
            columns={2}
          />
        );

      case STEP.SELECT_DOCTOR:
        return (
          <OptionList
            options={doctors.map((d) => ({
              id: d.doctorId,
              title: d.doctorName,
              subtitle: d.qualification,
              meta: d.experience ? `${d.experience} experience` : null,
              icon: 'person',
            }))}
            onSelect={(opt) => onSelectDoctor(doctors.find((d) => d.doctorId === opt.id))}
          />
        );

      case STEP.SELECT_SLOT:
        return (
          <OptionList
            options={slots.map((s) => ({
              id: s.slotId,
              title: s.startTime,
              subtitle: s.date,
              icon: 'time',
            }))}
            onSelect={(opt) => onSelectSlot(slots.find((s) => s.slotId === opt.id))}
            columns={3}
          />
        );

      case STEP.ASK_MOBILE:
        return (
          <ChatInput
            placeholder="10-digit mobile number"
            keyboardType="phone-pad"
            maxLength={10}
            prefix="+91"
            validate={validateMobile}
            onSubmit={onSubmitMobile}
          />
        );

      case STEP.SELECT_EXISTING_PATIENT:
        return (
          <View>
            <OptionList
              options={existingPatients.map((p) => ({
                id: p.patientId,
                title: `${p.firstName} ${p.lastName}`,
                subtitle: `${p.gender} · DOB ${formatDate(p.dob)}`,
                icon: 'person-circle',
              }))}
              onSelect={(opt) =>
                onSelectExistingPatient(existingPatients.find((p) => p.patientId === opt.id))
              }
            />
            <TouchableOpacity style={styles.addNewBtn} onPress={onAddNewPatient}>
              <Ionicons name="add-circle-outline" size={18} color={COLORS.primary} />
              <Text style={styles.addNewText}>Add new patient</Text>
            </TouchableOpacity>
          </View>
        );

      case STEP.ASK_FIRST_NAME:
        return (
          <ChatInput
            placeholder="First name"
            validate={(v) => validateName(v, 'First name')}
            onSubmit={onSubmitFirstName}
          />
        );

      case STEP.ASK_LAST_NAME:
        return (
          <ChatInput
            placeholder="Last name"
            validate={(v) => validateName(v, 'Last name')}
            onSubmit={onSubmitLastName}
          />
        );

      case STEP.ASK_GENDER:
        return (
          <OptionList
            options={[
              { id: 'Male', title: 'Male' },
              { id: 'Female', title: 'Female' },
              { id: 'Other', title: 'Other' },
            ]}
            onSelect={(opt) => onSubmitGender(opt.id)}
            variant="pill"
          />
        );

      case STEP.ASK_DOB:
        return <DOBPicker onSubmit={onSubmitDOB} />;

      case STEP.SELECT_PROCEDURE:
        return (
          <OptionList
            options={procedures.map((p) => {
              const isFree = p.followUp || (p.price ?? 0) === 0;
              const icon = p.virtual ? 'videocam' : isFree ? 'gift' : 'cash';
              return {
                id: p.procedureId,
                title: p.procedureName,
                subtitle: isFree ? 'No charge' : `₹${p.price}`,
                meta: p.duration ? `${p.duration} min` : null,
                icon,
              };
            })}
            onSelect={(opt) => onSelectProcedure(procedures.find((p) => p.procedureId === opt.id))}
          />
        );

      case STEP.CONFIRM_BOOKING:
        return (
          <View style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>Confirm your booking</Text>
            <SummaryRow label="Department" value={booking.department?.departmentName} />
            <SummaryRow label="Doctor" value={booking.doctor?.doctorName} />
            <SummaryRow label="Date & Time" value={`${booking.slot?.date} · ${booking.slot?.startTime}`} />
            <SummaryRow label="Procedure" value={booking.procedure?.procedureName} />
            <SummaryRow label="Patient" value={`${booking.firstName} ${booking.lastName}`} />
            <SummaryRow label="Mobile" value={`+91 ${booking.mobile}`} />

            <View style={styles.confirmRow}>
              <TouchableOpacity style={styles.cancelBtn} onPress={startConversation}>
                <Text style={styles.cancelText}>Start Over</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.confirmBtn} onPress={onConfirmBooking}>
                <Ionicons name="checkmark-circle" size={18} color={COLORS.white} />
                <Text style={styles.confirmText}>Book Appointment</Text>
              </TouchableOpacity>
            </View>
          </View>
        );

      case STEP.BOOKED:
        return (
          <BookingConfirmation
            appointment={appointment}
            summary={{
              departmentName: booking.department.departmentName,
              doctorName: booking.doctor.doctorName,
              date: booking.slot.date,
              time: booking.slot.startTime,
              procedureName: booking.procedure.procedureName,
              patientName: `${booking.firstName} ${booking.lastName}`,
            }}
            onNewBooking={startConversation}
          />
        );

      default:
        return null;
    }
  };

  // ----------------- Layout -----------------
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
          {messages.map((m) => (
            <ChatMessage key={m.id} sender={m.sender} message={m.text} timestamp={m.timestamp} />
          ))}
          {isTyping && <TypingIndicator />}
          {loading && (
            <View style={styles.loadingRow}>
              <ActivityIndicator color={COLORS.primary} />
              <Text style={styles.loadingText}>Please wait...</Text>
            </View>
          )}
          {renderStepUI()}
          <View style={{ height: 20 }} />
        </ScrollView>
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

  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  loadingText: {
    color: COLORS.textSecondary,
    fontSize: SIZES.small,
    marginLeft: 8,
  },

  addNewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: SIZES.radius,
    borderWidth: 1.5,
    borderColor: COLORS.primary,
    borderStyle: 'dashed',
  },
  addNewText: {
    color: COLORS.primary,
    fontWeight: '600',
    marginLeft: 6,
    fontSize: SIZES.medium,
  },

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
});

export default ChatBot;
