import { useState, useMemo } from "react";
import { useAuth } from "@/context/AuthContext";
import { useMovies } from "@/hooks/useMovies";
import {
  createMovie,
  deleteMovie,
  updateMovie,
  extractYoutubeId,
  fetchYoutubeInfo,
  checkVideoExists,
} from "@/lib/actions";
import type { Movie } from "@/types";

const CINEMA_BG = "https://readdy.ai/api/search-image?query=Dark%20cinema%20theater%20interior%20with%20red%20velvet%20seats%20and%20projector%20light%20beam%20on%20screen%2C%20dramatic%20lighting%2C%20cinematic%20atmosphere%2C%20professional%20movie%20theater%20photography&width=1600&height=600&seq=movies-hero-bg&orientation=landscape";

export default function MoviesPage() {
  const { currentUser } = useAuth();
  const isAdmin = currentUser?.role === "admin";
  const { movies, loading, error, reload } = useMovies();

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [duration, setDuration] = useState("");
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState("");
  const [playingMovie, setPlayingMovie] = useState<Movie | null>(null);
  const [activeCategory, setActiveCategory] = useState("Tất cả");
  const [searchQuery, setSearchQuery] = useState("");

  const notify = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2500);
  };

  const categories = useMemo(() => {
    const cats = Array.from(new Set(movies.map((m) => m.category).filter(Boolean)));
    return ["Tất cả", ...cats];
  }, [movies]);

  const filteredMovies = useMemo(() => {
    let list = movies;
    if (activeCategory !== "Tất cả") {
      list = list.filter((m) => m.category === activeCategory);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter((m) => m.title.toLowerCase().includes(q));
    }
    return list;
  }, [movies, activeCategory, searchQuery]);

  const featuredMovie = filteredMovies[0] ?? null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim() || !title.trim() || busy) return;

    let videoUrl = url.trim();
    const youtubeId = extractYoutubeId(videoUrl);
    let thumbnail = "";
    if (youtubeId) {
      videoUrl = `https://www.youtube.com/embed/${youtubeId}`;
      thumbnail = `https://i.ytimg.com/vi/${youtubeId}/hqdefault.jpg`;
      const exists = await checkVideoExists(youtubeId);
      if (!exists) {
        notify("Video không tồn tại hoặc không cho phép nhúng.");
        setBusy(false);
        return;
      }
      const info = await fetchYoutubeInfo(youtubeId);
      if (!title.trim()) setTitle(info.title);
      if (!thumbnail) thumbnail = info.thumbnail;
    }

    setBusy(true);
    try {
      if (editingId) {
        await updateMovie(editingId, {
          title: title.trim(),
          description: description.trim() || undefined,
          videoUrl,
          thumbnail: thumbnail || undefined,
          category: category.trim() || undefined,
        });
        notify("Đã cập nhật phim.");
      } else {
        await createMovie({
          title: title.trim(),
          description: description.trim() || undefined,
          videoUrl,
          thumbnail: thumbnail || undefined,
          category: category.trim() || undefined,
        });
        notify("Đã thêm phim mới.");
      }
      setShowForm(false);
      setUrl("");
      setTitle("");
      setDescription("");
      setCategory("");
      setDuration("");
      setEditingId(null);
      reload();
    } catch (err) {
      notify(err instanceof Error ? err.message : "Lỗi.");
    } finally {
      setBusy(false);
    }
  };

  const handleEdit = (movie: Movie) => {
    setEditingId(movie.id);
    setTitle(movie.title);
    setDescription(movie.description ?? "");
    setUrl(movie.videoUrl);
    setCategory(movie.category ?? "");
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Xóa phim này?")) return;
    setBusy(true);
    try {
      await deleteMovie(id);
      notify("Đã xóa.");
      reload();
    } catch (err) {
      notify(err instanceof Error ? err.message : "Lỗi.");
    } finally {
      setBusy(false);
    }
  };

  const isYouTube = (url: string) => url.includes("youtube.com") || url.includes("youtu.be");

  const getThumbnail = (movie: Movie) => {
    if (movie.thumbnail) return movie.thumbnail;
    const yid = extractYoutubeId(movie.videoUrl);
    if (yid) return `https://i.ytimg.com/vi/${yid}/hqdefault.jpg`;
    return "";
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center bg-foreground-950">
        <i className="ri-loader-4-line animate-spin text-foreground-400 text-2xl" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center px-6 bg-foreground-950">
        <p className="text-sm text-foreground-400">{error}</p>
        <button
          type="button"
          onClick={reload}
          className="mt-3 px-4 py-2 rounded-md bg-primary-500 text-white text-sm cursor-pointer"
        >
          Thử lại
        </button>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col min-w-0 bg-foreground-950 overflow-y-auto cs-scroll">
      {/* Cinema Header */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0">
          <img
            src={CINEMA_BG}
            alt="Cinema"
            className="w-full h-full object-cover opacity-30"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-foreground-950/60 via-foreground-950/80 to-foreground-950" />
        </div>
        <div className="relative px-4 md:px-8 py-6">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-amber-500 flex items-center justify-center shrink-0">
                <i className="ri-movie-line text-lg text-foreground-950" />
              </div>
              <div>
                <p className="text-lg font-bold text-white">Rạp Chiếu Phim TỔ 1D</p>
                <p className="text-xs text-foreground-400">
                  {isAdmin ? "Quản lý và phát phim cho tổ viên" : "Xem phim cùng tổ viên"}
                </p>
              </div>
            </div>
            {isAdmin && (
              <button
                type="button"
                onClick={() => {
                  setShowForm(!showForm);
                  setEditingId(null);
                  setUrl("");
                  setTitle("");
                  setDescription("");
                  setCategory("");
                }}
                className="px-4 py-2 rounded-md bg-amber-500 text-foreground-950 text-sm font-medium hover:bg-amber-400 cursor-pointer whitespace-nowrap"
              >
                {showForm ? "Đóng" : "Thêm phim"}
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 px-4 md:px-8 pb-8">
        {/* Admin Form */}
        {showForm && isAdmin && (
          <form
            onSubmit={handleSubmit}
            className="mb-6 rounded-lg border border-foreground-800 bg-foreground-900/50 p-5 space-y-3 backdrop-blur-sm"
          >
            <p className="text-sm font-semibold text-white">
              {editingId ? "Sửa phim" : "Thêm phim mới"}
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-foreground-400 mb-1">
                  Link video (YouTube hoặc link trực tiếp)
                </label>
                <input
                  type="text"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://www.youtube.com/watch?v=..."
                  required
                  className="w-full px-3 py-2 rounded-md border border-foreground-800 bg-foreground-900 text-sm text-white placeholder:text-foreground-600 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-foreground-400 mb-1">Tên phim</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Nhập tên phim..."
                  required
                  className="w-full px-3 py-2 rounded-md border border-foreground-800 bg-foreground-900 text-sm text-white placeholder:text-foreground-600 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-foreground-400 mb-1">Thể loại</label>
                <input
                  type="text"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  placeholder="Hành động, Hài, Kinh dị..."
                  className="w-full px-3 py-2 rounded-md border border-foreground-800 bg-foreground-900 text-sm text-white placeholder:text-foreground-600 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-foreground-400 mb-1">Thời lượng (tùy chọn)</label>
                <input
                  type="text"
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                  placeholder="VD: 1h 30m"
                  className="w-full px-3 py-2 rounded-md border border-foreground-800 bg-foreground-900 text-sm text-white placeholder:text-foreground-600 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-foreground-400 mb-1">Mô tả</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Mô tả ngắn về phim..."
                rows={2}
                className="w-full px-3 py-2 rounded-md border border-foreground-800 bg-foreground-900 text-sm text-white placeholder:text-foreground-600 focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none"
              />
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={busy}
                className="px-4 py-2 rounded-md bg-amber-500 text-foreground-950 text-sm font-medium disabled:opacity-50 cursor-pointer whitespace-nowrap"
              >
                {busy ? "Đang lưu..." : editingId ? "Cập nhật" : "Thêm phim"}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-4 py-2 rounded-md bg-foreground-800 text-foreground-300 text-sm font-medium cursor-pointer whitespace-nowrap"
              >
                Hủy
              </button>
            </div>
          </form>
        )}

        {/* Search & Filters */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-5">
          <div className="relative flex-1 max-w-sm">
            <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-foreground-500 text-sm" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm kiếm phim..."
              className="w-full pl-9 pr-3 py-2 rounded-md border border-foreground-800 bg-foreground-900 text-sm text-white placeholder:text-foreground-600 focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>
          <div className="flex gap-1 flex-wrap">
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setActiveCategory(cat)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                  activeCategory === cat
                    ? "bg-amber-500 text-foreground-950"
                    : "bg-foreground-900 text-foreground-400 hover:text-white hover:bg-foreground-800"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Featured Movie */}
        {featuredMovie && activeCategory === "Tất cả" && !searchQuery && (
          <div className="mb-8 rounded-xl overflow-hidden border border-foreground-800 bg-foreground-900/30 relative group">
            <div className="flex flex-col md:flex-row">
              <div
                className="md:w-1/3 aspect-[2/3] md:aspect-auto relative cursor-pointer overflow-hidden"
                onClick={() => setPlayingMovie(featuredMovie)}
              >
                <img
                  src={getThumbnail(featuredMovie)}
                  alt={featuredMovie.title}
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="w-16 h-16 rounded-full bg-amber-500/90 flex items-center justify-center backdrop-blur-sm">
                    <i className="ri-play-fill text-2xl text-foreground-950" />
                  </div>
                </div>
              </div>
              <div className="flex-1 p-5 md:p-6 flex flex-col justify-center">
                <div className="flex items-center gap-2 mb-2">
                  <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 text-[10px] font-bold uppercase tracking-wider">
                    Đang chiếu
                  </span>
                  {featuredMovie.category && (
                    <span className="px-2 py-0.5 rounded-full bg-foreground-800 text-foreground-400 text-[10px] font-medium">
                      {featuredMovie.category}
                    </span>
                  )}
                </div>
                <h2 className="text-xl md:text-2xl font-bold text-white mb-2">{featuredMovie.title}</h2>
                {featuredMovie.description && (
                  <p className="text-sm text-foreground-400 leading-relaxed line-clamp-3 mb-4">
                    {featuredMovie.description}
                  </p>
                )}
                <button
                  type="button"
                  onClick={() => setPlayingMovie(featuredMovie)}
                  className="self-start px-5 py-2.5 rounded-lg bg-amber-500 text-foreground-950 text-sm font-semibold hover:bg-amber-400 transition-colors cursor-pointer whitespace-nowrap flex items-center gap-2"
                >
                  <i className="ri-play-fill" />
                  Xem phim ngay
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Movie Grid */}
        {filteredMovies.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-20 h-20 rounded-full bg-foreground-900 flex items-center justify-center mx-auto mb-4">
              <i className="ri-movie-line text-3xl text-foreground-600" />
            </div>
            <p className="text-sm font-medium text-foreground-400">Chưa có phim nào</p>
            <p className="mt-1 text-xs text-foreground-600">
              {isAdmin ? "Thêm phim để tổ viên cùng xem." : "Chờ Tổ Trưởng thêm phim nhé!"}
            </p>
          </div>
        ) : (
          <div>
            <h3 className="text-sm font-semibold text-foreground-400 mb-3 uppercase tracking-wider">
              {activeCategory === "Tất cả" ? "Tất cả phim" : activeCategory}
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {filteredMovies.map((movie) => (
                <div
                  key={movie.id}
                  className="group rounded-lg overflow-hidden border border-foreground-800 bg-foreground-900/40 hover:border-amber-500/50 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:shadow-amber-500/5"
                >
                  <div
                    className="aspect-[2/3] relative cursor-pointer overflow-hidden bg-foreground-900"
                    onClick={() => setPlayingMovie(movie)}
                  >
                    {getThumbnail(movie) ? (
                      <img
                        src={getThumbnail(movie)}
                        alt={movie.title}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <i className="ri-movie-line text-3xl text-foreground-600" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                      <div className="w-14 h-14 rounded-full bg-amber-500/90 flex items-center justify-center backdrop-blur-sm shadow-lg shadow-black/40">
                        <i className="ri-play-fill text-2xl text-foreground-950" />
                      </div>
                    </div>
                    {movie.category && (
                      <span className="absolute top-2 left-2 px-2 py-0.5 rounded bg-black/60 text-white text-[10px] font-medium backdrop-blur-sm">
                        {movie.category}
                      </span>
                    )}
                    {isAdmin && (
                      <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); handleEdit(movie); }}
                          className="w-7 h-7 rounded-md bg-black/60 text-white flex items-center justify-center hover:bg-amber-500 cursor-pointer backdrop-blur-sm"
                          title="Sửa"
                        >
                          <i className="ri-pencil-line text-xs" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); handleDelete(movie.id); }}
                          className="w-7 h-7 rounded-md bg-black/60 text-white flex items-center justify-center hover:bg-red-500 cursor-pointer backdrop-blur-sm"
                          title="Xóa"
                        >
                          <i className="ri-delete-bin-line text-xs" />
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="p-3">
                    <p className="text-sm font-semibold text-white line-clamp-1 group-hover:text-amber-400 transition-colors">
                      {movie.title}
                    </p>
                    {movie.description && (
                      <p className="text-xs text-foreground-500 mt-1 line-clamp-2">{movie.description}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Cinema Player Modal */}
      {playingMovie && (
        <div className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-4">
          <div className="w-full max-w-5xl">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-white font-bold text-lg">{playingMovie.title}</p>
                {playingMovie.category && (
                  <p className="text-xs text-amber-400 mt-0.5">{playingMovie.category}</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setPlayingMovie(null)}
                className="w-9 h-9 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-white/20 cursor-pointer"
              >
                <i className="ri-close-line" />
              </button>
            </div>
            <div className="aspect-video bg-black rounded-xl overflow-hidden border border-foreground-800 shadow-2xl">
              {isYouTube(playingMovie.videoUrl) ? (
                <iframe
                  src={playingMovie.videoUrl}
                  className="w-full h-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  title={playingMovie.title}
                />
              ) : (
                <video
                  src={playingMovie.videoUrl}
                  controls
                  autoPlay
                  className="w-full h-full"
                />
              )}
            </div>
            {playingMovie.description && (
              <p className="mt-4 text-sm text-foreground-400 leading-relaxed max-w-2xl">
                {playingMovie.description}
              </p>
            )}
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-foreground-950 text-white text-sm px-4 py-2.5 rounded-lg border border-foreground-800 animate-slide-up">
          {toast}
        </div>
      )}
    </div>
  );
}