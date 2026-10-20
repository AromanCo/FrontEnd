import {CreativeStudio} from '@/components/studio/CreativeStudio';
export default async function CreativePage({searchParams}:{searchParams:Promise<{concept?:string}>}){const{concept}=await searchParams;return <CreativeStudio conceptId={concept}/>}
