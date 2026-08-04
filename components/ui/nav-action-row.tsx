import Link from "next/link";

interface NavActionRowProps {
  href: string;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  prefetch?: boolean;
}

/** A .row link: icon + title/subtitle + trailing chevron — e.g. "Find people", "Invite people". */
export function NavActionRow({ href, icon, title, subtitle, prefetch = false }: NavActionRowProps) {
  return (
    <Link href={href} className="row" prefetch={prefetch}>
      <div className="rowmark">{icon}</div>
      <div className="grow">
        <b>{title}</b>
        <span>{subtitle}</span>
      </div>
      <span className="chev">›</span>
    </Link>
  );
}
