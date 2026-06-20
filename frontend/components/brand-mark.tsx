import Image from "next/image";

export function BrandMark({ className = "" }: { className?: string }) {
  return (
    <div className={`relative ${className}`} aria-hidden="true">
      <Image
        src="/erp-logo-fixed.png"
        alt=""
        fill
        priority
        sizes="140px"
        className="object-contain"
      />
    </div>
  );
}
