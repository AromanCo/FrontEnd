import React from 'react';
import {expect,it,vi} from 'vitest';
import {fireEvent,render,screen,waitFor,within} from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
const mocks=vi.hoisted(()=>({notes:vi.fn(),families:vi.fn(),conceptGet:vi.fn(),conceptCreate:vi.fn(),conceptUpdate:vi.fn(),routerReplace:vi.fn()}));
const authState=vi.hoisted(()=>({authEnabled:true,user:null as {id:string;mobile_e164:string;role:string}|null,loading:false}));
vi.mock('@/components/auth/AuthProvider',()=>({useAuth:()=>({...authState,refresh:vi.fn(),logout:vi.fn()})}));
vi.mock('@/lib/api/client',()=>({
  ApiError:class ApiError extends Error {constructor(public status:number,message:string){super(message)}},
  catalog:{notes:mocks.notes,families:mocks.families},
  concepts:{get:mocks.conceptGet,create:mocks.conceptCreate,update:mocks.conceptUpdate},
}));
vi.mock('next/navigation',()=>({useRouter:()=>({replace:mocks.routerReplace,push:vi.fn()})}));
import {CreativeStudio} from '@/components/studio/CreativeStudio';
import {StudioDraftProvider} from '@/lib/studio/draft-transfer';
import {useEffect} from 'react';
import {useStudioDraft} from '@/lib/studio/draft-transfer';
const demoNote={id:'00000000-0000-4000-8000-000000000001',slug:'lavender',name:'اسطوخودوس',description:null,is_demo:true,family_id:'00000000-0000-4000-8000-000000000101'};
const secondNote={id:'00000000-0000-4000-8000-000000000002',slug:'rose',name:'رز',description:null,is_demo:true,family_id:'00000000-0000-4000-8000-000000000101'};

it('shows a retry after failure, renders loaded notes, keeps selections, and distinguishes an empty result',async()=>{
  mocks.families.mockResolvedValue([]);
  mocks.notes.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce([demoNote]).mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce([]);
  render(<StudioDraftProvider><CreativeStudio/></StudioDraftProvider>);
  const panel=screen.getByRole('tabpanel',{name:/نت‌ها/});
  await waitFor(()=>expect(panel.getAttribute('data-note-status')).toBe('error'));
  expect(within(panel).getByRole('button',{name:'تلاش دوباره'})).toBeTruthy();
  fireEvent.click(within(panel).getByRole('button',{name:'تلاش دوباره'}));
  await waitFor(()=>expect(panel.getAttribute('data-note-status')).toBe('ready'));
  fireEvent.click(within(panel).getByRole('button',{name:/اسطوخودوس/}));
  expect(screen.getByRole('status',{name:'1 از ۶ نت انتخاب شده'})).toBeTruthy();
  fireEvent.change(screen.getByPlaceholderText('جستجو میان نت‌ها…'),{target:{value:'ناموجود'}});
  await waitFor(()=>expect(panel.getAttribute('data-note-status')).toBe('error'));
  expect(screen.getByRole('status',{name:'1 از ۶ نت انتخاب شده'})).toBeTruthy();
  fireEvent.click(within(panel).getByRole('button',{name:'تلاش دوباره'}));
  await waitFor(()=>expect(panel.getAttribute('data-note-status')).toBe('ready'));
  expect(within(panel).getByText('نتی پیدا نشد')).toBeTruthy();
  expect(within(panel).queryByText('در حال دریافت نت‌های آرومان…')).toBeNull();
});

it('keeps Creative Studio usable in exploration mode and ignores saved-concept IDs',async()=>{
  authState.authEnabled=false;
  authState.user={id:'user-1',mobile_e164:'+989121234567',role:'customer'};
  mocks.families.mockResolvedValue([]);
  mocks.notes.mockResolvedValue([demoNote]);
  render(<StudioDraftProvider><CreativeStudio conceptId="saved-1"/></StudioDraftProvider>);
  await screen.findByRole('button',{name:/اسطوخودوس/});
  expect(mocks.conceptGet).not.toHaveBeenCalled();
  expect(screen.queryByRole('button',{name:/ذخیره مفهوم|ذخیره تغییرات/})).toBeNull();
  expect(screen.queryByRole('dialog',{name:/ورود/})).toBeNull();
  fireEvent.click(screen.getByRole('button',{name:/اسطوخودوس/}));
  expect(screen.getByRole('status',{name:'1 از ۶ نت انتخاب شده'})).toBeTruthy();
  authState.authEnabled=true;
  authState.user=null;
});

