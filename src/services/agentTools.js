// =================================================================
// Tool schema + handlers for the Qurix booking agent.
//
// Each tool:
//   1. Has an OpenAI function-calling schema in TOOL_SCHEMA.
//   2. Has a handler in `callTool` that wraps existing api.js functions.
//
// Handlers receive a shared `ctx` object so they can:
//   - Cache departments once per conversation.
//   - Resolve the `request_booking` promise after the user taps Confirm
//     in the UI (the UI provides ctx.confirmBooking).
//
// Handlers return PLAIN JSON-serializable objects. Strings and numbers
// in those results become part of the LLM's context, so we trim them
// to just what's useful for selecting / booking.
// =================================================================

import api from './api';
import { filterProceduresForPatient } from '../models/procedure';

// ---------- schema sent to OpenAI ----------

export const TOOL_SCHEMA = [
  {
    type: 'function',
    function: {
      name: 'search_doctors',
      description:
        'Search for doctors by department name or doctor name. ' +
        'Returns all matching doctors with their department. ' +
        'Use an empty query to list every doctor.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description:
              'Keyword to search against doctor name OR department name ' +
              '(e.g., "cardio", "pediatric", "Kishore"). Empty = all doctors.',
          },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_doctor_availability',
      description:
        'Get the doctor\'s available time slots for the given date(s). ' +
        'Defaults to today if no dates are provided.',
      parameters: {
        type: 'object',
        properties: {
          doctorId: {
            type: 'string',
            description: 'The doctorId returned by search_doctors.',
          },
          dates: {
            type: 'array',
            items: { type: 'string', description: 'Date in YYYY-MM-DD form' },
            description:
              'Optional list of dates. Each must be YYYY-MM-DD. ' +
              'Omit or empty to default to today.',
          },
        },
        required: ['doctorId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'lookup_patient',
      description:
        'Look up an existing patient record by their 10-digit mobile number. ' +
        'Returns {exists:true, ...patient details} or {exists:false}.',
      parameters: {
        type: 'object',
        properties: {
          mobile: {
            type: 'string',
            description: '10-digit Indian mobile number, digits only.',
          },
        },
        required: ['mobile'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_procedures',
      description:
        'List procedures (consultation types) available for the chosen ' +
        'session/slot. Pass followupEligible=true ONLY when the patient ' +
        'lookup returned followupEligible=true.',
      parameters: {
        type: 'object',
        properties: {
          sessionInstanceId: {
            type: 'number',
            description:
              'The sessionInstanceId of the chosen slot (NOT the slotId).',
          },
          followupEligible: {
            type: 'boolean',
            description:
              'Set true only for existing patients with followupEligible=true.',
          },
        },
        required: ['sessionInstanceId', 'followupEligible'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'request_booking',
      description:
        'Show a confirmation card to the user with the gathered booking ' +
        'details. The user will tap Confirm or Cancel. Returns ' +
        '{confirmed:true, appointmentId} on confirm or {confirmed:false} ' +
        'on cancel. NEVER call without all fields populated with real values.',
      parameters: {
        type: 'object',
        properties: {
          doctorId: { type: 'string' },
          doctorName: { type: 'string' },
          slotId: { type: 'number' },
          sessionInstanceId: { type: 'number' },
          sessionId: { type: 'number' },
          sessionDate: { type: 'string', description: 'YYYY-MM-DD' },
          timeSlot:   { type: 'string', description: 'HH:mm:ss (24h)' },
          displayTime: { type: 'string', description: 'Friendly time, e.g. "9:15 AM"' },
          procedureId: { type: 'number' },
          procedureName: { type: 'string' },
          procedurePrice: { type: 'number' },
          mobile: { type: 'string' },
          firstName: { type: 'string' },
          lastName: { type: 'string' },
          gender: { type: 'string', enum: ['Male', 'Female', 'Other'] },
          dob: { type: 'string', description: 'YYYY-MM-DD' },
          title: { type: 'string', description: 'Mr./Ms./Mx. — optional' },
          existingPatientUuid: { type: 'string', description: 'Pass when booking for an existing patient' },
          masterIdentifierId: { type: 'string', description: 'Pass when booking for an existing patient' },
        },
        required: [
          'doctorId', 'doctorName', 'slotId', 'sessionInstanceId',
          'sessionDate', 'timeSlot', 'procedureId', 'procedureName',
          'mobile', 'firstName', 'lastName', 'gender', 'dob',
        ],
      },
    },
  },
];

// ---------- handlers ----------

// Strip "Dr." prefix + standalone "dr" tokens + extra whitespace.
const normalizeName = (s) =>
  (s || '')
    .toLowerCase()
    .replace(/\bdr\.?\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();

// Letters + digits only — collapses spaces and punctuation away.
const compactify = (s) => normalizeName(s).replace(/[^a-z0-9]/g, '');

/**
 * Tolerant text match used by search_doctors. Handles:
 *   - "Dr." prefix on either side
 *   - Missing / extra whitespace ("kishore reddy" vs "kishorereddy")
 *   - Middle initials ("Kishore B Reddy" vs "Kishorereddy")
 *   - Punctuation / case differences
 */
const isFuzzyMatch = (haystack, needle) => {
  const n = compactify(needle);
  if (!n) return true; // empty query matches everything
  const h = compactify(haystack);
  if (!h) return false;

  // Direct substring either direction handles most cases.
  if (h.includes(n) || n.includes(h)) return true;

  // Token-level match — every main token (>=3 chars) of one side must
  // appear in the compact form of the other. Skips middle initials.
  const tokensOf = (s) =>
    normalizeName(s)
      .split(/\s+/)
      .filter((t) => t.length >= 3);

  const hTokens = tokensOf(haystack);
  const nTokens = tokensOf(needle);

  if (nTokens.length && nTokens.every((t) => h.includes(t))) return true;
  if (hTokens.length && hTokens.every((t) => n.includes(t))) return true;

  return false;
};

const searchDoctors = async ({ query = '' }, ctx) => {
  if (!ctx.departmentsCache) {
    ctx.departmentsCache = await api.fetchDepartments();
  }
  const q = (query || '').trim();
  const out = [];
  for (const dept of ctx.departmentsCache) {
    const deptMatch = q === '' || isFuzzyMatch(dept.departmentName, q);
    for (const doc of dept.doctors || []) {
      const docMatch = q === '' || isFuzzyMatch(doc.doctorName, q);
      if (deptMatch || docMatch) {
        out.push({
          doctorId: doc.doctorId,
          doctorName: doc.doctorName,
          qualification: doc.qualification,
          department: dept.departmentName,
          departmentId: dept.departmentId,
        });
      }
    }
  }
  return { count: out.length, doctors: out };
};

const getDoctorAvailability = async ({ doctorId, dates }, _ctx) => {
  const result = await api.fetchDoctorAvailability(doctorId, { dates });
  return {
    doctorName: result.doctorName,
    sessionInstances: result.sessionInstances.map((si) => ({
      sessionInstanceId: si.sessionInstanceId,
      sessionId: si.sessionId,
      sessionDate: si.sessionDate,
      displayDate: si.displayDate,
      displayFromTime: si.displayFromTime,
      displayToTime: si.displayToTime,
      slotCount: si.slots.length,
    })),
    availableSlots: result.availableSlots.map((s) => ({
      slotId: s.slotId,
      sessionInstanceId: s.sessionInstanceId,
      sessionId: s.sessionId,
      sessionDate: s.sessionDate,
      timeSlot: s.timeSlot,
      displayTime: s.startTime,
      displayDate: s.date,
    })),
  };
};

const lookupPatient = async ({ mobile }, _ctx) => {
  const result = await api.lookupPatientsByMobile(mobile);
  if (!result.exists || result.patients.length === 0) {
    return { exists: false };
  }
  const p = result.patients[0];
  return {
    exists: true,
    uuid: p.uuid,
    masterIdentifierId: p.masterIdentifierId,
    title: p.title,
    firstName: p.firstName,
    lastName: p.lastName,
    fullName: p.fullName,
    mobile: p.mobile,
    gender: p.gender,
    dob: p.dob,
    age: p.age,
    followupEligible: p.followupEligible,
  };
};

const listProcedures = async ({ sessionInstanceId, followupEligible }, _ctx) => {
  const procs = await api.fetchProcedures(sessionInstanceId);
  const visible = filterProceduresForPatient(procs, {
    followupEligible: !!followupEligible,
  });
  return {
    count: visible.length,
    procedures: visible.map((p) => ({
      procedureId: p.procedureId,
      procedureName: p.procedureName,
      price: p.price,
      duration: p.duration,
      isFree: p.followUp || (p.price ?? 0) === 0,
      isVirtual: p.virtual,
      serviceCode: p.serviceCode,
    })),
  };
};

const requestBooking = async (params, ctx) => {
  // The UI provides this — it shows a confirmation card and resolves
  // the returned promise after the user taps Confirm or Cancel.
  if (typeof ctx.confirmBooking !== 'function') {
    throw new Error('UI did not register a confirmBooking handler.');
  }
  return ctx.confirmBooking(params);
};

// ---------- dispatcher ----------

export const callTool = async (name, args, ctx) => {
  switch (name) {
    case 'search_doctors':          return searchDoctors(args || {}, ctx);
    case 'get_doctor_availability': return getDoctorAvailability(args || {}, ctx);
    case 'lookup_patient':          return lookupPatient(args || {}, ctx);
    case 'list_procedures':         return listProcedures(args || {}, ctx);
    case 'request_booking':         return requestBooking(args || {}, ctx);
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
};

// ---------- helpers for the UI ----------

/**
 * Given the tool name and the (parsed JSON) result, decide what
 * inline UI widget the chat should render. Returns null when no
 * widget applies (e.g., lookup_patient — bot just continues talking).
 */
export const widgetFromToolResult = (name, result) => {
  if (!result) return null;
  switch (name) {
    case 'search_doctors':
      if ((result.doctors || []).length === 0) return null;
      return { kind: 'doctors', items: result.doctors };
    case 'get_doctor_availability':
      if ((result.availableSlots || []).length === 0) return null;
      return { kind: 'slots', items: result.availableSlots };
    case 'list_procedures':
      if ((result.procedures || []).length === 0) return null;
      return { kind: 'procedures', items: result.procedures };
    default:
      return null;
  }
};
