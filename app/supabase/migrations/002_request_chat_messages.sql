-- Request chat messages migration
-- Adds in-app customer/driver chat for active service requests.

CREATE TABLE IF NOT EXISTS request_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES service_requests(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sender_role TEXT NOT NULL,
  sender_name TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_request_messages_request_id ON request_messages(request_id);
CREATE INDEX IF NOT EXISTS idx_request_messages_created_at ON request_messages(created_at DESC);

ALTER TABLE request_messages ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'request_messages'
      AND policyname = 'Participants can view active request messages'
  ) THEN
    CREATE POLICY "Participants can view active request messages" ON request_messages
      FOR SELECT USING (
        EXISTS (
          SELECT 1
          FROM service_requests sr
          WHERE sr.id = request_messages.request_id
            AND sr.status IN ('assigned', 'accepted', 'in_progress')
            AND (
              sr.customer_id = auth.uid()
              OR sr.driver_id = auth.uid()
              OR sr.provider_id = auth.uid()
              OR sr.mechanic_id = auth.uid()
            )
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'request_messages'
      AND policyname = 'Participants can send active request messages'
  ) THEN
    CREATE POLICY "Participants can send active request messages" ON request_messages
      FOR INSERT WITH CHECK (
        sender_id = auth.uid()
        AND EXISTS (
          SELECT 1
          FROM service_requests sr
          WHERE sr.id = request_messages.request_id
            AND sr.status IN ('assigned', 'accepted', 'in_progress')
            AND (
              sr.customer_id = auth.uid()
              OR sr.driver_id = auth.uid()
              OR sr.provider_id = auth.uid()
              OR sr.mechanic_id = auth.uid()
            )
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'request_messages'
      AND policyname = 'Admins can view all request messages'
  ) THEN
    CREATE POLICY "Admins can view all request messages" ON request_messages
      FOR SELECT USING (
        EXISTS (
          SELECT 1
          FROM profiles p
          WHERE p.id = auth.uid()
            AND p.role = 'admin'
        )
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'request_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE request_messages;
  END IF;
END $$;
