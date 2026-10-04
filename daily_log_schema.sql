-- One row per user per local calendar day: how many reviews were done and whether
-- the daily mission was completed. Powers the streak and the activity calendar.
CREATE TABLE IF NOT EXISTS daily_log (
  user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  day DATE NOT NULL,
  active_reviewed INTEGER NOT NULL DEFAULT 0,
  passive_reviewed INTEGER NOT NULL DEFAULT 0,
  goal_met BOOLEAN NOT NULL DEFAULT false,
  updated_at BIGINT NOT NULL,
  PRIMARY KEY (user_id, day)
);

-- Set up RLS for daily_log
ALTER TABLE daily_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own daily_log"
ON daily_log FOR SELECT
USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can insert their own daily_log"
ON daily_log FOR INSERT
WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can update their own daily_log"
ON daily_log FOR UPDATE
USING ((select auth.uid()) = user_id)
WITH CHECK ((select auth.uid()) = user_id);

-- Atomically add review counts to a day's row (rapid card ratings would race with read-then-write)
CREATE OR REPLACE FUNCTION increment_daily_log(p_day DATE, p_active INTEGER, p_passive INTEGER)
RETURNS SETOF daily_log
LANGUAGE sql
SECURITY INVOKER
SET search_path = public
AS $$
  INSERT INTO daily_log (user_id, day, active_reviewed, passive_reviewed, updated_at)
  VALUES (auth.uid(), p_day, p_active, p_passive, (extract(epoch FROM now()) * 1000)::bigint)
  ON CONFLICT (user_id, day) DO UPDATE SET
    active_reviewed = daily_log.active_reviewed + EXCLUDED.active_reviewed,
    passive_reviewed = daily_log.passive_reviewed + EXCLUDED.passive_reviewed,
    updated_at = EXCLUDED.updated_at
  RETURNING *;
$$;
