import { useState, useEffect } from 'react';
import { X, Check, AlertCircle, Loader2, Sun, Moon, Monitor } from 'lucide-react';
import { useLLM } from '@/context/LLMContext';
import { useTheme } from '@/context/ThemeContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

const themeOptions = [
  { value: 'light' as const, label: 'Light', icon: Sun },
  { value: 'dark' as const, label: 'Dark', icon: Moon },
  { value: 'system' as const, label: 'System', icon: Monitor },
];

export default function SettingsPanel({ isOpen, onClose }: SettingsPanelProps) {
  const { langgraphUrl, updateLanggraphUrl, checkConnection, isConnected } = useLLM();
  const { theme, setTheme } = useTheme();
  const [isChecking, setIsChecking] = useState(false);
  const [localLanggraphUrl, setLocalLanggraphUrl] = useState(langgraphUrl);
  useEffect(() => {
    setLocalLanggraphUrl(langgraphUrl);
  }, [langgraphUrl]);

  const handleCheckConnection = async () => {
    await updateLanggraphUrl(localLanggraphUrl);
    setIsChecking(true);
    await checkConnection();
    setIsChecking(false);
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="fixed right-0 top-0 z-50 h-full w-full max-w-md border-l border-border bg-card shadow-xl">
        <div className="flex h-full flex-col">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border p-4">
            <h2 className="text-lg font-semibold text-foreground">Settings</h2>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-5 w-5" />
            </Button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4 space-y-6">
            {/* Theme Selection */}
            <div className="space-y-3">
              <Label className="text-sm font-medium text-foreground">Appearance</Label>
              <div className="flex gap-2">
                {themeOptions.map(({ value, label, icon: Icon }) => (
                  <button
                    key={value}
                    onClick={() => setTheme(value)}
                    className={cn(
                      "flex flex-1 flex-col items-center gap-2 rounded-lg border p-3 transition-all",
                      theme === value
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/50 hover:bg-muted/50"
                    )}
                  >
                    <Icon className={cn(
                      "h-5 w-5",
                      theme === value ? "text-primary" : "text-muted-foreground"
                    )} />
                    <span className={cn(
                      "text-xs font-medium",
                      theme === value ? "text-foreground" : "text-muted-foreground"
                    )}>
                      {label}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* LangGraph */}
            <div className="space-y-4 rounded-lg border border-border p-4">
              <h3 className="text-sm font-medium text-foreground">LangGraph</h3>

              <div className="space-y-2">
                <Label htmlFor="langgraph-url" className="text-sm text-muted-foreground">
                  URL
                </Label>
                <Input
                  id="langgraph-url"
                  value={localLanggraphUrl}
                  onChange={(e) => setLocalLanggraphUrl(e.target.value)}
                  onBlur={() => updateLanggraphUrl(localLanggraphUrl)}
                  placeholder="http://localhost:4242"
                />
              </div>

              <div className="flex items-center gap-3 pt-2">
                <Button onClick={handleCheckConnection} disabled={isChecking} variant="outline">
                  {isChecking ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Checking...
                    </>
                  ) : (
                    'Test Connection'
                  )}
                </Button>

                <div className="flex items-center gap-2 text-sm">
                  {isConnected ? (
                    <>
                      <Check className="h-4 w-4 text-green-500" />
                      <span className="text-green-600">Connected</span>
                    </>
                  ) : (
                    <>
                      <AlertCircle className="h-4 w-4 text-destructive" />
                      <span className="text-destructive">Disconnected</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Info */}
            <div className="rounded-lg bg-muted/50 p-4 text-sm text-muted-foreground">
              <p className="font-medium text-foreground mb-2">About ARIA</p>
              <p>
                <strong>A</strong>utomation & <strong>R</strong>easoning <strong>I</strong>ntelligent <strong>A</strong>gent
              </p>
              <p className="mt-2">
                Specializes in creating and managing N8N workflows. Attach workflow files for analysis and get intelligent suggestions for automation.
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
