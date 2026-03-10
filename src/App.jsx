import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
} from "lucide-react";
import { supabase, isSupabaseConfigured } from "./lib/supabase.js";

// Custom prop room map: one image + pins at (map_x, map_y) in 0–1 coordinates
const ROOM_MAP_URL = "/prop-room-map.svg";

function RoomMap({ items, onSelectItem, clickToSet, className = "" }) {
  const containerRef = useRef(null);

  const hasMapPos = (item) =>
    item != null && typeof item.map_x === "number" && typeof item.map_y === "number";
  const withPos = items.filter(hasMapPos);

  const handleClick = (e) => {
    if (!clickToSet || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    if (x >= 0 && x <= 1 && y >= 0 && y <= 1) clickToSet(x, y);
  };

  return (
    <div
      ref={containerRef}
      className={cn("relative w-full overflow-hidden rounded-2xl border border-ink-200 bg-cream-100", className)}
      style={{ aspectRatio: "8/5", ...(clickToSet ? { cursor: "crosshair" } : {}) }}
      onClick={clickToSet ? handleClick : undefined}
      role={clickToSet ? "button" : undefined}
    >
      <img
        src={ROOM_MAP_URL}
        alt="Prop room layout"
        className="absolute inset-0 h-full w-full object-cover"
        draggable={false}
        style={{ pointerEvents: clickToSet ? "none" : "auto" }}
      />
      {withPos.map((item) => (
        <button
          key={item.id}
          type="button"
          className="absolute h-6 w-6 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-ink-900 bg-accent shadow-md transition-transform hover:scale-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1"
          style={{ left: `${item.map_x * 100}%`, top: `${item.map_y * 100}%` }}
          onClick={(e) => {
            e.stopPropagation();
            onSelectItem?.(item);
          }}
          aria-label={item.title}
          title={item.title}
        />
      ))}
      {clickToSet && (
        <p className="pointer-events-none absolute bottom-2 left-2 right-2 z-10 rounded-xl bg-ink-900/80 px-3 py-2 text-center text-sm text-cream-50 shadow-lg">
          Click the map to set this prop’s location
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
    <h3 className={cn("font-display text-lg font-semibold text-ink-900", className)}>
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

function Modal({ open, onClose, children, title = "Add prop" }) {
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
          <h2 className="font-display text-lg font-semibold text-ink-900" id="add-prop-title">
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

function ItemCard({ item, onClick }) {
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
            <h3 className="font-display text-xl font-semibold text-ink-900 truncate">
              {item.title}
            </h3>
            <p className="mt-2 text-sm leading-6 text-ink-600 line-clamp-2">
              {item.description || "No description added yet."}
            </p>
          </div>

          <div className="flex flex-shrink-0 flex-col gap-2">
            <Badge>{item.category || "Prop"}</Badge>
            {item.job ? (
              <Badge className="bg-cream-200/80">{item.job}</Badge>
            ) : null}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-4 text-sm text-ink-600">
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-ink-500 flex-shrink-0" />
            <span className="truncate">{item.location}</span>
          </div>

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

function PropDetailModal({ item, onClose, onDelete, onEdit, onOpenLightbox, onViewOnMap }) {
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
          <h2 className="font-display text-lg font-semibold text-ink-900 truncate pr-4">
            {item.title}
          </h2>
          <div className="flex items-center gap-2 flex-shrink-0">
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
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-ink-500 flex-shrink-0" />
                <span>{item.location}</span>
              </div>
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

            {typeof item.map_x === "number" && typeof item.map_y === "number" ? (
              <div className="mt-6">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="font-sans text-sm font-medium text-ink-700">Location on map</span>
                  {onViewOnMap ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="default"
                      className="rounded-xl"
                      onClick={() => {
                        onViewOnMap(item);
                        onClose();
                      }}
                    >
                      <MapIcon className="mr-1.5 h-4 w-4" />
                      View on map
                    </Button>
                  ) : null}
                </div>
                <div className="w-full rounded-2xl overflow-hidden border border-ink-200" style={{ aspectRatio: "8/5" }}>
                  <RoomMap items={[item]} />
                </div>
              </div>
            ) : null}
          </div>
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


export default function PropRoomInventoryApp() {
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
  const [viewMode, setViewMode] = useState("list");
  const [mapPickerOpen, setMapPickerOpen] = useState(false);
  const [mapFocusItemId, setMapFocusItemId] = useState(null);
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
      .select("id, title, description, location, category, job, quantity, photo, latitude, longitude, map_x, map_y, created_at")
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

  const filteredItems = useMemo(() => {
    const q = search.toLowerCase().trim();

    const filtered = items.filter((item) => {
      const matchesSection =
        activeSection === "All Props" ||
        (item.category || "").toLowerCase() === activeSection.toLowerCase();

      const matchesQuery =
        !q ||
        [item.title, item.description, item.location, item.category, item.job]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(q);

      return matchesSection && matchesQuery;
    });

    const sorted = [...filtered].sort((a, b) => {
      if (sortBy === "title")
        return (a.title || "").localeCompare(b.title || "", undefined, { sensitivity: "base" });
      if (sortBy === "location")
        return (a.location || "").localeCompare(b.location || "", undefined, { sensitivity: "base" });
      const dateA = a.created_at ? new Date(a.created_at) : new Date(0);
      const dateB = b.created_at ? new Date(b.created_at) : new Date(0);
      return dateB - dateA;
    });
    return sorted;
  }, [items, search, activeSection, sortBy]);

  const revokePhotoUrl = (url) => {
    if (typeof url === "string" && url.startsWith("blob:")) {
      URL.revokeObjectURL(url);
    }
  };

  const handlePhotoFile = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    formPhotoFileRef.current = file;
    const objectUrl = URL.createObjectURL(file);

    setForm((current) => {
      if (current.photo && current.photo !== objectUrl) {
        revokePhotoUrl(current.photo);
      }
      return { ...current, photo: objectUrl };
    });

    event.target.value = "";
  };

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
      };
    });
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
    });
    setEditingId(item.id);
    setSaveError(null);
    setIsModalOpen(true);
  };

  const addItem = async () => {
    if (!form.title.trim() || !form.location.trim()) return;

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
    };

    if (supabase) {
      setSaving(true);
      setSaveError(null);
      let photoUrl = "";

      const file = formPhotoFileRef.current;
      if (file) {
        const ext = file.name.split(".").pop() || "jpg";
        const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from("prop-photos")
          .upload(path, file, { cacheControl: "3600", upsert: false });
        if (uploadError) {
          setSaveError("Photo upload failed. You can save without a photo and try again.");
          setSaving(false);
          return;
        }
        const { data: urlData } = supabase.storage.from("prop-photos").getPublicUrl(path);
        photoUrl = urlData?.publicUrl ?? "";
      } else if (form.photo && !form.photo.startsWith("blob:")) {
        photoUrl = form.photo;
      }
      payload.photo = photoUrl || null;

      if (editingId) {
        const { error } = await supabase.from("props").update(payload).eq("id", editingId);
        formPhotoFileRef.current = null;
        setSaving(false);
        if (error) {
          setSaveError(error.message || "Failed to update prop.");
          return;
        }
      } else {
        const { error } = await supabase.from("props").insert(payload);
        formPhotoFileRef.current = null;
        setSaving(false);
        if (error) {
          setSaveError(error.message || "Failed to save prop.");
          return;
        }
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
      });
      setEditingId(null);
      setIsModalOpen(false);
      await fetchProps();
      setSelectedItem(null);
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
        <div className="mb-8 flex items-center justify-between gap-4">
          <h1 className="flex items-center gap-3">
            <img
              src="/macguffin-logo.png"
              alt="MacGuffin"
              className="h-11 w-auto object-contain object-left md:h-14"
              width={235}
              height={120}
            />
            <span className="font-brand text-xl font-medium tracking-tight text-ink-900 md:text-2xl">
              Propstagram
            </span>
          </h1>
          <Button
            onClick={() => {
              setEditingId(null);
              setSaveError(null);
              setIsModalOpen(true);
            }}
            variant="primary"
            size="default"
            className="rounded-2xl shrink-0"
          >
            <Plus className="mr-2 h-4 w-4" />
            Add Prop
          </Button>
        </div>

        <PropDetailModal
          item={selectedItem}
          onClose={() => setSelectedItem(null)}
          onDelete={deleteItem}
          onEdit={openEditForm}
          onOpenLightbox={setLightboxImage}
          onViewOnMap={(it) => {
            setViewMode("map");
            setMapFocusItemId(it?.id ?? null);
            setSelectedItem(null);
          }}
        />

        <Lightbox imageUrl={lightboxImage} onClose={() => setLightboxImage(null)} />

        <Modal
          open={isModalOpen}
          onClose={() => {
            setSaveError(null);
            setEditingId(null);
            setIsModalOpen(false);
          }}
          title={editingId ? "Edit prop" : "Add prop"}
        >
          <div className="flex flex-col max-h-[70vh]">
            <div className="flex-1 overflow-y-auto pr-1">
              <div className="grid gap-5">
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
              <Label className="block mb-1.5">Map location (optional)</Label>
              <p className="mb-2 text-sm text-ink-600">
                Link this prop to a spot on the room map. Click the map to set the location.
              </p>
              {(form.map_x != null && form.map_y != null) ? (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-xl bg-cream-200 px-3 py-2 font-mono text-sm text-ink-700">
                    {Number(form.map_x * 100).toFixed(0)}%, {Number(form.map_y * 100).toFixed(0)}%
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="default"
                    className="rounded-xl"
                    onClick={() => setForm({ ...form, map_x: null, map_y: null })}
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
                    Change on map
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
                  Set location on map
                </Button>
              )}
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

            <div className="sticky bottom-0 mt-4 pt-4 border-t border-ink-200 bg-cream-50 flex gap-3">
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
                  editingId ? "Update Prop" : "Save Prop"
                )}
              </Button>
            </div>
          </div>
        </Modal>

        <Modal
          open={mapPickerOpen}
          onClose={() => setMapPickerOpen(false)}
          title="Set location on room map"
        >
          <div className="w-full" style={{ aspectRatio: "8/5" }}>
            <RoomMap
              items={[]}
              clickToSet={(map_x, map_y) => {
                setForm((f) => ({ ...f, map_x, map_y }));
                setMapPickerOpen(false);
              }}
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

        {/* List / Map view toggle */}
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={() => { setViewMode("list"); setMapFocusItemId(null); }}
            className={cn(
              "inline-flex items-center gap-2 rounded-xl px-4 py-2 font-sans text-sm font-medium transition-colors",
              viewMode === "list"
                ? "bg-ink-900 text-cream-50"
                : "bg-cream-200/80 text-ink-700 hover:bg-cream-300"
            )}
          >
            <Package2 className="h-4 w-4" />
            List
          </button>
          <button
            type="button"
            onClick={() => setViewMode("map")}
            className={cn(
              "inline-flex items-center gap-2 rounded-xl px-4 py-2 font-sans text-sm font-medium transition-colors",
              viewMode === "map"
                ? "bg-ink-900 text-cream-50"
                : "bg-cream-200/80 text-ink-700 hover:bg-cream-300"
            )}
          >
            <MapIcon className="h-4 w-4" />
            Map
          </button>
        </div>

        {viewMode === "map" ? (
          <div className="mt-6">
            <div className="w-full max-w-4xl mx-auto" style={{ aspectRatio: "8/5" }}>
              <RoomMap
                items={filteredItems}
                onSelectItem={setSelectedItem}
              />
            </div>
            {filteredItems.filter(
              (i) => typeof i.map_x !== "number" || typeof i.map_y !== "number"
            ).length > 0 && (
              <p className="mt-3 text-sm text-ink-600">
                Some props don’t have a map location. Edit a prop and use “Set location on map” to add one.
              </p>
            )}
          </div>
        ) : (
        <>
        {/* Results line: count, sort, export */}
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <p className="font-sans text-sm text-ink-600">
            {filteredItems.length} {filteredItems.length === 1 ? "prop" : "props"}
          </p>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="h-9 rounded-xl border border-ink-200 bg-cream-50 px-3 font-sans text-sm text-ink-800 focus:border-accent focus:ring-2 focus:ring-accent/20 outline-none"
            aria-label="Sort by"
          >
            <option value="date">Date added</option>
            <option value="title">Title</option>
            <option value="location">Location</option>
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
              <ItemCard key={item.id} item={item} onClick={setSelectedItem} />
            ))}
          </div>
        ) : (
          <Card className="mt-6 border-dashed border-ink-300 bg-cream-50/80">
            <CardContent className="flex flex-col items-center justify-center py-20 text-center">
              <div className="rounded-2xl border border-ink-200/80 bg-cream-200/60 p-4">
                <Package2 className="h-10 w-10 text-ink-500" strokeWidth={1.25} />
              </div>
              <h3 className="mt-4 font-display text-lg font-semibold text-ink-900">
                No props here
              </h3>
              <p className="mt-2 font-sans text-sm text-ink-600">
                Try another search, switch tabs, or add a prop.
              </p>
              <Button
                type="button"
                variant="primary"
                className="mt-6 rounded-2xl"
                onClick={() => {
                  setEditingId(null);
                  setSaveError(null);
                  setIsModalOpen(true);
                }}
              >
                <Plus className="mr-2 h-4 w-4" />
                Add prop
              </Button>
            </CardContent>
          </Card>
        )}
        </>
        )}
        </>
        )}
      </div>
    </div>
  );
}
