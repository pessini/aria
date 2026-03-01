export default function ThinkingIndicator() {
  return (
    <div className="flex justify-start py-2">
      <div className="flex items-center gap-1.5 text-muted-foreground text-sm">
        <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60 animate-[dot-pulse_1.4s_ease-in-out_infinite_0ms]" />
        <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60 animate-[dot-pulse_1.4s_ease-in-out_infinite_200ms]" />
        <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60 animate-[dot-pulse_1.4s_ease-in-out_infinite_400ms]" />
        <span className="ml-1 text-xs">Thinking...</span>
      </div>
    </div>
  );
}
