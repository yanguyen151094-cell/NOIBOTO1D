import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useMovies } from "@/hooks/useMovies";
import { createMovie, deleteMovie, updateMovie } from "@/lib/actions";
import { extractYoutubeId, fetchYoutubeInfo, checkVideoExists } from "@/lib/actions";
import type { Movie } from "@/types";

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
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState("");
  const [playingMovie, setPlayingMovie] = useState<Movie | null>(null);

  const notify = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2500);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim() || !title.trim() || busy) return;

    let videoUrl = url.trim();
    const youtubeId = extractYoutubeId(videoUrl);
    if (youtubeId) {
      videoUrl = `https://www.youtube.com/embed/${youtubeId}`;
    }

    setBusy(true);
    try {
      if (editingId) {
        await updateMovie(editingId, {
          title: title.trim(),
          description: description.trim() || undefined,
          videoUrl,
          category: category.trim() || undefined,
        });
        notify("Đã cập nhật phim.");
      } else {
        if (youtubeId) {
          const exists = await checkVideoExists(youtubeId);
          if (!exists) {
            notify("Video không tồn tại hoặc không cho phép nhúng.");
            setBusy(false);
            return;
          }
          const info = await fetchYoutubeInfo(youtubeId);
          if (!title.trim()) setTitle(info.title);
        }
        await createMovie({
          title: title.trim(),
          description: description.trim() || undefined,
          videoUrl,
          category: category.trim() || undefined,
        });
        notify("Đã thêm phim mới.");
      }
      setShowForm(false);
      setUrl("");
      setTitle("");
      setDescription("");
      setCategory("");
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

  const categories = Array.from(new Set(movies.map((m) => m.category).filter(Boolean)));

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <i className="ri-loader-4-line animate-spin text-foreground-400 text-2xl" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center px-6">
        <p className="text-sm text-foreground-600">{error}</p>
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
    <div className="h-full flex flex-col min-w-0">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-background-200 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-accent-500 text-white flex items-center justify-center shrink-0">
            <i className="ri-movie-line text-lg" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground-900">Rạp chiếu phim</p>
            <p className="text-[11px] text-foreground-500">
              {isAdmin ? "Thêm phim cho tổ viên xem" : "Xem phim cùng tổ"}
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
            className="px-3 py-2 rounded-md bg-primary-500 text-white text-sm font-medium cursor-pointer whitespace-nowrap"
          >
            {showForm ? "Đóng" : "Thêm phim"}
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto cs-scroll p-4">
        {/* Form */}
        {showForm && isAdmin && (
          <form
            onSubmit={handleSubmit}
            className="mb-4 rounded-lg border border-background-200 bg-background-50 p-4 space-y-3"
          >
            <p className="text-sm font-semibold text-foreground-900">
              {editingId ? "Sửa phim" : "Thêm phim mới"}
            </p>
            <div>
              <label className="block text-xs font-medium text-foreground-700 mb-1">
                Link video (YouTube hoặc link trực tiếp)
              </label>
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://www.youtube.com/watch?v=... hoặc link mp4/m3u8"
                required
                className="w-full px-3 py-2 rounded-md border border-background-300 bg-background-50 text-sm text-foreground-900 placeholder:text-foreground-300 focus:outline-none focus:ring-2 focus:ring-primary-400"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-foreground-700 mb-1">Tên phim</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Nhập tên phim..."
                required
                className="w-full px-3 py-2 rounded-md border border-background-300 bg-background-50 text-sm text-foreground-900 placeholder:text-foreground-300 focus:outline-none focus:ring-2 focus:ring-primary-400"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-foreground-700 mb-1">Thể loại</label>
              <input
                type="text"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="Hành động, Hài, Kinh dị..."
                className="w-full px-3 py-2 rounded-md border border-background-300 bg-background-50 text-sm text-foreground-900 placeholder:text-foreground-300 focus:outline-none focus:ring-2 focus:ring-primary-400"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-foreground-700 mb-1">Mô tả</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Mô tả ngắn về phim..."
                rows={2}
                className="w-full px-3 py-2 rounded-md border border-background-300 bg-background-50 text-sm text-foreground-900 placeholder:text-foreground-300 focus:outline-none focus:ring-2 focus:ring-primary-400 resize-none"
              />
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={busy}
                className="px-4 py-2 rounded-md bg-primary-500 text-white text-sm font-medium disabled:opacity-50 cursor-pointer whitespace-nowrap"
              >
                {busy ? "Đang lưu..." : editingId ? "Cập nhật" : "Thêm"}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-4 py-2 rounded-md bg-background-200 text-foreground-700 text-sm font-medium cursor-pointer whitespace-nowrap"
              >
                Hủy
              </button>
            </div>
          </form>
        )}

        {/* Category filters */}
        {categories.length > 0 && (
          <div className="flex gap-2 flex-wrap mb-4">
            <span className="px-2.5 py-1 rounded-full bg-secondary-100 text-secondary-700 text-xs font-medium">
              Tất cả
            </span>
            {categories.map((cat) => (
              <span
                key={cat}
                className="px-2.5 py-1 rounded-full bg-background-100 text-foreground-600 text-xs font-medium"
              >
                {cat}
              </span>
            ))}
          </div>
        )}

        {/* Movie grid */}
        {movies.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-16 h-16 rounded-full bg-background-100 flex items-center justify-center mx-auto">
              <i className="ri-movie-line text-2xl text-foreground-400" />
            </div>
            <p className="mt-4 text-sm font-medium text-foreground-600">Chưa có phim nào</p>
            <p className="mt-1 text-xs text-foreground-400">
              {isAdmin ? "Thêm phim để tổ viên cùng xem." : "Chờ Tổ Trưởng thêm phim nhé!"}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {movies.map((movie) => (
              <div
                key={movie.id}
                className="rounded-lg border border-background-200 bg-background-50 overflow-hidden hover:border-primary-300 transition-colors"
              >
                <div
                  className="aspect-video bg-black relative cursor-pointer group"
                  onClick={() => setPlayingMovie(movie)}
                >
                  {movie.thumbnail ? (
                    <img
                      src={movie.thumbnail}
                      alt={movie.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-background-200">
                      <i className="ri-movie-line text-3xl text-foreground-300" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="w-12 h-12 rounded-full bg-white/90 flex items-center justify-center">
                      <i className="ri-play-fill text-xl text-foreground-900" />
                    </div>
                  </div>
                  {movie.category && (
                    <span className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-black/60 text-white text-[10px] font-medium">
                      {movie.category}
                    </span>
                  )}
                </div>
                <div className="p-3">
                  <p className="text-sm font-semibold text-foreground-900 line-clamp-1">{movie.title}</p>
                  {movie.description && (
                    <p className="text-xs text-foreground-500 mt-1 line-clamp-2">{movie.description}</p>
                  )}
                  {isAdmin && (
                    <div className="flex gap-2 mt-2">
                      <button
                        type="button"
                        onClick={() => handleEdit(movie)}
                        className="text-xs text-primary-600 hover:text-primary-700 cursor-pointer"
                      >
                        Sửa
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(movie.id)}
                        className="text-xs text-red-500 hover:text-red-600 cursor-pointer"
                      >
                        Xóa
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Player modal */}
      {playingMovie && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4">
          <div className="w-full max-w-4xl">
            <div className="flex items-center justify-between mb-3">
              <p className="text-white font-semibold text-sm">{playingMovie.title}</p>
              <button
                type="button"
                onClick={() => setPlayingMovie(null)}
                className="w-8 h-8 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-white/20 cursor-pointer"
              >
                <i className="ri-close-line" />
              </button>
            </div>
            <div className="aspect-video bg-black rounded-lg overflow-hidden">
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
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-foreground-950 text-background-50 text-sm px-4 py-2.5 rounded-lg animate-slide-up">
          {toast}
        </div>
      )}
    </div>
  );
}