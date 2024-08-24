import Image from 'next/image';
import Link from 'next/link';

interface ProductCardProps {
  id: string;
  name: string;
  price: number;
  image: string;
}

export const ProductCard: React.FC<ProductCardProps> = ({ id, name, price, image }) => {
  return (
    <div className="border p-4 rounded-lg shadow-sm">
      <Link href={`/product/${id}`}>
        <a>
          <Image src={image} alt={name} width={200} height={200} className="rounded-lg" />
          <h2 className="text-xl font-semibold mt-4">{name}</h2>
          <p className="text-lg font-medium text-gray-600">${price}</p>
        </a>
      </Link>
    </div>
  );
};
