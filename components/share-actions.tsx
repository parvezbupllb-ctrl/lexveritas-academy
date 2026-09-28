"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Copy, Send, Share2 } from "lucide-react";
import { toast } from "sonner";

const siteOrigin = "https://lexveritasacademy.sites.bd";

export function ShareActions({
  title,
  href,
  compact = false,
}: {
  title: string;
  href: string;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ top: 8, left: 8 });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const url = `${siteOrigin}${href.startsWith("/") ? href : `/${href}`}`;
  const encodedUrl = encodeURIComponent(url);
  const encodedTitle = encodeURIComponent(title);
  const copy = async () => {
    await navigator.clipboard.writeText(url);
    toast.success("Share link copied");
    setOpen(false);
  };
  const nativeShare = async () => {
    if (navigator.share) {
      await navigator.share({ title, url }).catch(() => undefined);
      setOpen(false);
      return;
    }
    await copy();
  };
  useEffect(() => {
    if (!open) return;
    const placeAbove = () => {
      const trigger = triggerRef.current;
      if (!trigger) return;
      const rect = trigger.getBoundingClientRect();
      const width = menuRef.current?.offsetWidth || 220;
      const height = menuRef.current?.offsetHeight || 250;
      setPosition({
        top: Math.max(8, rect.top - height - 8),
        left: Math.min(
          Math.max(8, rect.left),
          Math.max(8, window.innerWidth - width - 8),
        ),
      });
    };
    const closeOutside = (event: PointerEvent) => {
      const target = event.target as Node;
      if (
        !triggerRef.current?.contains(target) &&
        !menuRef.current?.contains(target)
      ) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    placeAbove();
    const frame = requestAnimationFrame(placeAbove);
    window.addEventListener("resize", placeAbove);
    window.addEventListener("scroll", placeAbove, true);
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", placeAbove);
      window.removeEventListener("scroll", placeAbove, true);
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);
  return (
    <div className={`share-actions ${compact ? "compact" : ""}`}>
      <button
        ref={triggerRef}
        type="button"
        className="share-actions-trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <Share2 size={16} /> Share
      </button>
      {open && createPortal(<div
        ref={menuRef}
        className="share-actions-menu share-actions-menu-portal"
        role="menu"
        aria-label={`Share ${title}`}
        style={position}
      >
        <button type="button" onClick={nativeShare}>
          <Share2 size={15} /> Share…
        </button>
        <a
          href={`https://wa.me/?text=${encodedTitle}%20${encodedUrl}`}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => setOpen(false)}
        >
          WhatsApp
        </a>
        <a
          href={`https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => setOpen(false)}
        >
          Messenger / Facebook
        </a>
        <a
          href={`https://t.me/share/url?url=${encodedUrl}&text=${encodedTitle}`}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => setOpen(false)}
        >
          <Send size={15} /> Telegram
        </a>
        <button type="button" onClick={copy}>
          <Copy size={15} /> Copy Link
        </button>
      </div>, document.body)}
    </div>
  );
}
