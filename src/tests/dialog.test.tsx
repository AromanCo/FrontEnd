import React from 'react';
import {expect,it,vi} from 'vitest';
import {fireEvent,render,screen} from '@testing-library/react';
import {Dialog} from '@/components/ui/Dialog';
it('opens an accessible dialog and closes with Escape',()=>{const close=vi.fn();render(<Dialog title="ورود برای ذخیره" onClose={close}><input aria-label="شماره موبایل"/></Dialog>);expect(screen.getByRole('dialog',{name:'ورود برای ذخیره'}).getAttribute('aria-modal')).toBe('true');fireEvent.keyDown(document,{key:'Escape'});expect(close).toHaveBeenCalledOnce()});