it('imports a Guided draft once with its name, real note and original layer',async()=>{
  mocks.families.mockResolvedValue([]);
  mocks.notes.mockResolvedValue([demoNote]);
  function Harness(){
    const {createDraft,pending}=useStudioDraft();
    useEffect(()=>{createDraft('باغ بارانی',[{noteId:demoNote.id,layer:'top',position:0}]);},[createDraft]);
    return <><output>{pending?'pending':'consumed'}</output><CreativeStudio fromGuided/></>;
  }
  render(<StudioDraftProvider><Harness/></StudioDraftProvider>);
  expect(await screen.findByText('پیشنهاد استودیوی هدایت‌شده برای ویرایش وارد شد.')).toBeInTheDocument();
  expect(screen.getByLabelText('نام مفهوم')).toHaveValue('باغ بارانی');
  expect(screen.getByRole('tabpanel',{name:'ترکیب'}).querySelector(`[data-selected-note-id="${demoNote.id}"]`)).toBeInTheDocument();
  expect(screen.getByLabelText('لایه اسطوخودوس')).toHaveValue('top');
  expect(screen.getByText('consumed')).toBeInTheDocument();
});

it('keeps a pending transfer through catalog failure and retries against the real catalog client',async()=>{
  mocks.families.mockResolvedValue([]);
  mocks.notes.mockRejectedValue(new Error('offline'));
  function Harness(){const {createDraft,pending}=useStudioDraft();useEffect(()=>{createDraft('پیش‌نویس',[{noteId:demoNote.id,layer:'base',position:0}]);},[createDraft]);return <><output>{pending?'pending':'consumed'}</output><CreativeStudio fromGuided/></>;}
  render(<StudioDraftProvider><Harness/></StudioDraftProvider>);
  expect(await screen.findByRole('alert')).toHaveTextContent('دریافت کاتالوگ برای انتقال انجام نشد');
  expect(screen.getByText('pending')).toBeInTheDocument();
  mocks.notes.mockResolvedValue([demoNote]);
  fireEvent.click(screen.getByRole('button',{name:'تلاش دوباره برای دریافت نت‌ها'}));
  expect(await screen.findByText('پیشنهاد استودیوی هدایت‌شده برای ویرایش وارد شد.')).toBeInTheDocument();
  expect(screen.getByLabelText('لایه اسطوخودوس')).toHaveValue('base');
  expect(screen.getByText('consumed')).toBeInTheDocument();
});

it('requires confirmation before partial import when a transferred note disappeared',async()=>{
  mocks.families.mockResolvedValue([]);
  mocks.notes.mockResolvedValue([demoNote]);
  function Harness(){const {createDraft,pending}=useStudioDraft();useEffect(()=>{createDraft('پیش‌نویس',[{noteId:demoNote.id,layer:'top',position:0},{noteId:'00000000-0000-4000-8000-000000009999',layer:'heart',position:0}]);},[createDraft]);return <><output>{pending?'pending':'consumed'}</output><CreativeStudio fromGuided/></>;}
  render(<StudioDraftProvider><Harness/></StudioDraftProvider>);
  const dialog=await screen.findByRole('dialog',{name:'بخشی از نت‌ها در دسترس نیست'});
  expect(within(dialog).getByText(/نت در کاتالوگ فعلی پیدا نشد/)).toBeInTheDocument();
  expect(screen.getByText('pending')).toBeInTheDocument();
  fireEvent.click(within(dialog).getByRole('button',{name:'ادامه با نت‌های موجود'}));
  expect(await screen.findByText(/1 نت موجود وارد شد/)).toBeInTheDocument();
  expect(screen.getByLabelText('لایه اسطوخودوس')).toHaveValue('top');
  expect(screen.getByText('consumed')).toBeInTheDocument();
});

