import { Globe } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { CardDescription, CardTitle } from '../ui/card';
import { CollapsibleCard } from '../ui/collapsible-card';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '../ui/select';

export function LanguageSettings() {
    const { t, i18n } = useTranslation();

    return (
        <CollapsibleCard
            header={
                <>
                    <div className="flex items-center gap-2">
                        <Globe className="h-5 w-5 text-primary" />
                        <CardTitle>{t('settings.language')}</CardTitle>
                    </div>
                    <CardDescription>
                        {t('settings.select_language')}
                    </CardDescription>
                </>
            }
        >
            <div className="flex items-center gap-4">
                <Select
                    value={i18n.language}
                    onValueChange={(value) => i18n.changeLanguage(value)}
                >
                    <SelectTrigger className="w-[180px]" data-testid="settings-language-select">
                        <SelectValue placeholder={t('settings.select_language')} />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="en" data-testid="settings-language-option-en">{t('languages.en')}</SelectItem>
                        <SelectItem value="es" data-testid="settings-language-option-es">{t('languages.es')}</SelectItem>
                        <SelectItem value="fr" data-testid="settings-language-option-fr">{t('languages.fr')}</SelectItem>
                        <SelectItem value="de" data-testid="settings-language-option-de">{t('languages.de')}</SelectItem>
                        <SelectItem value="zh" data-testid="settings-language-option-zh">{t('languages.zh')}</SelectItem>
                    </SelectContent>
                </Select>
            </div>
        </CollapsibleCard>
    );
}
