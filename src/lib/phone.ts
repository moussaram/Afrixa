const digitsOnly = (value: string) => value.replace(/\D/g, "");

export const formatPhoneWithDialCode = (dialCode: string, nationalNumber: string): string | null => {
  const countryCallingCode = digitsOnly(dialCode);
  const nationalDigits = digitsOnly(nationalNumber).replace(/^0+/, "");
  const combined = `${countryCallingCode}${nationalDigits}`;
  return countryCallingCode && nationalDigits.length >= 6 && combined.length <= 15
    ? `+${combined}`
    : null;
};

export const normalizeInternationalPhone = (value: string): string | null => {
  const digits = digitsOnly(value);
  return value.trim().startsWith("+") && digits.length >= 8 && digits.length <= 15
    ? `+${digits}`
    : null;
};
