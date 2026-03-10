import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReactCrop, { convertToPixelCrop } from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";
import {
  Plus,
  Camera,
  MapPin,
  Briefcase,
  Package2,
  Search,
  Upload,
  X,
  Loader2,
  Trash2,
  Pencil,
  Download,
  Map as MapIcon,
  ListPlus,
  Link2,
} from "lucide-react";
import { supabase, isSupabaseConfigured } from "./lib/supabase.js";

function getCroppedImg(image, crop) {
  if (!crop?.width || !crop?.height) return Promise.reject(new Error("No crop"));
  const pixelCrop = crop.unit === "px" ? crop : convertToPixelCrop(crop, image.width, image.height);
  const scaleX = image.naturalWidth / image.width;
  const scaleY = image.naturalHeight / image.height;
  const canvas = document.createElement("canvas");
  canvas.width = pixelCrop.width * scaleX;
  canvas.height = pixelCrop.height * scaleY;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(
    image,
    pixelCrop.x * scaleX, pixelCrop.y * scaleY, pixelCrop.width * scaleX, pixelCrop.height * scaleY,
    0, 0, canvas.width, canvas.height
  );
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Canvas toBlob failed"))), "image/jpeg", 0.9);
  });
}

const AUTH_SESSION_KEY = "propstagram_authed";
const AUTH_ROLE_KEY = "propstagram_role";
const SHARE_LIST_IDS_KEY = "propstagram_share_list_ids";
const PASSWORD_HASH_ENV = "VITE_PASSWORD_HASH";
const LOGINS_ENV = "VITE_LOGINS";

/** Parse VITE_LOGINS (username:passwordHash:role,...) or fallback to single VITE_PASSWORD_HASH as editor. */
function parseLogins() {
  const loginsRaw = import.meta.env[LOGINS_ENV];
  if (typeof loginsRaw === "string" && loginsRaw.trim()) {
    const entries = [];
    const parts = loginsRaw.split(",").map((p) => p.trim()).filter(Boolean);
    for (const part of parts) {
      // Parse so the middle (hash) can be 64 hex chars; only first and last colon are delimiters.
      const firstColon = part.indexOf(":");
      const lastColon = part.lastIndexOf(":");
      if (firstColon === -1 || lastColon === -1 || firstColon === lastColon) continue;
      const username = part.slice(0, firstColon).trim().toLowerCase();
      const hash = part.slice(firstColon + 1, lastColon).trim().toLowerCase();
      const role = part.slice(lastColon + 1).trim().toLowerCase();
      if (username && hash && (role === "client" || role === "editor"))
        entries.push({ username, passwordHash: hash, role });
    }
    if (entries.length) {
      if (import.meta.env.DEV) {
        console.log("[Login] Parsed logins:", entries.length, "→", entries.map((e) => e.username).join(", "));
      }
      return entries;
    }
  }
  const singleHash = import.meta.env[PASSWORD_HASH_ENV];
  if (typeof singleHash === "string" && singleHash.trim())
    return [{ username: "editor", passwordHash: singleHash.trim().toLowerCase(), role: "editor" }];
  return [];
}

function isPasswordProtectionEnabled() {
  return parseLogins().length > 0;
}

function isAuthenticated() {
  return sessionStorage.getItem(AUTH_SESSION_KEY) === "1";
}

function getAuthenticatedRole() {
  const role = sessionStorage.getItem(AUTH_ROLE_KEY);
  return role === "client" || role === "editor" ? role : "editor";
}

function setAuthenticated(role) {
  sessionStorage.setItem(AUTH_SESSION_KEY, "1");
  sessionStorage.setItem(AUTH_ROLE_KEY, role === "client" ? "client" : "editor");
}

function clearAuthenticated() {
  sessionStorage.removeItem(AUTH_SESSION_KEY);
  sessionStorage.removeItem(AUTH_ROLE_KEY);
}

