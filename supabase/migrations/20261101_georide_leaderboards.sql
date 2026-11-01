-- GEO Ride leaderboards: anonymous players, best scores per board/period, secure RPC access only.

create table if not exists public.georide_players (
    id uuid primary key,
    name text not null default 'Pilot',
    country text,
    is_pro boolean not null default false,
    level int not null default 1,
    xp bigint not null default 0,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.georide_scores (
    player_id uuid not null references public.georide_players(id) on delete cascade,
    board text not null check (board in ('drift', 'speed', 'daily', 'weekly')),
    period text not null,
    score numeric not null check (score >= 0),
    updated_at timestamptz not null default now(),
    primary key (player_id, board, period)
);

create index if not exists georide_scores_rank_idx on public.georide_scores (board, period, score desc);

alter table public.georide_players enable row level security;
alter table public.georide_scores enable row level security;

-- No policies on purpose: tables are reachable only through the SECURITY DEFINER functions below.
revoke all on public.georide_players from anon, authenticated;
revoke all on public.georide_scores from anon, authenticated;

create or replace function public.georide_is_europe(p_cc text)
returns boolean
language sql
immutable
set search_path = public, pg_temp
as $$
    select p_cc = any (array[
        'AL','AD','AT','BY','BE','BA','BG','HR','CY','CZ','DK','EE','FI','FR','DE','GR','HU','IS','IE','IT',
        'XK','LV','LI','LT','LU','MT','MD','MC','ME','NL','MK','NO','PL','PT','RO','RU','SM','RS','SK','SI',
        'ES','SE','CH','UA','GB','VA'
    ]);
$$;

create or replace function public.georide_submit_score(
    p_player uuid,
    p_name text,
    p_country text,
    p_email text,
    p_level int,
    p_xp bigint,
    p_scores jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    v_name text;
    v_country text;
    v_pro boolean := false;
    v_item jsonb;
    v_board text;
    v_period text;
    v_score numeric;
    v_max numeric;
    v_cur_daily text := to_char(now() at time zone 'UTC', 'YYYY-MM-DD');
    v_prev_daily text := to_char((now() at time zone 'UTC') - interval '1 day', 'YYYY-MM-DD');
    v_cur_weekly text := to_char(now() at time zone 'UTC', 'IYYY"-W"IW');
    v_prev_weekly text := to_char((now() at time zone 'UTC') - interval '7 days', 'IYYY"-W"IW');
    v_last timestamptz;
    v_saved int := 0;
begin
    if p_player is null then
        return jsonb_build_object('ok', false, 'error', 'player_required');
    end if;
    if p_scores is null or jsonb_typeof(p_scores) <> 'array' or jsonb_array_length(p_scores) > 8 then
        return jsonb_build_object('ok', false, 'error', 'bad_scores');
    end if;

    v_name := left(trim(regexp_replace(coalesce(p_name, ''), '[^[:alnum:] _.-]', '', 'g')), 16);
    if v_name = '' then v_name := 'Pilot'; end if;

    v_country := upper(trim(coalesce(p_country, '')));
    if v_country !~ '^[A-Z]{2}$' then v_country := null; end if;

    if p_email is not null and length(trim(p_email)) > 3 then
        begin
            v_pro := coalesce((public.check_georide_pro_status(p_email) ->> 'is_pro')::boolean, false);
        exception when others then
            v_pro := false;
        end;
    end if;

    select updated_at into v_last from public.georide_players where id = p_player;
    if v_last is not null and v_last > now() - interval '3 seconds' then
        return jsonb_build_object('ok', false, 'error', 'rate_limited');
    end if;

    insert into public.georide_players (id, name, country, is_pro, level, xp, updated_at)
    values (
        p_player, v_name, v_country, v_pro,
        greatest(1, least(coalesce(p_level, 1), 200)),
        greatest(0, least(coalesce(p_xp, 0), 100000000)),
        now()
    )
    on conflict (id) do update set
        name = excluded.name,
        country = excluded.country,
        is_pro = excluded.is_pro,
        level = excluded.level,
        xp = excluded.xp,
        updated_at = now();

    for v_item in select * from jsonb_array_elements(p_scores) loop
        v_board := v_item ->> 'board';
        v_period := v_item ->> 'period';
        begin
            v_score := floor((v_item ->> 'score')::numeric);
        exception when others then
            continue;
        end;

        if v_score is null or v_score <= 0 then continue; end if;

        if v_board = 'drift' and v_period = 'all' then
            v_max := 3000000;
        elsif v_board = 'speed' and v_period = 'all' then
            v_max := case when v_pro then 1000 else 250 end;
        elsif v_board = 'daily' and v_period in (v_cur_daily, v_prev_daily) then
            v_max := 5000000;
        elsif v_board = 'weekly' and v_period in (v_cur_weekly, v_prev_weekly) then
            v_max := 30000000;
        else
            continue;
        end if;

        if v_score > v_max then continue; end if;

        insert into public.georide_scores (player_id, board, period, score, updated_at)
        values (p_player, v_board, v_period, v_score, now())
        on conflict (player_id, board, period) do update set
            score = greatest(public.georide_scores.score, excluded.score),
            updated_at = case when excluded.score > public.georide_scores.score then now() else public.georide_scores.updated_at end;
        v_saved := v_saved + 1;
    end loop;

    return jsonb_build_object('ok', true, 'saved', v_saved, 'is_pro', v_pro);
end;
$$;

create or replace function public.georide_leaderboard(
    p_board text,
    p_period text,
    p_scope text,
    p_country text,
    p_player uuid,
    p_limit int
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    v_limit int := greatest(1, least(coalesce(p_limit, 10), 100));
    v_country text := upper(trim(coalesce(p_country, '')));
    v_entries jsonb;
    v_me jsonb;
    v_total int;
begin
    if p_board not in ('drift', 'speed', 'daily', 'weekly') then
        return jsonb_build_object('entries', '[]'::jsonb, 'me', null, 'total', 0);
    end if;

    with ranked as (
        select
            (row_number() over (order by s.score desc, s.updated_at asc))::int as rank,
            p.id as player_id, p.name, p.country, s.score, p.is_pro, p.level
        from public.georide_scores s
        join public.georide_players p on p.id = s.player_id
        where s.board = p_board
          and s.period = p_period
          and (
              coalesce(p_scope, 'global') = 'global'
              or (p_scope = 'europe' and public.georide_is_europe(p.country))
              or (p_scope = 'country' and p.country = v_country)
          )
    )
    select
        (select count(*) from ranked),
        coalesce((
            select jsonb_agg(jsonb_build_object(
                'rank', t.rank, 'name', t.name, 'country', t.country, 'score', t.score,
                'is_pro', t.is_pro, 'level', t.level, 'is_me', (t.player_id = p_player)
            ) order by t.rank)
            from (select * from ranked order by rank limit v_limit) t
        ), '[]'::jsonb),
        (select jsonb_build_object('rank', r.rank, 'score', r.score, 'name', r.name)
         from ranked r where r.player_id = p_player)
    into v_total, v_entries, v_me;

    return jsonb_build_object('entries', v_entries, 'me', v_me, 'total', v_total);
end;
$$;

revoke all on function public.georide_submit_score(uuid, text, text, text, int, bigint, jsonb) from public;
revoke all on function public.georide_leaderboard(text, text, text, text, uuid, int) from public;
grant execute on function public.georide_submit_score(uuid, text, text, text, int, bigint, jsonb) to anon, authenticated;
grant execute on function public.georide_leaderboard(text, text, text, text, uuid, int) to anon, authenticated;
