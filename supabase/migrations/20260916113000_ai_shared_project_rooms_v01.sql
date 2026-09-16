-- Human + AI shared project rooms MVP.
-- Access is RPC-only; caller identity is always derived from auth.uid().

create table public.ai_project_rooms (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(btrim(title)) between 2 and 120),
  description text not null default '' check (length(description) <= 2000),
  room_type text not null default 'GENERAL'
    check (room_type in ('STUDENT_CASE','ASSESSMENT','OPERATIONS','GENERAL')),
  status text not null default 'OPEN'
    check (status in ('OPEN','IN_PROGRESS','AWAITING_REVIEW','COMPLETED','ARCHIVED')),
  created_by_actor_id uuid not null references governance.actor(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.ai_project_room_members (
  room_id uuid not null references public.ai_project_rooms(id) on delete cascade,
  member_type text not null check (member_type in ('HUMAN','AI_AGENT')),
  member_key text not null check (member_key ~ '^[a-z0-9][a-z0-9._-]{1,63}$'),
  display_name text not null,
  joined_at timestamptz not null default now(),
  primary key (room_id, member_type, member_key)
);

create table public.ai_project_room_messages (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.ai_project_rooms(id) on delete cascade,
  author_type text not null check (author_type in ('HUMAN','AI_AGENT','SYSTEM')),
  author_key text not null,
  author_name text not null,
  message_type text not null default 'COMMENT'
    check (message_type in ('COMMENT','TASK_REQUEST','AI_RESULT','REVIEW','REWORK_REQUEST','SYSTEM')),
  body text not null check (length(btrim(body)) between 1 and 12000),
  related_run_id uuid references governance.agent_run(id),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now()
);

create index ai_project_rooms_updated_idx
  on public.ai_project_rooms(updated_at desc);
create index ai_project_room_messages_room_idx
  on public.ai_project_room_messages(room_id, created_at, id);
create index ai_project_room_members_key_idx
  on public.ai_project_room_members(member_key, room_id);

alter table public.ai_project_rooms enable row level security;
alter table public.ai_project_rooms force row level security;
alter table public.ai_project_room_members enable row level security;
alter table public.ai_project_room_members force row level security;
alter table public.ai_project_room_messages enable row level security;
alter table public.ai_project_room_messages force row level security;

revoke all on public.ai_project_rooms from public, anon, authenticated;
revoke all on public.ai_project_room_members from public, anon, authenticated;
revoke all on public.ai_project_room_messages from public, anon, authenticated;

create or replace function public.list_ai_project_rooms_v01()
returns jsonb
language plpgsql
security definer
stable
set search_path = ''
as $$
declare
  v_actor governance.actor%rowtype;
  v_rooms jsonb;
begin
  v_actor := governance.require_authenticated_human();

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', r.id,
    'title', r.title,
    'description', r.description,
    'roomType', r.room_type,
    'status', r.status,
    'updatedAt', r.updated_at,
    'memberCount', (select count(*) from public.ai_project_room_members m where m.room_id = r.id),
    'messageCount', (select count(*) from public.ai_project_room_messages x where x.room_id = r.id),
    'agents', coalesce((
      select jsonb_agg(jsonb_build_object('key', m.member_key, 'name', m.display_name) order by m.display_name)
      from public.ai_project_room_members m
      where m.room_id = r.id and m.member_type = 'AI_AGENT'
    ), '[]'::jsonb)
  ) order by r.updated_at desc), '[]'::jsonb)
  into v_rooms
  from public.ai_project_rooms r
  where v_actor.permission_tier = 5
     or exists (
       select 1 from public.ai_project_room_members m
       where m.room_id = r.id and m.member_type = 'HUMAN' and m.member_key = v_actor.actor_key
     );

  return jsonb_build_object(
    'actor', jsonb_build_object(
      'actorKey', v_actor.actor_key,
      'displayName', v_actor.display_name,
      'permissionTier', v_actor.permission_tier
    ),
    'rooms', v_rooms
  );
end;
$$;

create or replace function public.get_ai_project_room_v01(p_room_id uuid)
returns jsonb
language plpgsql
security definer
stable
set search_path = ''
as $$
declare
  v_actor governance.actor%rowtype;
  v_room public.ai_project_rooms%rowtype;
