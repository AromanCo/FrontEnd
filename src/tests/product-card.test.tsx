import React from 'react';
import {expect,it,vi} from 'vitest';
import {render,screen} from '@testing-library/react';
import {ProductCard} from '@/components/catalog/ProductCard';
vi.mock('next/link',()=>({default:({href,children,...props}:React.AnchorHTMLAttributes<HTMLAnchorElement>)=><a href={href} {...props}>{children}</a>}));
it('labels demo catalog cards and links to backend UUID',()=>{render(<ProductCard product={{id:'123',slug:'demo',name:'باغ نمونه',description:null,is_demo:true,brand_id:'brand',family_id:null}}/>);expect(screen.getByText('محصول نمایشی')).toBeTruthy();expect(screen.getByRole('link').getAttribute('href')).toBe('/shop/123')});
