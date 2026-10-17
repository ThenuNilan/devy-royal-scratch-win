-- =========================================================
-- DEVY SCRATCH & WIN
-- PostgreSQL / Supabase database foundation
-- =========================================================

create extension if not exists pgcrypto;

-- 1. Campaign settings
create table if not exists public.campaigns (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    status text not null default 'draft'
        check (status in ('draft', 'active', 'closed')),
    cards_per_customer integer not null default 5
        check (cards_per_customer = 5),
    special_interval integer not null default 7
        check (special_interval > 0),
    created_at timestamptz not null default now()
);

-- 2. Prize inventory
create table if not exists public.prizes (
    id uuid primary key default gen_random_uuid(),
    campaign_id uuid not null
        references public.campaigns(id) on delete restrict,
    prize_code text not null,
    prize_name text not null,
    value_lkr integer not null default 0
        check (value_lkr >= 0),
    starting_quantity integer not null
        check (starting_quantity >= 0),
    remaining_quantity integer not null
        check (
            remaining_quantity >= 0
            and remaining_quantity <= starting_quantity
        ),
    is_key_tag boolean not null default false,
    created_at timestamptz not null default now(),
    unique (campaign_id, prize_code)
);

-- 3. Customer registration
create table if not exists public.customers (
    id uuid primary key default gen_random_uuid(),
    campaign_id uuid not null
        references public.campaigns(id) on delete restrict,
    customer_number bigint not null,
    full_name text not null
        check (length(trim(full_name)) between 1 and 100),
    address text not null
        check (length(trim(address)) between 1 and 300),
    registered_at timestamptz not null default now(),
    game_completed_at timestamptz,
    created_at timestamptz not null default now(),
    unique (campaign_id, customer_number)
);

-- 4. Five scratch-card result records per customer
create table if not exists public.scratch_cards (
    id uuid primary key default gen_random_uuid(),
    customer_id uuid not null
        references public.customers(id) on delete restrict,
    card_number integer not null
        check (card_number between 1 and 5),
    prize_id uuid
        references public.prizes(id) on delete restrict,
    result_type text not null
        check (result_type in ('oops', 'prize', 'keytag')),
    revealed_at timestamptz,
    created_at timestamptz not null default now(),
    unique (customer_id, card_number),

    check (
        (result_type = 'oops' and prize_id is null)
        or
        (result_type in ('prize', 'keytag') and prize_id is not null)
    )
);

-- 5. Unique redemption codes
create table if not exists public.redemptions (
    id uuid primary key default gen_random_uuid(),
    customer_id uuid not null
        references public.customers(id) on delete restrict,
    scratch_card_id uuid not null unique
        references public.scratch_cards(id) on delete restrict,
    redemption_code text not null unique
        default upper(encode(gen_random_bytes(8), 'hex')),
    status text not null default 'pending'
        check (status in ('pending', 'redeemed', 'cancelled')),
    redeemed_at timestamptz,
    redeemed_by uuid references auth.users(id),
    created_at timestamptz not null default now()
);

-- 6. Authenticated manager profiles
create table if not exists public.manager_profiles (
    user_id uuid primary key
        references auth.users(id) on delete cascade,
    display_name text not null,
    role text not null default 'manager'
        check (role in ('manager', 'admin')),
    created_at timestamptz not null default now()
);

-- 7. Useful indexes
create index if not exists customers_campaign_number_idx
    on public.customers (campaign_id, customer_number);

create index if not exists customers_registered_at_idx
    on public.customers (registered_at desc);

create index if not exists scratch_cards_customer_idx
    on public.scratch_cards (customer_id);

create index if not exists redemptions_status_idx
    on public.redemptions (status);

create index if not exists prizes_campaign_idx
    on public.prizes (campaign_id);

-- 8. Create the campaign and initial prize stock.
-- Safe to rerun: campaign name and prize codes are checked.

insert into public.campaigns (
    name, status, cards_per_customer, special_interval
)
select
    'DEVY Scratch & Win 2026',
    'draft',
    5,
    7
where not exists (
    select 1
    from public.campaigns
    where name = 'DEVY Scratch & Win 2026'
);

insert into public.prizes (
    campaign_id,
    prize_code,
    prize_name,
    value_lkr,
    starting_quantity,
    remaining_quantity,
    is_key_tag
)
select
    c.id,
    p.prize_code,
    p.prize_name,
    p.value_lkr,
    p.quantity,
    p.quantity,
    false
from public.campaigns c
cross join (
    values
        ('golden-glow-facial', 'Golden Glow Facial', 4800, 2),
        ('hair-styling', 'Hair Styling', 2200, 5),
        ('clean-up', 'Clean Up', 1000, 5),
        ('normal-nail-polish', 'Normal Nail Polish', 500, 8),
        ('eyebrow-threading', 'Eyebrow Threading', 300, 10)
) as p(prize_code, prize_name, value_lkr, quantity)
where c.name = 'DEVY Scratch & Win 2026'
on conflict (campaign_id, prize_code) do nothing;

-- Key Tag intentionally not seeded.
-- Its quantity must be confirmed before production allocation.

-- 9. Enable Row Level Security.
alter table public.campaigns enable row level security;
alter table public.prizes enable row level security;
alter table public.customers enable row level security;
alter table public.scratch_cards enable row level security;
alter table public.redemptions enable row level security;
alter table public.manager_profiles enable row level security;

-- No public read/write policies are created.
-- Public browser requests cannot access these tables by default.
-- Implement authenticated manager policies and trusted server-side
-- functions before connecting the live customer frontend.

-- =========================================================
-- REQUIRED PRODUCTION OPERATIONS
-- =========================================================
-- A. Atomically allocate customer numbers.
-- B. Create exactly five card records in a single transaction.
-- C. Apply the configured winning positions and every-seventh rule.
-- D. Lock/decrement inventory without allowing negative stock.
-- E. Block Key Tag allocation until its stock is confirmed.
-- F. Create unique redemption codes for winning cards.
-- G. Allow authorized managers to redeem each code only once.
-- H. Protect customer names and addresses from public access.
-- I. Use Supabase Auth for manager login.
--
-- This SQL creates tables and initial inventory. It does NOT
-- implement those operations by itself.
-- Never expose a service-role key in frontend JavaScript.