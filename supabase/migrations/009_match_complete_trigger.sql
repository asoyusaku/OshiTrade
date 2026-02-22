-- マッチが完了した時に両ユーザーのアイテムを自動更新するトリガー
CREATE OR REPLACE FUNCTION public.on_match_completed()
RETURNS TRIGGER AS $$
BEGIN
  -- statusが'completed'に変更された場合のみ実行
  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
    -- 関連するhave_itemsをis_available=falseに
    UPDATE public.have_items
    SET is_available = false
    WHERE id IN (
      SELECT have_item_id FROM public.match_items WHERE match_id = NEW.id
    );

    -- 関連するwant_itemsをis_fulfilled=trueに
    UPDATE public.want_items
    SET is_fulfilled = true
    WHERE id IN (
      SELECT want_item_id FROM public.match_items WHERE match_id = NEW.id
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_match_completed
  AFTER UPDATE ON public.matches
  FOR EACH ROW
  EXECUTE FUNCTION public.on_match_completed();
