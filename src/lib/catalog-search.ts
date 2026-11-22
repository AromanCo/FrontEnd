type SearchParams = Record<string, string | string[] | undefined>;

type CatalogSearch = {
  q?: string;
  brand_id?: string;
  family_id?: string;
  offset?: number;
};

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function safeOffset(offset: number) {
  return Number.isSafeInteger(offset) && offset > 0 ? offset : 0;
}

export function readCatalogSearch(params: SearchParams) {
  return {
    q: (first(params.q) ?? '').trim().slice(0, 100),
    brand_id: first(params.brand_id) || undefined,
    family_id: first(params.family_id) || undefined,
    offset: safeOffset(Number(first(params.offset) ?? 0)),
  };
}

export function catalogSearchSuffix({ q, brand_id, family_id, offset = 0 }: CatalogSearch) {
  const query = new URLSearchParams();
  const search = q?.trim().slice(0, 100);
  if (search) query.set('q', search);
  if (brand_id) query.set('brand_id', brand_id);
  if (family_id) query.set('family_id', family_id);
  if (safeOffset(offset)) query.set('offset', String(offset));
  const suffix = query.toString();
  return suffix ? `?${suffix}` : '';
}
