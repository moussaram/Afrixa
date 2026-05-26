export const formatNumber = (num: number): string => {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
  }
  return num.toString();
};

export const formatTimeAgo = (dateString: string): string => {
  const now = new Date();
  const date = new Date(dateString);
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) {
    return 'À l\'instant';
  }

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `${minutes}min`;
  }

  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours}h`;
  }

  const days = Math.floor(hours / 24);
  if (days < 7) {
    return `${days}j`;
  }

  const weeks = Math.floor(days / 7);
  if (weeks < 4) {
    return `${weeks}sem`;
  }

  const months = Math.floor(days / 30);
  if (months < 12) {
    return `${months}mois`;
  }

  const years = Math.floor(days / 365);
  return `${years}an${years > 1 ? 's' : ''}`;
};
