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
} from "lucide-react";
import { supabase, isSupabaseConfigured } from "./lib/supabase.js";

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

function Card({ children, className = "" }) {
  return (
    <div
      className={cn(
        "rounded-3xl border border-ink-200/80 bg-cream-50 shadow-soft",
        className
      )}
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

function Modal({ open, onClose, children }) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink-900/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl border border-ink-200 bg-cream-50 shadow-soft-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-ink-200 bg-cream-50/95 backdrop-blur px-6 py-4 rounded-t-3xl">
          <h2 className="font-display text-lg font-semibold text-ink-900">
            Add prop
          </h2>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="rounded-2xl text-ink-600 hover:text-ink-900"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

function ItemCard({ item }) {
  return (
    <Card className="overflow-hidden transition-all duration-300 hover:shadow-soft-lg hover:-translate-y-0.5 group">
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

export default function PropRoomInventoryApp() {
  const [items, setItems] = useState(starterItems);
  const [search, setSearch] = useState("");
  const [activeSection, setActiveSection] = useState("All Props");
  const [sections, setSections] = useState(sectionTitles);
  const [jobs, setJobs] = useState(starterJobs);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form, setForm] = useState({
    title: "",
    description: "",
    location: "",
    category: "White Plateware",
    job: "General Inventory",
    quantity: 1,
    photo: "",
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
      .select("id, title, description, location, category, job, quantity, photo")
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

    return items.filter((item) => {
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
  }, [items, search, activeSection]);

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
      };
    });
  };

  const addItem = async () => {
    if (!form.title.trim() || !form.location.trim()) return;

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

      const { error } = await supabase.from("props").insert({
        title: form.title.trim(),
        description: form.description.trim() || null,
        location: form.location.trim(),
        category: form.category,
        job: form.job.trim(),
        quantity: Math.max(1, Number(form.quantity || 1)),
        photo: photoUrl || null,
      });

      formPhotoFileRef.current = null;
      setSaving(false);
      if (error) {
        setSaveError(error.message || "Failed to save prop.");
        return;
      }
      setForm({
        title: "",
        description: "",
        location: "",
        category: "White Plateware",
        job: "General Inventory",
        quantity: 1,
        photo: "",
      });
      setIsModalOpen(false);
      await fetchProps();
      return;
    }

    setItems((current) => [
      {
        id: Date.now(),
        title: form.title.trim(),
        description: form.description.trim(),
        location: form.location.trim(),
        category: form.category,
        job: form.job.trim(),
        quantity: Math.max(1, Number(form.quantity || 1)),
        photo: form.photo.trim(),
      },
      ...current,
    ]);

    setForm({
      title: "",
      description: "",
      location: "",
      category: "White Plateware",
      job: "General Inventory",
      quantity: 1,
      photo: "",
    });

    setIsModalOpen(false);
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
              className="h-9 w-auto object-contain object-left md:h-10"
              width={192}
              height={98}
            />
            <span className="font-brand text-xl font-medium tracking-tight text-ink-900 md:text-2xl">
              Propstagram
            </span>
          </h1>
          <Button
            onClick={() => setIsModalOpen(true)}
            variant="primary"
            size="default"
            className="rounded-2xl shrink-0"
          >
            <Plus className="mr-2 h-4 w-4" />
            Add Prop
          </Button>
        </div>

        <Modal open={isModalOpen} onClose={() => { setSaveError(null); setIsModalOpen(false); }}>
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

            <div className="flex gap-3 pt-2">
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
                  "Save Prop"
                )}
              </Button>
            </div>
          </div>
        </Modal>

        {loading ? (
          <Card className="border-ink-200/60">
            <CardContent className="flex items-center justify-center gap-3 py-12">
              <Loader2 className="h-8 w-8 animate-spin text-ink-500" />
              <span className="font-sans text-ink-600">Loading props…</span>
            </CardContent>
          </Card>
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

        {/* Results line */}
        <p className="mt-4 font-sans text-sm text-ink-600">
          {filteredItems.length} {filteredItems.length === 1 ? "prop" : "props"}
        </p>

        {/* Item grid or empty state */}
        {filteredItems.length > 0 ? (
          <div className="mt-6 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {filteredItems.map((item) => (
              <ItemCard key={item.id} item={item} />
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
            </CardContent>
          </Card>
        )}
        </>
        )}
      </div>
    </div>
  );
}
