export const getAfrixaUrl = (path: string) => `${window.location.origin}${path}`;

export const shareTargets = (url: string, text: string) => ({
  whatsapp: `https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`,
  facebook: `https://facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
  twitter: `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`,
});

export const copyShareLink = async (url: string) => {
  await navigator.clipboard.writeText(url);
};

export const nativeShare = async (title: string, text: string, url: string) => {
  if (navigator.share) {
    await navigator.share({ title, text, url });
    return true;
  }
  await copyShareLink(url);
  return false;
};
