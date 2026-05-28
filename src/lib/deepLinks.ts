export const deepLinks = {
  video: (id: string) => `/video/${id}`,
  profile: (username: string) => `/@${username}`,
  shop: (username: string) => `/@${username}/shop`,
  product: (id: string) => `/product/${id}`,
  challenge: (slug: string) => `/challenge/${slug}`,
};

export const resolveDeepLinkFallback = (path: string) => {
  if (path.startsWith('/video/')) return '/';
  if (path.startsWith('/@') && path.endsWith('/shop')) return '/my-shop';
  if (path.startsWith('/@')) return '/profile';
  if (path.startsWith('/product/')) return '/marketplace';
  if (path.startsWith('/challenge/')) return '/creators/challenges';
  return '/home';
};
