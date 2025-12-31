// Phone number validation (Pakistan)
export const isValidPakistaniPhone = (phone: string): boolean => {
  const cleaned = phone.replace(/\D/g, '');
  // Matches: +923XX-XXXXXXX, 03XX-XXXXXXX, 923XXXXXXXXX, 03XXXXXXXXX
  const pattern = /^(92|0)?3[0-9]{9}$/;
  return pattern.test(cleaned);
};

// Email validation
export const isValidEmail = (email: string): boolean => {
  const pattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return pattern.test(email);
};

// Name validation
export const isValidName = (name: string, minLength = 2, maxLength = 50): boolean => {
  const trimmed = name.trim();
  return trimmed.length >= minLength && trimmed.length <= maxLength;
};

// Shop name validation
export const isValidShopName = (name: string): boolean => {
  const trimmed = name.trim();
  return trimmed.length >= 3 && trimmed.length <= 100;
};

// Address validation
export const isValidAddress = (address: string): boolean => {
  const trimmed = address.trim();
  return trimmed.length >= 10 && trimmed.length <= 500;
};

// Discount validation
export const isValidDiscount = (discount: number, maxAllowed: number): boolean => {
  return discount >= 0 && discount <= 100;
};

// Quantity validation
export const isValidQuantity = (quantity: number): boolean => {
  return Number.isInteger(quantity) && quantity >= 1;
};

// Password validation
export const isValidPassword = (password: string): boolean => {
  return password.length >= 6;
};

// Form field validators
export const validateRequired = (value: string, fieldName: string): string | undefined => {
  if (!value || !value.trim()) {
    return `${fieldName} is required`;
  }
  return undefined;
};

export const validateMinLength = (
  value: string,
  minLength: number,
  fieldName: string
): string | undefined => {
  if (value.length < minLength) {
    return `${fieldName} must be at least ${minLength} characters`;
  }
  return undefined;
};

export const validateMaxLength = (
  value: string,
  maxLength: number,
  fieldName: string
): string | undefined => {
  if (value.length > maxLength) {
    return `${fieldName} must be less than ${maxLength} characters`;
  }
  return undefined;
};

