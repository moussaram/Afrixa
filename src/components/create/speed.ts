export type SpeedValue = '0.3x' | '0.5x' | '1x' | '2x' | '3x';

export const speeds: SpeedValue[] = ['0.3x', '0.5x', '1x', '2x', '3x'];

export const getSpeedMultiplier = (speed: SpeedValue): number => {
  switch (speed) {
    case '0.3x':
      return 0.3;
    case '0.5x':
      return 0.5;
    case '1x':
      return 1;
    case '2x':
      return 2;
    case '3x':
      return 3;
    default:
      return 1;
  }
};
