import { Package } from 'lucide-react';
import { useState } from 'react';

interface SafeImageProps {
  src: string | null | undefined;
  alt: string;
  className?: string;
  fallbackLabel?: string;
}

export function SafeImage({ src, alt, className = 'w-full h-full object-cover', fallbackLabel }: SafeImageProps) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-[#EBF5EE] dark:bg-[#132219] text-[#2E8B57] dark:text-[#6EE7B7] p-4 select-none">
        <Package className="w-8 h-8 opacity-60 mb-1.5" />
        {fallbackLabel ? (
          <span className="text-xs font-medium text-center text-[#14532D] dark:text-[#A7F3D0] line-clamp-2 max-w-[160px]">
            {fallbackLabel}
          </span>
        ) : null}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={className}
    />
  );
}
