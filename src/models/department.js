// =================================================================
// Department / Doctor models
//
// Mirrors the raw response from `POST /listOfAllSessionsDoctors`:
// {
//   "departments": [
//     { departmentId, departmentName, doctors: [ { doctorId, ... } ] }
//   ]
// }
//
// Use the `map*` helpers to normalize raw API payloads into stable,
// app-facing objects with safe defaults.
// =================================================================

/**
 * @typedef {Object} Doctor
 * @property {string} doctorId
 * @property {string} doctorName
 * @property {string|null} doctorProfilePic
 * @property {string|null} qualification
 * @property {string|null} empTags
 * @property {string|null} status
 * @property {string|null} roomNum
 * @property {string|null} employeeNote
 * @property {string|null} expiryDate
 * @property {string|null} nearBySessionDate
 * @property {number}      activeSessionId
 * @property {Array|null}  doctorAllProcedureDtos
 * @property {Array|null}  days
 * @property {Array|null}  sessionInstanceTimeDtos
 * @property {number}      opValidDays
 * @property {number}      followupCount
 * @property {string|null} userId
 * @property {string|null} docSignature
 * @property {boolean}     dmo
 * @property {boolean}     primaryPrivilige
 * @property {boolean}     active
 */

/**
 * @typedef {Object} Department
 * @property {number}   departmentId
 * @property {string}   departmentName
 * @property {Doctor[]} doctors
 */

/**
 * @typedef {Object} DepartmentsResponse
 * @property {Department[]} departments
 */

/**
 * Normalize a single raw doctor object from the API.
 * @param {Object} raw
 * @returns {Doctor}
 */
export const mapDoctor = (raw = {}) => ({
  doctorId: raw.doctorId ?? null,
  doctorName: raw.doctorName ?? '',
  doctorProfilePic: raw.doctorProfilePic ?? null,
  qualification: raw.qualification ?? null,
  empTags: raw.empTags ?? null,
  status: raw.status ?? null,
  roomNum: raw.roomNum ?? null,
  employeeNote: raw.employeeNote ?? null,
  expiryDate: raw.expiryDate ?? null,
  nearBySessionDate: raw.nearBySessionDate ?? null,
  activeSessionId: raw.activeSessionId ?? 0,
  doctorAllProcedureDtos: raw.doctorAllProcedureDtos ?? null,
  days: raw.days ?? null,
  sessionInstanceTimeDtos: raw.sessionInstanceTimeDtos ?? null,
  opValidDays: raw.opValidDays ?? 0,
  followupCount: raw.followupCount ?? 0,
  userId: raw.userId ?? null,
  docSignature: raw.docSignature ?? null,
  dmo: !!raw.dmo,
  primaryPrivilige: !!raw.primaryPrivilige,
  active: !!raw.active,
});

/**
 * Normalize a single raw department object (with nested doctors).
 * @param {Object} raw
 * @returns {Department}
 */
export const mapDepartment = (raw = {}) => ({
  departmentId: raw.departmentId,
  departmentName: raw.departmentName ?? '',
  doctors: Array.isArray(raw.doctors) ? raw.doctors.map(mapDoctor) : [],
});

/**
 * Normalize the full `{ departments: [...] }` response envelope.
 * Returns an array of departments (never null/undefined).
 * @param {DepartmentsResponse|any} response
 * @returns {Department[]}
 */
export const mapDepartmentsResponse = (response) => {
  const list = response?.departments;
  return Array.isArray(list) ? list.map(mapDepartment) : [];
};

/**
 * Pluck doctors out of an already-loaded departments list.
 * Useful because the departments endpoint already embeds doctors,
 * so a separate "fetch doctors by department" call is unnecessary.
 * @param {Department[]} departments
 * @param {number|string} departmentId
 * @returns {Doctor[]}
 */
export const getDoctorsByDepartmentId = (departments, departmentId) => {
  const dept = (departments || []).find(
    (d) => String(d.departmentId) === String(departmentId)
  );
  return dept?.doctors ?? [];
};
