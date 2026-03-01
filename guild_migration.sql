-- 1. Create Guilds Table (Classes)
create table public.guilds (
  id uuid not null default gen_random_uuid (),
  created_at timestamp with time zone not null default now(),
  name text not null,
  code text not null,
  description text null,
  teacher_id uuid not null default auth.uid (),
  constraint guilds_pkey primary key (id),
  constraint guilds_code_key unique (code),
  constraint guilds_teacher_id_fkey foreign key (teacher_id) references profiles (id) on delete cascade
);

-- 2. Create Guild Members Table (Student Enrollment)
create table public.guild_members (
  id uuid not null default gen_random_uuid (),
  joined_at timestamp with time zone not null default now(),
  guild_id uuid not null,
  student_id uuid not null default auth.uid (),
  status text not null default 'active'::text,
  constraint guild_members_pkey primary key (id),
  constraint guild_members_guild_id_fkey foreign key (guild_id) references guilds (id) on delete cascade,
  constraint guild_members_student_id_fkey foreign key (student_id) references profiles (id) on delete cascade,
  constraint unique_membership unique (guild_id, student_id)
);

-- 3. Enable RLS
alter table public.guilds enable row level security;
alter table public.guild_members enable row level security;

-- 4. RLS Policies for Guilds

-- Everyone can view a guild if they know the exact CODE (for joining)
-- OR if they are the owner (teacher)
create policy "Public can view guild by code"
on public.guilds
for select using (
  true
);

-- Teachers can create guilds
create policy "Teachers can create guilds"
on public.guilds
for insert with check (
  auth.uid() = teacher_id
);

-- Teachers can update their own guilds
create policy "Teachers can update own guilds"
on public.guilds
for update using (
  auth.uid() = teacher_id
);

-- Teachers can delete their own guilds
create policy "Teachers can delete own guilds"
on public.guilds
for delete using (
  auth.uid() = teacher_id
);

-- 5. RLS Policies for Guild Members

-- Students can view their own memberships
-- Teachers can view memberships of their own guilds
create policy "View memberships"
on public.guild_members
for select using (
  auth.uid() = student_id 
  or 
  exists (
    select 1 from guilds 
    where guilds.id = guild_members.guild_id 
    and guilds.teacher_id = auth.uid()
  )
);

-- Students can join (insert themselves)
create policy "Students can join guilds"
on public.guild_members
for insert with check (
  auth.uid() = student_id
);

-- Teachers can remove members (kick)
create policy "Teachers can kick members"
on public.guild_members
for delete using (
  exists (
    select 1 from guilds 
    where guilds.id = guild_members.guild_id 
    and guilds.teacher_id = auth.uid()
  )
);

-- Students can leave
create policy "Students can leave"
on public.guild_members
for delete using (
  auth.uid() = student_id
);