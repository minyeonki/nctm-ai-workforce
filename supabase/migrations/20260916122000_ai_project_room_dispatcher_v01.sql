-- Project room dispatcher v0.2.
-- Connects room task requests to existing wf_instructions / wf_executions review flow.

alter table public.ai_project_room_messages
  add column if not exists assigned_agent_key text,
  add column if not exists execution_id uuid references public.wf_executions(id),
  add column if not exists dispatch_status text
    check (dispatch_status is null or dispatch_status in ('RUNNING','AWAITING_REVIEW','FAILED'));

create unique index if not exists ai_project_room_messages_task_execution_uidx
  on public.ai_project_room_messages(execution_id)
  where execution_id is not null and message_type = 'TASK_REQUEST';

create or replace function public.enqueue_ai_project_task_v01(
  p_room_id uuid,
  p_agent_key text,
  p_body text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor governance.actor%rowtype;
  v_message_id uuid;
  v_instruction_id uuid;
  v_execution_id uuid;
begin
  v_actor := governance.require_authenticated_human();

  if length(btrim(coalesce(p_body, ''))) not between 1 and 12000 then
    raise exception using errcode = '22023', message = 'invalid task body';
  end if;

  if not exists (
    select 1
    from public.ai_project_rooms r
    where r.id = p_room_id
      and r.status <> 'ARCHIVED'
      and (
        v_actor.permission_tier = 5
        or exists (
          select 1 from public.ai_project_room_members hm
          where hm.room_id = r.id
            and hm.member_type = 'HUMAN'
            and hm.member_key = v_actor.actor_key
        )
      )
  ) then
    raise exception using errcode = '42501', message = 'project room access denied';
  end if;

  if not exists (
    select 1 from public.ai_project_room_members am
    where am.room_id = p_room_id
      and am.member_type = 'AI_AGENT'
      and am.member_key = p_agent_key
  ) then
    raise exception using errcode = '22023', message = 'assigned agent is not a room member';
  end if;

  insert into public.wf_instructions (
    agent_id, instruction_text, target_context, risk_grade, status,
    created_by, draft_type, content_json, source_system,
    idempotency_key, proposed_risk_grade, schema_version
  ) values (
    p_agent_key,
    btrim(p_body),
    jsonb_build_object('room_id', p_room_id),
    'R1',
    'running',
    v_actor.actor_key,
    'WORK_REPORT',
    jsonb_build_object('room_id', p_room_id, 'requester', v_actor.actor_key),
    'ai-project-room',
    'room:' || p_room_id::text || ':message:' || gen_random_uuid()::text,
    'R1',
    '1.0'
  ) returning id into v_instruction_id;

  insert into public.wf_executions (
    instruction_id, status, needs_approval, target_system, started_at
  ) values (
    v_instruction_id, 'running', true, 'ai-project-room', now()
  ) returning id into v_execution_id;

  insert into public.ai_project_room_messages (
    room_id, author_type, author_key, author_name, message_type, body,
    assigned_agent_key, execution_id, dispatch_status,
    metadata
  ) values (
    p_room_id, 'HUMAN', v_actor.actor_key, v_actor.display_name, 'TASK_REQUEST', btrim(p_body),
    p_agent_key, v_execution_id, 'RUNNING',
    jsonb_build_object('instruction_id', v_instruction_id)
  ) returning id into v_message_id;

  update public.ai_project_rooms
  set status = 'IN_PROGRESS', updated_at = now()
  where id = p_room_id;

  return jsonb_build_object(
    'messageId', v_message_id,
    'instructionId', v_instruction_id,
    'executionId', v_execution_id
  );
end;
$$;

create or replace function public.complete_ai_project_task_v01(
  p_execution_id uuid,
  p_result text,
  p_model_name text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor governance.actor%rowtype;
  v_request public.ai_project_room_messages%rowtype;
  v_agent_name text;
  v_result_id uuid;
begin
  v_actor := governance.require_authenticated_human();

  select m.* into v_request
  from public.ai_project_room_messages m
  where m.execution_id = p_execution_id
    and m.message_type = 'TASK_REQUEST'
    and m.dispatch_status = 'RUNNING'
  for update;

  if not found then
    raise exception using errcode = '55000', message = 'task is not dispatchable';
  end if;

  if v_actor.permission_tier < 5 and v_request.author_key <> v_actor.actor_key then
    raise exception using errcode = '42501', message = 'only requester or R5 may complete dispatch';
  end if;

  select display_name into v_agent_name
  from public.ai_project_room_members
  where room_id = v_request.room_id
    and member_type = 'AI_AGENT'
    and member_key = v_request.assigned_agent_key;

  update public.wf_executions
  set status = 'review_requested',
      output = jsonb_build_object(
        'text', p_result,
        'model', p_model_name,
        'room_message_id', v_request.id,
        'provenance', 'anthropic-api'
      ),
      finished_at = now()
  where id = p_execution_id and status = 'running';

  if not found then
    raise exception using errcode = '55000', message = 'execution is not running';
  end if;

  update public.wf_instructions i
  set status = 'review_requested',
      model_name = p_model_name,
      content_json = i.content_json || jsonb_build_object('result', p_result)
  from public.wf_executions e
  where e.id = p_execution_id and i.id = e.instruction_id;

  update public.ai_project_room_messages
  set dispatch_status = 'AWAITING_REVIEW'
  where id = v_request.id;

  insert into public.ai_project_room_messages (
    room_id, author_type, author_key, author_name, message_type, body,
    assigned_agent_key, execution_id, dispatch_status,
    metadata
  ) values (
    v_request.room_id,
    'AI_AGENT',
    v_request.assigned_agent_key,
    coalesce(v_agent_name, v_request.assigned_agent_key),
    'AI_RESULT',
    p_result,
    v_request.assigned_agent_key,
    p_execution_id,
    'AWAITING_REVIEW',
    jsonb_build_object('model', p_model_name, 'provenance', 'anthropic-api', 'draft', true)
  ) returning id into v_result_id;

  update public.ai_project_rooms
  set status = 'AWAITING_REVIEW', updated_at = now()
  where id = v_request.room_id;

  return v_result_id;
end;
$$;

create or replace function public.fail_ai_project_task_v01(
  p_execution_id uuid,
  p_error_message text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor governance.actor%rowtype;
  v_request public.ai_project_room_messages%rowtype;
begin
  v_actor := governance.require_authenticated_human();

  select * into v_request
  from public.ai_project_room_messages
  where execution_id = p_execution_id
    and message_type = 'TASK_REQUEST'
    and dispatch_status = 'RUNNING'
  for update;

  if not found then return; end if;
  if v_actor.permission_tier < 5 and v_request.author_key <> v_actor.actor_key then
    raise exception using errcode = '42501', message = 'only requester or R5 may fail dispatch';
  end if;

  update public.wf_executions
  set status = 'failed',
      error_message = left(coalesce(p_error_message, 'AI dispatch failed'), 1000),
      finished_at = now()
  where id = p_execution_id;

  update public.wf_instructions i
  set status = 'failed'
  from public.wf_executions e
  where e.id = p_execution_id and i.id = e.instruction_id;

  update public.ai_project_room_messages
  set dispatch_status = 'FAILED'
  where id = v_request.id;

  insert into public.ai_project_room_messages (
    room_id, author_type, author_key, author_name, message_type, body,
    assigned_agent_key, execution_id, dispatch_status
  ) values (
    v_request.room_id, 'SYSTEM', 'nctm-hub', 'NCTM Hub', 'SYSTEM',
    'AI 처리 중 오류가 발생했습니다. 업무 기록은 보존되며 다시 실행할 수 있습니다.',
    v_request.assigned_agent_key, null, 'FAILED'
  );

  update public.ai_project_rooms
  set updated_at = now()
  where id = v_request.room_id;
end;
$$;

revoke all on function public.enqueue_ai_project_task_v01(uuid,text,text) from public, anon;
revoke all on function public.complete_ai_project_task_v01(uuid,text,text) from public, anon;
revoke all on function public.fail_ai_project_task_v01(uuid,text) from public, anon;
grant execute on function public.enqueue_ai_project_task_v01(uuid,text,text) to authenticated;
grant execute on function public.complete_ai_project_task_v01(uuid,text,text) to authenticated;
grant execute on function public.fail_ai_project_task_v01(uuid,text) to authenticated;

comment on function public.enqueue_ai_project_task_v01(uuid,text,text) is
  'Creates one room task plus wf instruction/execution with a single idempotent lineage.';
comment on function public.complete_ai_project_task_v01(uuid,text,text) is
  'Stores an AI draft as awaiting review; never approves or performs external side effects.';


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
        'assignedAgentKey', x.assigned_agent_key,
        'executionId', x.execution_id,
        'dispatchStatus', x.dispatch_status,
        'metadata', x.metadata,
        'createdAt', x.created_at
      ) order by x.created_at, x.id)
      from public.ai_project_room_messages x
      where x.room_id = p_room_id
    ), '[]'::jsonb)
  );
end;
$$;
