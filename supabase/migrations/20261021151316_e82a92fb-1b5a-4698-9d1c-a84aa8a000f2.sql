CREATE TABLE public.conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL DEFAULT 'direct' CHECK (type IN ('direct')),
  created_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  direct_key text UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  last_message_at timestamptz,
  CHECK (type <> 'direct' OR direct_key IS NOT NULL)
);
CREATE TABLE public.conversation_members (
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  joined_at timestamptz NOT NULL DEFAULT now(),
  last_read_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (conversation_id, user_id)
);
CREATE INDEX conversation_members_user_idx ON public.conversation_members(user_id);
CREATE TABLE public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id) ON DELETE CASCADE,
  content text NOT NULL CHECK (char_length(btrim(content)) BETWEEN 1 AND 4000),
  message_type text NOT NULL DEFAULT 'text' CHECK (message_type IN ('text')),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  edited_at timestamptz,
  deleted_at timestamptz
);
CREATE INDEX messages_conversation_created_idx ON public.messages(conversation_id, created_at DESC, id DESC);

GRANT SELECT ON public.conversations TO authenticated;
GRANT SELECT ON public.conversation_members TO authenticated;
GRANT SELECT, INSERT ON public.messages TO authenticated;
GRANT ALL ON public.conversations, public.conversation_members, public.messages TO service_role;

ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_conversation_member(_conversation_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.conversation_members
    WHERE conversation_id = _conversation_id AND user_id = auth.uid());
$$;
REVOKE EXECUTE ON FUNCTION public.is_conversation_member(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_conversation_member(uuid) TO authenticated;

CREATE POLICY "Members read conversations" ON public.conversations FOR SELECT TO authenticated
  USING (public.is_conversation_member(id));
CREATE POLICY "Members read co-members" ON public.conversation_members FOR SELECT TO authenticated
  USING (public.is_conversation_member(conversation_id));
CREATE POLICY "Members read messages" ON public.messages FOR SELECT TO authenticated
  USING (public.is_conversation_member(conversation_id));
CREATE POLICY "Members send as themselves" ON public.messages FOR INSERT TO authenticated
  WITH CHECK (sender_id = auth.uid() AND message_type = 'text' AND public.is_conversation_member(conversation_id));

CREATE OR REPLACE FUNCTION public.messages_before_insert()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.content := btrim(NEW.content);
  NEW.created_at := now();
  NEW.edited_at := NULL; NEW.deleted_at := NULL;
  RETURN NEW;
END; $$;
CREATE TRIGGER messages_before_insert BEFORE INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.messages_before_insert();

CREATE OR REPLACE FUNCTION public.messages_after_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.conversations SET last_message_at = NEW.created_at, updated_at = now()
    WHERE id = NEW.conversation_id;
  UPDATE public.conversation_members SET last_read_at = GREATEST(last_read_at, NEW.created_at)
    WHERE conversation_id = NEW.conversation_id AND user_id = NEW.sender_id;
  RETURN NEW;
END; $$;
REVOKE EXECUTE ON FUNCTION public.messages_after_insert() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER messages_after_insert AFTER INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.messages_after_insert();

CREATE OR REPLACE FUNCTION public.search_profiles(_query text)
RETURNS TABLE(id uuid, display_name text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE q text := btrim(coalesce(_query, ''));
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF char_length(q) < 2 OR char_length(q) > 40 THEN RETURN; END IF;
  q := replace(replace(replace(q, '\', '\\'), '%', '\%'), '_', '\_');
  RETURN QUERY SELECT p.id, p.display_name FROM public.profiles p
    WHERE p.id <> auth.uid() AND p.display_name <> '' AND p.display_name ILIKE '%' || q || '%'
    ORDER BY p.display_name LIMIT 10;
END; $$;
REVOKE EXECUTE ON FUNCTION public.search_profiles(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.search_profiles(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.start_direct_conversation(_other_user uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE me uuid := auth.uid(); k text; cid uuid;
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _other_user IS NULL OR _other_user = me THEN RAISE EXCEPTION 'Invalid user'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = _other_user) THEN RAISE EXCEPTION 'User not found'; END IF;
  k := least(me::text, _other_user::text) || ':' || greatest(me::text, _other_user::text);
  INSERT INTO public.conversations (type, created_by, direct_key) VALUES ('direct', me, k)
    ON CONFLICT (direct_key) DO NOTHING;
  SELECT id INTO cid FROM public.conversations WHERE direct_key = k;
  INSERT INTO public.conversation_members (conversation_id, user_id)
    VALUES (cid, me), (cid, _other_user) ON CONFLICT DO NOTHING;
  RETURN cid;
END; $$;
REVOKE EXECUTE ON FUNCTION public.start_direct_conversation(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.start_direct_conversation(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.mark_conversation_read(_conversation_id uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.conversation_members SET last_read_at = now()
  WHERE conversation_id = _conversation_id AND user_id = auth.uid();
$$;
REVOKE EXECUTE ON FUNCTION public.mark_conversation_read(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_conversation_read(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.list_conversations()
RETURNS TABLE(id uuid, other_user_id uuid, other_display_name text, last_message text,
  last_message_sender uuid, last_message_at timestamptz, unread_count bigint, other_last_read_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT c.id, o.user_id, coalesce(p.display_name, ''), lm.content, lm.sender_id,
    coalesce(c.last_message_at, c.created_at),
    (SELECT count(*) FROM public.messages m WHERE m.conversation_id = c.id
      AND m.sender_id <> auth.uid() AND m.created_at > me.last_read_at AND m.deleted_at IS NULL),
    o.last_read_at
  FROM public.conversation_members me
  JOIN public.conversations c ON c.id = me.conversation_id
  JOIN public.conversation_members o ON o.conversation_id = c.id AND o.user_id <> me.user_id
  LEFT JOIN public.profiles p ON p.id = o.user_id
  LEFT JOIN LATERAL (SELECT m.content, m.sender_id FROM public.messages m
    WHERE m.conversation_id = c.id AND m.deleted_at IS NULL
    ORDER BY m.created_at DESC, m.id DESC LIMIT 1) lm ON true
  WHERE me.user_id = auth.uid()
  ORDER BY coalesce(c.last_message_at, c.created_at) DESC
  LIMIT 100;
$$;
REVOKE EXECUTE ON FUNCTION public.list_conversations() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_conversations() TO authenticated;

ALTER PUBLICATION supabase_realtime ADD TABLE public.messages, public.conversation_members;