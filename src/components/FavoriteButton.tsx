export function FavoriteButton({
  favorite,
  label,
  onToggle,
  disabled,
}: {
  favorite: boolean;
  label: string;
  onToggle: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      aria-pressed={favorite}
      aria-label={label}
      title={favorite ? 'Remove from favorites' : 'Add to favorites'}
      onClick={onToggle}
      disabled={disabled}
      className={`rounded-md p-1.5 text-xl leading-none hover:bg-slate-100 disabled:opacity-50 dark:hover:bg-slate-800 ${
        favorite ? 'text-amber-500' : 'text-slate-400'
      }`}
    >
      <span aria-hidden="true">{favorite ? '★' : '☆'}</span>
    </button>
  );
}
