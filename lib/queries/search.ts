import { useQuery } from '@tanstack/react-query';
import { sbCore, supabase } from '../supabase';

export interface SearchTaskHit {
  kind: 'task';
  id: string;
  title: string;
  area_name: string | null;
  area_color: string | null;
  status: string;
}

export interface SearchAreaHit {
  kind: 'area';
  id: string;
  name: string;
  color: string;
}

export interface SearchPersonHit {
  kind: 'person';
  id: string;
  full_name: string | null;
  avatar_url: string | null;
}

export type SearchHit = SearchTaskHit | SearchAreaHit | SearchPersonHit;

export function useGlobalSearch(query: string) {
  const q = query.trim();
  return useQuery({
    queryKey: ['global-search', q],
    enabled: q.length >= 2,
    queryFn: async (): Promise<SearchHit[]> => {
      const like = `%${q}%`;
      const [tasksR, areasR, peopleR] = await Promise.all([
        supabase
          .from('tasks')
          .select('id, title, status, area:areas(name, color)')
          .ilike('title', like)
          .is('archived_at', null)
          .limit(15),
        supabase
          .from('areas')
          .select('id, name, color')
          .ilike('name', like)
          .limit(10),
        sbCore()
          .from('profiles')
          .select('id, full_name, avatar_url')
          .ilike('full_name', like)
          .limit(8),
      ]);
      if (tasksR.error) throw tasksR.error;
      if (areasR.error) throw areasR.error;
      if (peopleR.error) throw peopleR.error;

      const hits: SearchHit[] = [];
      (tasksR.data ?? []).forEach((t: any) => hits.push({
        kind: 'task',
        id: t.id,
        title: t.title,
        status: t.status,
        area_name: t.area?.name ?? null,
        area_color: t.area?.color ?? null,
      }));
      (areasR.data ?? []).forEach((a: any) => hits.push({
        kind: 'area',
        id: a.id,
        name: a.name,
        color: a.color,
      }));
      (peopleR.data ?? []).forEach((p: any) => hits.push({
        kind: 'person',
        id: p.id,
        full_name: p.full_name,
        avatar_url: p.avatar_url,
      }));
      return hits;
    },
  });
}