async function hashPassword(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function checkPassword(enteredPassword, expectedHashHex) {
  if (!enteredPassword || !expectedHashHex) return false;
  const enteredHash = await hashPassword(enteredPassword);
  return enteredHash.toLowerCase() === String(expectedHashHex).trim().toLowerCase();
}

function LoginPage({ onSuccess }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const logins = useMemo(() => parseLogins(), []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const u = username.trim().toLowerCase();
      const match = logins.find((l) => l.username === u);
      const ok = match && (await checkPassword(password, match.passwordHash));
      if (ok) {
        setAuthenticated(match.role);
        onSuccess();
      } else {
        setError(
          import.meta.env.DEV
            ? "Wrong username or password. (Check the browser console to see which logins were loaded.)"
            : "Wrong username or password"
        );
        setPassword("");
      }
    } catch (err) {
      setError(err?.message || "Login failed. Try again.");
      setPassword("");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-cream-100 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <img
            src="/macguffin.png"
            alt="MacGuffin"
            className="h-10 w-auto mx-auto object-contain"
            width={235}
            height={120}
          />
          <p className="mt-3 font-sans text-ink-600">Propstagram</p>
        </div>
        <form onSubmit={handleSubmit} className="rounded-3xl border border-ink-200 bg-cream-50 p-6 shadow-soft space-y-4">
          <div>
            <label htmlFor="login-username" className="block text-sm font-medium text-ink-700 mb-2">
              Username
            </label>
            <input
              id="login-username"
              type="text"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter username"
              className="h-11 w-full rounded-2xl border border-ink-200 bg-cream-50 px-4 font-sans text-ink-900 placeholder:text-ink-500 focus:border-accent focus:ring-2 focus:ring-accent/20 outline-none transition-colors"
            />
          </div>
          <div>
            <label htmlFor="login-password" className="block text-sm font-medium text-ink-700 mb-2">
              Password
            </label>
            <input
              id="login-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              autoComplete="current-password"
              className="h-11 w-full rounded-2xl border border-ink-200 bg-cream-50 px-4 font-sans text-ink-900 placeholder:text-ink-500 focus:border-accent focus:ring-2 focus:ring-accent/20 outline-none transition-colors"
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={submitting}
            className="w-full h-11 rounded-2xl bg-ink-900 text-cream-50 font-medium hover:bg-ink-800 focus:outline-none focus:ring-2 focus:ring-ink-700 disabled:opacity-50"
          >
            {submitting ? "Checking…" : "Log in"}
          </button>
        </form>
      </div>
    </div>
  );
}

// Custom prop room map: shelf-based selection (hover to highlight, click to select shelf)
const ROOM_MAP_URL = "/prop-room-map.svg";

// Shelf regions matching placeholder SVG (viewBox 800×500), normalized to 0–1: [x, y, width, height]
const SHELF_REGIONS = [
  [0.05, 0.12, 0.225, 0.024], [0.05, 0.2, 0.225, 0.024], [0.05, 0.28, 0.225, 0.024], [0.05, 0.36, 0.225, 0.024], [0.05, 0.44, 0.225, 0.024],
  [0.325, 0.12, 0.35, 0.024], [0.325, 0.2, 0.35, 0.024], [0.325, 0.28, 0.35, 0.024], [0.325, 0.36, 0.35, 0.024], [0.325, 0.44, 0.35, 0.024],
  [0.725, 0.12, 0.225, 0.024], [0.725, 0.2, 0.225, 0.024], [0.725, 0.28, 0.225, 0.024], [0.725, 0.36, 0.225, 0.024], [0.725, 0.44, 0.225, 0.024],
  [0.775, 0.56, 0.015, 0.32], [0.825, 0.56, 0.015, 0.32], [0.875, 0.56, 0.015, 0.32],
  [0.35, 0.64, 0.3, 0.16],
];

function findShelfAt(map_x, map_y) {
  if (typeof map_x !== "number" || typeof map_y !== "number") return null;
  for (let i = 0; i < SHELF_REGIONS.length; i++) {
    const [x, y, w, h] = SHELF_REGIONS[i];
    if (map_x >= x && map_x <= x + w && map_y >= y && map_y <= y + h) return i;
  }
  return null;
}

function getShelfIndexForItem(item) {
  if (item == null) return null;
  if (item.shelf_index != null && Number.isInteger(item.shelf_index) && item.shelf_index >= 0 && item.shelf_index < SHELF_REGIONS.length)
    return item.shelf_index;
  if (typeof item.map_x === "number" && typeof item.map_y === "number") return findShelfAt(item.map_x, item.map_y);
  return null;
}

function RoomMap({ selectShelf, selectedShelfIndex, highlightShelfIndex, className = "" }) {
  const [hoverShelf, setHoverShelf] = useState(null);

  const displayShelf = highlightShelfIndex != null ? highlightShelfIndex : (selectedShelfIndex != null ? selectedShelfIndex : hoverShelf);
  const bounds = displayShelf != null && displayShelf >= 0 && displayShelf < SHELF_REGIONS.length ? SHELF_REGIONS[displayShelf] : null;
  const isHighlight = highlightShelfIndex != null;

  return (
    <div
      className={cn("relative w-full overflow-hidden rounded-2xl border border-ink-200 bg-cream-100", className)}
      style={{ aspectRatio: "8/5" }}
    >
      <img
        src={ROOM_MAP_URL}
        alt="Prop room layout"
        className="absolute inset-0 h-full w-full object-cover pointer-events-none"
        draggable={false}
      />
      {SHELF_REGIONS.map(([x, y, w, h], i) => (
        <button
          key={i}
          type="button"
          className={cn(
            "absolute border-2 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1",
            selectShelf
              ? "cursor-pointer border-transparent bg-transparent hover:border-amber-400 hover:bg-amber-400/30"
              : "pointer-events-none border-transparent"
          )}
          style={{
            left: `${x * 100}%`,
            top: `${y * 100}%`,
            width: `${w * 100}%`,
            height: `${h * 100}%`,
          }}
          onClick={() => selectShelf?.(i)}
          onMouseEnter={() => selectShelf && setHoverShelf(i)}
          onMouseLeave={() => selectShelf && setHoverShelf(null)}
          aria-label={selectShelf ? `Select shelf ${i + 1}` : undefined}
        />
      ))}
      {bounds && !selectShelf && (
        <div
          className={cn(
            "absolute border-2 pointer-events-none",
            isHighlight ? "border-red-600 bg-red-500/50" : "border-amber-400 bg-amber-400/30"
          )}
          style={{
            left: `${bounds[0] * 100}%`,
            top: `${bounds[1] * 100}%`,
            width: `${bounds[2] * 100}%`,
            height: `${bounds[3] * 100}%`,
          }}
          aria-hidden
        />
      )}
      {selectShelf && (
        <p className="pointer-events-none absolute bottom-2 left-2 right-2 z-10 rounded-xl bg-ink-900/80 px-3 py-2 text-center text-sm text-cream-50 shadow-lg">
          Hover a shelf to highlight it, click to select
        </p>
      )}
    </div>
  );
}

const starterItems = [];

const sectionTitles = [
  "All Props",
  "White Plateware",
  "Earthtone Plateware",
  "Colored Plateware",
  "Earthtone Smalls",
  "White Smalls",
  "Metal Smalls",
  "Copper",
  "Pots/Pans",
  "Utensils",
  "Miscellaneous",
  "Surfaces",
];

const starterJobs = ["General Inventory"];

function cn(...classes) {
  return classes.filter(Boolean).join(" ");
}

function Button({
  children,
  className = "",
  variant = "default",
  size = "default",
  ...props
}) {
  const base =
    "inline-flex items-center justify-center transition-all duration-200 font-medium disabled:opacity-50 disabled:pointer-events-none focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-ink-700";

  const variants = {
    default:
      "bg-ink-900 text-cream-50 hover:bg-ink-800 focus-visible:ring-ink-700 shadow-soft active:scale-[0.98]",
    primary:
      "bg-accent text-ink-900 hover:bg-accent-light focus-visible:ring-accent shadow-soft active:scale-[0.98]",
    outline:
      "border border-ink-200 bg-cream-50 text-ink-800 hover:bg-cream-200 hover:border-ink-300 focus-visible:ring-ink-400",
    secondary:
      "border border-ink-200 bg-cream-200 text-ink-800 hover:bg-cream-300 focus-visible:ring-ink-400",
    ghost: "bg-transparent text-ink-800 hover:bg-cream-200 focus-visible:ring-ink-300",
  };

  const sizes = {
    default: "h-11 px-5 py-2 rounded-2xl text-sm",
    icon: "h-11 w-11 rounded-2xl",
  };

  return (
    <button
      className={cn(base, variants[variant], sizes[size], className)}
      {...props}
    >
      {children}
    </button>
  );
}

function Card({ children, className = "", ...props }) {
  return (
    <div
      className={cn(
        "rounded-3xl border border-ink-200/80 bg-cream-50 shadow-soft",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

function CardHeader({ children, className = "" }) {
  return <div className={cn("p-6 pb-0", className)}>{children}</div>;
}

function CardTitle({ children, className = "" }) {
  return (
    <h3 className={cn("font-sans text-lg font-semibold text-ink-900", className)}>
      {children}
    </h3>
  );
}

function CardContent({ children, className = "" }) {
  return <div className={cn("p-6", className)}>{children}</div>;
}

function Input({ className = "", ...props }) {
  return (
    <input
      className={cn(
        "h-11 w-full rounded-2xl border border-ink-200 bg-cream-50 px-4 font-sans text-ink-900 outline-none placeholder:text-ink-500 focus:border-accent focus:ring-2 focus:ring-accent/20 transition-colors",
        className
      )}
      {...props}
    />
  );
}

function Textarea({ className = "", ...props }) {
  return (
    <textarea
      className={cn(
        "w-full rounded-2xl border border-ink-200 bg-cream-50 px-4 py-3 font-sans text-ink-900 outline-none placeholder:text-ink-500 focus:border-accent focus:ring-2 focus:ring-accent/20 transition-colors resize-none",
        className
      )}
      {...props}
    />
  );
}

function Label({ children, className = "" }) {
  return (
    <label className={cn("text-sm font-medium text-ink-700", className)}>
      {children}
    </label>
  );
}

function Badge({ children, className = "" }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border border-ink-200 bg-cream-200 px-3 py-1 text-xs font-medium text-ink-700",
        className
      )}
    >
      {children}
    </span>
  );
}

function Modal({ open, onClose, children, title = "Add prop/surface" }) {
  useEffect(() => {
    if (!open) return;
    const handleEscape = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [open, onClose]);

  useEffect(() => {
    if (open) {
      const firstInput = document.querySelector("#add-prop-modal input, #add-prop-modal textarea");
      if (firstInput) setTimeout(() => firstInput.focus(), 50);
    }
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink-900/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        id="add-prop-modal"
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl border border-ink-200 bg-cream-50 shadow-soft-lg flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-ink-200 bg-cream-50/95 backdrop-blur px-6 py-4 rounded-t-3xl">
          <h2 className="font-sans text-lg font-semibold text-ink-900" id="add-prop-title">
            {title}
          </h2>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="rounded-2xl text-ink-600 hover:text-ink-900"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>
        <div className="p-6 flex-1 flex flex-col min-h-0">{children}</div>
      </div>
    </div>
  );
}

function ItemCard({ item, onClick, onAddToList, showLocation = true }) {
  return (
    <Card
      role="button"
      tabIndex={0}
      onClick={() => onClick?.(item)}
      onKeyDown={(e) => e.key === "Enter" && onClick?.(item)}
      className="cursor-pointer overflow-hidden transition-all duration-300 hover:shadow-soft-lg hover:-translate-y-0.5 group"
    >
      <div className="aspect-[4/3] bg-cream-200 overflow-hidden">
        {item.photo ? (
          <img
            src={item.photo}
            alt={item.title}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-ink-400">
            <Camera className="h-10 w-10 opacity-60" strokeWidth={1.25} />
          </div>
        )}
      </div>

      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h3 className="font-sans text-xl font-semibold text-ink-900 truncate">
              {item.title}
            </h3>
            <p className="mt-2 text-sm leading-6 text-ink-600 line-clamp-2">
              {item.description || "No description added yet."}
            </p>
          </div>

          <div className="flex flex-shrink-0 flex-col gap-2 items-end">
            {onAddToList ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="rounded-xl text-ink-600 hover:text-ink-900 -mr-1 -mt-1"
                onClick={(e) => { e.stopPropagation(); e.preventDefault(); onAddToList(item); }}
                aria-label="Add to list"
              >
                <ListPlus className="h-4 w-4" />
              </Button>
            ) : null}
            <Badge>{item.category || "Prop"}</Badge>
            {item.job ? (
              <Badge className="bg-cream-200/80">{item.job}</Badge>
            ) : null}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-4 text-sm text-ink-600">
          {item.code ? (
            <span className="font-mono font-semibold text-ink-800">{item.code}</span>
          ) : null}
          {showLocation && (
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-ink-500 flex-shrink-0" />
              <span className="truncate">{item.location}</span>
            </div>
          )}
          {item.job ? (
            <div className="flex items-center gap-2">
              <Briefcase className="h-4 w-4 text-ink-500 flex-shrink-0" />
              <span>{item.job}</span>
            </div>
          ) : null}
          <div className="flex items-center gap-2">
            <Package2 className="h-4 w-4 text-ink-500 flex-shrink-0" />
            <span>Qty: {item.quantity || 1}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function PropDetailModal({ item, onClose, onDelete, onEdit, onOpenLightbox, canEdit = true, onAddToList, showLocation = true }) {
  const [showDeleteConfirm, setShowDeleteConfirm] = React.useState(false);

  useEffect(() => {
    if (!item) return;
    const handleEscape = (e) => {
      if (e.key === "Escape") {
        setShowDeleteConfirm(false);
        onClose();
      }
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [item, onClose]);

  if (!item) return null;

  const handleDelete = () => {
    onDelete(item);
    onClose();
  };

  const handleEdit = () => {
    onEdit(item);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink-900/40 backdrop-blur-sm"
      onClick={() => !showDeleteConfirm && onClose()}
    >
      <div
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl border border-ink-200 bg-cream-50 shadow-soft-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-ink-200 bg-cream-50 px-6 py-4 rounded-t-3xl">
          <h2 className="font-sans text-lg font-semibold text-ink-900 truncate pr-4">
            {item.title}
          </h2>
          <div className="flex items-center gap-2 flex-shrink-0">
            {canEdit && (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleEdit}
                  className="rounded-2xl text-ink-600 hover:text-ink-900"
                  aria-label="Edit prop"
                >
                  <Pencil className="h-5 w-5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowDeleteConfirm(true)}
                  className="rounded-2xl text-red-600 hover:bg-red-50 hover:text-red-700"
                  aria-label="Delete prop"
                >
                  <Trash2 className="h-5 w-5" />
                </Button>
              </>
            )}
            {onAddToList && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onAddToList(item)}
                className="rounded-2xl text-ink-600 hover:text-ink-900"
                aria-label="Add to list"
                title="Add to list"
              >
                <ListPlus className="h-5 w-5" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="rounded-2xl text-ink-600 hover:text-ink-900"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>
        <div className="p-6">
          <div
            className="aspect-[4/3] max-h-80 w-full rounded-2xl overflow-hidden bg-cream-200 cursor-pointer"
            onClick={() => item.photo && onOpenLightbox?.(item.photo)}
            role={item.photo ? "button" : undefined}
            tabIndex={item.photo ? 0 : undefined}
            onKeyDown={(e) => item.photo && e.key === "Enter" && onOpenLightbox?.(item.photo)}
          >
            {item.photo ? (
              <img
                src={item.photo}
                alt={item.title}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full items-center justify-center text-ink-400">
                <Camera className="h-16 w-16 opacity-60" strokeWidth={1.25} />
              </div>
            )}
          </div>

          {showDeleteConfirm ? (
            <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4">
              <p className="font-sans text-sm font-medium text-red-900">
                Delete this prop? This cannot be undone.
              </p>
              <div className="mt-4 flex gap-3">
                <Button
                  variant="outline"
                  className="rounded-2xl"
                  onClick={() => setShowDeleteConfirm(false)}
                >
                  Cancel
                </Button>
                <Button
                  className="rounded-2xl bg-red-600 text-white hover:bg-red-700"
                  onClick={handleDelete}
                >
                  Delete
                </Button>
              </div>
            </div>
          ) : null}

          <div className="mt-6 space-y-4">
            {item.description ? (
              <p className="font-sans text-ink-700 leading-relaxed">
                {item.description}
              </p>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <Badge>{item.category || "Prop"}</Badge>
              {item.job ? <Badge className="bg-cream-200/80">{item.job}</Badge> : null}
            </div>
            <div className="flex flex-wrap gap-4 font-sans text-sm text-ink-600">
              {item.code ? (
                <div className="flex items-center gap-2 font-mono font-semibold text-ink-800">
                  <span>Code: {item.code}</span>
                </div>
              ) : null}
              {showLocation && (
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-ink-500 flex-shrink-0" />
                  <span>{item.location}</span>
                </div>
              )}
              {item.job ? (
                <div className="flex items-center gap-2">
                  <Briefcase className="h-4 w-4 text-ink-500 flex-shrink-0" />
                  <span>{item.job}</span>
                </div>
              ) : null}
              <div className="flex items-center gap-2">
                <Package2 className="h-4 w-4 text-ink-500 flex-shrink-0" />
                <span>Qty: {item.quantity || 1}</span>
              </div>
              {(item.length || item.width) ? (
                <div className="flex items-center gap-2">
                  <span className="text-ink-500 font-medium">Dimensions:</span>
                  <span>{[item.length, item.width].filter(Boolean).join(" × ")}</span>
                </div>
              ) : null}
            </div>

            {getShelfIndexForItem(item) != null ? (
              <div className="mt-6">
                <span className="font-sans text-sm font-medium text-ink-700 block mb-2">Location on floor plan</span>
                <div className="w-full rounded-2xl overflow-hidden border border-ink-200" style={{ aspectRatio: "8/5" }}>
                  <RoomMap highlightShelfIndex={getShelfIndexForItem(item)} />
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function PhotoCropModal({ src, onComplete, onCancel }) {
  const imgRef = useRef(null);
  const [crop, setCrop] = useState(undefined);
  const [applying, setApplying] = useState(false);

  useEffect(() => {
    const handleEscape = (e) => e.key === "Escape" && onCancel();
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [onCancel]);

  const onImageLoad = () => {
    setCrop({ unit: "%", x: 0, y: 0, width: 100, height: 100 });
  };

  const handleApply = async () => {
    if (!imgRef.current || !crop?.width || !crop?.height) return;
    setApplying(true);
    try {
      const blob = await getCroppedImg(imgRef.current, crop);
      onComplete(blob);
    } finally {
      setApplying(false);
    }
  };

  if (!src) return null;
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-ink-900/80 p-4" onClick={onCancel}>
      <div className="flex max-h-[90vh] w-full max-w-lg flex-col rounded-2xl border border-ink-200 bg-cream-50 shadow-soft-lg" onClick={(e) => e.stopPropagation()}>
        <div className="border-b border-ink-200 px-4 py-3 font-sans font-medium text-ink-900">Crop photo</div>
        <div className="overflow-auto p-4">
          <ReactCrop crop={crop} onChange={(c) => setCrop(c)} className="max-h-[60vh]">
            <img ref={imgRef} src={src} alt="Crop" style={{ maxHeight: "60vh", width: "auto" }} onLoad={onImageLoad} />
          </ReactCrop>
        </div>
        <div className="flex gap-3 border-t border-ink-200 p-4">
          <Button type="button" variant="outline" className="rounded-2xl flex-1" onClick={onCancel} disabled={applying}>
            Back
          </Button>
          <Button type="button" variant="primary" className="rounded-2xl flex-1" onClick={handleApply} disabled={applying || !crop}>
            {applying ? "Accepting…" : "Accept"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function Lightbox({ imageUrl, onClose }) {
  useEffect(() => {
    const handleEscape = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [onClose]);
  if (!imageUrl) return null;
  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 p-4"
      onClick={onClose}
    >
      <img
        src={imageUrl}
        alt=""
        className="max-h-full max-w-full object-contain"
        onClick={(e) => e.stopPropagation()}
      />
      <Button
        variant="ghost"
        size="icon"
        onClick={onClose}
        className="absolute right-4 top-4 rounded-2xl text-white hover:bg-white/20"
        aria-label="Close"
      >
        <X className="h-6 w-6" />
      </Button>
    </div>
  );
}

function ShareView({ listId, onBack }) {
  const [list, setList] = useState(null);
  const [props, setProps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);
  const [lightboxImage, setLightboxImage] = useState(null);
  const [copied, setCopied] = useState(false);

  const shareUrl = typeof window !== "undefined" ? `${window.location.origin}${window.location.pathname}#/share/${listId}` : "";

  useEffect(() => {
    if (!listId || !supabase) {
      setLoading(false);
      if (!supabase) setError("Shared lists are not configured.");
      return;
    }
    let cancelled = false;
    (async () => {
      const { data: listData, error: listErr } = await supabase
        .from("shared_lists")
        .select("id, name, created_at")
        .eq("id", listId)
        .maybeSingle();
      if (cancelled) return;
      if (listErr || !listData) {
        setError("List not found.");
        setLoading(false);
        return;
      }
      setList(listData);
      const { data: itemsData, error: itemsErr } = await supabase
        .from("shared_list_items")
        .select("prop_id, sort_order")
        .eq("list_id", listId)
        .order("sort_order");
      if (cancelled) return;
      if (itemsErr || !itemsData?.length) {
        setProps([]);
        setLoading(false);
        return;
      }
      const propIds = itemsData.map((r) => r.prop_id);
      const { data: propsData, error: propsErr } = await supabase
        .from("props")
        .select("id, title, description, location, category, job, quantity, photo, code, created_at")
        .in("id", propIds);
      if (cancelled) return;
      const orderMap = new Map(itemsData.map((r, i) => [r.prop_id, i]));
      const sorted = (propsData || []).slice().sort((a, b) => (orderMap.get(a.id) ?? 0) - (orderMap.get(b.id) ?? 0));
      setProps(sorted);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [listId]);

  const copyLink = () => {
    if (!shareUrl) return;
    navigator.clipboard.writeText(shareUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-cream-100 flex items-center justify-center p-6">
        <Loader2 className="h-10 w-10 animate-spin text-ink-400" />
      </div>
    );
  }
  if (error) {
    return (
      <div className="min-h-screen bg-cream-100 flex flex-col items-center justify-center p-6">
        <p className="font-sans text-ink-700">{error}</p>
        {onBack && (
          <Button variant="outline" className="mt-4 rounded-2xl" onClick={onBack}>
            Back to app
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cream-100 text-ink-900">
      <div className="mx-auto max-w-4xl px-4 py-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="font-sans text-2xl font-semibold text-ink-900">
              {list?.name || "Shared list"}
            </h1>
            <p className="mt-1 text-sm text-ink-600">
              {props.length} {props.length === 1 ? "prop" : "props"}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="primary"
              className="rounded-2xl"
              onClick={copyLink}
            >
              <Link2 className="mr-2 h-4 w-4" />
              {copied ? "Copied!" : "Copy link"}
            </Button>
            {onBack && (
              <Button type="button" variant="outline" className="rounded-2xl" onClick={onBack}>
                Back to app
              </Button>
            )}
          </div>
        </div>
        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {props.map((item) => (
            <ItemCard key={item.id} item={item} onClick={setSelectedItem} />
          ))}
        </div>
        {props.length === 0 && (
          <p className="mt-8 text-center font-sans text-ink-600">This list has no props yet.</p>
        )}
      </div>
      {selectedItem && (
        <PropDetailModal
          item={selectedItem}
          onClose={() => setSelectedItem(null)}
          onDelete={() => {}}
          onEdit={() => {}}
          onOpenLightbox={setLightboxImage}
          canEdit={false}
        />
      )}
      <Lightbox imageUrl={lightboxImage} onClose={() => setLightboxImage(null)} />
    </div>
  );
}

function AddToListModal({ open, item, onClose }) {
  const [newListName, setNewListName] = useState("");
  const [myLists, setMyLists] = useState([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createdListId, setCreatedListId] = useState(null);
  const [shareUrl, setShareUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const [addingId, setAddingId] = useState(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!open || !item || !supabase) return;
    setCreatedListId(null);
    setShareUrl("");
    setNewListName("");
    setMessage("");
    const ids = JSON.parse(localStorage.getItem(SHARE_LIST_IDS_KEY) || "[]");
    if (!ids.length) {
      setMyLists([]);
      return;
    }
    setLoading(true);
    supabase
      .from("shared_lists")
      .select("id, name")
      .in("id", ids)
      .then(({ data }) => {
        setMyLists(data || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [open, item?.id]);

  const createList = async () => {
    if (!item || !supabase) return;
    setCreating(true);
    const { data: listRow, error: listErr } = await supabase
      .from("shared_lists")
      .insert({ name: newListName.trim() || null })
      .select("id")
      .single();
    if (listErr || !listRow) {
      setMessage("Could not create list. Try again.");
      setCreating(false);
      return;
    }
    const listId = listRow.id;
    const { error: itemErr } = await supabase
      .from("shared_list_items")
      .insert({ list_id: listId, prop_id: item.id });
    if (itemErr) {
      setMessage("List created but could not add prop. Try adding it from the list.");
    }
    const ids = JSON.parse(localStorage.getItem(SHARE_LIST_IDS_KEY) || "[]");
    if (!ids.includes(listId)) {
      localStorage.setItem(SHARE_LIST_IDS_KEY, JSON.stringify([...ids, listId]));
    }
    setCreatedListId(listId);
    setShareUrl(`${window.location.origin}${window.location.pathname}#/share/${listId}`);
    setMyLists((prev) => [...prev, { id: listId, name: newListName.trim() || "Untitled list" }]);
    setCreating(false);
  };

  const addToList = async (listId) => {
    if (!item || !supabase) return;
    setAddingId(listId);
    const { error } = await supabase
      .from("shared_list_items")
      .upsert({ list_id: listId, prop_id: item.id }, { onConflict: "list_id,prop_id" });
    setAddingId(null);
    if (error) setMessage("Could not add to list.");
    else setMessage("Added to list.");
  };

  const copyShareLink = () => {
    if (!shareUrl) return;
    navigator.clipboard.writeText(shareUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  if (!open) return null;
  return (
    <Modal open={true} onClose={onClose} title="Add to list">
      <div className="space-y-6">
        {message && (
          <p className={cn("text-sm", message.startsWith("Could") ? "text-red-600" : "text-ink-700")}>
            {message}
          </p>
        )}
        {!createdListId ? (
          <>
            <div>
              <Label className="block mb-2">Create new list</Label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newListName}
                  onChange={(e) => setNewListName(e.target.value)}
                  placeholder="List name (optional)"
                  className="h-11 flex-1 rounded-2xl border border-ink-200 bg-cream-50 px-4 font-sans text-ink-900 placeholder:text-ink-500 focus:border-accent focus:ring-2 focus:ring-accent/20 outline-none"
                />
                <Button
                  type="button"
                  variant="primary"
                  className="rounded-2xl shrink-0"
                  onClick={createList}
                  disabled={creating}
                >
                  {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create"}
                </Button>
              </div>
            </div>
            {loading ? (
              <p className="text-sm text-ink-600">Loading your lists…</p>
            ) : myLists.length > 0 ? (
              <div>
                <Label className="block mb-2">Add to existing list</Label>
                <ul className="space-y-2">
                  {myLists.map((list) => (
                    <li key={list.id} className="flex items-center justify-between rounded-2xl border border-ink-200 bg-cream-50 px-4 py-2">
                      <span className="font-sans text-ink-900">{list.name || "Untitled list"}</span>
                      <Button
                        type="button"
                        variant="outline"
                        size="default"
                        className="rounded-xl"
                        onClick={() => addToList(list.id)}
                        disabled={addingId === list.id}
                      >
                        {addingId === list.id ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add"}
                      </Button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </>
        ) : (
          <div className="rounded-2xl border border-ink-200 bg-cream-100 p-4">
            <p className="font-sans text-sm font-medium text-ink-800">List created. Share this link:</p>
            <div className="mt-2 flex gap-2">
              <input
                type="text"
                readOnly
                value={shareUrl}
                className="flex-1 rounded-xl border border-ink-200 bg-cream-50 px-3 py-2 font-mono text-sm text-ink-700"
              />
              <Button type="button" variant="primary" className="rounded-xl shrink-0" onClick={copyShareLink}>
                {copied ? "Copied!" : "Copy"}
              </Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

function PropRoomInventoryApp({ isEditor = true }) {
  const [items, setItems] = useState(starterItems);
  const [search, setSearch] = useState("");
  const [activeSection, setActiveSection] = useState("All Props");
  const [sections, setSections] = useState(sectionTitles);
  const [jobs, setJobs] = useState(starterJobs);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [lightboxImage, setLightboxImage] = useState(null);
  const [sortBy, setSortBy] = useState("date");
  const [mapPickerOpen, setMapPickerOpen] = useState(false);
  const [photoToCrop, setPhotoToCrop] = useState(null);
  const [addToListItem, setAddToListItem] = useState(null);
  const [form, setForm] = useState({
    title: "",
    description: "",
    location: "",
    category: "White Plateware",
    job: "General Inventory",
    quantity: 1,
    photo: "",
    latitude: null,
    longitude: null,
    map_x: null,
    map_y: null,
    shelf_index: null,
    length: "",
    width: "",
    code: "",
  });

  const cameraInputRef = useRef(null);
  const libraryInputRef = useRef(null);
  const formPhotoFileRef = useRef(null);

  const [loading, setLoading] = useState(isSupabaseConfigured());
  const [saveError, setSaveError] = useState(null);
  const [saving, setSaving] = useState(false);

  const availableSections = sections.filter((s) => s !== "All Props");

  const fetchProps = useCallback(async () => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setSaveError(null);
    const { data, error } = await supabase
      .from("props")
      .select("id, title, description, location, category, job, quantity, photo, latitude, longitude, map_x, map_y, shelf_index, length, width, code, created_at")
      .order("created_at", { ascending: false });
    if (error) {
      setSaveError("Could not load props. Check your Supabase setup.");
      setLoading(false);
      return;
    }
    setItems(data || []);
    setLoading(false);
  }, []);

  const fetchJobs = useCallback(async () => {
    if (!supabase) return;
    const { data, error } = await supabase.from("jobs").select("name").order("created_at");
    if (error) return;
    setJobs(data?.length ? data.map((r) => r.name) : starterJobs);
  }, []);

  const fetchSections = useCallback(async () => {
    if (!supabase) return;
    const { data, error } = await supabase
      .from("sections")
      .select("name, sort_order")
      .order("sort_order");
    if (error) return;
    const names = data?.length ? data.map((r) => r.name) : sectionTitles.filter((s) => s !== "All Props");
    setSections(["All Props", ...names]);
  }, []);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      await fetchProps();
      if (cancelled) return;
      await Promise.all([fetchJobs(), fetchSections()]);
    })();
    return () => { cancelled = true; };
  }, [fetchProps, fetchJobs, fetchSections]);

  useEffect(() => {
    if (!supabase) return;
    const channel = supabase
      .channel("shared-data")
      .on("postgres_changes", { event: "*", schema: "public", table: "props" }, fetchProps)
      .on("postgres_changes", { event: "*", schema: "public", table: "jobs" }, fetchJobs)
      .on("postgres_changes", { event: "*", schema: "public", table: "sections" }, fetchSections)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchProps, fetchJobs, fetchSections]);

  const addSection = async () => {
    const nextSection = window.prompt("Add a new section name");
    if (!nextSection) return;

    const title = nextSection.trim();
    if (!title) return;

    const existing = sections.find((s) => s.toLowerCase() === title.toLowerCase());
    if (existing) {
      setForm((current) => ({ ...current, category: existing }));
      return;
    }

    if (supabase) {
      const { data: maxRow } = await supabase
        .from("sections")
        .select("sort_order")
        .order("sort_order", { ascending: false })
        .limit(1)
        .maybeSingle();
      const nextOrder = (maxRow?.sort_order ?? 0) + 1;
      const { error } = await supabase.from("sections").insert({ name: title, sort_order: nextOrder });
      if (error) {
        if (error.code === "23505") {
          setForm((current) => ({ ...current, category: title }));
        }
        return;
      }
      await fetchSections();
    } else {
      setSections((current) => [...current, title]);
    }
    setForm((current) => ({ ...current, category: title }));
  };

  const addJob = async () => {
    const nextJob = window.prompt("Add a new job name");
    if (!nextJob) return;

    const title = nextJob.trim();
    if (!title) return;

    const existingJob = jobs.find((j) => j.toLowerCase() === title.toLowerCase());
    if (existingJob) {
      setForm((current) => ({ ...current, job: existingJob }));
      return;
    }

    if (supabase) {
      const { error } = await supabase.from("jobs").insert({ name: title });
      if (error) {
        if (error.code === "23505") setForm((current) => ({ ...current, job: title }));
        return;
      }
      await fetchJobs();
    } else {
      setJobs((current) => [...current, title]);
    }
    setForm((current) => ({ ...current, job: title }));
  };

  const GENERAL_INVENTORY = "General Inventory";

  const filteredItems = useMemo(() => {
    const q = search.toLowerCase().trim();
    const jobFiltered =
      isEditor ? items : items.filter((item) => (item.job || "").trim() === GENERAL_INVENTORY);

    const filtered = jobFiltered.filter((item) => {
      const matchesSection =
        activeSection === "All Props" ||
        (item.category || "").toLowerCase() === activeSection.toLowerCase();

      const matchesQuery =
        !q ||
        [item.title, item.description, item.location, item.category, item.job, item.code]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(q);

      return matchesSection && matchesQuery;
    });

    const effectiveSort = isEditor ? sortBy : sortBy === "location" ? "date" : sortBy;
    const sorted = [...filtered].sort((a, b) => {
      if (effectiveSort === "title")
        return (a.title || "").localeCompare(b.title || "", undefined, { sensitivity: "base" });
      if (effectiveSort === "location")
        return (a.location || "").localeCompare(b.location || "", undefined, { sensitivity: "base" });
      const dateA = a.created_at ? new Date(a.created_at) : new Date(0);
      const dateB = b.created_at ? new Date(b.created_at) : new Date(0);
      return dateB - dateA;
    });
    return sorted;
  }, [items, search, activeSection, sortBy, isEditor]);

  const revokePhotoUrl = (url) => {
    if (typeof url === "string" && url.startsWith("blob:")) {
      URL.revokeObjectURL(url);
    }
  };

  const handlePhotoFile = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setPhotoToCrop(URL.createObjectURL(file));
    event.target.value = "";
  };

  const handleCropComplete = useCallback(
    (blob) => {
      if (photoToCrop) URL.revokeObjectURL(photoToCrop);
      setPhotoToCrop(null);
      const url = URL.createObjectURL(blob);
      formPhotoFileRef.current = new File([blob], "photo.jpg", { type: "image/jpeg" });
      setForm((current) => {
        if (current.photo && current.photo.startsWith("blob:")) revokePhotoUrl(current.photo);
        return { ...current, photo: url };
      });
    },
    [photoToCrop]
  );

  const handleCropCancel = useCallback(() => {
    if (photoToCrop) URL.revokeObjectURL(photoToCrop);
    setPhotoToCrop(null);
  }, [photoToCrop]);

  const clearPhoto = () => {
    formPhotoFileRef.current = null;
    setForm((current) => {
      revokePhotoUrl(current.photo);
      return { ...current, photo: "" };
    });
  };

  const resetForm = () => {
    formPhotoFileRef.current = null;
    setEditingId(null);
    setForm((current) => {
      revokePhotoUrl(current.photo);
      return {
        title: "",
        description: "",
        location: "",
        category: "White Plateware",
        job: "General Inventory",
        quantity: 1,
        photo: "",
        latitude: null,
        longitude: null,
        map_x: null,
        map_y: null,
        shelf_index: null,
        length: "",
        width: "",
        code: "",
      };
    });
  };

  const generateCode = () =>
    String(Math.floor(10000 + Math.random() * 90000));

  const openAddForm = () => {
    setEditingId(null);
    setSaveError(null);
    formPhotoFileRef.current = null;
    setForm((prev) => {
      revokePhotoUrl(prev.photo);
      return {
        title: "",
        description: "",
        location: "",
        category: "White Plateware",
        job: "General Inventory",
        quantity: 1,
        photo: "",
        latitude: null,
        longitude: null,
        map_x: null,
        map_y: null,
        shelf_index: null,
        length: "",
        width: "",
        code: generateCode(),
      };
    });
    setIsModalOpen(true);
  };

  const openEditForm = (item) => {
    setForm({
      title: item.title || "",
      description: item.description || "",
      location: item.location || "",
      category: item.category || "White Plateware",
      job: item.job || "General Inventory",
      quantity: item.quantity ?? 1,
      photo: item.photo || "",
      latitude: item.latitude ?? null,
      longitude: item.longitude ?? null,
      map_x: item.map_x ?? null,
      map_y: item.map_y ?? null,
      shelf_index: item.shelf_index ?? null,
      length: item.length ?? "",
      width: item.width ?? "",
      code: item.code ?? "",
    });
    setEditingId(item.id);
    setSaveError(null);
    setIsModalOpen(true);
  };

  const addItem = async () => {
    if (!form.title.trim() || !form.location.trim()) {
      setSaveError("Title and location are required.");
      return;
    }
    setSaveError(null);

    const payload = {
      title: form.title.trim(),
      description: form.description.trim() || null,
      location: form.location.trim(),
      category: form.category,
      job: form.job.trim(),
      quantity: Math.max(1, Number(form.quantity || 1)),
      latitude:
        typeof form.latitude === "number" && !Number.isNaN(form.latitude) ? form.latitude : null,
      longitude:
        typeof form.longitude === "number" && !Number.isNaN(form.longitude) ? form.longitude : null,
      map_x:
        typeof form.map_x === "number" && !Number.isNaN(form.map_x) ? form.map_x : null,
      map_y:
        typeof form.map_y === "number" && !Number.isNaN(form.map_y) ? form.map_y : null,
      shelf_index:
        form.shelf_index != null && Number.isInteger(form.shelf_index) && form.shelf_index >= 0 ? form.shelf_index : null,
      length: form.length?.trim() || null,
      width: form.width?.trim() || null,
      code: form.code?.trim() || null,
    };

    if (supabase) {
      setSaving(true);
      console.log("[Save] Using Supabase, payload keys:", Object.keys(payload));
      try {
        let photoUrl = "";

        const file = formPhotoFileRef.current;
        if (file) {
          const ext = file.name.split(".").pop() || "jpg";
          const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
          const { error: uploadError } = await supabase.storage
            .from("prop-photos")
            .upload(path, file, { cacheControl: "3600", upsert: false });
          if (uploadError) {
            console.error("[Save] Photo upload error:", uploadError);
            setSaveError("Photo upload failed. You can save without a photo and try again.");
            return;
          }
          const { data: urlData } = supabase.storage.from("prop-photos").getPublicUrl(path);
          photoUrl = urlData?.publicUrl ?? "";
        } else if (form.photo && !form.photo.startsWith("blob:")) {
          photoUrl = form.photo;
        }
        payload.photo = photoUrl || null;

        if (editingId) {
          const { data: updateData, error } = await supabase.from("props").update(payload).eq("id", editingId).select();
          if (error) {
            console.error("[Save] Update error:", error);
            setSaveError(error.message || "Failed to update prop.");
            return;
          }
        } else {
          const { data: insertData, error } = await supabase.from("props").insert(payload).select();
          if (error) {
            console.error("[Save] Insert error:", error);
            setSaveError(error.message || "Failed to save prop.");
            return;
          }
        }
        console.log("[Save] Success.");
        formPhotoFileRef.current = null;
        setForm({
          title: "",
          description: "",
          location: "",
          category: "White Plateware",
          job: "General Inventory",
          quantity: 1,
          photo: "",
          latitude: null,
          longitude: null,
          map_x: null,
          map_y: null,
          shelf_index: null,
          length: "",
          width: "",
          code: "",
        });
        setEditingId(null);
        setIsModalOpen(false);
        await fetchProps();
        setSelectedItem(null);
      } catch (err) {
        console.error("[Save] Exception:", err);
        setSaveError(err?.message || String(err) || "Something went wrong. Try again.");
      } finally {
        setSaving(false);
      }
      return;
    }

    if (editingId) {
      setItems((current) =>
        current.map((i) =>
          i.id === editingId
            ? {
                ...i,
                ...payload,
                photo: form.photo.trim() || i.photo,
              }
            : i
        )
      );
      setSelectedItem(null);
    } else {
      setItems((current) => [
        {
          id: Date.now(),
          ...payload,
          photo: form.photo.trim(),
        },
        ...current,
      ]);
    }

    setForm({
      title: "",
      description: "",
      location: "",
      category: "White Plateware",
      job: "General Inventory",
      quantity: 1,
      photo: "",
      latitude: null,
      longitude: null,
      map_x: null,
      map_y: null,
      shelf_index: null,
      length: "",
      width: "",
      code: "",
    });
    setEditingId(null);
    setIsModalOpen(false);
  };

  const deleteItem = async (item) => {
    if (supabase) {
      const { error } = await supabase.from("props").delete().eq("id", item.id);
      if (error) return;
      await fetchProps();
    } else {
      setItems((current) => current.filter((i) => i.id !== item.id));
    }
    setSelectedItem(null);
  };

  const exportCSV = () => {
    const headers = ["Title", "Description", "Location", "Category", "Job", "Quantity"];
    const escape = (v) => {
      const s = String(v ?? "");
      return s.includes(",") || s.includes('"') || s.includes("\n")
        ? `"${s.replace(/"/g, '""')}"`
        : s;
    };
    const rows = filteredItems.map((item) =>
      [
        item.title,
        item.description ?? "",
        item.location,
        item.category ?? "",
        item.job ?? "",
        item.quantity ?? 1,
      ].map(escape).join(",")
    );
    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `props-${activeSection.replace(/\s+/g, "-")}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-cream-100 text-ink-900">
      {/* Subtle background texture */}
      <div className="fixed inset-0 pointer-events-none bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(184,134,11,0.06),transparent)]" />

      <div className="relative mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:py-8">
        {/* Header: MacGuffin logo + Propstagram */}
        <div className="mb-8 flex items-center justify-between gap-4 flex-wrap">
          <h1 className="flex items-center gap-3">
            <img
              src="/macguffin.png"
              alt="MacGuffin"
              className="h-11 w-auto object-contain object-left md:h-14"
              width={235}
              height={120}
            />
            <span className="font-sans text-xl font-medium tracking-tight text-ink-900 md:text-2xl">
              Propstagram
            </span>
          </h1>
          {isEditor && (
            <Button
              onClick={openAddForm}
              variant="primary"
              size="default"
              className="rounded-2xl shrink-0"
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Prop/Surface
            </Button>
          )}
        </div>

        <PropDetailModal
          item={selectedItem}
          onClose={() => setSelectedItem(null)}
          onDelete={deleteItem}
          onEdit={openEditForm}
          onOpenLightbox={setLightboxImage}
          canEdit={isEditor}
          onAddToList={(it) => setAddToListItem(it)}
          showLocation={isEditor}
        />

        <PhotoCropModal
          src={photoToCrop}
          onComplete={handleCropComplete}
          onCancel={handleCropCancel}
        />
        <AddToListModal
          open={!!addToListItem}
          item={addToListItem}
          onClose={() => setAddToListItem(null)}
        />
        <Lightbox imageUrl={lightboxImage} onClose={() => setLightboxImage(null)} />

        <Modal
          open={isModalOpen}
          onClose={() => {
            setSaveError(null);
            setEditingId(null);
            setIsModalOpen(false);
          }}
          title={editingId ? "Edit prop/surface" : "Add prop/surface"}
        >
          <div className="flex flex-col max-h-[70vh]">
            <div className="flex-1 overflow-y-auto pr-1">
              <div className="grid gap-5">
            {form.code ? (
              <div className="rounded-2xl border border-ink-200 bg-cream-200/60 px-4 py-3">
                <Label className="block mb-1 text-xs font-medium text-ink-600">Code (assign to this prop/surface)</Label>
                <p className="font-mono text-xl font-semibold text-ink-900 tracking-wider">{form.code}</p>
              </div>
            ) : null}
            <div>
              <Label className="block mb-1.5">Title</Label>
              <Input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="Vintage lamp"
              />
            </div>

            <div>
              <Label className="block mb-1.5">Description</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="min-h-24"
                placeholder="Color, material, era, condition, or where it works best on set"
              />
            </div>

            <div>
              <Label className="block mb-1.5">Location in prop room</Label>
              <Input
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
                placeholder="Shelf B3 · Wall 2"
              />
            </div>

            <div>
              <Label className="block mb-1.5">Shelf on floor plan (optional)</Label>
              <p className="mb-2 text-sm text-ink-600">
                Click the map and then click a shelf to assign this prop to that shelf.
              </p>
              {form.shelf_index != null && form.shelf_index >= 0 ? (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-xl bg-cream-200 px-3 py-2 font-sans text-sm text-ink-700">
                    Shelf {form.shelf_index + 1} selected
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="default"
                    className="rounded-xl"
                    onClick={() => setForm({ ...form, shelf_index: null })}
                  >
                    Clear
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="default"
                    className="rounded-xl"
                    onClick={() => setMapPickerOpen(true)}
                  >
                    <MapIcon className="mr-1.5 h-4 w-4" />
                    Change shelf
                  </Button>
                </div>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  size="default"
                  className="rounded-xl"
                  onClick={() => setMapPickerOpen(true)}
                >
                  <MapIcon className="mr-1.5 h-4 w-4" />
                  Select shelf on map
                </Button>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="block mb-1.5">Length (L)</Label>
                <Input
                  value={form.length}
                  onChange={(e) => setForm({ ...form, length: e.target.value })}
                  placeholder="e.g. 24 in"
                />
              </div>
              <div>
                <Label className="block mb-1.5">Width (W)</Label>
                <Input
                  value={form.width}
                  onChange={(e) => setForm({ ...form, width: e.target.value })}
                  placeholder="e.g. 18 in"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Section</Label>
              <select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                className="h-11 w-full rounded-2xl border border-ink-200 bg-cream-50 px-4 font-sans text-ink-900 focus:border-accent focus:ring-2 focus:ring-accent/20 outline-none transition-colors"
              >
                {availableSections.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>

              <Button
                type="button"
                variant="outline"
                onClick={addSection}
                className="w-full rounded-2xl"
              >
                <Plus className="mr-2 h-4 w-4" />
                Add New Section
              </Button>
            </div>

            <div className="space-y-2">
              <Label>Specific job</Label>
              <select
                value={form.job}
                onChange={(e) => setForm({ ...form, job: e.target.value })}
                className="h-11 w-full rounded-2xl border border-ink-200 bg-cream-50 px-4 font-sans text-ink-900 focus:border-accent focus:ring-2 focus:ring-accent/20 outline-none transition-colors"
              >
                {jobs.map((job) => (
                  <option key={job} value={job}>
                    {job}
                  </option>
                ))}
              </select>

              <Button
                type="button"
                variant="outline"
                onClick={addJob}
                className="w-full rounded-2xl"
              >
                <Plus className="mr-2 h-4 w-4" />
                Add New Job
              </Button>
            </div>

            <div>
              <Label className="block mb-1.5">Quantity</Label>
              <Input
                type="number"
                min="1"
                value={form.quantity}
                onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                placeholder="1"
              />
            </div>

            <div>
              <Label className="block mb-1.5">Photo</Label>
              <div className="mt-2 grid gap-3">
                {form.photo ? (
                  <div className="relative overflow-hidden rounded-2xl border border-ink-200 bg-cream-200">
                    <img
                      src={form.photo}
                      alt="Prop preview"
                      className="h-56 w-full object-cover"
                    />
                    <Button
                      type="button"
                      size="icon"
                      onClick={clearPhoto}
                      className="absolute right-3 top-3 h-9 w-9 rounded-xl bg-ink-900/80 text-cream-50 hover:bg-ink-900"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-ink-200 bg-cream-200/50 p-6">
                    <div className="flex items-center gap-3 font-sans text-sm text-ink-600">
                      <Camera className="h-5 w-5 text-ink-500 flex-shrink-0" />
                      Use your phone camera or choose an existing photo.
                    </div>
                  </div>
                )}

                <div className="grid gap-3 sm:grid-cols-2">
                  <Button
                    type="button"
                    variant="default"
                    onClick={() => cameraInputRef.current?.click()}
                    className="rounded-2xl"
                  >
                    <Camera className="mr-2 h-4 w-4" />
                    Take Photo
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => libraryInputRef.current?.click()}
                    className="rounded-2xl"
                  >
                    <Upload className="mr-2 h-4 w-4" />
                    Choose Photo
                  </Button>
                </div>

                <input
                  ref={cameraInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handlePhotoFile}
                  className="hidden"
                />
                <input
                  ref={libraryInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoFile}
                  className="hidden"
                />
              </div>
            </div>

            {saveError && (
              <p className="rounded-2xl bg-red-50 border border-red-200 px-4 py-3 font-sans text-sm text-red-800">
                {saveError}
              </p>
            )}
              </div>
            </div>

            <div className="sticky bottom-0 mt-4 pt-4 border-t border-ink-200 bg-cream-50 space-y-3">
              {saveError && (
                <p className="rounded-2xl bg-red-50 border border-red-200 px-4 py-2 font-sans text-sm text-red-800">
                  {saveError}
                </p>
              )}
              <div className="flex gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={resetForm}
                className="flex-1 rounded-2xl"
                disabled={saving}
              >
                Clear
              </Button>
              <Button
                type="button"
                variant="primary"
                onClick={addItem}
                className="flex-1 rounded-2xl"
                disabled={saving}
              >
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving…
                  </>
                ) : (
                  editingId ? "Update Prop/Surface" : "Save Prop/Surface"
                )}
              </Button>
              </div>
            </div>
          </div>
        </Modal>

        <Modal
          open={mapPickerOpen}
          onClose={() => setMapPickerOpen(false)}
          title="Select a shelf"
        >
          <div className="w-full" style={{ aspectRatio: "8/5" }}>
            <RoomMap
              selectShelf={(index) => {
                setForm((f) => ({ ...f, shelf_index: index }));
                setMapPickerOpen(false);
              }}
              selectedShelfIndex={form.shelf_index}
            />
          </div>
        </Modal>

        {loading ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Card key={i} className="overflow-hidden border-ink-200/60">
                <div className="aspect-[4/3] bg-cream-200 animate-pulse" />
                <CardContent className="p-5">
                  <div className="h-6 w-3/4 bg-cream-300 rounded animate-pulse" />
                  <div className="mt-3 h-4 w-full bg-cream-200 rounded animate-pulse" />
                  <div className="mt-3 h-4 w-1/2 bg-cream-200 rounded animate-pulse" />
                  <div className="mt-4 flex gap-4">
                    <div className="h-4 w-24 bg-cream-200 rounded animate-pulse" />
                    <div className="h-4 w-20 bg-cream-200 rounded animate-pulse" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : saveError && !items.length ? (
          <Card className="border-amber-200 bg-amber-50/80">
            <CardContent className="py-6">
              <p className="font-sans text-ink-800">{saveError}</p>
              <Button
                type="button"
                variant="outline"
                onClick={fetchProps}
                className="mt-4 rounded-2xl"
              >
                Retry
              </Button>
            </CardContent>
          </Card>
        ) : null}

        {/* Search + tabs + count */}
        {!loading && (
        <>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative flex-1 max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-500" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search props…"
              className="pl-9 h-10 rounded-xl"
            />
          </div>
          <span className="font-sans text-sm text-ink-600">
            {items.reduce((sum, item) => sum + (item.quantity || 1), 0)} props
          </span>
        </div>

        {/* Section tabs */}
        <div className="mt-4 flex flex-wrap gap-2">
          {sections.map((name) => {
            const count =
              name === "All Props"
                ? items.length
                : items.filter((item) => item.category === name).length;
            const isActive = activeSection === name;
            return (
              <button
                key={name}
                type="button"
                onClick={() => setActiveSection(name)}
                className={cn(
                  "rounded-xl px-4 py-2 font-sans text-sm font-medium transition-colors",
                  isActive
                    ? "bg-ink-900 text-cream-50"
                    : "bg-cream-200/80 text-ink-700 hover:bg-cream-300"
                )}
              >
                {name} <span className="opacity-70">({count})</span>
              </button>
            );
          })}
        </div>

        {/* Results line: count, sort, export */}
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <p className="font-sans text-sm text-ink-600">
            {filteredItems.length} {filteredItems.length === 1 ? "prop" : "props"}
          </p>
          <select
            value={isEditor ? sortBy : sortBy === "location" ? "date" : sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="h-9 rounded-xl border border-ink-200 bg-cream-50 px-3 font-sans text-sm text-ink-800 focus:border-accent focus:ring-2 focus:ring-accent/20 outline-none"
            aria-label="Sort by"
          >
            <option value="date">Date added</option>
            <option value="title">Title</option>
            {isEditor && <option value="location">Location</option>}
          </select>
          {filteredItems.length > 0 && (
            <Button
              type="button"
              variant="outline"
              size="default"
              className="rounded-xl h-9"
              onClick={exportCSV}
            >
              <Download className="mr-1.5 h-4 w-4" />
              Export CSV
            </Button>
          )}
        </div>

        {/* Item grid or empty state */}
        {filteredItems.length > 0 ? (
          <div className="mt-6 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {filteredItems.map((item) => (
              <ItemCard
                key={item.id}
                item={item}
                onClick={setSelectedItem}
                onAddToList={supabase ? (it) => setAddToListItem(it) : undefined}
                showLocation={isEditor}
              />
            ))}
          </div>
        ) : (
          <Card className="mt-6 border-dashed border-ink-300 bg-cream-50/80">
            <CardContent className="flex flex-col items-center justify-center py-20 text-center">
              <div className="rounded-2xl border border-ink-200/80 bg-cream-200/60 p-4">
                <Package2 className="h-10 w-10 text-ink-500" strokeWidth={1.25} />
              </div>
              <h3 className="mt-4 font-sans text-lg font-semibold text-ink-900">
                No props here
              </h3>
              <p className="mt-2 font-sans text-sm text-ink-600">
                Try another search or switch tabs.
              </p>
              {isEditor && (
                <Button
                  type="button"
                  variant="primary"
                  className="mt-6 rounded-2xl"
                  onClick={openAddForm}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add prop/surface
                </Button>
              )}
            </CardContent>
          </Card>
        )}
        </>
        )}
      </div>
    </div>
  );
}

const INACTIVITY_MS = 10 * 60 * 1000; // 10 minutes

function AppWithAuth() {
  const [authed, setAuthed] = useState(() => isAuthenticated());
  const protected_ = isPasswordProtectionEnabled();
  const inactivityTimerRef = useRef(null);

  useEffect(() => {
    if (!protected_) setAuthed(true);
  }, [protected_]);

  useEffect(() => {
    if (!protected_ || !authed) return;

    const resetTimer = () => {
      if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
      inactivityTimerRef.current = setTimeout(() => {
        clearAuthenticated();
        setAuthed(false);
      }, INACTIVITY_MS);
    };

    resetTimer();
    const events = ["mousemove", "mousedown", "keydown", "scroll", "touchstart", "click"];
    events.forEach((ev) => document.addEventListener(ev, resetTimer));
    return () => {
      events.forEach((ev) => document.removeEventListener(ev, resetTimer));
      if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
    };
  }, [protected_, authed]);

  if (protected_ && !authed) {
    return <LoginPage onSuccess={() => setAuthed(true)} />;
  }

  const isEditor = !protected_ || getAuthenticatedRole() === "editor";
  return <PropRoomInventoryApp isEditor={isEditor} />;
}

function App() {
  const [hash, setHash] = useState(() => window.location.hash);
  useEffect(() => {
    const onHash = () => setHash(window.location.hash);
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  const shareMatch = hash.match(/^#\/share\/([a-f0-9-]{36})$/i);
  if (shareMatch) {
    return (
      <ShareView
        listId={shareMatch[1]}
        onBack={() => { window.location.hash = ""; }}
      />
    );
  }
  return <AppWithAuth />;
}

export default App;
