-- Enable necessary extensions
create extension if not exists "uuid-ossp";

-- Create users profile table (extends Supabase auth.users)
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  email text unique not null,
  phone text,
  kyc_status text check (kyc_status in ('pending', 'approved', 'failed')) default 'pending',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create wallets table for custodial wallets
create table public.wallets (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  address text not null,
  chain text default 'base' not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create balance snapshots table
create table public.balance_snapshots (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  asset text check (asset in ('XAU', 'USD', 'GBP', 'GOLD_TOKEN')) not null,
  amount decimal(20,8) not null default 0,
  snapshot_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create transactions table
create table public.transactions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  type text check (type in ('BUY_GOLD', 'SELL_GOLD', 'CARD_SETTLEMENT', 'P2P', 'FEE', 'ADJUSTMENT')) not null,
  status text check (status in ('pending', 'completed', 'failed', 'cancelled')) default 'pending',
  asset text not null,
  quantity decimal(20,8) not null,
  unit_price_usd decimal(20,8),
  fee_usd decimal(20,8) default 0,
  fee_gold_units decimal(20,8) default 0,
  tx_hash text,
  metadata jsonb default '{}'::jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create quotes table
create table public.quotes (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  side text check (side in ('BUY', 'SELL')) not null,
  grams decimal(20,8) not null,
  unit_price_usd decimal(20,8) not null,
  fee_bps integer not null,
  expires_at timestamp with time zone not null,
  route jsonb default '{}'::jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create notifications table
create table public.notifications (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  kind text not null,
  title text not null,
  body text not null,
  read boolean default false,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create config table for app settings
create table public.config (
  key text primary key,
  value text not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable Row Level Security
alter table public.profiles enable row level security;
alter table public.wallets enable row level security;
alter table public.balance_snapshots enable row level security;
alter table public.transactions enable row level security;
alter table public.quotes enable row level security;
alter table public.notifications enable row level security;

-- Create policies
create policy "Users can view own profile" on public.profiles for select using (auth.uid() = id);
create policy "Users can update own profile" on public.profiles for update using (auth.uid() = id);
create policy "Users can insert own profile" on public.profiles for insert with check (auth.uid() = id);

create policy "Users can view own wallets" on public.wallets for select using (auth.uid() = user_id);
create policy "Users can view own balance snapshots" on public.balance_snapshots for select using (auth.uid() = user_id);
create policy "Users can view own transactions" on public.transactions for select using (auth.uid() = user_id);
create policy "Users can view own quotes" on public.quotes for select using (auth.uid() = user_id);
create policy "Users can view own notifications" on public.notifications for select using (auth.uid() = user_id);
create policy "Users can update own notifications" on public.notifications for update using (auth.uid() = user_id);

-- Create functions for updated_at triggers
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$ language plpgsql;

-- Create updated_at triggers
create trigger handle_updated_at before update on public.profiles for each row execute procedure public.handle_updated_at();
create trigger handle_updated_at before update on public.transactions for each row execute procedure public.handle_updated_at();

-- Create function to handle new user signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email);
  return new;
end;
$$ language plpgsql security definer;

-- Create trigger for new user signup
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Insert initial config values
insert into public.config (key, value) values
  ('platform_fee_bps', '35'),
  ('chain_id', 'base'),
  ('dex_router', 'uniswap'),
  ('kyc_required', 'true');