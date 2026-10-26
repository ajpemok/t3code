import {
  DEFAULT_BROWSER_RECORDING_POINTER,
  type BrowserRecordingPointer,
} from "@t3tools/contracts";
import { RECORDING_POINTER_PRESETS, recordingPointerImage } from "@t3tools/shared/recordingPointer";
import { useRef, useState } from "react";
import { useClientSettings, useUpdatePrimarySettings } from "~/hooks/useSettings";
import { Button } from "../ui/button";
import { Switch } from "../ui/switch";
import { Select, SelectItem, SelectPopup, SelectTrigger, SelectValue } from "../ui/select";
import { NumberField, NumberFieldGroup, NumberFieldInput } from "../ui/number-field";
import { SettingsRow } from "./settingsLayout";
import { searchableSetting } from "./settingsSearch";

async function importPointerImage(file: File) {
  if (file.size > 2_000_000) throw new Error("Choose an image smaller than 2 MB.");
  if (!["image/png", "image/webp", "image/svg+xml"].includes(file.type))
    throw new Error("Choose a PNG, WebP or SVG image.");
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const ratio = image.naturalWidth / image.naturalHeight;
    if (!Number.isFinite(ratio) || ratio < 0.05 || ratio > 20)
      throw new Error("The pointer image is too wide or tall.");
    const scale = Math.min(1, 256 / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("The image could not be prepared.");
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const data = canvas.toDataURL("image/png");
    if (data.length > 350_000) throw new Error("Choose a simpler pointer image.");
    return { imageDataUrl: data, imageAspectRatio: canvas.width / canvas.height };
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function RecordingPointerSettings({ disabled }: { readonly disabled: boolean }) {
  const pointer = useClientSettings((settings) => settings.browserRecordingPointer);
  const showHalo = useClientSettings((settings) => settings.browserRecordingShowMousePresses);
  const updateSettings = useUpdatePrimarySettings();
  return (
    <SettingsRow
      {...searchableSetting("browser-recording-pointer")}
      description="Use your pointer and click halo in new desktop and agent browser recordings."
    >
      <RecordingPointerEditor
        value={pointer}
        showHalo={showHalo}
        disabled={disabled}
        onChange={(value) => updateSettings({ browserRecordingPointer: value })}
        onHaloChange={(show) => updateSettings({ browserRecordingShowMousePresses: show })}
      />
    </SettingsRow>
  );
}

export function RecordingPointerEditor({
  value,
  showHalo,
  disabled = false,
  onChange,
  onHaloChange,
}: {
  readonly value: BrowserRecordingPointer;
  readonly showHalo: boolean;
  readonly disabled?: boolean;
  readonly onChange: (value: BrowserRecordingPointer) => void;
  readonly onHaloChange: (show: boolean) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const uploadSequence = useRef(0);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [point, setPoint] = useState({ x: 64, y: 48 });
  const [pulse, setPulse] = useState({ x: 64, y: 48, key: 0, active: false });
  const patch = (change: Partial<BrowserRecordingPointer>) => onChange({ ...value, ...change });
  const selectedPreset = RECORDING_POINTER_PRESETS.find((preset) => preset.id === value.shape);
  return (
    <fieldset
      disabled={disabled || busy}
      aria-label="Recording Pointer Configuration"
      className="flex min-w-0 flex-col gap-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-sm">
          <Switch
            checked={value.enabled}
            disabled={disabled}
            onCheckedChange={(enabled) => patch({ enabled: Boolean(enabled) })}
          />
          Show Pointer
        </label>
        <label className="flex items-center gap-2 text-sm">
          <Switch
            checked={showHalo}
            disabled={disabled}
            onCheckedChange={(enabled) => onHaloChange(Boolean(enabled))}
          />
          Click Halo
        </label>
      </div>
      <Select
        value={value.imageDataUrl ? "custom" : value.shape}
        disabled={disabled || busy}
        onValueChange={(id) => {
          const preset = RECORDING_POINTER_PRESETS.find((item) => item.id === id);
          if (preset)
            patch({
              shape: preset.id,
              imageDataUrl: null,
              imageAspectRatio: preset.imageAspectRatio,
              hotspotX: preset.hotspotX,
              hotspotY: preset.hotspotY,
            });
        }}
      >
        <SelectTrigger aria-label="Pointer Preset">
          <SelectValue>
            <span className="flex items-center gap-3">
              <img alt="" className="h-6 w-5 object-contain" src={recordingPointerImage(value)} />
              {value.imageDataUrl ? "Custom Image" : selectedPreset?.label}
            </span>
          </SelectValue>
        </SelectTrigger>
        <SelectPopup>
          {RECORDING_POINTER_PRESETS.map((preset) => (
            <SelectItem key={preset.id} value={preset.id}>
              <span className="flex items-center gap-3">
                <img
                  alt=""
                  className="h-6 w-5 object-contain"
                  src={recordingPointerImage({ ...value, shape: preset.id, imageDataUrl: null })}
                />
                {preset.label}
              </span>
            </SelectItem>
          ))}
          {value.imageDataUrl ? <SelectItem value="custom">Custom Image</SelectItem> : null}
        </SelectPopup>
      </Select>
      <button
        type="button"
        aria-label="Test recording pointer and click halo"
        className="relative h-32 w-full overflow-hidden rounded-lg border border-border bg-muted/25 text-sm text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
        style={{ cursor: value.enabled ? "none" : "auto" }}
        onPointerMove={(event) => {
          const rect = event.currentTarget.getBoundingClientRect();
          setPoint({ x: event.clientX - rect.left, y: event.clientY - rect.top });
        }}
        onPointerDown={(event) => {
          const rect = event.currentTarget.getBoundingClientRect();
          setPoint({ x: event.clientX - rect.left, y: event.clientY - rect.top });
          if (showHalo)
            setPulse((previous) => ({
              x: event.clientX - rect.left,
              y: event.clientY - rect.top,
              key: previous.key + 1,
              active: true,
            }));
        }}
        onKeyDown={(event) => {
          if (showHalo && (event.key === "Enter" || event.key === " "))
            setPulse((previous) => ({ ...point, key: previous.key + 1, active: true }));
        }}
      >
        Move and Click to Preview
        {showHalo ? (
          <span
            aria-hidden
            className="pointer-events-none absolute right-3 top-3 flex items-center gap-2 text-xs"
          >
            Halo
            <span className="relative size-7">
              <span
                key={pulse.key}
                className="recording-pointer-preview-halo absolute left-1/2 top-1/2 size-4 rounded-full border-2"
                style={{
                  borderColor: value.haloColor,
                  animationDuration: `${value.haloDurationMs}ms`,
                }}
              />
            </span>
          </span>
        ) : null}
        {pulse.active && showHalo ? (
          <span
            key={pulse.key}
            aria-hidden
            className="recording-pointer-preview-halo pointer-events-none absolute rounded-full border-2"
            style={{
              left: pulse.x,
              top: pulse.y,
              width: value.haloRadius * 2,
              height: value.haloRadius * 2,
              color: value.haloColor,
              borderColor: value.haloColor,
              animationDuration: `${value.haloDurationMs}ms`,
            }}
            onAnimationEnd={() => setPulse((previous) => ({ ...previous, active: false }))}
          />
        ) : null}
        {value.enabled ? (
          <img
            src={recordingPointerImage(value)}
            alt=""
            className="pointer-events-none absolute max-w-none"
            style={{
              left: point.x,
              top: point.y,
              width: value.size,
              height: value.size / value.imageAspectRatio,
              transform: `translate(${-value.hotspotX * 100}%,${-value.hotspotY * 100}%)`,
            }}
          />
        ) : null}
      </button>
      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/webp,image/svg+xml"
          className="sr-only"
          aria-label="Pointer image"
          disabled={disabled || busy}
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (!file) return;
            const sequence = ++uploadSequence.current;
            setError(null);
            setBusy(true);
            void importPointerImage(file)
              .then((image) => {
                if (sequence === uploadSequence.current) patch(image);
              })
              .catch((cause: unknown) => {
                if (sequence === uploadSequence.current)
                  setError(
                    cause instanceof Error ? cause.message : "The image could not be loaded.",
                  );
              })
              .finally(() => {
                if (sequence === uploadSequence.current) setBusy(false);
              });
          }}
        />
        <Button
          size="sm"
          variant="outline"
          disabled={disabled || busy}
          onClick={() => fileRef.current?.click()}
        >
          {busy ? "Preparing Image…" : "Choose Image"}
        </Button>
        <Button
          size="sm"
          variant="ghost-muted"
          disabled={disabled || busy}
          onClick={() => {
            setError(null);
            onChange(DEFAULT_BROWSER_RECORDING_POINTER);
          }}
        >
          Reset Pointer
        </Button>
      </div>
      {error ? (
        <p role="alert" className="text-xs text-error">
          {error}
        </p>
      ) : null}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {(
          [
            ["Size (px)", "size", 12, 96, 1],
            ["Hotspot X (%)", "hotspotX", 0, 100, 0.01],
            ["Hotspot Y (%)", "hotspotY", 0, 100, 0.01],
            ["Halo Radius (px)", "haloRadius", 8, 64, 1],
            ["Halo Duration (ms)", "haloDurationMs", 150, 1200, 1],
          ] as const
        ).map(([label, key, min, max, factor]) => (
          <div key={key} className="flex min-w-0 flex-col gap-1.5 text-xs text-muted-foreground">
            <span>{label}</span>
            <NumberField
              size="sm"
              min={min}
              max={max}
              step={key === "haloDurationMs" ? 50 : 1}
              value={Math.round(value[key] / factor)}
              disabled={disabled}
              onValueChange={(number) => {
                if (number !== null)
                  patch({ [key]: Math.min(max, Math.max(min, number)) * factor });
              }}
            >
              <NumberFieldGroup>
                <NumberFieldInput aria-label={label} />
              </NumberFieldGroup>
            </NumberField>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-5">
        {(
          [
            ["Fill", "fill"],
            ["Outline", "outline"],
            ["Halo", "haloColor"],
          ] as const
        ).map(([label, key]) => (
          <label key={key} className="flex items-center gap-2 text-xs text-muted-foreground">
            {label}
            <input
              type="color"
              aria-label={`${label} Colour`}
              value={value[key]}
              disabled={disabled || (key !== "haloColor" && value.imageDataUrl !== null)}
              onInput={(event) => {
                patch({ [key]: event.currentTarget.value });
                if (key === "haloColor" && showHalo)
                  setPulse((previous) => ({ ...point, key: previous.key + 1, active: true }));
              }}
              className="h-7 w-9 rounded-sm border border-input bg-transparent"
            />
          </label>
        ))}
      </div>
    </fieldset>
  );
}
