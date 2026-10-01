import Image from "next/image";
import Link from "next/link";

/**
 * Site header
 */
export const Header = () => {
  return (
    <div className="sticky lg:static top-0 navbar bg-base-100 min-h-0 shrink-0 z-20 shadow-sm border-b border-base-300 px-4 sm:px-6">
      <Link href="/" passHref className="flex items-center gap-3 shrink-0">
        <Image alt="Indiana Group logo" src="/indiana-group-logo.svg" width={36} height={36} priority />
        <div className="flex flex-col">
          <span className="font-bold leading-tight text-base">Indiana Group</span>
          <span className="text-[10px] tracking-wider uppercase text-base-content/50 font-medium">Built on Hedera</span>
        </div>
      </Link>
    </div>
  );
};
