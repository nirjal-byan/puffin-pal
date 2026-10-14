import Image from "next/image";
import Link from "next/link";

export function Brand({ inverted = false }: { inverted?: boolean }) {
  return (
    <Link className="brand" href="/" aria-label="PuffinPal home">
      <Image
        className="brand-logo"
        src="/puffinpal-logo-transparent.png"
        alt="PuffinPal"
        width={2172}
        height={724}
        sizes="240px"
        priority
      />
      {inverted && (
        <Image
          className="brand-logo brand-logo-light"
          src="/puffinpal-logo-transparent.png"
          alt=""
          aria-hidden="true"
          width={2172}
          height={724}
          sizes="240px"
          priority
        />
      )}
    </Link>
  );
}
