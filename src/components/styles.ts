const base =
  'inline-flex items-center justify-center gap-1 rounded-md px-3 py-1.5 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50';

export const btn = {
  primary: `${base} bg-indigo-600 text-white hover:bg-indigo-500`,
  secondary: `${base} border border-slate-300 hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800`,
  danger: `${base} border border-red-300 text-red-700 hover:bg-red-50 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950`,
  dangerSolid: `${base} bg-red-600 text-white hover:bg-red-500`,
};

export const field =
  'w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm placeholder:text-slate-400 focus:border-indigo-500 aria-[invalid=true]:border-red-500 dark:border-slate-700 dark:bg-slate-900';

export const label = 'block text-sm font-medium';
