export type DurationMode = '15s' | '60s' | '3min' | '10min' | 'photo';

export const durationTabs: { id: DurationMode; label: string }[] = [
  { id: '15s', label: '15s' },
  { id: '60s', label: '60s' },
  { id: '3min', label: '3min' },
  { id: '10min', label: '10min' },
  { id: 'photo', label: 'Photo' },
];

export const getDurationSeconds = (mode: DurationMode): number => {
  switch (mode) {
    case '15s':
      return 15;
    case '60s':
      return 60;
    case '3min':
      return 180;
    case '10min':
      return 600;
    case 'photo':
      return 0;
    default:
      return 60;
  }
};
