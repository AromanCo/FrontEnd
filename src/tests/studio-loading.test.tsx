import React from 'react';
import {expect,it,vi} from 'vitest';
import {fireEvent,render,screen,waitFor,within} from '@testing-library/react';
const mocks=vi.hoisted(()=>({notes:vi.fn(),families:vi.fn()}));
vi.mock('@/components/auth/AuthProvider',()=>({useAuth:()=>({user:null,loading:false})}));
vi.mock('@/lib/api/client',()=>({
  ApiError:class ApiError extends Error {constructor(public status:number,message:string){super(message)}},
  catalog:{notes:mocks.notes,families:mocks.families},
  concepts:{},
}));
import {CreativeStudio} from '@/components/studio/CreativeStudio';
const demoNote={id:'note-1',slug:'lavender',name:'اسطوخودوس',description:null,is_demo:true,family_id:'family-1'};

it('shows a retry after failure, renders loaded notes, keeps selections, and distinguishes an empty result',async()=>{
  mocks.families.mockResolvedValue([]);
  mocks.notes.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce([demoNote]).mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce([]);
  render(<CreativeStudio/>);
  const panel=screen.getByRole('tabpanel',{name:'نت‌ها'});
  await waitFor(()=>expect(panel.getAttribute('data-note-status')).toBe('error'));
  expect(within(panel).getByRole('button',{name:'تلاش دوباره'})).toBeTruthy();
  fireEvent.click(within(panel).getByRole('button',{name:'تلاش دوباره'}));
  await waitFor(()=>expect(panel.getAttribute('data-note-status')).toBe('ready'));
  fireEvent.click(within(panel).getByRole('button',{name:/اسطوخودوس/}));
  expect(screen.getByText('1 از ۶ نت انتخاب شده')).toBeTruthy();
  fireEvent.change(screen.getByPlaceholderText('جستجوی نت…'),{target:{value:'ناموجود'}});
  await waitFor(()=>expect(panel.getAttribute('data-note-status')).toBe('error'));
  expect(screen.getByText('1 از ۶ نت انتخاب شده')).toBeTruthy();
  fireEvent.click(within(panel).getByRole('button',{name:'تلاش دوباره'}));
  await waitFor(()=>expect(panel.getAttribute('data-note-status')).toBe('ready'));
  expect(within(panel).getByText('نتی برای این جستجو پیدا نشد.')).toBeTruthy();
  expect(within(panel).queryByText('در حال دریافت نت‌ها…')).toBeNull();
});
