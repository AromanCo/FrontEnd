import React from 'react';
import {expect,it,vi} from 'vitest';
import {fireEvent,render,screen} from '@testing-library/react';
import {CatalogControls} from '@/components/catalog/CatalogControls';
const push=vi.fn();
vi.mock('next/navigation',()=>({useRouter:()=>({push})}));
it('submits actual name and UUID filters without stale offsets',()=>{render(<CatalogControls q="" brandId="" familyId="" brands={[{id:'brand-uuid',slug:'b',name:'برند',description:null,is_demo:true}]} families={[{id:'family-uuid',slug:'f',name:'خانواده',description:null,is_demo:true}]}/>);fireEvent.change(screen.getByPlaceholderText('نام محصول'),{target:{value:'باغ'}});fireEvent.change(screen.getByLabelText('برند'),{target:{value:'brand-uuid'}});fireEvent.change(screen.getByLabelText('خانواده رایحه'),{target:{value:'family-uuid'}});fireEvent.click(screen.getByRole('button',{name:'اعمال فیلتر'}));expect(push).toHaveBeenCalledWith(`/shop?${new URLSearchParams({q:'باغ',brand_id:'brand-uuid',family_id:'family-uuid'})}`)});
