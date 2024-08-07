"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import React from "react";
import { Button } from "../ui/button";

export const CreateKeyButton = (props: { keyAuthId: string }) => {
  // Add missing import

  const href = `/keys/${props.keyAuthId}/new`;
  const path = usePathname();
  const setUrl = () => {
    window.location.href = href;
  };
  if (path?.match(href)) {
    return (
      <Button onClick={setUrl} variant="primary">
        Create Key
      </Button>
    );
  }
  return (
    <Link key="new" href={href}>
      <Button variant="primary">Create Key</Button>
    </Link>
  );
};
