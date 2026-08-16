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
  Smartphone,
  LayoutGrid,
  Table2,
  Tag,
  ListPlus,
  Link2,
  List,
} from "lucide-react";
import {
  isApiConfigured,
  fetchAuthStatus,
  login as apiLogin,
  fetchProps as apiFetchProps,
  createProp,
  updateProp,
  deleteProp as apiDeleteProp,
  fetchJobs as apiFetchJobs,
  addJob as apiAddJob,
  fetchSections as apiFetchSections,
  addSection as apiAddSection,
  fetchEraStyles as apiFetchEraStyles,
  addEraStyle as apiAddEraStyle,
  uploadPhoto,
  hasSession,
  getStoredRole,
  setSession,
  clearSession,
  createList as apiCreateList,
  fetchListsByIds,
  fetchList,
  renameList as apiRenameList,
  deleteList as apiDeleteList,
  addPropToList,
} from "./lib/api.js";

const SHARE_LIST_IDS_KEY = "propstagram_share_list_ids";
const DEVICE_ID_KEY = "propstagram_device_id";

/** A per-browser device ID (localStorage), used only to remember which lists this
 *  device created/added to — not an account, not sent to the server, clearable. */
function getDeviceId() {
  if (typeof window === "undefined") return "";
  let id = localStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    id = crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    localStorage.setItem(DEVICE_ID_KEY, id);
  }
  return id;
}

function getListIdsKey() {
  return `${SHARE_LIST_IDS_KEY}_${getDeviceId()}`;
}

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

