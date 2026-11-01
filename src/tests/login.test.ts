import {expect,it} from 'vitest';
import {normalizeDigits} from '@/components/auth/LoginForm';
it('normalizes Persian and Arabic numerals',()=>{expect(normalizeDigits('۰۹۱٢٣٤٥٦٧٨٩')).toBe('09123456789')});
