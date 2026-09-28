"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Crop, UploadCloud, X } from "lucide-react";
import { toast } from "sonner";

type CropSpec = {
  ratio: number;
  ratioLabel: string;
  width: number;
  height: number;
  label: string;
};

const cropSpecs: Record<string, CropSpec> = {
  cover: {
    ratio: 2 / 3,
    ratioLabel: "2:3",
    width: 1200,
    height: 1800,
    label: "Book cover",
  },
  question: {
    ratio: 4 / 3,
    ratioLabel: "4:3",
    width: 1200,
    height: 900,
    label: "Question image",
  },
  team: {
    ratio: 4 / 5,
    ratioLabel: "4:5",
    width: 960,
    height: 1200,
    label: "Team photo",
  },
  review: {
    ratio: 1,
    ratioLabel: "1:1",
    width: 800,
    height: 800,
    label: "Reviewer photo",
  },
  author: {
    ratio: 1,
    ratioLabel: "1:1",
    width: 800,
    height: 800,
    label: "Author photo",
  },
  blog: {
    ratio: 16 / 9,
    ratioLabel: "16:9",
    width: 1600,
    height: 900,
    label: "Blog thumbnail",
  },
  course: {
    ratio: 16 / 9,
    ratioLabel: "16:9",
    width: 1600,
    height: 900,
    label: "Course / package thumbnail",
  },
  note: {
    ratio: 16 / 9,
    ratioLabel: "16:9",
    width: 1600,
    height: 900,
    label: "Note thumbnail",
  },
  settingsHero: {
    ratio: 16 / 9,
    ratioLabel: "16:9",
    width: 1600,
    height: 900,
    label: "Hero image",
  },
  settingsLogo: {
    ratio: 5 / 3,
    ratioLabel: "5:3",
    width: 1500,
    height: 900,
    label: "Website logo",
  },
  settingsFavicon: {
    ratio: 1,
    ratioLabel: "1:1",
    width: 512,
    height: 512,
    label: "Favicon",
  },
};

const isImageKind = (kind: string) => !!cropSpecs[kind];

async function upload(file: File, kind: string) {
  const body = new FormData();
  body.append("file", file);
  body.append("kind", kind);
  const response = await fetch("/api/admin/upload", {
    method: "POST",
    headers: { "X-LVA-Request": "1" },
    body,
  });
  const result: any = await response.json();
  if (!response.ok) throw Error(result.error || "Upload failed");
  return result.id as string;
}

