"use client";

import Link from "next/link";

export type BreadcrumbItem = {
  label: string;
  href?: string;
};

type BreadcrumbsProps = {
  items: BreadcrumbItem[];
};

export function Breadcrumbs({ items }: BreadcrumbsProps) {
  return (
    <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-2 text-sm font-semibold text-slate-500">
      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        const isLinked = Boolean(item.href) && !isLast;
        const labelClassName = isLast ? "text-slate-700" : "text-slate-500 transition hover:text-brand-600";

        return (
          <span key={`${item.label}-${index}`} className="flex items-center gap-2">
            {isLinked && item.href ? (
              <Link href={item.href} className={labelClassName}>
                {item.label}
              </Link>
            ) : (
              <span className={labelClassName}>{item.label}</span>
            )}
            {!isLast ? <span className="text-slate-300">/</span> : null}
          </span>
        );
      })}
    </nav>
  );
}
