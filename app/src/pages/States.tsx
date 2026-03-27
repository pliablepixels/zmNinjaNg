import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getStates, changeState } from '../api/states';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { toast } from 'sonner';
import { Activity, Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useCurrentProfile } from '../hooks/useCurrentProfile';
import { useAuthStore } from '../stores/auth';

export default function States() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const { currentProfile } = useCurrentProfile();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  const { data: states, isLoading, error } = useQuery({
    queryKey: ['states'],
    queryFn: getStates,
    enabled: !!currentProfile && isAuthenticated,
  });

  const changeMutation = useMutation({
    mutationFn: changeState,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['states'] });
      toast.success(t('states.change_success'));
    },
    onError: (error: Error) => {
      toast.error(t('states.change_error', { error: error.message }));
    },
  });

  if (isLoading) {
    return (
      <div className="p-8">
        <h1 className="text-lg font-bold mb-6">{t('states.title')}</h1>
        <p>{t('common.loading')}</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8">
        <h1 className="text-lg font-bold mb-6">{t('states.title')}</h1>
        <div className="p-4 bg-destructive/10 text-destructive rounded-md">
          {t('states.load_error')}: {(error as Error).message}
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="flex items-center gap-3 mb-6">
        <Activity className="h-8 w-8" />
        <h1 className="text-lg font-bold">{t('states.title')}</h1>
      </div>

      <p className="text-muted-foreground mb-6">
        {t('states.description')}
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {states?.map((state) => (
          <Card key={state.Id} className={state.IsActive === '1' ? 'border-primary' : ''}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    {state.Name}
                    {state.IsActive === '1' && (
                      <Check className="h-5 w-5 text-green-600" />
                    )}
                  </CardTitle>
                  <CardDescription className="mt-2">
                    {state.Definition || t('states.no_description')}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Button
                onClick={() => changeMutation.mutate(state.Name)}
                disabled={state.IsActive === '1' || changeMutation.isPending}
                className="w-full"
                variant={state.IsActive === '1' ? 'secondary' : 'default'}
                data-testid={`activate-state-${state.Id}`}
              >
                {state.IsActive === '1' ? t('states.active') : t('states.activate')}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
