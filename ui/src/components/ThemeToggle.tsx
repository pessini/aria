import { Sun, Moon } from 'lucide-react';
import { Switch } from '@/components/ui/switch';

interface ThemeToggleProps {
  theme: string;
  onThemeChange: (isDark: boolean) => void;
}

export default function ThemeToggle({ theme, onThemeChange }: ThemeToggleProps) {
  return (
    <div className="flex items-center gap-1.5">
      <Sun className="h-4 w-4 text-muted-foreground" />
      <Switch
        checked={theme === 'dark'}
        onCheckedChange={onThemeChange}
        className="scale-75"
      />
      <Moon className="h-4 w-4 text-muted-foreground" />
    </div>
  );
}