function LoginPage({ onSuccess }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const { token, role } = await apiLogin(username.trim().toLowerCase(), password);
      setSession(token, role);
      onSuccess();
    } catch (err) {
      setError(err?.message || "Wrong username or password");
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
            className="h-14 w-auto mx-auto object-contain"
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
        <button
          type="button"
          onClick={() => { window.location.hash = "#/browse"; }}
          className="mt-4 w-full h-11 rounded-2xl border border-ink-200 bg-cream-50 text-ink-700 font-medium hover:bg-cream-200 focus:outline-none focus:ring-2 focus:ring-ink-400"
        >
          Continue as Guest
        </button>
      </div>
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

const CONDITIONS = ["Excellent", "Good", "Needs Repair", "Fragile"];
const STATUSES = ["In Stock", "Checked Out", "In Repair"];

function emptyForm() {
  return {
    title: "",
    description: "",
    location: "",
    category: "White Plateware",
    job: "General Inventory",
    quantity: 1,
    photo: "",
    length: "",
    width: "",
    code: "",
    color: "",
    condition: "",
    era_style: "",
    status: "In Stock",
    tags: "",
  };
}

function splitCommaList(value) {
  return String(value || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function getAddAsAppInfo() {
  if (typeof navigator === "undefined") return { platform: "desktop", steps: [] };
  const ua = navigator.userAgent || "";
  const isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const isAndroid = /Android/.test(ua);
  if (isIOS)
    return {
      platform: "ios",
      steps: [
        "Tap the Share button (square with an arrow pointing up) at the bottom of Safari.",
        "Scroll down and tap “Add to Home Screen”.",
        "Tap “Add” in the top right.",
      ],
    };
  if (isAndroid)
    return {
      platform: "android",
      steps: [
        "Tap the menu (⋮) in the top right of Chrome.",
        "Tap “Add to Home screen” or “Install app”.",
        "Confirm by tapping “Add” or “Install”.",
      ],
    };
  return {
    platform: "desktop",
    steps: [
      "On your phone or tablet, open this page in Safari (iPhone/iPad) or Chrome (Android).",
      "Then use “Add as app” on that device to see steps for your browser.",
    ],
  };
}

function cn(...classes) {
  return classes.filter(Boolean).join(" ");
}

function parseMixedNumber(value) {
  if (value == null) return null;
  const s = String(value).trim().toLowerCase();
  if (!s) return null;

  // Extract a leading-ish mixed number like "24 1/2", "1/2", "24.25", "24"
  const match = s.match(/(\d+\s+\d+\/\d+|\d+\/\d+|\d+(?:\.\d+)?)/);
  if (!match) return null;

  const token = match[1];
  if (token.includes(" ")) {
    const [wholeRaw, fracRaw] = token.split(/\s+/);
    const whole = Number(wholeRaw);
    const [nRaw, dRaw] = fracRaw.split("/");
    const n = Number(nRaw);
    const d = Number(dRaw);
    if (!Number.isFinite(whole) || !Number.isFinite(n) || !Number.isFinite(d) || d === 0) return null;
    return whole + n / d;
  }
  if (token.includes("/")) {
    const [nRaw, dRaw] = token.split("/");
    const n = Number(nRaw);
    const d = Number(dRaw);
    if (!Number.isFinite(n) || !Number.isFinite(d) || d === 0) return null;
    return n / d;
  }
  const num = Number(token);
  return Number.isFinite(num) ? num : null;
}

function parseDimsFromQuery(query) {
  const q = String(query || "").toLowerCase();
  // Support patterns like: "24x18", "24 × 18", "24 by 18", "24*18"
  const m = q.match(
    /(\d+(?:\.\d+)?(?:\s+\d+\/\d+)?|\d+\/\d+)\s*(?:x|×|\*|by)\s*(\d+(?:\.\d+)?(?:\s+\d+\/\d+)?|\d+\/\d+)/
  );
  if (!m) return null;
  const a = parseMixedNumber(m[1]);
  const b = parseMixedNumber(m[2]);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return { a, b };
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

function AddAsAppModal({ open, onClose }) {
  const info = useMemo(() => getAddAsAppInfo(), []);
  if (!open) return null;
  return (
    <Modal open={true} onClose={onClose} title="Add as app">
      <div className="space-y-4">
        <p className="font-sans text-ink-700">
          Add this site to your home screen to open it like an app. Follow the steps for your device:
        </p>
        <ol className="list-decimal list-inside space-y-2 font-sans text-ink-800">
          {info.steps.map((step, i) => (
            <li key={i} className="pl-1">{step}</li>
          ))}
        </ol>
        {info.platform === "desktop" && (
          <p className="text-sm text-ink-600">
            Or scan this page’s URL with your phone to open it there, then tap “Add as app” again.
          </p>
        )}
      </div>
    </Modal>
  );
}

function TagChips({ item }) {
  if (!item.color?.length && !item.tags?.length) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {item.color?.map((c) => (
        <span key={`c-${c}`} className="inline-flex items-center rounded-full bg-cream-200 px-2.5 py-0.5 text-xs text-ink-600">
          {c}
        </span>
      ))}
      {item.tags?.map((t) => (
        <span key={`t-${t}`} className="inline-flex items-center gap-1 rounded-full bg-cream-100 border border-ink-200 px-2.5 py-0.5 text-xs text-ink-600">
          <Tag className="h-3 w-3" />
          {t}
        </span>
      ))}
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
            {item.status ? <Badge className="bg-accent/20">{item.status}</Badge> : null}
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

        <div className="mt-3">
          <TagChips item={item} />
        </div>
      </CardContent>
    </Card>
  );
}

function CategoryCard({ label, photo, isActive, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group relative flex w-full overflow-hidden rounded-2xl border-2 text-left transition-all duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2",
        isActive ? "border-ink-900 shadow-lg ring-2 ring-ink-900/20" : "border-ink-200 hover:border-ink-300"
      )}
      style={{ aspectRatio: "4/3" }}
    >
      <div
        className={cn(
          "absolute inset-0 bg-cover bg-center transition-all duration-300 group-hover:blur-md",
          !photo && "bg-cream-200"
        )}
        style={photo ? { backgroundImage: `url(${photo})` } : undefined}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-ink-900/85 via-ink-900/40 to-transparent" />
      <div className="absolute inset-0 flex items-end p-4 sm:p-5">
        <span className="font-sans text-lg font-semibold text-white drop-shadow-md transition-transform duration-300 group-hover:scale-110 sm:text-xl">
          {label}
        </span>
      </div>
      {!photo && (
        <div className="absolute inset-0 flex items-center justify-center text-ink-400 opacity-60">
          <Package2 className="h-14 w-14 sm:h-16 sm:w-16" strokeWidth={1.25} />
        </div>
      )}
    </button>
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
              {item.era_style ? <Badge className="bg-cream-200/80">{item.era_style}</Badge> : null}
              {item.condition ? <Badge className="bg-cream-200/80">{item.condition}</Badge> : null}
              {item.status ? <Badge className="bg-accent/20">{item.status}</Badge> : null}
            </div>
            <TagChips item={item} />
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
                  <span className="text-ink-500 font-medium">Dimensions (in):</span>
                  <span>{[item.length, item.width].filter(Boolean).join(" × ")}</span>
                </div>
              ) : null}
            </div>
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

/** Read-only view of a shared list, reachable via #/share/:id with no login required. */
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
    let cancelled = false;
    (async () => {
      if (!listId || !isApiConfigured()) {
        if (cancelled) return;
        setLoading(false);
        if (!isApiConfigured()) setError("Shared lists are not configured.");
        return;
      }
      try {
        const data = await fetchList(listId);
        if (cancelled) return;
        setList(data);
        setProps(data.props || []);
      } catch {
        if (!cancelled) setError("List not found.");
      } finally {
        if (!cancelled) setLoading(false);
      }
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
            <Button type="button" variant="primary" className="rounded-2xl" onClick={copyLink}>
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

/** Create a new list (from this prop) or add this prop to one already created on this device. */
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
    if (!open || !item) return;
    let cancelled = false;
    (async () => {
      setCreatedListId(null);
      setShareUrl("");
      setNewListName("");
      setMessage("");
      if (!isApiConfigured()) return;
      const ids = JSON.parse(localStorage.getItem(getListIdsKey()) || "[]");
      if (!ids.length) {
        if (!cancelled) setMyLists([]);
        return;
      }
      if (!cancelled) setLoading(true);
      try {
        const data = await fetchListsByIds(ids);
        if (!cancelled) setMyLists(data || []);
      } catch {
        // keep list empty on failure
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally keyed on item id, not the whole object (which gets a new reference on every props refetch)
  }, [open, item?.id]);

  const rememberListId = (listId) => {
    const ids = JSON.parse(localStorage.getItem(getListIdsKey()) || "[]");
    if (!ids.includes(listId)) {
      localStorage.setItem(getListIdsKey(), JSON.stringify([...ids, listId]));
    }
  };

  const createList = async () => {
    if (!item || !isApiConfigured()) return;
    setCreating(true);
    try {
      const list = await apiCreateList(newListName.trim());
      await addPropToList(list.id, item.id);
      rememberListId(list.id);
      setCreatedListId(list.id);
      setShareUrl(`${window.location.origin}${window.location.pathname}#/share/${list.id}`);
      setMyLists((prev) => [...prev, { id: list.id, name: list.name || "Untitled list", propTitles: [item.title] }]);
    } catch {
      setMessage("Could not create list. Try again.");
    } finally {
      setCreating(false);
    }
  };

  const addToList = async (listId) => {
    if (!item || !isApiConfigured()) return;
    setAddingId(listId);
    try {
      await addPropToList(listId, item.id);
      setMessage("Added to list.");
    } catch {
      setMessage("Could not add to list.");
    } finally {
      setAddingId(null);
    }
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

/** Lists this device has created/added to (from localStorage) — rename, delete, share, or forget. */
function MyListsModal({ open, onClose }) {
  const [lists, setLists] = useState([]);
  const [loading, setLoading] = useState(false);
  const [copiedId, setCopiedId] = useState(null);
  const [editingListId, setEditingListId] = useState(null);
  const [editingName, setEditingName] = useState("");
  const [deletingId, setDeletingId] = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [confirmClear, setConfirmClear] = useState(false);

  const doFetchLists = useCallback(async () => {
    if (!isApiConfigured()) return;
    const ids = JSON.parse(localStorage.getItem(getListIdsKey()) || "[]");
    if (!ids.length) {
      setLists([]);
      return;
    }
    try {
      const data = await fetchListsByIds(ids);
      setLists(
        (data || []).map((list) => ({
          id: list.id,
          name: list.name || "Untitled list",
          propTitles: list.propTitles || [],
        }))
      );
    } catch {
      setLists([]);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      setLists([]);
      setEditingListId(null);
      setConfirmDeleteId(null);
      setConfirmClear(false);
      if (!isApiConfigured()) return;
      const ids = JSON.parse(localStorage.getItem(getListIdsKey()) || "[]");
      if (!ids.length) {
        if (!cancelled) setLoading(false);
        return;
      }
      if (!cancelled) setLoading(true);
      await doFetchLists();
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [open, doFetchLists]);

  const copyLink = (listId) => {
    const url = `${window.location.origin}${window.location.pathname}#/share/${listId}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopiedId(listId);
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  const startRename = (list, e) => {
    e.stopPropagation();
    setEditingListId(list.id);
    setEditingName(list.name);
  };

  const saveRename = async (e) => {
    e?.stopPropagation();
    if (!editingListId) return;
    const name = editingName.trim() || "Untitled list";
    try {
      await apiRenameList(editingListId, name);
      setLists((prev) => prev.map((l) => (l.id === editingListId ? { ...l, name } : l)));
    } catch {
      // leave list unchanged on failure
    }
    setEditingListId(null);
  };

  const cancelRename = (e) => {
    e?.stopPropagation();
    setEditingListId(null);
  };

  const confirmDelete = (listId, e) => {
    e?.stopPropagation();
    setConfirmDeleteId(listId);
  };

  const cancelDelete = (e) => {
    e?.stopPropagation();
    setConfirmDeleteId(null);
  };

  const removeList = async (listId, e) => {
    e?.stopPropagation();
    setDeletingId(listId);
    try {
      await apiDeleteList(listId);
      const ids = JSON.parse(localStorage.getItem(getListIdsKey()) || "[]");
      localStorage.setItem(getListIdsKey(), JSON.stringify(ids.filter((id) => id !== listId)));
      setLists((prev) => prev.filter((l) => l.id !== listId));
    } catch {
      // leave list as-is on failure
    } finally {
      setDeletingId(null);
      setConfirmDeleteId(null);
    }
  };

  const clearMyLists = () => {
    localStorage.removeItem(getListIdsKey());
    setLists([]);
    setConfirmClear(false);
  };

  if (!open) return null;
  return (
    <Modal open={true} onClose={onClose} title="Your lists">
      <div className="space-y-4">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-ink-400" />
          </div>
        ) : lists.length === 0 ? (
          <p className="font-sans text-ink-600 py-4">
            You haven&apos;t created any lists yet. Use &quot;Add to list&quot; on a prop card or in the prop detail view to create one.
          </p>
        ) : (
          <>
            <ul className="space-y-4">
              {lists.map((list) => (
                <li
                  key={list.id}
                  role={editingListId === list.id ? undefined : "button"}
                  tabIndex={editingListId === list.id ? undefined : 0}
                  onClick={
                    editingListId === list.id
                      ? undefined
                      : () => {
                          window.location.hash = `#/share/${list.id}`;
                          onClose();
                        }
                  }
                  onKeyDown={
                    editingListId === list.id
                      ? undefined
                      : (e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            window.location.hash = `#/share/${list.id}`;
                            onClose();
                          }
                        }
                  }
                  className={cn(
                    "rounded-2xl border border-ink-200 bg-cream-50 p-4 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2",
                    editingListId !== list.id && "cursor-pointer hover:bg-cream-100 hover:border-ink-300"
                  )}
                >
                  {confirmDeleteId === list.id ? (
                    <div className="flex flex-wrap items-center gap-2 py-1" onClick={(e) => e.stopPropagation()}>
                      <span className="font-sans text-sm text-ink-700">Delete this list?</span>
                      <Button type="button" variant="outline" size="default" className="rounded-xl" onClick={(e) => removeList(list.id, e)}>
                        Delete
                      </Button>
                      <Button type="button" variant="ghost" size="default" className="rounded-xl" onClick={cancelDelete}>
                        Cancel
                      </Button>
                    </div>
                  ) : editingListId === list.id ? (
                    <div className="flex flex-wrap items-center gap-2" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="text"
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && saveRename(e)}
                        className="h-9 flex-1 min-w-[120px] rounded-xl border border-ink-200 bg-cream-50 px-3 font-sans text-ink-900 focus:border-accent focus:ring-2 focus:ring-accent/20 outline-none"
                        placeholder="List name"
                        autoFocus
                      />
                      <Button type="button" variant="primary" size="default" className="rounded-xl shrink-0" onClick={saveRename}>
                        Save
                      </Button>
                      <Button type="button" variant="ghost" size="default" className="rounded-xl shrink-0" onClick={cancelRename}>
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <h3 className="font-sans font-semibold text-ink-900">
                          {list.name}
                        </h3>
                        <p className="mt-1 text-sm text-ink-600">
                          {list.propTitles.length} {list.propTitles.length === 1 ? "prop" : "props"}
                        </p>
                        {list.propTitles.length > 0 && (
                          <ul className="mt-2 space-y-1 text-sm text-ink-700">
                            {list.propTitles.map((title, i) => (
                              <li key={i} className="truncate">• {title}</li>
                            ))}
                          </ul>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="rounded-xl text-ink-600 hover:text-ink-900"
                          onClick={(e) => startRename(list, e)}
                          aria-label="Rename list"
                          title="Rename list"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="rounded-xl text-red-600 hover:bg-red-50 hover:text-red-700"
                          onClick={(e) => confirmDelete(list.id, e)}
                          disabled={deletingId === list.id}
                          aria-label="Delete list"
                          title="Delete list"
                        >
                          {deletingId === list.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          type="button"
                          variant="primary"
                          size="default"
                          className="rounded-xl shrink-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            copyLink(list.id);
                          }}
                          aria-label="Copy share link"
                        >
                          {copiedId === list.id ? (
                            "Copied!"
                          ) : (
                            <>
                              <Link2 className="mr-1.5 h-4 w-4" />
                              Share
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  )}
                </li>
              ))}
            </ul>
            <div className="pt-2 border-t border-ink-200">
              {confirmClear ? (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-sans text-sm text-ink-700">
                    Forget these lists on this device? The lists themselves aren&apos;t deleted.
                  </span>
                  <Button type="button" variant="outline" size="default" className="rounded-xl" onClick={clearMyLists}>
                    Forget
                  </Button>
                  <Button type="button" variant="ghost" size="default" className="rounded-xl" onClick={() => setConfirmClear(false)}>
                    Cancel
                  </Button>
                </div>
              ) : (
                <Button
                  type="button"
                  variant="ghost"
                  size="default"
                  className="rounded-xl text-ink-600 hover:text-ink-900"
                  onClick={() => setConfirmClear(true)}
                >
                  Forget my lists on this device
                </Button>
              )}
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}

function PropsTable({ items, onSelect, showLocation = true }) {
  return (
    <div className="mt-6 overflow-x-auto rounded-2xl border border-ink-200 bg-cream-50">
      <table className="w-full min-w-[900px] text-left text-sm">
        <thead>
          <tr className="border-b border-ink-200 text-ink-600">
            <th className="px-4 py-3 font-medium">Title</th>
            <th className="px-4 py-3 font-medium">Code</th>
            <th className="px-4 py-3 font-medium">Category</th>
            <th className="px-4 py-3 font-medium">Job</th>
            <th className="px-4 py-3 font-medium">Qty</th>
            <th className="px-4 py-3 font-medium">Dimensions</th>
            <th className="px-4 py-3 font-medium">Condition</th>
            <th className="px-4 py-3 font-medium">Era/Style</th>
            <th className="px-4 py-3 font-medium">Status</th>
            {showLocation && <th className="px-4 py-3 font-medium">Location</th>}
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr
              key={item.id}
              role="button"
              tabIndex={0}
              onClick={() => onSelect(item)}
              onKeyDown={(e) => e.key === "Enter" && onSelect(item)}
              className="cursor-pointer border-b border-ink-100 last:border-0 hover:bg-cream-100"
            >
              <td className="px-4 py-3 font-medium text-ink-900">{item.title}</td>
              <td className="px-4 py-3 font-mono text-ink-700">{item.code || "—"}</td>
              <td className="px-4 py-3 text-ink-700">{item.category || "—"}</td>
              <td className="px-4 py-3 text-ink-700">{item.job || "—"}</td>
              <td className="px-4 py-3 text-ink-700">{item.quantity || 1}</td>
              <td className="px-4 py-3 text-ink-700">{[item.length, item.width].filter(Boolean).join(" × ") || "—"}</td>
              <td className="px-4 py-3 text-ink-700">{item.condition || "—"}</td>
              <td className="px-4 py-3 text-ink-700">{item.era_style || "—"}</td>
              <td className="px-4 py-3 text-ink-700">{item.status || "—"}</td>
              {showLocation && <td className="px-4 py-3 text-ink-700">{item.location || "—"}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PropRoomInventoryApp({ isEditor = true }) {
  const [items, setItems] = useState(starterItems);
  const [search, setSearch] = useState("");
  const [sortMode, setSortMode] = useState("newest");
  const [activeSection, setActiveSection] = useState("All Props");
  const [sections, setSections] = useState(sectionTitles);
  const [jobs, setJobs] = useState(starterJobs);
  const [eraStyles, setEraStyles] = useState([]);
  const [viewMode, setViewMode] = useState("gallery");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [lightboxImage, setLightboxImage] = useState(null);
  const [photoToCrop, setPhotoToCrop] = useState(null);
  const [addAsAppOpen, setAddAsAppOpen] = useState(false);
  const [addToListItem, setAddToListItem] = useState(null);
  const [listsModalOpen, setListsModalOpen] = useState(false);
  const [form, setForm] = useState(emptyForm());

  const cameraInputRef = useRef(null);
  const libraryInputRef = useRef(null);
  const formPhotoFileRef = useRef(null);

  const [loading, setLoading] = useState(isApiConfigured());
  const [saveError, setSaveError] = useState(null);
  const [saving, setSaving] = useState(false);

  const availableSections = sections.filter((s) => s !== "All Props");

  const fetchPropsData = useCallback(async () => {
    if (!isApiConfigured()) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setSaveError(null);
    try {
      const data = await apiFetchProps();
      setItems(data);
    } catch (err) {
      setSaveError(err?.message || "Could not load props. Check your API setup.");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchJobsData = useCallback(async () => {
    if (!isApiConfigured()) return;
    try {
      const names = await apiFetchJobs();
      setJobs(names.length ? names : starterJobs);
    } catch {
      // keep existing jobs on failure
    }
  }, []);

  const fetchSectionsData = useCallback(async () => {
    if (!isApiConfigured()) return;
    try {
      const names = await apiFetchSections();
      setSections(["All Props", ...(names.length ? names : sectionTitles.filter((s) => s !== "All Props"))]);
    } catch {
      // keep existing sections on failure
    }
  }, []);

  const fetchEraStylesData = useCallback(async () => {
    if (!isApiConfigured()) return;
    try {
      setEraStyles(await apiFetchEraStyles());
    } catch {
      // keep existing era styles on failure
    }
  }, []);

  useEffect(() => {
    if (!isApiConfigured()) return; // initial state already covers this case
    let cancelled = false;
    (async () => {
      await fetchPropsData();
      if (cancelled) return;
      await Promise.all([fetchJobsData(), fetchSectionsData(), fetchEraStylesData()]);
    })();
    return () => { cancelled = true; };
  }, [fetchPropsData, fetchJobsData, fetchSectionsData, fetchEraStylesData]);

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

    if (isApiConfigured()) {
      try {
        await apiAddSection(title);
        await fetchSectionsData();
      } catch {
        return;
      }
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

    if (isApiConfigured()) {
      try {
        await apiAddJob(title);
        await fetchJobsData();
      } catch {
        return;
      }
    } else {
      setJobs((current) => [...current, title]);
    }
    setForm((current) => ({ ...current, job: title }));
  };

  const addEraStyle = async () => {
    const nextEra = window.prompt("Add a new era/style name");
    if (!nextEra) return;

    const title = nextEra.trim();
    if (!title) return;

    const existingEra = eraStyles.find((e) => e.toLowerCase() === title.toLowerCase());
    if (existingEra) {
      setForm((current) => ({ ...current, era_style: existingEra }));
      return;
    }

    if (isApiConfigured()) {
      try {
        await apiAddEraStyle(title);
        await fetchEraStylesData();
      } catch {
        return;
      }
    } else {
      setEraStyles((current) => [...current, title]);
    }
    setForm((current) => ({ ...current, era_style: title }));
  };

  const GENERAL_INVENTORY = "General Inventory";

  const filteredItems = useMemo(() => {
    const q = search.toLowerCase().trim();
    const dimQuery = parseDimsFromQuery(q);
    const jobFiltered =
      isEditor ? items : items.filter((item) => (item.job || "").trim() === GENERAL_INVENTORY);

    const filtered = jobFiltered.filter((item) => {
      const matchesSection =
        activeSection === "All Props" ||
        (item.category || "").toLowerCase() === activeSection.toLowerCase();

      const len = parseMixedNumber(item.length);
      const wid = parseMixedNumber(item.width);
      const dimText = [item.length, item.width].filter(Boolean).join(" x ");
      const dimTextAlt = len != null && wid != null ? `${len} x ${wid}` : "";
      const dimTextArea = len != null && wid != null ? `${len * wid}` : "";

      const matchesDimPair =
        !dimQuery ||
        (len != null &&
          wid != null &&
          ((Math.abs(len - dimQuery.a) < 1e-6 && Math.abs(wid - dimQuery.b) < 1e-6) ||
            (Math.abs(len - dimQuery.b) < 1e-6 && Math.abs(wid - dimQuery.a) < 1e-6)));

      const matchesQuery =
        !q ||
        [
          item.title,
          item.description,
          item.location,
          item.category,
          item.job,
          item.code,
          item.length,
          item.width,
          dimText,
          dimTextAlt,
          dimTextArea,
          item.era_style,
          item.condition,
          item.status,
          ...(item.color || []),
          ...(item.tags || []),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(q);

      return matchesSection && matchesQuery && matchesDimPair;
    });

    const getDate = (x) => (x?.created_at ? new Date(x.created_at) : new Date(0));
    const getLen = (x) => parseMixedNumber(x?.length);
    const getWid = (x) => parseMixedNumber(x?.width);
    const getArea = (x) => {
      const l = getLen(x);
      const w = getWid(x);
      return l != null && w != null ? l * w : null;
    };

    const cmpNullable = (va, vb, dir = "asc") => {
      const aNull = va == null || !Number.isFinite(va);
      const bNull = vb == null || !Number.isFinite(vb);
      if (aNull && bNull) return 0;
      if (aNull) return 1;
      if (bNull) return -1;
      return dir === "asc" ? va - vb : vb - va;
    };

    const sorted = [...filtered].sort((a, b) => {
      if (sortMode === "newest") return getDate(b) - getDate(a);
      if (sortMode === "oldest") return getDate(a) - getDate(b);
      if (sortMode === "length_asc") {
        const c = cmpNullable(getLen(a), getLen(b), "asc");
        return c || getDate(b) - getDate(a);
      }
      if (sortMode === "length_desc") {
        const c = cmpNullable(getLen(a), getLen(b), "desc");
        return c || getDate(b) - getDate(a);
      }
      if (sortMode === "width_asc") {
        const c = cmpNullable(getWid(a), getWid(b), "asc");
        return c || getDate(b) - getDate(a);
      }
      if (sortMode === "width_desc") {
        const c = cmpNullable(getWid(a), getWid(b), "desc");
        return c || getDate(b) - getDate(a);
      }
      if (sortMode === "area_asc") {
        const c = cmpNullable(getArea(a), getArea(b), "asc");
        return c || getDate(b) - getDate(a);
      }
      if (sortMode === "area_desc") {
        const c = cmpNullable(getArea(a), getArea(b), "desc");
        return c || getDate(b) - getDate(a);
      }
      return getDate(b) - getDate(a);
    });
    return sorted;
  }, [items, search, activeSection, isEditor, sortMode]);

  const categoryThumbnails = useMemo(() => {
    const jobFiltered =
      isEditor ? items : items.filter((item) => (item.job || "").trim() === GENERAL_INVENTORY);
    const byCreated = (a, b) => {
      const da = a.created_at ? new Date(a.created_at) : new Date(0);
      const db = b.created_at ? new Date(b.created_at) : new Date(0);
      return db - da;
    };
    return sections.map((sectionName) => {
      const inSection =
        sectionName === "All Props"
          ? jobFiltered
          : jobFiltered.filter((item) => (item.category || "").toLowerCase() === sectionName.toLowerCase());
      const last = inSection.slice().sort(byCreated)[0];
      return { sectionName, photo: last?.photo || null };
    });
  }, [items, sections, isEditor]);

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
      return emptyForm();
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
      return { ...emptyForm(), code: generateCode() };
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
      length: item.length ?? "",
      width: item.width ?? "",
      code: item.code ?? "",
      color: (item.color || []).join(", "),
      condition: item.condition || "",
      era_style: item.era_style || "",
      status: item.status || "In Stock",
      tags: (item.tags || []).join(", "),
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
      length: form.length?.trim() || null,
      width: form.width?.trim() || null,
      code: form.code?.trim() || null,
      color: splitCommaList(form.color),
      condition: form.condition || null,
      era_style: form.era_style?.trim() || null,
      status: form.status || null,
      tags: splitCommaList(form.tags),
    };

    if (isApiConfigured()) {
      setSaving(true);
      try {
        let photoUrl = "";

        const file = formPhotoFileRef.current;
        if (file) {
          try {
            photoUrl = await uploadPhoto(file);
          } catch (err) {
            setSaveError(err?.message || "Photo upload failed. You can save without a photo and try again.");
            return;
          }
        } else if (form.photo && !form.photo.startsWith("blob:")) {
          photoUrl = form.photo;
        }
        payload.photo = photoUrl || null;

        if (editingId) {
          await updateProp(editingId, payload);
        } else {
          await createProp(payload);
        }

        formPhotoFileRef.current = null;
        setForm(emptyForm());
        setEditingId(null);
        setIsModalOpen(false);
        await fetchPropsData();
        setSelectedItem(null);
      } catch (err) {
        setSaveError(err?.message || "Something went wrong. Try again.");
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

    setForm(emptyForm());
    setEditingId(null);
    setIsModalOpen(false);
  };

  const deleteItem = async (item) => {
    if (isApiConfigured()) {
      try {
        await apiDeleteProp(item.id);
        await fetchPropsData();
      } catch {
        return;
      }
    } else {
      setItems((current) => current.filter((i) => i.id !== item.id));
    }
    setSelectedItem(null);
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
              className="h-14 w-auto object-contain object-left md:h-16"
              width={235}
              height={120}
            />
            <span className="font-sans text-xl font-medium tracking-tight text-ink-900 md:text-2xl">
              Propstagram
            </span>
          </h1>
          <div className="flex items-center gap-2">
            {isEditor && (
              <Button
                type="button"
                onClick={() => setAddAsAppOpen(true)}
                variant="ghost"
                size="default"
                className="rounded-2xl shrink-0 text-ink-600 hover:text-ink-900"
                title="Add to home screen"
              >
                <Smartphone className="mr-2 h-4 w-4" />
                Add as app
              </Button>
            )}
            {isApiConfigured() && (
              <Button
                type="button"
                onClick={() => setListsModalOpen(true)}
                variant="outline"
                size="default"
                className="rounded-2xl shrink-0"
              >
                <List className="mr-2 h-4 w-4" />
                Lists
              </Button>
            )}
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
        </div>

        <PropDetailModal
          item={selectedItem}
          onClose={() => setSelectedItem(null)}
          onDelete={deleteItem}
          onEdit={openEditForm}
          onOpenLightbox={setLightboxImage}
          canEdit={isEditor}
          onAddToList={isApiConfigured() ? (it) => setAddToListItem(it) : undefined}
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
        <MyListsModal
          open={listsModalOpen}
          onClose={() => setListsModalOpen(false)}
        />
        <AddAsAppModal open={addAsAppOpen} onClose={() => setAddAsAppOpen(false)} />
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
                placeholder="Material, quirks, rental restrictions, or where it works best on set"
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

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="block mb-1.5">Length (L) (in)</Label>
                <Input
                  value={form.length}
                  onChange={(e) => setForm({ ...form, length: e.target.value })}
                  placeholder="e.g. 24"
                />
              </div>
              <div>
                <Label className="block mb-1.5">Width (W) (in)</Label>
                <Input
                  value={form.width}
                  onChange={(e) => setForm({ ...form, width: e.target.value })}
                  placeholder="e.g. 18"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="block mb-1.5">Condition</Label>
                <select
                  value={form.condition}
                  onChange={(e) => setForm({ ...form, condition: e.target.value })}
                  className="h-11 w-full rounded-2xl border border-ink-200 bg-cream-50 px-4 font-sans text-ink-900 focus:border-accent focus:ring-2 focus:ring-accent/20 outline-none transition-colors"
                >
                  <option value="">None</option>
                  {CONDITIONS.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div>
                <Label className="block mb-1.5">Status</Label>
                <select
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value })}
                  className="h-11 w-full rounded-2xl border border-ink-200 bg-cream-50 px-4 font-sans text-ink-900 focus:border-accent focus:ring-2 focus:ring-accent/20 outline-none transition-colors"
                >
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
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
              <Label>Era / Style</Label>
              <select
                value={form.era_style}
                onChange={(e) => setForm({ ...form, era_style: e.target.value })}
                className="h-11 w-full rounded-2xl border border-ink-200 bg-cream-50 px-4 font-sans text-ink-900 focus:border-accent focus:ring-2 focus:ring-accent/20 outline-none transition-colors"
              >
                <option value="">None</option>
                {eraStyles.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>

              <Button
                type="button"
                variant="outline"
                onClick={addEraStyle}
                className="w-full rounded-2xl"
              >
                <Plus className="mr-2 h-4 w-4" />
                Add New Era/Style
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

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="block mb-1.5">Color</Label>
                <Input
                  value={form.color}
                  onChange={(e) => setForm({ ...form, color: e.target.value })}
                  placeholder="Red, Gold, Navy"
                />
              </div>
              <div>
                <Label className="block mb-1.5">Tags</Label>
                <Input
                  value={form.tags}
                  onChange={(e) => setForm({ ...form, tags: e.target.value })}
                  placeholder="rustic, hero-prop, fragile"
                />
              </div>
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
                onClick={fetchPropsData}
                className="mt-4 rounded-2xl"
              >
                Retry
              </Button>
            </CardContent>
          </Card>
        ) : null}

        {/* Category thumbnail grid (landing) */}
        {!loading && (
          <div className="mb-8 grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
            {categoryThumbnails.map(({ sectionName, photo }) => (
              <CategoryCard
                key={sectionName}
                label={sectionName === "All Props" ? "All Props and Surfaces" : sectionName}
                photo={photo}
                isActive={activeSection === sectionName}
                onClick={() => setActiveSection(sectionName)}
              />
            ))}
          </div>
        )}

        {/* Search + results line */}
        {!loading && (
        <>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:flex-1">
            <div className="relative flex-1 max-w-md">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-500" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search props… (try “24x18” or a tag)"
                className="pl-9 h-10 rounded-xl"
              />
            </div>
            <div className="sm:w-56">
              <select
                value={sortMode}
                onChange={(e) => setSortMode(e.target.value)}
                className="h-10 w-full rounded-xl border border-ink-200 bg-cream-50 px-3 font-sans text-sm text-ink-900 focus:border-accent focus:ring-2 focus:ring-accent/20 outline-none transition-colors"
                aria-label="Sort"
              >
                <option value="newest">Sort: Newest</option>
                <option value="oldest">Sort: Oldest</option>
                <option value="length_asc">Sort: Length (L) ↑</option>
                <option value="length_desc">Sort: Length (L) ↓</option>
                <option value="width_asc">Sort: Width (W) ↑</option>
                <option value="width_desc">Sort: Width (W) ↓</option>
                <option value="area_asc">Sort: Area (L×W) ↑</option>
                <option value="area_desc">Sort: Area (L×W) ↓</option>
              </select>
            </div>
            <div className="flex items-center gap-1 rounded-xl border border-ink-200 bg-cream-50 p-1">
              <button
                type="button"
                onClick={() => setViewMode("gallery")}
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-lg transition-colors",
                  viewMode === "gallery" ? "bg-ink-900 text-cream-50" : "text-ink-500 hover:text-ink-900"
                )}
                aria-label="Gallery view"
                aria-pressed={viewMode === "gallery"}
              >
                <LayoutGrid className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode("table")}
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-lg transition-colors",
                  viewMode === "table" ? "bg-ink-900 text-cream-50" : "text-ink-500 hover:text-ink-900"
                )}
                aria-label="Table view"
                aria-pressed={viewMode === "table"}
              >
                <Table2 className="h-4 w-4" />
              </button>
            </div>
          </div>
          <span className="font-sans text-sm text-ink-600">
            {items.reduce((sum, item) => sum + (item.quantity || 1), 0)} props
          </span>
        </div>

        {/* Results line: count */}
        <div className="mt-4">
          <p className="font-sans text-sm text-ink-600">
            {filteredItems.length} {filteredItems.length === 1 ? "prop" : "props"}
          </p>
        </div>

        {/* Item grid/table or empty state */}
        {filteredItems.length > 0 ? (
          viewMode === "table" ? (
            <PropsTable items={filteredItems} onSelect={setSelectedItem} showLocation={isEditor} />
          ) : (
            <div className="mt-6 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              {filteredItems.map((item) => (
                <ItemCard
                  key={item.id}
                  item={item}
                  onClick={setSelectedItem}
                  onAddToList={isApiConfigured() ? (it) => setAddToListItem(it) : undefined}
                  showLocation={isEditor}
                />
              ))}
            </div>
          )
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

function AppWithAuth({ hash = "" }) {
  const [authed, setAuthed] = useState(() => hasSession());
  const [protectedState, setProtectedState] = useState(isApiConfigured() ? null : false);
  const inactivityTimerRef = useRef(null);
  const currentHash = hash || window.location.hash;
  const browseMatch = /^#\/browse\/?$/i.test(currentHash);
  const shareMatch = currentHash.match(/^#\/share\/([a-f0-9-]+)$/i);

  useEffect(() => {
    if (!isApiConfigured()) return; // initial state already covers this case
    let cancelled = false;
    fetchAuthStatus()
      .then((res) => {
        if (!cancelled) setProtectedState(!!res?.protected);
      })
      .catch(() => {
        if (!cancelled) setProtectedState(false);
      });
    return () => { cancelled = true; };
  }, []);

  const effectiveAuthed = protectedState === false ? true : authed;

  useEffect(() => {
    if (!protectedState || !effectiveAuthed) return;

    const resetTimer = () => {
      if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
      inactivityTimerRef.current = setTimeout(() => {
        clearSession();
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
  }, [protectedState, effectiveAuthed]);

  // Shared list view: view-only, no editing, no login required. Checked before the login
  // gate so a link recipient never has to authenticate to see a curated list.
  if (shareMatch) {
    return <ShareView listId={shareMatch[1]} onBack={() => { window.location.hash = "#/browse"; }} />;
  }

  // No-login public catalog, restricted the same way the client role is (General Inventory
  // only, location hidden). Checked before the login gate so it never requires auth.
  if (browseMatch) {
    return <PropRoomInventoryApp isEditor={false} />;
  }

  if (protectedState === null) {
    return (
      <div className="min-h-screen bg-cream-100 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-ink-400" />
      </div>
    );
  }

  if (protectedState && !effectiveAuthed) {
    return <LoginPage onSuccess={() => setAuthed(true)} />;
  }

  const isEditor = !protectedState || getStoredRole() === "editor";
  return <PropRoomInventoryApp isEditor={isEditor} />;
}

function App() {
  const [hash, setHash] = useState(() => window.location.hash);
  useEffect(() => {
    const onHash = () => setHash(window.location.hash);
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  return <AppWithAuth hash={hash} />;
}

export default App;