it('gives an explicit saved-concept route precedence over a dormant Guided transfer',async()=>{
  authState.user={id:'user-1',mobile_e164:'+989121234567',role:'customer'};
  mocks.families.mockResolvedValue([]);
  mocks.notes.mockResolvedValue([demoNote,secondNote]);
  mocks.conceptGet.mockResolvedValue({id:'saved-1',name:'مفهوم ذخیره‌شده',notes:[{note_id:demoNote.id,layer:'heart',position:0}]});
  function Harness({conceptId}:{conceptId?:string}){const {createDraft,pending}=useStudioDraft();useEffect(()=>{createDraft('پیشنهاد هدایت‌شده',[{noteId:secondNote.id,layer:'top',position:0}]);},[createDraft]);return <><output>{pending?'pending':'consumed'}</output><CreativeStudio conceptId={conceptId} fromGuided/></>;}
  const view=render(<StudioDraftProvider><Harness conceptId="saved-1"/></StudioDraftProvider>);
  expect(await screen.findByDisplayValue('مفهوم ذخیره‌شده')).toBeInTheDocument();
  expect(screen.getByLabelText('لایه اسطوخودوس')).toHaveValue('heart');
  expect(screen.getByText('pending')).toBeInTheDocument();
  fireEvent.click(await screen.findByRole('button',{name:'بارگذاری پیش‌نویس هدایت‌شده'}));
  const confirm=await screen.findByRole('dialog',{name:'جایگزینی ترکیب فعلی'});
  fireEvent.click(within(confirm).getByRole('button',{name:'بازگشت'}));
  expect(screen.getByDisplayValue('مفهوم ذخیره‌شده')).toBeInTheDocument();
  expect(screen.getByText('pending')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button',{name:'بارگذاری پیش‌نویس هدایت‌شده'}));
  const confirmAgain=await screen.findByRole('dialog',{name:'جایگزینی ترکیب فعلی'});
  fireEvent.click(within(confirmAgain).getByRole('button',{name:'جایگزینی و بارگذاری'}));
  expect(mocks.routerReplace).toHaveBeenCalledWith('/studio/creative?from=guided');
  expect(screen.getByText('pending')).toBeInTheDocument();
  view.rerender(<StudioDraftProvider><Harness/></StudioDraftProvider>);
  expect(await screen.findByDisplayValue('پیشنهاد هدایت‌شده')).toBeInTheDocument();
  expect(screen.getByLabelText('لایه رز')).toHaveValue('top');
  expect(screen.getAllByRole('button',{name:/ذخیره مفهوم/}).length).toBeGreaterThan(0);
  expect(screen.getByText('consumed')).toBeInTheDocument();
});

it('detaches the accepted draft from saved-concept editing before Save can target it',async()=>{
  authState.user={id:'user-1',mobile_e164:'+989121234567',role:'customer'};
  mocks.families.mockResolvedValue([]);
  mocks.notes.mockResolvedValue([demoNote,secondNote]);
  mocks.conceptGet.mockResolvedValue({id:'saved-3',name:'مفهوم پیشین',notes:[{note_id:demoNote.id,layer:'heart',position:0}]});
  mocks.conceptCreate.mockResolvedValue({id:'new-3',name:'پیشنهاد تازه',notes:[]});
  function Harness({conceptId}:{conceptId?:string}){const {createDraft,pending}=useStudioDraft();useEffect(()=>{createDraft('پیشنهاد تازه',[{noteId:secondNote.id,layer:'base',position:0}]);},[createDraft]);return <><output>{pending?'pending':'consumed'}</output><CreativeStudio conceptId={conceptId} fromGuided/></>;}
  const view=render(<StudioDraftProvider><Harness conceptId="saved-3"/></StudioDraftProvider>);
  await screen.findByDisplayValue('مفهوم پیشین');
  fireEvent.click(await screen.findByRole('button',{name:'بارگذاری پیش‌نویس هدایت‌شده'}));
  fireEvent.click(await screen.findByRole('button',{name:'جایگزینی و بارگذاری'}));
  expect(mocks.routerReplace).toHaveBeenCalledWith('/studio/creative?from=guided');
  view.rerender(<StudioDraftProvider><Harness/></StudioDraftProvider>);
  await screen.findByText('پیشنهاد استودیوی هدایت‌شده برای ویرایش وارد شد.');
  expect(screen.getByDisplayValue('پیشنهاد تازه')).toBeInTheDocument();
  expect(screen.getByLabelText('لایه رز')).toHaveValue('base');
  fireEvent.click(screen.getAllByRole('button',{name:'ذخیره مفهوم'})[0]!);
  await waitFor(()=>expect(mocks.conceptCreate).toHaveBeenCalledTimes(1));
  expect(mocks.conceptUpdate).not.toHaveBeenCalled();
  expect(mocks.conceptGet).toHaveBeenCalledWith('saved-3');
});

it('does not apply an in-flight import after route intent changes to a saved concept',async()=>{
  authState.user={id:'user-1',mobile_e164:'+989121234567',role:'customer'};
  mocks.families.mockResolvedValue([]);
  const catalogDeferred=deferred<typeof demoNote[]>();
  mocks.notes.mockImplementation(()=>catalogDeferred.promise);
  mocks.conceptGet.mockResolvedValue({id:'saved-newer',name:'مفهوم تازه‌تر',notes:[{note_id:demoNote.id,layer:'base',position:0}]});
  function Harness({conceptId,fromGuided}:{conceptId?:string;fromGuided:boolean}){const {createDraft,pending}=useStudioDraft();useEffect(()=>{createDraft('پیش‌نویس قدیمی',[{noteId:secondNote.id,layer:'top',position:0}]);},[createDraft]);return <><output>{pending?'pending':'consumed'}</output><CreativeStudio conceptId={conceptId} fromGuided={fromGuided}/></>;}
  const view=render(<StudioDraftProvider><Harness fromGuided/></StudioDraftProvider>);
  await screen.findByText('پیش‌نویس در حال بررسی با کاتالوگ فعلی است…');
  view.rerender(<StudioDraftProvider><Harness conceptId="saved-newer" fromGuided/></StudioDraftProvider>);
  catalogDeferred.resolve([demoNote,secondNote]);
  expect(await screen.findByDisplayValue('مفهوم تازه‌تر')).toBeInTheDocument();
  await waitFor(()=>expect(screen.getByDisplayValue('مفهوم تازه‌تر')).toBeInTheDocument());
  expect(screen.queryByDisplayValue('پیش‌نویس قدیمی')).not.toBeInTheDocument();
  expect(screen.getByLabelText('لایه اسطوخودوس')).toHaveValue('base');
  expect(screen.getByText('pending')).toBeInTheDocument();
});

function deferred<T>(){let resolve!:(value:T)=>void;const promise=new Promise<T>(accept=>{resolve=accept});return{promise,resolve};}
