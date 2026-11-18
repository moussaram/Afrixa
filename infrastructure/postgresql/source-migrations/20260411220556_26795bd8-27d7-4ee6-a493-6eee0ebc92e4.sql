
-- Drop the overly permissive insert policy
DROP POLICY "System can insert notifications" ON public.notifications;

-- Create a restrictive insert policy - only authenticated users can insert notifications for themselves
-- The actual system notifications are created by SECURITY DEFINER triggers which bypass RLS
CREATE POLICY "Users can insert their own notifications"
ON public.notifications FOR INSERT
WITH CHECK (auth.uid() = user_id);
