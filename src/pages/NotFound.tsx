import { useNavigate } from "react-router-dom";

export default function NotFound() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background-50 px-4 text-center">
      <div className="w-20 h-20 rounded-2xl bg-primary-100 flex items-center justify-center mb-6">
        <i className="ri-error-warning-line text-4xl text-primary-600" />
      </div>
      <h1 className="font-heading text-6xl font-black text-foreground-200 select-none">404</h1>
      <h2 className="font-heading text-xl font-bold text-foreground-950 mt-2">
        Trang không tồn tại
      </h2>
      <p className="text-sm text-foreground-500 mt-2 max-w-sm">
        Trang bạn đang tìm kiếm không tồn tại hoặc đã bị di chuyển.
      </p>
      <div className="mt-6 flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="px-5 py-2.5 rounded-md bg-background-100 text-foreground-700 text-sm font-medium hover:bg-background-200 transition-colors cursor-pointer whitespace-nowrap"
        >
          <i className="ri-arrow-left-line mr-1" />
          Quay lại
        </button>
        <button
          type="button"
          onClick={() => navigate("/")}
          className="px-5 py-2.5 rounded-md bg-primary-500 text-white text-sm font-medium hover:bg-primary-600 transition-colors cursor-pointer whitespace-nowrap"
        >
          <i className="ri-dashboard-line mr-1" />
          Về Tổng quan
        </button>
      </div>
    </div>
  );
}