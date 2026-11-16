create table if not exists public.lessons (
  id text primary key,
  title text not null,
  category text not null,
  content text not null,
  created_at timestamptz not null default now()
);

alter table public.lessons enable row level security;

drop policy if exists "Lessons are readable by everyone" on public.lessons;
create policy "Lessons are readable by everyone"
  on public.lessons for select to anon, authenticated using (true);

insert into public.lessons (id, title, category, content) values
  ('scales', 'Build a major scale', 'Theory', 'A major scale follows whole, whole, half, whole, whole, whole, half steps. Try C major: C–D–E–F–G–A–B–C.'),
  ('triads', 'Make a major triad', 'Harmony', 'A major triad uses scale degrees 1, 3, and 5. In C major, play C–E–G. Lower the middle note by a semitone to hear C minor.'),
  ('pulse', 'Find a steady pulse', 'Rhythm', 'In 4/4, count 1, 2, 3, 4 evenly. Tap beats 1 and 3, then try beats 2 and 4 without losing the pulse.'),
  ('treble', 'Read treble clef', 'Reading', 'Treble-clef lines from bottom to top are E–G–B–D–F. The spaces are F–A–C–E.')
on conflict (id) do nothing;