begin
  v_actor := governance.require_authenticated_human();

  select * into v_room
  from public.ai_project_rooms
  where id = p_room_id
    and (
      v_actor.permission_tier = 5
      or exists (
        select 1 from public.ai_project_room_members m
        where m.room_id = p_room_id and m.member_type = 'HUMAN' and m.member_key = v_actor.actor_key
      )
    );

  if not found then
    raise exception using errcode = '42501', message = 'project room access denied';
  end if;

  return jsonb_build_object(
    'actor', jsonb_build_object(
      'actorKey', v_actor.actor_key,
      'displayName', v_actor.display_name,
      'permissionTier', v_actor.permission_tier
    ),
    'room', jsonb_build_object(
      'id', v_room.id,
      'title', v_room.title,
      'description', v_room.description,
      'roomType', v_room.room_type,
      'status', v_room.status,
      'updatedAt', v_room.updated_at
    ),
    'members', coalesce((
      select jsonb_agg(jsonb_build_object(
        'type', m.member_type,
        'key', m.member_key,
        'name', m.display_name
      ) order by m.member_type desc, m.display_name)
      from public.ai_project_room_members m
      where m.room_id = p_room_id
    ), '[]'::jsonb),
    'messages', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', x.id,
        'authorType', x.author_type,
        'authorKey', x.author_key,
        'authorName', x.author_name,
        'messageType', x.message_type,
        'body', x.body,
        'relatedRunId', x.related_run_id,
        'metadata', x.metadata,
        'createdAt', x.created_at
      ) order by x.created_at, x.id)
      from public.ai_project_room_messages x
      where x.room_id = p_room_id
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function public.create_ai_project_room_v01(
  p_title text,
  p_description text,
  p_room_type text,
  p_agents jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor governance.actor%rowtype;
  v_room_id uuid;
  v_agent jsonb;
begin
  v_actor := governance.require_authenticated_human();

  if length(btrim(coalesce(p_title, ''))) not between 2 and 120 then
    raise exception using errcode = '22023', message = 'invalid project room title';
  end if;
  if p_room_type not in ('STUDENT_CASE','ASSESSMENT','OPERATIONS','GENERAL') then
    raise exception using errcode = '22023', message = 'invalid project room type';
  end if;
  if jsonb_typeof(coalesce(p_agents, '[]'::jsonb)) <> 'array' then
    raise exception using errcode = '22023', message = 'agents must be an array';
  end if;

  insert into public.ai_project_rooms(title, description, room_type, created_by_actor_id)
  values (btrim(p_title), left(coalesce(p_description, ''), 2000), p_room_type, v_actor.id)
  returning id into v_room_id;

  insert into public.ai_project_room_members(room_id, member_type, member_key, display_name)
  values (v_room_id, 'HUMAN', v_actor.actor_key, v_actor.display_name);

  for v_agent in select value from jsonb_array_elements(p_agents)
  loop
    if (v_agent ->> 'key') ~ '^[a-z0-9][a-z0-9._-]{1,63}$'
       and length(btrim(coalesce(v_agent ->> 'name', ''))) > 0 then
      insert into public.ai_project_room_members(room_id, member_type, member_key, display_name)
      values (v_room_id, 'AI_AGENT', v_agent ->> 'key', left(v_agent ->> 'name', 120))
      on conflict do nothing;
    end if;
  end loop;

  insert into public.ai_project_room_messages(
    room_id, author_type, author_key, author_name, message_type, body
  ) values (
    v_room_id, 'SYSTEM', 'nctm-hub', 'NCTM Hub', 'SYSTEM',
    '프로젝트 룸이 열렸습니다. 업무지시와 검토 기록이 이 공간에 함께 저장됩니다.'
  );

  return v_room_id;
end;
$$;

create or replace function public.post_ai_project_room_message_v01(
  p_room_id uuid,
  p_message_type text,
  p_body text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor governance.actor%rowtype;
  v_message_id uuid;
begin
  v_actor := governance.require_authenticated_human();

  if p_message_type not in ('COMMENT','TASK_REQUEST','REVIEW','REWORK_REQUEST') then
    raise exception using errcode = '22023', message = 'invalid human message type';
  end if;
  if length(btrim(coalesce(p_body, ''))) not between 1 and 12000 then
    raise exception using errcode = '22023', message = 'invalid message body';
  end if;
  if not exists (
    select 1 from public.ai_project_rooms r
    where r.id = p_room_id
      and r.status not in ('ARCHIVED')
      and (
        v_actor.permission_tier = 5
        or exists (
          select 1 from public.ai_project_room_members m
          where m.room_id = r.id and m.member_type = 'HUMAN' and m.member_key = v_actor.actor_key
        )
      )
  ) then
    raise exception using errcode = '42501', message = 'project room access denied';
  end if;

  insert into public.ai_project_room_messages(
    room_id, author_type, author_key, author_name, message_type, body
  ) values (
    p_room_id, 'HUMAN', v_actor.actor_key, v_actor.display_name, p_message_type, btrim(p_body)
  ) returning id into v_message_id;

  update public.ai_project_rooms
  set status = case
        when p_message_type = 'REVIEW' then 'AWAITING_REVIEW'
        else 'IN_PROGRESS'
      end,
      updated_at = now()
  where id = p_room_id;

  return v_message_id;
end;
$$;

revoke all on function public.list_ai_project_rooms_v01() from public, anon;
revoke all on function public.get_ai_project_room_v01(uuid) from public, anon;
revoke all on function public.create_ai_project_room_v01(text,text,text,jsonb) from public, anon;
revoke all on function public.post_ai_project_room_message_v01(uuid,text,text) from public, anon;

grant execute on function public.list_ai_project_rooms_v01() to authenticated;
grant execute on function public.get_ai_project_room_v01(uuid) to authenticated;
grant execute on function public.create_ai_project_room_v01(text,text,text,jsonb) to authenticated;
grant execute on function public.post_ai_project_room_message_v01(uuid,text,text) to authenticated;

comment on table public.ai_project_rooms is 'Shared human + AI workspaces. All access goes through authenticated RPC gateways.';
comment on column public.ai_project_room_messages.related_run_id is 'Optional lineage link to governance.agent_run once an executable agent dispatches the task.';
