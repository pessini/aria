import { forwardRef } from 'react';
import { Sun, Moon } from 'lucide-react';
import { Switch } from '@/components/ui/switch';

interface ThemeToggleProps {
  theme: string;
  onThemeChange: (isDark: boolean) => void;
}

const ThemeToggle = forwardRef<HTMLDivElement, ThemeToggleProps>(({ theme, onThemeChange }, ref) => {
  return (
    <div ref={ref} className="flex items-center gap-1.5">
      <Sun className="h-4 w-4 text-muted-foreground" />
      <Switch
        checked={theme === 'dark'}
        onCheckedChange={onThemeChange}
        className="scale-75"
      />
      <Moon className="h-4 w-4 text-muted-foreground" />
    </div>
  );
});

ThemeToggle.displayName = 'ThemeToggle';

export default ThemeToggle;
