export const normalizeCategoryLabel = (category: string): string => {
  const trimmed = category.trim();
  const match = trimmed.match(/^(\d+)\s*(u|uf)?$/i);

  if (match) {
    const [, digits, suffix] = match;
    if (!suffix) {
      return `${digits}u`;
    }
    if (suffix.toLowerCase() === 'u') {
      return `${digits}u`;
    }
    if (suffix.toLowerCase() === 'uf') {
      return `${digits}uF`;
    }
  }

  return trimmed;
};

export const normalizeCategoryCounts = (
  categories: Record<string, number>
): Record<string, number> => {
  return Object.entries(categories).reduce<Record<string, number>>((acc, [category, count]) => {
    const normalized = normalizeCategoryLabel(category);
    acc[normalized] = (acc[normalized] || 0) + count;
    return acc;
  }, {});
};
