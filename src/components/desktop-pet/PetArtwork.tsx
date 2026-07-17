import { type CSSProperties } from "react";
import { convertFileSrc } from "@tauri-apps/api/core";
import {
  joinPetAssetPath,
  type DesktopPetMood,
  type InstalledPet,
} from "../../lib/desktopPet";
import "./PetArtwork.css";

const CODEX_CELL_WIDTH = 192;
const CODEX_CELL_HEIGHT = 208;
const CODEX_COLUMNS = 8;

interface PetArtworkProps {
  pet: InstalledPet;
  alt: string;
  width: number;
  height: number;
  mood?: DesktopPetMood;
  animated?: boolean;
  className?: string;
  onError?: () => void;
}

export function PetArtwork({
  pet,
  alt,
  width,
  height,
  mood = "idle",
  animated = true,
  className = "",
  onError,
}: PetArtworkProps) {
  const stateAsset = pet.manifest.states[mood] ?? pet.manifest.states.idle;
  const assetUrl = convertFileSrc(joinPetAssetPath(pet.baseDir, stateAsset.file));

  if (pet.manifest.engine !== "codex-sprite") {
    return (
      <span className={`pet-artwork ${className}`} style={{ width, height }}>
        <img
          className="pet-artwork-image"
          src={assetUrl}
          alt={alt}
          draggable={false}
          onError={onError}
        />
      </span>
    );
  }

  const rows = pet.manifest.spriteVersionNumber === 2 ? 11 : 9;
  const row = Math.max(0, Math.min(rows - 1, stateAsset.row ?? 0));
  const frames = Math.max(1, Math.min(CODEX_COLUMNS, stateAsset.frames ?? 1));
  const scale = Math.min(width / CODEX_CELL_WIDTH, height / CODEX_CELL_HEIGHT);
  const spriteStyle = {
    backgroundImage: `url(${assetUrl})`,
    backgroundPositionY: `${-row * CODEX_CELL_HEIGHT}px`,
    backgroundSize: `${CODEX_CELL_WIDTH * CODEX_COLUMNS}px ${CODEX_CELL_HEIGHT * rows}px`,
    transform: `scale(${scale})`,
    "--pet-sprite-end-x": `${-frames * CODEX_CELL_WIDTH}px`,
    "--pet-sprite-frames": frames,
    "--pet-sprite-duration": `${Math.max(frames * 260, 1400)}ms`,
  } as CSSProperties;

  return (
    <span
      className={`pet-artwork pet-artwork-sprite-viewport ${className}`}
      style={{ width, height }}
      role="img"
      aria-label={alt}
    >
      <img
        className="pet-artwork-sprite-probe"
        src={assetUrl}
        alt=""
        aria-hidden="true"
        onError={onError}
      />
      <span
        className={`pet-artwork-sprite ${animated && frames > 1 ? "is-animated" : ""}`}
        style={spriteStyle}
        aria-hidden="true"
      />
    </span>
  );
}
