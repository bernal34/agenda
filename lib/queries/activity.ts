import { useQuery } from '@tanstack/react-query';
import { sbCore, supabase } from '../supabase';

export type ActivityAction =
  | 'task.created'
  | 'task.status_changed'
  | 'task.completed'
  | 'subtask.completed'
  | 'comment.added'
  | 'attachment.added'
  | 'task.assigned';

export interface ActivityEntry {
  id: string;
  task_id: string | null;
  user_id: string | null;
  action: ActivityAction;
  payload: Record<string, unknown>;
  created_at: string;
  task: {
    id: string;
    title: string;
    area: { id: string; name: string; color: string } | null;
  } | null;
  actor: {
    id: string;
    full_name: string | null;
    avatar_url: string | null;
  } | null;
}

const PAGE_SIZE = 50;

/**
 * Actividad personal del usuario: solo eventos que él mismo disparó.
 * Antes mostraba la actividad de todas sus áreas; cambió a personal por
 * privacidad (el ruido de ver lo que hacen los demás no agregaba valor).
 * Si más adelante se quiere ver actividad ajena con permisos, se puede
 * agregar un toggle gateado por rol en área o super_admin.
 */
export function useRecentActivity(userId: string | undefined) {
  return useQuery({
    queryKey: ['activity', userId],
    enabled: !!userId,
    queryFn: async (): Promise<ActivityEntry[]> => {
      const { data, error } = await supabase
        .from('activity_log')
        .select(
          'id, task_id, user_id, action, payload, created_at, task:tasks(id, title, area:areas(id, name, color))',
        )
        .eq('user_id', userId!)
        .order('created_at', { ascending: false })
        .limit(PAGE_SIZE);
      if (error) throw error;

      const rows = (data ?? []) as any[];

      // Resolver actores con un solo fetch a profiles
      const actorIds = Array.from(
        new Set(rows.map((r) => r.user_id).filter((x): x is string => !!x)),
      );
      let actorMap = new Map<string, ActivityEntry['actor']>();
      if (actorIds.length > 0) {
        const { data: profiles, error: pErr } = await sbCore()
          .from('profiles')
          .select('id, full_name, avatar_url')
          .in('id', actorIds);
        if (pErr) throw pErr;
        actorMap = new Map(
          (profiles ?? []).map((p: any) => [p.id, {
            id: p.id,
            full_name: p.full_name,
            avatar_url: p.avatar_url,
          }]),
        );
      }

      return rows.map((r): ActivityEntry => ({
        id: r.id,
        task_id: r.task_id,
        user_id: r.user_id,
        action: r.action,
        payload: r.payload ?? {},
        created_at: r.created_at,
        task: r.task,
        actor: r.user_id ? actorMap.get(r.user_id) ?? null : null,
      }));
    },
  });
}
