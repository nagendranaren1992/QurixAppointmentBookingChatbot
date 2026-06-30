// API Service Layer
// Replace BASE_URL with your actual Qurix API base URL
// All endpoints are configurable below — change the paths to match your real API.

import {
  mapDepartmentsResponse,
  getDoctorsByDepartmentId,
} from '../models/department';
import { mapDoctorAvailability } from '../models/sessionInstance';
import { mapPatientLookupResponse } from '../models/patient';
import { mapProceduresResponse } from '../models/procedure';

const BASE_URL = 'https://preprod.qurix.io/preprodhims/openapi'; // <-- REPLACE WITH YOUR API BASE URL

// Optional auth token (set after login if your API requires it)
let AUTH_TOKEN = null;
export const setAuthToken = (token) => { AUTH_TOKEN = token; };

// Generic request helper with timeout + JSON handling
const request = async (path, options = {}) => {
  const url = `${BASE_URL}${path}`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 20000); // 20s timeout

  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...(AUTH_TOKEN ? { Authorization: `Bearer ${AUTH_TOKEN}` } : {}),
        ...(options.headers || {}),
      },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    const contentType = response.headers.get('content-type') || '';
    const data = contentType.includes('application/json')
      ? await response.json()
      : await response.text();

    if (!response.ok) {
      const message = (data && data.message) || `Request failed: ${response.status}`;
      const err = new Error(message);
      err.status = response.status;
      err.body = data;
      throw err;
    }
    return data;
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') throw new Error('Request timed out. Please try again.');
    throw err;
  }
};

// ============================================================
// STEP 1: Get departments (with nested doctors)
// Returns Department[] — see src/models/department.js
// ============================================================
// TODO: make locationId dynamic (from user/session/config) instead of hardcoded
const DEFAULT_LOCATION_ID = 'f4772b25-f18b-4b94-8726-918695956a7f';

export const fetchDepartments = async ({
  locationId = DEFAULT_LOCATION_ID,
  requiredNextAvailableSlot = false,
} = {}) => {
  const raw = await request('/listOfAllSessionsDoctors', {
    method: 'POST',
    body: JSON.stringify({ locationId, requiredNextAvailableSlot }),
  });
  return mapDepartmentsResponse(raw);
};

// ============================================================
// STEP 1b: Get doctors for a department
// No separate API call — doctors are embedded in the departments
// response from STEP 1. Pass either the Department object or a
// (departments, departmentId) pair.
// ============================================================
export const fetchDoctorsByDepartment = (departmentOrList, departmentId) => {
  // Form 1: passed a Department object directly → return its doctors
  if (departmentOrList && Array.isArray(departmentOrList.doctors)) {
    return departmentOrList.doctors;
  }
  // Form 2: passed (departments[], departmentId) → look it up
  return getDoctorsByDepartmentId(departmentOrList, departmentId);
};

