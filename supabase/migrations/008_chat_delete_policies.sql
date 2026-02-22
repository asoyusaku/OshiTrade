-- チャット参加者がメッセージを削除できるようにする
CREATE POLICY "Chat participants can delete messages" ON public.messages
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.chat_rooms cr
      WHERE cr.id = messages.chat_room_id
      AND (cr.user_a = auth.uid() OR cr.user_b = auth.uid())
    )
  );

-- チャット参加者がチャットルームを削除できるようにする
CREATE POLICY "Chat participants can delete rooms" ON public.chat_rooms
  FOR DELETE USING (auth.uid() = user_a OR auth.uid() = user_b);

-- 位置共有の削除ポリシー
CREATE POLICY "Users can delete own location shares" ON public.location_shares
  FOR DELETE USING (user_id = auth.uid());
