import type { AdvisoryRuleId, AdvisoryRuleset } from './types';

export const ADVISOR_RULESET: AdvisoryRuleset = Object.freeze({
  id: 'aroman-editorial-layer-exploration',
  version: '1.0.0',
  labelFa: 'راهنمای ویرایشی آرومان',
});

export const ADVISOR_RULES: Readonly<Record<AdvisoryRuleId, Readonly<{
  titleFa: string;
  rationaleFa: string;
}>>> = Object.freeze({
  'explore-empty-layer': Object.freeze({
    titleFa: 'کاوش در چیدمان لایه‌ها',
    rationaleFa: 'این پیشنهاد، راه دیگری برای چیدن روایت مفهومی رایحهٔ شماست.',
  }),
  'explore-layer-sequence': Object.freeze({
    titleFa: 'کاوش در ترتیب روایت',
    rationaleFa: 'جابه‌جایی این دو نت، ترتیب دیگری برای روایت مفهومی شما پیشنهاد می‌کند.',
  }),
});

export const ADVISOR_LIMITATION_FA = Object.freeze([
  'این پیشنهاد ویرایشی و مفهومی است و دربارهٔ بوی واقعی، ایمنی یا امکان تولید چیزی را تأیید نمی‌کند.',
]);

/** Fixed narrative order used by the editorial layer-exploration rules. */
export const ADVISOR_LAYER_ORDER = Object.freeze(['top', 'heart', 'base'] as const);
