import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../supabase';

export type TriggerKind = 'created' | 'status_changed_to';
export type ActionKind  = 'set_priority' | 'assign_to' | 'add_label' | 'set_status' | 'archive';

export interface AutomationRule {
  id: string;
  area_id: string;
  name: string;
  enabled: boolean;
  trigger: { kind: TriggerKind; status?: string };
  action: {
    kind: ActionKind;
    priority?: string;
    user_id?: string;
    label?: string;
    status?: string;
  };
  created_at: string;
}

export function useAreaAutomations(areaId: string | undefined) {
  return useQuery({
    queryKey: ['automations', areaId],
    enabled: !!areaId,
    queryFn: async (): Promise<AutomationRule[]> => {
      const { data, error } = await supabase
        .from('automation_rules')
        .select('id, area_id, name, enabled, trigger, action, created_at')
        .eq('area_id', areaId!)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data ?? []) as AutomationRule[];
    },
  });
}

export function useCreateAutomation(areaId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      name: string;
      trigger: AutomationRule['trigger'];
      action: AutomationRule['action'];
    }) => {
      if (!areaId) throw new Error('Sin tablero');
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase
        .from('automation_rules')
        .insert({
          area_id: areaId,
          name: input.name.trim(),
          trigger: input.trigger,
          action: input.action,
          created_by: user?.id ?? null,
        });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['automations', areaId] }); },
  });
}

export function useToggleAutomation(areaId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, enabled }: { id: string; enabled: boolean }) => {
      const { error } = await supabase
        .from('automation_rules')
        .update({ enabled })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['automations', areaId] }); },
  });
}

export function useDeleteAutomation(areaId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('automation_rules').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['automations', areaId] }); },
  });
}
