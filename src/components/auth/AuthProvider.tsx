'use client';
import {createContext,useCallback,useContext,useEffect,useState} from 'react';
import {ApiError,auth,setCsrf,renewCsrf,type User} from '@/lib/api/client';
type AuthState={user:User|null;loading:boolean;refresh:()=>Promise<void>;logout:()=>Promise<void>};
const Context=createContext<AuthState|null>(null);
export function AuthProvider({children}:{children:React.ReactNode}){const[user,setUser]=useState<User|null>(null);const[loading,setLoading]=useState(true);
 const refresh=useCallback(async()=>{try{await auth.session();await renewCsrf();setUser(await auth.me())}catch(error){if(error instanceof ApiError&&error.status===401){setUser(null);setCsrf(null)}else throw error}finally{setLoading(false)}},[]);
 useEffect(()=>{const timer=setTimeout(()=>{void refresh().catch(()=>setLoading(false))},0);return()=>clearTimeout(timer)},[refresh]);
 useEffect(()=>{const expired=()=>{setUser(null);setCsrf(null)};window.addEventListener('aroman:session-expired',expired);return()=>window.removeEventListener('aroman:session-expired',expired)},[]);
 const logout=async()=>{try{await auth.logout()}catch(error){if(!(error instanceof ApiError&&error.status===401))throw error}setUser(null);setCsrf(null)};
 return <Context.Provider value={{user,loading,refresh,logout}}>{children}</Context.Provider>}
export function useAuth(){const state=useContext(Context);if(!state)throw new Error('AuthProvider is missing');return state}
