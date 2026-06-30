// Input validators for the chatbot forms

export const validateMobile = (mobile) => {
  const clean = (mobile || '').replace(/\D/g, '');
  if (clean.length !== 10) return 'Mobile number must be 10 digits';
  if (!/^[6-9]/.test(clean)) return 'Mobile number must start with 6, 7, 8 or 9';
  return null;
};

export const validateName = (name, fieldName = 'Name') => {
  if (!name || !name.trim()) return `${fieldName} is required`;
  if (name.trim().length < 2) return `${fieldName} must be at least 2 characters`;
  if (!/^[a-zA-Z\s'-]+$/.test(name.trim())) return `${fieldName} can only contain letters`;
  return null;
};

export const validateDOB = (dob) => {
  if (!dob) return 'Date of birth is required';
  const date = new Date(dob);
  if (isNaN(date.getTime())) return 'Invalid date';
  const today = new Date();
  if (date > today) return 'Date of birth cannot be in the future';
  const age = today.getFullYear() - date.getFullYear();
  if (age > 120) return 'Please enter a valid date of birth';
  return null;
};

export const validateGender = (gender) => {
  if (!gender) return 'Please select a gender';
  if (!['Male', 'Female', 'Other'].includes(gender)) return 'Invalid gender selection';
  return null;
};

export const formatDate = (date) => {
  if (!date) return '';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
};

export const formatMobile = (mobile) => {
  const clean = (mobile || '').replace(/\D/g, '').slice(0, 10);
  if (clean.length <= 5) return clean;
  return `${clean.slice(0, 5)} ${clean.slice(5)}`;
};
