import type { components } from './generated';
export type Brand = components['schemas']['NamedDemoOut'];
export type Family = components['schemas']['NamedDemoOut'];
export type Note = components['schemas']['NoteOut'];
export type Product = components['schemas']['ProductOut'];
export type Variant = components['schemas']['VariantOut'];
export type Concept = components['schemas']['ConceptOut'];
export type ConceptInput = components['schemas']['ConceptInput'];
export type User = components['schemas']['UserOut'];
export type Layer = 'top'|'heart'|'base';
export const browserBase = process.env.NEXT_PUBLIC_AROMAN_API_BASE_URL || 'http://localhost:8000/api/v1';
const serverBase = process.env.AROMAN_API_BASE_URL || browserBase;
export class ApiError extends Error { constructor(public status:number, message:string){super(message);this.name='ApiError'} }
const messages:Record<number,string>={400:'کد نامعتبر یا منقضی شده است.',401:'برای ادامه وارد حساب شوید.',403:'نشست امنیتی منقضی شده است. دوباره تلاش کنید.',404:'مورد درخواستی پیدا نشد.',422:'اطلاعات واردشده معتبر نیست.',429:'درخواست‌های زیادی ثبت شده است. کمی صبر کنید.',503:'این سرویس در حال حاضر در دسترس نیست.'};
export async function request<T>(path:string,init:RequestInit={},server=false):Promise<T>{
 const base=server?serverBase:browserBase;
 let response:Response;
 const timeout=AbortSignal.timeout(15000);
 const signal=init.signal?AbortSignal.any([init.signal,timeout]):timeout;
 try{response=await fetch(`${base}${path}`,{...init,signal,credentials:'include',headers:{...(init.body?{'Content-Type':'application/json'}:{}),...init.headers},cache:'no-store'});}catch{throw new ApiError(0,timeout.aborted?'پاسخ سرور بیش از حد طول کشید. دوباره تلاش کنید.':'ارتباط با سرور برقرار نشد. اتصال خود را بررسی کنید.');}
 if(!response.ok){if(response.status===401&&typeof window!=='undefined')window.dispatchEvent(new Event('aroman:session-expired'));throw new ApiError(response.status,messages[response.status]||'درخواست انجام نشد.');}
 return response.status===204?undefined as T:await response.json() as T;
}
export const query=(params:Record<string,string|number|undefined>)=>{const q=new URLSearchParams();Object.entries(params).forEach(([key,value])=>{if(value!==undefined&&value!=='')q.set(key,String(value))});return q.toString()};
export const catalog={brands:(q='',limit=100,offset=0,server=false)=>request<Brand[]>(`/brands?${query({q,limit,offset})}`,{},server),families:(q='',limit=100,offset=0,server=false)=>request<Family[]>(`/fragrance-families?${query({q,limit,offset})}`,{},server),products:(filters:{q?:string;brand_id?:string;family_id?:string;limit?:number;offset?:number}={},server=false)=>request<Product[]>(`/products?${query(filters)}`,{},server),notes:(filters:{q?:string;family_id?:string;limit?:number;offset?:number}={},server=false)=>request<Note[]>(`/fragrance-notes?${query(filters)}`,{},server),variants:(id:string,server=false)=>request<Variant[]>(`/products/${encodeURIComponent(id)}/variants`,{},server)};
let csrfToken:string|null=null;
export function setCsrf(token:string|null){csrfToken=token}
export function getCsrf(){return csrfToken}
export async function authenticated<T>(path:string,method:'POST'|'PUT'|'DELETE',body?:unknown){
 if(!csrfToken)await renewCsrf();
 try{return await request<T>(path,{method,headers:{'X-CSRF-Token':csrfToken||''},body:body===undefined?undefined:JSON.stringify(body)});}catch(error){if(error instanceof ApiError&&error.status===403){await renewCsrf();return request<T>(path,{method,headers:{'X-CSRF-Token':csrfToken||''},body:body===undefined?undefined:JSON.stringify(body)});}throw error}
}
export async function renewCsrf(){const value=await request<{csrf_token:string}>('/auth/csrf');setCsrf(value.csrf_token);return value.csrf_token}
export const auth={session:()=>request<{user_id:string;role:string}>('/auth/session'),me:()=>request<User>('/users/me'),challenge:(mobile:string)=>request<{message:string}>('/auth/challenges',{method:'POST',body:JSON.stringify({mobile})}),verify:async(mobile:string,code:string)=>{const value=await request<{user_id:string;csrf_token:string}>('/auth/verify',{method:'POST',body:JSON.stringify({mobile,code})});setCsrf(value.csrf_token);return value},logout:()=>authenticated<void>('/auth/session','DELETE')};
export const concepts={list:(limit=50,offset=0)=>request<Concept[]>(`/fragrance-concepts?${query({limit,offset})}`),get:(id:string)=>request<Concept>(`/fragrance-concepts/${encodeURIComponent(id)}`),create:(body:ConceptInput)=>authenticated<Concept>('/fragrance-concepts','POST',body),update:(id:string,body:ConceptInput)=>authenticated<Concept>(`/fragrance-concepts/${encodeURIComponent(id)}`,'PUT',body),duplicate:(id:string)=>authenticated<Concept>(`/fragrance-concepts/${encodeURIComponent(id)}/duplicate`,'POST'),remove:(id:string)=>authenticated<void>(`/fragrance-concepts/${encodeURIComponent(id)}`,'DELETE')};
