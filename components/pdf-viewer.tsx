"use client";

import { type ReactNode, useEffect, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  Maximize2,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

export function PdfDocumentViewer({
  src,
  title,
  onClose,
}: {
  src: string;
  title: string;
  onClose?: () => void;
}) {
  const viewer = useRef<HTMLDivElement>(null);
  const pages = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState("Loading PDF…");
  const [pageCount, setPageCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [layoutVersion, setLayoutVersion] = useState(0);

  useEffect(() => {
    const resize = () => requestAnimationFrame(() => setLayoutVersion((value) => value + 1));
    document.addEventListener("fullscreenchange", resize);
    window.addEventListener("resize", resize);
    return () => {
      document.removeEventListener("fullscreenchange", resize);
      window.removeEventListener("resize", resize);
    };
  }, []);

  useEffect(() => {
    const container = pages.current;
    if (!container) return;
    let cancelled = false;
    let loadingTask: any;
    container.replaceChildren();
    setStatus("Loading PDF…");
    setPageCount(0);
    setCurrentPage(1);

    const render = async () => {
      try {
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
        loadingTask = pdfjs.getDocument(src);
        const pdf = await loadingTask.promise;
        if (cancelled) return;
        setPageCount(pdf.numPages);

        for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
          if (cancelled) return;
          const page = await pdf.getPage(pageNumber);
          const baseViewport = page.getViewport({ scale: 1 });
          const availableWidth = Math.max(280, container.clientWidth - 24);
          const fitScale = Math.min(1, availableWidth / baseViewport.width);
          const cssScale = fitScale * zoom;
          const outputScale = Math.min(window.devicePixelRatio || 1, 2);
          const viewport = page.getViewport({ scale: cssScale * outputScale });
          const sheet = document.createElement("div");
          const canvas = document.createElement("canvas");
          const context = canvas.getContext("2d");
          if (!context) throw new Error("PDF canvas is unavailable.");

          sheet.className = "book-pdf-page";
          canvas.width = Math.floor(viewport.width);
          canvas.height = Math.floor(viewport.height);
          canvas.style.width = `${Math.floor(viewport.width / outputScale)}px`;
          canvas.style.height = `${Math.floor(viewport.height / outputScale)}px`;
          canvas.setAttribute("role", "img");
          canvas.setAttribute(
            "aria-label",
            `${title}, page ${pageNumber} of ${pdf.numPages}`,
          );
          sheet.appendChild(canvas);
          container.appendChild(sheet);
          await page.render({ canvas, canvasContext: context, viewport })
            .promise;
          setStatus(`Rendering page ${pageNumber} of ${pdf.numPages}…`);
        }
        setStatus("");
      } catch {
        if (!cancelled)
          setStatus("The PDF could not be displayed. Please try again.");
      }
    };

    void render();
    return () => {
      cancelled = true;
      loadingTask?.destroy();
    };
  }, [src, title, zoom, layoutVersion]);

  const goToPage = (page: number) => {
    const container = pages.current;
    if (!container || !pageCount) return;
    const targetPage = Math.max(1, Math.min(pageCount, page));
    const target = container.children.item(
      targetPage - 1,
    ) as HTMLElement | null;
    if (!target) return;
    container.scrollTo({ top: target.offsetTop - 8, behavior: "smooth" });
    setCurrentPage(targetPage);
  };

  const updateCurrentPage = () => {
    const container = pages.current;
    if (!container?.children.length) return;
    let closestPage = 1;
    let closestDistance = Number.POSITIVE_INFINITY;
    Array.from(container.children).forEach((child, index) => {
      const distance = Math.abs(
        (child as HTMLElement).offsetTop - container.scrollTop - 8,
      );
      if (distance < closestDistance) {
        closestDistance = distance;
        closestPage = index + 1;
      }
    });
    setCurrentPage(closestPage);
  };

  const enterFullscreen = async () => {
    const element = viewer.current as any;
    if (!element) return;
    setZoom(1);
    if (document.fullscreenElement) await document.exitFullscreen();
    else if (element.requestFullscreen) await element.requestFullscreen();
    else element.webkitRequestFullscreen?.();
  };

  return (
    <div
      className="book-pdf-viewer"
      aria-label={`${title} PDF viewer`}
      ref={viewer}
    >
      <div className="book-pdf-toolbar" aria-label="PDF controls">
        <div className="book-pdf-toolbar-group">
          <button
            type="button"
            onClick={() => goToPage(currentPage - 1)}
            disabled={currentPage <= 1}
            aria-label="Previous page"
            title="Previous page"
          >
            <ChevronLeft size={18} />
          </button>
          <span className="book-pdf-page-number" aria-live="polite">
            {pageCount ? `${currentPage} / ${pageCount}` : "— / —"}
          </span>
          <button
            type="button"
            onClick={() => goToPage(currentPage + 1)}
            disabled={!pageCount || currentPage >= pageCount}
            aria-label="Next page"
            title="Next page"
          >
            <ChevronRight size={18} />
          </button>
        </div>
        <div className="book-pdf-toolbar-group">
          <button
            type="button"
            onClick={() => setZoom((value) => Math.max(0.75, value - 0.25))}
            disabled={zoom <= 0.75}
            aria-label="Zoom out"
            title="Zoom out"
          >
            <ZoomOut size={18} />
          </button>
          <span className="book-pdf-zoom">{Math.round(zoom * 100)}%</span>
          <button
            type="button"
            onClick={() => setZoom((value) => Math.min(2, value + 0.25))}
            disabled={zoom >= 2}
            aria-label="Zoom in"
            title="Zoom in"
          >
            <ZoomIn size={18} />
          </button>
          <button
            type="button"
            onClick={enterFullscreen}
            aria-label="Toggle fullscreen"
            title="Fullscreen"
          >
            <Maximize2 size={18} />
          </button>
          <a
            href={src}
            download
            aria-label={`Download ${title}`}
            title="Download PDF"
          >
            <Download size={18} />
          </a>
          {onClose && (
            <button
              type="button"
              className="book-pdf-close"
              onClick={onClose}
              aria-label="Close PDF viewer"
              title="Close"
            >
              <X size={18} />
              <span>Close</span>
            </button>
          )}
        </div>
      </div>
      {status && <div className="book-pdf-status">{status}</div>}
      <div
        className="book-pdf-pages"
        ref={pages}
        onScroll={updateCurrentPage}
      />
    </div>
  );
}

export function PdfViewerDialog({
  src,
  title,
  open,
  onOpenChange,
}: {
  src: string;
  title: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="book-reader-dialog" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <PdfDocumentViewer
          src={src}
          title={title}
          onClose={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

export function PdfViewerButton({
  src,
  title,
  className,
  children,
  ariaLabel,
}: {
  src: string;
  title: string;
  className?: string;
  children: ReactNode;
  ariaLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        className={className}
        onClick={() => setOpen(true)}
        aria-label={ariaLabel || `Read ${title}`}
      >
        {children}
      </button>
      <PdfViewerDialog
        src={src}
        title={title}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  );
}
