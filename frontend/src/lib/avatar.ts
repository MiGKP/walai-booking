export const resolveAvatarUrl = (avatar?: string): string => {
  if (!avatar) return '';
  if (avatar.startsWith('http://') || avatar.startsWith('https://') || avatar.startsWith('blob:')) {
    return avatar;
  }

  const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';
  const apiOrigin = apiBaseUrl.replace(/\/api\/?$/, '');

  if (avatar.startsWith('/')) {
    return `${apiOrigin}${avatar}`;
  }

  return `${apiOrigin}/${avatar}`;
};