export function MediaUpload({
  kind,
  value,
  onChange,
  successMessage = "File uploaded",
}: {
  kind: string;
  value?: string | null;
  onChange: (value: string | null) => void;
  successMessage?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [source, setSource] = useState<{ file: File; url: string } | null>(
    null,
  );
  const [zoom, setZoom] = useState(1);
  const [x, setX] = useState(0);
  const [y, setY] = useState(0);
  const spec = cropSpecs[kind];
  const acceptsPdf = [
    "preview",
    "digital",
    "noteFile",
    "noticeAttachment",
    "coursePdf",
  ].includes(kind);

  useEffect(() => () => { if (source) URL.revokeObjectURL(source.url); }, [source]);

  const accept = useMemo(
    () =>
      acceptsPdf
        ? kind === "noticeAttachment" || kind === "noteFile"
          ? "application/pdf,image/png,image/jpeg,image/webp,image/avif"
          : "application/pdf"
        : "image/png,image/jpeg,image/webp,image/avif",
    [acceptsPdf, kind],
  );

  const closeCrop = () => {
    if (source) URL.revokeObjectURL(source.url);
    setSource(null);
    setZoom(1);
    setX(0);
    setY(0);
    if (inputRef.current) inputRef.current.value = "";
  };

  const send = async (file: File) => {
    setBusy(true);
    try {
      onChange(await upload(file, kind));
      toast.success(successMessage);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setBusy(false);
    }
  };

  const cropAndSend = async () => {
    if (!source || !spec) return;
    setBusy(true);
    try {
      const image = new Image();
      image.src = source.url;
      await image.decode();
      const baseScale = Math.max(
        spec.width / image.naturalWidth,
        spec.height / image.naturalHeight,
      );
      const scale = baseScale * zoom;
      const visibleWidth = spec.width / scale;
      const visibleHeight = spec.height / scale;
      const maxLeft = Math.max(0, image.naturalWidth - visibleWidth);
      const maxTop = Math.max(0, image.naturalHeight - visibleHeight);
      const left = maxLeft * ((x + 100) / 200);
      const top = maxTop * ((y + 100) / 200);
      const canvas = document.createElement("canvas");
      canvas.width = spec.width;
      canvas.height = spec.height;
      const context = canvas.getContext("2d");
      if (!context) throw Error("Your browser could not prepare this crop.");
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(
        image,
        left,
        top,
        visibleWidth,
        visibleHeight,
        0,
        0,
        spec.width,
        spec.height,
      );
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/webp", 0.88),
      );
      if (!blob) throw Error("Your browser could not prepare this crop.");
      const name = source.file.name.replace(/\.[^.]+$/, "") + "-cropped.webp";
      onChange(
        await upload(new File([blob], name, { type: "image/webp" }), kind),
      );
      toast.success(successMessage);
      closeCrop();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="upload media-upload">
      {spec && (
        <p className="upload-ratio-help">
          <Crop size={15} aria-hidden="true" /> {kind === "blog" ? "Required crop" : "Recommended"}: {spec.ratioLabel} ·{" "}
          {spec.width} × {spec.height}px
        </p>
      )}
      <label className={`upload-picker ${busy ? "disabled" : ""}`}>
        <UploadCloud size={19} aria-hidden="true" />
        <span>{busy ? "Uploading…" : "Choose file"}</span>
        <input
          ref={inputRef}
          type="file"
          aria-label={`Upload ${kind}`}
          accept={accept}
          disabled={busy}
          onChange={async (event) => {
            const file = event.target.files?.[0];
            if (!file) return;
            if (file.type.startsWith("image/") && spec) {
              setSource({ file, url: URL.createObjectURL(file) });
              return;
            }
            await send(file);
            if (inputRef.current) inputRef.current.value = "";
          }}
        />
      </label>
      {value && (
        <div className="actions upload-actions">
          <span className="correct-text">File attached</span>
          {!value.startsWith("/assets/") && kind !== "digital" && kind !== "coursePdf" && (
            <a
              className="text-link"
              href={`/api/files/${value}`}
              target="_blank"
              rel="noreferrer"
            >
              Preview
            </a>
          )}
          <button
            type="button"
            className="text-link danger-text"
            onClick={() => onChange(null)}
          >
            Remove
          </button>
        </div>
      )}
      {source && spec && (
        <div
          className="crop-modal"
          role="dialog"
          aria-modal="true"
          aria-label={`Crop ${spec.label}`}
        >
          <div className="crop-card">
            <div className="crop-head">
              <div>
                <strong>Crop {spec.label}</strong>
                <small>
                  {spec.ratioLabel} · Output {spec.width} × {spec.height}px
                </small>
              </div>
              <button
                type="button"
                className="icon-btn"
                onClick={closeCrop}
                aria-label="Close crop"
              >
                <X size={18} />
              </button>
            </div>
            <div
              className="crop-preview"
              style={{ aspectRatio: String(spec.ratio) }}
            >
              <img
                src={source.url}
                alt="Crop preview"
                style={{
                  transform: `scale(${zoom})`,
                  objectPosition: `${(x + 100) / 2}% ${(y + 100) / 2}%`,
                }}
              />
            </div>
            <div className="crop-controls">
              <label>
                <span>Zoom</span>
                <input
                  type="range"
                  min="1"
                  max="3"
                  step="0.05"
                  value={zoom}
                  onChange={(e) => setZoom(Number(e.target.value))}
                />
              </label>
              <label>
                <span>Horizontal position</span>
                <input
                  type="range"
                  min="-100"
                  max="100"
                  value={x}
                  onChange={(e) => setX(Number(e.target.value))}
                />
              </label>
              <label>
                <span>Vertical position</span>
                <input
                  type="range"
                  min="-100"
                  max="100"
                  value={y}
                  onChange={(e) => setY(Number(e.target.value))}
                />
              </label>
            </div>
            <div className="actions crop-actions">
              <button type="button" className="btn outline" onClick={closeCrop}>
                Cancel
              </button>
              <button
                type="button"
                className="btn"
                disabled={busy}
                onClick={cropAndSend}
              >
                {busy ? "Uploading…" : "Crop & upload"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
