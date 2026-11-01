import {CreativeStudio} from '@/components/studio/CreativeStudio';
import { getReleaseScope } from '@/lib/release-scope';
export default async function CreativePage({searchParams}:{searchParams:Promise<{concept?:string;from?:string}>}){const{concept,from}=await searchParams;const scope=getReleaseScope();return <CreativeStudio conceptId={scope==='full'?concept:undefined} fromGuided={from==='guided'} fromAdvisor={from==='advisor'}/>}
