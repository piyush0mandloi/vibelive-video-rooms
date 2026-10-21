REVOKE ALL ON public.conversations, public.conversation_members, public.messages FROM anon, authenticated;
GRANT SELECT ON public.conversations, public.conversation_members TO authenticated;
GRANT SELECT, INSERT ON public.messages TO authenticated;