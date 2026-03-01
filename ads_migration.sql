-- 1. Create Teacher Ads Table
create table public.teacher_ads (
  id uuid not null default gen_random_uuid (),
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  teacher_id uuid not null references profiles(id) on delete cascade,
  is_active boolean default false,
  is_verified boolean default false,
  
  -- Public Profile Info
  display_name text not null,
  bio text,
  specialization text[], -- e.g. ['SD', 'Olimpiade', 'Aljabar']
  city text,
  rate_per_session numeric,
  whatsapp_number text, -- For now, direct contact. Later replaced by internal booking.
  
  -- Metrics
  rating numeric(3, 2) default 0,
  review_count integer default 0,
  
  constraint teacher_ads_pkey primary key (id),
  constraint teacher_ads_teacher_unique unique (teacher_id)
);

-- 2. Enable RLS
alter table public.teacher_ads enable row level security;

-- 3. Policies

-- Public Read: Anyone can see active ads
create policy "Public can view active ads"
on public.teacher_ads
for select using (
  is_active = true
);

-- Teacher Manage: Teachers can insert/update their own ad
create policy "Teachers can manage own ad"
on public.teacher_ads
for all using (
  auth.uid() = teacher_id
);

-- Admin Manage: Admins can do anything
create policy "Admins can manage all ads"
on public.teacher_ads
for all using (
  exists (
    select 1 from profiles
    where profiles.id = auth.uid()
    and profiles.role = 'admin'
  )
);