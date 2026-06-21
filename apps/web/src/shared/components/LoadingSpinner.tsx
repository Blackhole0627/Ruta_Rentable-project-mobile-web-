export function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center py-12">
      <div className="relative h-10 w-10">
        <div className="absolute inset-0 rounded-full border-[3px] border-road-100" />
        <div className="absolute inset-0 animate-spin rounded-full border-[3px] border-transparent border-t-brand-500 border-r-brand-500" />
      </div>
    </div>
  );
}
