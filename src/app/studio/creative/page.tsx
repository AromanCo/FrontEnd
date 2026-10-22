import {CreativeStudio} from '@/components/studio/CreativeStudio';
export default async function CreativePage({searchParams}:{searchParams:Promise<{concept?:string;from?:string}>}){const{concept,from}=await searchParams;return <CreativeStudio conceptId={concept} fromGuided={from==='guided'}/>}
