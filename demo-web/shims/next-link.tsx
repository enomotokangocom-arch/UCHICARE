import type { AnchorHTMLAttributes, ReactNode } from "react";
import { navigate } from "./router";

type Props = AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; children?: ReactNode; prefetch?: boolean };

export default function Link({ href, children, onClick, prefetch, ...rest }: Props) {
  void prefetch;
  return (
    <a
      {...rest}
      href={"#" + (href.split("#")[1] ?? "")}
      onClick={(e) => {
        onClick?.(e);
        if (e.defaultPrevented) return;
        e.preventDefault();
        navigate(href);
      }}
    >
      {children}
    </a>
  );
}
