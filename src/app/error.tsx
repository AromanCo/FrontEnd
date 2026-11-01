'use client';
export default function ErrorPage({reset}:{reset:()=>void}){return <div className="container section"><h1 className="heading">مشکلی پیش آمد</h1><p className="my-6">لطفاً دوباره تلاش کنید.</p><button className="btn btn-primary" onClick={reset}>تلاش دوباره</button></div>}
