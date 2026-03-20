/**
 * Mode Toggle Component
 *
 * A dropdown menu button that allows the user to switch between
 * Light, Dark, and System theme modes.
 */

import { Moon, Sun } from "lucide-react"
import { Button } from "./ui/button"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "./ui/dropdown-menu"
import { useTheme } from "./theme-provider"
import { useTranslation } from "react-i18next"

/**
 * ModeToggle component.
 * Renders a button with a sun/moon icon that toggles the theme dropdown.
 */
export function ModeToggle({ className }: { className?: string }) {
    const { setTheme } = useTheme()
    const { t } = useTranslation()

    return (
        <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" type="button" className={className}>
                    <Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
                    <Moon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
                    <span className="sr-only">{t('settings.toggle_theme')}</span>
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" side="top">
                <DropdownMenuItem onClick={() => setTheme("light")}>
                    {t('settings.light')}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setTheme("cream")}>
                    {t('settings.cream')}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setTheme("dark")}>
                    {t('settings.dark')}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setTheme("slate")}>
                    {t('settings.slate')}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setTheme("amber")}>
                    {t('settings.amber')}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setTheme("system")}>
                    {t('settings.system')}
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    )
}