// ============================================================
// STEP 2: Check available time slots/instances for a doctor
// POST /sessioninstances
// Body: { doctorId, locationId, dates: ["YYYY-MM-DD", ...] }
// ============================================================
const toYMD = (d) => {
  const dt = d instanceof Date ? d : new Date(d);
  const yyyy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const dd = String(dt.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

export const fetchDoctorAvailability = async (
  doctorId,
  {
    dates,
    locationId = DEFAULT_LOCATION_ID,
  } = {}
) => {
  const payload = {
    doctorId: doctorId ?? null,
    locationId,
    dates: Array.isArray(dates) && dates.length > 0
      ? dates.map(toYMD)
      : [toYMD(new Date())],
  };
  const raw = await request('/sessioninstances', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  // TODO: remove after slot rendering is verified
  // eslint-disable-next-line no-console
  console.log('[fetchDoctorAvailability] payload:', payload, 'raw response:', raw);
  const mapped = mapDoctorAvailability(raw);
  // eslint-disable-next-line no-console
  console.log('[fetchDoctorAvailability] mapped:', mapped);
  return mapped;
};

// ============================================================
// STEP 3: Get procedures for a session
// POST /listOfDoctorWiseProceduresV2
// Body: { sessionId, locationId }
// Returns Procedure[] — see src/models/procedure.js
// ============================================================
export const fetchProcedures = async (
  sessionId,
  { locationId = DEFAULT_LOCATION_ID } = {}
) => {
  const payload = {
    sessionId: sessionId ?? null,
    locationId,
  };
  const raw = await request('/listOfDoctorWiseProceduresV2', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return mapProceduresResponse(raw);
};

// ============================================================
// STEP 4: Lookup patients by mobile number
// GET /patients?mobileNo=...&orgId=...&isActive=...&locids=...
// Returns { exists, patients[] } — see src/models/patient.js
// ============================================================
// TODO: make orgId / locIds / isActive dynamic (from user/session/config)
const DEFAULT_ORG_ID = '788';
const DEFAULT_LOC_IDS = '1407';
const DEFAULT_IS_ACTIVE = false;

export const lookupPatientsByMobile = async (
  mobile,
  {
    orgId = DEFAULT_ORG_ID,
    locIds = DEFAULT_LOC_IDS,
    isActive = DEFAULT_IS_ACTIVE,
  } = {}
) => {
  const qs = new URLSearchParams({
    mobileNo: String(mobile ?? ''),
    orgId: String(orgId),
    isActive: String(isActive),
    locids: String(locIds),
  }).toString();

  try {
    const raw = await request(`/patients?${qs}`, { method: 'GET' });
    return mapPatientLookupResponse(raw);
  } catch (e) {
    // 404 / "not found" simply means no patient exists with this mobile —
    // surface that as an empty lookup result so the chatbot can take the
    // "new patient" path instead of showing an error.
    if (e?.status === 404) {
      return { exists: false, patients: [] };
    }
    throw e;
  }
};

// ============================================================
// STEP 5: Book the appointment (also creates the patient if new)
// POST /createPatientAppointment/other/
//
// There is no separate patient-creation endpoint — this single call
// handles both new and returning patients. For existing patients we
// forward their `masterIdentifierId` so the backend can link the
// appointment to the existing record.
// ============================================================
const BOOKING_DEFAULTS = {
  bookedType: 'Online',
  slotType: 'Online',
  channelType: 3,
  appointmentBookedRole: 'Admin',
};

// "1990-06-30" or Date → "1990-06-30 HH:mm:ss"
const formatDobForApi = (dob) => {
  if (!dob) return '';
  if (typeof dob === 'string' && /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(dob)) {
    return dob;
  }
  const d = dob instanceof Date ? dob : new Date(dob);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ` +
         `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
};

const deriveTitle = (gender) => {
  if (gender === 'Female') return 'Ms.';
  if (gender === 'Male') return 'Mr.';
  return 'Mx.';
};

/**
 * Build the `/createPatientAppointment/other/` wire payload from the
 * chatbot's collected booking state. Keeps the request shape contained
 * in one place so call sites just hand over the booking object.
 *
 * @param {Object} booking  expected fields: { doctor, slot, procedure, patient?, mobile, firstName, lastName, gender, dob, title? }
 * @param {Object} [opts]   { locationId, orgId }
 */
const buildBookingRequest = (
  booking = {},
  {
    locationId = DEFAULT_LOCATION_ID,
    orgId = DEFAULT_ORG_ID,
  } = {}
) => {
  const {
    doctor = {},
    slot = {},
    procedure = {},
    patient = null,
  } = booking;

  // Prefer fields entered in the chat; fall back to the existing patient record.
  const firstName = booking.firstName ?? patient?.firstName ?? '';
  const lastName = booking.lastName ?? patient?.lastName ?? '';
  const gender = booking.gender ?? patient?.gender ?? '';
  const dob = booking.dob ?? patient?.dob ?? '';
  const mobile = booking.mobile ?? patient?.mobile ?? '';
  const title = booking.title ?? patient?.title ?? deriveTitle(gender);

  return {
    patient: {
      orgId: Number(orgId) || 0,
      identifierId: patient?.masterIdentifierId ?? null,
      firstName,
      lastName,
      title,
      dob: formatDobForApi(dob),
      gender,
      contacts: [
        {
          typeOfContract: 'mobile',
          value: String(mobile ?? ''),
          position: 1,
        },
      ],
    },
    identifiers: {
      use: null,
      type: null,
      value: null,
    },
    appointment: {
      slotId: slot.slotId ?? null,
      doctorId: doctor.doctorId ?? null,
      bookedType: BOOKING_DEFAULTS.bookedType,
      pincode: null,
      occupation: null,
      refferal: null,
      notes: null,
      emergency: false,
      walkin: false,
      slotType: BOOKING_DEFAULTS.slotType,
      walkinDate: slot.sessionDate ?? '',
      walkinTimeSlot: slot.timeSlot ?? '',
      walkinSessionId: slot.sessionInstanceId ?? slot.sessionId ?? null,
      channelType: BOOKING_DEFAULTS.channelType,
      locationId,
      procedureId: procedure.procedureId ?? procedure.id ?? null,
      appointmentBookedRole: BOOKING_DEFAULTS.appointmentBookedRole,
      remarks: null,
    },
  };
};

export const bookAppointment = async (booking, options = {}) => {
  const body = buildBookingRequest(booking, options);
  return request('/createPatientAppointment/other/', {
    method: 'POST',
    body: JSON.stringify(body),
  });
};

// ============================================================
// MOCK MODE — set USE_MOCK to true to test the UI without backend
// ============================================================
export const USE_MOCK = false;

const mockDoctor = (id, name, qualification) => ({
  doctorId: id,
  doctorName: name,
  doctorProfilePic: null,
  qualification,
  empTags: null,
  status: null,
  roomNum: null,
  employeeNote: null,
  expiryDate: null,
  nearBySessionDate: null,
  activeSessionId: 0,
  doctorAllProcedureDtos: null,
  days: null,
  sessionInstanceTimeDtos: null,
  opValidDays: 7,
  followupCount: 1,
  userId: null,
  docSignature: null,
  dmo: false,
  primaryPrivilige: false,
  active: true,
});

const mockDepartmentsRaw = {
  departments: [
    {
      departmentId: 2306,
      departmentName: 'Nephrology',
      doctors: [
        mockDoctor('d5b9e3d8-9140-4bbb-b2e0-2bd5332f5ac5', 'Dr. Rahul Patibandla', 'MD, DM'),
      ],
    },
    {
      departmentId: 2307,
      departmentName: 'Cardiology',
      doctors: [
        mockDoctor('doc-card-1', 'Dr. Anjali Sharma', 'MD, DM'),
        mockDoctor('doc-card-2', 'Dr. Ravi Kumar', 'MBBS, MS'),
      ],
    },
    {
      departmentId: 2308,
      departmentName: 'Pediatrics',
      doctors: [
        mockDoctor('doc-ped-1', 'Dr. Priya Verma', 'MD'),
      ],
    },
  ],
};

export const mockApi = {
  fetchDepartments: () =>
    Promise.resolve(mapDepartmentsResponse(mockDepartmentsRaw)),
  fetchDoctorsByDepartment: (departmentOrList, departmentId) => {
    if (departmentOrList && Array.isArray(departmentOrList.doctors)) {
      return departmentOrList.doctors;
    }
    return getDoctorsByDepartmentId(departmentOrList, departmentId);
  },
  fetchDoctorAvailability: (doctorId) => {
    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const mockRaw = {
      doctId: doctorId ?? 'mock-doc',
      locUuid: DEFAULT_LOCATION_ID,
      locName: 'Kukatpally',
      doctName: 'Dr. Mock',
      doctDepartmentId: 0,
      doctDepartmentName: 'Mock',
      doctProfilePicture: null,
      displayName: 'Mock',
      locId: 0,
      sessionInstances: [
        {
          sessionInstanceId: 548963,
          version: 0,
          sessionDate: `${today} 00:00:00`,
          sessionFromTime: `${today} 09:00:00`,
          sessionToTime: `${today} 12:00:00`,
          duration: 0,
          active: true,
          sessionInstanceStatusId: 1,
          sessionId: 0,
          listOfTimes: [
            { slotId: 1, timeSlot: '09:15:00', sessionId: 548963, channelType: null, slotType: 2, booked: false },
            { slotId: 2, timeSlot: '09:30:00', sessionId: 548963, channelType: null, slotType: 2, booked: false },
            { slotId: 3, timeSlot: '10:00:00', sessionId: 548963, channelType: null, slotType: 2, booked: false },
            { slotId: 4, timeSlot: '11:30:00', sessionId: 548963, channelType: null, slotType: 2, booked: false },
            { slotId: 5, timeSlot: '14:00:00', sessionId: 548963, channelType: null, slotType: 2, booked: false },
            { slotId: 6, timeSlot: '16:30:00', sessionId: 548963, channelType: null, slotType: 2, booked: false },
          ],
        },
      ],
    };
    return Promise.resolve(mapDoctorAvailability(mockRaw));
  },
  fetchProcedures: (sessionId) => {
    const mockRaw = [
      {
        id: 2194,
        procedureName: 'Consultation',
        price: 1000,
        duration: 10,
        serviceId: 1,
        serviceCode: 'OPCONS',
        active: true,
        appointment_open: true,
        virtual: false,
        followUp: false,
        serviceDtos: [
          { serviceHeaderId: 24392, serviceHeaderName: 'OP Consultation', price: 1000 },
        ],
      },
      {
        id: 2195,
        procedureName: 'Follow-up Visit',
        price: 0,
        duration: 10,
        serviceId: 2,
        serviceCode: 'OPREVISIT',
        active: true,
        appointment_open: true,
        virtual: false,
        followUp: true,
        serviceDtos: [],
      },
      {
        id: 2196,
        procedureName: 'Video Consultation',
        price: 800,
        duration: 15,
        serviceId: 3,
        serviceCode: 'OPVIDEO',
        active: true,
        appointment_open: true,
        virtual: true,
        followUp: false,
        serviceDtos: [],
      },
    ];
    return Promise.resolve(mapProceduresResponse(mockRaw));
  },
  lookupPatientsByMobile: (mobile) => {
    // Pretend mobile ending in 0 has an existing patient record.
    if ((mobile || '').endsWith('0')) {
      const mockRaw = {
        title: 'Mr.',
        uhid: 'UHID2501006887',
        mobile,
        firstName: 'Viswa',
        lastName: 'Nath',
        uuid: '8a808095943a8a8d01943f490e0e0023',
        gender: 'Male',
        dob: '1995-01-07',
        previousEpisodeId: null,
        previousEpiosdeStatus: null,
        previousPractitioner: null,
        previousEpisodeType: null,
        previousAdmittingDoctor: null,
        followupEligible: false,
        lastVisitedDate: null,
        noofDaysAvailable: 0,
        noofVisitsAvailable: 0,
        years: 31,
        months: 5,
        days: 23,
        masterIdentifierId: '5a1e9082-f7af-42ce-927e-85dcdd3fe959',
        identifiers: null,
        paymentStatus: null,
        previousPractitionerDeptId: 0,
      };
      return Promise.resolve(mapPatientLookupResponse(mockRaw));
    }
    return Promise.resolve(mapPatientLookupResponse(null));
  },
  bookAppointment: (booking) => Promise.resolve({
    appointmentId: 'APT' + Math.floor(Math.random() * 1000000),
    status: 'confirmed',
    doctorId: booking?.doctor?.doctorId,
    slotId: booking?.slot?.slotId,
    procedureId: booking?.procedure?.procedureId,
  }),
};

// API surface — automatically uses mock when USE_MOCK is true
export const api = USE_MOCK ? mockApi : {
  fetchDepartments,
  fetchDoctorsByDepartment,
  fetchDoctorAvailability,
  fetchProcedures,
  lookupPatientsByMobile,
  bookAppointment,
};

export default api;
